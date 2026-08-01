-- =============================================================
-- 23 · O desconto que a loja declara (Frente C de docs/otimizacao.md)
--
-- O PROBLEMA QUE ISTO RESOLVE, e ele é de aritmética, não de código:
-- a queda é medida contra a NOSSA leitura anterior, então todo anúncio
-- novo precisa de duas leituras antes de poder virar oferta, e a
-- maioria dos preços não mexe de uma hora para a seguinte. Resultado
-- medido em 01/08: 499 anúncios no banco e 6 ofertas desde sempre.
--
-- E o sinal existe hoje, na MESMA resposta que o coletor já lê. O
-- `products/{id}/items` do Mercado Livre devolve `original_price` ao
-- lado de `price`:
--
--   MLB6156919544   price 160,90   original_price 278,85
--
-- Isso é a loja dizendo "isto está em promoção", sem precisar de
-- histórico nenhum.
--
-- A RESSALVA, e ela é o coração desta migration: o `original_price` do
-- Mercado Livre é notoriamente inflado. É exatamente a mentira que a
-- regra 3.4 proíbe repetir e que queima o canal no dia em que alguém
-- confere. Então ele entra com três amarras:
--
--   1. é PENEIRA DE ENTRADA, não argumento de venda
--   2. a mensagem ATRIBUI a alegação à loja, nunca a assume
--   3. desconto declarado acima de um teto é suspeito, não oportunidade
-- =============================================================

-- -------------------------------------------------------------
-- O que o anúncio passa a guardar
-- -------------------------------------------------------------
alter table public.anuncio
  add column if not exists preco_original_centavos integer,
  add column if not exists promocoes text[],
  add column if not exists preco_original_visto_em timestamptz;

comment on column public.anuncio.preco_original_centavos is
  'O "de" que a LOJA declara (original_price do ML). Alegação de terceiro, não medição nossa: serve para achar candidato e a mensagem sempre atribui à loja. Nunca vira lastro de mínimo histórico (regra 3.4).';

comment on column public.anuncio.promocoes is
  'Os `deal_ids` do anúncio: campanhas do marketplace de que ele participa (oferta do dia, relâmpago). Vazio não quer dizer sem desconto.';

comment on column public.anuncio.preco_original_visto_em is
  'Quando o preço original foi lido. Sem isto não há como saber se a promoção declarada é de agora ou de uma leitura velha.';

-- O índice é para a detecção, que varre justamente quem tem os dois.
create index if not exists anuncio_desconto_declarado_idx
  on public.anuncio (operacao_id)
  where preco_original_centavos is not null and ativo;


-- -------------------------------------------------------------
-- O terceiro gatilho
--
-- `serie` responde "está barato para o histórico?", `queda` responde
-- "baixou agora?", e `declarado` responde "a loja marcou promoção?".
-- São três perguntas diferentes e cada uma autoriza a mensagem a dizer
-- uma coisa diferente. Por isso é gatilho e não um campo booleano ao
-- lado.
-- -------------------------------------------------------------
alter table public.oferta
  drop constraint if exists oferta_gatilho_valido;

alter table public.oferta
  add constraint oferta_gatilho_valido
  check (gatilho in ('serie', 'queda', 'declarado'));


-- O quarto lastro. Repare que ele NOMEIA A LOJA como quem afirma: é a
-- diferença entre repetir a mentira dos concorrentes ("menor valor
-- histórico!") e reportar honestamente o que o anúncio diz.
alter table public.modelo_mensagem
  add column if not exists lastro_declarado text not null
    default 'a loja marcou de {antes} por {agora}';

comment on column public.modelo_mensagem.lastro_declarado is
  'Usado quando oferta.gatilho = declarado. TEM QUE ATRIBUIR À LOJA: o preço de antes é alegação dela, não medição nossa. Nunca pode afirmar mínimo histórico (regra 3.4).';


-- -------------------------------------------------------------
-- As comportas do desconto declarado
-- -------------------------------------------------------------
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'desconto_declarado_min_pct', 25,
       'Desconto mínimo declarado pela loja para virar candidato. Alto de propósito: 10% declarado é preço de tabela com maquiagem.'
  from public.operacao
on conflict do nothing;

-- O teto é contraintuitivo e é a comporta mais importante daqui: 80%
-- de desconto declarado quase nunca é oportunidade, é "de" inventado.
-- Publicar isso é virar o concorrente que a gente não quer ser.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'desconto_declarado_teto_pct', 70,
       'Acima disto o desconto declarado é suspeito, não oportunidade: o "de" foi inflado. Não vira oferta.'
  from public.operacao
on conflict do nothing;


-- -------------------------------------------------------------
-- A detecção
--
-- Espelha `detecta_quedas` de propósito, inclusive no formato de
-- retorno: quem chama as duas na rotina trata as duas igual.
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
     -- A promoção declarada tem que ser da leitura de agora. Sem isto,
     -- um `original_price` lido semana passada republicaria o mesmo
     -- produto todo dia como se fosse novidade.
     and a.preco_original_visto_em >= now() - interval '6 hours'
     and ((a.preco_original_centavos - a.preco_leitura_centavos)::numeric
            / a.preco_original_centavos) * 100 >= par.minimo_pct
     and ((a.preco_original_centavos - a.preco_leitura_centavos)::numeric
            / a.preco_original_centavos) * 100 <= par.teto_pct
     -- Uma oferta viva por anúncio, qualquer que seja o gatilho. Se a
     -- queda já pegou este anúncio, a queda vale mais: ela é medição
     -- nossa, e esta é alegação da loja.
     and not exists (
       select 1 from public.oferta of
        where of.anuncio_id = a.id and of.status in ('nova', 'aprovada')
     )
     -- E não republica o que já saiu: sem isto o mesmo "de" inflado
     -- viraria oferta nova a cada rodada, para sempre, porque o
     -- `original_price` não muda quando o preço não muda.
     and not exists (
       select 1 from public.oferta of2
        where of2.anuncio_id = a.id
          and of2.gatilho = 'declarado'
          and of2.criado_em >= now() - interval '7 days'
     );

  select count(*) into v_avaliados from _declarados;

  for v_linha in select * from _declarados loop
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
      v_linha.preco_agora, v_linha.preco_declarado,
      v_linha.preco_declarado, 0,
      coalesce(v_vered.dias_de_serie, 0),
      v_linha.desconto_pct,
      coalesce(v_vered.comissao_estimada_centavos, 0),
      -- SEMPRE falso, e não por descuido: preço alegado pela loja não
      -- é série, e afirmar mínimo em cima dele é a regra 3.4 violada.
      false,
      coalesce(v_vered.nota, 0),
      coalesce(v_vered.nota_desconto, 0),
      coalesce(v_vered.nota_comissao, 0),
      coalesce(v_vered.nota_vendedor, 0),
      'declarado'
    );

    v_aprovados := v_aprovados + 1;
  end loop;

  return query select v_avaliados, v_aprovados;
end;
$$;

comment on function public.detecta_declarados is
  'Cria oferta de gatilho "declarado" a partir do original_price da loja. Não substitui detecta_quedas: aquela mede, esta reporta alegação de terceiro.';

grant execute on function public.detecta_declarados() to service_role;
