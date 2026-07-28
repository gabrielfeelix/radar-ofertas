-- =============================================================
-- 09 · Oferta e motor de curadoria
--
-- É o coração do produto. A pesquisa de mercado mostrou que o
-- padrão dos concorrentes é repassar oferta alheia sem conferir
-- preço nenhum. Este arquivo é o que a gente faz e eles não.
--
-- A regra mora AQUI, numa implementação só. Reescrevê-la em
-- TypeScript para a tela explicar produziria uma tela que explica
-- uma coisa enquanto o sistema faz outra — e a tela seria
-- acreditada.
-- =============================================================

-- -------------------------------------------------------------
-- Os limiares que valem para cada nicho, já pivotados.
--
-- A linha com nicho nulo atende produto ainda não classificado.
-- O motor lê isto como TABELA porque avalia o catálogo inteiro
-- numa passada: chamar a função escalar por anúncio traria de
-- volta o problema que a avaliação em conjunto resolveu.
-- -------------------------------------------------------------
create view public.limiar
with (security_invoker = true)
as
with base as (
  select nicho_id, chave, valor from public.parametro_efetivo
  union all
  select null::uuid, chave, valor from public.parametro where nicho_id is null
)
select
  nicho_id,
  (max(valor) filter (where chave = 'dias_minimos_de_serie'))::int       as dias_minimos_de_serie,
  (max(valor) filter (where chave = 'dias_para_afirmar'))::int           as dias_para_afirmar,
  (max(valor) filter (where chave = 'janela_referencia_dias'))::int      as janela_referencia_dias,
  (max(valor) filter (where chave = 'janela_minimo_dias'))::int          as janela_minimo_dias,
   max(valor) filter (where chave = 'desconto_minimo_pct')               as desconto_minimo_pct,
  (max(valor) filter (where chave = 'comissao_minima_centavos'))::int    as comissao_minima_centavos,
   max(valor) filter (where chave = 'avaliacao_minima')                  as avaliacao_minima,
  (max(valor) filter (where chave = 'avaliacao_qtd_minima'))::int        as avaliacao_qtd_minima,
   max(valor) filter (where chave = 'reputacao_minima')                  as reputacao_minima,
  (max(valor) filter (where chave = 'dias_recompra_mesmo_anuncio'))::int as dias_recompra,
   max(valor) filter (where chave = 'recorrencia_maxima_pct')            as recorrencia_maxima_pct,
   max(valor) filter (where chave = 'tolerancia_alta_pct')               as tolerancia_alta_pct
from base
group by nicho_id;

comment on view public.limiar is
  'Os limiares que valem por nicho, com a herança resolvida. A linha nula atende produto sem nicho.';

-- =============================================================
-- Oferta
-- =============================================================
create table public.oferta (
  id                         uuid primary key default gen_random_uuid(),
  operacao_id                uuid not null references public.operacao(id) on delete cascade,
  anuncio_id                 uuid not null references public.anuncio(id) on delete cascade,

  preco_atual_centavos       integer not null,
  -- Mediana observada por NÓS. Nunca o "preço de" da loja, que é
  -- inflado por desenho.
  preco_referencia_centavos  integer not null,
  referencia_janela_dias     integer not null,
  dias_de_serie              integer not null,
  desconto_pct               numeric(5,2) not null,
  comissao_estimada_centavos integer not null,

  -- Se falso, a mensagem NÃO pode falar em mínimo histórico e usa
  -- a redação honesta com a data de início da observação (3.4).
  pode_afirmar_minimo        boolean not null default false,

  -- Escala cheia de 0 a 100: desconto 50, comissão 30, vendedor 20.
  nota                       numeric(5,2) not null,
  nota_desconto              numeric(5,2) not null,
  nota_comissao              numeric(5,2) not null,
  nota_vendedor              numeric(5,2) not null,

  status                     text not null default 'nova',
  -- Obrigatório ao rejeitar: é com ele que os limiares são
  -- calibrados depois. Sem isso, "por que rejeitei tanta coisa
  -- essa semana" não tem resposta.
  motivo_rejeicao            text,
  adiamentos                 integer not null default 0,

  detectada_em               timestamptz not null default now(),
  decidida_em                timestamptz,
  decidida_por               uuid references public.usuario(id) on delete set null,
  expirada_em                timestamptz,
  criado_em                  timestamptz not null default now(),

  constraint oferta_status_valido
    check (status in ('nova', 'aprovada', 'rejeitada', 'adiada', 'expirada')),
  constraint oferta_precos_positivos
    check (preco_atual_centavos > 0 and preco_referencia_centavos > 0),
  constraint oferta_rejeicao_tem_motivo
    check (status <> 'rejeitada' or motivo_rejeicao is not null)
);

comment on table public.oferta is
  'Anúncio que ficou barato agora, já validado. Só entra aqui o que passou por todas as comportas.';
comment on column public.oferta.pode_afirmar_minimo is
  'Falso entre 7 e 14 dias de série: a oferta existe, mas a mensagem não pode afirmar mínimo.';
comment on column public.oferta.motivo_rejeicao is
  'Obrigatório ao rejeitar. É a matéria-prima da calibragem dos limiares.';

create index oferta_fila_idx on public.oferta (operacao_id, status, nota desc, detectada_em desc);
create index oferta_anuncio_idx on public.oferta (anuncio_id, detectada_em desc);

alter table public.oferta enable row level security;

-- =============================================================
-- comporta_dia — contador diário de reprovação por comporta
--
-- Responde a pergunta de calibragem que nenhuma tela respondia:
-- QUAL COMPORTA ESTÁ MATANDO TUDO.
--
-- É contador, e não uma linha por anúncio avaliado, de propósito:
-- três mil anúncios por dia dariam mais de um milhão de linhas por
-- ano para responder uma pergunta que é agregada.
-- =============================================================
create table public.comporta_dia (
  operacao_id uuid not null references public.operacao(id) on delete cascade,
  dia         date not null,
  comporta    text not null,
  reprovados  integer not null default 0,
  primary key (operacao_id, dia, comporta)
);

comment on table public.comporta_dia is
  'Quantos anúncios cada comporta reprovou por dia. Sem isto, ajustar limiar é chute.';

alter table public.comporta_dia enable row level security;

-- =============================================================
-- avalia_anuncios — A REGRA, em uma passada
--
-- Sem lista, avalia o catálogo elegível (o que o detector diário
-- quer). Com lista, avalia exatamente os ids dados, mesmo inativos
-- (o que a tela quer, para explicar por que não passou).
--
-- Nunca reprova por informação ausente: se a loja não informa
-- reputação do vendedor, o anúncio não é punido por isso — seria
-- descartar anúncio bom por pobreza da API da loja.
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
    select a.id, a.operacao_id, a.ativo, a.avaliacao, a.avaliacao_qtd,
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
  recente as (
    select distinct o.anuncio_id
      from public.oferta o
      join com_limiar cl on cl.id = o.anuncio_id
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
      (rec.anuncio_id is not null) as ja_publicado
    from com_limiar cl
    left join ultimo     u   on u.anuncio_id   = cl.id
    left join referencia r   on r.anuncio_id   = cl.id
    left join historico  h   on h.anuncio_id   = cl.id
    left join recente    rec on rec.anuncio_id = cl.id
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
  'A regra da curadoria, em uma passada. Sem lista, o catálogo elegível; com lista, os ids dados.';

-- Casca fina para a tela. Não repete regra nenhuma.
create or replace function public.avalia_anuncio(p_anuncio_id uuid)
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
  select * from public.avalia_anuncios(array[p_anuncio_id]);
$$;

comment on function public.avalia_anuncio is
  'Veredito de um anúncio, para a tela responder "por que esta oferta não apareceu?".';

-- =============================================================
-- detecta_ofertas — uma passada, um INSERT, e os contadores
--
-- Sem tabela temporária: a versão anterior usava `on commit drop`,
-- que só é descartada no commit, e duas chamadas na mesma
-- transação quebravam.
-- =============================================================
create or replace function public.detecta_ofertas()
returns table (avaliados integer, aprovados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avaliados integer;
  v_aprovados integer;
begin
  create temp table _aval as select * from public.avalia_anuncios();

  select count(*) into v_avaliados from _aval;

  insert into public.oferta (
    operacao_id, anuncio_id, preco_atual_centavos, preco_referencia_centavos,
    referencia_janela_dias, dias_de_serie, desconto_pct, comissao_estimada_centavos,
    pode_afirmar_minimo, nota, nota_desconto, nota_comissao, nota_vendedor
  )
  select operacao_id, anuncio_id, preco_atual_centavos, preco_referencia_centavos,
         referencia_janela_dias, dias_de_serie, desconto_pct, comissao_estimada_centavos,
         pode_afirmar_minimo, nota, nota_desconto, nota_comissao, nota_vendedor
    from _aval where aprovada;

  get diagnostics v_aprovados = row_count;

  -- Contador por comporta. O nome da comporta é a parte antes do
  -- parêntese: `serie_curta(5_de_7_dias)` conta como `serie_curta`.
  insert into public.comporta_dia (operacao_id, dia, comporta, reprovados)
  select a.operacao_id, public.hoje(), split_part(motivo, '(', 1), count(*)
    from _aval a, unnest(a.motivos) as motivo
   where not a.aprovada
   group by a.operacao_id, split_part(motivo, '(', 1)
  on conflict (operacao_id, dia, comporta) do update
    set reprovados = public.comporta_dia.reprovados + excluded.reprovados;

  drop table _aval;

  return query select v_avaliados, v_aprovados;
end;
$$;

comment on function public.detecta_ofertas is
  'Avalia o catálogo numa passada, grava as aprovadas e conta quem reprovou por qual comporta.';

-- =============================================================
-- expira_ofertas — preço tem prazo de validade
-- =============================================================
create or replace function public.expira_ofertas()
returns table (por_prazo integer, por_preco integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horas      integer := public.parametro('horas_validade_oferta')::integer;
  v_tolerancia numeric := public.parametro('tolerancia_alta_pct');
  v_prazo      integer;
  v_preco      integer;
begin
  with vencidas as (
    update public.oferta o set status = 'expirada', expirada_em = now()
     where o.status in ('nova', 'adiada')
       and o.detectada_em < now() - make_interval(hours => v_horas)
    returning 1
  )
  select count(*) into v_prazo from vencidas;

  with atual as (
    select distinct on (pp.anuncio_id) pp.anuncio_id, pp.preco_centavos
      from public.preco_ponto pp order by pp.anuncio_id, pp.coletado_em desc
  ),
  subiram as (
    update public.oferta o set status = 'expirada', expirada_em = now()
      from atual
     where o.status in ('nova', 'adiada')
       and atual.anuncio_id = o.anuncio_id
       and atual.preco_centavos > o.preco_atual_centavos * (1 + v_tolerancia / 100)
    returning 1
  )
  select count(*) into v_preco from subiram;

  return query select v_prazo, v_preco;
end;
$$;

-- =============================================================
-- manutencao_diaria — ponto único de entrada do agendador
--
-- A ordem é decidida aqui, no banco, e não espalhada na
-- configuração do cron, onde ninguém olha quando dá errado.
-- =============================================================
create or replace function public.manutencao_diaria()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expurgados  integer;
  v_compactados integer;
  v_exp record;
  v_det record;
begin
  select public.expurga_precos_expirados() into v_expurgados;
  select * into v_exp from public.expira_ofertas();
  select public.compacta_serie_antiga() into v_compactados;
  select * into v_det from public.detecta_ofertas();

  return jsonb_build_object(
    'precos_expurgados',  v_expurgados,
    'ofertas_expiradas',  jsonb_build_object('por_prazo', v_exp.por_prazo,
                                             'por_preco', v_exp.por_preco),
    'pontos_compactados', v_compactados,
    'anuncios_avaliados', v_det.avaliados,
    'ofertas_aprovadas',  v_det.aprovados
  );
end;
$$;

comment on function public.manutencao_diaria is
  'Rotina diária: expurgo, expiração, compactação e detecção, nesta ordem.';
