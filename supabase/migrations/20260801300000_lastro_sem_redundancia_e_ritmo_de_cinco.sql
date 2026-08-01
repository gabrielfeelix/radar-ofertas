-- =============================================================
-- 39 · A linha redundante do lastro, e o ritmo de cinco minutos
--
-- Dois pedidos do dono em 01/08 à noite, olhando um post real no canal.
-- =============================================================


-- -------------------------------------------------------------
-- 1. O lastro declarado repetia os dois números que já estavam acima
--
-- O post que ele mandou:
--
--     ❌ De R$ 103,19
--     ✅ Por R$ 76,00  (−26%)
--
--     a loja marcou de R$ 103,19 por R$ 76,00      ← esta linha
--     🏪 Loja oficial
--
-- *"já tem um DE e um POR, e logo embaixo, redundantemente, tem o texto
-- a loja marcou de R$ 103,19 por R$ 76,00, n faz sentido"*. Ele está
-- certo: são os mesmos dois valores, duas linhas abaixo.
--
-- MAS A LINHA NÃO PODE SUMIR INTEIRA, e este é o ponto que a migration
-- 23 deixou escrito: o `original_price` do Mercado Livre é
-- frequentemente inflado. Sem atribuição nenhuma, o "De R$ 103,19"
-- passa a ser lido como medição NOSSA, e afirmar como nosso um número
-- que é alegação da loja é exatamente o que a regra 3.4 proíbe. É a
-- diferença entre reportar e repetir a mentira dos concorrentes.
--
-- Então o que sai é a REPETIÇÃO, não a atribuição: a linha para de
-- dizer os números e passa a dizer de quem eles são. Ela continua
-- aparecendo só quando `gatilho = declarado`, que é o caso em que não
-- medimos nada.
-- -------------------------------------------------------------
update public.modelo_mensagem
   set lastro_declarado = '🏷 Preço "de" declarado pela loja — ainda sem histórico nosso.',
       atualizado_em = now()
 where lastro_declarado like '%{antes}%';

alter table public.modelo_mensagem
  alter column lastro_declarado
  set default '🏷 Preço "de" declarado pela loja — ainda sem histórico nosso.';

comment on column public.modelo_mensagem.lastro_declarado is
  'Usado quando oferta.gatilho = declarado. NÃO REPETE OS VALORES (eles já estão no corpo), e TEM QUE ATRIBUIR À LOJA: o preço de antes é alegação dela. Nunca pode afirmar mínimo histórico (regra 3.4).';


-- -------------------------------------------------------------
-- 2. Um post a cada cinco minutos
--
-- Pedido direto: *"a periodicidade de 5 em 5 min pra enviar
-- promoções"*. Pico e normal vão a cinco.
--
-- A MADRUGADA NÃO VAI, e a conta explica por quê. O teto diário do
-- canal é 50. A cinco minutos, das 7h à meia-noite cabem 204 janelas —
-- o teto estoura muito antes, então quem governa o volume passa a ser
-- o teto, não o intervalo. Se a madrugada também fosse de cinco, o
-- canal gastaria as 50 vagas entre 0h e 4h, com ninguém acordado, e
-- amanheceria mudo. Trinta minutos mantém a madrugada viva sem que ela
-- coma o dia.
--
-- Na prática, com a base de hoje, quem limita não é nenhum dos dois: é
-- quantas ofertas a detecção aprova. Cinco minutos quer dizer "publica
-- assim que houver o que publicar", que é o que o pedido significa.
-- -------------------------------------------------------------
update public.parametro set valor = 5,  atualizado_em = now() where chave = 'intervalo_pico_min';
update public.parametro set valor = 5,  atualizado_em = now() where chave = 'intervalo_normal_min';
update public.parametro set valor = 30, atualizado_em = now() where chave = 'intervalo_madrugada_min';
