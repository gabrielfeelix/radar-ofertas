-- O PARCEIRO GANHA A PRÓPRIA CONTA DE AFILIADO (D-074).
--
-- Até aqui todo link saía com o ID do dono (D-001), e o sistema não
-- tinha onde guardar outro. Em 26/09 entrou o primeiro parceiro, o
-- Breno, com grupo de pet no WhatsApp e a exigência de que a comissão
-- caia na conta DELE, não na do dono.
--
-- A conta mora no PARCEIRO e não no canal: o mesmo parceiro pode ter
-- dois grupos, e o ID de afiliado é dele, não do grupo.
--
-- A REGRA QUE IMPORTA está no publicador (`lib/conta-do-canal.ts`):
--
--   * parceiro SEM linha aqui  → link do dono, exatamente como antes;
--   * parceiro COM alguma linha → link só nas lojas cadastradas. Loja
--     sem conta do parceiro NÃO sai no grupo dele. Nunca cai para o ID
--     do dono em silêncio, que era o defeito que esta tabela resolve.
--
-- Só `afiliado_id`, sem sessão: Shopee e Amazon montam o link pela URL
-- (D-057). O Mercado Livre precisa da sessão logada da Central do
-- parceiro, e isso fica para quando ele puder mandar.

create table public.parceiro_afiliado (
  id              uuid primary key default gen_random_uuid(),
  operacao_id     uuid not null references public.operacao(id) on delete cascade,
  parceiro_id     uuid not null references public.parceiro(id) on delete cascade,
  marketplace_id  uuid not null references public.marketplace(id) on delete restrict,
  afiliado_id     text not null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),

  constraint parceiro_afiliado_id_preenchido check (length(trim(afiliado_id)) > 0),
  constraint parceiro_afiliado_uk unique (parceiro_id, marketplace_id)
);

comment on table public.parceiro_afiliado is
  'O ID de afiliado do PARCEIRO por loja. Com alguma linha, os canais dele só publicam nas lojas cadastradas aqui, com o ID dele. Sem linha, saem com o ID do dono (D-074).';
comment on column public.parceiro_afiliado.afiliado_id is
  'Shopee: o número do painel de afiliado (ex.: 18373711182). Amazon: a tag de associado. Não é segredo: aparece em todo link publicado.';

create index parceiro_afiliado_parceiro_idx on public.parceiro_afiliado (parceiro_id);

create trigger parceiro_afiliado_atualizado_em
  before update on public.parceiro_afiliado
  for each row execute function public.marca_atualizado_em();

alter table public.parceiro_afiliado enable row level security;

-- Só o dono, como `bot`: é configuração de dinheiro, não dia a dia.
create policy parceiro_afiliado_dono on public.parceiro_afiliado
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

grant select, insert, update, delete on public.parceiro_afiliado to service_role;
grant select on public.parceiro_afiliado to authenticated;

-- A etiqueta do canal vira editável pela tela (antes, só por SQL), e a
-- constraint de parceiro/etiqueta não muda: continua opcional no banco
-- e cobrada pelo publicador.
