-- =============================================================
-- Retenção da série e expiração de oferta
--
-- Dois vazamentos que só aparecem com o tempo, e por isso são
-- fáceis de deixar passar até doerem.
--
-- 1. A SÉRIE CRESCE PARA SEMPRE
--
-- Medido neste banco: cada ponto de preço custa 187 bytes, já
-- contando os índices. Com a colheita (D-012) trazendo milhares
-- de anúncios:
--
--     5.000 anúncios  → 341 MB por ano
--    10.000 anúncios  → 682 MB por ano
--
-- O plano gratuito do Supabase dá 500 MB. Ou seja, com dez mil
-- anúncios o banco estoura em cerca de oito meses — e estoura em
-- produção, com o canal no ar.
--
-- A saída não é apagar histórico, é reduzir a resolução do que já
-- não precisa de resolução. A curadoria olha uma janela de 30
-- dias; nada na regra usa o preço exato de um dia específico de
-- oito meses atrás. Então: diário nos últimos meses, semanal
-- antes disso. Com isso os mesmos dez mil anúncios cabem em
-- 290 MB por ano, e a tendência de longo prazo continua legível.
--
-- 2. OFERTA VELHA NUNCA SAÍA DA FILA
--
-- A tabela `oferta` só ganhava linha. Uma oferta detectada há
-- cinco dias, cujo preço já voltou ao normal, continuava na fila
-- como se fosse boa. Publicar isso é o erro que gera reclamação
-- no canal — e é exatamente o que os concorrentes fazem.
-- =============================================================

insert into public.parametro (chave, valor, descricao) values
  ('dias_resolucao_diaria', 120,
   'Por quantos dias a série guarda um ponto por dia. Antes disso vira um ponto por semana.'),

  ('horas_validade_oferta', 48,
   'Depois disso a oferta na fila expira sozinha. Preço tem prazo de validade.'),

  ('tolerancia_alta_pct', 3,
   'Quanto o preço pode subir acima do preço da oferta antes dela ser considerada morta.');

-- =============================================================
-- compacta_serie_antiga
--
-- Mantém um ponto por semana fora da janela de resolução diária,
-- e o ponto mantido é o de MENOR preço da semana — o mesmo
-- critério do "menor do dia" em `registra_preco`, para que a
-- série continue coerente consigo mesma.
--
-- Guardar o menor, e não a média, é decisão de produto: a série
-- existe para responder "quão barato isso já esteve", e média
-- esconde justamente o vale que interessa.
-- =============================================================
create or replace function public.compacta_serie_antiga()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias      integer := public.parametro('dias_resolucao_diaria')::integer;
  v_removidos integer;
begin
  with antigos as (
    select pp.id,
           row_number() over (
             partition by pp.anuncio_id, date_trunc('week', pp.dia_local)
             order by pp.preco_centavos asc, pp.dia_local asc
           ) as posicao
      from public.preco_ponto pp
     where pp.dia_local < (now() at time zone 'America/Sao_Paulo')::date - v_dias
  ),
  apagados as (
    delete from public.preco_ponto pp
     using antigos a
     where pp.id = a.id
       and a.posicao > 1
    returning 1
  )
  select count(*) into v_removidos from apagados;

  return v_removidos;
end;
$$;

comment on function public.compacta_serie_antiga is
  'Reduz a série antiga para um ponto por semana, mantendo o menor preço da semana.';

-- =============================================================
-- expira_ofertas
--
-- Duas mortes possíveis para uma oferta na fila:
--
--   a) prazo — preço tem validade, e 48 horas já é generoso
--   b) o preço subiu de volta, então a oferta simplesmente
--      deixou de existir no mundo real
--
-- A tolerância existe porque marketplace oscila alguns centavos
-- o tempo todo; sem ela, toda oferta morreria em horas por ruído.
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
    update public.oferta o
       set status = 'expirada', expirada_em = now()
     where o.status = 'nova'
       and o.detectada_em < now() - make_interval(hours => v_horas)
    returning 1
  )
  select count(*) into v_prazo from vencidas;

  with atual as (
    select distinct on (pp.anuncio_id) pp.anuncio_id, pp.preco_centavos
      from public.preco_ponto pp
     order by pp.anuncio_id, pp.coletado_em desc
  ),
  subiram as (
    update public.oferta o
       set status = 'expirada', expirada_em = now()
      from atual
     where o.status = 'nova'
       and atual.anuncio_id = o.anuncio_id
       and atual.preco_centavos > o.preco_atual_centavos * (1 + v_tolerancia / 100)
    returning 1
  )
  select count(*) into v_preco from subiram;

  return query select v_prazo, v_preco;
end;
$$;

comment on function public.expira_ofertas is
  'Mata oferta na fila por prazo ou porque o preço voltou a subir.';

-- =============================================================
-- manutencao_diaria
--
-- Um ponto de entrada só, para o agendador chamar. Assim a ordem
-- das rotinas fica decidida aqui, no banco, e não espalhada na
-- configuração do cron — onde ninguém olha quando dá errado.
--
-- A ordem importa: expurgo e expiração primeiro, para a detecção
-- não considerar dado que já devia ter sumido.
-- =============================================================
create or replace function public.manutencao_diaria()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expurgados integer;
  v_compactados integer;
  v_exp record;
  v_det record;
begin
  select public.expurga_precos_expirados() into v_expurgados;
  select * into v_exp from public.expira_ofertas();
  select public.compacta_serie_antiga() into v_compactados;
  select * into v_det from public.detecta_ofertas();

  return jsonb_build_object(
    'precos_expurgados',   v_expurgados,
    'ofertas_expiradas',   jsonb_build_object('por_prazo', v_exp.por_prazo, 'por_preco', v_exp.por_preco),
    'pontos_compactados',  v_compactados,
    'anuncios_avaliados',  v_det.avaliados,
    'ofertas_aprovadas',   v_det.aprovados
  );
end;
$$;

comment on function public.manutencao_diaria is
  'Ponto único da rotina diária: expurgo, expiração, compactação e detecção, nesta ordem.';

grant execute on function public.compacta_serie_antiga() to service_role;
grant execute on function public.expira_ofertas() to service_role;
grant execute on function public.manutencao_diaria() to service_role;
