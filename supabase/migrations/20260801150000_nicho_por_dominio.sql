-- =============================================================
-- 24 · O nicho vem do que o produto É (Frente B de docs/otimizacao.md)
--
-- O DEFEITO, e ele é a causa dos dois posts errados da primeira
-- madrugada: o nicho do produto era decidido por QUAL LISTA DE TERMOS
-- o encontrou. Se `products/search?q=racao gato` devolveu algo, esse
-- algo virava pet. Ponto.
--
-- E `products/search` casa por texto, de forma frouxa. O resultado
-- está no banco e é constrangedor:
--
--   Samsung Galaxy Buds Core      → nicho pet
--   Papel Fotográfico Adesivo A4  → nicho pet
--   Tanquinho Colormaq 15kg       → nicho pet
--   Whey Carnibol proteína        → nicho eletrônico  (e foi publicado)
--
-- A API já resolve, e a gente jogava fora: `products/{id}` devolve
-- `domain_id`, conferido contra a API de produção em 01/08:
--
--   MLB11665856 → MLB-CAT_AND_DOG_FOODS   (Ração Golden Gatos)
--   MLB50008608 → MLB-SUPPLEMENTS         (Whey Carnibol)
--
-- POR QUE UMA TABELA DE MAPEAMENTO, e não um `case` no código: é o
-- desenho que a literatura de e-commerce chama de tabela de
-- mapeamento, e a razão é que a taxonomia deles não é a nossa e nunca
-- vai ser. Forçar as duas a serem a mesma coisa quebra na primeira
-- loja nova. Aqui a Shopee e a Amazon entram depois sem refazer nada.
--
-- E ela vive no banco pelo mesmo motivo da D-023: mapear domínio novo
-- é trabalho de trinta segundos, não de publicar versão.
-- =============================================================

alter table public.anuncio
  add column if not exists dominio_externo text;

comment on column public.anuncio.dominio_externo is
  'O domínio do marketplace (`MLB-CAT_AND_DOG_FOODS`). É por ele que o nicho é decidido, e não pela busca que achou o produto.';

create index if not exists anuncio_dominio_idx
  on public.anuncio (dominio_externo)
  where dominio_externo is not null;


-- -------------------------------------------------------------
-- A tabela de mapeamento
-- -------------------------------------------------------------
create table if not exists public.nicho_dominio (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references public.operacao (id) on delete cascade,
  marketplace_id uuid not null references public.marketplace (id) on delete cascade,
  dominio_externo text not null,
  -- NULO É UMA RESPOSTA, e é a que faz a tela de triagem esvaziar:
  -- significa "conhecemos este domínio e ele não vai para canal
  -- nenhum". Sem isso, todo suplemento voltaria para a fila de
  -- classificação toda semana, e alguém decidiria a mesma coisa de
  -- novo. Domínio SEM LINHA é outra coisa: é o que ninguém olhou.
  nicho_id       uuid references public.nicho (id) on delete set null,
  observacao     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (operacao_id, marketplace_id, dominio_externo)
);

comment on table public.nicho_dominio is
  'Liga o domínio do marketplace ao nosso nicho. Linha com nicho nulo = decidido que não roteia. Sem linha = ninguém olhou ainda.';

alter table public.nicho_dominio enable row level security;

create policy nicho_dominio_le on public.nicho_dominio
  for select using (operacao_id = public.operacao_atual());

create policy nicho_dominio_escreve on public.nicho_dominio
  for all using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));


-- -------------------------------------------------------------
-- A semente
--
-- ESTES NOMES NÃO SÃO CHUTE. A primeira versão desta migration trazia
-- domínios inventados por semelhança (`MLB-PET_TOYS`, `MLB-COOKWARE`,
-- `MLB-CELLPHONE_CHARGERS`) e quase nenhum existia: o Mercado Livre
-- chama as mesmas coisas de `MLB-DOG_TOY_BONES`, `MLB-KITCHEN_POTS` e
-- `MLB-MOBILE_DEVICE_CHARGERS`. Adivinhar mapeamento é exatamente o
-- defeito que esta migration conserta, então a lista abaixo saiu de
-- perguntar à API o domínio dos 474 produtos que já estão no banco:
-- 100 domínios distintos, conferidos em 01/08.
-- -------------------------------------------------------------
insert into public.nicho_dominio (operacao_id, marketplace_id, dominio_externo, nicho_id, observacao)
select m.operacao_id, m.id, d.dominio, n.id, d.observacao
  from public.marketplace m
  -- O `cross join` vem ANTES do join ao nicho: `d` precisa estar em
  -- escopo para a condição `n.slug = d.nicho_slug` enxergá-lo.
  cross join (values
    -- Pet
    ('MLB-CAT_AND_DOG_FOODS',                    'pet', 'ração de cão e de gato, as duas no mesmo domínio'),
    ('MLB-PET_COLLARS',                          'pet', null),
    ('MLB-DOG_POTTY_PADS',                       'pet', null),
    ('MLB-CATS_LITTER',                          'pet', null),
    ('MLB-CAT_AND_DOG_BEDS',                     'pet', null),
    ('MLB-NON_PRESCRIPTION_PET_ANTIPARASITICS',  'pet', null),
    ('MLB-CAT_AND_DOG_SHAMPOOS_AND_CONDITIONERS','pet', null),
    ('MLB-CAT_SCRATCHERS',                       'pet', null),
    ('MLB-PET_TREATS',                           'pet', null),
    ('MLB-DOG_HOUSES',                           'pet', null),
    ('MLB-DOG_TOY_BONES',                        'pet', null),
    ('MLB-STUFFED_PET_TOYS',                     'pet', null),
    ('MLB-CAT_AND_DOG_DRINKERS_AND_FEEDERS',     'pet', null),
    ('MLB-PET_CARRIERS_AND_CARRYING_BAGS',       'pet', null),
    ('MLB-PET_SOAPS',                            'pet', null),
    ('MLB-BIRD_DRINKERS_AND_FEEDERS',            'pet', null),

    -- Casa e cozinha
    ('MLB-FOOD_STORAGE_CONTAINERS',              'casa', null),
    ('MLB-BATH_TOWELS',                          'casa', null),
    ('MLB-BED_SHEETS',                           'casa', null),
    ('MLB-DECORATIVE_CARPETS',                   'casa', null),
    ('MLB-MANUAL_INDOOR_CURTAINS_AND_BLINDS',    'casa', null),
    ('MLB-TOWEL_HOLDERS',                        'casa', null),
    ('MLB-VACUUM_AND_STEAM_CLEANERS',            'casa', null),
    ('MLB-VACUUM_CLEANER_BAGS',                  'casa', null),
    ('MLB-WASHING_MACHINES',                     'casa', null),
    ('MLB-ELECTRIC_SHOWER_HEADS',                'casa', null),
    ('MLB-QUILTS_AND_COVERLETS',                 'casa', null),
    ('MLB-MATTRESS_COVERS',                      'casa', null),
    ('MLB-AIR_FRYERS',                           'casa', null),
    ('MLB-BLENDERS',                             'casa', null),
    ('MLB-ELECTRIC_COFFEE_MAKERS',               'casa', null),
    ('MLB-KITCHEN_POTS',                         'casa', null),
    ('MLB-DRINKING_GLASSES',                     'casa', null),
    ('MLB-THERMAL_CUPS_AND_TUMBLERS',            'casa', null),
    ('MLB-STOVETOP_POPCORN_POPPERS',             'casa', null),
    ('MLB-CLOTHES_HANGERS',                      'casa', null),
    ('MLB-TABLE_AND_DESK_LAMPS',                 'casa', null),
    ('MLB-WASTE_BASKETS',                        'casa', null),
    ('MLB-LAUNDRY_DETERGENTS',                   'casa', null),
    ('MLB-MULTIPURPOSE_CLEANERS_AND_DISINFECTANTS','casa', null),
    ('MLB-HOME_CLEANING_BRUSHES',                'casa', null),
    ('MLB-BATH_SPONGES',                         'casa', null),
    ('MLB-AIR_FRESHENERS',                       'casa', null),
    ('MLB-TOILET_PAPERS',                        'casa', null),
    ('MLB-INSECTICIDES',                         'casa', null),
    ('MLB-WATER_HOSES',                          'casa', 'a mangueira publicada no canal de pet em 01/08'),

    -- Eletrônico
    ('MLB-HEADPHONES',                           'eletronico', null),
    ('MLB-CELLPHONES',                           'eletronico', null),
    ('MLB-MOBILE_DEVICE_CHARGERS',               'eletronico', null),
    ('MLB-CELL_BATTERIES',                       'eletronico', null),
    ('MLB-DATA_CABLES_AND_ADAPTERS',             'eletronico', null),
    ('MLB-AUDIO_AND_VIDEO_CABLES_AND_ADAPTERS',  'eletronico', null),
    ('MLB-MEMORY_CARDS',                         'eletronico', null),
    ('MLB-MEMORY_READERS',                       'eletronico', null),
    ('MLB-PENDRIVES',                            'eletronico', null),
    ('MLB-HARD_DRIVES_AND_SSDS',                 'eletronico', null),
    ('MLB-ROUTERS_AND_WIRELESS_SYSTEMS',         'eletronico', null),
    ('MLB-MODEMS',                               'eletronico', null),
    ('MLB-USB_HUBS',                             'eletronico', null),
    ('MLB-SPEAKERS',                             'eletronico', null),
    ('MLB-MICROPHONES',                          'eletronico', null),
    ('MLB-COMPUTER_MICE',                        'eletronico', null),
    ('MLB-WEBCAMS',                              'eletronico', null),
    ('MLB-LAPTOP_STANDS',                        'eletronico', null),
    ('MLB-SMARTWATCHES',                         'eletronico', null),
    ('MLB-TELEVISIONS',                          'eletronico', null),
    ('MLB-TV_ANTENNAS',                          'eletronico', null),
    ('MLB-TV_REMOTE_CONTROLS',                   'eletronico', null),
    ('MLB-TV_AND_MONITOR_STANDS_AND_WALL_HANGERS','eletronico', null),
    ('MLB-STREAMING_MEDIA_DEVICES',              'eletronico', null),
    ('MLB-GAMEPADS_AND_JOYSTICKS',               'eletronico', null),
    ('MLB-VEHICLE_CELLPHONE_AND_GPS_MOUNTS',     'eletronico', null)
  ) as d(dominio, nicho_slug, observacao)
  join public.nicho n on n.operacao_id = m.operacao_id and n.slug = d.nicho_slug
 where m.slug = 'mercado_livre'
on conflict do nothing;


-- Os domínios conhecidos que NÃO roteiam para canal nenhum hoje.
--
-- Eles existem como linha, e não como ausência, para parar de voltar à
-- triagem toda semana. Ausência quer dizer "ninguém olhou"; nicho nulo
-- quer dizer "olhamos e a resposta é não". Cada um destes vira nicho
-- de verdade no dia em que houver canal para ele.
insert into public.nicho_dominio (operacao_id, marketplace_id, dominio_externo, nicho_id, observacao)
select m.operacao_id, m.id, d.dominio, null, d.observacao
  from public.marketplace m
  cross join (values
    ('MLB-SUPPLEMENTS',                'o whey publicado no canal de pet em 01/08. É o MAIOR domínio da base, com 61 produtos: as buscas por "racao" arrastaram a prateleira de suplemento inteira'),
    ('MLB-BOOKS',                      null),
    ('MLB-SNEAKERS',                   null),
    ('MLB-FOOTBALL_BALLS',             null),
    ('MLB-SCHOOL_AND_OFFICE_PAPERS',   null),
    ('MLB-PENS',                       null),
    ('MLB-VINYL_ROLLS_AND_SHEETS',     null),
    ('MLB-LAMINATING_ROLLS_AND_POUCHES', null),
    ('MLB-POLY_MAILERS',               null),
    ('MLB-COMMERCIAL_AND_EVENT_BAGS',  null),
    ('MLB-ADHESIVE_TAPES',             null),
    ('MLB-NON_SLIP_TAPES',             null),
    ('MLB-3D_PRINTER_FILAMENTS',       null),
    ('MLB-TELEPROMPTERS',              null),
    ('MLB-OFFICE_CHAIRS',              null),
    ('MLB-HOME_OFFICE_DESKS',          null),
    ('MLB-SAUCES_AND_DRESSINGS',       null),
    ('MLB-SODIUM_BICARBONATE',         null),
    ('MLB-DISPOSABLE_GLOVES',          null),
    ('MLB-SAFETY_GLOVES',              null),
    ('MLB-MICROSCOPES',                null),
    ('MLB-MONOCULARS',                 null),
    ('MLB-BLOOD_GLUCOSE_METERS',       null),
    ('MLB-SEWING_MACHINES',            null),
    ('MLB-AIR_COMPRESSORS',            null),
    ('MLB-LIVESTOCK_FEEDERS',          'ração de criação, não é bicho de estimação'),
    ('MLB-TOY_MICROWAVES',             null),
    ('MLB-VIDEO_GAME_PREPAID_CARDS',   null)
  ) as d(dominio, observacao)
 where m.slug = 'mercado_livre'
on conflict do nothing;


-- -------------------------------------------------------------
-- A consulta que o coletor usa
-- -------------------------------------------------------------
create or replace function public.nicho_do_dominio(
  p_marketplace_id uuid,
  p_dominio        text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nd.nicho_id
    from public.nicho_dominio nd
   where nd.marketplace_id = p_marketplace_id
     and nd.dominio_externo = p_dominio
   limit 1;
$$;

comment on function public.nicho_do_dominio is
  'O nicho de um domínio, ou nulo. Nulo tanto para "decidimos que não roteia" quanto para "ninguém mapeou": os dois casos dão no mesmo para quem coleta, e a diferença só importa na tela de triagem.';

grant execute on function public.nicho_do_dominio(uuid, text) to service_role;


-- -------------------------------------------------------------
-- Os domínios que ninguém olhou ainda, na ordem em que doem
-- -------------------------------------------------------------
create or replace view public.dominio_sem_mapeamento as
  select a.marketplace_id,
         a.dominio_externo,
         count(*)                                   as anuncios,
         count(*) filter (where a.ativo)            as ativos,
         min(a.criado_em)                           as visto_desde
    from public.anuncio a
   where a.dominio_externo is not null
     and not exists (
       select 1 from public.nicho_dominio nd
        where nd.marketplace_id = a.marketplace_id
          and nd.dominio_externo = a.dominio_externo
     )
   group by a.marketplace_id, a.dominio_externo
   order by count(*) desc;

comment on view public.dominio_sem_mapeamento is
  'Domínios presentes no catálogo e ausentes do mapeamento, do mais frequente para o menos. É a fila de trabalho da triagem: mapear o primeiro da lista rende mais que mapear dez do fim.';
