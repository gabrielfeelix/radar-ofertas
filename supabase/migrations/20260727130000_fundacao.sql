-- =============================================================
-- 01 · Fundação
--
-- Três coisas que precisam existir antes de qualquer tabela de
-- negócio: a operação, os utilitários, e o padrão de permissão.
--
-- SOBRE `operacao` (D-021)
--
-- Existe uma linha, e nada na interface menciona a palavra. Toda
-- tabela carrega `operacao_id` e todo RLS passa por ela.
--
-- É a única decisão do projeto que é cara de retroagir: login,
-- telas e nichos entram depois sem dor, mas separação por operação
-- toca toda tabela, toda policy e toda consulta. Fazer depois é
-- reescrever o banco com a série histórica dentro — e a série não
-- pode ser refeita, porque preço de terça passada não existe mais
-- em lugar nenhum.
--
-- Hoje custa uma coluna e uma cláusula por policy. Com o banco
-- vazio, isso é praticamente zero.
--
-- Isto NÃO é escopo de SaaS: sem cadastro público, sem plano, sem
-- cobrança. É deixar de fechar uma porta, não construir o prédio.
-- =============================================================

-- -------------------------------------------------------------
-- Padrão de permissão, definido ANTES de existir qualquer objeto.
--
-- No Postgres, tabela e função nascem abertas: função concede
-- EXECUTE a PUBLIC, que não é um papel — é todo mundo, inclusive
-- `anon`, cuja chave viaja dentro do JavaScript da página.
--
-- Revogar depois é caçar objeto. Mudar o padrão agora faz cada
-- objeto novo nascer fechado, e a concessão vira ato explícito.
-- Se alguém esquecer de conceder, o servidor não consegue chamar:
-- falha barulhenta, que é o modo certo de falhar.
-- -------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- -------------------------------------------------------------
-- A operação.
-- -------------------------------------------------------------
create table public.operacao (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  fuso          text not null default 'America/Sao_Paulo',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.operacao is
  'Fronteira de isolamento. Hoje existe uma linha e a interface não menciona a palavra (D-021).';

insert into public.operacao (nome) values ('Radar de Ofertas');

-- -------------------------------------------------------------
-- Utilitários.
-- -------------------------------------------------------------
create or replace function public.marca_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

comment on function public.marca_atualizado_em is
  'Trigger de BEFORE UPDATE. Evita depender de o código lembrar de preencher.';

-- Data no fuso da operação. Existe como função porque a conversão
-- de fuso não é IMMUTABLE, então não pode virar coluna gerada, e
-- porque "hoje" é conceito operacional — o dia de quem opera, não
-- o dia UTC.
create or replace function public.hoje()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

comment on function public.hoje is
  'Data corrente no fuso da operação. "Hoje" é o dia de quem opera, não o dia UTC.';

create trigger operacao_atualizado_em
  before update on public.operacao
  for each row execute function public.marca_atualizado_em();

alter table public.operacao enable row level security;
