-- =============================================================
-- 02 · Usuário e papéis
--
-- POR QUE PAPEL É LISTA, E NÃO VALOR ÚNICO
--
-- A primeira modelagem tinha `papel` como um valor só: dono OU
-- operador OU parceiro. Isso contradiz o modelo de dinheiro do
-- próprio projeto: `canal` guarda `split_audiencia_pct` e
-- `split_operacao_pct` SEPARADOS justamente porque um parceiro
-- pode trazer a audiência **e** operar o canal — é o arranjo mais
-- provável entre amigos, e rende 65% em vez de 45%.
--
-- Com papel único, essa pessoa perde o extrato ou perde a fila.
-- Nenhuma das duas é aceitável, e nenhuma daria erro: ela
-- simplesmente não veria metade do que deveria.
--
-- Lista, e não tabela de junção, porque o conjunto é fixo e tem
-- três valores. Tabela de junção aqui só adiciona um JOIN em toda
-- policy de RLS, que é o caminho quente do banco.
-- =============================================================

create table public.usuario (
  id            uuid primary key references auth.users(id) on delete cascade,
  operacao_id   uuid not null references public.operacao(id) on delete cascade,
  nome          text not null,
  email         text not null,
  papeis        text[] not null default '{}',
  -- Preenchido quando a pessoa é parceira. Liga o usuário ao
  -- extrato dela. A referência é criada depois que `parceiro`
  -- existir — dependência circular resolvida na migration 07.
  parceiro_id   uuid,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint usuario_papeis_validos
    check (papeis <@ array['dono', 'operador', 'parceiro']::text[]),
  constraint usuario_tem_ao_menos_um_papel
    check (array_length(papeis, 1) >= 1)
);

comment on table public.usuario is
  'Quem tem acesso. Não existe cadastro público: conta nasce de convite do dono.';
comment on column public.usuario.papeis is
  'Lista, não valor único: a mesma pessoa pode trazer a audiência e operar o canal.';

create index usuario_operacao_idx on public.usuario (operacao_id);

create trigger usuario_atualizado_em
  before update on public.usuario
  for each row execute function public.marca_atualizado_em();

alter table public.usuario enable row level security;

-- =============================================================
-- Funções de contexto — a base de todo RLS do sistema
--
-- São SECURITY DEFINER e leem `usuario`, que por sua vez tem RLS.
-- Sem SECURITY DEFINER isso seria recursão infinita: a policy
-- chamaria a função, que consultaria a tabela, que aplicaria a
-- policy, que chamaria a função.
-- =============================================================

create or replace function public.operacao_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.operacao_id
    from public.usuario u
   where u.id = auth.uid()
     and u.ativo;
$$;

comment on function public.operacao_atual is
  'A operação de quem está pedindo. Nulo para quem não tem sessão. Base de todo RLS.';

create or replace function public.tem_papel(p_papel text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p_papel = any(u.papeis)
       from public.usuario u
      where u.id = auth.uid() and u.ativo),
    false);
$$;

comment on function public.tem_papel is
  'Se quem está pedindo tem o papel. Papel é lista: uma pessoa pode ter mais de um.';

create or replace function public.parceiro_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.parceiro_id
    from public.usuario u
   where u.id = auth.uid() and u.ativo;
$$;

comment on function public.parceiro_atual is
  'O parceiro ligado a quem está pedindo, quando houver. Recorta o extrato.';
