-- =============================================================
-- Fase 1 · motor de validação
--
-- É o coração do produto. A pesquisa de mercado (docs/mercado.md)
-- mostrou que o padrão dos concorrentes é repassar oferta alheia
-- sem conferir preço nenhum. Este arquivo é exatamente o que a
-- gente faz e eles não.
--
-- Duas comportas, nesta ordem:
--
--   COMPORTA 1 — qualidade. Funciona no dia 1, sem histórico.
--     Reputação do vendedor, nota do produto, comissão em reais.
--
--   COMPORTA 2 — preço. Precisa de série acumulada.
--     Queda real contra a mediana, com lastro suficiente.
--
-- Nada aqui compara com o "preço de" da loja, que é inflado por
-- desenho. A referência é sempre a mediana que nós observamos.
-- =============================================================

create table public.oferta (
  id                         uuid primary key default gen_random_uuid(),
  anuncio_id                 uuid not null references public.anuncio(id) on delete cascade,

  preco_atual_centavos       integer not null,
  preco_referencia_centavos  integer not null,
  referencia_janela_dias     integer not null,
  dias_de_serie              integer not null,
  desconto_pct               numeric(5,2) not null,
  comissao_estimada_centavos integer not null,

  nota                       numeric(5,2) not null,
  -- Guardar as parcelas separadas permite entender depois por que
  -- uma oferta ficou com nota 62 sem precisar recalcular nada.
  nota_desconto              numeric(5,2) not null,
  nota_comissao              numeric(5,2) not null,
  nota_qualidade             numeric(5,2) not null,

  status                     text not null default 'nova',
  detectada_em               timestamptz not null default now(),
  expirada_em                timestamptz,
  criado_em                  timestamptz not null default now(),

  constraint oferta_status_valido
    check (status in ('nova', 'aprovada', 'rejeitada', 'expirada')),
  constraint oferta_precos_positivos
    check (preco_atual_centavos > 0 and preco_referencia_centavos > 0)
);

comment on table public.oferta is
  'Anúncio que ficou barato agora, já validado pelas duas comportas. Só entra aqui o que passou.';
comment on column public.oferta.referencia_janela_dias is
  'Sobre quantos dias a mediana foi calculada. Abaixo de 14 a mensagem não pode falar em desconto histórico.';
comment on column public.oferta.preco_referencia_centavos is
  'Mediana observada por nós. Nunca o "preço de" da loja, que é inflado por desenho.';

create index oferta_fila_idx on public.oferta (status, nota desc, detectada_em desc);
create index oferta_anuncio_idx on public.oferta (anuncio_id, detectada_em desc);

alter table public.oferta enable row level security;

-- =============================================================
-- avalia_anuncio
--
-- Devolve o veredito completo de um anúncio: passa ou não passa,
-- por quê, com que nota e com que números.
--
-- Escrita para ser chamada tanto pelo detector automático quanto
-- pela tela — quando o operador perguntar "por que essa oferta
-- não apareceu?", a resposta sai daqui, com os motivos em texto.
--
-- Nunca reprova por informação ausente. Se a loja não informa
-- reputação do vendedor, o anúncio não é punido por isso: seria
-- descartar anúncio bom por pobreza da API.
-- =============================================================
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
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_janela      integer := public.parametro('janela_referencia_dias')::integer;
  v_dias_min    integer := public.parametro('dias_minimos_de_serie')::integer;
  v_desc_min    numeric := public.parametro('desconto_minimo_pct');
  v_com_min     integer := public.parametro('comissao_minima_centavos')::integer;
  v_aval_min    numeric := public.parametro('avaliacao_minima');
  v_aval_qtd    integer := public.parametro('avaliacao_qtd_minima')::integer;
  v_rep_min     numeric := public.parametro('reputacao_minima');
  v_recompra    integer := public.parametro('dias_recompra_mesmo_anuncio')::integer;

  v_a           record;
  v_ultimo      record;
  v_ref         integer;
  v_dias_serie  integer;
  v_pct         numeric;
  v_desconto    numeric := 0;
  v_comissao    integer := 0;
  v_motivos     text[] := '{}';
  n_desc        numeric := 0;
  n_com         numeric := 0;
  n_qual        numeric := 0;
begin
  select a.id, a.ativo, a.avaliacao, a.avaliacao_qtd, a.reputacao_vendedor,
         a.loja_oficial, a.marketplace_id, p.categoria,
         m.base_de_historico, m.comissao_padrao_pct
    into v_a
    from public.anuncio a
    join public.produto p     on p.id = a.produto_id
    join public.marketplace m on m.id = a.marketplace_id
   where a.id = p_anuncio_id;

  if not found then
    raise exception 'Anúncio % não existe.', p_anuncio_id;
  end if;

  -- ---------------------------------------------------------
  -- Pré-condições. Não são "reprovação de curadoria", são casos
  -- em que nem faz sentido avaliar.
  -- ---------------------------------------------------------
  if not v_a.ativo then
    v_motivos := v_motivos || 'anuncio_inativo'::text;
  end if;

  if not v_a.base_de_historico then
    -- Amazon. Pela D-003 ela não acumula série, então não há
    -- referência honesta para comparar.
    v_motivos := v_motivos || 'loja_sem_historico'::text;
  end if;

  -- Preço mais recente.
  select pp.preco_centavos, pp.disponivel, pp.dia_local
    into v_ultimo
    from public.preco_ponto pp
   where pp.anuncio_id = p_anuncio_id
   order by pp.coletado_em desc
   limit 1;

  if not found then
    v_motivos := v_motivos || 'sem_preco_coletado'::text;
  else
    if not v_ultimo.disponivel then
      -- Produto esgotado não é oferta. Publicar isso queima o
      -- canal mais rápido que preço errado.
      v_motivos := v_motivos || 'indisponivel'::text;
    end if;

    if v_ultimo.dia_local < (now() at time zone 'America/Sao_Paulo')::date - 1 then
      -- Preço de três dias atrás pode já ter subido. Publicar
      -- preço velho é o erro que gera reclamação no grupo.
      v_motivos := v_motivos || 'preco_desatualizado'::text;
    end if;
  end if;

  -- ---------------------------------------------------------
  -- Referência: mediana da janela, SEM o dia de hoje.
  --
  -- Incluir hoje puxaria a mediana para baixo junto com a
  -- promoção, e o desconto apareceria menor do que é.
  -- ---------------------------------------------------------
  select (percentile_cont(0.5) within group (order by pp.preco_centavos))::integer,
         count(distinct pp.dia_local)
    into v_ref, v_dias_serie
    from public.preco_ponto pp
   where pp.anuncio_id = p_anuncio_id
     and pp.dia_local >= (now() at time zone 'America/Sao_Paulo')::date - v_janela
     and pp.dia_local <  (now() at time zone 'America/Sao_Paulo')::date;

  v_dias_serie := coalesce(v_dias_serie, 0);

  if v_ref is null or v_ref <= 0 then
    v_motivos := v_motivos || 'sem_referencia_de_preco'::text;
  end if;

  -- COMPORTA 2 — lastro. Regra 3.4 do AGENTS.md.
  if v_dias_serie < v_dias_min then
    v_motivos := v_motivos || format('serie_curta(%s_de_%s_dias)', v_dias_serie, v_dias_min);
  end if;

  if v_ref is not null and v_ref > 0 and v_ultimo.preco_centavos is not null then
    v_desconto := round(((v_ref - v_ultimo.preco_centavos)::numeric / v_ref) * 100, 2);

    if v_desconto < v_desc_min then
      v_motivos := v_motivos || format('desconto_insuficiente(%s%%)', v_desconto);
    end if;
  end if;

  -- ---------------------------------------------------------
  -- COMPORTA 1 — qualidade e retorno. Vale desde o dia 1.
  -- ---------------------------------------------------------
  select cc.percentual into v_pct
    from public.comissao_categoria cc
   where cc.marketplace_id = v_a.marketplace_id
     and cc.categoria = v_a.categoria
     and cc.vigente_ate is null
   limit 1;

  v_pct := coalesce(v_pct, v_a.comissao_padrao_pct, 0);
  v_comissao := floor(coalesce(v_ultimo.preco_centavos, 0) * v_pct / 100)::integer;

  if v_comissao < v_com_min then
    v_motivos := v_motivos || format('comissao_baixa(%s_centavos)', v_comissao);
  end if;

  -- Nota do produto só conta com amostra suficiente: 5,0 com duas
  -- avaliações não diz nada, e reprovar por ela seria pior que
  -- ignorá-la.
  if v_a.avaliacao is not null
     and coalesce(v_a.avaliacao_qtd, 0) >= v_aval_qtd
     and v_a.avaliacao < v_aval_min then
    v_motivos := v_motivos || format('produto_mal_avaliado(%s)', v_a.avaliacao);
  end if;

  if v_a.reputacao_vendedor is not null and v_a.reputacao_vendedor < v_rep_min then
    v_motivos := v_motivos || format('vendedor_fraco(%s)', v_a.reputacao_vendedor);
  end if;

  -- Fadiga: o mesmo anúncio virando oferta toda semana cansa, e
  -- membro cansado sai.
  if exists (
    select 1 from public.oferta o
     where o.anuncio_id = p_anuncio_id
       and o.status in ('nova', 'aprovada')
       and o.detectada_em > now() - make_interval(days => v_recompra)
  ) then
    v_motivos := v_motivos || 'publicado_recentemente'::text;
  end if;

  -- ---------------------------------------------------------
  -- Nota.
  --
  -- Escala de 0 a 100, mas hoje o teto real é 80: os 20 pontos
  -- de fadiga do canal e de desempenho histórico por categoria
  -- dependem de canal, que é da Fase 2. Ficam reservados de
  -- propósito, para que a nota de hoje continue comparável com a
  -- de amanhã em vez de sofrer uma inflação silenciosa.
  --
  --   desconto  ... 40  (teto em 40% de queda)
  --   comissão  ... 25  (teto em R$ 15)
  --   qualidade ... 15
  --   reservado ... 20  (Fase 2)
  -- ---------------------------------------------------------
  n_desc := round(least(greatest(v_desconto, 0), 40), 2);
  n_com  := round(least(v_comissao, 1500)::numeric / 1500 * 25, 2);

  n_qual := round(
    15 * (
      -- Sem informação, entra como neutro (0,5). Nem prêmio nem
      -- castigo por a API da loja ser pobre.
      0.5 * coalesce(
        case when coalesce(v_a.avaliacao_qtd, 0) >= v_aval_qtd
             then v_a.avaliacao / 5.0 end, 0.5)
      + 0.3 * coalesce(v_a.reputacao_vendedor, 0.5)
      + 0.2 * case when coalesce(v_a.loja_oficial, false) then 1.0 else 0.5 end
    ), 2);

  return query select
    p_anuncio_id,
    (array_length(v_motivos, 1) is null),
    v_motivos,
    coalesce(v_ultimo.preco_centavos, 0),
    coalesce(v_ref, 0),
    v_janela,
    v_dias_serie,
    v_desconto,
    v_comissao,
    round(n_desc + n_com + n_qual, 2),
    n_desc,
    n_com,
    n_qual;
end;
$$;

comment on function public.avalia_anuncio is
  'Veredito completo de um anúncio: passa ou não, por quê, com que nota. Fonte única da curadoria.';

-- =============================================================
-- detecta_ofertas
--
-- Roda depois da coleta. Avalia todo anúncio ativo de loja que
-- forma histórico e grava as aprovadas como oferta nova.
--
-- Devolve o que foi avaliado e o que passou, para o painel poder
-- mostrar a taxa de aprovação — que é a métrica que diz se os
-- limiares estão frouxos ou apertados demais.
-- =============================================================
create or replace function public.detecta_ofertas()
returns table (avaliados integer, aprovados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avaliados integer := 0;
  v_aprovados integer := 0;
  v_anuncio   record;
  v_r         record;
begin
  for v_anuncio in
    select a.id
      from public.anuncio a
      join public.marketplace m on m.id = a.marketplace_id
     where a.ativo and m.ativo and m.base_de_historico
  loop
    v_avaliados := v_avaliados + 1;

    select * into v_r from public.avalia_anuncio(v_anuncio.id);

    if v_r.aprovada then
      insert into public.oferta (
        anuncio_id, preco_atual_centavos, preco_referencia_centavos,
        referencia_janela_dias, dias_de_serie, desconto_pct,
        comissao_estimada_centavos, nota, nota_desconto, nota_comissao, nota_qualidade
      ) values (
        v_r.anuncio_id, v_r.preco_atual_centavos, v_r.preco_referencia_centavos,
        v_r.referencia_janela_dias, v_r.dias_de_serie, v_r.desconto_pct,
        v_r.comissao_estimada_centavos, v_r.nota, v_r.nota_desconto,
        v_r.nota_comissao, v_r.nota_qualidade
      );
      v_aprovados := v_aprovados + 1;
    end if;
  end loop;

  return query select v_avaliados, v_aprovados;
end;
$$;

comment on function public.detecta_ofertas is
  'Avalia todos os anúncios ativos e grava as ofertas aprovadas. Roda logo após a coleta diária.';

grant select, insert, update, delete on public.oferta to service_role;
grant execute on function public.avalia_anuncio(uuid) to service_role;
grant execute on function public.detecta_ofertas() to service_role;
