-- =============================================================
-- 43 · O filtro pode exigir que o atributo exista
--
-- A migration 37 decidiu que **produto sem o atributo passa**, e a
-- razão continua boa no geral: metade do catálogo do ML não preenche
-- metade dos atributos, e reprovar por ausência cala o canal por causa
-- do cadastro de um terceiro.
--
-- MAS ELA ESTÁ ERRADA PARA O PAR BEAUTY/PERFUMES, e o primeiro perfume
-- que entrou no catálogo mostrou isso na hora:
--
--   "Kit Body Splash Masculino Barbarius..."   atributos = null
--
-- Com "sem atributo passa" nos dois lados, esse produto casa com
-- `GENDER inclui Masculino` E com `GENDER exclui Masculino`. Ou seja:
-- sai **nos dois canais**, que era exatamente o que o desenho prometia
-- evitar. E pior no outro sentido: um perfume feminino sem `GENDER`
-- gravado iria para um canal anunciado como masculino.
--
-- O DEFEITO NÃO É O PADRÃO, É ELE SER O ÚNICO COMPORTAMENTO. Os dois
-- canais do par têm papéis diferentes:
--
--   Perfumes (masc)  é um RECORTE. Sem o dado, não dá para saber se o
--                    produto é do recorte, e o certo é ficar de fora:
--                    canal mudo é menos ruim que canal errado.
--   Beauty           é o RESTO. Ele fica com quem não casa e também com
--                    quem não declara, e assim nada some do catálogo.
--
-- Então o comportamento na ausência passa a ser declarado por filtro.
-- O padrão continua `false`, e nenhum filtro existente muda.
-- =============================================================

alter table public.canal_atributo
  add column if not exists exige_atributo boolean not null default false;

comment on column public.canal_atributo.exige_atributo is
  'Quando verdadeiro, produto que NÃO declara o atributo é reprovado. Padrão falso: o desconhecido passa, para não calar o canal por cadastro de terceiro. Use verdadeiro no canal que é RECORTE, não no que é RESTO.';


-- -------------------------------------------------------------
-- A função do banco acompanha
--
-- Espelha `canal-aceita.ts`, que é quem o publicador usa de fato.
-- -------------------------------------------------------------
create or replace function public.canal_aceita_atributos(
  p_canal_id   uuid,
  p_atributos  jsonb
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
       and case
             -- Não declara o atributo: reprova só se o filtro exigir.
             when coalesce(p_atributos ->> ca.atributo, '') = '' then ca.exige_atributo
             when ca.modo = 'inclui' then not ((p_atributos ->> ca.atributo) = any (ca.valores))
             when ca.modo = 'exclui' then      (p_atributos ->> ca.atributo) = any (ca.valores)
             else false
           end
  );
$$;

comment on function public.canal_aceita_atributos is
  'Se o canal aceita um produto, dados os atributos dele. Verdadeiro quando não há filtro. Produto sem o atributo passa, salvo quando o filtro tem `exige_atributo`.';

grant execute on function public.canal_aceita_atributos(uuid, jsonb) to authenticated, service_role;
