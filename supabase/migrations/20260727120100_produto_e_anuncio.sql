-- =============================================================
-- Fase 1 · migration 2 de 3 — produto e anúncio
--
-- A separação entre os dois é o coração do modelo (docs/dados.md):
--
--   produto  = a identidade da coisa
--              "Tapete higiênico SuperSecão 80x60"
--   anuncio  = essa coisa numa loja específica
--              o mesmo produto no ML, na Shopee e na Amazon
--              são TRÊS anúncios, com três preços e três donos
--
-- Juntar os dois numa tabela só parece mais simples no dia 1 e
-- torna a nota da oferta impossível de calcular no dia 30.
-- =============================================================

-- -------------------------------------------------------------
-- Tabela: produto
-- -------------------------------------------------------------
create table public.produto (
  id               uuid primary key default gen_random_uuid(),
  titulo_canonico  text not null,
  categoria        text,
  imagem_url       text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

comment on table  public.produto is
  'Identidade do item, independente de loja. Um produto tem N anúncios.';
comment on column public.produto.titulo_canonico is
  'Título limpo escolhido pelo operador, não o título poluído do marketplace.';
comment on column public.produto.categoria is
  'Define o percentual de comissão. Livre na Fase 1; vira tabela na Fase 2.';

create trigger produto_atualizado_em
  before update on public.produto
  for each row execute function public.marca_atualizado_em();

alter table public.produto enable row level security;

-- -------------------------------------------------------------
-- Tabela: anuncio
--
-- O mesmo produto numa loja específica. É o que tem preço, e
-- portanto é o que o coletor visita todo dia.
-- -------------------------------------------------------------
create table public.anuncio (
  id                uuid primary key default gen_random_uuid(),
  produto_id        uuid not null references public.produto(id) on delete cascade,
  marketplace_id    uuid not null references public.marketplace(id) on delete restrict,
  url_original      text not null,
  sku_externo       text not null,
  vendedor          text,
  avaliacao         numeric(2,1),
  ativo             boolean not null default true,
  ultima_coleta_em  timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  constraint anuncio_avaliacao_valida
    check (avaliacao is null or (avaliacao >= 0 and avaliacao <= 5))
);

comment on table  public.anuncio is
  'Um produto numa loja específica. É a unidade que tem preço e é coletada.';
comment on column public.anuncio.sku_externo is
  'Identificador do anúncio na loja de origem (MLB..., ASIN, id da Shopee).';
comment on column public.anuncio.ultima_coleta_em is
  'Última tentativa de coleta, bem ou mal sucedida. Usado para priorizar a fila.';

-- O par (loja, sku) é o que identifica o anúncio no mundo real.
-- Sem este índice, colar o mesmo link duas vezes cria dois
-- anúncios e parte a série histórica em duas.
create unique index anuncio_marketplace_sku_uk
  on public.anuncio (marketplace_id, sku_externo);

-- Fila do coletor: "quais anúncios ativos estão há mais tempo
-- sem coleta". nulls first garante que anúncio recém-cadastrado
-- é coletado antes de qualquer outro.
create index anuncio_fila_coleta_idx
  on public.anuncio (ultima_coleta_em asc nulls first)
  where ativo;

create index anuncio_produto_idx on public.anuncio (produto_id);

create trigger anuncio_atualizado_em
  before update on public.anuncio
  for each row execute function public.marca_atualizado_em();

alter table public.anuncio enable row level security;
