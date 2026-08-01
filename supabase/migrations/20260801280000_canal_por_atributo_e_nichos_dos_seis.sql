-- =============================================================
-- 37 · Seis canais de uma vez, e o que eles obrigaram a modelar
--
-- O dono abriu seis grupos de Telegram em 01/08 — Fitness, Tech, Geek,
-- Kids, Beauty e Perfumes (masc) — e pôs o bot em todos. Três coisas
-- faltavam para eles publicarem, e nenhuma é "cadastrar o canal":
--
--   1. `geek` e `perfume` não existiam como nicho.
--   2. O gamepad estava mapeado como eletrônico, e com um canal de
--      Geek no ar ele passa a ser dele.
--   3. **"Perfumes (masc)" não é nicho.** Masculino e feminino é
--      ATRIBUTO do produto, não categoria do marketplace — o ML
--      devolve `GENDER` em `products/{id}` e nós já o guardamos em
--      `produto.atributos` desde a migration 31. O roteamento por
--      nicho, sozinho, não sabe dizer isso.
--
-- É o item 3 que traz tabela nova, e ela foi aprovada pelo dono antes
-- de ser escrita (AGENTS §8).
-- =============================================================


-- -------------------------------------------------------------
-- Os dois nichos que faltavam
-- -------------------------------------------------------------
insert into public.nicho (operacao_id, slug, nome)
select o.id, n.slug, n.nome
  from public.operacao o
  cross join (values
    ('geek',    'Geek e colecionáveis'),
    ('perfume', 'Perfumes')
  ) as n(slug, nome)
on conflict do nothing;


-- -------------------------------------------------------------
-- Geek sai de DOMÍNIO, não de raiz — e o motivo é o mesmo de sempre
--
-- Não existe raiz "geek" no Mercado Livre, porque geek não é uma
-- prateleira: é um recorte que atravessa "Brinquedos e Hobbies",
-- "Games" e "Antiguidades e Coleções". Foi exatamente esse o argumento
-- para NÃO criar um canal de animes — tema não vira consulta.
--
-- O que salva o Geek é que os pedaços dele SÃO domínios de verdade. A
-- lista abaixo saiu de perguntar à API os `domain_id` do topo de cada
-- uma das 26 filhas de MLB1132 e das 7 de MLB1144, em 01/08 — pelo
-- mesmo motivo da migration 24: adivinhar nome de domínio é o defeito,
-- não o método.
--
-- Domínio vence raiz, então estes saem de `brinquedo` (que é o Kids) e
-- passam a ser Geek sem que ninguém precise mexer no resto.
-- -------------------------------------------------------------
insert into public.nicho_dominio (operacao_id, marketplace_id, dominio_externo, nicho_id, observacao)
select m.operacao_id, m.id, d.dominio, n.id, d.observacao
  from public.marketplace m
  cross join (values
    ('MLB-ACTION_FIGURES',            'geek', 'de "Bonecos e Bonecas": a action figure é geek, a boneca é do Kids e fica na raiz'),
    ('MLB-BOARD_AND_CARD_GAMES',      'geek', 'jogo de tabuleiro: SKU vivo por anos e ticket alto, o melhor insumo de série que este nicho tem'),
    ('MLB-TRADING_CARD_GAMES',        'geek', null),
    ('MLB-PLASTIC_MODEL_KITS',        'geek', null),
    ('MLB-MODEL_AIRCRAFT_PLANES',     'geek', null),
    ('MLB-DIECAST_VEHICLES',          'geek', null),
    ('MLB-COLLECTIBLE_ALBUM_STICKERS','geek', null),
    ('MLB-STICKER_ALBUMS',            'geek', null),
    ('MLB-PUZZLE_CUBES',              'geek', null),

    -- Perfume sai de `beleza` e vira nicho próprio. Sem isto, o canal
    -- de perfume só existiria como um filtro dentro de beleza, e o
    -- Radar Beauty publicaria perfume duas vezes.
    ('MLB-PERFUMES',                  'perfume', 'era beleza pela raiz MLB1246. Vira nicho próprio porque ganhou canal.')
  ) as d(dominio, nicho_slug, observacao)
  join public.nicho n on n.operacao_id = m.operacao_id and n.slug = d.nicho_slug
 where m.slug = 'mercado_livre'
on conflict (operacao_id, marketplace_id, dominio_externo)
do update set nicho_id = excluded.nicho_id,
              observacao = coalesce(excluded.observacao, nicho_dominio.observacao),
              atualizado_em = now();


-- O gamepad muda de dono. Ele foi mapeado como eletrônico em 01/08,
-- quando o único canal era o de pet e a distinção não pagava. Com
-- Radar Geek e Radar Tech no ar ela passa a pagar: controle é do
-- Geek, e o Tech fica com fone, cabo, SSD e celular.
update public.nicho_dominio nd
   set nicho_id = n.id,
       observacao = 'era eletrônico. Passou para games quando o Radar Geek abriu, em 01/08.',
       atualizado_em = now()
  from public.nicho n
 where n.operacao_id = nd.operacao_id
   and n.slug = 'games'
   and nd.dominio_externo = 'MLB-GAMEPADS_AND_JOYSTICKS';


-- "Antiguidades e Coleções" era raiz conhecida que não roteava, pelo
-- motivo declarado na migration 27: não havia canal. Agora há.
update public.nicho_categoria nc
   set nicho_id = n.id, atualizado_em = now()
  from public.nicho n
 where n.operacao_id = nc.operacao_id
   and n.slug = 'geek'
   and nc.categoria_raiz = 'MLB1367'
   and nc.nicho_id is null;


-- -------------------------------------------------------------
-- Esportes tem 40 filhas, e 12 delas são "fitness"
--
-- Mesmo problema do Pet Shop na migration 36, e a prova de que aquela
-- regra não era de pet: "Esportes e Fitness" é uma raiz só, e dentro
-- dela moram Windsurfe, Paintball, Equitação e Hóquei. Bola de rugby
-- num canal chamado **Radar Fitness** é o whey no canal de pet outra
-- vez — legítimo pela taxonomia, ruído para quem lê.
--
-- Elas não ficam de fora: entram na proporção de
-- `primarios_por_secundario` (quatro por um, hoje). O canal continua
-- sendo de academia, com um caiaque de vez em quando.
--
-- Os ids saíram de `categories/MLB1276` em 01/08. O que fica PRIMÁRIO,
-- de propósito: Fitness e Musculação, Pilates e Yoga, Suplementos e
-- Shakers, Moda Fitness, Monitores Esportivos, Artes Marciais e Boxe,
-- Ciclismo, Natação e Cotoveleiras.
-- -------------------------------------------------------------
insert into public.ramo_secundario (operacao_id, marketplace_id, ramo, rotulo)
select o.id, m.id, v.ramo, v.rotulo
  from public.operacao o
  cross join public.marketplace m
  cross join (values
    ('MLB223366', 'Badminton'),
    ('MLB1309',   'Basquete'),
    ('MLB10539',  'Beisebol e Softbol'),
    ('MLB1362',   'Camping, Caça e Pesca'),
    ('MLB1978',   'Canoas, Caiaques e Infláveis'),
    ('MLB223498', 'Equitação'),
    ('MLB417504', 'Esgrima'),
    ('MLB421368', 'Esqui e Snowboard'),
    ('MLB1286',   'Futebol'),
    ('MLB1302',   'Futebol Americano'),
    ('MLB9900',   'Golfe'),
    ('MLB438767', 'Handebol'),
    ('MLB251434', 'Hóquei'),
    ('MLB438999', 'Jogos de Salão'),
    ('MLB37853',  'Kitesurf'),
    ('MLB1279',   'Mergulho'),
    ('MLB9896',   'Paintball'),
    ('MLB67936',  'Parapente'),
    ('MLB1293',   'Patín e Skateboard'),
    ('MLB410723', 'Patinetes e Scooters'),
    ('MLB1357',   'Rapel, Montanhismo e Escalada'),
    ('MLB270338', 'Rugby'),
    ('MLB180337', 'Slackline'),
    ('MLB1281',   'Surf e Bodyboard'),
    ('MLB440904', 'Tiro Esportivo'),
    ('MLB3900',   'Tênis'),
    ('MLB1322',   'Tênis, Paddle e Squash'),
    ('MLB422153', 'Vôlei'),
    ('MLB12213',  'Wakeboard e Esquí Acuático'),
    ('MLB439278', 'Windsurfe')
  ) as v(ramo, rotulo)
 where m.slug = 'mercado_livre'
on conflict do nothing;


-- =============================================================
-- O canal filtra por atributo do produto
--
-- POR QUE ISTO NÃO CABIA EM `canal_nicho`: nicho responde "de que
-- prateleira é este produto", e a resposta vem da taxonomia da loja.
-- "Perfume masculino" não é prateleira em lugar nenhum — o Mercado
-- Livre põe tudo em `MLB-PERFUMES` e distingue por um atributo,
-- `GENDER`, cujos valores observados em 01/08 são "Masculino",
-- "Feminino", "Meninos", "Meninas" e "Sem gênero".
--
-- E POR QUE O FILTRO É DO CANAL, E NÃO DO PRODUTO: criar um nicho
-- `perfume_masculino` obrigaria a decidir o gênero na hora de
-- classificar, e a duplicar o nicho a cada recorte novo. O produto
-- continua sendo um perfume, sempre; quem tem preferência é o canal.
-- É a mesma separação que já existe entre produto e canal no resto do
-- modelo.
--
-- AUSÊNCIA DE LINHA É "ACEITA TUDO", e isso é deliberado: canal sem
-- filtro se comporta exatamente como antes desta migration, e nenhum
-- dos canais existentes muda de comportamento por ela existir.
-- =============================================================
create table if not exists public.canal_atributo (
  id          uuid primary key default gen_random_uuid(),
  operacao_id uuid not null references public.operacao(id) on delete cascade,
  canal_id    uuid not null references public.canal(id) on delete cascade,

  -- O id do atributo como a loja o chama (`GENDER`, `BRAND`, `SIZE`).
  -- Não traduzimos: é chave de dado de terceiro, e traduzir seria
  -- inventar um mapeamento a mais para manter.
  atributo    text not null,
  valores     text[] not null,

  -- `inclui` = só passa quem casa. `exclui` = passa quem não casa.
  -- Os dois existem porque o par Perfumes/Beauty precisa dos dois
  -- lados: um fica com o masculino, o outro com todo o resto.
  modo        text not null default 'inclui',

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint canal_atributo_modo_valido check (modo in ('inclui', 'exclui')),
  constraint canal_atributo_tem_valor check (cardinality(valores) > 0),
  constraint canal_atributo_unico unique (canal_id, atributo, modo)
);

comment on table public.canal_atributo is
  'Preferência do canal sobre um atributo do produto. Canal sem linha aceita tudo. É o que permite "Perfumes (masc)" sem inventar um nicho por recorte.';
comment on column public.canal_atributo.atributo is
  'O id do atributo como o marketplace o chama (`GENDER`). Casa com a chave em `produto.atributos`.';
comment on column public.canal_atributo.modo is
  '`inclui`: só passa quem casa. `exclui`: passa quem não casa. Produto SEM o atributo passa nos dois — dado que falta não pode calar o canal.';

create index if not exists canal_atributo_canal_idx on public.canal_atributo (canal_id);

create or replace trigger canal_atributo_atualizado_em
  before update on public.canal_atributo
  for each row execute function public.marca_atualizado_em();

alter table public.canal_atributo enable row level security;

create policy canal_atributo_le on public.canal_atributo
  for select using (operacao_id = public.operacao_atual());

create policy canal_atributo_escreve on public.canal_atributo
  for all using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

grant select on public.canal_atributo to authenticated;
grant all on public.canal_atributo to service_role;


-- -------------------------------------------------------------
-- A decisão, num lugar só
--
-- Espelha `canal-aceita.ts`, que é o que o publicador usa. As duas
-- existem pelo mesmo motivo que `nicho_do_anuncio` tem par no coletor:
-- o publicador roda como script e decide em memória, com os canais já
-- carregados; a função existe para consulta e para a tela conferir.
--
-- PRODUTO SEM O ATRIBUTO PASSA. Metade do catálogo do ML não preenche
-- metade dos atributos, e reprovar por ausência calaria o canal por
-- causa de cadastro de terceiro. É a mesma escolha da migration 36.
-- -------------------------------------------------------------
create or replace function public.canal_aceita_atributos(
  p_canal_id   uuid,
  p_atributos  jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
      from public.canal_atributo ca
     where ca.canal_id = p_canal_id
       -- Só decide quando o produto declara o atributo.
       and coalesce(p_atributos ->> ca.atributo, '') <> ''
       and case ca.modo
             when 'inclui' then not ((p_atributos ->> ca.atributo) = any (ca.valores))
             when 'exclui' then      (p_atributos ->> ca.atributo) = any (ca.valores)
           end
  );
$$;

comment on function public.canal_aceita_atributos is
  'Se o canal aceita um produto, dados os atributos dele. Verdadeiro quando não há filtro, e verdadeiro quando o produto não declara o atributo filtrado.';

grant execute on function public.canal_aceita_atributos(uuid, jsonb) to authenticated, service_role;
