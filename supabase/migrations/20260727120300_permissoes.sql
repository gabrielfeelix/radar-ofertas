-- =============================================================
-- Fase 1 · permissões explícitas
--
-- As migrations anteriores ligaram RLS, o que controla QUAIS
-- LINHAS cada papel enxerga. Mas RLS só entra em ação depois que
-- o papel tem permissão na TABELA — são duas camadas diferentes,
-- e o Postgres checa a permissão primeiro.
--
-- O padrão herdado do Supabase deixou duas coisas erradas:
--
--   1. `service_role` sem SELECT/INSERT/UPDATE/DELETE. É o papel
--      que o painel usa no servidor, então nada funcionava.
--
--   2. `anon` e `authenticated` com TRUNCATE, e com EXECUTE nas
--      funções. Isso é grave: TRUNCATE apaga a tabela inteira e
--      NÃO é filtrado por RLS, e as funções são SECURITY DEFINER,
--      ou seja, rodam com o poder do dono do banco. Como a chave
--      anônima é pública por natureza — ela vai dentro do
--      JavaScript da página — qualquer pessoa poderia chamar
--      `registra_preco` e envenenar a série de preços, que é o
--      ativo do negócio.
--
-- Regra adotada daqui em diante: nenhum papel ganha nada por
-- herança. Toda permissão é escrita, com o motivo do lado.
-- =============================================================

-- -------------------------------------------------------------
-- Zera tudo que veio por padrão.
-- -------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Função no Postgres nasce com EXECUTE liberado para PUBLIC, que
-- é todo mundo. Tirar de anon e authenticated não basta: precisa
-- tirar de PUBLIC também.
revoke all on function public.registra_preco(uuid, integer, boolean, timestamptz) from public;
revoke all on function public.expurga_precos_expirados() from public;
revoke all on function public.marca_atualizado_em() from public;
revoke all on function public.preco_ponto_define_dia_local() from public;

-- Impede que tabela ou função criada em migration futura volte a
-- nascer aberta para os papéis do navegador.
alter default privileges in schema public
  revoke all on tables    from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke all on functions from anon, authenticated;

-- -------------------------------------------------------------
-- service_role — o papel do servidor.
--
-- Ignora RLS por desenho do Postgres e só é usado em código de
-- servidor (lib/supabase/servidor.ts, protegido por `server-only`).
-- Na Fase 1 é o único papel que enxerga alguma coisa.
-- -------------------------------------------------------------
grant select, insert, update, delete on
  public.marketplace,
  public.produto,
  public.anuncio,
  public.preco_ponto
to service_role;

grant select on public.anuncio_serie to service_role;

-- preco_ponto.id é identity, e identity usa sequence.
grant usage, select on all sequences in schema public to service_role;

grant execute on function public.registra_preco(uuid, integer, boolean, timestamptz) to service_role;
grant execute on function public.expurga_precos_expirados() to service_role;

-- -------------------------------------------------------------
-- anon e authenticated — nada, de propósito.
--
-- A Fase 1 não tem login. Quando a Fase 3 trouxer os papéis
-- dono, operador e parceiro, cada um ganha o SELECT do que
-- precisa, junto com as policies de RLS que filtram as linhas.
-- Até lá, o navegador não fala com o banco.
-- -------------------------------------------------------------
