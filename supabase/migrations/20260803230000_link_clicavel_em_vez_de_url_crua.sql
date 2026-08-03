-- =============================================================
-- 49 · O link vira texto clicável, em vez de URL crua
--
-- O primeiro post da Shopee saiu com isto no fim:
--
--   https://s.shopee.com.br/an_redir?origin_link=https%3A%2F%2Fshopee
--   .com.br%2Fproduct%2F23892667...&affiliate_id=18378371108&sub_id=...
--
-- Três linhas de URL, ocupando mais espaço que o preço.
--
-- POR QUE SÓ A SHOPEE FICA FEIA
--
-- O link do Mercado Livre sai curto (`meli.la/18Npx7Y`) porque passa
-- pelo gerador da Central de Afiliados, que encurta. O da Shopee é
-- montado por nós (D-057), então carrega a URL do produto codificada
-- dentro de si. Não há encurtador nosso: ele é da Fase 2.
--
-- A SOLUÇÃO DEFINITIVA JÁ ESTÁ A CAMINHO, e por isso esta é modesta:
-- a Open API da Shopee foi aprovada em 03/08 e gera link curto
-- (`shope.ee/xxxx`). Quando a credencial chegar, o link volta a ser
-- curto sozinho e esta mudança deixa de importar.
--
-- O modelo já é HTML — o corpo usa `<b>` e `<s>`, e o envio ao Telegram
-- vai com `parse_mode: HTML`. Então basta a âncora.
--
-- POR QUE PARA TODAS AS LOJAS, E NÃO SÓ PARA A SHOPEE
--
-- Um post que às vezes mostra a URL e às vezes esconde parece
-- descuidado, e canal de oferta vive de parecer cuidado. Uniforme é
-- melhor que condicional, e o link continua visível ao toque longo,
-- para quem quiser conferir antes de clicar.
-- =============================================================

update public.modelo_mensagem
   set corpo = replace(corpo, '🛒 {link}', '🛒 <a href="{link}">Compre aqui</a>'),
       atualizado_em = now()
 where corpo like '%🛒 {link}%';
