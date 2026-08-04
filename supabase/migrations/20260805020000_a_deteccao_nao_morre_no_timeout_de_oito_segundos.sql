-- =============================================================
-- 62 · A detecção para de morrer no timeout de oito segundos
-- =============================================================
--
-- O QUE ACONTECIA, medido no log do Actions em 04/08. Duas execuções da
-- `coleta-horaria` falharam, e as duas do mesmo jeito:
--
--   13:09:16.37  detecta_quedas: [{"avaliados":35,"aprovados":35}]
--   13:09:24.69  curl: (22) The requested URL returned error: 500
--
--   16:17:08.31  detecta_quedas: [{"avaliados":43,"aprovados":43}]
--   16:17:16.60  curl: (22) The requested URL returned error: 500
--
-- **8,32 s e 8,29 s.** Oito segundos cravados nas duas não é erro de
-- lógica, é o `statement_timeout` que o PostgREST aplica às chamadas da
-- API. A função é morta no meio, o PostgREST devolve 500, e o `curl
-- --fail-with-body` engole o corpo do erro — que é por que a mensagem no
-- log não diz nada.
--
-- CONFIRMADO PELO OUTRO LADO: chamando as duas funções à mão em 04/08,
-- logo depois de uma rodada bem-sucedida, elas responderam em 1,84 s e
-- 0,13 s. Não é lentidão constante, é lentidão sob carga: quanto mais
-- anúncio novo entrou na coleta, mais linha `avalia_anuncios` percorre.
--
-- O ESTRAGO É MAIOR DO QUE PERDER UMA DETECÇÃO. O passo roda com
-- `set -euo pipefail`, então o 500 derruba o job inteiro e os passos
-- seguintes nem começam: **a colheita de cupom e a reserva do publicador
-- não rodaram nessas duas horas.** Uma função lenta calou três coisas.
--
-- E ISTO IA PIORAR. A D-066 fez a cota diária da coleta ir para os
-- nichos que têm canal, o que multiplica por três o catálogo publicável.
-- Mais anúncio vivo é exatamente o que empurra estas funções para cima
-- dos oito segundos.
--
-- O CONSERTO É O LIMITE, NÃO A FUNÇÃO. `alter function ... set
-- statement_timeout` vale só durante a execução dela, e volta ao normal
-- depois. Nenhuma outra consulta da API ganha folga por isso.
--
-- Dois minutos, e não "sem limite": função de detecção que passe disso
-- tem outro problema, e timeout infinito trocaria falha visível por
-- execução pendurada. A D-015 escolheu falhar alto de propósito.

alter function public.detecta_quedas()     set statement_timeout = '120s';
alter function public.detecta_declarados() set statement_timeout = '120s';

-- A mesma folga para a avaliação em massa, que é a função pesada por
-- baixo das duas e é chamada pela tela de curadoria.
alter function public.detecta_ofertas()    set statement_timeout = '120s';

comment on function public.detecta_quedas is
  'Ofertas por queda contra a nossa leitura anterior. `statement_timeout` próprio: o limite de 8s da API a matava sob carga (migration 62).';

comment on function public.detecta_declarados is
  'Ofertas pelo "de" que a loja declara. `statement_timeout` próprio: o limite de 8s da API a matava sob carga (migration 62).';
