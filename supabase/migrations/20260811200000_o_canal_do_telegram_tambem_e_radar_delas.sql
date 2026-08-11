-- =============================================================
-- 68 · O canal do Telegram também virou Radar Delas
--
-- O dono renomeou o canal do Telegram em 11/08. Conferido na API,
-- não suposto:
--
--     @radarbeauty -> titulo "Radar Delas | Beleza e Skincare 💄✨"
--                     username @radarbeauty   (INALTERADO)
--     @radardelas  -> chat not found
--
-- NADA QUEBROU, e o motivo é a D-044: identificamos o canal pelo
-- `@nome` público, não pelo título nem pelo id numérico. O título é
-- rótulo e muda quando o dono quiser; o username é a chave. Foi
-- exatamente para este caso que aquela decisão existe.
--
-- O QUE ESTAVA ERRADO ERA SÓ O NOME NO NOSSO BANCO, que continuava
-- "Radar Beauty" enquanto o membro do grupo lia "Radar Delas". O painel
-- mostrava um nome que não existe mais em lugar nenhum.
--
-- POR QUE O SUFIXO "(Telegram)" E NÃO "Radar Delas" PURO. Já existe um
-- canal chamado `Radar Delas`, que é o grupo de WhatsApp
-- (`120363428084358125@g.us`). Dois registros com o mesmo nome fariam
-- duas coisas ruins: a tela de Canais ficaria com duas linhas
-- idênticas, e toda migration que casa canal por `nome` — as 66 e 67
-- fazem isso — passaria a atingir os dois sem querer. O nome é rótulo
-- nosso, então ele carrega a plataforma.
--
-- O QUE ESTA MIGRATION NÃO TOCA, DE PROPÓSITO:
--
--   `telegram_chat_id` continua `@radarbeauty`. É a chave que funciona,
--   e trocá-la por um username que não existe calaria o canal.
--
--   `etiqueta_afiliado` continua `radarbeauty`. Ela está cadastrada na
--   Central de Afiliados do Mercado Livre, e etiqueta não cadastrada
--   emudece o canal inteiro (erro de 10/08, registrado no AGENTS.md).
--   Renomear a etiqueta é trabalho manual na Central, primeiro lá.
-- =============================================================

update public.canal
   set nome = 'Radar Delas (Telegram)',
       atualizado_em = now()
 where nome = 'Radar Beauty'
   and plataforma = 'telegram';

-- O modelo de mensagem carrega o nome do canal desde a migration 65, e
-- ele é só rótulo de tela. Anda junto para não sobrar "Radar Beauty" em
-- lugar nenhum.
update public.modelo_mensagem m
   set nome = c.nome,
       atualizado_em = now()
  from public.canal c
 where c.id = m.canal_id
   and m.nome = 'Radar Beauty';
