-- =============================================================
-- 30 · O produto passa a ter identidade, e não só título
--
-- O CASO QUE FORÇOU ISTO, e ele é literal: em 01/08 o canal publicou
-- uma ração a R$ 130,00. O mesmo saco estava a R$ 119,90 e nós não
-- vimos. Não foi erro de escolha de vendedor — dentro do catálogo que
-- olhamos, R$ 130 era mesmo o menor de 35 vendedores.
--
-- O Mercado Livre cadastra o MESMO produto físico várias vezes:
--
--   MLB36519405  R$ 119,90  "Special Cat Mix Premium Ração Gato Adulto 10,1kg"
--   MLB24441152  R$ 130,00  "Alimento Special Cat Mix Adultos 10,1kg"
--   MLB44069604  R$ 135,90  "Alimento Para Gatos Adultos Special Cat Mix 10,1kg"
--
-- Três títulos, três catálogos, atributos idênticos: marca Special Cat,
-- linha Premium, peso 10.1 kg, sabor Mix.
--
-- E O DEFEITO ERA NOSSO. O `docs/dados.md` sempre disse que `produto` é
-- "a identidade da coisa" e `anuncio` é "esse produto numa loja
-- específica". Na prática o produto era chaveado pelo TÍTULO do
-- catálogo do ML — então quatro títulos viraram quatro produtos, e a
-- comparação de preço nunca atravessava entre eles. O modelo estava
-- certo no papel e errado no código.
--
-- Isto não é recurso novo: é fazer o `produto` ser o que ele sempre
-- disse que era.
-- =============================================================

alter table public.produto
  add column if not exists chave_identidade text;

comment on column public.produto.chave_identidade is
  'O que diz que dois catálogos são o mesmo produto: GTIN quando existe, senão domínio + marca + linha + peso + sabor, normalizados. NULO é resposta e é comum: produto genérico sem marca não funde com ninguém e vale por si.';

-- Único por operação, e só quando existe. Produto sem identidade
-- continua entrando: `null` não colide com `null` em índice único.
create unique index if not exists produto_identidade_unica
  on public.produto (operacao_id, chave_identidade)
  where chave_identidade is not null;


-- -------------------------------------------------------------
-- O anúncio passa a saber de qual catálogo ele veio
--
-- Antes isso vivia escondido dentro de `url_original`, e dava para
-- extrair com regex. Agora que um produto tem VÁRIOS catálogos, ele
-- vira dado de primeira classe: é por ele que se sabe que os anúncios
-- de R$ 119,90 e R$ 130,00 são prateleiras diferentes do mesmo item.
-- -------------------------------------------------------------
alter table public.anuncio
  add column if not exists produto_externo_id text;

comment on column public.anuncio.produto_externo_id is
  'O id do produto de catálogo na loja (MLB24441152). Vários por produto nosso, porque o ML cadastra o mesmo item mais de uma vez.';

create index if not exists anuncio_produto_externo_idx
  on public.anuncio (marketplace_id, produto_externo_id)
  where produto_externo_id is not null;

update public.anuncio
   set produto_externo_id = substring(url_original from '/p/(MLB[0-9]+)')
 where produto_externo_id is null
   and url_original like '%/p/MLB%';


-- -------------------------------------------------------------
-- O melhor anúncio vivo de cada produto
--
-- É a consulta que responde "de todas as prateleiras deste mesmo item,
-- qual é a melhor compra agora". Ela mora no banco e não no script
-- pelo mesmo motivo de `avalia_anuncios`: regra duplicada em dois
-- lugares diverge, e aqui divergir significa publicar o preço errado.
--
-- A ordem repete a do coletor de propósito: loja oficial ganha, depois
-- reputação, depois preço. A diferença é o UNIVERSO — antes era um
-- catálogo, agora são todos os do mesmo produto.
-- -------------------------------------------------------------
create or replace function public.melhor_anuncio_do_produto(
  p_produto_id uuid,
  p_tolerancia_pct numeric default 5
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with vivos as (
    select a.id, a.preco_leitura_centavos, a.loja_oficial, a.reputacao_vendedor
      from public.anuncio a
     where a.produto_id = p_produto_id
       and a.ativo
       and a.preco_leitura_centavos is not null
  ), piso as (
    select min(preco_leitura_centavos) as menor from vivos
  )
  select v.id
    from vivos v, piso
   where v.preco_leitura_centavos <= piso.menor * (1 + p_tolerancia_pct / 100.0)
   order by v.loja_oficial desc nulls last,
            v.reputacao_vendedor desc nulls last,
            v.preco_leitura_centavos asc
   limit 1;
$$;

comment on function public.melhor_anuncio_do_produto is
  'De todas as prateleiras do mesmo produto, a melhor compra agora. Dentro da tolerância de preço, vendedor melhor ganha: pagar 5% a mais por quem entrega é barato.';

grant execute on function public.melhor_anuncio_do_produto(uuid, numeric) to service_role;


-- -------------------------------------------------------------
-- Onde a economia aparece
--
-- Sem isto, o conserto é invisível: o canal simplesmente passa a
-- publicar mais barato e ninguém sabe quanto. Esta view é a prova, e
-- é o que permite dizer se valeu a pena varrer catálogo irmão.
-- -------------------------------------------------------------
create or replace view public.economia_por_identidade
with (security_invoker = true)
as
select p.id as produto_id,
       p.operacao_id,
       p.titulo_canonico,
       p.chave_identidade,
       count(distinct a.produto_externo_id)      as catalogos,
       min(a.preco_leitura_centavos)             as menor_centavos,
       max(a.preco_leitura_centavos)             as maior_centavos,
       max(a.preco_leitura_centavos) - min(a.preco_leitura_centavos) as diferenca_centavos
  from public.produto p
  join public.anuncio a on a.produto_id = p.id and a.ativo
 where a.preco_leitura_centavos is not null
 group by p.id, p.operacao_id, p.titulo_canonico, p.chave_identidade
having count(distinct a.produto_externo_id) > 1
   and max(a.preco_leitura_centavos) > min(a.preco_leitura_centavos)
 order by 8 desc;

comment on view public.economia_por_identidade is
  'Produtos com mais de um catálogo e preços diferentes entre eles. A diferença é exatamente o que o canal deixaria na mesa se comparasse só dentro de um catálogo.';

