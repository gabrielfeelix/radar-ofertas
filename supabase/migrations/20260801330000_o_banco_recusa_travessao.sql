-- =============================================================
-- 42 · O banco passa a recusar travessão no que vai para o canal
--
-- POR QUE ISTO EXISTE, e o caso é o meu próprio erro de meia hora
-- atrás: a regra 3.11 do AGENTS proíbe travessão em texto publicado,
-- `lib/mensagem.ts` tem `temTravessao()` para detectá-lo, e
-- `testes/mensagem.mjs` testa a função em nove casos.
--
-- E ainda assim as migrations 39 e 40 gravaram dois lastros COM
-- travessão, e a 41 precisou desfazer.
--
-- O motivo de a proteção não ter pegado é o que interessa: a função é
-- chamada pela TELA, quando alguém digita o modelo. Migration escreve
-- direto na tabela e passa por fora. A regra existia em três lugares e
-- nenhum deles era o caminho que eu usei.
--
-- Constraint no banco fecha os três caminhos de uma vez: tela,
-- migration e script. É o mesmo raciocínio da D-023 ao contrário —
-- o que é regra dura mora onde ninguém consegue contornar sem ver.
--
-- VALE SÓ PARA O QUE O PÚBLICO LÊ. Comentário, `descricao` e
-- documentação seguem com travessão à vontade, e é por isso que a
-- constraint nomeia as colunas em vez de varrer a tabela.
-- =============================================================

alter table public.modelo_mensagem
  drop constraint if exists modelo_mensagem_sem_travessao;

alter table public.modelo_mensagem
  add constraint modelo_mensagem_sem_travessao check (
    coalesce(corpo,            '') !~ '[—–]' and
    coalesce(corpo_cupom,      '') !~ '[—–]' and
    coalesce(lastro_com,       '') !~ '[—–]' and
    coalesce(lastro_sem,       '') !~ '[—–]' and
    coalesce(lastro_queda,     '') !~ '[—–]' and
    coalesce(lastro_declarado, '') !~ '[—–]' and
    coalesce(nota_prefixo,     '') !~ '[—–]' and
    coalesce(linha_frete,      '') !~ '[—–]'
  );

comment on constraint modelo_mensagem_sem_travessao on public.modelo_mensagem is
  'Regra 3.11: travessão tem cara de texto de IA, e canal de oferta vive de parecer gente. Vale só para as colunas que o público lê.';


-- A nota do curador também vai para a mensagem, escrita à mão no
-- produto. Mesmo motivo, mesma regra.
alter table public.produto
  drop constraint if exists produto_nota_sem_travessao;

alter table public.produto
  add constraint produto_nota_sem_travessao check (
    coalesce(nota_curador, '') !~ '[—–]'
  )
  -- `not valid` aqui é deliberado e é o oposto do caso da D-040: não
  -- quero que a migration falhe por causa de uma nota antiga que
  -- alguém digitou com travessão antes da regra existir. O que importa
  -- é que nenhuma nota NOVA passe, e constraint `not valid` vale para
  -- todo INSERT e UPDATE — ela só não revalida o que já está lá.
  not valid;

comment on constraint produto_nota_sem_travessao on public.produto is
  'Regra 3.11 na nota do curador, que vai junto na mensagem. `not valid`: vale para nota nova, não revalida as antigas.';
