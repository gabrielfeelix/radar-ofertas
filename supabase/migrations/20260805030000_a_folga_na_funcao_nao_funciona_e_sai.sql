-- =============================================================
-- 63 · A folga da migration 62 não funciona, e por isso ela sai
-- =============================================================
--
-- A migration 62 deu `statement_timeout = 120s` às três funções de
-- detecção, para elas não morrerem no limite de oito segundos da API.
--
-- **ELA NÃO FUNCIONA.** Testado contra Postgres de verdade, nas duas
-- linguagens, antes de subir para a nuvem:
--
--   -- controle, em `language sql`
--   create function zz() returns int language sql as $$ select pg_sleep(1); select 1 $$;
--   alter function zz() set statement_timeout = '120s';
--   set statement_timeout = '200ms';
--   select zz();
--   → ERROR: canceling statement due to statement timeout
--
--   -- o mesmo em `language plpgsql`, que é a das nossas
--   → ERROR: canceling statement due to statement timeout
--
-- O motivo é o cronômetro: `statement_timeout` é armado quando a
-- consulta EXTERNA começa, e mudar o valor no meio da execução não o
-- rearma. A função pede mais tempo e o pedido chega tarde.
--
-- ISTO FICA REGISTRADO EM VEZ DE APAGADO porque é o tipo de conserto
-- que parece óbvio e é recomendado por aí. Quem tentar de novo daqui a
-- três meses merece encontrar o teste que derrubou a ideia.
--
-- ONDE O CONSERTO FOI PARAR: no `.github/workflows/coleta-horaria.yml`.
-- A detecção deixou de ser chamada por `/rest/v1/rpc/` e passou a ser
-- chamada por `psql` sobre o `SUPABASE_DB_URL`. Medido na nuvem em
-- 04/08, é uma questão de qual papel conecta:
--
--   authenticator   statement_timeout=8s   ← o que o PostgREST usa
--   authenticated   statement_timeout=8s
--   anon            statement_timeout=3s
--   postgres        (sem limite)           ← o da conexão direta
--
-- E a prova pelo outro lado, na mesma nuvem: uma consulta de 12
-- segundos por conexão direta passou.
--
-- Nada aqui muda comportamento: `reset` devolve as três funções ao
-- estado anterior à 62, e as duas juntas somam zero.

alter function public.detecta_quedas()     reset statement_timeout;
alter function public.detecta_declarados() reset statement_timeout;
alter function public.detecta_ofertas()    reset statement_timeout;

comment on function public.detecta_quedas is
  'Ofertas por queda contra a nossa leitura anterior. Chamada por conexão direta no workflow: pela API ela morre no limite de 8s do papel `authenticator` (migrations 62 e 63).';

comment on function public.detecta_declarados is
  'Ofertas pelo "de" que a loja declara. Chamada por conexão direta no workflow: pela API ela morre no limite de 8s do papel `authenticator` (migrations 62 e 63).';
