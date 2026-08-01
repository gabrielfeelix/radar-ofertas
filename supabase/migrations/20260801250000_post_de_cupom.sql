-- =============================================================
-- 34 · O post de cupom
--
-- A ingestão de cupom (colhida do texto dos canais) resolveu de onde
-- ele vem. Falta a outra metade: o cupom virar mensagem no canal, que
-- é o que os concorrentes publicam de madrugada e o que **não depende
-- de histórico de preço nenhum** — útil justamente agora, com a série
-- tendo dois dias de vida.
--
-- TRÊS PEÇAS, E A PRIMEIRA É A QUE EVITA O ERRO CONHECIDO.
-- =============================================================


-- -------------------------------------------------------------
-- 1 · O escopo do cupom, que é o que impede o erro da mangueira
--
-- Na primeira madrugada automática saíram três posts no canal de pet e
-- dois eram de outro nicho. O conserto foi a comporta de nicho. O
-- cupom reabriria exatamente essa porta: `MODAEBELEZA0108` num canal
-- de pet é a mesma mangueira de jardim com outra roupa.
--
-- A tabela `cupom` já tem `nicho_id`, com a semântica "nulo = vale
-- para qualquer nicho". Só que a extração não sabe o nicho: ela lê
-- `<CATEGORIA><DDMM>` e o prefixo é o nome da campanha, não do nosso
-- nicho. Se tudo nascesse com nulo, tudo viraria "vale para qualquer
-- um" — e o pet receberia moda.
--
-- Então `geral` passa a ser explícito, e a regra é a da D-036:
-- **desconhecido separa, não é ignorado.** Prefixo sem linha aqui
-- entra no banco e NÃO é publicado. Fica visível na tela para alguém
-- decidir, que é trabalho de trinta segundos e não de publicar versão.
-- -------------------------------------------------------------
alter table public.cupom
  add column if not exists geral boolean not null default false;

comment on column public.cupom.geral is
  'Vale em qualquer categoria (Full, Lojas Oficiais, Todo Site). Só cupom geral ou de nicho que o canal declara pode ser publicado. Prefixo desconhecido fica false e não sai.';

create table if not exists public.cupom_prefixo (
  id          uuid primary key default gen_random_uuid(),
  operacao_id uuid not null references public.operacao(id) on delete cascade,
  -- O nome da campanha, sem o DDMM. Sempre em maiúsculas.
  prefixo     text not null,
  -- Nulo com geral=false quer dizer "olhamos e não roteia".
  nicho_id    uuid references public.nicho(id) on delete set null,
  geral       boolean not null default false,
  observacao  text,
  criado_em   timestamptz not null default now(),

  constraint cupom_prefixo_unico unique (operacao_id, prefixo)
);

comment on table public.cupom_prefixo is
  'De que categoria é cada campanha de cupom do ML. Prefixo ausente = ninguém olhou, e o cupom não é publicado até alguém olhar.';

alter table public.cupom_prefixo enable row level security;

create policy cupom_prefixo_leitura on public.cupom_prefixo
  for select to authenticated using (true);

grant select on public.cupom_prefixo to authenticated;
grant all on public.cupom_prefixo to service_role;

-- Os prefixos observados em campo em 31/07 e 01/08, nos canais que a
-- colheita lê. Os três primeiros valem em qualquer categoria; os
-- outros são de categoria e só saem em canal do nicho.
insert into public.cupom_prefixo (operacao_id, prefixo, nicho_id, geral, observacao)
select o.id, v.prefixo,
       (select n.id from public.nicho n where n.slug = v.slug and n.operacao_id = o.id),
       v.geral, v.observacao
  from public.operacao o
  cross join (values
    ('FULL',          null,        true,  'Mercado Livre Full: programa de entrega, atravessa categoria'),
    ('LOJASOFICIAIS', null,        true,  'Lojas oficiais de qualquer categoria'),
    ('TODOSITE',      null,        true,  'Site inteiro'),
    ('MODAEBELEZA',   'moda',      false, 'Moda e Bem-Estar'),
    ('DECORELETRO',   'casa',      false, 'Decoração e eletro: mapeado para casa, que é a maior parte'),
    ('LIVROSJOGOS',   'papelaria', false, 'Livros e jogos')
  ) as v(prefixo, slug, geral, observacao)
on conflict do nothing;


-- -------------------------------------------------------------
-- 2 · O registro de que o cupom já saiu
--
-- Sem isto o mesmo cupom sairia a cada rodada horária, e um cupom
-- repetido de hora em hora é a definição do que a pesquisa mediu como
-- motivo número um de alguém sair de um canal.
--
-- Por canal, e não global: quando existir o segundo canal, o mesmo
-- cupom precisa sair uma vez em cada.
-- -------------------------------------------------------------
create table if not exists public.cupom_publicado (
  id         uuid primary key default gen_random_uuid(),
  cupom_id   uuid not null references public.cupom(id) on delete cascade,
  canal_id   uuid not null references public.canal(id) on delete cascade,
  enviada_em timestamptz not null default now(),
  mensagem   text,

  constraint cupom_publicado_unico unique (cupom_id, canal_id)
);

comment on table public.cupom_publicado is
  'Qual cupom já foi ao ar em qual canal. A constraint é o que impede o mesmo cupom de sair de hora em hora.';

alter table public.cupom_publicado enable row level security;

create policy cupom_publicado_leitura on public.cupom_publicado
  for select to authenticated using (true);

grant select on public.cupom_publicado to authenticated;
grant all on public.cupom_publicado to service_role;


-- -------------------------------------------------------------
-- 3 · O texto
--
-- Mora em `modelo_mensagem` como o resto, para ser editado na tela sem
-- publicar versão.
--
-- A PRIMEIRA LINHA É `#publi`, e isso não é estilo: é a regra 3.10, e
-- o CONAR exige identificação "de forma clara e diretamente na
-- primeira tela", sem clique. A validação que já existe para o corpo
-- de oferta vale igual aqui.
--
-- E não há travessão em lugar nenhum (regra 3.11).
-- -------------------------------------------------------------
alter table public.modelo_mensagem
  add column if not exists corpo_cupom text not null default
E'#publi · Cupom {loja}\n\n🎟 <b>{codigo}</b>\n{percentual}% de desconto{onde}\n{condicoes}\n\nVale até {validade}. Ative na aba Cupons do app antes de fechar a compra.';

comment on column public.modelo_mensagem.corpo_cupom is
  'Modelo do post de cupom. Precisa começar identificando publicidade (regra 3.10). Marcadores: {loja} {codigo} {percentual} {onde} {condicoes} {validade}.';
