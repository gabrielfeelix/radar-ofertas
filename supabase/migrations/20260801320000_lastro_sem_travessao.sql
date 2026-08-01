-- =============================================================
-- 41 · Os dois lastros novos violavam a regra 3.11
--
-- As migrations 39 e 40 tiraram a repetição dos valores e escreveram os
-- textos novos com travessão:
--
--   🏷 Preço "de" declarado pela loja — ainda sem histórico nosso.
--   ⚡ Caiu nas últimas horas — vimos o preço mudar.
--
-- A regra 3.11 do AGENTS proíbe travessão em tudo que vai para o canal,
-- e o motivo dela é exatamente o caso: **tem cara de texto de IA**, e
-- canal de oferta vive de parecer gente. O leitor não sabe explicar por
-- quê, mas sente, e desconfiança em canal de oferta custa a venda.
--
-- Vale registrar o erro em vez de só corrigi-lo: a regra é sobre o que
-- o público lê, e é fácil escrever a linha pensando no comentário do
-- código, onde travessão é normal. Ponto e dois-pontos resolvem os dois
-- casos sem perder nada.
-- =============================================================

update public.modelo_mensagem
   set lastro_declarado = '🏷 Preço "de" declarado pela loja. Ainda sem histórico nosso.',
       atualizado_em = now()
 where lastro_declarado like '%—%'
    or lastro_declarado like '%–%';

update public.modelo_mensagem
   set lastro_queda = '⚡ Caiu nas últimas horas: vimos o preço mudar.',
       atualizado_em = now()
 where lastro_queda like '%—%'
    or lastro_queda like '%–%';

alter table public.modelo_mensagem
  alter column lastro_declarado
  set default '🏷 Preço "de" declarado pela loja. Ainda sem histórico nosso.';

alter table public.modelo_mensagem
  alter column lastro_queda
  set default '⚡ Caiu nas últimas horas: vimos o preço mudar.';
