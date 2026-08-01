-- =============================================================
-- 40 · O lastro de queda repetia os mesmos dois números
--
-- A migration 39 tirou a repetição do lastro `declarado`, que foi o que
-- o dono viu no canal. Conferindo os quatro lastros lado a lado, o de
-- `queda` tem exatamente o mesmo defeito:
--
--     ❌ De R$ 103,19
--     ✅ Por R$ 76,00  (−26%)
--
--     ⚡ Caiu agora: era R$ 103,19, foi para R$ 76,00 hoje.   ← idem
--
-- Consertar um e deixar o outro seria consertar o print, não o defeito.
--
-- O QUE O LASTRO DE QUEDA TEM DE PRÓPRIO não são os valores — eles já
-- estão duas linhas acima. É o **tempo**: esta oferta existe porque nós
-- vimos o preço mudar entre duas leituras nossas, e isso é uma
-- afirmação mais forte que "a loja diz que está em promoção" e mais
-- fraca que "é o menor em 30 dias". A linha passa a dizer isso.
--
-- Os outros dois lastros ficam como estão: `lastro_com` e `lastro_sem`
-- já falam de janela e de data, nunca de preço.
-- =============================================================

update public.modelo_mensagem
   set lastro_queda = '⚡ Caiu nas últimas horas — vimos o preço mudar.',
       atualizado_em = now()
 where lastro_queda like '%{antes}%'
    or lastro_queda like '%{agora}%';

alter table public.modelo_mensagem
  alter column lastro_queda
  set default '⚡ Caiu nas últimas horas — vimos o preço mudar.';

comment on column public.modelo_mensagem.lastro_queda is
  'Usado quando oferta.gatilho = queda. NÃO REPETE OS VALORES (eles já estão no corpo): o que este lastro tem de próprio é o TEMPO — a queda foi medida entre duas leituras nossas.';
