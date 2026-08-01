-- =============================================================
-- 46 · O nicho passa a ter três níveis, e "Esportes" vira "Fitness"
--
-- AUDITORIA DO DONO, canal por canal, na primeira noite dos sete:
-- *"tem que revisar cada um pra estar CORRETOS"*. E o Radar Fitness era
-- o pior. O que saiu nele, tudo legitimamente sob a raiz "Esportes e
-- Fitness" do Mercado Livre:
--
--   Carabina de pressão CBC Jade 5.5 com luneta      (AIRSOFT_GUNS)
--   Chumbinho Slug 5,5mm caça 125un                  (AIRGUN_PELLETS)
--   Lanterna Tática Militar T9                       (FLASHLIGHTS)
--   Perneira de equitação Nexus                      (HORSE_BLANKETS)
--   Taco de beisebol Yuhui 27                        (BASEBALL_BATS)
--   Colchão inflável de camping                      (AIR_MATTRESSES)
--   Patinete Triciclo Infantil Drift Elétrico        (ELECTRIC_SCOOTERS)
--
-- Arma de pressão num canal chamado **Radar Fitness** não é ruído, é
-- outro produto. E o dono foi específico sobre o que espera lá:
-- *"creatina, whey, camiseta fitness, corda, luva de boxe"*.
--
-- POR QUE A REGRA DE RAMO SECUNDÁRIO (D-041) NÃO RESOLVEU: ela é uma
-- PROPORÇÃO, não um filtro. Quatro primários liberam um secundário, e
-- com 27 posts saem uns cinco secundários — mais os que não têm
-- `categoria_ramo` gravado, que passam como primários por desenho. Ela
-- foi feita para "cavalo de vez em quando num canal de cão e gato", e
-- isso é um problema de dosagem. Aqui o problema é de pertencimento.
--
-- FALTAVA UM NÍVEL NO MAPEAMENTO. Havia dois:
--
--   `nicho_categoria`  raiz     28 linhas   cobre o site todo
--   `nicho_dominio`    domínio  milhares    a exceção fina
--
-- A raiz é grossa demais para Esportes: ela tem **40 filhas** e só umas
-- sete são academia. O domínio é fino demais: seriam centenas de linhas
-- para dizer a mesma coisa. O RAMO — a filha direta da raiz, que já é
-- gravado em `anuncio.categoria_ramo` desde a D-041 — é exatamente a
-- granularidade que faltava.
--
--   raiz (28)  →  RAMO (~30 por raiz)  →  domínio (milhares)
--   grossa        média, e é esta          fina, e vence todas
--
-- Serve para muito além de Esportes: Brinquedos e Hobbies tem 26 filhas
-- que misturam bebê, colecionável e adulto; Casa tem 13. Cada canal
-- novo tende a precisar deste corte.
-- =============================================================

create table if not exists public.nicho_ramo (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references public.operacao (id) on delete cascade,
  marketplace_id uuid not null references public.marketplace (id) on delete cascade,
  ramo           text not null,
  nome_ramo      text,
  -- Mesma semântica dos outros dois: nulo = "olhamos e não roteia",
  -- ausência de linha = "ninguém olhou, cai na raiz".
  nicho_id       uuid references public.nicho (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (operacao_id, marketplace_id, ramo)
);

comment on table public.nicho_ramo is
  'Liga o ramo (filha direta da raiz) ao nosso nicho. Nível MÉDIO: a raiz é grossa demais para categorias com 40 filhas, o domínio é fino demais. Domínio vence ramo, ramo vence raiz.';

alter table public.nicho_ramo enable row level security;

create policy nicho_ramo_le on public.nicho_ramo
  for select using (operacao_id = public.operacao_atual());

create policy nicho_ramo_escreve on public.nicho_ramo
  for all using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

grant select on public.nicho_ramo to authenticated;
grant all on public.nicho_ramo to service_role;


-- -------------------------------------------------------------
-- O nicho que o Radar Fitness realmente quer
-- -------------------------------------------------------------
insert into public.nicho (operacao_id, slug, nome)
select id, 'fitness', 'Fitness e musculação' from public.operacao
on conflict do nothing;

-- O nome do `geek` deixa de prometer o que ele não é.
update public.nicho set nome = 'Geek e cultura pop', atualizado_em = now()
 where slug = 'geek';


-- Os sete ramos de "Esportes e Fitness" que são academia. Ids
-- conferidos contra `categories/MLB1276` em 01/08.
--
-- As outras 33 filhas ficam de fora e continuam caindo em `esporte`,
-- que **não tem canal** — elas seguem entrando no catálogo e formando
-- série de preço, prontas para o dia em que houver um Radar Esportes.
insert into public.nicho_ramo (operacao_id, marketplace_id, ramo, nome_ramo, nicho_id)
select m.operacao_id, m.id, v.ramo, v.nome, n.id
  from public.marketplace m
  cross join (values
    ('MLB1338',   'Fitness e Musculação'),
    ('MLB278252', 'Pilates e Yoga'),
    ('MLB438178', 'Suplementos e Shakers'),
    ('MLB1339',   'Moda Fitness'),
    ('MLB123103', 'Monitores Esportivos'),
    ('MLB2480',   'Artes Marciais e Boxe'),
    ('MLB458011', 'Cotoveleiras')
  ) as v(ramo, nome)
  join public.nicho n on n.operacao_id = m.operacao_id and n.slug = 'fitness'
 where m.slug = 'mercado_livre'
on conflict (operacao_id, marketplace_id, ramo)
do update set nicho_id = excluded.nicho_id, nome_ramo = excluded.nome_ramo, atualizado_em = now();


-- -------------------------------------------------------------
-- A decisão, agora com três níveis
--
-- Domínio vence ramo, ramo vence raiz. E domínio marcado como "não
-- roteia" continua bloqueando os três, que é o que impede uma regra
-- grossa de desfazer uma decisão fina (mesma lógica da migration 27).
-- -------------------------------------------------------------
-- A versão de três argumentos sai de cena. Deixá-la viva ao lado da
-- nova torna o nome AMBÍGUO: `comment on function` sem assinatura falha,
-- e uma chamada com três argumentos silenciosamente pularia o nível do
-- ramo. Foi o que derrubou a primeira tentativa desta migration.
drop function if exists public.nicho_do_anuncio(uuid, text, text);

create or replace function public.nicho_do_anuncio(
  p_marketplace_id uuid,
  p_dominio        text,
  p_categoria_raiz text,
  p_categoria_ramo text default null
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
    (select nr.nicho_id from public.nicho_ramo nr
      where nr.marketplace_id = p_marketplace_id
        and nr.ramo = p_categoria_ramo
        and nr.nicho_id is not null
      limit 1),
    (select nc.nicho_id from public.nicho_categoria nc
      where nc.marketplace_id = p_marketplace_id
        and nc.categoria_raiz = p_categoria_raiz
      limit 1)
  )
  where not exists (
    select 1 from public.nicho_dominio nd2
     where nd2.marketplace_id = p_marketplace_id
       and nd2.dominio_externo = p_dominio
       and nd2.nicho_id is null
  )
  -- Ramo marcado como "não roteia" também bloqueia a raiz. Sem isto,
  -- desligar um ramo inteiro exigiria desligar cada domínio dele.
  and not exists (
    select 1 from public.nicho_ramo nr2
     where nr2.marketplace_id = p_marketplace_id
       and nr2.ramo = p_categoria_ramo
       and nr2.nicho_id is null
  );
$$;

comment on function public.nicho_do_anuncio(uuid, text, text, text) is
  'O nicho de um anúncio, em três níveis: domínio vence ramo, ramo vence raiz. Domínio ou ramo marcado como "não roteia" bloqueia os de baixo. Nulo = não publica.';

grant execute on function public.nicho_do_anuncio(uuid, text, text, text) to service_role;


-- -------------------------------------------------------------
-- As correções finas que a auditoria pediu, por domínio
--
-- Cada uma saiu de um post real no canal errado, na noite de 01/08.
-- -------------------------------------------------------------
insert into public.nicho_dominio (operacao_id, marketplace_id, dominio_externo, nicho_id, observacao)
select m.operacao_id, m.id, d.dominio,
       (select n.id from public.nicho n where n.operacao_id = m.operacao_id and n.slug = d.slug),
       d.obs
  from public.marketplace m
  cross join (values
    /*
      GEEK É CULTURA POP, NÃO "COLECIONÁVEL". A definição veio do dono
      ao ver o canal: *"é coisa de NERD, coisa de star wars, cultura
      pop, harry potter, sabe? RPG de mesa, coisas de NERD mesmo, uns
      controles de play, jogos de play, não medalha acrílico cristal"*.

      A primeira versão do nicho `geek` (migration 37) errou o alvo: eu
      o montei como "colecionáveis e hobbies", e colecionável é um
      guarda-chuva muito maior — cabe medalha, moeda, selo, álbum de
      figurinha da copa e aeromodelismo, que não têm nada a ver com o
      público do canal.

      O que FICA em geek: action figure, jogo de tabuleiro e de cartas
      (que é onde mora o RPG de mesa), card game colecionável, kit de
      modelismo plástico — mais tudo de `games`, que o canal já aceita.
    */
    ('MLB-TURNTABLES',                     'eletronico', 'vitrola saiu no Radar Geek em 01/08. É som, não cultura pop.'),
    ('MLB-MEDALS',                         null,         'medalha de acrílico saiu no Radar Geek em 01/08. Não é de canal nenhum.'),
    ('MLB-DOLL_AND_ACTION_FIGURE_VEHICLES','brinquedo',  'carrinho de personagem é do Kids, não do Geek.'),

    -- Saem do geek: são colecionáveis, e colecionável não é nerd.
    ('MLB-COLLECTIBLE_ALBUM_STICKERS',     'brinquedo',  'álbum da Copa saiu no Radar Geek em 01/08. Figurinha de futebol é infantil, não cultura pop.'),
    ('MLB-STICKER_ALBUMS',                 'brinquedo',  'mesmo caso do álbum de figurinhas.'),
    ('MLB-DIECAST_VEHICLES',               'brinquedo',  'miniatura de carro é Hot Wheels, e Hot Wheels é do Kids.'),
    ('MLB-PUZZLE_CUBES',                   'brinquedo',  'cubo mágico é brinquedo de engenho, não cultura pop.'),
    ('MLB-MODEL_AIRCRAFT_PLANES',          null,         'aeromodelismo é hobby adulto e não tem canal.'),

    -- Tech: som automotivo e fonte industrial não são eletrônico de
    -- consumo, e saíram no Radar Tech.
    ('MLB-AUDIO_CROSSOVERS',               'automotivo', 'processador de áudio veicular saiu no Radar Tech em 01/08.'),
    ('MLB-POWER_INVERTERS',                'automotivo', 'inversor 12v veicular saiu no Radar Tech em 01/08.'),
    ('MLB-EMBEDDED_SWITCH_MODE_POWER_SUPPLIES', null,    'fonte chaveada industrial saiu no Radar Tech em 01/08.'),

    -- Kids: taco de sinuca profissional saiu num canal infantil.
    ('MLB-CUE_STICKS',                     null,         'taco de sinuca profissional saiu no Radar Kids em 01/08.'),

    -- Fitness: estes vieram por domínio e o corte de ramo não os pega,
    -- porque arma e lanterna moram sob "Tiro Esportivo" e "Camping".
    ('MLB-AIRSOFT_GUNS',                   null,         'carabina de pressão saiu no Radar Fitness em 01/08. Arma não vai a canal nenhum.'),
    ('MLB-AIRGUN_PELLETS',                 null,         'chumbinho de caça saiu no Radar Fitness em 01/08.'),
    ('MLB-FLASHLIGHTS',                    null,         'lanterna tática saiu no Radar Fitness em 01/08.')
  ) as d(dominio, slug, obs)
 where m.slug = 'mercado_livre'
on conflict (operacao_id, marketplace_id, dominio_externo)
do update set nicho_id = excluded.nicho_id,
              observacao = excluded.observacao,
              atualizado_em = now();


-- "Antiguidades e Coleções" volta a NÃO rotear. A migration 37 a ligou
-- ao geek pelo raciocínio errado (colecionável = geek). É a raiz de
-- moeda, selo, medalha e disco antigo, e nenhum deles é do canal.
update public.nicho_categoria nc
   set nicho_id = null, atualizado_em = now()
  from public.nicho n
 where n.id = nc.nicho_id
   and n.slug = 'geek'
   and nc.categoria_raiz = 'MLB1367';


-- -------------------------------------------------------------
-- A fila de triagem passa a enxergar ramo
-- -------------------------------------------------------------
create or replace view public.ramo_sem_mapeamento as
  select a.marketplace_id,
         a.categoria_raiz,
         a.categoria_ramo,
         count(*) as anuncios
    from public.anuncio a
   where a.categoria_ramo is not null
     and not exists (
       select 1 from public.nicho_ramo nr
        where nr.marketplace_id = a.marketplace_id
          and nr.ramo = a.categoria_ramo
     )
   group by a.marketplace_id, a.categoria_raiz, a.categoria_ramo
   order by count(*) desc;

comment on view public.ramo_sem_mapeamento is
  'Ramos presentes no catálogo e sem linha em `nicho_ramo`. Eles caem na raiz, o que quase sempre está certo: só entram aqui os que precisam de corte próprio.';

grant select on public.ramo_sem_mapeamento to authenticated, service_role;
