-- =============================================================
-- 36 · O ramo secundário: quatro de cão e gato antes de um de cavalo
--
-- A descida por subcategoria (01/08) multiplicou a largura da
-- descoberta, e trouxe junto um efeito que só aparece lendo o canal: o
-- "Pet Shop" do Mercado Livre tem 28 filhas, e entre elas estão
-- **Cavalos, Peixes, Aves, Répteis, Roedores, Coelhos e Insetos**.
-- Suplemento equino é legitimamente pet, e num canal de cão e gato é
-- ruído — e a pesquisa de campo põe irrelevância ao lado do volume
-- como motivo de alguém sair (`docs/pesquisa/sintese.md` §5).
--
-- Pedido do dono: *"só pode postar água de equinos, peixes e afins
-- depois de 4 de cachorros/gatos"*. E a ressalva dele estava certa:
-- *"é bem específico pra esse nicho de pet"*.
--
-- POR ISSO A REGRA NÃO É DE PET. O que se modela é **ramo secundário
-- dentro de um nicho**, com proporção configurável. Pet é o primeiro
-- caso; eletrônico vai ter o dele (acessório contra aparelho), e casa
-- também. Marcar um ramo novo é uma linha, não uma versão (D-023).
--
-- O RAMO é a filha direta da raiz na árvore do ML. É a granularidade
-- certa: a raiz é grossa demais (Pet Shop inteiro) e o domínio é fino
-- demais (milhares, e o problema que a `nicho_categoria` já resolveu).
-- Pet Shop tem 28 ramos, e marcar 7 é trabalho de minutos.
-- =============================================================


-- -------------------------------------------------------------
-- Onde o ramo mora
--
-- Sai de `path_from_root[1]` da categoria folha, que o coletor já pede
-- para descobrir a raiz. Custo zero de chamada nova.
-- -------------------------------------------------------------
alter table public.anuncio
  add column if not exists categoria_ramo text;

comment on column public.anuncio.categoria_ramo is
  'A filha direta da raiz na árvore do marketplace (Pet Shop → Cães, Cavalos, Peixes…). Granularidade entre a raiz e o domínio. Nulo é tratado como primário: dado que falta não pode calar o canal.';

create index if not exists anuncio_categoria_ramo_idx
  on public.anuncio (categoria_ramo)
  where categoria_ramo is not null;


-- -------------------------------------------------------------
-- Quais ramos são secundários
--
-- PRESENÇA É O QUE MARCA. Ramo sem linha aqui é primário, e esse
-- padrão é deliberado: ao contrário da D-036, onde desconhecido separa,
-- aqui desconhecido **passa**. O custo de errar é oposto nos dois
-- casos — lá, publicar produto errado; aqui, calar o canal por falta de
-- cadastro.
-- -------------------------------------------------------------
create table if not exists public.ramo_secundario (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references public.operacao(id) on delete cascade,
  marketplace_id uuid not null references public.marketplace(id) on delete cascade,
  ramo           text not null,
  rotulo         text,
  criado_em      timestamptz not null default now(),

  constraint ramo_secundario_unico unique (operacao_id, marketplace_id, ramo)
);

comment on table public.ramo_secundario is
  'Ramos que só entram na proporção definida por `primarios_por_secundario`. Presença marca: ramo ausente é primário.';

alter table public.ramo_secundario enable row level security;

create policy ramo_secundario_leitura on public.ramo_secundario
  for select to authenticated using (true);

grant select on public.ramo_secundario to authenticated;
grant all on public.ramo_secundario to service_role;


-- A proporção. Quatro é o número do dono, e vive em `parametro` para
-- ser calibrado sem publicar versão.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'primarios_por_secundario', 4,
       'Quantos posts de ramo primário precisam sair antes de um de ramo secundário. Zero desliga a regra.'
  from public.operacao
on conflict do nothing;


-- -------------------------------------------------------------
-- Os sete ramos de Pet Shop que não são cão e gato
--
-- Os ids vieram de `categories/MLB1071` em 01/08. As outras 21 filhas
-- (Coleiras, Petiscos, Escovas, Recipiente para Ração…) ficam de fora
-- de propósito: elas são acessório que serve cão e gato, e são
-- exatamente o miolo do canal.
-- -------------------------------------------------------------
insert into public.ramo_secundario (operacao_id, marketplace_id, ramo, rotulo)
select o.id, m.id, v.ramo, v.rotulo
  from public.operacao o
  cross join public.marketplace m
  cross join (values
    ('MLB1117',   'Cavalos'),
    ('MLB1091',   'Peixes'),
    ('MLB1100',   'Aves e Acessórios'),
    ('MLB270897', 'Anfíbios e Répteis'),
    ('MLB1105',   'Roedores'),
    ('MLB85880',  'Coelhos'),
    ('MLB270868', 'Insetos')
  ) as v(ramo, rotulo)
 where m.slug = 'mercado_livre'
on conflict do nothing;


-- -------------------------------------------------------------
-- A visão de quanto cada ramo representa
--
-- Sem ela, decidir o que marcar como secundário é chute. Com ela, a
-- pergunta "o canal está virando loja de aquário?" tem resposta.
-- -------------------------------------------------------------
create or replace view public.ramos_do_catalogo as
select a.operacao_id,
       a.categoria_raiz,
       a.categoria_ramo,
       rs.rotulo                                    as rotulo_secundario,
       (rs.id is not null)                          as secundario,
       count(*)                                     as anuncios,
       count(*) filter (where a.ativo)              as ativos
  from public.anuncio a
  left join public.ramo_secundario rs
         on rs.ramo = a.categoria_ramo
        and rs.operacao_id = a.operacao_id
        and rs.marketplace_id = a.marketplace_id
 where a.categoria_ramo is not null
 group by a.operacao_id, a.categoria_raiz, a.categoria_ramo, rs.rotulo, rs.id
 order by count(*) desc;

comment on view public.ramos_do_catalogo is
  'Quantos anúncios há por ramo, e quais estão marcados como secundários. É o insumo para decidir o que marcar.';

grant select on public.ramos_do_catalogo to authenticated, service_role;
