-- =============================================================
-- 28 · A linha do frete no lugar certo
--
-- A migration 27 inseriu `{frete}` logo antes de `{link}`, e o corpo
-- já tinha um emoji de carrinho abrindo a linha do link:
--
--   antes:    🛒 {link}
--   ficou:    🛒 {frete}
--
--             {link}
--
-- O carrinho passou a abrir a linha do frete e o link ficou nu. Não dá
-- erro em lugar nenhum: a mensagem sai, com "🛒 🚚 Frete grátis" e um
-- link solto embaixo. É o tipo de defeito que só aparece lendo o post
-- publicado, e por isso ele foi visto.
-- =============================================================

update public.modelo_mensagem
   set corpo = replace(
         corpo,
         '🛒 {frete}' || chr(10) || chr(10) || '{link}',
         '{frete}' || chr(10) || chr(10) || '🛒 {link}'
       )
 where position('🛒 {frete}' in corpo) > 0;
