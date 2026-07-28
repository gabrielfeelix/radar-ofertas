-- =============================================================
-- 05 · Parâmetros da curadoria, com herança por nicho (D-023)
--
-- Os limiares vivem em dado, e não em código, por um motivo
-- prático: vão ser ajustados toda semana no começo, olhando o que
-- passou e o que foi publicado. Se cada ajuste exigir publicar uma
-- versão nova, o ajuste vira raro — e limiar que não se ajusta é
-- limiar errado.
--
-- A herança existe porque um limiar único não serve a dois nichos:
-- 20% de desconto em ração é oferta excelente, 20% em eletrônico é
-- terça-feira comum. Um número só ou reprova tudo de um lado ou
-- carimba tudo do outro — e "curadoria virou carimbo" é o modo de
-- falha que o roadmap manda vigiar.
--
-- Configura-se apenas o que foge do padrão.
-- =============================================================

create table public.parametro (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references public.operacao(id) on delete cascade,
  chave         text not null,
  -- Nulo = valor global. Preenchido = sobrescreve para o nicho.
  nicho_id      uuid references public.nicho(id) on delete cascade,
  valor         numeric not null,
  descricao     text,
  atualizado_em timestamptz not null default now(),
  criado_em     timestamptz not null default now()
);

comment on table public.parametro is
  'Limiares da curadoria. Linha sem nicho é o padrão; com nicho, sobrescreve (D-023).';

-- `nulls not distinct` faz o Postgres tratar dois nulos como
-- iguais, que é o que se quer aqui: não pode haver dois valores
-- globais para a mesma chave.
create unique index parametro_uk
  on public.parametro (operacao_id, chave, nicho_id)
  nulls not distinct;

create index parametro_nicho_idx on public.parametro (nicho_id) where nicho_id is not null;

create trigger parametro_atualizado_em
  before update on public.parametro
  for each row execute function public.marca_atualizado_em();

alter table public.parametro enable row level security;

-- -------------------------------------------------------------
-- Os limiares globais.
--
-- SÉRIE: dois números distintos, e a distinção importa.
--   `dias_minimos_de_serie`  — a partir de quando dá para AVALIAR
--   `dias_para_afirmar`      — a partir de quando dá para AFIRMAR
--                              mínimo histórico na mensagem
--
-- Estavam juntos em 14 na primeira modelagem, o que significava
-- não avaliar nada antes de duas semanas. Separar ganha uma semana
-- de canal vivo sem afrouxar honestidade nenhuma: entre 7 e 14
-- dias a oferta existe, mas a mensagem usa a redação honesta com a
-- data de início da observação (regra 3.4 do AGENTS.md).
-- -------------------------------------------------------------
insert into public.parametro (operacao_id, chave, valor, descricao)
select o.id, v.chave, v.valor, v.descricao from public.operacao o,
(values
  ('dias_minimos_de_serie', 7,
   'Dias de série para o anúncio poder ser avaliado.'),

  ('dias_para_afirmar', 14,
   'Dias de série para a mensagem poder afirmar mínimo histórico. Abaixo disso, redação honesta com data.'),

  ('janela_referencia_dias', 30,
   'Sobre quantos dias a mediana de referência é calculada.'),

  ('janela_minimo_dias', 90,
   'Janela para a comporta "é o menor preço que já vimos".'),

  ('desconto_minimo_pct', 18,
   'Queda mínima contra a mediana. Abaixo disso é oscilação normal de preço.'),

  ('comissao_minima_centavos', 300,
   'Comissão estimada mínima. Oferta que rende menos não paga o espaço no canal.'),

  ('avaliacao_minima', 3.8,
   'Nota mínima do produto, quando informada.'),

  ('avaliacao_qtd_minima', 5,
   'Avaliações mínimas para a nota do produto contar. Nota alta com duas avaliações não diz nada.'),

  ('reputacao_minima', 0.60,
   'Reputação mínima do vendedor, de 0 a 1, quando informada.'),

  ('dias_recompra_mesmo_anuncio', 30,
   'Intervalo mínimo antes de republicar o mesmo anúncio. Repetição é o que faz membro sair.'),

  ('recorrencia_maxima_pct', 40,
   'Se o anúncio passou mais que esta fração da janela neste preço, não é oferta: é o preço normal com etiqueta de promoção (D-024).'),

  ('tolerancia_alta_pct', 3,
   'Quanto o preço pode subir acima do preço da oferta antes dela ser considerada morta.'),

  ('horas_validade_oferta', 48,
   'Depois disso a oferta na fila expira sozinha. Preço tem prazo de validade.'),

  ('dias_resolucao_diaria', 120,
   'Por quantos dias a série guarda um ponto por dia. Antes disso, um por semana.'),

  ('teto_adiamentos', 3,
   'Quantas vezes a mesma oferta pode ser adiada antes de ser descartada.')
) as v(chave, valor, descricao);

-- Pet tem ticket baixo: ração de R$100 a 12% rende R$12, e o teto
-- de comissão da nota é R$10. Um limiar de comissão global alto
-- reprovaria acessório de pet inteiro.
insert into public.parametro (operacao_id, chave, nicho_id, valor)
select n.operacao_id, 'comissao_minima_centavos', n.id, 200
  from public.nicho n where n.slug = 'pet';

-- =============================================================
-- parametro(chave, nicho) — o leitor, com herança
--
-- Falha alto se a chave não existir. Devolver um padrão silencioso
-- esconderia erro de digitação e faria o sistema curar com limiar
-- que ninguém escolheu.
-- =============================================================
create or replace function public.parametro(p_chave text, p_nicho_id uuid default null)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_valor numeric;
begin
  -- Tenta o nicho; não achando, cai no global.
  select p.valor into v_valor
    from public.parametro p
   where p.chave = p_chave
     and (p.nicho_id = p_nicho_id or p.nicho_id is null)
   order by p.nicho_id nulls last
   limit 1;

  if v_valor is null then
    raise exception 'Parâmetro % não existe.', p_chave;
  end if;

  return v_valor;
end;
$$;

comment on function public.parametro is
  'Valor do limiar para o nicho, caindo no global quando não houver sobrescrita.';

-- =============================================================
-- View: parametro_efetivo
--
-- O valor que vale para cada par (nicho, chave), já resolvido.
--
-- Existe porque o motor avalia o catálogo inteiro numa passada e
-- precisa dos limiares como TABELA, não como função escalar —
-- chamar `parametro()` por anúncio traria de volta o problema que
-- a avaliação em conjunto resolveu.
-- =============================================================
create view public.parametro_efetivo
with (security_invoker = true)
as
select
  n.id                                   as nicho_id,
  g.chave,
  coalesce(e.valor, g.valor)             as valor,
  (e.id is not null)                     as sobrescrito
from public.nicho n
join public.parametro g on g.operacao_id = n.operacao_id and g.nicho_id is null
left join public.parametro e
       on e.chave = g.chave and e.nicho_id = n.id;

comment on view public.parametro_efetivo is
  'O limiar que vale para cada nicho, com a herança já resolvida. É o que o motor lê.';
