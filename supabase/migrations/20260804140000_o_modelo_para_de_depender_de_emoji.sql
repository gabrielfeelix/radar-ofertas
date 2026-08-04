-- =============================================================
-- 51 · O corpo do modelo para de depender de emoji para ser consertado
--
-- DUAS MIGRATIONS NUNCA SE APLICARAM NUM BANCO NOVO, e ninguém viu
-- porque na nuvem elas casaram.
--
-- O corpo do modelo é construído por migrations encadeadas, e cada uma
-- procura o texto que a anterior deixou. A cadeia quebra assim:
--
--   14  identificação  →  o corpo termina em `👉 {link}`
--   27  frete          →  insere `{frete}` antes de `{link}`, e o emoji
--                         gruda no lugar errado: `👉 {frete}` + `{link}`
--   28  conserta frete →  NÃO APLICA. Ela procura `🛒 {frete}`
--   49  link clicável  →  NÃO APLICA. Ela procura `🛒 {link}`
--
-- Conferido em 04/08 contra os dois bancos. No local, com as 55
-- migrations aplicadas do zero, o corpo termina assim:
--
--   {vendedor}
--   👉 {frete}
--
--   {link}
--
-- Que é exatamente o defeito que a migration 28 existe para consertar
-- ("a mensagem sai com o emoji colado no frete e um link sem nada"),
-- vivo e não consertado. E o link não é clicável.
--
-- Na nuvem o corpo termina em `🛒 <a href="{link}">Compre aqui</a>`,
-- porque em algum momento alguém editou o modelo à mão pelo painel e
-- pôs o 🛒. As migrations 28 e 49 foram escritas contra esse texto
-- editado, e por isso pareceram funcionar.
--
-- O ESTRAGO NÃO É EM PRODUÇÃO, é na conferência. `pnpm telas` e
-- qualquer teste local exercitam uma mensagem que não é a que sai. E o
-- dia em que isto cobra caro é o da restauração de um backup ou o da
-- mudança para VPS (D-055), quando o banco é recriado do zero.
--
-- POR QUE ESTA É ESCRITA POR POSIÇÃO DE VARIÁVEL, E NÃO POR EMOJI
--
-- A lição das duas é a mesma: casar por enfeite é casar com o que o
-- dono pode trocar a qualquer momento pelo painel. As duas condições
-- abaixo olham só para `{frete}` e `{link}`, que são contrato do
-- código, e ambas são NO-OP em quem já está certo — a da nuvem
-- inclusive.
-- =============================================================

-- 1. Tira o que grudou antes do `{frete}`.
--
-- A migration 27 fez `replace(corpo, '{link}', '{frete}\n\n{link}')`,
-- e o que estivesse colado ao `{link}` passou a preceder o `{frete}`.
-- Era `🛒` num banco e `👉` no outro; a condição aqui não nomeia
-- nenhum dos dois, olha só para "tem alguma coisa colada".
update public.modelo_mensagem
   set corpo = regexp_replace(corpo, '(^|\n)[^\n]*?[ ]\{frete\}', '\1{frete}'),
       atualizado_em = now()
 where corpo ~ '(^|\n)[^\n]*?[ ]\{frete\}';

-- 2. O link vira âncora, se ainda não for uma.
--
-- A guarda é `not like '%<a href%'`, então a nuvem, que já tem a
-- âncora desde a migration 49, não é tocada.
update public.modelo_mensagem
   set corpo = replace(corpo, '{link}', '🛒 <a href="{link}">Compre aqui</a>'),
       atualizado_em = now()
 where position('{link}' in corpo) > 0
   and corpo not like '%<a href%';

comment on column public.modelo_mensagem.corpo is
  'O texto da mensagem. Precisa conter identificacao publicitaria nas primeiras linhas (regra 3.10) e as chaves {lastro} e {link}. Migration que mexer aqui deve casar por VARIAVEL, nunca por emoji: o emoji e editavel pelo painel, e foi assim que as migrations 28 e 49 deixaram de se aplicar em banco novo.';
