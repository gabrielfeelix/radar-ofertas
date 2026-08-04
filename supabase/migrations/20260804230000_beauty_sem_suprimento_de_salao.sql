-- =============================================================
-- 55 · O Beauty para de receber insumo de clinica e atacado
--
-- O QUE O CANAL PUBLICOU, e nao e hipotese:
--
--   Kit 2 Caixas Microcanula Sc22g 50mm (cx C/10)   R$ 289,87
--   Shampoo Expert Pro Longer 1,5L L'Oreal          R$ 316,42
--   Kit 12 Spray Liso Obrigatorio 200ml             R$ 171,90
--   Espelho de Precisao Para Extensao de Cilios     R$  10,01
--
-- Microcanula e insumo de clinica de preenchimento facial. Um litro e
-- meio de shampoo e caixa com doze sao revenda. Medido em 04/08: 14 das
-- 257 publicacoes do canal, 5,5%.
--
-- NAO E SOBRE PRECO, e essa distincao decide o desenho. O canal tem
-- membro de todo bolso, e produto caro pode ser exatamente o que alguem
-- quer. O problema e o produto nao ser PARA ELA: ninguem compra caixa
-- de canula ou doze sprays para usar em casa.
--
-- O MECANISMO E O MESMO DO `GENDER` (migration 37), de proposito: o
-- atributo sai do titulo e o canal decide se quer, por `canal_atributo`.
-- Nenhuma tabela nova, e a decisao continua sendo DADO — se um dia
-- houver canal de profissional de beleza, e so nao excluir la.
--
-- A REGRA E A MESMA DE `lib/uso-do-produto.ts`, e tem que continuar
-- sendo. Kit de tres ou quatro NAO entra: kit pequeno e compra normal
-- de quem cuida do cabelo. Doze do mesmo item e estoque.
--
-- O QUE ESTA MIGRATION NAO RESOLVE, e esta dito para ninguem achar que
-- resolveu: o canal tambem recebe produto que nao e beleza (cinta
-- modeladora, escova de dente, barbeador masculino) e titulo que aponta
-- defeito no corpo de quem le ("diminui barriga", "palpebra flacida").
-- Isso e decisao editorial do dono, nao regex, e continua aberto.
-- =============================================================

-- 1. O atributo, no que ja esta no banco.
update public.produto p
   set atributos = coalesce(p.atributos, '{}'::jsonb) || jsonb_build_object('USO', 'profissional'),
       atualizado_em = now()
 where coalesce(p.atributos->>'USO', '') = ''
   and (
        -- insumo de clinica e de salao
        p.titulo_canonico ~* '(microcanula|canula|seringa|agulha|cx c/|caixa c/|extensao de cilios|para extensao)'
        -- quantidade de revenda: dois digitos ou mais do mesmo item
     or p.titulo_canonico ~* '(kit *[1-9][0-9]|[1-9][0-9] *(unidades|un |pecas)|atacado|revenda|fardo)'
        -- volume de salao
     or p.titulo_canonico ~* '(1[,.]5 *l\M|[2-9] *l\M|[1-9][0-9]+ *litros?|1 *litro)'
   );

-- 2. O Beauty passa a excluir.
--
-- `exige_atributo = false` e a parte que importa: produto SEM o atributo
-- continua passando. So sai o que foi marcado, e o silencio nao reprova.
-- `operacao_id` vem do proprio canal, e a coluna e obrigatoria. A
-- primeira versao desta migration a omitiu e passou no banco local sem
-- reclamar, porque o local esta vazio: o `insert ... select` nao
-- selecionou linha nenhuma e a constraint nunca foi exercitada. Quebrou
-- so na nuvem, que e onde ha canal.
insert into public.canal_atributo (operacao_id, canal_id, atributo, valores, modo, exige_atributo)
select c.operacao_id, c.id, 'USO', array['profissional'], 'exclui', false
  from public.canal c
 where c.nome ilike '%Beauty%'
   and not exists (
     select 1 from public.canal_atributo ca
      where ca.canal_id = c.id and ca.atributo = 'USO'
   );

comment on column public.produto.atributos is
  'Atributos do produto. `GENDER` vem da API no Mercado Livre e da leitura do titulo na Shopee. `USO = profissional` marca insumo de clinica, atacado e volume de salao, para o canal poder excluir (migration 55). As duas leituras de titulo sao conservadoras: na duvida, nao marcam.';
