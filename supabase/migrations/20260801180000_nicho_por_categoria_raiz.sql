-- =============================================================
-- 27 · Nicho por categoria raiz, e um nicho para cada grupo futuro
--
-- Decisão do dono em 01/08, depois de olhar como os concorrentes
-- montam a automação deles: *"por mim a gente pode buscar todos os
-- produtos possíveis, desde que a gente filtre bem legal pra um nicho
-- específico. Até porque a gente vai criar grupo de tudo. Grupo de
-- beleza, grupo de tecnologia, e assim por diante"*.
--
-- O PROBLEMA DE ESCALA QUE ISSO CRIA, e ele é real: mapear domínio a
-- domínio não sobrevive a "buscar tudo". Só a base de hoje tem 100
-- domínios; o Mercado Livre inteiro tem milhares. A fila de triagem
-- viraria trabalho sem fim, e produto de domínio não mapeado não
-- publica.
--
-- A SAÍDA É MAPEAR DOIS NÍVEIS, e não um:
--
--   1. `nicho_categoria` — a categoria RAIZ decide, e são 28 no site
--      inteiro. Cobre tudo, para sempre, sem manutenção.
--   2. `nicho_dominio` — continua existindo e VENCE quando houver
--      linha. É a exceção para quando a raiz erra.
--
-- O caso que prova a necessidade dos dois: suplemento fica sob a raiz
-- "Saúde", e a raiz não está errada. Só que suplemento vende como
-- categoria própria e já tem 61 produtos aqui, então merece canal
-- separado. A regra grossa acerta o geral; a fina resolve o caso.
-- =============================================================

-- A categoria raiz do anúncio, guardada para não reconsultar.
alter table public.anuncio
  add column if not exists categoria_raiz text,
  add column if not exists categoria_folha text,
  add column if not exists frete_gratis boolean;

comment on column public.anuncio.categoria_folha is
  'A categoria exata do anúncio. A raiz sai dela, e ela fica guardada para não reconsultar a árvore.';

-- FRETE GRÁTIS É O DADO MAIS SUBAPROVEITADO DA API. Vem em
-- `shipping.free_shipping` desde sempre e nós descartávamos. Todo
-- canal de oferta que funciona põe isso na mensagem: em produto
-- barato o frete é metade do preço, e é a linha que decide a compra.
comment on column public.anuncio.frete_gratis is
  'Se a loja declara frete grátis. Nulo = não medimos, e a mensagem omite a linha em vez de afirmar que não tem.';

comment on column public.anuncio.categoria_raiz is
  'A categoria de primeiro nível do marketplace (`MLB1071` = Animais). É a regra grossa de nicho; `nicho_dominio` é a fina e vence.';

create index if not exists anuncio_categoria_raiz_idx
  on public.anuncio (categoria_raiz)
  where categoria_raiz is not null;


-- -------------------------------------------------------------
-- Os nichos que os grupos futuros vão precisar
--
-- Criados agora, vazios de canal, de propósito: o produto já está
-- entrando e a série de preço já está correndo. Quando o canal abrir,
-- ele nasce com catálogo e histórico em vez de esperar duas semanas
-- para ter o que publicar.
-- -------------------------------------------------------------
insert into public.nicho (operacao_id, slug, nome)
select o.id, n.slug, n.nome
  from public.operacao o
  cross join (values
    ('beleza',     'Beleza e cuidado pessoal'),
    ('saude',      'Saúde'),
    ('esporte',    'Esporte e fitness'),
    ('ferramenta', 'Ferramentas e construção'),
    ('mercado',    'Mercado e bebidas'),
    ('bebe',       'Bebês'),
    ('brinquedo',  'Brinquedos e hobbies'),
    ('moda',       'Moda e acessórios'),
    ('games',      'Games'),
    ('automotivo', 'Automotivo'),
    ('papelaria',  'Papelaria e escritório')
  ) as n(slug, nome)
on conflict do nothing;


-- -------------------------------------------------------------
-- A regra grossa: categoria raiz → nicho
-- -------------------------------------------------------------
create table if not exists public.nicho_categoria (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references public.operacao (id) on delete cascade,
  marketplace_id uuid not null references public.marketplace (id) on delete cascade,
  categoria_raiz text not null,
  nome_categoria text,
  -- Nulo = categoria conhecida que não vira canal. Mesma semântica de
  -- `nicho_dominio`: nulo é decisão, ausência é "ninguém olhou".
  nicho_id       uuid references public.nicho (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (operacao_id, marketplace_id, categoria_raiz)
);

comment on table public.nicho_categoria is
  'Categoria raiz do marketplace para nosso nicho. É a regra GROSSA, que cobre o site inteiro com 28 linhas. `nicho_dominio` é a fina e vence quando houver linha.';

alter table public.nicho_categoria enable row level security;

create policy nicho_categoria_le on public.nicho_categoria
  for select using (operacao_id = public.operacao_atual());

create policy nicho_categoria_escreve on public.nicho_categoria
  for all using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));


-- As 28 raízes do MLB, conferidas contra `sites/MLB/categories` em
-- 01/08. As que respondem 404 no `highlights` (Carros, Imóveis,
-- Ingressos, Serviços) entram assim mesmo: elas não são fonte de
-- descoberta, mas um link colhido de canal alheio pode cair nelas.
insert into public.nicho_categoria (operacao_id, marketplace_id, categoria_raiz, nome_categoria, nicho_id)
select m.operacao_id, m.id, c.raiz, c.nome, n.id
  from public.marketplace m
  cross join (values
    ('MLB1071',   'Animais',                     'pet'),
    ('MLB1574',   'Casa, Móveis e Decoração',    'casa'),
    ('MLB5726',   'Eletrodomésticos',            'casa'),
    ('MLB1000',   'Eletrônicos, Áudio e Vídeo',  'eletronico'),
    ('MLB1648',   'Informática',                 'eletronico'),
    ('MLB1051',   'Celulares e Telefones',       'eletronico'),
    ('MLB1039',   'Câmeras e Acessórios',        'eletronico'),
    ('MLB1246',   'Beleza e Cuidado Pessoal',    'beleza'),
    ('MLB264586', 'Saúde',                       'saude'),
    ('MLB1276',   'Esportes e Fitness',          'esporte'),
    ('MLB263532', 'Ferramentas',                 'ferramenta'),
    ('MLB1500',   'Construção',                  'ferramenta'),
    ('MLB1403',   'Alimentos e Bebidas',         'mercado'),
    ('MLB1384',   'Bebês',                       'bebe'),
    ('MLB1132',   'Brinquedos e Hobbies',        'brinquedo'),
    ('MLB1430',   'Calçados, Roupas e Bolsas',   'moda'),
    ('MLB3937',   'Joias e Relógios',            'moda'),
    ('MLB1144',   'Games',                       'games'),
    ('MLB5672',   'Acessórios para Veículos',    'automotivo'),
    ('MLB1368',   'Arte, Papelaria e Armarinho', 'papelaria')
  ) as c(raiz, nome, nicho_slug)
  join public.nicho n on n.operacao_id = m.operacao_id and n.slug = c.nicho_slug
 where m.slug = 'mercado_livre'
on conflict do nothing;

-- As raízes que existem e não viram canal. Linha com nicho nulo, e não
-- ausência, para não voltarem à triagem toda semana.
insert into public.nicho_categoria (operacao_id, marketplace_id, categoria_raiz, nome_categoria, nicho_id)
select m.operacao_id, m.id, c.raiz, c.nome, null
  from public.marketplace m
  cross join (values
    ('MLB271599', 'Agro'),
    ('MLB1367',   'Antiguidades e Coleções'),
    ('MLB12404',  'Festas e Lembrancinhas'),
    ('MLB1182',   'Instrumentos Musicais'),
    ('MLB1196',   'Livros, Revistas e Comics'),
    ('MLB1168',   'Música, Filmes e Seriados'),
    ('MLB1499',   'Indústria e Comércio'),
    ('MLB1953',   'Mais Categorias'),
    ('MLB1743',   'Carros, Motos e Outros'),
    ('MLB1459',   'Imóveis'),
    ('MLB218519', 'Ingressos'),
    ('MLB1540',   'Serviços')
  ) as c(raiz, nome)
 where m.slug = 'mercado_livre'
on conflict do nothing;


-- -------------------------------------------------------------
-- A decisão, num lugar só
--
-- Fina vence grossa. Repare que a distinção entre "linha com nicho
-- nulo" e "sem linha" some aqui de propósito: quem coleta só quer
-- saber em que nicho põe, e nulo responde as duas coisas igual. A
-- diferença importa na triagem, e para isso existem as views.
-- -------------------------------------------------------------
create or replace function public.nicho_do_anuncio(
  p_marketplace_id uuid,
  p_dominio        text,
  p_categoria_raiz text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nd.nicho_id from public.nicho_dominio nd
      where nd.marketplace_id = p_marketplace_id
        and nd.dominio_externo = p_dominio
        and nd.nicho_id is not null
      limit 1),
    -- Só cai na raiz se o domínio não tiver uma decisão explícita.
    (select nc.nicho_id from public.nicho_categoria nc
      where nc.marketplace_id = p_marketplace_id
        and nc.categoria_raiz = p_categoria_raiz
      limit 1)
  )
  -- E o domínio marcado como "não roteia" continua não roteando,
  -- mesmo que a raiz dele tenha nicho. Sem isto, `MLB-SUPPLEMENTS`
  -- marcado como fora voltaria por "Saúde", e a decisão de não
  -- publicar seria desfeita pela regra grossa.
  where not exists (
    select 1 from public.nicho_dominio nd2
     where nd2.marketplace_id = p_marketplace_id
       and nd2.dominio_externo = p_dominio
       and nd2.nicho_id is null
  );
$$;

comment on function public.nicho_do_anuncio is
  'O nicho de um anúncio: domínio vence categoria raiz, e domínio marcado como "não roteia" bloqueia os dois. Nulo = não publica.';

grant execute on function public.nicho_do_anuncio(uuid, text, text) to service_role;


-- A fila de triagem passa a ser por CATEGORIA, que é onde o trabalho
-- rende: mapear uma raiz resolve centenas de domínios de uma vez.
create or replace view public.categoria_sem_mapeamento as
  select a.marketplace_id,
         a.categoria_raiz,
         count(*) as anuncios
    from public.anuncio a
   where a.categoria_raiz is not null
     and not exists (
       select 1 from public.nicho_categoria nc
        where nc.marketplace_id = a.marketplace_id
          and nc.categoria_raiz = a.categoria_raiz
     )
   group by a.marketplace_id, a.categoria_raiz
   order by count(*) desc;

comment on view public.categoria_sem_mapeamento is
  'Categorias raiz presentes no catálogo e ausentes do mapeamento. Curta por natureza: são 28 no site inteiro.';


-- -------------------------------------------------------------
-- A linha de frete grátis na mensagem
--
-- Os canais concorrentes põem isso sempre, e não é enfeite: em produto
-- de R$ 40 o frete é metade do preço, e "frete grátis" é a linha que
-- decide a compra. Nós tínhamos o dado na resposta da API desde o
-- primeiro dia e jogávamos fora.
--
-- Ela entra ANTES do link e depois do lastro, que é onde a leitura
-- procura o custo total. E some inteira quando não há frete grátis:
-- rótulo órfão numa mensagem por dia é detalhe, em trinta é sujeira.
-- -------------------------------------------------------------
alter table public.modelo_mensagem
  add column if not exists linha_frete text not null default '🚚 Frete grátis';

comment on column public.modelo_mensagem.linha_frete is
  'O que a variável {frete} vira quando a loja declara frete grátis. Some quando não declara ou quando não medimos.';

-- Põe {frete} no corpo dos modelos que ainda não têm, logo antes do
-- link. `position` em vez de `like` para não depender de escape.
update public.modelo_mensagem
   set corpo = replace(corpo, '{link}', '{frete}' || chr(10) || chr(10) || '{link}')
 where position('{frete}' in corpo) = 0
   and position('{link}' in corpo) > 0;
