-- =============================================================
-- 14 · Identificação publicitária no modelo de mensagem
--
-- Regra 3.10, criada depois da pesquisa de 28/07: link de afiliado
-- gera comissão, e conteúdo remunerado é publicidade. O CONAR diz
-- que remuneração por performance não muda a natureza do conteúdo;
-- o CDC responsabiliza quem oculta; e a própria Shopee repete a
-- regra para os afiliados dela, com poder de pedir a suspensão do
-- conteúdo de quem não cumpre.
--
-- ONDE ELA VAI, E POR QUE NÃO NO RODAPÉ
--
-- O costume do mercado é jogar "#publi" na última linha, depois do
-- link. É exatamente o que a orientação proíbe: a identificação
-- precisa aparecer sem a pessoa rolar a tela ou abrir o "mais".
-- Então ela vem antes do produto — custa uma linha da prévia da
-- notificação, e é o preço de estar do lado certo.
--
-- A loja sobe junto, porque a linha ficaria estranha sozinha e
-- porque saber de qual loja é a oferta antes de ler o preço ajuda
-- quem decide rápido.
-- =============================================================

update public.modelo_mensagem
   set corpo = '#publi · {loja}' || chr(10) ||
               '' || chr(10) ||
               '🔥 {produto}' || chr(10) ||
               '' || chr(10) ||
               'De {preco_antes} por {preco} (−{desconto}%)' || chr(10) ||
               '{lastro}' || chr(10) ||
               '' || chr(10) ||
               '{vendedor}' || chr(10) ||
               '👉 {link}'
 where corpo not ilike '%#publi%'
   and corpo not ilike '%#publicidade%'
   and corpo not ilike '%#parceriapaga%'
   and corpo not ilike '%#conteúdopago%';

comment on column public.modelo_mensagem.corpo is
  'O texto da mensagem. Precisa conter identificação publicitária nas primeiras linhas (regra 3.10) e as chaves {lastro} e {link}.';
