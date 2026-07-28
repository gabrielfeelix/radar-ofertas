-- =============================================================
-- 11 · Row Level Security — todas as policies num arquivo só
--
-- Estão juntas de propósito: o modelo de acesso precisa poder ser
-- lido inteiro de uma vez. Espalhado por dez migrations, ninguém
-- consegue responder "quem enxerga o quê" sem reconstruir a
-- resposta na cabeça.
--
-- DUAS CAMADAS, E ELAS SÃO DIFERENTES
--
--   RLS       decide QUAIS LINHAS o papel enxerga.
--   GRANT     decide se ele pode tocar na tabela.
--
-- O Postgres checa o GRANT primeiro. Ligar RLS sem conceder nada
-- não protege — apenas esconde o erro. Os grants estão na
-- migration 12.
--
-- OS TRÊS PAPÉIS
--
--   dono      tudo, dentro da própria operação
--   operador  os canais que opera, e o que pertence a eles
--   parceiro  só o que é dele, e só leitura
--
-- A base de tudo é `operacao_atual()`: sem sessão ela devolve
-- nulo, e nulo não casa com nada — o navegador anônimo não lê uma
-- linha sequer.
--
-- NA FASE 1 ISTO AINDA NÃO ESTÁ EM USO: não existe login, e o
-- painel fala com o banco pelo servidor, com a service role, que
-- ignora RLS por desenho. As policies existem desde já porque o
-- erro clássico é criar tudo aberto e só fechar meses depois,
-- quando já vazou.
-- =============================================================

-- -------------------------------------------------------------
-- Operação
-- -------------------------------------------------------------
create policy operacao_le on public.operacao
  for select to authenticated
  using (id = public.operacao_atual());

-- -------------------------------------------------------------
-- Usuário — cada um se enxerga; o dono enxerga a equipe.
-- -------------------------------------------------------------
create policy usuario_le on public.usuario
  for select to authenticated
  using (
    id = auth.uid()
    or (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  );

create policy usuario_dono_escreve on public.usuario
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

-- -------------------------------------------------------------
-- Configuração — leitura para quem está dentro, escrita só do dono
--
-- O catálogo e os parâmetros são legíveis por todos os papéis da
-- operação. O operador precisa ver produto e anúncio para entender
-- o que está publicando; o parceiro não navega por aqui, mas ler
-- catálogo não expõe dinheiro dele nem de ninguém.
-- -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'nicho', 'marketplace', 'comissao_categoria', 'parametro',
    'produto', 'anuncio', 'preco_ponto', 'fonte_descoberta', 'mencao',
    'execucao_rotina', 'comporta_dia'
  ] loop
    -- preco_ponto e mencao não têm operacao_id próprio em toda
    -- linha; herdam pelo anúncio ou pela fonte.
    if t = 'preco_ponto' then
      execute format($p$
        create policy %1$s_le on public.%1$s for select to authenticated
        using (exists (select 1 from public.anuncio a
                        where a.id = %1$s.anuncio_id
                          and a.operacao_id = public.operacao_atual()));
      $p$, t);
      execute format($p$
        create policy %1$s_dono on public.%1$s for all to authenticated
        using (public.tem_papel('dono') and exists (
                select 1 from public.anuncio a
                 where a.id = %1$s.anuncio_id and a.operacao_id = public.operacao_atual()))
        with check (public.tem_papel('dono'));
      $p$, t);
    else
      execute format($p$
        create policy %1$s_le on public.%1$s for select to authenticated
        using (operacao_id = public.operacao_atual());
      $p$, t);
      execute format($p$
        create policy %1$s_dono on public.%1$s for all to authenticated
        using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
        with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));
      $p$, t);
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------
-- Parceiro
--
-- O parceiro enxerga a própria linha e nada da dos outros. A chave
-- de pagamento é protegida por permissão de COLUNA, na migration
-- 12 — RLS filtra linha, não coluna, e chave PIX de outra pessoa
-- aparecendo numa listagem por acidente é o tipo de vazamento que
-- acaba com uma parceria.
-- -------------------------------------------------------------
create policy parceiro_le on public.parceiro
  for select to authenticated
  using (
    operacao_id = public.operacao_atual()
    and (public.tem_papel('dono') or id = public.parceiro_atual())
  );

create policy parceiro_dono on public.parceiro
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

-- -------------------------------------------------------------
-- Canal — o recorte que define o dia a dia do operador
-- -------------------------------------------------------------
create policy canal_le on public.canal
  for select to authenticated
  using (
    operacao_id = public.operacao_atual()
    and (
      public.tem_papel('dono')
      or operador_id = auth.uid()
      or parceiro_id = public.parceiro_atual()
    )
  );

create policy canal_dono on public.canal
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

create policy canal_nicho_le on public.canal_nicho
  for select to authenticated
  using (exists (select 1 from public.canal c
                  where c.id = canal_nicho.canal_id
                    and c.operacao_id = public.operacao_atual()));

create policy canal_nicho_dono on public.canal_nicho
  for all to authenticated
  using (public.tem_papel('dono') and exists (
          select 1 from public.canal c
           where c.id = canal_nicho.canal_id and c.operacao_id = public.operacao_atual()))
  with check (public.tem_papel('dono'));

-- -------------------------------------------------------------
-- Oferta
--
-- Só o dono decide. O operador NÃO aprova nem rejeita — a D-020
-- separou os dois atos, e dar ao operador acesso de escrita aqui
-- devolveria a ele um veto de curadoria pela porta dos fundos.
--
-- Ele também não lê: nota, comissão e desconto são informação de
-- receita, e a escassez da tela dele é funcionalidade, não
-- limitação.
-- -------------------------------------------------------------
create policy oferta_dono on public.oferta
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));
