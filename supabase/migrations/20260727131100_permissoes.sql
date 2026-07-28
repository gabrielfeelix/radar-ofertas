-- =============================================================
-- 12 · Permissões
--
-- RLS decide QUAIS LINHAS; GRANT decide se o papel pode tocar na
-- tabela. O Postgres checa o GRANT primeiro, então RLS sem grant
-- não protege — só esconde o erro.
--
-- A migration 01 já mudou o padrão do schema para que nada nasça
-- aberto. Aqui cada acesso é concedido de forma explícita.
--
-- DUAS COLUNAS SÃO PROTEGIDAS POR PERMISSÃO DE COLUNA, e não por
-- RLS: `marketplace.afiliado_id` e `parceiro.chave_pix`.
--
-- O motivo é que RLS filtra LINHA. A linha do parceiro é
-- legitimamente visível para ele — o que não pode aparecer é a
-- chave de pagamento de OUTRO parceiro numa listagem, por
-- acidente. Isso é recorte de coluna, e o Postgres resolve
-- nativamente. Quem precisa desses valores lê por função, que
-- confere o papel.
-- =============================================================

-- -------------------------------------------------------------
-- service_role — o papel do servidor.
--
-- Ignora RLS por desenho do Postgres, e só é usado em código de
-- servidor (`lib/supabase/servidor.ts`, protegido por
-- `server-only`). Na Fase 1 é o único papel que enxerga algo.
-- -------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- -------------------------------------------------------------
-- authenticated — o navegador de quem tem sessão.
--
-- Leitura ampla, filtrada por RLS. A escrita é concedida só onde
-- o dia a dia exige, e o resto passa pelo servidor.
-- -------------------------------------------------------------
grant select on
  public.operacao, public.usuario, public.nicho, public.comissao_categoria,
  public.parametro, public.produto, public.anuncio, public.preco_ponto,
  public.canal, public.canal_nicho, public.fonte_descoberta, public.mencao,
  public.oferta, public.execucao_rotina, public.comporta_dia
to authenticated;

-- Marketplace SEM `afiliado_id`. Enumerar as colunas é chato e é
-- exatamente o ponto: acrescentar coluna nova exige decidir, de
-- novo, se o navegador pode vê-la.
grant select (
  id, operacao_id, slug, nome, comissao_padrao_pct, suporta_subid,
  subid_tamanho_max, cache_preco_max_horas, base_de_historico,
  cor_texto, cor_fundo, ativo, criado_em, atualizado_em
) on public.marketplace to authenticated;

-- Parceiro SEM `chave_pix`.
grant select (
  id, operacao_id, nome, contato, tipo, ativo, criado_em, atualizado_em
) on public.parceiro to authenticated;

-- Views herdam a permissão de quem as consulta, porque foram
-- criadas com `security_invoker`.
grant select on
  public.anuncio_serie, public.rendimento_da_fonte, public.parametro_efetivo,
  public.limiar, public.canal_capacidade, public.saude_operacao
to authenticated;

-- O dono decide ofertas pela interface: aprovar, rejeitar, adiar.
-- A policy `oferta_dono` é quem confere o papel.
grant update on public.oferta to authenticated;

-- -------------------------------------------------------------
-- Os dois valores protegidos, atrás de função que confere o papel.
-- -------------------------------------------------------------
create or replace function public.afiliado_id_do_marketplace(p_marketplace_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_valor text;
begin
  if not public.tem_papel('dono') then
    raise exception 'Só o dono pode ver o identificador de afiliado.';
  end if;

  select m.afiliado_id into v_valor
    from public.marketplace m
   where m.id = p_marketplace_id and m.operacao_id = public.operacao_atual();

  return v_valor;
end;
$$;

comment on function public.afiliado_id_do_marketplace is
  'É dinheiro: se vazar, outra pessoa usa os seus links. Só o dono lê.';

create or replace function public.chave_pix_do_parceiro(p_parceiro_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_valor text;
begin
  if not public.tem_papel('dono') then
    raise exception 'Só o dono pode ver a chave de pagamento.';
  end if;

  select p.chave_pix into v_valor
    from public.parceiro p
   where p.id = p_parceiro_id and p.operacao_id = public.operacao_atual();

  return v_valor;
end;
$$;

comment on function public.chave_pix_do_parceiro is
  'A chave de pagamento nunca aparece para outro parceiro, nem em listagem, nem por acidente.';

-- -------------------------------------------------------------
-- Execução de função.
--
-- Nada é concedido a `anon` nem a `authenticated`: todas as
-- funções de escrita são SECURITY DEFINER e rodam com o poder do
-- dono do banco. Chamáveis pelo navegador, seriam o furo mais
-- caro do sistema — a chave anônima viaja dentro do JavaScript
-- da página.
-- -------------------------------------------------------------
grant execute on function public.hoje() to service_role, authenticated;
grant execute on function public.operacao_atual() to service_role, authenticated;
grant execute on function public.tem_papel(text) to service_role, authenticated;
grant execute on function public.parceiro_atual() to service_role, authenticated;
grant execute on function public.parametro(text, uuid) to service_role, authenticated;
grant execute on function public.avalia_anuncios(uuid[]) to service_role;
grant execute on function public.avalia_anuncio(uuid) to service_role, authenticated;
grant execute on function public.detecta_ofertas() to service_role;
grant execute on function public.registra_preco(uuid, integer, boolean, timestamptz) to service_role;
grant execute on function public.registra_mencao(uuid, bigint, text, text, text, text, text, integer, timestamptz) to service_role;
grant execute on function public.expurga_precos_expirados() to service_role;
grant execute on function public.compacta_serie_antiga() to service_role;
grant execute on function public.expira_ofertas() to service_role;
grant execute on function public.manutencao_diaria() to service_role;
grant execute on function public.abre_execucao(text) to service_role;
grant execute on function public.fecha_execucao(uuid, boolean, jsonb, text) to service_role;
grant execute on function public.afiliado_id_do_marketplace(uuid) to service_role, authenticated;
grant execute on function public.chave_pix_do_parceiro(uuid) to service_role, authenticated;
