-- =============================================================
-- 15 · Expiração da imagem do produto
--
-- A regra 3.3 tratava só de preço. A política da Amazon é mais dura
-- com imagem do que com preço, e nós aplicávamos metade dela:
--
--   preço e demais conteúdos   até 24h de cache
--   IMAGEM                     não pode guardar de jeito nenhum;
--                              só o LINK para ela, e por até 24h
--
-- Literal: "You will not store or cache Product Advertising Content
-- consisting of an image, but you may store a link to Product
-- Advertising Content consisting of an image for up to 24 hours."
--
-- Guardávamos `produto.imagem_url` sem prazo e sem regra por loja.
-- Hoje é inofensivo porque não existe coleta de imagem — deixa de
-- ser no dia em que existir, e o componente de interface já está
-- pronto para receber a foto.
--
-- POR QUE NO ANÚNCIO, E NÃO NO PRODUTO
--
-- A política é da loja, e a loja é atributo do anúncio: o mesmo
-- produto pode ter anúncio na Shopee (imagem pode ficar) e na
-- Amazon (não pode). Com a URL no produto, não há como expirar uma
-- sem apagar a outra. `produto.imagem_url` continua existindo para
-- imagem que não vem de marketplace.
-- =============================================================

alter table public.anuncio
  add column imagem_url        text,
  add column imagem_obtida_em  timestamptz;

comment on column public.anuncio.imagem_url is
  'Link para a imagem na loja. NUNCA a imagem em si. Expira conforme a política da loja.';
comment on column public.anuncio.imagem_obtida_em is
  'Quando o link foi obtido. É o que permite expirá-lo — sem isto não há como saber a idade.';

-- Índice do expurgo: ele varre por idade, não por anúncio.
create index anuncio_imagem_expirada_idx
  on public.anuncio (imagem_obtida_em)
  where imagem_url is not null;

-- -------------------------------------------------------------
-- expurga_imagens_expiradas — a mesma forma de `expurga_precos_expirados`
--
-- Reusa `marketplace.cache_preco_max_horas`, e isso é deliberado: a
-- política que limita o preço é a mesma que limita a imagem. Duas
-- colunas separadas conviveriam com valores diferentes, e a
-- divergência só apareceria numa notificação da Amazon.
-- -------------------------------------------------------------
create or replace function public.expurga_imagens_expiradas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_removidas integer;
begin
  with expiradas as (
    update public.anuncio a
       set imagem_url = null,
           imagem_obtida_em = null
      from public.marketplace m
     where a.marketplace_id = m.id
       and a.imagem_url is not null
       and m.cache_preco_max_horas is not null
       and a.imagem_obtida_em < now() - make_interval(hours => m.cache_preco_max_horas)
    returning 1
  )
  select count(*) into v_removidas from expiradas;

  return v_removidas;
end;
$$;

comment on function public.expurga_imagens_expiradas is
  'Apaga link de imagem mais velho que a retenção da loja (regra 3.3). Roda junto do expurgo de preço.';

grant execute on function public.expurga_imagens_expiradas() to service_role;

-- -------------------------------------------------------------
-- A rotina diária passa a expurgar imagem junto com preço.
--
-- Recriada inteira porque migration aplicada não se altera (seção 6
-- do AGENTS.md). A única mudança é a linha do expurgo de imagem e o
-- campo novo no retorno.
-- -------------------------------------------------------------
create or replace function public.manutencao_diaria()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expurgados  integer;
  v_imagens     integer;
  v_compactados integer;
  v_exp record;
  v_det record;
begin
  select public.expurga_precos_expirados() into v_expurgados;
  select public.expurga_imagens_expiradas() into v_imagens;
  select * into v_exp from public.expira_ofertas();
  select public.compacta_serie_antiga() into v_compactados;
  select * into v_det from public.detecta_ofertas();

  return jsonb_build_object(
    'precos_expurgados',  v_expurgados,
    'imagens_expurgadas', v_imagens,
    'ofertas_expiradas',  jsonb_build_object('por_prazo', v_exp.por_prazo,
                                             'por_preco', v_exp.por_preco),
    'pontos_compactados', v_compactados,
    'anuncios_avaliados', v_det.avaliados,
    'ofertas_aprovadas',  v_det.aprovados
  );
end;
$$;

comment on function public.manutencao_diaria is
  'Rotina diária: expurgo de preço e de imagem, expiração, compactação e detecção, nesta ordem.';
