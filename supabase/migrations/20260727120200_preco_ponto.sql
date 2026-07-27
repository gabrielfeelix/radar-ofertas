-- =============================================================
-- Fase 1 · migration 3 de 3 — série histórica de preço
--
-- Esta é a tabela que mais cresce e é o ativo do negócio: sem
-- série de preço não existe "caiu de verdade", e sem isso o
-- sistema vira mais um bot que anuncia preço normal como
-- promoção.
--
-- Duas regras de docs/dados.md estão implementadas aqui, no
-- banco, e não no código do coletor — para que nenhum coletor
-- futuro consiga violá-las por descuido:
--
--   1. No máximo um ponto por anúncio por dia. Se coletar mais
--      de uma vez, fica o MENOR preço do dia.
--   2. Ponto mais velho que o `cache_preco_max_horas` do
--      marketplace é descartado (na prática, a Amazon).
-- =============================================================

create table public.preco_ponto (
  id              bigint generated always as identity primary key,
  anuncio_id      uuid not null references public.anuncio(id) on delete cascade,
  preco_centavos  integer not null,
  disponivel      boolean not null default true,
  coletado_em     timestamptz not null default now(),

  -- Data no fuso de São Paulo, gravada por trigger.
  -- Não é coluna gerada porque a conversão de fuso não é
  -- IMMUTABLE no Postgres e generated column exige isso.
  -- O "dia" é conceito operacional (o dia do Gabriel), então é
  -- o dia local que importa, não o UTC.
  dia_local       date not null,

  constraint preco_ponto_preco_positivo
    check (preco_centavos > 0)
);

comment on table  public.preco_ponto is
  'Série histórica de preço por anúncio. Um ponto por anúncio por dia, o menor do dia.';
comment on column public.preco_ponto.preco_centavos is
  'INTEGER de centavos, sempre. Float em dinheiro erra justo no cálculo de repasse (D-005).';
comment on column public.preco_ponto.disponivel is
  'Falso quando o anúncio existe mas está esgotado. Preço de item esgotado não é oferta.';
comment on column public.preco_ponto.dia_local is
  'Data em America/Sao_Paulo. Chave do "um ponto por dia".';

-- -------------------------------------------------------------
-- Preenche dia_local a partir de coletado_em, sempre.
-- -------------------------------------------------------------
create or replace function public.preco_ponto_define_dia_local()
returns trigger
language plpgsql
as $$
begin
  new.dia_local = (new.coletado_em at time zone 'America/Sao_Paulo')::date;
  return new;
end;
$$;

create trigger preco_ponto_dia_local
  before insert or update of coletado_em on public.preco_ponto
  for each row execute function public.preco_ponto_define_dia_local();

-- Regra 1, no banco: um ponto por anúncio por dia.
create unique index preco_ponto_anuncio_dia_uk
  on public.preco_ponto (anuncio_id, dia_local);

-- Leitura dominante: "os últimos N dias deste anúncio",
-- que é o que a mediana de referência da oferta precisa.
create index preco_ponto_anuncio_recente_idx
  on public.preco_ponto (anuncio_id, coletado_em desc);

alter table public.preco_ponto enable row level security;

-- -------------------------------------------------------------
-- Função: registra_preco
--
-- Ponto único de escrita da série. O coletor chama isto, nunca
-- um INSERT direto — assim a regra do "menor do dia" fica
-- garantida mesmo se o coletor rodar duas vezes por engano.
--
-- Também atualiza `ultima_coleta_em` do anúncio.
-- -------------------------------------------------------------
create or replace function public.registra_preco(
  p_anuncio_id     uuid,
  p_preco_centavos integer,
  p_disponivel     boolean default true,
  p_coletado_em    timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.preco_ponto (anuncio_id, preco_centavos, disponivel, coletado_em, dia_local)
  values (p_anuncio_id, p_preco_centavos, p_disponivel, p_coletado_em,
          (p_coletado_em at time zone 'America/Sao_Paulo')::date)
  on conflict (anuncio_id, dia_local) do update
    -- Menor preço do dia vence. Empate mantém o registro existente.
    set preco_centavos = least(public.preco_ponto.preco_centavos, excluded.preco_centavos),
        disponivel     = excluded.disponivel,
        coletado_em    = case
                           when excluded.preco_centavos < public.preco_ponto.preco_centavos
                           then excluded.coletado_em
                           else public.preco_ponto.coletado_em
                         end
  returning id into v_id;

  update public.anuncio
     set ultima_coleta_em = p_coletado_em
   where id = p_anuncio_id;

  return v_id;
end;
$$;

comment on function public.registra_preco is
  'Grava um ponto de preço mantendo o menor do dia. Único caminho de escrita da série.';

-- -------------------------------------------------------------
-- Função: expurga_precos_expirados
--
-- Regra 2: apaga pontos mais velhos que o teto de retenção do
-- marketplace. Hoje isso só atinge a Amazon (24h), por causa da
-- política de associados — ver D-003 em docs/decisoes.md.
--
-- Marketplace com `cache_preco_max_horas` nulo não tem teto e
-- nunca é expurgado.
--
-- Roda por pg_cron uma vez por hora (agendamento fica na
-- migration de cron, quando o projeto Supabase existir).
-- -------------------------------------------------------------
create or replace function public.expurga_precos_expirados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removidos integer;
begin
  with expirados as (
    delete from public.preco_ponto pp
    using public.anuncio a, public.marketplace m
    where pp.anuncio_id = a.id
      and a.marketplace_id = m.id
      and m.cache_preco_max_horas is not null
      and pp.coletado_em < now() - make_interval(hours => m.cache_preco_max_horas)
    returning 1
  )
  select count(*) into v_removidos from expirados;

  return v_removidos;
end;
$$;

comment on function public.expurga_precos_expirados is
  'Apaga pontos de preço além do teto de retenção do marketplace (Amazon, 24h). Retorna quantos.';

-- -------------------------------------------------------------
-- View: anuncio_serie
--
-- Resposta pronta para a pergunta que a Fase 1 precisa
-- responder: "este anúncio já tem série suficiente?".
--
-- `dias_de_serie` é o que decide se a mensagem pode falar em
-- desconto histórico. Menos de 14, não pode (regra 3.4).
-- -------------------------------------------------------------
create view public.anuncio_serie
with (security_invoker = true)
as
select
  a.id                                          as anuncio_id,
  a.produto_id,
  a.marketplace_id,
  m.slug                                        as marketplace_slug,
  m.base_de_historico,
  count(pp.id)                                  as pontos,
  count(distinct pp.dia_local)                  as dias_com_ponto,
  min(pp.dia_local)                             as primeiro_dia,
  max(pp.dia_local)                             as ultimo_dia,
  (max(pp.dia_local) - min(pp.dia_local) + 1)   as dias_de_serie,
  min(pp.preco_centavos)                        as menor_preco_centavos,
  max(pp.preco_centavos)                        as maior_preco_centavos,
  (percentile_cont(0.5) within group (order by pp.preco_centavos))::integer
                                                as mediana_preco_centavos
from public.anuncio a
join public.marketplace m on m.id = a.marketplace_id
left join public.preco_ponto pp on pp.anuncio_id = a.id
group by a.id, a.produto_id, a.marketplace_id, m.slug, m.base_de_historico;

comment on view public.anuncio_serie is
  'Saúde da série por anúncio. dias_de_serie < 14 proíbe falar em desconto histórico (regra 3.4).';
