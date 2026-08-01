-- =============================================================
-- 31 · Os atributos do produto, guardados
--
-- POR QUE ISTO É UMA MIGRATION SEPARADA: a 30 já estava aplicada na
-- nuvem quando esta necessidade apareceu, e a regra da seção 6 do
-- AGENTS é clara — migration aplicada não se altera, porque banco local
-- e banco da nuvem passariam a contar histórias diferentes.
--
-- E POR QUE ELA EXISTE: a `chave_identidade` da migration 30 AGRUPA,
-- mas quem decide se dois catálogos são o mesmo produto é uma
-- comparação aos pares, e ela precisa dos atributos dos dois lados.
--
-- A chave é grossa por necessidade: ela é calculada com um produto de
-- cada vez e não tem como saber quais atributos o outro tem. Foi por
-- isso que a primeira varredura de irmãos, rodada contra o catálogo
-- real, casou seis essências de perfumes diferentes: `FRAGRANCE` existe
-- nos dois produtos, mas a chave não o conhecia.
--
-- Com os atributos guardados, a decisão passa a ser "todo atributo
-- presente NOS DOIS precisa bater", que é verificável e auditável
-- depois — dá para olhar por que dois produtos foram fundidos.
-- =============================================================

alter table public.produto
  add column if not exists atributos jsonb;

comment on column public.produto.atributos is
  'Os atributos do catálogo, como a loja devolve. É contra eles que se decide se outro catálogo é o mesmo produto: atributo presente nos dois precisa bater. Guardar evita uma chamada à API por comparação.';
