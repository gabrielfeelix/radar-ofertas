-- =============================================================
-- 73 · O Radar Delas do WhatsApp sobe para 72 por dia
--
-- Pedido do dono em 11/08, com o canal parado desde 12h21 e o chip no
-- dia 2 da rampa antiga, que liberava 15:
--
--   *"quero pelo menos 3 promoções por hora, ou seja, a cada 20 min uma
--   promoção... 72 por dia nos 5 primeiros dias, depois aumenta o ritmo
--   pra 5 posts por hora, dps 10, até entrar no ritmo normal"*
--
-- E ele sabe o que está trocando: *"bem mais que o que eu pedi de 10 a
-- 15 por dia, mas sou EU que estou pedindo"*.
--
-- A curva nova vive em `lib/aquecimento.ts`, em código e não em
-- parâmetro, pelo mesmo motivo de sempre: é política, e em parâmetro
-- ela mudaria em produção sem commit, sem teste e sem ninguém lembrar
-- por quê. O que muda aqui é só o teto do CANAL, que estava em 30 e
-- cortaria a curva nova antes de ela valer.
--
-- A JANELA É O QUE FALTA PARA OS 72 SEREM 72. A conta do dono é
-- 3 x 24 = 72, e este canal tem nove horas permitidas, o que dá 27. Os
-- 72 só saem com janela de 24 horas, e isso quer dizer WhatsApp tocando
-- às 3 da manhã — que é o G-01 do diagnóstico dele mesmo. A janela fica
-- como está, e a decisão de abri-la é dele, com o número na frente.
-- =============================================================

update public.canal
   set posts_por_dia_max = 72,
       atualizado_em = now()
 where nome = 'Radar Delas'
   and plataforma = 'whatsapp';
