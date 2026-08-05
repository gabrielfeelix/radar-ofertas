-- =============================================================
-- 71 · `casa` e `eletronico` entram em migration
--
-- ELES SO EXISTIAM EM PRODUCAO. Criados a mao em 31/07 as 23h15, junto
-- com o projeto da nuvem, e nunca capturados em migration nenhuma. A
-- unica migration que semeia nicho e a 03, e ela cria so `pet`; a 34
-- cria outros onze e nao inclui estes dois.
--
-- COMO APARECEU, e o achado vale mais que o conserto: o dono cobrou que
-- eu testasse os scripts no Docker antes de rodar contra o Supabase.
-- Fui semear o banco local para reproduzir producao e o
-- `cria-canais.mjs` recusou dois canais:
--
--   ✗ Radar Tech: nicho inexistente — eletronico
--   ✗ Radar Casa: nicho inexistente — casa
--
-- Producao tinha 18 nichos e o local, 16. Os dois que faltavam sao o
-- MAIOR do catalogo e o do canal aberto hoje.
--
-- POR QUE ISSO IMPORTA ALEM DA ARRUMACAO: "testa no local primeiro" so
-- vale se o local puder reproduzir producao. Enquanto configuracao
-- morar so na nuvem, todo teste local passa por motivo errado ou falha
-- por motivo errado, e as duas coisas ensinam a nao confiar no teste.
--
-- E o estrago silencioso seria maior num desastre: restaurar o backup
-- num projeto novo traria o banco sem `casa` e sem `eletronico`, e as
-- linhas de `nicho_dominio` e `nicho_categoria` que apontam para eles
-- nao teriam para onde apontar.
--
-- Idempotente por `slug`, entao em producao ela nao faz nada — os dois
-- ja estao la, com os mesmos nomes conferidos antes de escrever.
-- =============================================================

insert into public.nicho (operacao_id, slug, nome)
select o.id, v.slug, v.nome
  from public.operacao o
  cross join (values
    ('casa',       'Casa e cozinha'),
    ('eletronico', 'Eletrônico')
  ) as v(slug, nome)
 where not exists (
   select 1 from public.nicho n
    where n.operacao_id = o.id and n.slug = v.slug
 );
