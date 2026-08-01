-- =============================================================
-- 19 · A leitura anterior — o que faltava para a queda existir
--
-- A migration 18 criou `detecta_quedas` comparando os dois últimos
-- `preco_ponto`. Rodou e não achou nada, com queda de 12% no banco.
--
-- O motivo: `preco_ponto` guarda **um ponto por dia**, o menor do
-- dia, e `registra_preco` atualiza a linha no lugar. Nunca existem
-- dois pontos do mesmo dia — então "a leitura anterior" simplesmente
-- não existia ali.
--
-- E ISSO ESTÁ CERTO como está. A série diária é o ativo do projeto e
-- precisa ser enxuta: um ponto por dia por anúncio é o que a mantém
-- barata por anos, e é o que a regra das 24 horas da Amazon exige
-- poder expurgar sem quebrar nada.
--
-- Então a leitura de curto prazo vira outra coisa: duas colunas no
-- próprio anúncio. Só as duas últimas, sem histórico — quem quer
-- histórico usa a série.
-- =============================================================

alter table public.anuncio
  add column preco_leitura_centavos          integer,
  add column preco_leitura_anterior_centavos integer,
  add column leitura_em                      timestamptz;

comment on column public.anuncio.preco_leitura_centavos is
  'Preço da última leitura do coletor. Curto prazo: a série histórica é preco_ponto.';
comment on column public.anuncio.preco_leitura_anterior_centavos is
  'Preço da leitura de antes. É contra ele que a queda de gatilho "queda" é medida.';

-- -------------------------------------------------------------
-- registra_leitura — empurra a leitura nova e guarda a anterior
--
-- Separada de `registra_preco` de propósito: uma alimenta a decisão
-- de agora, a outra alimenta a série de meses. Misturá-las faria a
-- coleta horária inchar a série em 15×.
-- -------------------------------------------------------------
create or replace function public.registra_leitura(
  p_anuncio_id     uuid,
  p_preco_centavos integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.anuncio
     set preco_leitura_anterior_centavos = preco_leitura_centavos,
         preco_leitura_centavos = p_preco_centavos,
         leitura_em = now()
   where id = p_anuncio_id
     -- Leitura idêntica não desloca nada: senão a segunda execução da
     -- hora apagaria o preço de antes com o mesmo número, e a queda
     -- que aconteceu entre elas desapareceria.
     and (preco_leitura_centavos is distinct from p_preco_centavos);
end;
$$;

comment on function public.registra_leitura is
  'Guarda a leitura de agora e empurra a anterior. Leitura repetida não desloca — senão a queda se apagaria sozinha.';

grant execute on function public.registra_leitura(uuid, integer) to service_role;


-- -------------------------------------------------------------
-- detecta_quedas, agora comparando o que existe
-- -------------------------------------------------------------
create or replace function public.detecta_quedas()
returns table (avaliados integer, aprovados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avaliados integer := 0;
  v_aprovados integer := 0;
  v_linha     record;
  v_vered     record;
begin
  create temp table _quedas on commit drop as
  with par as (
    select o.id as operacao_id,
           coalesce(max(case when pa.chave = 'queda_minima_pct'   then pa.valor end), 10) as minima_pct,
           coalesce(max(case when pa.chave = 'queda_janela_horas' then pa.valor end), 24) as janela_horas
      from public.operacao o
      left join public.parametro pa
             on pa.operacao_id = o.id and pa.nicho_id is null
     group by o.id
  )
  select a.id as anuncio_id,
         a.operacao_id,
         a.preco_leitura_centavos          as preco_agora,
         a.preco_leitura_anterior_centavos as preco_antes,
         round(((a.preco_leitura_anterior_centavos - a.preco_leitura_centavos)::numeric
                 / a.preco_leitura_anterior_centavos) * 100, 2) as queda_pct
    from public.anuncio a
    join par on par.operacao_id = a.operacao_id
   where a.ativo
     and a.preco_leitura_centavos is not null
     and a.preco_leitura_anterior_centavos is not null
     and a.preco_leitura_centavos < a.preco_leitura_anterior_centavos
     and ((a.preco_leitura_anterior_centavos - a.preco_leitura_centavos)::numeric
            / a.preco_leitura_anterior_centavos) * 100 >= par.minima_pct
     -- Menor da janela: sem isto, um preço que sobe e desce publicaria
     -- toda vez que descesse, e o grupo receberia a "promoção" do
     -- mesmo produto três vezes no dia.
     and a.preco_leitura_centavos <= coalesce((
       select min(p2.preco_centavos)
         from public.preco_ponto p2
        where p2.anuncio_id = a.id
          and p2.disponivel
          and p2.coletado_em >= now() - (par.janela_horas || ' hours')::interval
     ), a.preco_leitura_centavos)
     and not exists (
       select 1 from public.oferta of
        where of.anuncio_id = a.id and of.status in ('nova', 'aprovada')
     );

  select count(*) into v_avaliados from _quedas;

  for v_linha in select * from _quedas loop
    select * into v_vered from public.avalia_anuncio(v_linha.anuncio_id);

    insert into public.oferta (
      operacao_id, anuncio_id,
      preco_atual_centavos, preco_anterior_centavos,
      preco_referencia_centavos, referencia_janela_dias,
      dias_de_serie, desconto_pct, comissao_estimada_centavos,
      pode_afirmar_minimo,
      nota, nota_desconto, nota_comissao, nota_vendedor,
      gatilho
    )
    values (
      v_linha.operacao_id, v_linha.anuncio_id,
      v_linha.preco_agora, v_linha.preco_antes,
      v_linha.preco_antes, 0,
      coalesce(v_vered.dias_de_serie, 0),
      v_linha.queda_pct,
      coalesce(v_vered.comissao_estimada_centavos, 0),
      false,
      coalesce(v_vered.nota, 0),
      coalesce(v_vered.nota_desconto, 0),
      coalesce(v_vered.nota_comissao, 0),
      coalesce(v_vered.nota_vendedor, 0),
      'queda'
    );

    v_aprovados := v_aprovados + 1;
  end loop;

  return query select v_avaliados, v_aprovados;
end;
$$;
