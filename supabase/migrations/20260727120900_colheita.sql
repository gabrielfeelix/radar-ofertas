-- =============================================================
-- Colheita de canais de terceiros (D-012)
--
-- Canal alheio é fonte de DESCOBERTA, nunca fonte da verdade. O
-- que se aproveita é o fato — que produto existe e que ele pode
-- estar barato. Se está barato mesmo, quem decide é a nossa série
-- de preços, pelas mesmas duas comportas de sempre.
--
-- O ganho maior nem é a oferta: é o catálogo. Todo produto
-- avistado entra no radar e começa a acumular série. Sem isso, o
-- catálogo cresceria na velocidade em que uma pessoa cola link à
-- mão, e 30 ofertas por dia nunca sairiam do papel.
--
-- O que NÃO se copia: o texto da mensagem alheia e o link de
-- afiliado dela. Guardamos o código do produto e montamos link e
-- mensagem nossos.
-- =============================================================

create table public.fonte_descoberta (
  id                uuid primary key default gen_random_uuid(),
  plataforma        text not null default 'telegram',
  -- Nome do canal sem o @. Ex.: 'nerdofertas'.
  identificador     text not null,
  nome              text,
  -- web_publica    — lê t.me/s/<canal>, conteúdo público, sem conta
  --                  nossa envolvida. Risco zero de banimento.
  -- conta_usuario  — lê por conta dedicada do Telegram. Alcança
  --                  grupo fechado, com o risco registrado na D-012.
  tipo_leitura      text not null default 'web_publica',
  nicho             text,
  ativo             boolean not null default true,
  ultima_leitura_em timestamptz,
  -- Último post lido. Evita reprocessar a página inteira a cada
  -- passada.
  ultimo_post_id    bigint,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  constraint fonte_plataforma_valida check (plataforma in ('telegram')),
  constraint fonte_tipo_leitura_valido check (tipo_leitura in ('web_publica', 'conta_usuario'))
);

comment on table public.fonte_descoberta is
  'Canal de terceiro que lemos em busca de candidatas. Nunca publicamos nada nele.';

create unique index fonte_descoberta_uk
  on public.fonte_descoberta (plataforma, identificador);

create index fonte_descoberta_fila_idx
  on public.fonte_descoberta (ultima_leitura_em asc nulls first)
  where ativo;

create trigger fonte_descoberta_atualizado_em
  before update on public.fonte_descoberta
  for each row execute function public.marca_atualizado_em();

alter table public.fonte_descoberta enable row level security;

-- -------------------------------------------------------------
-- Menção: um link de produto avistado num canal.
--
-- Guardar isto, e não só o anúncio resultante, permite responder
-- a pergunta que decide onde investir a leitura: **qual canal
-- rende?** Um canal que traz 300 links por dia e nenhum vira
-- oferta aprovada é ruído caro, e sem esta tabela isso ficaria
-- invisível.
-- -------------------------------------------------------------
create table public.mencao (
  id                       bigint generated always as identity primary key,
  fonte_id                 uuid not null references public.fonte_descoberta(id) on delete cascade,
  -- Id da mensagem no canal de origem.
  post_externo_id          bigint not null,
  publicada_em             timestamptz,

  -- O link como apareceu, quase sempre encurtado e com o código de
  -- afiliado de outra pessoa. Guardado para auditoria; nunca é o
  -- link que publicamos.
  url_bruta                text not null,
  url_resolvida            text,

  marketplace_id           uuid references public.marketplace(id) on delete set null,
  sku_externo              text,
  anuncio_id               uuid references public.anuncio(id) on delete set null,

  -- Preço que o canal alegou. NÃO é dado de preço: é alegação de
  -- terceiro, e nunca entra em preco_ponto. Serve para comparar
  -- depois com o preço que nós mesmos coletamos — e para flagrar
  -- canal que mente.
  preco_alegado_centavos   integer,

  resultado                text not null default 'pendente',
  detalhe                  text,
  vista_em                 timestamptz not null default now(),
  processada_em            timestamptz,

  constraint mencao_resultado_valido check (resultado in (
    'pendente',            -- ainda não resolvida
    'anuncio_novo',        -- virou anúncio novo no catálogo
    'anuncio_existente',   -- já estava no radar
    'loja_desconhecida',   -- link de loja que não trabalhamos
    'nao_reconhecido',     -- resolveu, mas não achamos o código do produto
    'erro'                 -- falha ao resolver o link
  )),
  constraint mencao_preco_positivo
    check (preco_alegado_centavos is null or preco_alegado_centavos > 0)
);

comment on table public.mencao is
  'Link de produto avistado num canal de terceiro. Fonte de descoberta, nunca de preço.';
comment on column public.mencao.preco_alegado_centavos is
  'Preço que o canal alegou. Alegação de terceiro: nunca entra em preco_ponto.';
comment on column public.mencao.url_bruta is
  'Link como apareceu, com o afiliado de outra pessoa. Auditoria apenas: nunca é republicado.';

-- O mesmo link no mesmo post não é visto duas vezes, mesmo que a
-- página seja lida de novo.
create unique index mencao_uk on public.mencao (fonte_id, post_externo_id, url_bruta);

create index mencao_pendentes_idx on public.mencao (vista_em) where resultado = 'pendente';
create index mencao_anuncio_idx on public.mencao (anuncio_id) where anuncio_id is not null;

alter table public.mencao enable row level security;

-- =============================================================
-- registra_mencao
--
-- Ponto único de entrada da colheita. Recebe um link já resolvido
-- e identificado, cria produto e anúncio se for novidade, e
-- devolve o que aconteceu.
--
-- O título vem do canal de origem e é fraco de propósito — canal
-- de oferta escreve título com emoji e caixa alta. Ele serve para
-- o anúncio não nascer sem nome; o título bom é o que a fonte
-- oficial do marketplace vai trazer na primeira coleta.
-- =============================================================
create or replace function public.registra_mencao(
  p_fonte_id        uuid,
  p_post_externo_id bigint,
  p_url_bruta       text,
  p_url_resolvida   text,
  p_marketplace_slug text,
  p_sku             text,
  p_titulo          text,
  p_preco_centavos  integer default null,
  p_publicada_em    timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marketplace_id uuid;
  v_anuncio_id     uuid;
  v_produto_id     uuid;
  v_resultado      text;
begin
  select id into v_marketplace_id from public.marketplace where slug = p_marketplace_slug;

  if v_marketplace_id is null then
    insert into public.mencao (fonte_id, post_externo_id, url_bruta, url_resolvida,
                               resultado, detalhe, publicada_em, processada_em)
    values (p_fonte_id, p_post_externo_id, p_url_bruta, p_url_resolvida,
            'loja_desconhecida', p_marketplace_slug, p_publicada_em, now())
    on conflict (fonte_id, post_externo_id, url_bruta) do nothing;
    return 'loja_desconhecida';
  end if;

  select id into v_anuncio_id
    from public.anuncio
   where marketplace_id = v_marketplace_id and sku_externo = p_sku;

  if v_anuncio_id is null then
    insert into public.produto (titulo_canonico, categoria)
    values (coalesce(nullif(trim(p_titulo), ''), p_sku), null)
    returning id into v_produto_id;

    insert into public.anuncio (produto_id, marketplace_id, url_original, sku_externo)
    values (v_produto_id, v_marketplace_id, p_url_resolvida, p_sku)
    returning id into v_anuncio_id;

    v_resultado := 'anuncio_novo';
  else
    v_resultado := 'anuncio_existente';
  end if;

  insert into public.mencao (
    fonte_id, post_externo_id, url_bruta, url_resolvida, marketplace_id,
    sku_externo, anuncio_id, preco_alegado_centavos, resultado, publicada_em, processada_em
  ) values (
    p_fonte_id, p_post_externo_id, p_url_bruta, p_url_resolvida, v_marketplace_id,
    p_sku, v_anuncio_id, p_preco_centavos, v_resultado, p_publicada_em, now()
  )
  on conflict (fonte_id, post_externo_id, url_bruta) do nothing;

  return v_resultado;
end;
$$;

comment on function public.registra_mencao is
  'Entrada única da colheita: grava a menção e cadastra o anúncio se for novidade.';

-- =============================================================
-- View: rendimento_da_fonte
--
-- Responde onde vale a pena gastar leitura. Canal que traz muito
-- link e pouco anúncio aproveitável é ruído caro.
-- =============================================================
create view public.rendimento_da_fonte
with (security_invoker = true)
as
select
  f.id                                                          as fonte_id,
  f.identificador,
  f.nome,
  f.tipo_leitura,
  f.ativo,
  f.ultima_leitura_em,
  count(m.id)                                                   as mencoes,
  count(*) filter (where m.resultado = 'anuncio_novo')           as anuncios_novos,
  count(*) filter (where m.resultado = 'anuncio_existente')      as ja_conhecidos,
  count(*) filter (where m.resultado in ('nao_reconhecido','erro','loja_desconhecida'))
                                                                as descartadas,
  count(distinct o.id)                                          as ofertas_aprovadas
from public.fonte_descoberta f
left join public.mencao m on m.fonte_id = f.id
left join public.oferta o on o.anuncio_id = m.anuncio_id
group by f.id, f.identificador, f.nome, f.tipo_leitura, f.ativo, f.ultima_leitura_em;

comment on view public.rendimento_da_fonte is
  'Quanto cada canal rende: menções, anúncios novos e quantos viraram oferta aprovada.';

grant select, insert, update, delete on public.fonte_descoberta, public.mencao to service_role;
grant select on public.rendimento_da_fonte to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.registra_mencao(uuid, bigint, text, text, text, text, text, integer, timestamptz) to service_role;
