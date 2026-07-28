-- =============================================================
-- 10 · Registro de execução das rotinas
--
-- POR QUE ISTO EXISTE
--
-- "As falhas deste sistema são silenciosas: a coleta para e nada
-- acontece na tela." Está escrito na especificação da tela
-- "Precisa de atenção" — e essa tela não tinha nenhum dado por
-- trás. O resumo de cada execução ia para o log do agendador e
-- sumia.
--
-- Sem esta tabela, o alerta mais importante do produto — a coleta
-- parou há cinco dias — é impossível de mostrar. E buraco de série
-- não se recupera: preço de terça passada não existe mais em lugar
-- nenhum.
-- =============================================================

create table public.execucao_rotina (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references public.operacao(id) on delete cascade,
  tarefa        text not null,
  iniciada_em   timestamptz not null default now(),
  terminada_em  timestamptz,
  sucesso       boolean,
  -- Números da execução: quantos consultados, gravados, pulados,
  -- e as falhas por motivo. Fica em jsonb porque cada tarefa tem
  -- números próprios e eles vão mudar.
  resumo        jsonb,
  -- Preenchido só quando falha. É o que a tela mostra.
  erro          text,

  constraint execucao_tarefa_valida
    check (tarefa in ('coleta', 'colheita', 'manutencao'))
);

comment on table public.execucao_rotina is
  'Uma linha por execução de rotina. Sem isto, a falha da coleta é invisível na interface.';
comment on column public.execucao_rotina.resumo is
  'Números da execução. jsonb porque cada tarefa conta coisas diferentes.';

create index execucao_recente_idx
  on public.execucao_rotina (operacao_id, tarefa, iniciada_em desc);

alter table public.execucao_rotina enable row level security;

-- -------------------------------------------------------------
-- Abre e fecha a execução. O agendador chama as duas.
-- -------------------------------------------------------------
create or replace function public.abre_execucao(p_tarefa text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.execucao_rotina (operacao_id, tarefa)
  select o.id, p_tarefa from public.operacao o limit 1
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fecha_execucao(
  p_id      uuid,
  p_sucesso boolean,
  p_resumo  jsonb default null,
  p_erro    text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.execucao_rotina
     set terminada_em = now(), sucesso = p_sucesso, resumo = p_resumo, erro = p_erro
   where id = p_id;
$$;

-- =============================================================
-- View: saúde da operação
--
-- Agrega, não lista. Com três mil anúncios, no dia em que o
-- coletor falha, listar seria três mil linhas — e a tela que
-- existe para dizer "tem algo quebrado" viraria a coisa mais
-- quebrada da interface.
-- =============================================================
create view public.saude_operacao
with (security_invoker = true)
as
select
  o.id as operacao_id,

  (select max(e.iniciada_em) from public.execucao_rotina e
    where e.operacao_id = o.id and e.tarefa = 'coleta')            as ultima_coleta,

  (select e.sucesso from public.execucao_rotina e
    where e.operacao_id = o.id and e.tarefa = 'coleta'
    order by e.iniciada_em desc limit 1)                           as ultima_coleta_ok,

  (select count(*) from public.anuncio a
    join public.marketplace m on m.id = a.marketplace_id
   where a.operacao_id = o.id and a.ativo and m.base_de_historico
     and (a.ultima_coleta_em is null
          or a.ultima_coleta_em < now() - interval '2 days'))      as anuncios_parados,

  (select count(*) from public.produto p
    where p.operacao_id = o.id and p.nicho_id is null)             as produtos_sem_nicho,

  (select count(*) from public.mencao me
    where me.operacao_id = o.id
      and me.resultado in ('nao_reconhecido', 'erro'))             as mencoes_com_problema,

  (select count(*) from public.oferta f
    where f.operacao_id = o.id and f.status = 'nova')              as ofertas_na_fila,

  (select count(*) from public.marketplace m
    where m.operacao_id = o.id and m.ativo and m.afiliado_id is null)
                                                                   as lojas_sem_credencial,

  -- Sem percentual, a comissão estimada é nula e TODA oferta da
  -- loja é reprovada. É bloqueio silencioso de configuração, não
  -- de curadoria, e precisa aparecer como tal.
  (select count(*) from public.marketplace m
    where m.operacao_id = o.id and m.ativo and m.base_de_historico
      and m.comissao_padrao_pct is null
      and not exists (select 1 from public.comissao_categoria cc
                       where cc.marketplace_id = m.id and cc.vigente_ate is null))
                                                                   as lojas_sem_comissao,

  (select count(*) from public.canal c
    where c.operacao_id = o.id and c.ativo)                        as canais_ativos
from public.operacao o;

comment on view public.saude_operacao is
  'Números agregados da tela "Precisa de atenção" e da trilha de arranque.';
