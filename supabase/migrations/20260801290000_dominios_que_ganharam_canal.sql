-- =============================================================
-- 38 · Os domínios que só não roteavam por falta de canal
--
-- A migration 24 marcou uma lista de domínios com `nicho_id` nulo, e o
-- comentário dela diz por quê: *"Cada um destes vira nicho de verdade
-- no dia em que houver canal para ele."* Naquele dia o único canal era
-- o de pet.
--
-- Com os seis canais de 01/08, três daquelas linhas mudam de resposta.
-- É trabalho de trinta segundos e é exatamente o que a tabela de
-- mapeamento existe para permitir (D-023) — o resto da lista continua
-- fora, porque continua sem canal.
--
-- O que NÃO volta, e a razão de cada um:
--
--   MLB-SNEAKERS, MLB-BOOKS         `moda` e livro seguem sem canal
--   MLB-PENS, MLB-*_PAPERS          `papelaria` segue sem canal
--   MLB-OFFICE_CHAIRS, *_DESKS      `casa` segue sem canal
--   MLB-LIVESTOCK_FEEDERS           ração de criação não é pet, e isso
--                                   não tem a ver com canal
--   MLB-VIDEO_GAME_PREPAID_CARDS    tem canal (Geek) e fica fora mesmo
--                                   assim: cartão pré-pago é digital,
--                                   não tem série de preço que valha, e
--                                   "desconto" nele é campanha da loja,
--                                   não queda que a gente detectou
-- =============================================================

update public.nicho_dominio nd
   set nicho_id = n.id,
       observacao = 'estava fora por não haver canal. O Radar Fitness abriu em 01/08.',
       atualizado_em = now()
  from public.nicho n
 where n.operacao_id = nd.operacao_id
   and n.slug = 'esporte'
   and nd.dominio_externo = 'MLB-FOOTBALL_BALLS'
   and nd.nicho_id is null;

update public.nicho_dominio nd
   set nicho_id = n.id,
       observacao = 'estava fora por não haver canal. O Radar Kids abriu em 01/08.',
       atualizado_em = now()
  from public.nicho n
 where n.operacao_id = nd.operacao_id
   and n.slug = 'brinquedo'
   and nd.dominio_externo = 'MLB-TOY_MICROWAVES'
   and nd.nicho_id is null;

update public.nicho_dominio nd
   set nicho_id = n.id,
       observacao = 'estava fora por não haver canal. O Radar Tech abriu em 01/08.',
       atualizado_em = now()
  from public.nicho n
 where n.operacao_id = nd.operacao_id
   and n.slug = 'eletronico'
   and nd.dominio_externo = 'MLB-TELEPROMPTERS'
   and nd.nicho_id is null;
