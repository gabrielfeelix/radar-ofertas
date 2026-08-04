-- =============================================================
-- 67 · Desfaz o que a 66 remarcou, e diz por que ela errou
--
-- ERRO MEU, e o tipo mais chato: a migration 66 quis limpar o que
-- escapou do `USO = profissional` e copiou o regex da migration **55**,
-- que e a versao ORIGINAL da regra. So que a 55 ja tinha sido corrigida
-- duas vezes desde entao, e as duas correcoes foram apagadas:
--
--   56 · litro so significa "tamanho de salao" em BELEZA. Panela de
--        4,2 litros e panela, chaleira de 2,7 litros e chaleira
--   57 · "Lip Gloss Seringa" e formato de embalagem, e
--        "Kit 13 Pcs Pinceis de Maquiagem" sao treze pecas DIFERENTES
--
-- O estrago apareceu na amostra, e o pior caso e o da 57: kit de
-- pinceis de maquiagem e produto-ALVO do Radar Beauty, e ele voltou a
-- ser barrado no mesmo dia em que o dono pediu MAIS qualidade no canal.
--
-- A LICAO, e ela e maior que este conserto: a regra do `USO` existe
-- DUAS vezes, uma em SQL dentro das migrations e outra em
-- `lib/uso-do-produto.ts`, e elas ja tinham divergido. O TypeScript e
-- a versao viva e correta: ele nao marca "seringa" sem sinal de agulha,
-- nao marca `kit NN pcs`, e e ele que os dois coletores usam.
--
-- Copiar SQL de migration antiga e copiar uma fotografia de uma regra
-- que continuou andando. Preenchimento retroativo de `USO` deveria
-- passar por `lib/uso-do-produto.ts`, num script, e nao por regex
-- recopiado — anotado no handoff.
--
-- Conferido antes de escrever: nenhuma publicacao saiu no intervalo em
-- que a 66 esteve aplicada sem esta correcao.
-- =============================================================

-- 1. A correcao da 56 de volta: pego SO pelo volume, e fora de beleza
--    e perfume, nao e insumo de salao.
update public.produto p
   set atributos = p.atributos - 'USO',
       atualizado_em = now()
 where p.atributos->>'USO' = 'profissional'
   -- `not exists` e nao `not in`: com `not in`, produto de nicho NULO
   -- some da limpeza, porque `null not in (...)` e null e nao verdadeiro.
   -- A 56 original tinha esse buraco; aqui ele fica fechado, e produto
   -- sem nicho tambem e "nao e de beleza".
   and not exists (
     select 1 from public.nicho n
      where n.id = p.nicho_id and n.slug in ('beleza', 'perfume')
   )
   and p.titulo_canonico ~* '(1[,.]5 *l\M|[2-9] *l\M|[1-9][0-9]+ *litros?|1 *litro)'
   and p.titulo_canonico !~* '(microcanula|canula|seringa|agulha|cx c/|caixa c/|extensao de cilios|para extensao)'
   and p.titulo_canonico !~* '(kit *[1-9][0-9]|[1-9][0-9] *(unidades|un |pecas)|atacado|revenda|fardo)';

-- 2. A correcao da 57 de volta: gloss em seringa e conjunto de pecas
--    diferentes sao compra de consumidora.
update public.produto p
   set atributos = p.atributos - 'USO',
       atualizado_em = now()
 where p.atributos->>'USO' = 'profissional'
   and (
        (p.titulo_canonico ~* 'seringa'
         and p.titulo_canonico !~* '(agulha|derma pen|microcanula|canula|cx c/)')
     or p.titulo_canonico ~* 'kit *[1-9][0-9] *(pcs|pc |pecas|pincei)'
   );
