-- =============================================================
-- O WhatsApp passa a publicar sozinho
-- =============================================================
--
-- Decisão do dono em 06/08, revogando a D-053 e reescrevendo a
-- regra 3.2 do AGENTS.md: *"n ligo de derrubar conta do numero,
-- vou ir comprando varios"* e *"vou pagar 30/mes chip e etc"*.
--
-- A D-053 tinha engavetado o WhatsApp automático por CONTA, não
-- por princípio: o custo do chip e da VPS não se pagava num grupo
-- sem audiência. O dono aceitou a conta e o risco de banimento.
-- Detalhe em `docs/decisoes.md`, D-071.
--
-- O que esta migration dá ao publicador:
--
--   1. `canal.whatsapp_grupo_id` — o JID do grupo (`...@g.us`), que
--      é para onde a mensagem vai. É o equivalente do
--      `telegram_chat_id`.
--   2. `canal.whatsapp_instancia` — QUAL CHIP serve este canal. É a
--      coluna que sustenta o teto por número, abaixo.
--   3. `publicacao.whatsapp_message_id` — o id devolvido no envio,
--      pelo mesmo motivo da migration 44 no Telegram: sem ele não
--      há como apagar o que saiu errado.
--   4. dois parâmetros: o freio de mão e o teto por chip.
--
-- NÃO HÁ CONSTRAINT exigindo `whatsapp_grupo_id` em canal de
-- WhatsApp, e é de propósito: os canais de WhatsApp que já existem
-- foram criados sem ele, e a constraint recusaria a migration
-- inteira. Quem cobra é o publicador, que trava o canal na rodada
-- e diz no log o que falta — o mesmo tratamento que a etiqueta de
-- afiliado já recebe (D-045).

alter table public.canal
  add column if not exists whatsapp_grupo_id text,
  add column if not exists whatsapp_instancia text;

comment on column public.canal.whatsapp_grupo_id is
  'JID do grupo de WhatsApp (ex.: 120363000000000000@g.us). É para onde o bot publica.';
comment on column public.canal.whatsapp_instancia is
  'Qual instância/chip serve este canal. O teto de envios por dia é contado POR AQUI, não por canal.';

create index if not exists canal_whatsapp_instancia_idx
  on public.canal (whatsapp_instancia) where whatsapp_instancia is not null;

alter table public.publicacao
  add column if not exists whatsapp_message_id text;

comment on column public.publicacao.whatsapp_message_id is
  'Id da mensagem no WhatsApp. Existe para poder apagar depois — mesmo motivo do telegram_message_id.';

-- -------------------------------------------------------------
-- O comentário da tabela mentia depois desta mudança.
-- -------------------------------------------------------------
comment on constraint canal_telegram_tem_chat on public.canal is
  'Telegram exige chat_id. O WhatsApp não exige grupo aqui porque canais antigos foram criados sem ele; quem cobra é o publicador.';

-- -------------------------------------------------------------
-- Os dois parâmetros novos.
--
-- `whatsapp_automatico` nasce EM ZERO, e isso não é timidez: o
-- chip, a VPS e os 14 dias de aquecimento ainda não existem no dia
-- desta migration. Ligar antes de o número estar aquecido é
-- exatamente o que a D-053 mediu derrubando conta em 2 a 8
-- semanas. Vira 1 quando o número estiver pronto.
--
-- `whatsapp_envios_dia_max` é o teto POR CHIP, somando todos os
-- canais que ele serve. O teto diário do canal continua valendo
-- por cima; este aqui é o que protege o número, e é outra conta:
-- sete canais a 30 posts/dia num chip só dá 210 envios, acima do
-- teto de número maduro que a D-053 levantou (menos de 200/dia,
-- menos de 30/hora). 150 é margem sobre isso.
-- -------------------------------------------------------------
insert into public.parametro (operacao_id, chave, valor, descricao)
select o.id, v.chave, v.valor, v.descricao from public.operacao o,
(values
  ('whatsapp_automatico', 0,
   'Freio de mão do envio automático no WhatsApp. 0 desliga, 1 liga. Nasce desligado: só vira 1 com o número já aquecido.'),

  ('whatsapp_envios_dia_max', 150,
   'Teto de envios por dia POR CHIP (canal.whatsapp_instancia), somando os canais dele. Protege o número, não o combinado com o parceiro.')
) as v(chave, valor, descricao)
where not exists (
  select 1 from public.parametro p
  where p.operacao_id = o.id and p.chave = v.chave and p.nicho_id is null
);
