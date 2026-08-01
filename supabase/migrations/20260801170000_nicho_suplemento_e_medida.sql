-- =============================================================
-- 26 · Suplemento vira nicho, e a medida que importa (Frente E)
--
-- A reclassificação de 01/08 deixou 131 produtos sem nicho, e eles NÃO
-- SÃO LIXO: são catálogo de nichos que a gente nunca declarou. O maior
-- deles, de longe, é suplemento, com 61 produtos — mais que qualquer
-- domínio de pet ou de casa.
--
-- E não é acaso. As buscas por "racao cachorro" e "racao gato"
-- arrastaram a prateleira de suplemento humano inteira, porque a busca
-- do ML casa por texto. O whey publicado no canal de pet foi a ponta
-- disso aparecendo no canal.
--
-- Então o produto já está aqui, com série de preço sendo construída
-- desde ontem. Falta só ter onde publicá-lo.
-- =============================================================

insert into public.nicho (operacao_id, slug, nome)
select id, 'suplemento', 'Suplemento'
  from public.operacao
on conflict do nothing;

-- O domínio que estava marcado como "conhecido e não roteia" passa a
-- rotear. É a linha que transforma 61 produtos parados em catálogo.
update public.nicho_dominio nd
   set nicho_id = n.id,
       observacao = 'Era o maior domínio sem nicho da base, com 61 produtos. Virou nicho em 01/08.',
       atualizado_em = now()
  from public.nicho n
 where n.operacao_id = nd.operacao_id
   and n.slug = 'suplemento'
   and nd.dominio_externo = 'MLB-SUPPLEMENTS';


-- -------------------------------------------------------------
-- A MEDIDA QUE IMPORTA, e ela não é o tamanho da base
--
-- O critério da Fase 1 é "a detecção aprova 30 ou mais ofertas por dia,
-- por uma semana, sem afrouxar parâmetro". Ninguém conseguia responder
-- isso sem contar à mão, e "quantos anúncios temos" era a resposta
-- fácil e errada: 499 anúncios com 6 ofertas é base grande e radar
-- parado.
--
-- O motivo da rejeição vem junto de propósito. Sem ele, "poucas
-- ofertas" e "muitas ofertas reprovadas" parecem o mesmo problema, e
-- são opostos: um pede mais base, o outro pede comporta mais frouxa.
-- -------------------------------------------------------------
create or replace view public.ofertas_por_dia
with (security_invoker = true)
as
select (o.detectada_em at time zone 'America/Sao_Paulo')::date as dia,
       o.operacao_id,
       count(*)                                          as detectadas,
       count(*) filter (where o.gatilho = 'queda')       as por_queda,
       count(*) filter (where o.gatilho = 'declarado')   as por_desconto_declarado,
       count(*) filter (where o.gatilho = 'serie')       as por_serie,
       count(*) filter (where o.status = 'rejeitada')    as rejeitadas,
       count(distinct p.id)                              as publicadas
  from public.oferta o
  left join public.publicacao p
         on p.oferta_id = o.id and p.estado = 'enviada'
 group by 1, 2
 order by 1 desc;

comment on view public.ofertas_por_dia is
  'Quantas ofertas por dia, por gatilho, e quantas viraram publicação. É a medida do critério da Fase 1: base grande com radar parado não conta.';


create or replace view public.motivo_de_rejeicao
with (security_invoker = true)
as
select (o.detectada_em at time zone 'America/Sao_Paulo')::date as dia,
       o.operacao_id,
       -- O motivo carrega o valor entre parênteses ("vendedor_fraco(0.1)"),
       -- que serve para investigar um caso e atrapalha para contar.
       split_part(coalesce(o.motivo_rejeicao, 'sem_motivo'), '(', 1) as motivo,
       count(*) as quantas
  from public.oferta o
 where o.status = 'rejeitada'
 group by 1, 2, 3
 order by 1 desc, 4 desc;

comment on view public.motivo_de_rejeicao is
  'Por que as ofertas não saíram, por dia. É por aqui que se decide o que calibrar: comporta apertada demais e falta de canal para o nicho doem igual e se resolvem diferente.';
