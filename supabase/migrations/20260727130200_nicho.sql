-- =============================================================
-- 03 · Nicho
--
-- O eixo que liga produto a canal (D-019). Produto tem UM nicho;
-- canal aceita VÁRIOS.
--
-- Vira entidade, e não texto livre, por dois motivos concretos:
--
--   1. É o roteamento. Aprovar uma oferta gera publicação para
--      cada canal que aceita aquele nicho. Com texto livre,
--      "pet" e "Pet" seriam dois roteamentos diferentes, e o
--      sintoma seria oferta que não chega em canal nenhum — sem
--      erro, sem aviso.
--
--   2. É onde os limiares são sobrescritos (D-023). Vinte por
--      cento de desconto em ração é oferta excelente; vinte por
--      cento em eletrônico é terça-feira comum.
-- =============================================================

create table public.nicho (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references public.operacao(id) on delete cascade,
  nome          text not null,
  slug          text not null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint nicho_slug_valido check (slug ~ '^[a-z0-9_]+$')
);

comment on table public.nicho is
  'Eixo de roteamento entre produto e canal, e o nível onde os limiares são sobrescritos.';
comment on column public.nicho.slug is
  'Minúsculo, sem acento. É o que o código usa; `nome` é o que a pessoa lê.';

create unique index nicho_slug_uk on public.nicho (operacao_id, slug);

create trigger nicho_atualizado_em
  before update on public.nicho
  for each row execute function public.marca_atualizado_em();

alter table public.nicho enable row level security;

insert into public.nicho (operacao_id, nome, slug)
select id, 'Pet', 'pet' from public.operacao;
