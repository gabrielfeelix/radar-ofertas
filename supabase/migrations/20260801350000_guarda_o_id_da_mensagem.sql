-- =============================================================
-- 44 · O id da mensagem do Telegram passa a ser guardado
--
-- POR QUE ISTO APARECEU AGORA: em 01/08 às 19:31 o Radar Perfumes
-- (masc) publicou **"Armaf Club de Nuit Woman EDP 200ml para
-- feminino"**. O filtro de gênero da migration 43 já existia no banco e
-- estava certo (`exige_atributo = true`), mas o agendador tinha feito
-- checkout do repositório às 19:00, antes do código do publicador
-- acompanhar. Uma janela de meia hora, um post errado.
--
-- E AÍ VEIO A DESCOBERTA: não dá para apagar. `mandaAoTelegram` recebe
-- `result.message_id` do Telegram, usa para dizer "deu certo" e
-- **descarta**. Sem ele não existe `deleteMessage` nem `editMessageText`
-- — nenhuma publicação deste sistema pode ser corrigida depois de sair.
--
-- Isso é maior que o caso que o revelou. Um canal de ofertas erra: preço
-- que mudou entre a leitura e o post, produto que esgotou, oferta que a
-- loja cancelou. Todos os três pedem apagar ou editar, e nenhum é
-- possível hoje. O dado sempre esteve na resposta e sempre foi jogado
-- fora.
--
-- Guardar não apaga nada sozinho: só torna possível. Quem apaga é gente,
-- ou uma rotina futura.
-- =============================================================

alter table public.publicacao
  add column if not exists telegram_message_id bigint;

comment on column public.publicacao.telegram_message_id is
  'O id da mensagem no Telegram, devolvido pelo sendMessage/sendPhoto. É o que permite apagar ou editar depois. Nulo em publicação de WhatsApp e nas que saíram antes de 01/08.';

create index if not exists publicacao_telegram_msg_idx
  on public.publicacao (canal_id, telegram_message_id)
  where telegram_message_id is not null;
