-- =============================================================
-- O Beauty para de receber escova de dente
-- =============================================================
--
-- (Carimbo `20260810210000`.)
--
-- O QUE O DONO PEDIU, em 10/08, antes de ligar o primeiro grupo de
-- WhatsApp: *"só garanta que não tem nenhuma coisa ruim na fila, só
-- coisa boa que elas vão gostar"*.
--
-- Passando os filtros na fila real, 23 de 120 ofertas de beleza foram
-- barradas por serem de homem ou de salão. Sobraram 9 que os filtros
-- NÃO pegam, porque não são defeito de filtro: são defeito de NICHO.
--
--   Fio Dental Reach Essencial Menta 100m Johnson's
--   Kit de Escovas De Dentes Colgate Slim Soft Black
--   Pasta de dentes Colgate Total 12
--   Lenços Umedecidos Huggies Recém Nascido Pack C/4
--   Colônia Turma Da Mônica Cebolinha Jequiti 25mL
--
-- Todos estão marcados como `beleza`, e nenhum deles é. Vieram da
-- categoria "Beleza e Cuidado Pessoal" do marketplace, que junta
-- maquiagem com creme dental porque para a loja isso é uma prateleira
-- só. Para o grupo, não é.
--
-- POR QUE MUDAR O NICHO E NÃO FILTRAR NO CANAL: filtrar esconderia o
-- produto do Delas e o deixaria no limbo. Mudando o nicho, o creme
-- dental vai para o Radar Casa e o lenço umedecido para o Radar Kids,
-- que são os canais de quem quer aquilo. O conserto serve aos três.
--
-- A REGRA É POR TÍTULO e não por categoria, pelo mesmo motivo de
-- sempre: `produto.categoria` está nulo em quase todo produto de
-- beleza, e `categoria_ramo` é código opaco do marketplace.

-- -------------------------------------------------------------
-- Higiene bucal vai para `casa`, que é o canal de casa e mercado.
-- -------------------------------------------------------------
update public.produto p
   set nicho_id = (select id from public.nicho where slug = 'casa')
 where p.nicho_id = (select id from public.nicho where slug = 'beleza')
   and (
     p.titulo_canonico ilike '%escova de dente%'
     or p.titulo_canonico ilike '%escovas de dente%'
     or p.titulo_canonico ilike '%creme dental%'
     or p.titulo_canonico ilike '%pasta de dente%'
     or p.titulo_canonico ilike '%pasta de dentes%'
     or p.titulo_canonico ilike '%fio dental%'
     or p.titulo_canonico ilike '%enxaguante bucal%'
   );

-- -------------------------------------------------------------
-- Lenço umedecido de bebê e perfume infantil vão para `bebe`.
--
-- "Turma da Mônica" e "Cebolinha" são personagem de criança, e o
-- perfume da Jequiti com eles é presente de criança. O Radar Kids é
-- quem tem esse público.
-- -------------------------------------------------------------
update public.produto p
   set nicho_id = (select id from public.nicho where slug = 'bebe')
 where p.nicho_id in (
         select id from public.nicho where slug in ('beleza', 'perfume')
       )
   and (
     p.titulo_canonico ilike '%lenço umedecido%'
     or p.titulo_canonico ilike '%lenços umedecidos%'
     or p.titulo_canonico ilike '%turma da mônica%'
     or p.titulo_canonico ilike '%turma da monica%'
     or p.titulo_canonico ilike '%perfume infantil%'
   );

-- -------------------------------------------------------------
-- As ofertas já aprovadas desses produtos voltam para a fila.
--
-- Sem isto o conserto só valeria para o que a coleta trouxer amanhã, e
-- o que está aprovado hoje continuaria saindo no canal errado. É a
-- mesma decisão da migration que tirou jogo de tabuleiro do Tech.
-- -------------------------------------------------------------
-- `nova` e nao `pendente`: os status validos sao nova, aprovada,
-- rejeitada, adiada e expirada (constraint `oferta_status_valido`).
-- `pendente` foi chute meu, e o banco local nao pegou porque nao tinha
-- nenhuma linha correspondente — o UPDATE afetou zero e a constraint
-- nunca foi exercitada. Quem pegou foi a producao, na primeira
-- tentativa de aplicar.
update public.oferta o
   set status = 'nova', decidida_em = null, decidida_por = null
  from public.anuncio a, public.produto p
 where o.anuncio_id = a.id
   and a.produto_id = p.id
   and o.status = 'aprovada'
   and p.nicho_id in (select id from public.nicho where slug in ('casa', 'bebe'))
   and (
     p.titulo_canonico ilike '%escova de dente%'
     or p.titulo_canonico ilike '%escovas de dente%'
     or p.titulo_canonico ilike '%creme dental%'
     or p.titulo_canonico ilike '%pasta de dente%'
     or p.titulo_canonico ilike '%pasta de dentes%'
     or p.titulo_canonico ilike '%fio dental%'
     or p.titulo_canonico ilike '%lenço umedecido%'
     or p.titulo_canonico ilike '%lenços umedecidos%'
     or p.titulo_canonico ilike '%turma da mônica%'
     or p.titulo_canonico ilike '%turma da monica%'
   );
