-- =============================================================
-- 13 · Modelo de mensagem
--
-- A mensagem publicada era texto fixo no código. Trocar uma vírgula
-- exigia publicar versão nova do painel — e quem escreve a mensagem
-- é o dono, não quem edita TypeScript.
--
-- É Fase 2 no `docs/telas.md`, antecipada com autorização explícita
-- do dono em 28/07. Antecipar custa pouco: a tabela é pequena e não
-- toca em nada que já existe.
--
-- POR QUE UM MODELO E NÃO DOIS
--
-- A especificação pedia "as duas redações lado a lado, a completa e
-- a honesta reduzida, para que a diferença seja escolhida". Tratá-las
-- como duas OPÇÕES está errado, e o erro é de regra, não de gosto:
-- pela regra 3.4 do AGENTS.md, com menos de 14 dias de série a
-- redação honesta é OBRIGATÓRIA, não preferível. Duas caixas de
-- texto lado a lado convidam a escolher a que mente.
--
-- Então é um corpo só, e o que muda é o trecho do lastro: a coluna
-- `lastro_com` vale quando a série alcança o mínimo, `lastro_sem`
-- quando não alcança. A prévia mostra o MESMO modelo renderizado nos
-- dois estados — a pessoa vê o que as palavras dela viram quando o
-- histórico não existe, em vez de escolher entre dizer a verdade e
-- não dizer.
--
-- POR QUE `canal_id` É NULO NA MAIORIA DAS LINHAS
--
-- Um modelo global atende todos os canais. O específico existe para
-- o canal cujo tom é diferente — e ele é exceção, não regra. Nulo é
-- o global; preenchido sobrescreve, como já acontece com `parametro`
-- e nicho (D-023).
-- =============================================================

create table public.modelo_mensagem (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references public.operacao(id) on delete cascade,
  nome          text not null,
  -- Nulo = global. Preenchido = só deste canal.
  canal_id      uuid references public.canal(id) on delete cascade,
  -- O corpo, com as variáveis entre chaves: {produto}, {preco},
  -- {preco_antes}, {desconto}, {loja}, {vendedor}, {lastro}, {link}.
  corpo         text not null,
  -- O que {lastro} vira quando a série alcança o mínimo para afirmar.
  lastro_com    text not null default 'Menor preço em {janela} dias.',
  -- E quando não alcança. NUNCA pode afirmar mínimo histórico: é a
  -- regra 3.4, e a aplicação recusa salvar um texto que a viole.
  lastro_sem    text not null default 'Menor preço que observamos desde {desde}.',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.modelo_mensagem is
  'Como a mensagem publicada é escrita. Um corpo só; o que muda com a série é o trecho do lastro.';
comment on column public.modelo_mensagem.canal_id is
  'Nulo = modelo global. Preenchido = sobrescreve o global para aquele canal.';
comment on column public.modelo_mensagem.lastro_sem is
  'Redação usada abaixo do mínimo de série. Nunca pode afirmar mínimo histórico (regra 3.4).';

-- Um global por operação, e um por canal. Índice parcial porque nulo
-- não colide com nulo num índice único comum — sem isto, dois
-- modelos globais conviveriam e a escolha entre eles seria sorte.
create unique index modelo_mensagem_global_idx
  on public.modelo_mensagem (operacao_id)
  where canal_id is null;

create unique index modelo_mensagem_canal_idx
  on public.modelo_mensagem (canal_id)
  where canal_id is not null;

create trigger modelo_mensagem_atualizado_em
  before update on public.modelo_mensagem
  for each row execute function public.marca_atualizado_em();

alter table public.modelo_mensagem enable row level security;

-- Mesma forma das outras tabelas de configuração: quem está dentro da
-- operação lê, só o dono escreve.
create policy modelo_mensagem_le on public.modelo_mensagem
  for select to authenticated
  using (operacao_id = public.operacao_atual());

create policy modelo_mensagem_dono_escreve on public.modelo_mensagem
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

grant select, insert, update, delete on public.modelo_mensagem to service_role;
grant select on public.modelo_mensagem to authenticated;

-- O modelo global de partida: é o texto que estava fixo no código,
-- movido para cá sem mudança nenhuma. Assim a primeira publicação
-- depois desta migration sai idêntica à de antes.
insert into public.modelo_mensagem (operacao_id, nome, corpo)
select o.id,
       'Padrão',
       '🔥 {produto}' || chr(10) ||
       '' || chr(10) ||
       'De {preco_antes} por {preco} (−{desconto}%)' || chr(10) ||
       '{lastro}' || chr(10) ||
       '' || chr(10) ||
       '{loja} · {vendedor}' || chr(10) ||
       '👉 {link}'
  from public.operacao o;
