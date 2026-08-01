-- =============================================================
-- 25 · Escavar o histórico dos canais (Frente D de docs/otimizacao.md)
--
-- A ideia é do dono: *"se você entrar em vários grupos no Telegram,
-- normalmente quando você entra, você tem um histórico do grupo
-- também. Daí a gente vai ter, por exemplo, que foi postado na semana
-- passada com o valor de oitocentos reais, e agora até por
-- setecentos"*.
--
-- Ela é boa, e a única peça que faltava era paginação: `t.me/s/<canal>`
-- mostra os ~20 posts mais recentes e a colheita parava aí. Num canal
-- que publica vinte posts por hora, isso é UMA HORA de histórico.
--
-- O Telegram aceita `?before=<id>`. Medido em 01/08 contra
-- `t.me/s/promobit`: oito páginas seguidas, sem parar, chegando a dois
-- dias atrás.
--
-- E o preço que vem daí JÁ TEM CASA e ela é separada de propósito:
-- `mencao.preco_alegado_centavos`, com o comentário que a migration 7
-- deixou escrito, *"alegação de terceiro, não dado de preço: nunca
-- entra em preco_ponto"*. Preço que a gente mediu e preço que um canal
-- alheio disse não podem virar a mesma série: um canal que mente
-- envenenaria a nossa referência, e o lastro da regra 3.4 passaria a
-- se apoiar em alegação. Esta migration mantém a separação e só torna
-- o lado alegado consultável.
-- =============================================================

-- Onde a escavação parou. `ultimo_post_id` guarda a borda de cima (o
-- que já lemos para a frente); este é a borda de baixo, e sem ele cada
-- passada recomeçaria do topo e escavaria o mesmo pedaço para sempre.
alter table public.fonte_descoberta
  add column if not exists primeiro_post_id bigint,
  add column if not exists escavacao_concluida boolean not null default false;

comment on column public.fonte_descoberta.primeiro_post_id is
  'O post mais antigo já lido. É daqui que a escavação continua na próxima passada.';

comment on column public.fonte_descoberta.escavacao_concluida is
  'Verdadeiro quando o canal não devolve mais nada para trás. Para de gastar requisição escavando o que acabou.';

-- As fontes que já foram lidas precisam de uma borda de baixo, senão a
-- primeira escavação traria posts antigos e o filtro de "já visto" os
-- descartaria: post antigo tem id MENOR que o último lido.
--
-- `ultimo_post_id` é a borda certa porque a versão anterior da colheita
-- só lia a primeira página: tudo abaixo dela é território não
-- explorado. O pedaço que sobrepõe não faz mal, porque `registra_mencao`
-- ignora menção repetida por `(fonte, post, url)`.
update public.fonte_descoberta
   set primeiro_post_id = ultimo_post_id
 where primeiro_post_id is null
   and ultimo_post_id is not null;


-- -------------------------------------------------------------
-- O histórico alegado, por anúncio
--
-- É o que responde à pergunta do dono: "por quanto este produto já foi
-- anunciado por aí, e quando?". Fica em view porque não é dado novo:
-- é o que a colheita já grava, arrumado para ser lido.
--
-- REPARE NO QUE ELE NÃO FAZ: não entra em `preco_ponto`, não alimenta
-- `avalia_anuncio` e não vira lastro de mensagem. É contexto e é
-- descoberta, não medição.
-- -------------------------------------------------------------
create or replace view public.historico_alegado
with (security_invoker = true)
as
select m.anuncio_id,
       m.operacao_id,
       m.preco_alegado_centavos,
       m.publicada_em,
       f.identificador as canal,
       f.nome          as canal_nome
  from public.mencao m
  join public.fonte_descoberta f on f.id = m.fonte_id
 where m.anuncio_id is not null
   and m.preco_alegado_centavos is not null
   and m.publicada_em is not null;

comment on view public.historico_alegado is
  'Por quanto cada anúncio já foi anunciado em canal alheio, e quando. ALEGAÇÃO DE TERCEIRO: serve de contexto e para achar canal que mente, nunca de lastro (regra 3.4).';


-- -------------------------------------------------------------
-- O resumo, que é o formato em que a pergunta é feita
-- -------------------------------------------------------------
create or replace view public.referencia_alegada
with (security_invoker = true)
as
select h.anuncio_id,
       h.operacao_id,
       min(h.preco_alegado_centavos)                     as menor_alegado_centavos,
       max(h.preco_alegado_centavos)                     as maior_alegado_centavos,
       count(*)                                          as vezes_anunciado,
       count(distinct h.canal)                           as canais,
       min(h.publicada_em)                               as primeira_vez,
       max(h.publicada_em)                               as ultima_vez
  from public.historico_alegado h
 group by h.anuncio_id, h.operacao_id;

comment on view public.referencia_alegada is
  'Um resumo por anúncio do que os canais alheios já cobraram. "Vezes anunciado" alto é sinal de produto que o mercado repete, e menor alegado é a régua informal do preço bom.';
