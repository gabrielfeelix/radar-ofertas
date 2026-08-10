-- =============================================================
-- O roteamento do Delas ignorou o filtro por nicho
-- =============================================================
--
-- (Carimbo `20260811010000`. Conserta o que a `20260810230000` fez.)
--
-- O DEFEITO, e ele é de assinatura de função.
--
-- `canal_aceita_atributos` tem duas versões vivas no banco:
--
--   (uuid, jsonb)          a original, da migration 20260801280000
--   (uuid, jsonb, uuid)    com `p_nicho_id`, da 20260801380000
--
-- A migration de roteamento chamou a de DOIS argumentos. E a de três
-- tem `p_nicho_id default null`, então a chamada resolveu sem erro, sem
-- aviso, e com o nicho nulo.
--
-- Com o nicho nulo, esta linha do corpo da função desliga todo filtro
-- que tem escopo:
--
--   and (ca.nicho_id is null or ca.nicho_id = p_nicho_id)
--
-- `ca.nicho_id = null` é NULL, não é verdadeiro. O filtro escapa do
-- `where` e a função devolve verdadeiro.
--
-- CONSEQUÊNCIA MEDIDA: o filtro "GENDER exclui Masculino em beleza",
-- configurado no Radar Delas horas antes justamente para isto, foi
-- pulado. Aparador de Pelos Mondial, Máquina Kemei e Barbeador Philips
-- entraram na fila de um grupo de mulheres, **mesmo já estando
-- marcados** com `GENDER=Masculino` pelo script de remarcação.
--
-- Conferido depois, chamando a função das duas formas com o mesmo
-- produto:
--
--   canal_aceita_atributos(delas, '{"GENDER":"Masculino"}')            -> true
--   canal_aceita_atributos(delas, '{"GENDER":"Masculino"}', beleza)    -> false
--
-- Este é o tipo de erro que não levanta exceção: a chamada é válida, o
-- resultado é plausível, e o defeito só aparece lendo o que entrou na
-- fila.

-- -------------------------------------------------------------
-- Tira da fila do Delas o que o filtro certo recusaria.
--
-- Só o que ainda não saiu. Publicação enviada é história, e apagar
-- história faria o subid circular sem dono (a mesma ressalva de
-- `desfazDecisao`, em lib/ofertas.ts).
-- -------------------------------------------------------------
delete from public.publicacao pub
 using public.canal c, public.oferta o, public.anuncio a, public.produto p
 where pub.canal_id = c.id
   and c.nome = 'Radar Delas'
   and c.plataforma = 'whatsapp'
   and pub.oferta_id = o.id
   and o.anuncio_id = a.id
   and a.produto_id = p.id
   and pub.enviada_em is null
   and not public.canal_aceita_atributos(c.id, p.atributos, p.nicho_id);
