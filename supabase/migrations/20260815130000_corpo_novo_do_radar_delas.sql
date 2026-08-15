-- -------------------------------------------------------------
-- O CORPO QUE O DONO APROVOU EM 15/08, e só no Radar Delas do WhatsApp
--
-- Ele nasceu de um teste: cinco promos escritas à mão, mandadas ao
-- número dele, e a resposta foi *"AMEEEI essa nova versão, adorei essa
-- versão de ícones, mensagem"*. O motivo de cada linha que saiu está
-- em docs/superpowers/specs/2026-08-15-novo-formato-de-post-design.md.
--
-- O QUE SAIU, E POR QUÊ:
--
--   {gancho} da primeira linha   virou a descrição e DESCEU para
--                                baixo do produto. O texto continua
--                                vindo de lib/gancho.ts e o
--                                placeholder continua sendo {gancho}:
--                                o que mudou é o conteúdo e o lugar.
--   {desconto}% off              o "de/por" logo acima já mostra a
--                                diferença, e a linha custava espaço
--   {frete} e {vendedor}         não decidem compra de beleza de
--                                trinta reais, e o vendedor era a
--                                linha mais comprida do post
--   #publi · {loja}              decisão do dono, §6 da spec. A regra
--                                3.10 continua no AGENTS.md e a
--                                pesquisa em fonte primária (CONAR,
--                                CDC art. 36, termos de Shopee e
--                                Amazon) ficou aberta.
--
-- O BLOCO DE PREÇO É COLADO DE PROPÓSITO. Lastro, "de/por" e avaliação
-- são a mesma informação (quanto custa e se vale), e separá-los em
-- três parágrafos fazia o post ocupar tela sem dizer mais nada.
-- Palavras do dono: *"você juntou, o texto ficou muito menor, ficou
-- mais gostoso de ler"*.
--
-- OS OUTROS OITO CANAIS NÃO MUDAM. O formato roda uma semana aqui
-- antes de qualquer coisa.
-- -------------------------------------------------------------

update public.modelo_mensagem
   set corpo = concat_ws(E'\n',
         '{emoji} <b>{produto}</b>',
         '',
         '{gancho}',
         '',
         '{lastro}',
         'De <s>{preco_antes}</s> por <b>{preco}</b>',
         '{nota}',
         '',
         '🛒 {link}'
       )
 where canal_id = '1b22b636-b723-4592-95fd-a87053b7dcc6';
