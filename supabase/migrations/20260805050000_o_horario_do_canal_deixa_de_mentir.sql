-- =============================================================
-- 65 · O horário do canal deixa de mentir
-- =============================================================
--
-- `canal.horarios_permitidos` existe desde a migration 6, o formulário
-- de canal **escreve** nele (`lib/distribuicao.ts`), o dono preenche na
-- tela, e o publicador **nunca leu**. `grep -rn horarios_permitidos
-- scripts/` não devolvia nada.
--
-- Isso é pior que código morto: é interface mentindo. Quem abre a tela
-- de canal vê um campo de horário, preenche, e nada acontece.
--
-- OS DOIS CAMINHOS ERAM RUINS SOZINHOS:
--
--   só fazer o código ler   →  os sete canais estão com `{7,12,20}`, e
--                              cairiam para TRÊS horas por dia
--   só apagar a coluna      →  o formulário quebra, e some um controle
--                              que um dia vai fazer falta
--
-- ENTÃO OS DOIS JUNTOS, e nesta ordem. Esta migration abre o horário de
-- todos os canais para o dia inteiro, e só depois o publicador passa a
-- respeitar a coluna. O comportamento de hoje não muda em nada: os
-- canais já publicam a qualquer hora.
--
-- A DECISÃO DE PUBLICAR O DIA INTEIRO É DO DONO, em 04/08: *"os cara
-- posta o dia todo e fodase"*. E a leitura dos concorrentes sustenta:
-- BenchPromos, Esser Moda e Em Análise publicam a cada 4 ou 5 minutos,
-- e o alcance entre eles varia dez vezes por FOCO, não por cadência
-- (`docs/concorrentes-lidos.md`).
--
-- O que sobrou de real é o controle existir de verdade: no dia em que
-- um canal precisar de silêncio de madrugada, é uma linha na tela.

-- Literal e não `generate_series`: Postgres recusa subconsulta em
-- `default`, e a lista escrita à mão é a mesma coisa com menos mágica.
update public.canal
   set horarios_permitidos =
     '{0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23}'::integer[];

alter table public.canal
  alter column horarios_permitidos set default
    '{0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23}'::integer[];

comment on column public.canal.horarios_permitidos is
  'Horas de São Paulo em que o canal pode publicar. Lista vazia significa sem restrição. O publicador respeita desde a migration 65; antes dela a coluna existia e ninguém lia.';
