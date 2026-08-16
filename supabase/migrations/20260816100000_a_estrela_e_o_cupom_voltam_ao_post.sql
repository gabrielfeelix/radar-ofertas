-- -------------------------------------------------------------
-- A ESTRELA E O CUPOM VOLTAM AO POST DO RADAR DELAS
--
-- Conserta dois defeitos que a migration 20260815130000 introduziu, e
-- os dois são meus. O dono viu na manhã seguinte, comparando o post
-- automático com o que tinha sido escrito à mão: *"a maioria não tem
-- avaliações, que deveria ter"* e *"tem espaço pra cupom? A GENTE TÁ
-- PUXANDO CUPOM?"*.
--
-- DEFEITO 1: `{nota}` NÃO É A ESTRELA.
--
-- Escrevi `⭐ {nota} (... avaliações)` no corpo achando que `{nota}`
-- era a avaliação do anúncio. Não é: `{nota}` é a NOTA DO CURADOR,
-- texto escrito à mão que quase nenhum produto tem, e o placeholder de
-- avaliação simplesmente não existia. O post saía sem estrela nenhuma.
--
-- O dado sempre esteve no banco: **37.114 dos 41.500 anúncios ativos
-- têm avaliação**, 89% do catálogo. O que faltava era o caminho até a
-- mensagem, e ele foi aberto em `lib/mensagem.ts` como `{estrelas}`,
-- uma linha pronta que some inteira quando falta nota ou quantidade.
--
-- DEFEITO 2: EU TIREI O `{cupom}` DO CORPO.
--
-- Ao enxugar o post, cortei o cupom junto com o frete e o vendedor. A
-- diferença é que frete e vendedor não mudam o preço, e cupom muda:
-- existem **112 cupons ativos** colhidos e nenhum deles tinha por onde
-- sair neste canal. Ele volta ENCOSTADO no bloco de preço, porque é
-- preço, e some sozinho quando não há cupom.
--
-- A `{nota}` do curador sai do corpo de vez. Ela é do tempo em que a
-- fila era aprovada à mão, quase nunca está preenchida, e o lugar dela
-- no post novo é justamente onde a estrela precisa estar.
-- -------------------------------------------------------------

update public.modelo_mensagem
   set corpo = concat_ws(E'\n',
         '{emoji} <b>{produto}</b>',
         '',
         '{gancho}',
         '',
         '{lastro}',
         'De <s>{preco_antes}</s> por <b>{preco}</b>',
         '{cupom}',
         '{estrelas}',
         '',
         '🛒 {link}'
       )
 where canal_id = '1b22b636-b723-4592-95fd-a87053b7dcc6';

-- O cupom encostado no preço pede uma redação mais curta que a antiga,
-- que abria com o rótulo e empurrava o código para o fim da linha.
update public.modelo_mensagem
   set linha_cupom = '🎟️ com o cupom <b>{codigo}</b>'
 where canal_id = '1b22b636-b723-4592-95fd-a87053b7dcc6';
