-- =============================================================
-- Fase 1 · insumos da validação
--
-- O motor de curadoria precisa de três coisas que ainda não
-- existiam no banco:
--
--   1. Sinais de qualidade do anúncio (reputação do vendedor,
--      nota do produto, se é loja oficial). É a comporta que
--      funciona desde o dia 1, sem depender de histórico.
--   2. Percentual de comissão por categoria, para saber quanto a
--      oferta rende em reais. Desconto de 60% num produto de R$12
--      não paga o post.
--   3. Os limiares da curadoria, como dado e não como número
--      solto no código.
-- =============================================================

-- -------------------------------------------------------------
-- Sinais de qualidade no anúncio.
--
-- Todos podem ser nulos: nem toda loja informa tudo, e a
-- validação precisa funcionar com informação parcial. A regra
-- adotada é "na dúvida, não reprova por ausência" — reprovar por
-- campo vazio faria o sistema descartar anúncio bom só porque a
-- API daquela loja é pobre.
-- -------------------------------------------------------------
alter table public.anuncio
  add column avaliacao_qtd        integer,
  add column reputacao_vendedor   numeric(3,2),
  add column loja_oficial         boolean,
  add column vendas_estimadas     integer;

comment on column public.anuncio.avaliacao_qtd is
  'Quantas avaliações o produto tem. Nota 5,0 com 2 avaliações não vale nota 4,6 com 800.';
comment on column public.anuncio.reputacao_vendedor is
  'Reputação normalizada de 0 a 1. Cada loja tem escala própria; a conversão é feita na fonte.';
comment on column public.anuncio.loja_oficial is
  'Loja oficial da marca. Reduz risco de produto falsificado, que é o que queima grupo.';

alter table public.anuncio
  add constraint anuncio_reputacao_valida
    check (reputacao_vendedor is null or (reputacao_vendedor >= 0 and reputacao_vendedor <= 1)),
  add constraint anuncio_avaliacao_qtd_positiva
    check (avaliacao_qtd is null or avaliacao_qtd >= 0);

-- -------------------------------------------------------------
-- Comissão por categoria.
--
-- Nunca hardcode percentual no código: eles mudam por campanha
-- sazonal, e um número errado aqui distorce a nota de todas as
-- ofertas de uma categoria de uma vez.
--
-- A vigência é por período para que a comissão estimada de uma
-- oferta antiga continue explicável depois que o percentual mudar.
-- -------------------------------------------------------------
create table public.comissao_categoria (
  id             uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplace(id) on delete cascade,
  categoria      text not null,
  percentual     numeric(5,2) not null,
  vigente_desde  date not null default current_date,
  vigente_ate    date,
  criado_em      timestamptz not null default now(),

  constraint comissao_categoria_percentual_valido
    check (percentual >= 0 and percentual <= 100),
  constraint comissao_categoria_periodo_valido
    check (vigente_ate is null or vigente_ate >= vigente_desde)
);

comment on table public.comissao_categoria is
  'Percentual de comissão por categoria e loja, com vigência. Nunca hardcode isto no código.';

-- Impede dois percentuais valendo ao mesmo tempo para a mesma
-- categoria na mesma loja, que faria a comissão estimada depender
-- de qual linha o banco devolvesse primeiro.
create unique index comissao_categoria_vigente_uk
  on public.comissao_categoria (marketplace_id, categoria)
  where vigente_ate is null;

alter table public.comissao_categoria enable row level security;

-- -------------------------------------------------------------
-- Parâmetros da curadoria.
--
-- Os limiares vivem aqui, e não como constante no código, por um
-- motivo prático: eles vão ser ajustados toda semana no começo,
-- olhando o que passou e o que foi publicado. Cada ajuste sendo
-- um deploy tornaria o ajuste raro — e limiar que não se ajusta
-- é limiar errado.
-- -------------------------------------------------------------
create table public.parametro (
  chave         text primary key,
  valor         numeric not null,
  descricao     text not null,
  atualizado_em timestamptz not null default now()
);

comment on table public.parametro is
  'Limiares da curadoria. Ajustáveis sem deploy, porque vão mudar toda semana no começo.';

create trigger parametro_atualizado_em
  before update on public.parametro
  for each row execute function public.marca_atualizado_em();

alter table public.parametro enable row level security;

insert into public.parametro (chave, valor, descricao) values
  ('dias_minimos_de_serie', 14,
   'Dias de série necessários para afirmar desconto. Abaixo disso a oferta não é publicável (regra 3.4).'),

  ('janela_referencia_dias', 30,
   'Sobre quantos dias a mediana de referência é calculada.'),

  ('desconto_minimo_pct', 15,
   'Queda mínima contra a mediana para virar oferta. Abaixo disso é oscilação normal de preço.'),

  ('comissao_minima_centavos', 300,
   'Comissão estimada mínima. Oferta que rende menos que isto não paga o espaço no canal.'),

  ('avaliacao_minima', 3.8,
   'Nota mínima do produto, quando informada. Produto mal avaliado gera devolução e queima o canal.'),

  ('avaliacao_qtd_minima', 5,
   'Avaliações mínimas para a nota do produto contar. Nota alta com 2 avaliações não diz nada.'),

  ('reputacao_minima', 0.60,
   'Reputação mínima do vendedor, de 0 a 1, quando informada.'),

  ('dias_recompra_mesmo_anuncio', 21,
   'Intervalo mínimo antes de republicar o mesmo anúncio. Repetição é o que faz membro sair.');

-- -------------------------------------------------------------
-- Leitor de parâmetro.
--
-- Falha alto se a chave não existir. O contrário — devolver um
-- padrão silencioso — esconderia erro de digitação e faria o
-- sistema curar com limiar que ninguém escolheu.
-- -------------------------------------------------------------
create or replace function public.parametro(p_chave text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_valor numeric;
begin
  select valor into v_valor from public.parametro where chave = p_chave;
  if not found then
    raise exception 'Parâmetro % não existe.', p_chave;
  end if;
  return v_valor;
end;
$$;

grant select, insert, update, delete on public.comissao_categoria, public.parametro to service_role;
grant execute on function public.parametro(text) to service_role;
