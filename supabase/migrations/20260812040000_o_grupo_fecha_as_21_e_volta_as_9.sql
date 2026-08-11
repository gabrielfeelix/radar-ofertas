-- =============================================================
-- 75 · O grupo do WhatsApp fecha às 21h e volta às 9h
--
-- A migration 74 abriu as 24 horas para os 72 posts caberem. O dono
-- reviu na sequência e fechou a madrugada, com números:
--
--   *"pare todo dia às 21h e volte às 09h, ok? nao EXATAMENTEEEEEE, É
--   RANDOMIZADO, pode ser 20:57, 21:07, o prazo maximo é 21:11 e o
--   minimo é 09:07"*
--
-- A COLUNA SÓ GUARDA HORA, e a randomização de minuto não cabe nela.
-- Ela vive em `lib/ritmo.ts` (`bordaDoDia`), sorteada e ESTÁVEL POR
-- DIA: sobre a primeira hora da lista, de 7 a 21 minutos depois; sobre
-- a última, de 3 antes a 11 depois. Com a lista abaixo isso dá
-- exatamente o que ele pediu.
--
-- O que muda aqui é o miolo: de 0..23 para 9..21.
--
-- A CONTA DO DIA MUDA JUNTO, e é melhor estar escrito: 13 horas de
-- janela a 3 posts por hora são 39, não 72. O teto de 72 fica onde
-- está, porque teto é limite e não meta — quem manda no volume agora é
-- a janela, e foi ele quem a fechou depois de tê-la aberto.
-- =============================================================

update public.canal
   set horarios_permitidos = array[9,10,11,12,13,14,15,16,17,18,19,20,21],
       atualizado_em = now()
 where nome = 'Radar Delas'
   and plataforma = 'whatsapp';
