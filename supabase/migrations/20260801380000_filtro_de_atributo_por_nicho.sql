-- =============================================================
-- 47 · O filtro de atributo passa a ter escopo de nicho
--
-- O DEFEITO, e ele apareceu na simulação antes de chegar ao canal — o
-- que só aconteceu porque `limpa-fila.mjs` roda com `--seco` primeiro:
--
--   ✗ Radar Beauty  não passa no filtro de atributo  Shampoo Anticaspa
--   ✗ Radar Beauty  não passa no filtro de atributo  Protetor Solar FPS 80
--   ✗ Radar Beauty  não passa no filtro de atributo  Absorvente Diário Carefree
--
-- Doze produtos de beleza legítimos seriam cancelados.
--
-- A CAUSA É MINHA E É DE DESENHO. A migration 43 fez o filtro `GENDER
-- exclui Masculino, exige` valer para o CANAL inteiro. Ele foi pensado
-- para perfume, mas o Radar Beauty aceita `beleza` e `perfume` — e
-- shampoo não declara `GENDER`, então caía no `exige` e era reprovado.
--
-- Quanto mais estreito o filtro, mais isso dói: `exige_atributo` só faz
-- sentido dentro do nicho onde o atributo é a distinção. Fora dele,
-- exigir um atributo que a prateleira nem usa cala o canal.
--
-- Então o filtro ganha escopo. `nicho_id` nulo continua significando
-- "vale para tudo que entra no canal", que é o comportamento de hoje e
-- o certo para um canal de nicho único.
-- =============================================================

alter table public.canal_atributo
  add column if not exists nicho_id uuid references public.nicho (id) on delete cascade;

comment on column public.canal_atributo.nicho_id is
  'A que nicho este filtro se aplica. Nulo = vale para tudo que entra no canal. Preenchido é o que permite "só perfume é filtrado por GENDER" num canal que também aceita beleza.';

-- A unicidade passa a considerar o escopo: o mesmo canal pode filtrar
-- `GENDER` de um jeito em perfume e de outro em moda.
alter table public.canal_atributo
  drop constraint if exists canal_atributo_unico;

create unique index if not exists canal_atributo_unico
  on public.canal_atributo (canal_id, atributo, modo, coalesce(nicho_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists canal_atributo_nicho_idx
  on public.canal_atributo (nicho_id)
  where nicho_id is not null;


-- -------------------------------------------------------------
-- A função do banco acompanha
-- -------------------------------------------------------------
drop function if exists public.canal_aceita_atributos(uuid, jsonb);

create or replace function public.canal_aceita_atributos(
  p_canal_id   uuid,
  p_atributos  jsonb,
  p_nicho_id   uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
      from public.canal_atributo ca
     where ca.canal_id = p_canal_id
       -- Filtro com escopo só opina sobre o nicho dele.
       and (ca.nicho_id is null or ca.nicho_id = p_nicho_id)
       and case
             when coalesce(p_atributos ->> ca.atributo, '') = '' then ca.exige_atributo
             when ca.modo = 'inclui' then not ((p_atributos ->> ca.atributo) = any (ca.valores))
             when ca.modo = 'exclui' then      (p_atributos ->> ca.atributo) = any (ca.valores)
             else false
           end
  );
$$;

comment on function public.canal_aceita_atributos(uuid, jsonb, uuid) is
  'Se o canal aceita um produto. Filtro com `nicho_id` só opina sobre produtos daquele nicho; com nulo, vale para o canal inteiro.';

grant execute on function public.canal_aceita_atributos(uuid, jsonb, uuid) to authenticated, service_role;


-- O filtro do Radar Beauty passa a valer só em perfume. O do Radar
-- Perfumes também ganha escopo: ele só aceita perfume hoje, mas
-- escrever o escopo evita que adicionar um nicho ao canal amanhã
-- silencie o canal sem ninguém entender por quê.
update public.canal_atributo ca
   set nicho_id = n.id, atualizado_em = now()
  from public.nicho n, public.canal c
 where n.operacao_id = ca.operacao_id
   and n.slug = 'perfume'
   and c.id = ca.canal_id
   and ca.atributo = 'GENDER'
   and ca.nicho_id is null;
