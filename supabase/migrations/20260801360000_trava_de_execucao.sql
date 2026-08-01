-- =============================================================
-- 45 · Duas execuções do publicador não podem coexistir
--
-- O QUE ACONTECEU, e foi observável no canal: em 01/08 às 19:36 e
-- 19:41 os sete canais publicaram duas vezes cada, com **44 segundos**
-- de intervalo, com o ritmo configurado em cinco minutos. Não é bug do
-- ritmo — `podePublicarAgora` está correto e testado. Foram **duas
-- instâncias do publicador ao mesmo tempo**: a do agendador e uma
-- rodada à mão.
--
-- Cada instância lê `canal.ultima_publicacao_em` uma vez, no começo, e
-- mantém a própria cópia em memória. A instância A publica e grava; a B
-- não vê, porque não relê. O ritmo vira ritmo por processo, e com N
-- processos o canal fala N vezes mais.
--
-- E O ESTRAGO PIOR NÃO É O RITMO. As duas instâncias leem a mesma fila
-- de `publicacao` com `estado = 'pendente'`. Nada impede as duas de
-- pegarem a MESMA linha e mandarem a MESMA mensagem: é a D-040 de novo,
-- que custou nove publicações repetidas no canal.
--
-- Rodar à mão foi o que revelou, mas o agendador sozinho já corre o
-- risco: o cron dispara de hora em hora e a janela do publicador é de
-- 50 minutos. Um run que atrase mais de dez minutos encontra o
-- seguinte, e ninguém é avisado.
--
-- A TRAVA É DE TEMPO, NÃO DE SESSÃO. Advisory lock do Postgres seria o
-- natural, e não serve aqui: cada chamada via PostgREST é uma sessão
-- nova e o lock morre junto com ela. Então a trava é uma linha com
-- prazo — quem toma, escreve até quando; quem chega depois só entra se
-- o prazo venceu. Prazo vencido é destravamento automático, e é o que
-- impede um processo morto de calar o sistema para sempre.
-- =============================================================

create table if not exists public.trava (
  nome        text primary key,
  dono        text not null,
  tomada_em   timestamptz not null default now(),
  expira_em   timestamptz not null
);

comment on table public.trava is
  'Trava de exclusão mútua entre execuções, com prazo. Prazo vencido destrava sozinho: processo morto não pode calar o sistema.';
comment on column public.trava.dono is
  'Quem tomou. Só para diagnóstico — não é conferido na hora de soltar, porque quem soltaria seria justamente quem morreu.';

alter table public.trava enable row level security;
grant all on public.trava to service_role;


-- -------------------------------------------------------------
-- Toma se estiver livre. Devolve verdadeiro quando tomou.
--
-- `insert ... on conflict do update` com a condição no `where` é o que
-- torna isto atômico: duas chamadas simultâneas disputam a mesma linha
-- e o Postgres serializa, então exatamente uma vê `xmax = 0` ou a
-- condição de prazo satisfeita.
-- -------------------------------------------------------------
create or replace function public.toma_trava(
  p_nome    text,
  p_dono    text,
  p_minutos integer default 55
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_tomou boolean;
begin
  insert into public.trava (nome, dono, tomada_em, expira_em)
  values (p_nome, p_dono, now(), now() + make_interval(mins => p_minutos))
  on conflict (nome) do update
    set dono = excluded.dono,
        tomada_em = excluded.tomada_em,
        expira_em = excluded.expira_em
    -- Só rouba a trava de quem já venceu.
    where public.trava.expira_em < now()
  returning true into v_tomou;

  return coalesce(v_tomou, false);
end;
$$;

comment on function public.toma_trava is
  'Toma a trava se livre ou vencida. Falso = outra execução está viva, e quem chamou deve desistir em vez de rodar junto.';

create or replace function public.solta_trava(p_nome text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.trava where nome = p_nome;
$$;

comment on function public.solta_trava is
  'Solta a trava no fim da execução. Não confere o dono de propósito: quem precisaria soltar uma trava órfã é justamente quem não está mais lá, e para isso existe o prazo.';

grant execute on function public.toma_trava(text, text, integer) to service_role;
grant execute on function public.solta_trava(text) to service_role;
