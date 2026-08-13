-- =============================================================
-- 74 · O #publi sai da primeira linha e vai para o rodape
--
-- Pedido do dono em 13/08, olhando o grupo ao lado de dois posts de
-- concorrente: *"o #publi e a empresa de PRIMEIRA e meio meme, ja
-- desvaloriza logo de comeco, talvez deveria ver la no final, por
-- ultimo"*.
--
-- POR QUE ELE ESTA CERTO, e o motivo e mecanico e nao de gosto: a
-- PRIMEIRA LINHA E A UNICA QUE ELA LE SEM ABRIR O APP. E ela que
-- aparece na lista de conversas do WhatsApp, embaixo do nome do grupo,
-- junto com as outras trinta conversas dela. Hoje esse espaco -- o
-- unico com concorrencia de verdade -- e gasto escrevendo "isto e
-- anuncio", antes de dizer qualquer coisa que interesse.
--
-- Com a troca, quem ocupa a linha e o `{gancho}`, que e a frase escrita
-- para essa pessoa especifica e que existe justamente para ganhar o
-- dedo que rola a tela.
--
-- O #publi NAO SAI, e isso nao e negociavel: identificar publicidade e
-- exigencia legal e e a regra 3.10. Ele so deixa de ser manchete e vira
-- rodape, que e onde ninguem precisa dele para decidir e onde qualquer
-- um o encontra se procurar. E o mesmo lugar em que os concorrentes o
-- poem quando o poem.
--
-- VALE PARA OS DEZ MODELOS, e nao so para o Radar Delas. A causa e a
-- mesma nos nove canais, o texto movido e identico, e deixar oito
-- canais com manchete de rotulo enquanto um tem gancho seria
-- divergencia sem razao. Se for para voltar, volta tudo junto.
--
-- O `{gancho}` E OPCIONAL, e isso foi conferido antes: sem chave da
-- IA, com a API fora ou com a resposta reprovada, `geraGancho` devolve
-- nulo e o campo vem vazio. O post comecaria com linha em branco -- so
-- que `montaMensagem` termina em `.trim()` (lib/mensagem.ts:596), que
-- come a linha vazia do topo. Nao ha caso novo a tratar.
--
-- A TROCA E LITERAL, sem regex: `{loja}` tem chave, que em expressao
-- regular e quantificador, e escapar isso e como se erra em migration
-- de texto. O `where` garante que so muda quem ainda comeca com o
-- rotulo, entao rodar duas vezes nao empilha dois rodapes.
-- =============================================================

update public.modelo_mensagem
   set corpo = replace(corpo, '#publi · {loja}' || E'\n\n', '')
               || E'\n\n#publi · {loja}'
 where corpo like '#publi · {loja}' || E'\n\n' || '%';

-- O post de cupom tem o rotulo proprio, e a mesma razao vale para ele.
update public.modelo_mensagem
   set corpo_cupom = replace(corpo_cupom, '#publi · Cupom {loja}' || E'\n\n', '')
                     || E'\n\n#publi · Cupom {loja}'
 where corpo_cupom like '#publi · Cupom {loja}' || E'\n\n' || '%';
