-- =============================================================
-- 69 · A audiencia do canal vira serie
--
-- POR QUE, e o motivo e o gargalo do projeto: desde 03/08 o problema
-- nao e mais sistema, e audiencia (D-056). Os sete canais publicam
-- sozinhos e quase ninguem le. O caminho decidido foi divulgacao
-- cruzada mais UM post pago de uns R$200, para medir o custo real por
-- inscrito.
--
-- Esse numero so existe se houver o ANTES gravado. Medido em 04/08 a
-- noite, quando o publicador passou a ler a audiencia sozinho:
--
--   Beauty 6 · Fitness 6 · Pet 6 · Kids 5 · Tech 5 · Geek 4 ·
--   Perfumes (masc) 4
--
-- Trinta e seis pessoas, e quase todas familia do dono. E o ponto de
-- partida, e ele precisa estar registrado com data.
--
-- UMA LINHA POR MUDANCA, e nao uma foto por dia. E o mesmo desenho da
-- serie de preco e a mesma licao da D-037: gravar o valor igual de 5 em
-- 5 minutos seria escrita desperdicada, e com sete canais de audiencia
-- pequena a serie por mudanca cabe em poucas linhas por semana.
--
-- O CUSTO DISSO e que nao existe linha para "ficou igual". Quem for
-- desenhar grafico depois tem que carregar o ultimo valor para frente,
-- que e o que a serie de preco ja faz. E o troco certo: o dia em que
-- nada muda nao e informacao.
--
-- NAO SUBSTITUI `canal.membros_estimados`. Aquela coluna continua sendo
-- o valor de AGORA, que e o que as telas /canais leem. Esta tabela e a
-- memoria. Duas perguntas diferentes, dois lugares.
-- =============================================================

create table if not exists public.canal_audiencia (
  id           bigint generated always as identity primary key,
  operacao_id  uuid    not null references public.operacao(id) on delete cascade,
  canal_id     uuid    not null references public.canal(id)    on delete cascade,

  -- Quantas pessoas o Telegram respondeu. `integer` e nao `smallint`:
  -- canal grande passa de 32 mil, e a coluna que precisa ser alterada
  -- depois custa mais do que os dois bytes economizados.
  membros      integer not null check (membros >= 0),

  -- O valor anterior, guardado junto de proposito. Sem ele, medir o
  -- salto exige ler a linha de tras, e a primeira leitura de um canal
  -- nao tem linha de tras nenhuma. Nulo aqui quer dizer "primeira vez".
  membros_antes integer check (membros_antes >= 0),

  medido_em    timestamptz not null default now(),
  criado_em    timestamptz not null default now()
);

comment on table public.canal_audiencia is
  'Serie de audiencia por canal, uma linha por MUDANCA e nao por leitura (migration 69). Escrita pelo publicador, que le `getChatMemberCount` ao fim de cada rodada. O valor de agora vive em `canal.membros_estimados`; esta tabela e a memoria, e existe para medir o antes e o depois de uma divulgacao (D-056).';

comment on column public.canal_audiencia.membros_antes is
  'O valor que havia antes desta mudanca. Nulo na primeira leitura do canal.';

-- A consulta que sempre vai ser feita e "a serie deste canal, em
-- ordem". Descendente porque olhar o recente e o caso comum.
create index if not exists canal_audiencia_por_canal
  on public.canal_audiencia (canal_id, medido_em desc);

alter table public.canal_audiencia enable row level security;

-- RLS ligado desde a primeira migration, como toda tabela deste banco.
-- Quem escreve e o publicador, que usa `service_role` e ignora RLS.
-- A leitura segue a regra dos canais: so quem enxerga o canal.
create policy canal_audiencia_le on public.canal_audiencia
  for select using (
    exists (
      select 1 from public.canal c
       where c.id = canal_audiencia.canal_id
         and c.operacao_id = public.operacao_atual()
    )
  );

-- A primeira linha de cada canal, com o que foi medido em 04/08 a
-- noite. Sem isto a serie comecaria na primeira MUDANCA, e o ponto de
-- partida, que e o que da sentido a comparacao, ficaria de fora.
insert into public.canal_audiencia (operacao_id, canal_id, membros, membros_antes)
select c.operacao_id, c.id, c.membros_estimados, null
  from public.canal c
 where c.ativo
   and c.plataforma = 'telegram'
   and c.membros_estimados is not null
   and not exists (
     select 1 from public.canal_audiencia a where a.canal_id = c.id
   );
