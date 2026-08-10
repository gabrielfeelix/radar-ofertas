-- =============================================================
-- O chip ganha registro
-- =============================================================
--
-- (O número desta migration é a posição dela em `docs/migrations.md`.
-- Cite pelo carimbo `20260810150000`, não pelo número: em 04/08 dois
-- agentes numeraram em paralelo e "migration 64" virou três coisas.)
--
-- Até aqui o sistema sabia por qual chip publicar
-- (`canal.whatsapp_instancia`, um texto solto) e nada sobre o chip:
-- quando começou a aquecer, se está conectado, quanto já falou hoje.
--
-- Isso vira problema em três momentos previsíveis:
--
--   1. O AQUECIMENTO. O volume sobe por 14 dias, e sem uma data
--      gravada o teto do dia depende de alguém lembrar em que dia
--      está.
--   2. A QUEDA. O número vai cair, e cai como "instância
--      desconectada". A pergunta operacional do dia é "está de pé?",
--      e hoje ela só tem resposta abrindo o painel da Evolution na
--      VPS.
--   3. O SEGUNDO CHIP. Um número por instância, com teto próprio.
--      Com dois, texto solto vira erro de digitação silencioso.
--
-- O SEGREDO NÃO ENTRA AQUI. `variavel_do_segredo` guarda o NOME da
-- variável de ambiente, nunca o valor. O motivo é a Fase 3: hoje só o
-- dono entra no painel, e guardar o token no banco seria conveniente.
-- Na Fase 3 entram parceiros, e aí a RLS vira a única coisa entre um
-- parceiro e o chip do dono. Policy errada numa migration futura
-- custaria a conta do WhatsApp; com o segredo fora do banco, custa
-- nada.

create table public.bot (
  id                   uuid primary key default gen_random_uuid(),
  operacao_id          uuid not null references public.operacao(id) on delete cascade,
  nome                 text not null,
  plataforma           text not null,
  identificador        text not null,
  instancia            text,
  variavel_do_segredo  text not null,
  aquecimento_inicio   date,
  envios_dia_max       integer not null default 150,
  ativo                boolean not null default true,
  observacao           text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),

  constraint bot_plataforma_valida check (plataforma in ('whatsapp', 'telegram')),
  constraint bot_teto_positivo check (envios_dia_max > 0),

  -- WhatsApp sem instância não alcança a Evolution, e sem data de
  -- início não tem rampa. As duas coisas se decidem no cadastro ou
  -- nunca: descobrir que falta a data no dia 1 é descobrir tarde.
  constraint bot_whatsapp_completo check (
    plataforma <> 'whatsapp'
    or (instancia is not null and aquecimento_inicio is not null)
  )
);

comment on table public.bot is
  'Quem fala: um bot de Telegram ou um chip de WhatsApp. O teto de envios e a rampa de aquecimento são POR AQUI, porque é o número que cai, não o canal.';
comment on column public.bot.identificador is
  'O @ do bot no Telegram ou o número no WhatsApp. Leitura humana, não é usado para publicar.';
comment on column public.bot.instancia is
  'Nome da instância na Evolution API. Só WhatsApp. É por ela que o publicador chama a VPS.';
comment on column public.bot.variavel_do_segredo is
  'O NOME da variável de ambiente que guarda o token ou a apikey. NUNCA o valor: segredo não entra no banco (regra 3.1 e a Fase 3).';
comment on column public.bot.aquecimento_inicio is
  'Primeiro dia do chip, que é o dia 1 da rampa. A curva mora em lib/aquecimento.ts, não aqui: é política, não configuração.';
comment on column public.bot.envios_dia_max is
  'Teto de envios por dia deste chip, somando todos os canais dele. Vale do 15º dia em diante; antes, a rampa é menor.';

create unique index bot_instancia_uk
  on public.bot (operacao_id, instancia) where instancia is not null;

create index bot_operacao_idx on public.bot (operacao_id);

create trigger bot_atualizado_em
  before update on public.bot
  for each row execute function public.marca_atualizado_em();

alter table public.bot enable row level security;

-- -------------------------------------------------------------
-- RLS: só o dono, e isso é DIFERENTE de `canal`.
--
-- O operador enxerga os canais que opera, porque canal é o dia a dia
-- dele. Bot é infraestrutura do dono: qual chip, qual número, quando
-- começou a aquecer, qual variável guarda a chave. Na Fase 3, quando
-- entrarem parceiros, essa diferença é o ponto inteiro.
-- -------------------------------------------------------------
create policy bot_le on public.bot
  for select to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

create policy bot_dono on public.bot
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

-- -------------------------------------------------------------
-- O canal aponta para o bot.
--
-- `on delete restrict` de propósito: apagar o bot que o Beauty usa
-- vira erro na hora, e não canal mudo descoberto de madrugada.
-- -------------------------------------------------------------
alter table public.canal
  add column bot_id uuid references public.bot(id) on delete restrict;

create index canal_bot_idx on public.canal (bot_id);

comment on column public.canal.bot_id is
  'Quem publica neste canal. O teto de envios é contado por bot, e não por canal, porque é o número que cai.';

-- -------------------------------------------------------------
-- `whatsapp_instancia` sai.
--
-- Ela nasceu em 06/08 e nunca foi preenchida em produção: os canais de
-- WhatsApp foram criados na época em que a regra 3.2 proibia publicar,
-- então nenhum tem chip cadastrado. Sai sem migração de dados.
--
-- E sai porque texto solto não garante que a instância exista. A chave
-- estrangeira garante.
-- -------------------------------------------------------------
drop index if exists canal_whatsapp_instancia_idx;

alter table public.canal drop column if exists whatsapp_instancia;

-- -------------------------------------------------------------
-- O parâmetro global muda de papel, e a descrição precisa dizer isso.
--
-- `whatsapp_envios_dia_max` era o teto por chip. Agora quem manda é
-- `bot.envios_dia_max` passado pela rampa, e este parâmetro fica só
-- como o valor sugerido de um bot novo. Duas fontes de verdade para o
-- mesmo teto é como se descobre, tarde, que o número mandou o dobro.
-- -------------------------------------------------------------
update public.parametro
   set descricao = 'Valor SUGERIDO de envios/dia para um bot novo. O teto que vale é bot.envios_dia_max, passado pela rampa de lib/aquecimento.ts.'
 where chave = 'whatsapp_envios_dia_max';
