-- =============================================================
-- 69 · O Radar Delas do Telegram fecha a madrugada
--
-- O canal estava com `horarios_permitidos` de 0 a 23, ou seja, postando
-- às três da manhã. O diagnóstico do próprio dono, em
-- `docs/personas-dos-canais.md`, chama isso de problema G-01 e é
-- explícito sobre o custo: *"a reação não é sair do grupo, é pior:
-- silenciar. Quem silencia continua no contador de membros e nunca mais
-- volta"*.
--
-- O TETO DE 300 FICA. Ele não é o problema, e copiar os 30 do WhatsApp
-- para cá seria raciocínio errado: aqueles 30 existem por causa do
-- chip, que cai, e no Telegram não há chip nenhum. O que sai é só a
-- madrugada.
--
-- 7h às 23h cobre os três picos que `lib/horarios.ts` mede e não corta
-- volume relevante: o que a janela fechada empurra para a manhã
-- seguinte é o que ninguém leria acordado.
-- =============================================================

update public.canal
   set horarios_permitidos = array[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
       atualizado_em = now()
 where nome = 'Radar Delas (Telegram)';
