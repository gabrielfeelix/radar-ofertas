-- =============================================================
-- 06 · Produto, anúncio e série de preço
--
-- A separação que o projeto inteiro depende:
--
--   produto  — a identidade da coisa
--   anuncio  — essa coisa numa loja específica. O mesmo tapete na
--              Shopee, no Mercado Livre e na Amazon é UM produto
--              com TRÊS anúncios, três preços e três séries
--   oferta   — um anúncio que ficou barato agora (migration 09)
--
-- Juntar produto e anúncio parece mais simples no dia 1 e torna a
-- nota da oferta impossível de calcular no dia 30.
-- =============================================================

create table public.produto (
  id              uuid primary key default gen_random_uuid(),
  operacao_id     uuid not null references public.operacao(id) on delete cascade,
  -- Nulo é estado real e esperado: a colheita traz milhares de
  -- produtos e nem todo canal lido tem nicho declarado. Produto
  -- sem nicho não é roteado para canal nenhum, e por isso existe a
  -- tela de triagem.
  nicho_id        uuid references public.nicho(id) on delete set null,
  titulo_canonico text not null,
  categoria       text,
  imagem_url      text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

comment on table public.produto is
  'A identidade do item, independente de loja. Um produto tem N anúncios.';
comment on column public.produto.nicho_id is
  'Nulo = não roteado. É o estado que a tela de triagem em lote resolve.';
comment on column public.produto.titulo_canonico is
  'Título limpo. O que vem de canal de terceiro é provisório e fraco de propósito.';

create index produto_nicho_idx on public.produto (nicho_id);
-- Fila da triagem: produto que não chega a canal nenhum.
create index produto_sem_nicho_idx on public.produto (operacao_id, criado_em desc)
  where nicho_id is null;

create trigger produto_atualizado_em
  before update on public.produto
  for each row execute function public.marca_atualizado_em();

alter table public.produto enable row level security;

-- -------------------------------------------------------------
-- Anúncio
-- -------------------------------------------------------------
create table public.anuncio (
  id                 uuid primary key default gen_random_uuid(),
  operacao_id        uuid not null references public.operacao(id) on delete cascade,
  produto_id         uuid not null references public.produto(id) on delete cascade,
  marketplace_id     uuid not null references public.marketplace(id) on delete restrict,
  url_original       text not null,
  sku_externo        text not null,
  vendedor           text,

  -- Dois sinais DIFERENTES, de propósito separados: produto ruim
  -- de vendedor bom e produto bom de vendedor ruim pedem decisões
  -- distintas. A tela pode juntar; o limiar não pode.
  avaliacao          numeric(2,1),          -- nota do produto, 0 a 5
  avaliacao_qtd      integer,               -- amostra da nota
  reputacao_vendedor numeric(3,2),          -- do vendedor, normalizada 0 a 1
  loja_oficial       boolean,
  vendas_estimadas   integer,

  ativo              boolean not null default true,
  ultima_coleta_em   timestamptz,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),

  constraint anuncio_avaliacao_valida
    check (avaliacao is null or (avaliacao >= 0 and avaliacao <= 5)),
  constraint anuncio_avaliacao_qtd_valida
    check (avaliacao_qtd is null or avaliacao_qtd >= 0),
  constraint anuncio_reputacao_valida
    check (reputacao_vendedor is null or (reputacao_vendedor >= 0 and reputacao_vendedor <= 1))
);

comment on table public.anuncio is
  'Um produto numa loja específica. É a unidade que tem preço e é coletada.';
comment on column public.anuncio.avaliacao_qtd is
  'Nota 5,0 com duas avaliações não vale nota 4,6 com oitocentas.';
comment on column public.anuncio.reputacao_vendedor is
  'Normalizada de 0 a 1. Cada loja tem escala própria; a conversão é feita na fonte.';

-- O par (loja, sku) é o que identifica o anúncio no mundo real.
-- Sem este índice, o mesmo link colado duas vezes — ou colado à
-- mão e depois colhido de um canal — cria dois anúncios e parte a
-- série histórica em duas, em silêncio.
create unique index anuncio_marketplace_sku_uk on public.anuncio (marketplace_id, sku_externo);

-- Fila do coletor. `nulls first` põe anúncio recém-cadastrado na
-- frente de todos.
create index anuncio_fila_coleta_idx
  on public.anuncio (ultima_coleta_em asc nulls first) where ativo;

create index anuncio_produto_idx on public.anuncio (produto_id);

create trigger anuncio_atualizado_em
  before update on public.anuncio
  for each row execute function public.marca_atualizado_em();

alter table public.anuncio enable row level security;

-- =============================================================
-- Série de preço
--
-- A tabela que mais cresce e o ativo do negócio. Sem série não
-- existe "caiu de verdade", e sem isso o sistema vira mais um bot
-- que anuncia preço normal como promoção.
--
-- Duas regras moram aqui, no banco, e não no coletor — para que
-- nenhum código futuro consiga violá-las por descuido:
--
--   1. No máximo um ponto por anúncio por dia; havendo mais de uma
--      coleta, fica o MENOR preço do dia.
--   2. Ponto mais velho que o teto de retenção da loja é apagado.
-- =============================================================
create table public.preco_ponto (
  id             bigint generated always as identity primary key,
  anuncio_id     uuid not null references public.anuncio(id) on delete cascade,
  preco_centavos integer not null,
  disponivel     boolean not null default true,
  coletado_em    timestamptz not null default now(),
  -- Data no fuso da operação. Não é coluna gerada porque conversão
  -- de fuso não é IMMUTABLE, e o "dia" aqui é o dia de quem opera.
  dia_local      date not null,

  constraint preco_ponto_positivo check (preco_centavos > 0)
);

comment on table public.preco_ponto is
  'Série histórica por anúncio. Um ponto por dia, o menor do dia.';
comment on column public.preco_ponto.preco_centavos is
  'INTEGER de centavos, sempre. Float em dinheiro erra justo no cálculo de repasse (D-005).';
comment on column public.preco_ponto.disponivel is
  'Falso quando o anúncio existe mas está esgotado. Preço de item esgotado não é oferta.';

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

-- Regra 1, garantida pelo banco.
create unique index preco_ponto_anuncio_dia_uk on public.preco_ponto (anuncio_id, dia_local);
-- Leitura dominante: "os últimos N dias deste anúncio".
create index preco_ponto_recente_idx on public.preco_ponto (anuncio_id, coletado_em desc);

alter table public.preco_ponto enable row level security;

-- -------------------------------------------------------------
-- registra_preco — o único caminho de escrita da série.
--
-- O coletor chama isto, nunca um INSERT direto: assim a regra do
-- "menor do dia" vale mesmo se a coleta rodar duas vezes.
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
    set preco_centavos = least(public.preco_ponto.preco_centavos, excluded.preco_centavos),
        disponivel     = excluded.disponivel,
        coletado_em    = case
                           when excluded.preco_centavos < public.preco_ponto.preco_centavos
                           then excluded.coletado_em
                           else public.preco_ponto.coletado_em
                         end
  returning id into v_id;

  update public.anuncio set ultima_coleta_em = p_coletado_em where id = p_anuncio_id;

  return v_id;
end;
$$;

comment on function public.registra_preco is
  'Grava um ponto mantendo o menor do dia. Único caminho de escrita da série.';

-- -------------------------------------------------------------
-- expurga_precos_expirados — regra 2.
-- Hoje só atinge a Amazon, pela D-003.
-- -------------------------------------------------------------
create or replace function public.expurga_precos_expirados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_removidos integer;
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

-- -------------------------------------------------------------
-- compacta_serie_antiga — a série perde resolução, não some.
--
-- Medido: cada ponto custa 187 bytes com índices. Dez mil anúncios
-- crescem 682 MB por ano e estouram os 500 MB do plano gratuito em
-- oito meses — em produção, com o canal no ar.
--
-- A curadoria usa janela de 30 dias, então nada na regra perde
-- precisão guardando um ponto por semana no que é antigo. Guarda-se
-- o MENOR da semana, e não a média: a série existe para responder
-- "quão barato isso já esteve", e média esconde o vale que
-- interessa.
-- -------------------------------------------------------------
create or replace function public.compacta_serie_antiga()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias      integer := public.parametro('dias_resolucao_diaria')::integer;
  v_removidos integer;
begin
  with antigos as (
    select pp.id,
           row_number() over (
             partition by pp.anuncio_id, date_trunc('week', pp.dia_local)
             order by pp.preco_centavos asc, pp.dia_local asc
           ) as posicao
      from public.preco_ponto pp
     where pp.dia_local < public.hoje() - v_dias
  ),
  apagados as (
    delete from public.preco_ponto pp using antigos a
     where pp.id = a.id and a.posicao > 1
    returning 1
  )
  select count(*) into v_removidos from apagados;
  return v_removidos;
end;
$$;

-- -------------------------------------------------------------
-- View: saúde da série por anúncio.
-- -------------------------------------------------------------
create view public.anuncio_serie
with (security_invoker = true)
as
select
  a.id                                        as anuncio_id,
  a.operacao_id,
  a.produto_id,
  a.marketplace_id,
  m.slug                                      as marketplace_slug,
  m.base_de_historico,
  count(pp.id)                                as pontos,
  count(distinct pp.dia_local)                as dias_com_ponto,
  min(pp.dia_local)                           as primeiro_dia,
  max(pp.dia_local)                           as ultimo_dia,
  (max(pp.dia_local) - min(pp.dia_local) + 1) as dias_de_serie,
  min(pp.preco_centavos)                      as menor_preco_centavos,
  max(pp.preco_centavos)                      as maior_preco_centavos,
  (percentile_cont(0.5) within group (order by pp.preco_centavos))::integer
                                              as mediana_preco_centavos
from public.anuncio a
join public.marketplace m on m.id = a.marketplace_id
left join public.preco_ponto pp on pp.anuncio_id = a.id
group by a.id, a.operacao_id, a.produto_id, a.marketplace_id, m.slug, m.base_de_historico;

comment on view public.anuncio_serie is
  'Saúde da série por anúncio. Alimenta a tela de coleta e o diagnóstico.';
