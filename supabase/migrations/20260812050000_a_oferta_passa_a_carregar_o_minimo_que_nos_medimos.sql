-- =============================================================
-- 72 · A oferta passa a carregar o mínimo que NÓS medimos
--
-- O dono perguntou por que a linha de menor preço sumiu do post, e a
-- resposta é que ela nunca teve como aparecer. Ele estava certo no
-- diagnóstico: *"se ele já leu quatro dias, ele já sabe que ontem
-- estava um preço maior ou menor. Se estava, avisa então"*.
--
-- POR QUE NÃO APARECIA, e são dois bloqueios empilhados:
--
--   1. `montaMensagem` escolhe a linha pelo GATILHO, não pelo dado.
--      `declarado` cai direto em `lastro_declarado`, que está vazio
--      desde a migration 43 por decisão do dono, e nunca chega a
--      perguntar se existe série. Hoje 963 de 1000 da fila são
--      `declarado`, então a linha simplesmente não existe.
--   2. A única linha que afirma mínimo (`lastro_com`) exige
--      `pode_afirmar_minimo`, que pede 14 dias de série. **Zero das
--      12.328 ofertas vivas têm isso**, porque a leitura é esparsa: a
--      Shopee relê cada anúncio a cada 3,4 dias, então juntar 14 dias
--      distintos levaria mais de um mês.
--
-- A SOLUÇÃO ERRADA, que foi cogitada e recusada: fazer o `declarado`
-- cair em `lastro_sem` reaproveitando `preco_anterior_centavos`. Não
-- funciona por dois motivos, e o segundo é grave. Primeiro, naquele
-- gatilho `preco_anterior_centavos` **não é leitura nossa**: é o
-- `preco_declarado` da loja, gravado assim na própria função abaixo.
-- Segundo, `lastro_sem` afirma "menor preço que observamos", e comparar
-- com uma leitura só não prova mínimo nenhum. Seria a regra 3.4
-- quebrada com aparência de conserto, que é o pior tipo de conserto.
--
-- O QUE ENTRA: a oferta passa a guardar o que a nossa série de fato
-- diz, calculado de `preco_ponto` na hora em que ela nasce.
--
--   `nosso_minimo_centavos`  o menor preço que registramos
--   `nosso_minimo_desde`     desde quando estamos olhando
--   `nossos_dias_lidos`      em quantos DIAS distintos lemos
--
-- O último é o que separa medição de sorte: dez leituras no mesmo dia
-- não são série, e é por isso que a conta é de `dia_local` distinto e
-- não de linhas.
--
-- A REGRA 3.4 SAI MAIS FORTE, não mais fraca. `pode_afirmar_minimo` e
-- os 14 dias continuam intactos, e continuam sendo os únicos que
-- liberam "menor preço em N dias". O que estes campos liberam é a
-- redação honesta que a própria 3.4 manda usar quando a série é curta:
-- "menor preço que observamos desde 05/08" afirma exatamente o que
-- fizemos, com a data à vista para quem quiser conferir.
--
-- MEDIDO ANTES DE ESCREVER, em 60 itens da fila do Radar Delas: 53 têm
-- três dias ou mais de leitura, e em 25 deles o preço de agora é o
-- menor que já vimos. Cerca de 42% dos posts ganham a linha.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Os três campos
-- -------------------------------------------------------------
alter table public.oferta
  add column if not exists nosso_minimo_centavos integer,
  add column if not exists nosso_minimo_desde    date,
  add column if not exists nossos_dias_lidos     integer not null default 0;

comment on column public.oferta.nosso_minimo_centavos is
  'O menor preço que NÓS registramos em preco_ponto para este anúncio (migration 72). Nulo quando não há série. Não confundir com preco_referencia_centavos, que no gatilho declarado é alegação da loja.';
comment on column public.oferta.nosso_minimo_desde is
  'O primeiro dia em que lemos este anúncio. É o {desde} da linha de lastro, e é a data que a pessoa pode conferir.';
comment on column public.oferta.nossos_dias_lidos is
  'Em quantos DIAS distintos lemos o anúncio. Dez leituras no mesmo dia não são série; por isso a conta é de dia_local distinto.';


-- -------------------------------------------------------------
-- 2. O parâmetro que decide o que é série curta aceitável
--
-- Três dias é o piso para a frase honesta, e é diferente dos 14 de
-- `dias_para_afirmar`, que continuam valendo para AFIRMAR mínimo. Dois
-- dias seriam uma leitura de ontem e uma de hoje, que é queda e já tem
-- gatilho próprio.
-- -------------------------------------------------------------
insert into public.parametro (operacao_id, chave, valor, descricao)
select o.id, 'dias_minimos_para_lastro', 3,
       'Dias distintos de leitura nossa para o post poder dizer "menor preço que observamos desde X" (migration 72). Não libera afirmar mínimo histórico: isso continua sendo dias_para_afirmar, que é 14 e é regra 3.4.'
  from public.operacao o
 where not exists (
   select 1 from public.parametro p
    where p.operacao_id = o.id and p.chave = 'dias_minimos_para_lastro' and p.nicho_id is null
 );


-- -------------------------------------------------------------
-- 3. A leitura da série, num lugar só
--
-- Função separada porque `detecta_declarados` e `detecta_quedas` vão
-- chamar a mesma coisa, e a seção 5 do AGENTS.md proíbe a segunda
-- implementação da mesma regra.
--
-- `disponivel` filtra ponto de anúncio fora do ar: preço de produto
-- esgotado não é preço, e deixá-lo entrar puxaria o mínimo para baixo
-- com um número que ninguém conseguiria pagar.
-- -------------------------------------------------------------
create or replace function public.serie_do_anuncio(p_anuncio_id uuid)
returns table (
  minimo_centavos integer,
  desde           date,
  dias_lidos      integer
)
language sql
stable
security definer
set search_path = public
as $$
  select min(p.preco_centavos)::integer,
         min(p.dia_local),
         count(distinct p.dia_local)::integer
    from public.preco_ponto p
   where p.anuncio_id = p_anuncio_id
     and p.disponivel;
$$;

comment on function public.serie_do_anuncio is
  'O que a NOSSA série diz sobre um anúncio: menor preço, desde quando, e em quantos dias distintos lemos. Fonte única para o lastro (migration 72).';


-- -------------------------------------------------------------
-- 4. `detecta_declarados` passa a gravar a série
--
-- É a mesma função da migration 39, com três colunas a mais no insert.
-- O resto está intacto de propósito: as comportas do desconto mínimo,
-- do teto, das seis horas e da não republicação em sete dias continuam
-- palavra por palavra.
-- -------------------------------------------------------------
create or replace function public.detecta_declarados()
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
  v_serie     record;
begin
  create temp table _declarados on commit drop as
  with par as (
    select o.id as operacao_id,
           coalesce(max(case when pa.chave = 'desconto_declarado_min_pct'  then pa.valor end), 25) as minimo_pct,
           coalesce(max(case when pa.chave = 'desconto_declarado_teto_pct' then pa.valor end), 70) as teto_pct
      from public.operacao o
      left join public.parametro pa
             on pa.operacao_id = o.id and pa.nicho_id is null
     group by o.id
  )
  select a.id as anuncio_id,
         a.operacao_id,
         a.preco_leitura_centavos    as preco_agora,
         a.preco_original_centavos   as preco_declarado,
         round(((a.preco_original_centavos - a.preco_leitura_centavos)::numeric
                 / a.preco_original_centavos) * 100, 2) as desconto_pct
    from public.anuncio a
    join par on par.operacao_id = a.operacao_id
   where a.ativo
     and a.preco_leitura_centavos is not null
     and a.preco_original_centavos is not null
     and a.preco_original_centavos > a.preco_leitura_centavos
     and a.preco_original_visto_em >= now() - interval '6 hours'
     and ((a.preco_original_centavos - a.preco_leitura_centavos)::numeric
            / a.preco_original_centavos) * 100 >= par.minimo_pct
     and ((a.preco_original_centavos - a.preco_leitura_centavos)::numeric
            / a.preco_original_centavos) * 100 <= par.teto_pct
     and not exists (
       select 1 from public.oferta of
        where of.anuncio_id = a.id and of.status in ('nova', 'aprovada')
     )
     and not exists (
       select 1 from public.oferta of2
        where of2.anuncio_id = a.id
          and of2.gatilho = 'declarado'
          and of2.criado_em >= now() - interval '7 days'
     );

  select count(*) into v_avaliados from _declarados;

  for v_linha in select * from _declarados loop
    select * into v_vered from public.avalia_anuncio(v_linha.anuncio_id);
    select * into v_serie from public.serie_do_anuncio(v_linha.anuncio_id);

    insert into public.oferta (
      operacao_id, anuncio_id,
      preco_atual_centavos, preco_anterior_centavos,
      preco_referencia_centavos, referencia_janela_dias,
      dias_de_serie, desconto_pct, comissao_estimada_centavos,
      pode_afirmar_minimo,
      nota, nota_desconto, nota_comissao, nota_vendedor,
      gatilho,
      nosso_minimo_centavos, nosso_minimo_desde, nossos_dias_lidos
    )
    values (
      v_linha.operacao_id, v_linha.anuncio_id,
      v_linha.preco_agora, v_linha.preco_declarado,
      v_linha.preco_declarado, 0,
      coalesce(v_vered.dias_de_serie, 0),
      v_linha.desconto_pct,
      coalesce(v_vered.comissao_estimada_centavos, 0),
      -- SEMPRE falso, e não por descuido: preço alegado pela loja não
      -- é série, e afirmar mínimo em cima dele é a regra 3.4 violada.
      -- Os campos novos abaixo não mudam isto: eles dizem o que NÓS
      -- medimos, que é outra frase e outra promessa.
      false,
      coalesce(v_vered.nota, 0),
      coalesce(v_vered.nota_desconto, 0),
      coalesce(v_vered.nota_comissao, 0),
      coalesce(v_vered.nota_vendedor, 0),
      'declarado',
      v_serie.minimo_centavos, v_serie.desde, coalesce(v_serie.dias_lidos, 0)
    );

    v_aprovados := v_aprovados + 1;
  end loop;

  return query select v_avaliados, v_aprovados;
end;
$$;


-- -------------------------------------------------------------
-- 5. As ofertas que já estão na fila
--
-- Sem isto o conserto só valeria para oferta nova, e as 1.663 que já
-- esperam sairiam sem linha até a fila girar inteira, o que leva dias.
-- -------------------------------------------------------------
-- Agregado de uma vez e não com `lateral`: o Postgres não deixa a
-- cláusula `from` de um `update` referenciar a própria tabela alvo, e
-- uma varredura agrupada é mais barata que uma chamada por linha.
with serie as (
  select p.anuncio_id,
         min(p.preco_centavos)::integer  as minimo,
         min(p.dia_local)                as desde,
         count(distinct p.dia_local)::integer as dias
    from public.preco_ponto p
   where p.disponivel
   group by p.anuncio_id
)
update public.oferta o
   set nosso_minimo_centavos = s.minimo,
       nosso_minimo_desde    = s.desde,
       nossos_dias_lidos     = coalesce(s.dias, 0)
  from serie s
 where s.anuncio_id = o.anuncio_id
   and o.status in ('nova', 'aprovada')
   and o.nosso_minimo_desde is null;
