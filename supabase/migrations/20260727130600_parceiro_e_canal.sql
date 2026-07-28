-- =============================================================
-- 07 · Parceiro e canal
--
-- Entram na fundação, e não na fase das telas, por dois motivos:
--
--   1. O RLS do operador passa por `canal.operador_id`. Sem canal,
--      metade do modelo de acesso ficaria por escrever.
--   2. A fila de aprovação precisa da capacidade dos canais para
--      mostrar o número que muda comportamento — "30 ofertas → 87
--      publicações → 18 vagas hoje". Sem canal, a tela nasce cega.
-- =============================================================

create table public.parceiro (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references public.operacao(id) on delete cascade,
  nome          text not null,
  contato       text,
  -- Nunca aparece para outro parceiro, nem em listagem, nem por
  -- acidente. Ver a policy na migration de RLS.
  chave_pix     text,
  tipo          text not null default 'amigo',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint parceiro_tipo_valido check (tipo in ('proprio', 'amigo', 'youtuber'))
);

comment on table public.parceiro is
  'Quem traz audiência. Entidade de dinheiro: chave de pagamento, split e extrato.';
comment on column public.parceiro.chave_pix is
  'Nunca exposta a outro parceiro. Ver a policy de RLS.';

create trigger parceiro_atualizado_em
  before update on public.parceiro
  for each row execute function public.marca_atualizado_em();

alter table public.parceiro enable row level security;

-- Fecha a dependência circular deixada na migration 02.
alter table public.usuario
  add constraint usuario_parceiro_fk
  foreign key (parceiro_id) references public.parceiro(id) on delete set null;

-- =============================================================
-- Canal
-- =============================================================
create table public.canal (
  id                   uuid primary key default gen_random_uuid(),
  operacao_id          uuid not null references public.operacao(id) on delete cascade,
  parceiro_id          uuid references public.parceiro(id) on delete restrict,
  nome                 text not null,
  plataforma           text not null,
  telegram_chat_id     text,
  membros_estimados    integer,

  -- Teto diário. É limite real e é o orçamento do dia: aprovar 30
  -- ofertas em 3 canais gera 90 publicações contra a soma dos
  -- tetos. Sem isto visível, o dono aprova de graça e descobre o
  -- custo depois, em pé, no telefone.
  posts_por_dia_max    integer not null default 6,
  horarios_permitidos  integer[] not null default '{9,12,15,18,21}',

  -- Os dois percentuais ficam separados porque um parceiro pode
  -- ter só audiência, ou audiência E operação. O que sobra dos
  -- dois é a parte do dono.
  split_audiencia_pct  numeric(5,2) not null default 0,
  split_operacao_pct   numeric(5,2) not null default 0,

  operador_id          uuid references public.usuario(id) on delete set null,
  ativo                boolean not null default true,
  ultima_publicacao_em timestamptz,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),

  constraint canal_plataforma_valida check (plataforma in ('whatsapp', 'telegram')),
  constraint canal_teto_positivo check (posts_por_dia_max > 0),
  constraint canal_splits_validos check (
    split_audiencia_pct >= 0 and split_operacao_pct >= 0
    and split_audiencia_pct + split_operacao_pct <= 100
  ),
  -- Telegram publica sozinho pela API oficial e precisa do chat.
  -- WhatsApp é sempre manual (D-002), então não tem identificador.
  constraint canal_telegram_tem_chat check (
    plataforma <> 'telegram' or telegram_chat_id is not null
  )
);

comment on table public.canal is
  'Um canal de WhatsApp ou Telegram. O teto diário é o orçamento de publicação do dia.';
comment on column public.canal.posts_por_dia_max is
  'Teto diário. É o número que a fila de aprovação precisa mostrar antes de aprovar.';

create index canal_parceiro_idx on public.canal (parceiro_id);
create index canal_operador_idx on public.canal (operador_id);

create trigger canal_atualizado_em
  before update on public.canal
  for each row execute function public.marca_atualizado_em();

alter table public.canal enable row level security;

-- -------------------------------------------------------------
-- Canal aceita vários nichos; produto tem um (D-019).
-- É por aqui que a aprovação roteia: uma publicação para cada
-- canal que aceita o nicho do produto.
-- -------------------------------------------------------------
create table public.canal_nicho (
  canal_id  uuid not null references public.canal(id) on delete cascade,
  nicho_id  uuid not null references public.nicho(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (canal_id, nicho_id)
);

comment on table public.canal_nicho is
  'Quais nichos cada canal aceita. É o roteamento da aprovação.';

create index canal_nicho_nicho_idx on public.canal_nicho (nicho_id);

alter table public.canal_nicho enable row level security;

-- =============================================================
-- View: capacidade do dia
--
-- Quantas vagas cada canal ainda tem hoje. É o dado que falta na
-- tela de aprovação — sem ele, as publicações que não cabem somem
-- sem que nenhuma tela diga para onde foram.
--
-- A contagem de publicações entra na migration 09, quando a tabela
-- existir; por ora a vaga é o teto cheio.
-- =============================================================
create view public.canal_capacidade
with (security_invoker = true)
as
select
  c.id                as canal_id,
  c.operacao_id,
  c.nome,
  c.plataforma,
  c.posts_por_dia_max as teto,
  c.operador_id,
  array(select cn.nicho_id from public.canal_nicho cn where cn.canal_id = c.id) as nichos
from public.canal c
where c.ativo;

comment on view public.canal_capacidade is
  'Teto e nichos por canal. Base do número "N ofertas → N publicações → N vagas hoje".';
