-- =============================================================
-- 16 · Publicação — a oferta virando envio, com subid
--
-- Era o único dos quatro conceitos do modelo que ainda não tinha
-- tabela: produto, anúncio e oferta existem desde 27/07, e
-- `publicacao` ficou para a Fase 2 porque é ela que gera link,
-- clique e comissão.
--
-- POR QUE ELA ENTRA AGORA, ANTES DA FASE 2
--
-- A tela de publicação rodava sobre `lib/simulacao/loja.ts`, em
-- memória. O dono decidiu em 31/07 tirar a simulação do painel —
-- "só quero ver o que for de verdade" — e sem esta tabela a tela
-- não teria de onde ler. É schema da Fase 2 antecipado, e só o
-- schema: nada de redirecionador, clique ou comissão aqui.
--
-- O SUBID É A RAZÃO DE EXISTIR DESTA TABELA
--
-- Regra 3.6: toda publicação gera um subid único, curto e
-- alfanumérico, gravado e indexado, nunca reaproveitado. É ele que
-- liga uma venda no relatório do marketplace ao canal que a
-- gerou — e sem essa ligação não existe divisão de receita com
-- parceiro, existe planilha e confiança, que é o que apodrece
-- sociedade.
--
-- Ele é `unique` no banco, e não só no código, porque subid
-- repetido não dá erro em lugar nenhum: ele silenciosamente atribui
-- a venda ao canal errado, e o parceiro descobre no extrato.
-- =============================================================

create table public.publicacao (
  id                    uuid primary key default gen_random_uuid(),
  operacao_id           uuid not null references public.operacao(id) on delete cascade,
  oferta_id             uuid not null references public.oferta(id) on delete cascade,
  canal_id              uuid not null references public.canal(id) on delete cascade,

  -- Curto porque vai dentro de uma URL que a pessoa vê, e porque
  -- alguns programas de afiliado truncam subid comprido — o teste
  -- da Fase 0 vai dizer o limite real de cada um.
  subid                 text not null,

  -- O preço no momento em que a oferta entrou na fila. Se o preço
  -- de agora for diferente na hora de publicar, a publicação é
  -- bloqueada e devolvida para a aprovação: publicar preço que
  -- mudou é a forma mais rápida de queimar o canal (regra 3.4).
  preco_na_fila_centavos integer not null,

  -- A mensagem montada no momento do envio, guardada como saiu.
  -- Não se remonta depois: o modelo muda, e a mensagem que foi ao
  -- grupo é a que precisa ser auditável, inclusive para provar a
  -- identificação publicitária da regra 3.10.
  mensagem              text,

  estado                text not null default 'pendente',

  -- `fluxo` é quem passou pelo botão; `auto_declarada` é quem disse
  -- "já enviei por fora". NUNCA somar os dois no mesmo contador: a
  -- origem auto-declarada é o único sinal de supervisão que existe
  -- sobre operador remoto, e somada ela deixa de ser sinal.
  origem                text not null default 'fluxo',

  enviada_em            timestamptz,
  enviada_por           uuid references public.usuario(id) on delete set null,
  cancelada_em          timestamptz,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  constraint publicacao_subid_unico unique (subid),
  constraint publicacao_estado_valido
    check (estado in ('pendente', 'enviada', 'cancelada', 'bloqueada')),
  constraint publicacao_origem_valida
    check (origem in ('fluxo', 'auto_declarada')),
  constraint publicacao_preco_positivo
    check (preco_na_fila_centavos > 0),
  -- Enviada sem data de envio seria publicação que ninguém sabe
  -- quando saiu, e é a data que sustenta a prestação de contas.
  constraint publicacao_enviada_tem_data
    check (estado <> 'enviada' or enviada_em is not null),
  -- A mesma oferta não vai duas vezes para o mesmo canal. Repetição
  -- é o que faz membro silenciar o grupo, e aqui ela seria por
  -- acidente do sistema, não por decisão de ninguém.
  constraint publicacao_oferta_canal_unico unique (oferta_id, canal_id)
);

comment on table public.publicacao is
  'Uma oferta enviada a um canal. O subid é único por linha e nunca se reaproveita (regra 3.6).';

-- O índice do subid já vem do `unique`. Estes dois servem às duas
-- perguntas que a tela faz o tempo todo: "o que falta publicar
-- hoje" e "quanto este canal já usou do teto".
create index publicacao_estado_idx on public.publicacao (operacao_id, estado);
create index publicacao_canal_dia_idx on public.publicacao (canal_id, enviada_em);

create trigger publicacao_atualizado_em
  before update on public.publicacao
  for each row execute function public.marca_atualizado_em();

-- -------------------------------------------------------------
-- Segurança — RLS desde a primeira linha, como toda tabela aqui
--
-- O operador precisa ver e mexer nas publicações do canal dele, e
-- só. O parceiro vê as do canal dele para conferir o extrato, mas
-- não escreve: publicar é ato do operador.
-- -------------------------------------------------------------
alter table public.publicacao enable row level security;

create policy publicacao_le on public.publicacao
  for select to authenticated
  using (
    operacao_id = public.operacao_atual()
    and (
      public.tem_papel('dono')
      or exists (
        select 1 from public.canal c
        where c.id = publicacao.canal_id
          and (c.operador_id = auth.uid() or c.parceiro_id = public.parceiro_atual())
      )
    )
  );

create policy publicacao_dono on public.publicacao
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

create policy publicacao_operador on public.publicacao
  for update to authenticated
  using (
    operacao_id = public.operacao_atual()
    and exists (
      select 1 from public.canal c
      where c.id = publicacao.canal_id and c.operador_id = auth.uid()
    )
  )
  with check (operacao_id = public.operacao_atual());

grant select, insert, update, delete on public.publicacao to service_role;

-- -------------------------------------------------------------
-- gera_subid — curto, alfanumérico e sem ambiguidade de leitura
--
-- Fora do alfabeto: 0, O, 1, I e l. Alguém vai ler um subid em voz
-- alta ou digitar à mão conferindo um extrato, e "0" contra "O" é
-- onde a conferência de dinheiro se perde.
--
-- Oito caracteres em 31 símbolos dão ~852 bilhões de combinações.
-- O `unique` da coluna é a rede de segurança real: em colisão, o
-- insert falha e o chamador tenta de novo, o que é infinitamente
-- melhor que atribuir a venda ao canal errado em silêncio.
-- -------------------------------------------------------------
create or replace function public.gera_subid()
returns text
language plpgsql
as $$
declare
  v_alfabeto constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_saida text := '';
  i integer;
begin
  for i in 1..8 loop
    v_saida := v_saida || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::integer, 1);
  end loop;
  return v_saida;
end;
$$;

comment on function public.gera_subid is
  'Subid de 8 caracteres, sem 0/O/1/I/l. A unicidade real é garantida pelo unique da coluna.';

alter table public.publicacao alter column subid set default public.gera_subid();

grant execute on function public.gera_subid() to service_role;
