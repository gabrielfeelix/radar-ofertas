-- =============================================================
-- 56 · Litro so significa "tamanho de salao" em beleza
--
-- A migration 55 marcou 741 produtos como `USO = profissional`, e a
-- amostra mostrou o erro na hora:
--
--   Panela De Pressao Inducao Ecoglide 4,2l Cream Tuut Vanila
--   Chaleira Bule Aluminio C/ Apito Roma Vanilla Brinox 2,7 L
--
-- Panela de 4,2 litros e panela normal. Chaleira de 2,7 litros e
-- chaleira. A regra de volume estava certa para o que ela foi escrita
-- — shampoo de 1,5L e tamanho de salao — e errada para tudo o mais.
--
-- LITRO NAO E UM SINAL, E UM SINAL DENTRO DE UM CONTEXTO. Em beleza,
-- volume grande quer dizer revenda; em casa e cozinha, quer dizer o
-- produto. A mesma regra, dois significados opostos.
--
-- Isto nao chegou a causar post errado: o unico canal que exclui `USO`
-- e o Beauty, e panela nao e do nicho dele. Mas dado errado no banco
-- cobra depois — no dia em que existir canal de casa, ele nasceria
-- filtrando panela grande sem ninguem entender por que.
--
-- O QUE ESTA MIGRATION FAZ: desmarca quem foi pego SO pelo volume e
-- nao e de beleza nem de perfume. Quem tambem casa com insumo de
-- clinica ou com quantidade de revenda continua marcado, porque esses
-- dois sinais valem em qualquer categoria.
-- =============================================================

update public.produto p
   set atributos = p.atributos - 'USO',
       atualizado_em = now()
 where p.atributos->>'USO' = 'profissional'
   -- fora de beleza e perfume
   and p.nicho_id not in (select id from public.nicho where slug in ('beleza', 'perfume'))
   -- pego pelo volume
   and p.titulo_canonico ~* '(1[,.]5 *l\M|[2-9] *l\M|[1-9][0-9]+ *litros?|1 *litro)'
   -- e NAO pelos outros dois sinais, que valem em qualquer categoria
   and p.titulo_canonico !~* '(microcanula|canula|seringa|agulha|cx c/|caixa c/|extensao de cilios|para extensao)'
   and p.titulo_canonico !~* '(kit *[1-9][0-9]|[1-9][0-9] *(unidades|un |pecas)|atacado|revenda|fardo)';
