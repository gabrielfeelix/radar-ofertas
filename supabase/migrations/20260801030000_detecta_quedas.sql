-- =============================================================
-- 18 · O gatilho da queda — a oferta que existe no dia 1
--
-- `detecta_ofertas` responde "está barato contra a mediana que NÓS
-- observamos". É o diferencial do projeto e continua intacto — mas
-- exige 7 dias de série, e por isso a fila fica vazia na primeira
-- semana.
--
-- Esta função responde a outra pergunta: **caiu agora**. Ela compara
-- a leitura desta hora com a anterior, e funciona desde o primeiro
-- dia. É o que os canais concorrentes publicam.
--
-- AS DUAS CONVIVEM, E NÃO SE MISTURAM. A oferta nasce marcada com
-- `gatilho`, e é ele que decide o que a mensagem pode afirmar: queda
-- de três horas jamais vira "menor preço que observamos" (regra 3.4).
-- =============================================================


-- O limiar. Vive em dado, como todos os outros, para ser calibrado
-- sem publicar versão nova (D-023). Dez por cento é o ponto de
-- partida escolhido pelo dono: abaixo disso o preço mexe sozinho o
-- dia inteiro e a fila viraria ruído.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'queda_minima_pct', 10,
       'Queda mínima contra a leitura anterior para virar oferta de gatilho "queda".'
  from public.operacao
on conflict do nothing;

insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'queda_janela_horas', 24,
       'A queda só vale se o preço novo for o menor desta janela. Impede publicar oscilação de vaivém.'
  from public.operacao
on conflict do nothing;


-- -------------------------------------------------------------
-- detecta_quedas — comparar com a leitura anterior, não com a série
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
  for v_linha in select * from _quedas loop
    select * into v_vered from public.avalia_anuncio(v_linha.anuncio_id);

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

comment on function public.detecta_quedas is
  'Cria oferta de gatilho "queda" comparando a leitura desta hora com a anterior. Não substitui detecta_ofertas: responde outra pergunta.';

grant execute on function public.detecta_quedas() to service_role;


-- -------------------------------------------------------------
-- O terceiro lastro do modelo de mensagem
--
-- O modelo já tinha dois: com série e sem série. A queda é um
-- terceiro caso, e precisa de redação própria — ela não fala de
-- histórico nenhum, fala do que aconteceu hoje.
--
-- Padrão deliberadamente seco: "caiu de X para Y", sem adjetivo. É a
-- afirmação mais forte que uma queda de horas sustenta.
-- -------------------------------------------------------------
alter table public.modelo_mensagem
  add column lastro_queda text not null default 'caiu de {antes} para {agora} hoje';

comment on column public.modelo_mensagem.lastro_queda is
  'Usado quando oferta.gatilho = queda. NUNCA pode afirmar mínimo histórico: uma queda de horas não é série (regra 3.4).';
