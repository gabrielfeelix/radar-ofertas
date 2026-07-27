-- =============================================================
-- Correção de segurança: função nova nascia aberta para PUBLIC
--
-- A migration 20260727120300 fechou as tabelas e revogou os
-- privilégios padrão de `anon` e `authenticated`. Faltou o
-- essencial: no Postgres, **função nasce com EXECUTE concedido a
-- PUBLIC**, e PUBLIC não é um papel — é todo mundo, inclusive
-- `anon`. Revogar de `anon` não tira nada, porque o acesso vem
-- por PUBLIC.
--
-- Resultado prático do furo: as funções criadas na migration do
-- motor de validação ficaram chamáveis pela chave anônima, que é
-- pública por natureza. Como são SECURITY DEFINER, rodariam com
-- o poder do dono do banco — `detecta_ofertas()` escreve na
-- tabela `oferta`, e `parametro()` expõe os limiares da curadoria.
--
-- Esta migration fecha o que está aberto e, mais importante,
-- muda o padrão para que nenhuma função futura volte a nascer
-- assim.
-- =============================================================

-- -------------------------------------------------------------
-- Fecha o que já existe.
-- -------------------------------------------------------------
revoke all on function public.parametro(text) from public;
revoke all on function public.avalia_anuncio(uuid) from public;
revoke all on function public.detecta_ofertas() from public;

-- -------------------------------------------------------------
-- Muda o padrão. Sem isto, a próxima função criada repete o furo,
-- e o furo só apareceria numa auditoria — ou num incidente.
--
-- Vale para objetos criados pelo papel que roda as migrations.
-- -------------------------------------------------------------
alter default privileges in schema public
  revoke execute on functions from public;

-- -------------------------------------------------------------
-- Reconcede explicitamente a quem precisa.
--
-- Regra que passa a valer no projeto: toda migration que criar
-- função termina com o `grant execute` para `service_role`. Se
-- esquecer, a função simplesmente não é chamável pelo servidor —
-- falha barulhenta, que é o modo certo de falhar.
-- -------------------------------------------------------------
grant execute on function public.parametro(text) to service_role;
grant execute on function public.avalia_anuncio(uuid) to service_role;
grant execute on function public.detecta_ofertas() to service_role;
