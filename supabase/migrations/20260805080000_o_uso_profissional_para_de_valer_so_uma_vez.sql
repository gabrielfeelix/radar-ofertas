-- =============================================================
-- 66 · O `USO = profissional` para de valer uma vez so
--
-- O DONO PERGUNTOU: "se a migration atacou, pq nao resolveu? ja era
-- pra ter resolvido todos os casos". Ele tem razao, e a resposta e um
-- defeito de desenho, nao de vocabulario.
--
-- A migration 55 fez um `update` de UMA VEZ SO sobre o que estava no
-- banco em 04/08 as 14h16, e o Beauty passou a excluir o que estivesse
-- marcado. Mas NADA aplicava a regra dali para frente no Mercado
-- Livre: quem importava `atributosComUso` era so `coleta-shopee.mjs`.
--
-- E os que escapam nao tem segunda chance. A escrita de `atributos` em
-- produto que ja existe e guardada por `is("atributos", null)`,
-- justamente para nao sobrescrever, e produto novo ja nasce com o
-- objeto preenchido pela API. Nulo ele nunca mais fica.
--
-- MEDIDO: na noite do MESMO dia da 55, 32 produtos do Mercado Livre
-- entraram casando com a regra e sem a marca. Entraram entre 19h48 e
-- 19h51, cinco horas depois da migration que deveria cobri-los.
--
-- O CONSERTO DE VERDADE E NO COLETOR, e vai junto neste commit:
-- `coleta-mercado-livre.mjs` passa a aplicar `atributosComUso`, como a
-- Shopee ja fazia. Esta migration e so a limpeza do que passou.
--
-- E ELA VAI CONTINUAR SENDO NECESSARIA DE VEZ EM QUANDO enquanto a
-- regra for de titulo: palavra nova aparece, a regra cresce, e o que
-- ja entrou continua sem marca. O que NAO pode voltar a acontecer e a
-- regra valer so para trás.
-- =============================================================

-- 1. O que escapou desde a 55, pela mesma regra dela.
update public.produto p
   set atributos = coalesce(p.atributos, '{}'::jsonb) || jsonb_build_object('USO', 'profissional'),
       atualizado_em = now()
 where coalesce(p.atributos->>'USO', '') = ''
   and (
        p.titulo_canonico ~* '(microcanula|canula|seringa|agulha|cx c/|caixa c/|extensao de cilios|para extensao)'
     or p.titulo_canonico ~* '(kit *[1-9][0-9]|[1-9][0-9] *(unidades|un |pecas)|atacado|revenda|fardo)'
     or p.titulo_canonico ~* '(1[,.]5 *l\M|[2-9] *l\M|[1-9][0-9]+ *litros?|1 *litro)'
   );

-- 2. E os dois dominios de insumo de salao, que a regra de titulo NAO
--    pega e nunca ia pegar.
--
-- "Toucas de cabeleireiro de tnt medico cozinheiro" nao tem numero, nao
-- tem litro e nao tem palavra de clinica: nenhum padrao da 55 casa com
-- ela, e escrever um que casasse pegaria junto a touca de cetim, que e
-- produto de consumidora e o dono quer no canal.
--
-- Dominio resolve o que titulo nao resolve, que e a mesma licao do
-- MLB-HAIR_EXTENSIONS na migration 64: quando a categoria inteira e do
-- profissional, o mapa e mais barato e mais certo que o texto.
--
-- Nao entram como `USO = profissional` e sim como dominio que nao
-- roteia, porque a diferenca importa: `USO` e sobre PARA QUEM o produto
-- serve e um canal de profissional poderia querer; aqui a decisao e que
-- nenhum canal nosso quer, hoje.
insert into public.nicho_dominio (operacao_id, marketplace_id, dominio_externo, nicho_id, observacao)
select o.id, m.id, v.dominio, null, v.nota
  from public.operacao o
  join public.marketplace m on m.slug = 'mercado_livre' and m.operacao_id = o.id
  cross join (values
    ('MLB-HAIRDRESSING_CAPS',        'Touca de cabeleireiro, TNT descartavel. Insumo de salao, decisao do dono em 04/08'),
    ('MLB-MICRONEEDLING_CARTRIDGES', 'Cartucho e agulha de microagulhamento. Insumo de clinica, decisao do dono em 04/08')
  ) as v(dominio, nota)
 where not exists (
   select 1 from public.nicho_dominio d
    where d.operacao_id = o.id and d.marketplace_id = m.id and d.dominio_externo = v.dominio
 );

-- 3. E o que ja esta no catalogo por esses dois dominios perde o nicho.
--    A guarda da fusao e a mesma da migration 64: so perde o nicho o
--    produto cujos anuncios sao TODOS do dominio bloqueado.
update public.produto p
   set nicho_id = null,
       atualizado_em = now()
 where p.nicho_id is not null
   and exists (
     select 1 from public.anuncio a
      where a.produto_id = p.id
        and a.dominio_externo in ('MLB-HAIRDRESSING_CAPS', 'MLB-MICRONEEDLING_CARTRIDGES')
   )
   and not exists (
     select 1 from public.anuncio a
      where a.produto_id = p.id
        and coalesce(a.dominio_externo, '') not in ('MLB-HAIRDRESSING_CAPS', 'MLB-MICRONEEDLING_CARTRIDGES')
   );
