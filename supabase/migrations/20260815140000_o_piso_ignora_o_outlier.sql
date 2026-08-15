-- -------------------------------------------------------------
-- O PISO DE PREÇO DEIXA DE SE ANCORAR NUM ANÚNCIO ABSURDO
--
-- `melhor_anuncio_do_produto` pegava `min(preco)` do grupo e aceitava
-- qualquer anúncio até 5% acima dele. A tolerância está certa; o
-- problema é o âncora. Um único anúncio errado dentro da identidade
-- envenena o piso inteiro, e aí o "melhor" passa a ser o errado.
--
-- MEDIDO EM 15/08, na view `economia_por_identidade`: de 681
-- identidades com mais de um catálogo, 47 (6%) tinham o menor preço
-- abaixo de 30% do maior. Quatro casos reais:
--
--   Ração Úmida Friskies Cordeiro      R$   2,49  contra R$   82,00
--   Lâmpada Bulbo Led 9w E27           R$   2,99  contra R$   78,90
--   Kit 5 Lâmpadas Led 70w             R$  23,90  contra R$  525,87
--   Máquina de Lavar 15kg Electrolux   R$  60,00  contra R$ 2.099,00
--
-- Os três primeiros são unidade fundida com pacote, e a causa está
-- consertada em `lib/identidade.ts` na mesma data: os ids de
-- quantidade que usávamos (`PACKAGE_UNITS`, `VOLUME`) não existem no
-- Mercado Livre. O quarto é outra coisa: R$ 60 numa máquina de lavar
-- de 15kg, de vendedor pessoa física, é um anúncio que não é o
-- produto, e nenhum conserto de identidade pega isso.
--
-- ENTÃO SÃO DUAS DEFESAS, e esta é a segunda: mesmo com a identidade
-- certa, o grupo pode conter lixo, e o piso não pode confiar no menor
-- valor sozinho.
--
-- COMO: o piso passa a ser o menor preço QUE NÃO SEJA absurdo perante
-- os pares. "Absurdo" é abaixo de 35% da mediana do grupo. Mediana e
-- não média, porque média é justamente o que um outlier arrasta.
--
-- POR QUE 35%: desconto real de 65% existe e é raro; o sistema já
-- recusa desconto declarado acima de 70% em `detecta_declarados`, pela
-- mesma lógica. Este corte é mais frouxo que aquele de propósito, pois
-- aqui o erro custa uma comparação perdida, não um post mentiroso.
--
-- GRUPO DE UM ANÚNCIO SÓ NÃO TEM MEDIANA ÚTIL, e nesse caso nada é
-- descartado: sem par, não há como saber que é absurdo, e a curadoria
-- continua sendo quem julga.
-- -------------------------------------------------------------

-- DERRUBA A VERSÃO DE DOIS ARGUMENTOS ANTES DE CRIAR A DE TRÊS.
--
-- `create or replace` com assinatura diferente NÃO substitui: cria uma
-- SOBRECARGA, e as duas passam a existir. Com defaults nos dois lados,
-- uma chamada de um argumento só (que é como o publicador chama) fica
-- ambígua e o Postgres recusa em tempo de execução. O canal ficaria
-- mudo, e o erro só apareceria na hora de publicar.
--
-- É a mesma armadilha que o `AGENTS.md` documenta para
-- `canal_aceita_atributos`, que tem duas versões vivas e cuja versão
-- de dois argumentos ignora todo filtro com escopo de nicho sem dar
-- erro nenhum. Aqui ela foi pega na primeira tentativa de aplicar,
-- porque o `comment on function` recusou o nome ambíguo.
drop function if exists public.melhor_anuncio_do_produto(uuid, numeric);

create or replace function public.melhor_anuncio_do_produto(
  p_produto_id uuid,
  p_tolerancia_pct numeric default 5,
  p_piso_da_mediana_pct numeric default 35
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
  ), medida as (
    select percentile_cont(0.5) within group (order by preco_leitura_centavos) as mediana,
           count(*) as quantos
      from vivos
  ), confiaveis as (
    -- Com um anúncio só não há par para comparar, e aí ele mesmo vale.
    select v.*
      from vivos v, medida m
     where m.quantos < 2
        or v.preco_leitura_centavos >= m.mediana * (p_piso_da_mediana_pct / 100.0)
  ), piso as (
    select min(preco_leitura_centavos) as menor from confiaveis
  )
  select c.id
    from confiaveis c, piso
   where c.preco_leitura_centavos <= piso.menor * (1 + p_tolerancia_pct / 100.0)
   order by c.loja_oficial desc nulls last,
            c.reputacao_vendedor desc nulls last,
            c.preco_leitura_centavos asc
   limit 1;
$$;

comment on function public.melhor_anuncio_do_produto(uuid, numeric, numeric) is
  'De todas as prateleiras do mesmo produto, a melhor compra agora. Descarta o anúncio absurdo perante os pares antes de fixar o piso: sem isso, um item errado dentro da identidade faz o melhor virar o pior. Dentro da tolerância, vendedor melhor ganha.';

grant execute on function public.melhor_anuncio_do_produto(uuid, numeric, numeric) to service_role;

-- -------------------------------------------------------------
-- Quem já era suspeito continua visível, agora com nome
--
-- A `economia_por_identidade` mostrava a diferença sem dizer se ela é
-- oportunidade ou defeito. Com a coluna abaixo, a fila de trabalho de
-- quem for calibrar identidade deixa de ser um olhômetro.
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
       max(a.preco_leitura_centavos) - min(a.preco_leitura_centavos) as diferenca_centavos,
       -- Verdadeiro quando o menor é baixo demais perante os pares:
       -- é candidato a identidade fundida por engano, não a achado.
       min(a.preco_leitura_centavos)
         < percentile_cont(0.5) within group (order by a.preco_leitura_centavos) * 0.35
                                                 as suspeito_de_fusao
  from public.produto p
  join public.anuncio a on a.produto_id = p.id and a.ativo
 where a.preco_leitura_centavos is not null
 group by p.id, p.operacao_id, p.titulo_canonico, p.chave_identidade
having count(distinct a.produto_externo_id) > 1
   and max(a.preco_leitura_centavos) > min(a.preco_leitura_centavos)
 order by 8 desc;

comment on view public.economia_por_identidade is
  'Produtos com mais de um catálogo e preços diferentes. A diferença é o que o canal deixaria na mesa comparando só dentro de um catálogo. suspeito_de_fusao separa o achado do defeito.';
