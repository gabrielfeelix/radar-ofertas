-- =============================================================
-- 57 · Gloss em seringa e kit de pinceis voltam para o Beauty
--
-- Dois falsos positivos da migration 55, e os dois sao produto-alvo do
-- canal, que e o pior lugar para errar:
--
--   Lip Gloss Seringa Brilho Intenso Duradouro
--   Kit 13 Pcs Pinceis de Maquiagem Com Bolsa de Veludo
--
-- "Seringa" ali e o FORMATO da embalagem, um gloss em forma de seringa,
-- que e tendencia e e exatamente o que o canal existe para publicar.
-- E `kit 13 pcs` sao treze pecas DIFERENTES: pincel de base, de olho, de
-- blush. Isso e compra normal de quem se maquia, nao estoque.
--
-- A regra nao distingue "doze sprays iguais" de "treze pinceis
-- diferentes", e nenhuma regex distingue com seguranca. O que da para
-- fazer e o que esta aqui: tirar os dois padroes que produzem o erro, e
-- aceitar que o filtro deixa passar algum atacado. Deixar passar
-- atacado custa um post ruim; barrar gloss custa o produto que faz a
-- pessoa ficar no canal.
--
-- `agulha` e `derma pen` continuam, e cobrem o insumo de verdade
-- (cartucho de microagulhamento) sem esse custo.
-- =============================================================

update public.produto p
   set atributos = p.atributos - 'USO',
       atualizado_em = now()
 where p.atributos->>'USO' = 'profissional'
   and (
        -- gloss em seringa, e qualquer outro uso de "seringa" que nao
        -- venha acompanhado de sinal de insumo
        (p.titulo_canonico ~* 'seringa'
         and p.titulo_canonico !~* '(agulha|derma pen|microcanula|canula|cx c/)')
        -- conjunto de pecas diferentes
     or p.titulo_canonico ~* 'kit *[1-9][0-9] *(pcs|pc |pecas|pincei)'
   );
