-- =============================================================
-- 33 · Quanto custa não ter canal
--
-- O maior desperdício do sistema não é código, e o `AGENTS.md` já
-- dizia isso. O que faltava era o número por nicho, para a decisão
-- deixar de ser "abrir canal de quê?" e virar "abrir canal deste,
-- porque são tantas ofertas por dia".
--
-- Medido em 01/08/2026, numa rodada:
--
--   109 ofertas rejeitadas
--    61 delas (56%) por `nenhum_canal_do_nicho`
--
-- E o catálogo, por nicho:
--
--   141 pet (único com canal) · 132 eletrônico · 98 casa · 61 suplemento
--
-- Ou seja: 291 produtos de três nichos alimentam uma detecção que
-- nunca vira publicação. Eles não são desperdício de coleta — a base
-- precisa existir antes do canal, senão o canal nasce mudo. São
-- desperdício de *espera*: cada dia sem o canal é um dia de ofertas
-- detectadas e descartadas.
--
-- A prioridade de descoberta do coletor (`coleta-mercado-livre.mjs`)
-- passou a olhar primeiro as categorias que têm canal. Esta view é o
-- outro lado: mostra o que está batendo na porta e não entra.
-- =============================================================

create or replace view public.demanda_por_nicho as
with canais_do_nicho as (
  select cn.nicho_id, count(*) filter (where c.ativo) as canais_ativos
    from public.canal_nicho cn
    join public.canal c on c.id = cn.canal_id
   group by cn.nicho_id
),
produtos as (
  select nicho_id, count(*) as produtos
    from public.produto
   where nicho_id is not null
   group by nicho_id
),
ofertas as (
  select p.nicho_id,
         count(*)                                                    as ofertas_total,
         count(*) filter (where o.status = 'rejeitada'
                            and o.motivo_rejeicao = 'nenhum_canal_do_nicho') as perdidas_sem_canal,
         count(*) filter (where o.status = 'aprovada')                as aprovadas,
         max(o.criado_em)                                             as ultima_oferta_em
    from public.oferta o
    join public.anuncio a on a.id = o.anuncio_id
    join public.produto p on p.id = a.produto_id
   where p.nicho_id is not null
   group by p.nicho_id
)
select n.id                                as nicho_id,
       n.slug,
       n.nome,
       coalesce(cd.canais_ativos, 0)       as canais_ativos,
       coalesce(pr.produtos, 0)            as produtos_no_catalogo,
       coalesce(of.ofertas_total, 0)       as ofertas_detectadas,
       coalesce(of.aprovadas, 0)           as ofertas_aprovadas,
       coalesce(of.perdidas_sem_canal, 0)  as perdidas_por_falta_de_canal,
       of.ultima_oferta_em
  from public.nicho n
  left join canais_do_nicho cd on cd.nicho_id = n.id
  left join produtos        pr on pr.nicho_id = n.id
  left join ofertas         of on of.nicho_id = n.id
 order by coalesce(of.perdidas_sem_canal, 0) desc,
          coalesce(pr.produtos, 0) desc;

comment on view public.demanda_por_nicho is
  'Quanto cada nicho renderia se tivesse canal. Ordenada pela perda: a primeira linha com canais_ativos = 0 é o próximo canal a abrir.';

grant select on public.demanda_por_nicho to authenticated, service_role;
