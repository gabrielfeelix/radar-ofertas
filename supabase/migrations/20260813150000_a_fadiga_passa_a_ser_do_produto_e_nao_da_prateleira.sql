-- =============================================================
-- A FADIGA PASSA A SER DO PRODUTO, E NAO DA PRATELEIRA
--
-- MEDIDO NO PROPRIO GRUPO, em 13/08, lendo as 80 ultimas
-- publicacoes do Radar Delas no WhatsApp:
--
--   08-12 23:54  R$ 399  Secador Philco psc3500 4 Em 1  (anuncio 92dbd220)
--   08-12 23:02  R$ 379  Secador Philco psc3500 4 Em 1  (anuncio 756a7c67)
--
-- O MESMO produto, duas vezes, com 52 minutos entre um e outro.
-- Nenhuma comporta reprovou porque `dias_recompra_mesmo_anuncio`
-- e, literalmente, do ANUNCIO: a CTE `recente` guardava
-- `oferta.anuncio_id`, e sao dois anuncios diferentes.
--
-- E SAO DOIS ANUNCIOS DE PROPOSITO. O Mercado Livre cadastra o
-- mesmo item em varias prateleiras, e desde a migration 30 elas
-- sao anuncios do MESMO `produto_id` -- foi exatamente para isso
-- que `melhor_anuncio_do_produto` nasceu. A unificacao do produto
-- aconteceu; a comporta de fadiga ficou para tras, olhando a
-- prateleira.
--
-- QUEM LE O GRUPO NAO VE PRATELEIRA, ve produto. Para a pessoa do
-- outro lado, o post das 23h02 e o das 23h54 sao o mesmo secador
-- duas vezes na mesma hora, e repeticao e uma das cinco causas de
-- morte de um grupo (`docs/pesquisa-operacao.md`).
--
-- O QUE MUDA: uma linha e meia. `recente` passa a bloquear por
-- `produto_id`. O parametro continua sendo o mesmo
-- (`dias_recompra_mesmo_anuncio`, 30 dias) e o motivo continua
-- sendo `publicado_recentemente`: o numero e o nome nao mudaram,
-- so o que conta como "o mesmo".
--
-- Produto nulo nao existe (`anuncio.produto_id` e obrigatorio),
-- entao nao ha o caso de o join derrubar linha.
-- =============================================================

create or replace function public.avalia_anuncios(p_anuncio_ids uuid[] default null)
returns table (
  anuncio_id                 uuid,
  operacao_id                uuid,
  aprovada                   boolean,
  motivos                    text[],
  preco_atual_centavos       integer,
  preco_referencia_centavos  integer,
  referencia_janela_dias     integer,
  dias_de_serie              integer,
  desconto_pct               numeric,
  comissao_estimada_centavos integer,
  pode_afirmar_minimo        boolean,
  recorrencia_pct            numeric,
  nota                       numeric,
  nota_desconto              numeric,
  nota_comissao              numeric,
  nota_vendedor              numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with alvo as (
    select a.id, a.produto_id, a.operacao_id, a.ativo, a.avaliacao, a.avaliacao_qtd,
           a.reputacao_vendedor, a.loja_oficial, a.marketplace_id,
           pr.nicho_id, pr.categoria, m.base_de_historico, m.comissao_padrao_pct
      from public.anuncio a
      join public.produto pr    on pr.id = a.produto_id
      join public.marketplace m on m.id  = a.marketplace_id
     where case
             when p_anuncio_ids is null then a.ativo and m.ativo and m.base_de_historico
             else a.id = any(p_anuncio_ids)
           end
  ),
  -- Limiares do nicho do produto; a linha nula atende produto sem
  -- classificação, que ainda assim precisa ser avaliável.
  com_limiar as (
    -- Colunas explícitas, e não `l.*`: `limiar` também tem
    -- `nicho_id`, e `alvo.* , l.*` deixaria a referência ambígua.
    select alvo.*,
           l.dias_minimos_de_serie, l.dias_para_afirmar,
           l.janela_referencia_dias, l.janela_minimo_dias,
           l.desconto_minimo_pct, l.comissao_minima_centavos,
           l.avaliacao_minima, l.avaliacao_qtd_minima, l.reputacao_minima,
           l.dias_recompra, l.recorrencia_maxima_pct, l.tolerancia_alta_pct
      from alvo
      join public.limiar l on l.nicho_id is not distinct from alvo.nicho_id
  ),
  ultimo as (
    select distinct on (pp.anuncio_id)
           pp.anuncio_id, pp.preco_centavos, pp.disponivel, pp.dia_local
      from public.preco_ponto pp
      join alvo on alvo.id = pp.anuncio_id
     order by pp.anuncio_id, pp.coletado_em desc
  ),
  -- Mediana da janela SEM o dia de hoje: incluir hoje puxaria a
  -- referência para baixo junto com a promoção, e o desconto
  -- apareceria menor do que é.
  referencia as (
    select cl.id as anuncio_id,
           (percentile_cont(0.5) within group (order by pp.preco_centavos))::int as mediana,
           count(distinct pp.dia_local)::int as dias
      from com_limiar cl
      join public.preco_ponto pp on pp.anuncio_id = cl.id
     where pp.dia_local >= public.hoje() - cl.janela_referencia_dias
       and pp.dia_local <  public.hoje()
     group by cl.id
  ),
  -- Menor preço da janela longa, e em que fração dos dias o
  -- anúncio já esteve neste patamar (D-024).
  historico as (
    select cl.id as anuncio_id,
           min(pp.preco_centavos)::int as menor,
           count(distinct pp.dia_local)::int as dias_janela,
           count(distinct pp.dia_local) filter (
             where pp.preco_centavos <= coalesce(u.preco_centavos, 0)
                                        * (1 + cl.tolerancia_alta_pct / 100)
           )::int as dias_neste_patamar
      from com_limiar cl
      join public.preco_ponto pp on pp.anuncio_id = cl.id
      left join ultimo u on u.anuncio_id = cl.id
     where pp.dia_local >= public.hoje() - cl.janela_minimo_dias
     group by cl.id
  ),
  -- A FADIGA E DO PRODUTO. Ver o cabecalho desta migration: o
  -- mesmo secador saiu duas vezes em 52 minutos porque o ML o
  -- cadastra em duas prateleiras, e a comporta olhava a
  -- prateleira. Agora um anuncio e bloqueado quando QUALQUER
  -- anuncio do mesmo produto virou oferta na janela de recompra.
  recente as (
    select distinct a.produto_id
      from public.oferta o
      join public.anuncio a on a.id = o.anuncio_id
      -- O JOIN E POR PRODUTO, e nao pelo id do anuncio. Fosse pelo
      -- id, uma oferta da prateleira B so contaria se a propria B
      -- estivesse sendo avaliada nesta passada -- e a prateleira
      -- que repetiu o secador de 12/08 podia perfeitamente estar
      -- fora dela. O que importa e que o PRODUTO saiu, seja qual
      -- for a prateleira que o levou.
      join com_limiar cl    on cl.produto_id = a.produto_id
     where o.status in ('nova', 'aprovada')
       and o.detectada_em > now() - make_interval(days => cl.dias_recompra)
  ),
  comissao as (
    -- Nulo aqui significa NÃO CONFIGURADA, e é diferente de zero.
    -- A distinção vira motivo próprio lá embaixo: "comissão baixa"
    -- manda ajustar limiar; "não configurada" manda preencher a
    -- tabela. Confundir os dois faz o dono caçar o problema errado.
    select cl.id, coalesce(cc.percentual, cl.comissao_padrao_pct) as pct
      from com_limiar cl
      left join public.comissao_categoria cc
        on cc.marketplace_id = cl.marketplace_id
       and cc.nicho_id       = cl.nicho_id
       and cc.vigente_ate is null
  ),
  base as (
    select
      cl.*,
      u.preco_centavos, u.disponivel, u.dia_local,
      coalesce(r.mediana, 0) as mediana,
      coalesce(r.dias, 0)    as dias_serie,
      h.menor                as menor_janela,
      case when coalesce(h.dias_janela, 0) > 0
           then round(h.dias_neste_patamar::numeric / h.dias_janela * 100, 2)
           else 0 end        as recorrencia,
      c.pct as comissao_pct,
      case when c.pct is null then null
           else floor(coalesce(u.preco_centavos, 0) * c.pct / 100)::int end as comissao,
      case when coalesce(r.mediana, 0) > 0 and u.preco_centavos is not null
           then round(((r.mediana - u.preco_centavos)::numeric / r.mediana) * 100, 2)
           else 0 end        as desconto,
      (rec.produto_id is not null) as ja_publicado
    from com_limiar cl
    left join ultimo     u   on u.anuncio_id   = cl.id
    left join referencia r   on r.anuncio_id   = cl.id
    left join historico  h   on h.anuncio_id   = cl.id
    left join recente    rec on rec.produto_id = cl.produto_id
    join      comissao   c   on c.id           = cl.id
  ),
  julgado as (
    select
      b.id, b.operacao_id,
      array_remove(array[
        case when not b.ativo             then 'anuncio_inativo' end,
        -- Amazon: pela D-003 não acumula série, logo não há
        -- referência honesta para comparar.
        case when not b.base_de_historico then 'loja_sem_historico' end,
        case when b.preco_centavos is null then 'sem_preco_coletado' end,
        -- Produto esgotado não é oferta. Publicar isso queima o
        -- canal mais rápido que preço errado.
        case when b.disponivel is false   then 'indisponivel' end,
        case when b.dia_local is not null and b.dia_local < public.hoje() - 1
             then 'preco_desatualizado' end,
        case when b.mediana <= 0          then 'sem_referencia_de_preco' end,
        case when b.dias_serie < b.dias_minimos_de_serie
             then format('serie_curta(%s_de_%s_dias)', b.dias_serie, b.dias_minimos_de_serie) end,
        case when b.mediana > 0 and b.preco_centavos is not null
              and b.desconto < b.desconto_minimo_pct
             then format('desconto_insuficiente(%s%%)', b.desconto) end,
        -- Não é o menor da janela longa: a mensagem prometeria o
        -- que o dado não sustenta.
        case when b.menor_janela is not null and b.preco_centavos is not null
              and b.preco_centavos > b.menor_janela * (1 + b.tolerancia_alta_pct / 100)
             then format('nao_e_o_menor(%s_vs_%s)', b.preco_centavos, b.menor_janela) end,
        -- D-024: se ele vive neste preço, não é oferta — é o preço
        -- normal com etiqueta de promoção.
        case when b.recorrencia > b.recorrencia_maxima_pct
             then format('preco_recorrente(%s%%_dos_dias)', b.recorrencia) end,
        case when b.comissao_pct is null
             then 'comissao_nao_configurada' end,
        case when b.comissao is not null and b.comissao < b.comissao_minima_centavos
             then format('comissao_baixa(%s_centavos)', b.comissao) end,
        -- Nota só conta com amostra suficiente: 5,0 com duas
        -- avaliações não diz nada, e reprovar por ela seria pior
        -- que ignorá-la.
        case when b.avaliacao is not null
              and coalesce(b.avaliacao_qtd, 0) >= b.avaliacao_qtd_minima
              and b.avaliacao < b.avaliacao_minima
             then format('produto_mal_avaliado(%s)', b.avaliacao) end,
        case when b.reputacao_vendedor is not null
              and b.reputacao_vendedor < b.reputacao_minima
             then format('vendedor_fraco(%s)', b.reputacao_vendedor) end,
        case when b.ja_publicado          then 'publicado_recentemente' end
      ], null) as motivos,
      coalesce(b.preco_centavos, 0) as preco_atual,
      b.mediana,
      b.janela_referencia_dias,
      b.dias_serie,
      b.desconto,
      b.comissao,
      (b.dias_serie >= b.dias_para_afirmar) as pode_afirmar,
      b.recorrencia,
      -- NOTA, escala cheia de 100 (do design):
      --   desconto  50 · teto em 40% de queda
      --   comissão  30 · teto em R$ 10
      --   vendedor  20
      --
      -- Fadiga não gasta ponto de propósito: ela já é COMPORTA.
      -- Produto repetido é bloqueado, não recebe nota menor —
      -- repetição não é oferta pior, é oferta que não deve sair.
      round(least(greatest(b.desconto, 0), 40) / 40 * 50, 2)   as n_desc,
      round(least(coalesce(b.comissao, 0), 1000)::numeric / 1000 * 30, 2) as n_com,
      round(20 * (
        -- Sem informação entra como neutro: nem prêmio nem castigo
        -- por a API da loja ser pobre.
        0.5 * coalesce(case when coalesce(b.avaliacao_qtd, 0) >= b.avaliacao_qtd_minima
                            then b.avaliacao / 5.0 end, 0.5)
        + 0.3 * coalesce(b.reputacao_vendedor, 0.5)
        + 0.2 * case when coalesce(b.loja_oficial, false) then 1.0 else 0.5 end
      ), 2)                                                     as n_vend
    from base b
  )
  select
    j.id, j.operacao_id,
    (array_length(j.motivos, 1) is null),
    j.motivos,
    j.preco_atual, j.mediana, j.janela_referencia_dias, j.dias_serie,
    j.desconto, j.comissao, j.pode_afirmar, j.recorrencia,
    round(j.n_desc + j.n_com + j.n_vend, 2),
    j.n_desc, j.n_com, j.n_vend
  from julgado j;
$$;

comment on function public.avalia_anuncios is
  'A regra da curadoria, em uma passada. Sem lista, o catalogo elegivel; com lista, os ids dados. A fadiga e por produto.';
