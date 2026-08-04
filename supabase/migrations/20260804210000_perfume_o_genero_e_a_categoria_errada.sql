-- =============================================================
-- 54 · O canal de perfume masculino para de nascer mudo
--
-- Diagnostico completo na D-063. O resumo: nao era o filtro que
-- segurava o canal, era nao haver o que publicar. Perfume e o 4o menor
-- nicho do sistema (81 produtos contra 3.206 de casa), e das 33 pecas
-- que vem da Shopee NENHUMA era publicavel.
--
-- Esta migration resolve as duas causas que moram no banco. A terceira,
-- que e a falta de termo de busca, mora no coletor e vai junto no mesmo
-- commit.
--
-- -------------------------------------------------------------
-- 1. `SHOPEE-100708` NAO E PERFUME
-- -------------------------------------------------------------
--
-- A migration 44 mapeou a categoria por id, sem nome a vista, e esta
-- caiu no balde errado. Os produtos dela sao:
--
--   Umidificador Difusor de Ar Estiloso Chama de Simulacao
--   Kit Refis de Lavanda Bom Ar Banheiro Odorizador 12ml
--   Kit 6 Saches Perfumados Via Aroma, Cheirinho para Gaveta
--
-- E aromatizador de AMBIENTE, nao perfume de pessoa. Sao 12 dos 33.
-- O id fica entre eletronico (100703-706) e casa (100709-712) na
-- sequencia, o que reforca que o lugar dele e `casa`.
--
-- O efeito hoje e duplo e todo ruim: eles poluem a contagem do nicho
-- perfume (fazendo `demanda_por_nicho` mentir) e nao publicam em canal
-- nenhum, porque perfume sem GENDER e barrado no masculino e no Beauty.
-- Em `casa` eles pelo menos contam para a decisao de abrir um canal.
--
-- -------------------------------------------------------------
-- 2. O GENERO DOS PERFUMES QUE JA ESTAO NO BANCO
-- -------------------------------------------------------------
--
-- O coletor da Shopee passa a gravar `GENDER` a partir do titulo, mas
-- so para o que entrar de agora em diante. Os 21 perfumes reais que ja
-- estao la continuariam invisiveis ate alguem reescrever a linha.
--
-- A REGRA AQUI E A MESMA DE `lib/genero-pelo-titulo.ts`, e tem que
-- continuar sendo. Ela e covarde de proposito:
--
--   diz "masculino" e NAO diz "feminino"  ->  Masculino
--   diz "feminino"  e NAO diz "masculino" ->  Feminino
--   diz os dois, nenhum, ou "unissex"     ->  nao mexe
--
-- O motivo esta na `onde-paramos`: um perfume feminino ja saiu no canal
-- masculino e nao pode ser tirado. Publicar no canal errado e pior que
-- nao publicar, porque o membro nao reclama, ele sai.
--
-- E NUNCA SOBRESCREVE quem ja tem `GENDER`: o do Mercado Livre veio da
-- API e vale mais que a nossa leitura de titulo.
-- =============================================================

-- 1. A categoria vai para casa, no mapa e nos produtos que ja entraram.
update public.nicho_dominio
   set nicho_id = (select id from public.nicho where slug = 'casa' limit 1)
 where dominio_externo = 'SHOPEE-100708';

update public.produto p
   set nicho_id = (select id from public.nicho where slug = 'casa' limit 1),
       atualizado_em = now()
 where exists (
   select 1 from public.anuncio a
    where a.produto_id = p.id
      and a.dominio_externo = 'SHOPEE-100708'
 );

-- 2. O genero, para quem da para ler sem chutar.
update public.produto p
   set atributos = coalesce(p.atributos, '{}'::jsonb)
                   || jsonb_build_object(
                        'GENDER',
                        case
                          when p.titulo_canonico ~* '(masculin|pour homme|for men|for him|homem)'
                          then 'Masculino' else 'Feminino'
                        end),
       atualizado_em = now()
 where (p.atributos is null or coalesce(p.atributos->>'GENDER', '') = '')
   -- Declarou-se de ninguem, ou e de crianca: fica de fora.
   and p.titulo_canonico !~* '(unissex|unisex|infantil|kids|para ambos)'
   -- Exatamente um dos dois lados, nunca os dois.
   and (p.titulo_canonico ~* '(masculin|pour homme|for men|for him|homem)')
     <> (p.titulo_canonico ~* '(feminin|pour femme|for women|for her|mulher)')
   -- So onde o genero significa alguma coisa: perfume e beleza.
   and p.nicho_id in (select id from public.nicho where slug in ('perfume', 'beleza'));

comment on column public.produto.atributos is
  'Atributos do produto. `GENDER` vem da API no Mercado Livre e da leitura do titulo na Shopee, que nao tem atributo no feed. A leitura de titulo e conservadora e deixa nulo quando o titulo nao e inequivoco: publicar no canal errado e pior que nao publicar (D-063).';
