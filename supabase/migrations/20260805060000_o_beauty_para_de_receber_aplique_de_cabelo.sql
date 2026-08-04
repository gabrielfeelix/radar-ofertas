-- =============================================================
-- 64 · O Beauty para de receber aplique e fibra de cabelo
--
-- PEDIDO DO DONO, em 04/08 a noite, vendo dois posts do canal:
--
--   Cabelo French Curl 400g Fibra Premium Gypsy Braids   R$ 42,49
--   Cabelo Organico Ondulado Liso Perla 300g 6 Telas     R$ 46,54
--
-- Palavras dele: "nunca mais eu quero esse tipo de produto no beauty,
-- empobrece dms o grupo. Mulher quer ver maquiagem, creme, hidratante,
-- cuidados femininos, coisas de qualidade, um secador, chapinha".
--
-- NAO E SOBRE PRECO, e a distincao e a mesma da migration 55: o
-- problema nao e o produto ser barato, e o canal ser sobre outra coisa.
-- Aplique, jumbo e kanekalon sao um mercado proprio, com publico
-- proprio, e diluem um canal que promete cuidado com a pele e o cabelo
-- de quem le.
--
-- O MECANISMO E O BLOQUEIO DE DOMINIO, que ja existe e ja tem 40
-- linhas: `nicho_dominio` com `nicho_id` nulo quer dizer "olhamos e nao
-- roteia", e ausencia de linha quer dizer "ninguem olhou". Sem a linha,
-- o coletor reclamaria deste dominio todo dia e alguem decidiria de
-- novo o que ja foi decidido.
--
-- POR QUE O DOMINIO E NAO O TITULO. `MLB-HAIR_EXTENSIONS` **nao estava
-- mapeado**, e era por isso que ele entrava: sem linha em
-- `nicho_dominio`, o nicho cai para a categoria RAIZ, que e "Beleza e
-- Cuidado Pessoal", grossa demais para separar creme facial de metro de
-- cabelo sintetico. Regra de titulo aqui seria pior: "Cabelo" aparece
-- em xampu, em secador e em chapinha.
--
-- MEDIDO em 04/08, antes de escrever:
--
--   30 anuncios no dominio, todos com nicho beleza
--    9 publicacoes ja foram ao Radar Beauty
--    0 itens equivalentes na Shopee (conferido por titulo)
--
-- A Shopee fica de fora de proposito: ela nao tem nenhum item desses
-- hoje, e inventar o id de categoria dela seria adivinhar nome de
-- dominio, que e o erro que a AGENTS.md registra em `MLB-PET_TOYS`.
-- Quando aparecer, ele cai em `dominio_sem_mapeamento` e a fila de
-- trabalho avisa.
--
-- O QUE ISTO NAO RESOLVE, e fica dito: as 9 publicacoes que ja sairam
-- continuam no banco. Elas sao historico, e apagar historico para a
-- vista ficar bonita e o comeco de nao poder confiar no proprio numero.
-- =============================================================

-- 1. A decisao, gravada como dado. O nulo E a decisao.
insert into public.nicho_dominio (operacao_id, marketplace_id, dominio_externo, nicho_id, observacao)
select o.id, m.id, v.dominio, null, v.nota
  from public.operacao o
  join public.marketplace m on m.slug = 'mercado_livre' and m.operacao_id = o.id
  cross join (values
    (
      'MLB-HAIR_EXTENSIONS',
      'Aplique, jumbo e fibra sintetica. Decisao do dono em 04/08: nao e o que o Radar Beauty promete'
    )
  ) as v(dominio, nota)
 where not exists (
   select 1 from public.nicho_dominio d
    where d.operacao_id = o.id and d.marketplace_id = m.id and d.dominio_externo = v.dominio
 );

-- 2. E o que ja esta no catalogo perde o nicho.
--
-- So os produtos cujos anuncios sao TODOS deste dominio. Depois da
-- fusao de identidade (D-036) um produto pode ter anuncio de mais de
-- uma loja, e tirar o nicho por causa de um deles derrubaria junto o
-- anuncio bom do Mercado Livre ou da Shopee. Aqui isso e teorico, mas a
-- consulta que "funciona por sorte" e a que quebra na proxima rodada.
update public.produto p
   set nicho_id = null,
       atualizado_em = now()
 where p.nicho_id is not null
   and exists (
     select 1 from public.anuncio a
      where a.produto_id = p.id and a.dominio_externo = 'MLB-HAIR_EXTENSIONS'
   )
   and not exists (
     select 1 from public.anuncio a
      where a.produto_id = p.id
        and coalesce(a.dominio_externo, '') <> 'MLB-HAIR_EXTENSIONS'
   );
