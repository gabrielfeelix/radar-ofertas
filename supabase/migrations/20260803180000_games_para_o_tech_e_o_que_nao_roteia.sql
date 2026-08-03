-- =============================================================
-- 45 · Games entra no Tech, e as categorias que não roteiam
--
-- A migration 44 deixou 15 categorias da Shopee sem nicho. O dono
-- olhou as três famílias que sobraram e decidiu, em 03/08:
--
--   Gaming & Consoles  →  vai para o Geek E para o Tech
--   Watches            →  não vai para nenhum
--   Travel & Luggage   →  não vai para nenhum
--
-- COMO "IR PARA DOIS CANAIS" É FEITO AQUI
--
-- Não é mapeando a categoria para dois nichos: um anúncio tem UM
-- nicho, e é isso que mantém a fila legível. Quem aceita mais de um
-- nicho é o CANAL, por `canal_nicho`.
--
-- O Radar Geek já aceita `games`. Então a categoria vira `games` e o
-- Radar Tech passa a aceitar `games` também. O mesmo produto aparece
-- nos dois, e a variedade de cada canal continua sendo problema do
-- rodízio, não do mapa.
--
-- LINHA COM NICHO NULO NÃO É LINHA FALTANDO
--
-- Watches e Travel entram com `nicho_id` nulo, e a diferença está
-- escrita no comentário da própria tabela: linha com nulo quer dizer
-- "olhamos e não roteia"; ausência de linha quer dizer "ninguém
-- olhou". Sem isso, o coletor ia reclamar dessas mesmas 13 categorias
-- todo dia, e alguém decidiria de novo o que já foi decidido.
-- =============================================================

insert into public.nicho_dominio (operacao_id, marketplace_id, dominio_externo, nicho_id, observacao)
select o.id, m.id, v.dominio, n.id, v.nota
  from public.operacao o
  join public.marketplace m on m.slug = 'shopee' and m.operacao_id = o.id
  cross join (values
    ('SHOPEE-100695', 'games', 'Gaming & Consoles > Console Machines'),
    ('SHOPEE-100696', 'games', 'Gaming & Consoles > Console Accessories'),
    ('SHOPEE-100697', 'games', 'Gaming & Consoles > Video Games'),
    ('SHOPEE-100698', 'games', 'Gaming & Consoles > Others')
  ) as v(dominio, nicho_slug, nota)
  join public.nicho n on n.slug = v.nicho_slug
 where not exists (
   select 1 from public.nicho_dominio d
    where d.operacao_id = o.id and d.marketplace_id = m.id and d.dominio_externo = v.dominio
 );

-- Decidido que não roteia. O nulo é a decisão, não a falta dela.
insert into public.nicho_dominio (operacao_id, marketplace_id, dominio_externo, nicho_id, observacao)
select o.id, m.id, v.dominio, null, v.nota
  from public.operacao o
  join public.marketplace m on m.slug = 'shopee' and m.operacao_id = o.id
  cross join (values
    ('SHOPEE-100573', 'Watches > Women Watches, sem canal em 03/08'),
    ('SHOPEE-100574', 'Watches > Men Watches, sem canal em 03/08'),
    ('SHOPEE-100575', 'Watches > Set & Couple Watches, sem canal em 03/08'),
    ('SHOPEE-100576', 'Watches > Watches Accessories, sem canal em 03/08'),
    ('SHOPEE-100577', 'Watches > Others, sem canal em 03/08'),
    ('SHOPEE-100085', 'Travel & Luggage > Luggage, sem canal em 03/08'),
    ('SHOPEE-100086', 'Travel & Luggage > Travel Bags, sem canal em 03/08'),
    ('SHOPEE-100087', 'Travel & Luggage > Travel Accessories, sem canal em 03/08'),
    ('SHOPEE-100088', 'Travel & Luggage > Others, sem canal em 03/08')
  ) as v(dominio, nota)
 where not exists (
   select 1 from public.nicho_dominio d
    where d.operacao_id = o.id and d.marketplace_id = m.id and d.dominio_externo = v.dominio
 );

-- O Radar Tech passa a aceitar `games`, que o Radar Geek já aceitava.
insert into public.canal_nicho (canal_id, nicho_id)
select c.id, n.id
  from public.canal c
  join public.nicho n on n.slug = 'games'
 where c.nome = 'Radar Tech'
   and not exists (
     select 1 from public.canal_nicho cn where cn.canal_id = c.id and cn.nicho_id = n.id
   );
