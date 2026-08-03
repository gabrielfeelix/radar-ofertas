-- =============================================================
-- 48 · O teto diário dos canais vai de 50 para 150
--
-- Decisão do dono, em 03/08, depois de ver Tech e Kids baterem o teto
-- de 50 no mesmo dia: *"pq n bota 150 por dia? telegram é liberal"*.
--
-- DE ONDE VINHA O 50, E POR QUE ELE NÃO É LEI
--
-- A D-033 fixou o teto na referência de mercado para canal de nicho no
-- Telegram, que a pesquisa de 28/07 apurou em **20 a 50 por dia**. Não
-- é limite da plataforma: o Telegram não reclama de volume nenhum. É o
-- ponto onde a pesquisa dizia que o membro começa a silenciar o canal.
--
-- Referência de mercado não é medição nossa. O número certo para os
-- NOSSOS canais só sai observando os nossos canais.
--
-- 150 CABE NO RITMO, e isso foi conferido antes de mexer
--
-- Com `intervalo_pico_min` e `intervalo_normal_min` em 5 e madrugada em
-- 30, o dia comporta cerca de 218 publicações. Então 150 é teto de
-- verdade, e não um número que o ritmo nunca alcançaria.
--
-- E CONTINUA SENDO TETO, NÃO META
--
-- O canal só publica o que passa nas comportas de curadoria. Subir o
-- teto não afrouxa nenhuma delas: `desconto_declarado_min_pct`,
-- `avaliacao_minima` e as comportas de vendedor continuam iguais. O que
-- muda é o canal deixar de ser barrado por cota quando há oferta boa
-- sobrando — que foi exatamente o que aconteceu hoje.
--
-- O QUE OLHAR DEPOIS
--
-- O sinal de que 150 é demais não vem do sistema, vem do canal: gente
-- saindo, ou o número de membros parando de crescer enquanto o volume
-- sobe. Se acontecer, isto se desfaz com um `update` de uma linha.
-- =============================================================

update public.canal
   set posts_por_dia_max = 150,
       atualizado_em = now()
 where posts_por_dia_max < 150;
