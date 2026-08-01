-- =============================================================
-- 29 · O link de afiliado passa a ser GERADO, não montado
--
-- O QUE ESTAVA ERRADO, e custou sete publicações: nós montávamos o
-- link à mão, colando `?matt_word=<subid>&matt_tool=66367903` numa URL
-- comum de produto. Isso não atribui comissão. Três evidências, e elas
-- fecham:
--
--   1. O próprio material do programa diz que link comum, sem passar
--      pelo gerador, não paga.
--   2. Quando o dono passou o NOSSO link pelo gerador, ele DESCARTOU o
--      nosso `matt_word` e criou um `ref=` próprio. Se os parâmetros
--      bastassem, esse token não precisaria existir.
--   3. O gerador responde `SOCIAL_PROFILE_ENCRYPTED`: a atribuição vive
--      dentro do `ref` cifrado, não na query.
--
-- Então o link tem que sair de
-- `POST /affiliate-program/api/v2/affiliates/createLink`, que é o que
-- a Central chama quando alguém clica em Gerar. Não há API pública de
-- afiliados: 15 rotas varridas em `api.mercadolibre.com`, todas 404, e
-- nada no portal do desenvolvedor.
--
-- E ISTO DECIDE A GRANULARIDADE DO SUBID, que a Fase 0 devia decidir.
-- Testado contra o endpoint com uma etiqueta inventada:
--
--   {"message":"Tag is not associated with this affiliate.","error_code":109}
--
-- A etiqueta precisa estar cadastrada na Central. Logo, **não existe
-- subid por publicação do lado do Mercado Livre** — o mais fino que
-- ele oferece é por etiqueta. Uma etiqueta por canal entrega o que o
-- negócio precisa (qual grupo gerou qual venda, que é a base do
-- split). Saber qual POST vendeu volta com o redirecionador próprio,
-- na Fase 2, e aí o subid vive do nosso lado. A regra 3.6 continua
-- valendo; muda onde ela é cumprida.
-- =============================================================

-- -------------------------------------------------------------
-- A etiqueta de cada canal
-- -------------------------------------------------------------
alter table public.canal
  add column if not exists etiqueta_afiliado text;

comment on column public.canal.etiqueta_afiliado is
  'A etiqueta cadastrada na Central de Afiliados para este canal. É o mais fino que o ML atribui: sem ela, a venda não é rastreável até o grupo. Precisa ser criada à mão lá antes de valer aqui.';

update public.canal
   set etiqueta_afiliado = 'radarpet'
 where nome = 'Radar Pet' and etiqueta_afiliado is null;


-- -------------------------------------------------------------
-- O link gerado, guardado por publicação
--
-- Por publicação e não por anúncio, porque a etiqueta muda com o canal:
-- o mesmo produto em dois canais são dois links, e é exatamente essa
-- diferença que permite dividir a receita.
-- -------------------------------------------------------------
alter table public.publicacao
  add column if not exists link_afiliado text,
  add column if not exists link_afiliado_em timestamptz;

comment on column public.publicacao.link_afiliado is
  'O `meli.la/...` que saiu do gerador do ML. Vazio = ainda não gerado, e nesse caso a publicação NÃO pode sair: link sem atribuição é publicar de graça.';


-- -------------------------------------------------------------
-- O freio, e ele é uma constraint de propósito
--
-- Regra que vive em código regride na primeira pressa. Esta impede,
-- no banco, que uma publicação seja marcada como enviada sem o link
-- gerado — que foi exatamente o erro de hoje, sete vezes.
--
-- O WhatsApp fica de fora: lá o humano é quem envia, e o texto pode
-- ser montado antes de existir link.
-- -------------------------------------------------------------
alter table public.publicacao
  drop constraint if exists publicacao_enviada_tem_link;

-- `not valid` de propósito, e não por preguiça: ele vale para toda
-- linha nova e alterada, e NÃO revalida as antigas. As sete
-- publicações que saíram hoje com link montado à mão violam a regra, e
-- é exatamente por isso que elas ficam: apagá-las ou remendá-las
-- esconderia a única evidência de que o erro aconteceu, e de quanto
-- ele custou. O relatório de comissão vai confirmar o prejuízo, e
-- essas linhas são o que permite conferir.
alter table public.publicacao
  add constraint publicacao_enviada_tem_link
  check (estado <> 'enviada' or link_afiliado is not null or origem <> 'fluxo')
  not valid;


-- -------------------------------------------------------------
-- Onde a sessão da Central vai morar
--
-- Mesma casa do refresh token do ML: `credencial_rotativa`, no banco,
-- nunca no Git e nunca em variável de ambiente do agendador (lá cada
-- execução começa de um clone limpo, e o valor ficaria velho).
--
-- ⚠️ SESSÃO DE NAVEGADOR EXPIRA. Esta é mais uma da lista de
-- `docs/infra.md`: algo fora do nosso controle morre e o sistema para
-- em silêncio. Aqui ele não para calado — sem link, a publicação fica
-- pendente com o motivo gravado, e a fila crescendo é o alarme.
-- -------------------------------------------------------------
comment on table public.credencial_rotativa is
  'Segredo que a aplicação troca ou que expira sozinho: o refresh token do ML (rotaciona a cada renovação) e a sessão da Central de Afiliados (expira por conta própria).';
