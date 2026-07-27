-- =============================================================
-- Fase 1 · migration 1 de 3 — fundação e marketplace
--
-- Cria as funções auxiliares usadas por todas as tabelas e a
-- tabela `marketplace`, que é a raiz de dependência do schema.
--
-- Convenções seguidas (AGENTS.md seção 6 e docs/dados.md):
--   · snake_case, português, tabela no singular
--   · toda tabela tem id, criado_em (e atualizado_em quando muda)
--   · dinheiro sempre INTEGER de centavos
--   · timestamptz sempre em UTC
--   · RLS ligado desde a primeira migration
-- =============================================================

-- -------------------------------------------------------------
-- Função: mantém `atualizado_em` sempre correto sem depender de
-- o código lembrar de preencher. Usada por trigger nas tabelas
-- que sofrem UPDATE.
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
  'Trigger de BEFORE UPDATE: grava now() em atualizado_em.';

-- -------------------------------------------------------------
-- Tabela: marketplace
--
-- Cada loja de onde saem anúncios. Guarda o ID de afiliado e as
-- restrições da plataforma que o resto do sistema precisa
-- respeitar.
--
-- `cache_preco_max_horas` existe por causa da Amazon: a política
-- de associados permite guardar preço por no máximo 24 horas.
-- A regra vive aqui, como dado, e não espalhada em `if` no
-- código — assim muda por marketplace sem tocar em coletor.
--
-- `suporta_subid` começa nulo de propósito: só a Fase 0 (prova
-- de rastreio) pode responder isso, com compra real.
-- -------------------------------------------------------------
create table public.marketplace (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  nome                  text not null,
  afiliado_id           text,
  comissao_padrao_pct   numeric(5,2) not null default 0,
  suporta_subid         boolean,
  subid_tamanho_max     integer,
  cache_preco_max_horas integer,
  base_de_historico     boolean not null default false,
  ativo                 boolean not null default true,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  constraint marketplace_comissao_padrao_pct_valida
    check (comissao_padrao_pct >= 0 and comissao_padrao_pct <= 100),
  constraint marketplace_cache_preco_max_horas_positivo
    check (cache_preco_max_horas is null or cache_preco_max_horas > 0)
);

comment on table  public.marketplace is
  'Lojas de origem dos anúncios, com ID de afiliado e restrições da plataforma.';
comment on column public.marketplace.afiliado_id is
  'ID de afiliado do dono. É dinheiro: nunca exponha em policy nem no navegador.';
comment on column public.marketplace.suporta_subid is
  'Nulo até a Fase 0 provar com compra real. Não preencha por suposição.';
comment on column public.marketplace.cache_preco_max_horas is
  'Teto de retenção de preço imposto pela plataforma. Amazon = 24. Nulo = sem teto.';
comment on column public.marketplace.base_de_historico is
  'Se falso, os preços deste marketplace não formam série histórica exibível (D-003).';

create trigger marketplace_atualizado_em
  before update on public.marketplace
  for each row execute function public.marca_atualizado_em();

-- -------------------------------------------------------------
-- RLS
--
-- Ligado desde já, e sem nenhuma policy. Efeito prático: o
-- navegador (chave anônima) não lê nada. Na Fase 1 todo acesso
-- acontece no servidor, com a service role, que ignora RLS por
-- desenho do Postgres.
--
-- As policies por papel (dono, operador, parceiro) entram na
-- Fase 3, quando a tabela `usuario` existir. Ligar RLS agora
-- evita o cenário clássico de abrir a tabela para o mundo e só
-- descobrir depois.
-- -------------------------------------------------------------
alter table public.marketplace enable row level security;

-- -------------------------------------------------------------
-- Sementes
--
-- Os três programas do plano. Percentuais e IDs de afiliado
-- ficam de fora: o percentual muda por campanha e o ID é
-- segredo, entra por UPDATE fora do Git.
-- -------------------------------------------------------------
insert into public.marketplace
  (slug, nome, cache_preco_max_horas, base_de_historico, ativo)
values
  ('mercado_livre', 'Mercado Livre', null, true,  true),
  ('shopee',        'Shopee',        null, true,  true),
  ('amazon',        'Amazon',          24, false, true);
