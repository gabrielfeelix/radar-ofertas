-- =============================================================
-- 70 · O Radar Delas do Telegram também recusa masculino em beleza
--
-- Em 11/08 saiu no canal, que é de mulheres:
--
--     Aparador De Pelos Supergroom-10 Mondial Bivolt Bg-10
--
-- O produto tem `GENDER: "Masculino"` vindo do Mercado Livre, e o canal
-- tem regra de excluir masculino. As duas coisas são verdade, e mesmo
-- assim ele publicou.
--
-- A CAUSA É ESCOPO DE NICHO, e ela é a armadilha que o `AGENTS.md` já
-- registra sobre `canal_aceita_atributos`: o filtro vale por nicho, e o
-- que não está no nicho certo não filtra nada.
--
--     Radar Delas (WhatsApp)   GENDER exclui Masculino   perfume   ✓
--     Radar Delas (WhatsApp)   GENDER exclui Masculino   beleza    ✓
--     Radar Delas (Telegram)   GENDER exclui Masculino   perfume   ✓
--     Radar Delas (Telegram)          (nada)             beleza    ✗
--
-- O aparador é do nicho `beleza`. No WhatsApp ele foi barrado; no
-- Telegram passou reto. **Os dois canais são o mesmo público e
-- divergiram porque a regra foi criada uma vez só**, quando o de
-- WhatsApp nasceu.
--
-- `exige_atributo = false` de propósito, copiando a linha do WhatsApp:
-- em beleza a maioria dos produtos não traz `GENDER` nenhum, e exigir o
-- atributo calaria o canal inteiro. Quem não declara passa; quem
-- declara masculino, não.
--
-- ENTRA JUNTO o `USO = profissional`, que o canal de WhatsApp tem e o
-- de Telegram nunca ganhou. É o filtro que tira microcânula, oxidante e
-- shampoo de 1,5 litro do canal (migration 55), e a mesma divergência o
-- deixou de fora aqui.
-- =============================================================

insert into public.canal_atributo (operacao_id, canal_id, atributo, valores, modo, nicho_id, exige_atributo)
select c.operacao_id, c.id, v.atributo, v.valores, 'exclui', v.nicho_id, v.exige
  from public.canal c
 cross join (
   select 'GENDER'::text as atributo,
          array['Masculino']::text[] as valores,
          (select id from public.nicho where slug = 'beleza') as nicho_id,
          false as exige
   union all
   select 'USO', array['profissional'], null, false
 ) as v
 where c.nome = 'Radar Delas (Telegram)'
   and not exists (
     select 1 from public.canal_atributo a
      where a.canal_id = c.id
        and a.atributo = v.atributo
        and a.nicho_id is not distinct from v.nicho_id
   );
