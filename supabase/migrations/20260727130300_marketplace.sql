-- =============================================================
-- 04 · Marketplace e comissão por categoria
-- =============================================================

create table public.marketplace (
  id                    uuid primary key default gen_random_uuid(),
  operacao_id           uuid not null references public.operacao(id) on delete cascade,
  slug                  text not null,
  nome                  text not null,

  -- É dinheiro: se vazar, outra pessoa usa os seus links. Nunca
  -- aparece para papel que não seja dono — ver a policy na
  -- migration de RLS.
  afiliado_id           text,

  -- Nulo = não configurado, e é diferente de zero. Zero silencioso
  -- reprovaria todas as ofertas da loja por "comissão baixa", que é
  -- um diagnóstico errado para um problema de configuração.
  comissao_padrao_pct   numeric(5,2),

  -- Nulos até a Fase 0 provar com compra real. Preencher por
  -- suposição aqui destruiria a base da divisão de receita.
  suporta_subid         boolean,
  subid_tamanho_max     integer,

  -- Teto de retenção de preço imposto pela plataforma. A Amazon
  -- permite 24 horas. A regra vive como dado, e não como `if` no
  -- coletor, para mudar por loja sem tocar em código.
  cache_preco_max_horas integer,

  -- Falso desliga a loja da série histórica (D-003). A Amazon
  -- entra como fonte de oferta pontual, nunca como base de preço.
  base_de_historico     boolean not null default false,

  cor_texto             text,
  cor_fundo             text,

  ativo                 boolean not null default true,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  constraint marketplace_comissao_valida
    check (comissao_padrao_pct is null
           or (comissao_padrao_pct >= 0 and comissao_padrao_pct <= 100)),
  constraint marketplace_cache_positivo
    check (cache_preco_max_horas is null or cache_preco_max_horas > 0)
);

comment on table public.marketplace is
  'Lojas de origem, com ID de afiliado e as restrições que a plataforma impõe.';
comment on column public.marketplace.afiliado_id is
  'É dinheiro. Nunca exponha em policy para papel que não seja dono, nem no navegador.';
comment on column public.marketplace.base_de_historico is
  'Falso: os preços desta loja não formam série exibível (D-003).';

create unique index marketplace_slug_uk on public.marketplace (operacao_id, slug);

create trigger marketplace_atualizado_em
  before update on public.marketplace
  for each row execute function public.marca_atualizado_em();

alter table public.marketplace enable row level security;

-- Cor de terceiro não vira token de design: pertence a outra
-- pessoa e muda quando ela quiser. Vive como dado.
insert into public.marketplace
  (operacao_id, slug, nome, cache_preco_max_horas, base_de_historico, cor_texto, cor_fundo)
select o.id, v.slug, v.nome, v.cache, v.hist, v.txt, v.bg
  from public.operacao o,
       (values
         ('mercado_livre', 'Mercado Livre', null::integer, true,  '#8A7A00', '#FBF7D6'),
         ('shopee',        'Shopee',        null::integer, true,  '#C1441F', '#FDEDE7'),
         ('amazon',        'Amazon',          24::integer, false, '#9A6210', '#FBF1E1')
       ) as v(slug, nome, cache, hist, txt, bg);

-- =============================================================
-- Comissão por categoria
--
-- Nunca fixe percentual no código: ele muda a cada campanha
-- sazonal, e um número errado aqui distorce a nota de uma
-- categoria inteira de uma vez.
--
-- A vigência é por período para que a comissão estimada de uma
-- oferta antiga continue explicável depois que o percentual mudar.
-- =============================================================
create table public.comissao_categoria (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references public.operacao(id) on delete cascade,
  marketplace_id uuid not null references public.marketplace(id) on delete cascade,
  -- Chaveado por NICHO, não por texto livre.
  --
  -- A primeira modelagem usava `categoria` como texto. O efeito no
  -- teste foi imediato e teria sido pior em produção: ninguém
  -- preenche texto livre, nenhuma linha casa, a comissão estimada
  -- vira zero e TODA oferta é reprovada por "comissão baixa" — um
  -- diagnóstico errado para um problema de configuração.
  --
  -- Nicho é entidade desde a D-019, é o que já existe preenchido, e
  -- é o grão em que a loja de fato paga diferente.
  nicho_id       uuid not null references public.nicho(id) on delete cascade,
  percentual     numeric(5,2) not null,
  vigente_desde  date not null default current_date,
  vigente_ate    date,
  criado_em      timestamptz not null default now(),

  constraint comissao_percentual_valido check (percentual >= 0 and percentual <= 100),
  constraint comissao_periodo_valido
    check (vigente_ate is null or vigente_ate >= vigente_desde)
);

comment on table public.comissao_categoria is
  'Percentual por nicho e loja, com vigência. Nunca fixe percentual no código: muda por campanha.';

-- Impede dois percentuais vigentes para o mesmo nicho na mesma
-- loja, o que faria a comissão estimada depender de qual linha o
-- banco devolvesse primeiro.
create unique index comissao_vigente_uk
  on public.comissao_categoria (marketplace_id, nicho_id)
  where vigente_ate is null;

alter table public.comissao_categoria enable row level security;
