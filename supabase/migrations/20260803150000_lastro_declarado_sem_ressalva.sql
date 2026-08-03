-- =============================================================
-- 43 · A ressalva do lastro declarado sai da mensagem
--
-- A linha era:
--
--   🏷 Preço "de" declarado pela loja. Ainda sem histórico nosso.
--
-- e aparecia em toda oferta de gatilho `declarado`, que hoje é a
-- maioria: enquanto a série de preço não tem idade, é o "de" da
-- loja que sustenta o desconto.
--
-- O dono decidiu tirar em 03/08: "não precisa dizer isso".
--
-- POR QUE ISTO NÃO ESBARRA NA REGRA 3.4
--
-- A 3.4 proíbe **afirmar** menor preço histórico sem lastro, e
-- manda usar a redação honesta quando a série é curta. A mensagem
-- do gatilho `declarado` não afirma nada disso: ela mostra o "de"
-- e o "por" que a própria loja publica, com o desconto que sai
-- dessa conta. Tirar a ressalva não transforma alegação de
-- terceiro em medição nossa — só para de explicar a origem.
--
-- As outras três linhas de lastro continuam intactas, e são elas
-- que carregam a regra: `lastro_com` afirma o mínimo quando há
-- janela, `lastro_sem` usa "menor preço que observamos desde", e
-- `lastro_queda` diz que vimos o preço mudar.
--
-- COMO A LINHA SOME SEM DEIXAR BURACO
--
-- `montaMensagem` colapsa três ou mais quebras em duas antes de
-- devolver o texto. Com o molde vazio, o `{lastro}` some junto com
-- o par de quebras que o cercava — o mesmo caminho que a nota do
-- curador e a linha de frete já usam quando não existem.
--
-- Volta a existir com um `update` de uma linha, se mudar de ideia.
-- =============================================================

update public.modelo_mensagem
   set lastro_declarado = '',
       atualizado_em = now()
 where lastro_declarado <> '';
