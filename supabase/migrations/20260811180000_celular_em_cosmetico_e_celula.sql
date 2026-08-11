-- =============================================================
-- 67 · "Celular" em cosmético é célula, não telefone
--
-- Conserta um erro da migration 66, medido minutos depois de aplicá-la.
-- Dos SETE produtos que ela marcou como eletrônico, QUATRO eram falso
-- positivo, e todos pelo mesmo motivo:
--
--     NIVEA Creme para Mãos Q10 Plus ... Renovação Celular
--     Acquaflora Nutrição Celular  Shampoo 300ml
--     Acquaflora Nutrição Celular  Condicionador 300ml
--     Kit Acquaflora Nutrição Celular Duo
--
-- Nenhum tem telefone nenhum. "Nutrição celular" e "renovação celular"
-- são copy de cosmético, e o canal de beleza é justamente onde essa
-- expressão mais aparece. A migration 66 tirava do Radar Delas três
-- produtos que são exatamente o que ele existe para publicar.
--
-- É A MESMA ARMADILHA DO "LITRO" que a migration 56 desfez em 741
-- linhas: a palavra não é o sinal, a palavra DENTRO DE UM CONTEXTO é.
-- Litro num shampoo quer dizer salão e numa panela quer dizer panela;
-- celular num creme quer dizer célula e num suporte quer dizer telefone.
--
-- A regra viva está em `lib/eletronico-em-beleza.ts`, que passou a
-- tratar `celular` separado do resto da lista, com o vocabulário de
-- cosmético antes dele desarmando a marcação. Esta migration só desfaz
-- o que a 66 já gravou.
-- =============================================================

update public.produto p
   set atributos = p.atributos - 'TIPO',
       atualizado_em = now()
 where (p.atributos ->> 'TIPO') = 'eletronico'
   -- Foi marcado por causa de "celular" precedido de palavra de
   -- cosmético...
   and lower(p.titulo_canonico) ~ '\m(nutricao|nutrição|renovacao|renovação|regeneracao|regeneração|reparacao|reparação|recuperacao|recuperação|revitalizacao|revitalização|oxigenacao|oxigenação|hidratacao|hidratação|protecao|proteção|energia|nivel|nível|matriz|atividade|memoria|memória|defesa|estimulo|estímulo)\s{1,3}celular\M'
   -- ...e não tem NENHUM outro sinal de eletrônico no título, senão a
   -- marcação continua certa por outro motivo.
   and lower(p.titulo_canonico) !~ '\m(fone|fones|airpods|air pods|headset|headphone|earbud|smartphone|iphone|tablet|notebook|laptop|teclado|mouse|monitor|computador|impressora|roteador|pendrive|ssd|hd externo|cabo usb|carregador|power bank|caixa de som|smartwatch|controle remoto|videogame|playstation|xbox|nintendo|drone)\M'
   -- E "suporte de celular" continua marcado: ali o celular é telefone.
   and lower(p.titulo_canonico) !~ '\m(suporte|capa|capinha|pelicula|película|tripe|tripé|carregador)\M';
