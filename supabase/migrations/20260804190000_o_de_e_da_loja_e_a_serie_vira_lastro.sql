-- =============================================================
-- 53 · O "de" passa a ser o da loja, e a nossa serie vira a prova
--
-- DUAS MUDANCAS QUE SO FAZEM SENTIDO JUNTAS. Decisao do dono em 04/08.
--
-- 1. O "DE" E DO VENDEDOR, SEMPRE
--
-- O leitor le "De R$ 100 por R$ 60" como o preco de tabela da loja.
-- Ate aqui, numa oferta de gatilho `queda`, ele recebia a NOSSA leitura
-- anterior nesse lugar. Sao coisas diferentes vestidas igual.
--
-- Medido antes de mexer: das 1.291 publicacoes enviadas, 1.222 sao do
-- gatilho `declarado` e ja usavam o "de" da loja. So as 69 de `queda`
-- estavam trocadas, e em 56 delas a loja declarava um "de" que nos
-- ignoravamos.
--
-- 2. E A NOSSA SERIE VIRA O LASTRO, QUE E ONDE ELA VALE
--
-- Perder a queda seria jogar fora o unico dado que nenhum concorrente
-- tem. Canal de oferta alheio repassa o que a loja diz; nos MEDIMOS. O
-- lugar disso e o lastro, que e a linha de confianca.
--
-- A frase antiga era redundante e o dono apontou: *"Caiu nas ultimas
-- horas: vimos o preco mudar"* diz duas vezes a mesma coisa. Se caiu, e
-- obvio que vimos. A nova carrega o NUMERO, que e o que se confere:
--
--   antes   ⚡ Caiu nas ultimas horas: vimos o preco mudar.
--   agora   ⚡ Baixou {queda}% desde a leitura de ontem.
--
-- "Baixou 18%" e verificavel e da confianca. "Vimos o preco mudar" nao
-- diz nada que o resto da mensagem ja nao diga.
--
-- A REGRA 3.4 CONTINUA VALENDO POR CIMA: queda nao afirma minimo
-- historico, por mais fundo que seja o desconto. Uma queda de tres
-- horas nao e serie. `pode_afirmar_minimo` segue falso aqui.
--
-- QUANDO A LOJA NAO DECLARA NADA, a referencia continua sendo a nossa
-- leitura anterior: e melhor um "de" nosso, com o lastro dizendo que
-- fomos nos que medimos, do que nenhum "de". Sao 13 dos 69 casos.
--
-- E QUANDO O QUE ELA DECLARA E ABSURDO, tambem: o `original_price` do
-- ML e frequentemente inflado, e o teto de desconto declarado
-- (`desconto_declarado_teto_pct`, 70%) ja existia para o gatilho
-- `declarado`. Agora vale aqui tambem.
-- =============================================================

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
  v_referencia integer;
  v_desconto   numeric;
  v_teto       numeric;
begin
  create temp table _quedas on commit drop as
  with leituras as (
    -- As duas últimas leituras de cada anúncio. `coletado_em` e não
    -- `dia_local`: a queda acontece dentro do dia, e é por isso que a
    -- coleta passou a ser horária.
    select p.anuncio_id,
           p.preco_centavos,
           p.coletado_em,
           row_number() over (partition by p.anuncio_id order by p.coletado_em desc) as pos
      from public.preco_ponto p
     where p.disponivel
  ),
  par as (
    select o.id as operacao_id,
           coalesce(max(case when pa.chave = 'queda_minima_pct'   then pa.valor end), 10) as minima_pct,
           coalesce(max(case when pa.chave = 'queda_janela_horas' then pa.valor end), 24) as janela_horas
      from public.operacao o
      left join public.parametro pa
             on pa.operacao_id = o.id and pa.nicho_id is null
     group by o.id
  )
  select a.id           as anuncio_id,
         a.operacao_id,
         agora.preco_centavos   as preco_agora,
         antes.preco_centavos   as preco_antes,
         a.preco_original_centavos as de_da_loja,
         round(((antes.preco_centavos - agora.preco_centavos)::numeric
                 / antes.preco_centavos) * 100, 2) as queda_pct
    from leituras agora
    join leituras antes on antes.anuncio_id = agora.anuncio_id and antes.pos = 2
    join public.anuncio a on a.id = agora.anuncio_id
    join par on par.operacao_id = a.operacao_id
   where agora.pos = 1
     and a.ativo
     and agora.preco_centavos < antes.preco_centavos
     -- A queda precisa ser grande o bastante para valer um post.
     and ((antes.preco_centavos - agora.preco_centavos)::numeric
            / antes.preco_centavos) * 100 >= par.minima_pct
     -- E precisa ser o menor da janela. Sem isto, um preço que sobe e
     -- desce publicaria toda vez que descesse — o grupo recebe a
     -- "promoção" do mesmo produto três vezes por dia e silencia.
     and agora.preco_centavos <= (
       select min(p2.preco_centavos)
         from public.preco_ponto p2
        where p2.anuncio_id = a.id
          and p2.disponivel
          and p2.coletado_em >= now() - (par.janela_horas || ' hours')::interval
     )
     -- Já existe oferta esperando decisão para este anúncio: não se
     -- empilha uma segunda. Quem decide já tem o caso na mão.
     and not exists (
       select 1 from public.oferta of
        where of.anuncio_id = a.id
          and of.status in ('nova', 'aprovada')
     );

  select count(*) into v_avaliados from _quedas;

  -- A NOTA VEM DO MOTOR, não daqui. `avalia_anuncio` já sabe pontuar
  -- desconto, comissão e vendedor; reimplementar isso seria a segunda
  -- implementação da regra que o AGENTS.md proíbe na seção 5. O que
  -- muda é só CONTRA O QUE o desconto é medido: aqui é a leitura
  -- anterior, não a mediana da série.
  select coalesce(max(valor), 70) into v_teto
    from public.parametro
   where chave = 'desconto_declarado_teto_pct' and nicho_id is null;

  for v_linha in select * from _quedas loop
    select * into v_vered from public.avalia_anuncio(v_linha.anuncio_id);

    /*
      O "DE" E DA LOJA, E NAO NOSSO.

      Ate 04/08 a referencia de uma queda era a NOSSA leitura anterior.
      Isso confunde duas coisas que o leitor le como uma so: ele entende
      "De" como o preco de tabela da loja, e recebia a nossa medicao no
      lugar dela. Decisao do dono em 04/08: o "De" vem sempre do
      vendedor; a nossa serie serve para dizer se a promocao e real, e
      um dia para o grafico de historico.

      A nossa leitura anterior continua sendo a queda: ela e o que
      DETECTA a oferta, e o lastro e quem a conta. So deixa de ser o
      numero exibido como "De".

      Fica com a nossa leitura em dois casos: quando a loja nao declara
      nada, e quando o que ela declara daria um desconto acima do teto
      (o `original_price` do ML e frequentemente inflado, e o teto ja
      existia para o gatilho `declarado`).
    */
    v_referencia := v_linha.preco_antes;

    if v_linha.de_da_loja is not null
       and v_linha.de_da_loja > v_linha.preco_agora
       and round(((v_linha.de_da_loja - v_linha.preco_agora)::numeric
                   / v_linha.de_da_loja) * 100) <= v_teto
    then
      v_referencia := v_linha.de_da_loja;
    end if;

    v_desconto := round(((v_referencia - v_linha.preco_agora)::numeric
                          / v_referencia) * 100, 2);

    insert into public.oferta (
      operacao_id, anuncio_id,
      preco_atual_centavos, preco_anterior_centavos,
      preco_referencia_centavos, referencia_janela_dias,
      dias_de_serie, desconto_pct, comissao_estimada_centavos,
      -- SEMPRE falso numa queda, por mais fundo que seja o desconto:
      -- afirmar mínimo histórico exige série, e uma queda de três
      -- horas não é série (regra 3.4).
      pode_afirmar_minimo,
      nota, nota_desconto, nota_comissao, nota_vendedor,
      gatilho
    )
    values (
      v_linha.operacao_id, v_linha.anuncio_id,
      v_linha.preco_agora, v_linha.preco_antes,
      -- A referência de uma queda é o preço de antes: é contra ele
      -- que o desconto anunciado foi medido, e é o único número que
      -- a mensagem pode citar honestamente.
      v_referencia, 0,
      coalesce(v_vered.dias_de_serie, 0),
      v_desconto,
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
comment on function public.detecta_quedas is
  'Oferta a partir de queda entre duas leituras nossas. O "de" exibido vem da LOJA quando ela declara um dentro do teto; a nossa leitura anterior fica no lastro, que e onde ela vale (decisao de 04/08).';

-- -------------------------------------------------------------
-- A frase da queda, sem redundancia e com o numero
-- -------------------------------------------------------------
update public.modelo_mensagem
   set lastro_queda = '⚡ Baixou {queda}% desde a leitura de ontem.',
       atualizado_em = now()
 where lastro_queda not like '%{queda}%';

comment on column public.modelo_mensagem.lastro_queda is
  'Usado quando oferta.gatilho = queda. Carrega o {queda}, que e a nossa medicao entre duas leituras: e o unico numero da mensagem que nao veio da loja, e por isso e ele que sustenta a confianca. Nunca afirma minimo historico (regra 3.4).';
