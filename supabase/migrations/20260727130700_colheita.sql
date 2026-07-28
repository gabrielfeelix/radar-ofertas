-- =============================================================
-- 08 · Colheita de canais de terceiros (D-012)
--
-- Canal alheio é fonte de DESCOBERTA, nunca fonte da verdade. O
-- que se aproveita é o fato — que o produto existe e pode estar
-- barato. Se está barato mesmo, quem decide é a nossa série, pelas
-- mesmas comportas de qualquer outro anúncio.
--
-- O ganho maior não é a oferta, é o CATÁLOGO: todo produto
-- avistado entra no radar e começa a acumular série. Sem isso o
-- catálogo cresceria na velocidade de uma pessoa colando link à
-- mão, e 30 ofertas por dia nunca sairiam do papel.
--
-- O QUE MUDOU NESTA REESCRITA
--
-- A primeira versão inseria produto com nicho nulo, contornando a
-- regra da D-019 sem que nada acusasse. O efeito previsível: alguns
-- milhares de produtos sem nicho, que nunca chegam a canal nenhum e
-- somem do fluxo em silêncio — e a tela "Precisa de atenção",
-- cuja regra é "só aparece aqui o que exige ação humana", viraria
-- três mil linhas no primeiro dia.
--
-- Agora o produto HERDA o nicho da fonte. Canal de pet só traz
-- produto de pet, então sobra exceção, não regra.
-- =============================================================

create table public.fonte_descoberta (
  id                uuid primary key default gen_random_uuid(),
  operacao_id       uuid not null references public.operacao(id) on delete cascade,
  plataforma        text not null default 'telegram',
  -- Nome do canal sem o @.
  identificador     text not null,
  nome              text,

  -- web_publica   — lê t.me/s/<canal>: conteúdo público, sem conta
  --                 nossa envolvida, sem risco de banimento.
  -- conta_usuario — lê por conta dedicada. Alcança grupo fechado,
  --                 com o risco registrado na D-012.
  tipo_leitura      text not null default 'web_publica',

  -- O nicho que os produtos deste canal herdam. Era texto livre na
  -- primeira versão, o que ressuscitava exatamente o problema que a
  -- D-019 matou no resto do sistema.
  nicho_id          uuid references public.nicho(id) on delete set null,

  ativo             boolean not null default true,
  ultima_leitura_em timestamptz,
  ultimo_post_id    bigint,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  constraint fonte_plataforma_valida check (plataforma in ('telegram')),
  constraint fonte_tipo_leitura_valido check (tipo_leitura in ('web_publica', 'conta_usuario'))
);

comment on table public.fonte_descoberta is
  'Canal de terceiro que lemos em busca de candidatas. Nunca publicamos nada nele.';
comment on column public.fonte_descoberta.nicho_id is
  'Os produtos colhidos herdam este nicho. Sem ele, a colheita produz catálogo não roteável.';

create unique index fonte_descoberta_uk
  on public.fonte_descoberta (operacao_id, plataforma, identificador);
create index fonte_descoberta_fila_idx
  on public.fonte_descoberta (ultima_leitura_em asc nulls first) where ativo;

create trigger fonte_descoberta_atualizado_em
  before update on public.fonte_descoberta
  for each row execute function public.marca_atualizado_em();

alter table public.fonte_descoberta enable row level security;

-- -------------------------------------------------------------
-- Menção: um link de produto avistado num canal.
--
-- Guardar isto, e não só o anúncio resultante, responde a pergunta
-- que decide onde investir leitura: QUAL CANAL RENDE. Um canal que
-- traz 300 links por dia e nenhum vira oferta é ruído caro, e sem
-- esta tabela isso ficaria invisível.
-- -------------------------------------------------------------
create table public.mencao (
  id                     bigint generated always as identity primary key,
  operacao_id            uuid not null references public.operacao(id) on delete cascade,
  fonte_id               uuid not null references public.fonte_descoberta(id) on delete cascade,
  post_externo_id        bigint not null,
  publicada_em           timestamptz,

  -- O link como apareceu: quase sempre encurtado e carregando o
  -- código de afiliado de OUTRA pessoa. Guardado para auditoria.
  -- Nunca é o link que publicamos.
  url_bruta              text not null,
  url_resolvida          text,

  marketplace_id         uuid references public.marketplace(id) on delete set null,
  sku_externo            text,
  anuncio_id             uuid references public.anuncio(id) on delete set null,

  -- Alegação de terceiro, não dado de preço: nunca entra em
  -- preco_ponto. Serve para comparar depois com o preço que nós
  -- mesmos coletamos — é assim que se descobre canal que mente.
  preco_alegado_centavos integer,

  resultado              text not null default 'pendente',
  detalhe                text,
  vista_em               timestamptz not null default now(),
  processada_em          timestamptz,

  constraint mencao_resultado_valido check (resultado in (
    'pendente', 'anuncio_novo', 'anuncio_existente',
    'loja_desconhecida', 'nao_reconhecido', 'erro'
  )),
  constraint mencao_preco_positivo
    check (preco_alegado_centavos is null or preco_alegado_centavos > 0)
);

comment on table public.mencao is
  'Link avistado num canal de terceiro. Fonte de descoberta, nunca de preço.';
comment on column public.mencao.preco_alegado_centavos is
  'O que o canal alegou. Alegação de terceiro: nunca entra em preco_ponto.';
comment on column public.mencao.url_bruta is
  'Link com o afiliado de outra pessoa. Auditoria apenas: nunca republicado.';

create unique index mencao_uk on public.mencao (fonte_id, post_externo_id, url_bruta);
-- Fila de calibragem do leitor de link. É a única superfície onde
-- a pendência do formato da Shopee e as falhas de resolução ficam
-- visíveis.
create index mencao_problema_idx on public.mencao (vista_em desc)
  where resultado in ('pendente', 'nao_reconhecido', 'loja_desconhecida', 'erro');
create index mencao_anuncio_idx on public.mencao (anuncio_id) where anuncio_id is not null;

alter table public.mencao enable row level security;

-- =============================================================
-- registra_mencao — entrada única da colheita.
-- =============================================================
create or replace function public.registra_mencao(
  p_fonte_id         uuid,
  p_post_externo_id  bigint,
  p_url_bruta        text,
  p_url_resolvida    text,
  p_marketplace_slug text,
  p_sku              text,
  p_titulo           text,
  p_preco_centavos   integer default null,
  p_publicada_em     timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operacao_id    uuid;
  v_nicho_id       uuid;
  v_marketplace_id uuid;
  v_anuncio_id     uuid;
  v_produto_id     uuid;
  v_resultado      text;
begin
  select f.operacao_id, f.nicho_id into v_operacao_id, v_nicho_id
    from public.fonte_descoberta f where f.id = p_fonte_id;

  if v_operacao_id is null then
    raise exception 'Fonte % não existe.', p_fonte_id;
  end if;

  select id into v_marketplace_id
    from public.marketplace
   where slug = p_marketplace_slug and operacao_id = v_operacao_id;

  if v_marketplace_id is null then
    insert into public.mencao (operacao_id, fonte_id, post_externo_id, url_bruta,
                               url_resolvida, resultado, detalhe, publicada_em, processada_em)
    values (v_operacao_id, p_fonte_id, p_post_externo_id, p_url_bruta, p_url_resolvida,
            'loja_desconhecida', p_marketplace_slug, p_publicada_em, now())
    on conflict (fonte_id, post_externo_id, url_bruta) do nothing;
    return 'loja_desconhecida';
  end if;

  select id into v_anuncio_id
    from public.anuncio
   where marketplace_id = v_marketplace_id and sku_externo = p_sku;

  if v_anuncio_id is null then
    -- O nicho vem da fonte. Canal de pet traz produto de pet, então
    -- o produto já nasce roteável em vez de cair na triagem.
    insert into public.produto (operacao_id, nicho_id, titulo_canonico)
    values (v_operacao_id, v_nicho_id, coalesce(nullif(trim(p_titulo), ''), p_sku))
    returning id into v_produto_id;

    insert into public.anuncio (operacao_id, produto_id, marketplace_id, url_original, sku_externo)
    values (v_operacao_id, v_produto_id, v_marketplace_id, p_url_resolvida, p_sku)
    returning id into v_anuncio_id;

    v_resultado := 'anuncio_novo';
  else
    v_resultado := 'anuncio_existente';
  end if;

  insert into public.mencao (
    operacao_id, fonte_id, post_externo_id, url_bruta, url_resolvida, marketplace_id,
    sku_externo, anuncio_id, preco_alegado_centavos, resultado, publicada_em, processada_em
  ) values (
    v_operacao_id, p_fonte_id, p_post_externo_id, p_url_bruta, p_url_resolvida, v_marketplace_id,
    p_sku, v_anuncio_id, p_preco_centavos, v_resultado, p_publicada_em, now()
  )
  on conflict (fonte_id, post_externo_id, url_bruta) do nothing;

  return v_resultado;
end;
$$;

comment on function public.registra_mencao is
  'Grava a menção e cadastra o anúncio se for novidade, herdando o nicho da fonte.';

-- =============================================================
-- View: rendimento da fonte — onde vale gastar leitura.
-- =============================================================
create view public.rendimento_da_fonte
with (security_invoker = true)
as
select
  f.id            as fonte_id,
  f.operacao_id,
  f.identificador,
  f.nome,
  f.tipo_leitura,
  f.nicho_id,
  f.ativo,
  f.ultima_leitura_em,
  count(m.id)                                               as mencoes,
  count(*) filter (where m.resultado = 'anuncio_novo')      as anuncios_novos,
  count(*) filter (where m.resultado = 'anuncio_existente') as ja_conhecidos,
  count(*) filter (where m.resultado in
    ('nao_reconhecido', 'erro', 'loja_desconhecida'))       as descartadas
from public.fonte_descoberta f
left join public.mencao m on m.fonte_id = f.id
group by f.id, f.operacao_id, f.identificador, f.nome, f.tipo_leitura, f.nicho_id,
         f.ativo, f.ultima_leitura_em;

comment on view public.rendimento_da_fonte is
  'Quanto cada canal rende. Canal que traz muito link e pouco anúncio é ruído caro.';
