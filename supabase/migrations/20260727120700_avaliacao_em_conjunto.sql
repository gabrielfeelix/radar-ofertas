-- =============================================================
-- Avaliação em conjunto — mesma regra, uma passada só
--
-- A primeira versão do detector chamava `avalia_anuncio` num laço,
-- um anúncio por vez. Cada chamada fazia cinco consultas e lia oito
-- parâmetros. Com 150 anúncios isso é irrelevante; com os milhares
-- que a colheita vai trazer (D-012), são dezenas de milhares de
-- consultas por execução, e a detecção estoura o tempo limite.
--
-- A tentação óbvia seria escrever um detector rápido em conjunto e
-- manter a função por anúncio para explicar o veredito na tela. Isso
-- criaria DUAS implementações da mesma regra, que divergem no
-- primeiro ajuste de limiar — e aí a tela passa a explicar uma coisa
-- e o sistema a fazer outra. É o pior tipo de bug: silencioso e que
-- destrói a confiança na curadoria.
--
-- A saída é ter uma implementação só, que já nasce em conjunto:
--
--   avalia_anuncios(ids)  — a regra. Avalia N anúncios numa passada.
--   avalia_anuncio(id)    — casca fina por cima, para a tela.
--   detecta_ofertas()     — usa a versão em conjunto.
-- =============================================================

create or replace function public.avalia_anuncios(p_anuncio_ids uuid[] default null)
returns table (
  anuncio_id                 uuid,
  aprovada                   boolean,
  motivos                    text[],
  preco_atual_centavos       integer,
  preco_referencia_centavos  integer,
  referencia_janela_dias     integer,
  dias_de_serie              integer,
  desconto_pct               numeric,
  comissao_estimada_centavos integer,
  nota                       numeric,
  nota_desconto              numeric,
  nota_comissao              numeric,
  nota_qualidade             numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with par as (
    select
      max(valor) filter (where chave = 'janela_referencia_dias')::int      as janela,
      max(valor) filter (where chave = 'dias_minimos_de_serie')::int       as dias_min,
      max(valor) filter (where chave = 'desconto_minimo_pct')              as desc_min,
      max(valor) filter (where chave = 'comissao_minima_centavos')::int    as com_min,
      max(valor) filter (where chave = 'avaliacao_minima')                 as aval_min,
      max(valor) filter (where chave = 'avaliacao_qtd_minima')::int        as aval_qtd,
      max(valor) filter (where chave = 'reputacao_minima')                 as rep_min,
      max(valor) filter (where chave = 'dias_recompra_mesmo_anuncio')::int as recompra
    from public.parametro
  ),
  hoje as (
    select (now() at time zone 'America/Sao_Paulo')::date as d
  ),

  -- Sem lista de ids, o alvo é o catálogo elegível: ativo e de loja
  -- que forma histórico. É o que o detector diário quer.
  -- Com lista, avalia exatamente o que foi pedido, mesmo inativo —
  -- é o que a tela quer, para poder explicar por que não passou.
  alvo as (
    select a.id, a.ativo, a.avaliacao, a.avaliacao_qtd, a.reputacao_vendedor,
           a.loja_oficial, a.marketplace_id, pr.categoria,
           m.base_de_historico, m.comissao_padrao_pct
      from public.anuncio a
      join public.produto pr    on pr.id = a.produto_id
      join public.marketplace m on m.id  = a.marketplace_id
     where case
             when p_anuncio_ids is null then a.ativo and m.ativo and m.base_de_historico
             else a.id = any(p_anuncio_ids)
           end
  ),

  -- Preço mais recente por anúncio. O índice
  -- (anuncio_id, coletado_em desc) atende o distinct on direto.
  ultimo as (
    select distinct on (pp.anuncio_id)
           pp.anuncio_id, pp.preco_centavos, pp.disponivel, pp.dia_local
      from public.preco_ponto pp
      join alvo on alvo.id = pp.anuncio_id
     order by pp.anuncio_id, pp.coletado_em desc
  ),

  -- Mediana da janela, SEM o dia de hoje: incluir hoje puxaria a
  -- referência para baixo junto com a promoção, e o desconto
  -- apareceria menor do que é.
  referencia as (
    select pp.anuncio_id,
           (percentile_cont(0.5) within group (order by pp.preco_centavos))::int as mediana,
           count(distinct pp.dia_local)::int as dias
      from public.preco_ponto pp
      join alvo on alvo.id = pp.anuncio_id
     cross join par
     cross join hoje
     where pp.dia_local >= hoje.d - par.janela
       and pp.dia_local <  hoje.d
     group by pp.anuncio_id
  ),

  -- Fadiga: mesmo anúncio publicado há pouco cansa, e membro
  -- cansado sai do canal.
  recente as (
    select distinct o.anuncio_id
      from public.oferta o
     cross join par
     where o.status in ('nova', 'aprovada')
       and o.detectada_em > now() - make_interval(days => par.recompra)
  ),

  comissao as (
    select alvo.id,
           coalesce(cc.percentual, alvo.comissao_padrao_pct, 0) as pct
      from alvo
      left join public.comissao_categoria cc
        on cc.marketplace_id = alvo.marketplace_id
       and cc.categoria      = alvo.categoria
       and cc.vigente_ate is null
  ),

  base as (
    select
      alvo.*,
      u.preco_centavos,
      u.disponivel,
      u.dia_local,
      coalesce(r.mediana, 0) as mediana,
      coalesce(r.dias, 0)    as dias_serie,
      floor(coalesce(u.preco_centavos, 0) * c.pct / 100)::int as comissao,
      case
        when coalesce(r.mediana, 0) > 0 and u.preco_centavos is not null
        then round(((r.mediana - u.preco_centavos)::numeric / r.mediana) * 100, 2)
        else 0
      end as desconto,
      (rec.anuncio_id is not null) as ja_publicado
    from alvo
    left join ultimo     u   on u.anuncio_id   = alvo.id
    left join referencia r   on r.anuncio_id   = alvo.id
    left join recente    rec on rec.anuncio_id = alvo.id
    join      comissao   c   on c.id           = alvo.id
  ),

  julgado as (
    select
      b.id,
      array_remove(array[
        case when not b.ativo             then 'anuncio_inativo' end,
        -- Amazon. Pela D-003 não acumula série, então não há
        -- referência honesta para comparar.
        case when not b.base_de_historico then 'loja_sem_historico' end,
        case when b.preco_centavos is null then 'sem_preco_coletado' end,
        -- Produto esgotado não é oferta. Publicar isso queima o
        -- canal mais rápido que preço errado.
        case when b.disponivel is false   then 'indisponivel' end,
        -- Preço de três dias atrás pode já ter subido.
        case when b.dia_local is not null and b.dia_local < hoje.d - 1
             then 'preco_desatualizado' end,
        case when b.mediana <= 0          then 'sem_referencia_de_preco' end,
        -- Comporta 2, lastro. Regra 3.4 do AGENTS.md.
        case when b.dias_serie < par.dias_min
             then format('serie_curta(%s_de_%s_dias)', b.dias_serie, par.dias_min) end,
        case when b.mediana > 0 and b.preco_centavos is not null and b.desconto < par.desc_min
             then format('desconto_insuficiente(%s%%)', b.desconto) end,
        -- Comporta 1, qualidade e retorno.
        case when b.comissao < par.com_min
             then format('comissao_baixa(%s_centavos)', b.comissao) end,
        -- Nota só conta com amostra suficiente: 5,0 com duas
        -- avaliações não diz nada, e reprovar por ela seria pior
        -- que ignorá-la.
        case when b.avaliacao is not null
              and coalesce(b.avaliacao_qtd, 0) >= par.aval_qtd
              and b.avaliacao < par.aval_min
             then format('produto_mal_avaliado(%s)', b.avaliacao) end,
        case when b.reputacao_vendedor is not null and b.reputacao_vendedor < par.rep_min
             then format('vendedor_fraco(%s)', b.reputacao_vendedor) end,
        case when b.ja_publicado          then 'publicado_recentemente' end
      ], null) as motivos,
      coalesce(b.preco_centavos, 0) as preco_atual,
      b.mediana,
      par.janela,
      b.dias_serie,
      b.desconto,
      b.comissao,
      -- Escala de 0 a 100, teto real 80: os 20 pontos de fadiga de
      -- canal e desempenho por categoria dependem de canal, que é da
      -- Fase 2. Ficam reservados para a nota de hoje continuar
      -- comparável com a de amanhã.
      round(least(greatest(b.desconto, 0), 40), 2)              as n_desc,
      round(least(b.comissao, 1500)::numeric / 1500 * 25, 2)    as n_com,
      round(15 * (
        -- Sem informação entra como neutro. Nem prêmio nem castigo
        -- por a API da loja ser pobre.
        0.5 * coalesce(case when coalesce(b.avaliacao_qtd, 0) >= par.aval_qtd
                            then b.avaliacao / 5.0 end, 0.5)
        + 0.3 * coalesce(b.reputacao_vendedor, 0.5)
        + 0.2 * case when coalesce(b.loja_oficial, false) then 1.0 else 0.5 end
      ), 2)                                                      as n_qual
    from base b
    cross join par
    cross join hoje
  )
  select
    j.id,
    (array_length(j.motivos, 1) is null),
    j.motivos,
    j.preco_atual,
    j.mediana,
    j.janela,
    j.dias_serie,
    j.desconto,
    j.comissao,
    round(j.n_desc + j.n_com + j.n_qual, 2),
    j.n_desc,
    j.n_com,
    j.n_qual
  from julgado j;
$$;

comment on function public.avalia_anuncios is
  'A regra da curadoria, em uma passada. Sem lista, avalia o catálogo elegível; com lista, exatamente os ids dados.';

-- -------------------------------------------------------------
-- Casca fina para a tela. Não repete regra nenhuma.
-- -------------------------------------------------------------
create or replace function public.avalia_anuncio(p_anuncio_id uuid)
returns table (
  anuncio_id                 uuid,
  aprovada                   boolean,
  motivos                    text[],
  preco_atual_centavos       integer,
  preco_referencia_centavos  integer,
  referencia_janela_dias     integer,
  dias_de_serie              integer,
  desconto_pct               numeric,
  comissao_estimada_centavos integer,
  nota                       numeric,
  nota_desconto              numeric,
  nota_comissao              numeric,
  nota_qualidade             numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.avalia_anuncios(array[p_anuncio_id]);
$$;

comment on function public.avalia_anuncio is
  'Veredito de um anúncio, para a tela responder "por que essa oferta não apareceu?".';

-- -------------------------------------------------------------
-- Detector: uma passada, um INSERT.
-- -------------------------------------------------------------
-- Instrução única, sem tabela temporária.
--
-- A primeira versão usava `create temp table ... on commit drop`,
-- que só é descartada no commit — então duas chamadas dentro da
-- mesma transação quebravam com "relation already exists". Em
-- produção passaria despercebido, porque o agendador chama uma vez
-- por transação; apareceria no dia em que alguém rodasse a
-- manutenção duas vezes, ou depurasse à mão.
--
-- `as materialized` garante que a avaliação roda uma vez só, mesmo
-- sendo referenciada duas vezes abaixo.
create or replace function public.detecta_ofertas()
returns table (avaliados integer, aprovados integer)
language sql
security definer
set search_path = public
as $$
  with aval as materialized (
    select * from public.avalia_anuncios()
  ),
  inseridas as (
    insert into public.oferta (
      anuncio_id, preco_atual_centavos, preco_referencia_centavos,
      referencia_janela_dias, dias_de_serie, desconto_pct,
      comissao_estimada_centavos, nota, nota_desconto, nota_comissao, nota_qualidade
    )
    select anuncio_id, preco_atual_centavos, preco_referencia_centavos,
           referencia_janela_dias, dias_de_serie, desconto_pct,
           comissao_estimada_centavos, nota, nota_desconto, nota_comissao, nota_qualidade
      from aval
     where aprovada
    returning 1
  )
  select (select count(*) from aval)::integer,
         (select count(*) from inseridas)::integer;
$$;

comment on function public.detecta_ofertas is
  'Avalia o catálogo elegível numa passada e grava as aprovadas. Devolve a taxa de aprovação.';

grant execute on function public.avalia_anuncios(uuid[]) to service_role;
grant execute on function public.avalia_anuncio(uuid) to service_role;
grant execute on function public.detecta_ofertas() to service_role;
