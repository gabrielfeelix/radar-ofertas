-- =============================================================
-- 68 · Kit de pincel volta para o Beauty, e o acento e a explicacao
--
-- O DONO PERGUNTOU por que a migration 55 nao resolveu todos os casos.
-- A resposta tem quatro partes, e esta e a que mais incomoda: A
-- MIGRATION 57 NUNCA CONSERTOU O TITULO QUE ELA PROPRIA NOMEIA.
--
-- Ela foi escrita para tirar "Kit 13 Pcs Pinceis de Maquiagem Com Bolsa
-- de Veludo" da marcacao de profissional, com o padrao
-- `kit *[1-9][0-9] *(pcs|pc |pecas|pincei)`. No banco o titulo e
-- "Kit 13 Pcs Pinceis" COM CEDILHA e COM ACENTO, e em SQL o `~*` e
-- insensivel a MAIUSCULA, nao a acento. `pcs` nunca casou com `Pcs`.
--
-- Medido em 04/08 a noite, no catalogo de producao: NOVE kits de pincel
-- de maquiagem marcados como profissional, ou seja, barrados do canal.
-- Sao produto-ALVO do Radar Beauty, no mesmo dia em que o dono pediu
-- mais qualidade nele.
--
-- E havia uma segunda causa, dentro de `lib/uso-do-produto.ts`: a regra
-- de `kit NN` excluia `pecas` com todo cuidado e a linha SEGUINTE, de
-- quantidade, marcava qualquer `NN pecas` de novo. As duas se anulavam
-- e a segunda ganhava. Consertado no mesmo commit, com teste.
--
-- POR QUE ESTA MIGRATION NAO TENTA SER ESPERTA. Ela desmarca por uma
-- lista de casos conferidos um a um contra o catalogo, e nao por um
-- regex novo. Regex novo em SQL foi o que criou este problema tres
-- vezes seguidas, e aqui ele nao e necessario: a regra viva passou a
-- ser a de `lib/uso-do-produto.ts`, que agora os DOIS coletores usam.
--
-- REGRA DAQUI PARA FRENTE, e esta e a licao de verdade: preenchimento
-- retroativo de `USO` passa por `lib/uso-do-produto.ts`, num script.
-- Nao se copia regex de migration antiga, porque migration e a
-- fotografia de uma regra que continuou andando.
-- =============================================================

update public.produto p
   set atributos = p.atributos - 'USO',
       atualizado_em = now()
 where p.atributos->>'USO' = 'profissional'
   and (
     -- conjunto de pecas DIFERENTES: pincel de base, de olho, de blush
     (p.titulo_canonico ilike '%pinc%' and p.titulo_canonico ilike '%kit%')
     or (p.titulo_canonico ilike '%pinc%' and p.titulo_canonico ilike '%conjunto%')
     or (p.titulo_canonico ilike '%pinc%' and p.titulo_canonico ilike '%jogo%')
     or (p.titulo_canonico ilike '%pinc%' and p.titulo_canonico ilike '%paleta%')
   )
   -- mas insumo de verdade continua marcado, mesmo tendo a palavra
   -- "pincel" no titulo: "Kit Limpeza Extensao de Cilios com Pincel"
   and p.titulo_canonico !~* '(agulha|derma pen|microcanula|canula|extensao de cilios|para extensao|atacado|revenda|fardo)';
