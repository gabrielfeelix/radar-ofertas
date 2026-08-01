-- =============================================================
-- 21 · A nota do curador — o que a máquina não sabe
--
-- Os canais que funcionam publicam uma linha de OPINIÃO junto da
-- oferta: "amadeirado clássico, ideal pra fumante de Malboro",
-- "cheiro de gin tônica, bastante efervescente". Isso não sai de
-- API nenhuma e nenhum modelo inventa com honestidade — é
-- conhecimento de quem entende do produto.
--
-- É também o que separa canal de repassador. Preço qualquer um
-- copia; "essa ração é a que os gatos castrados aceitam melhor"
-- é a razão de alguém continuar seguindo.
--
-- POR QUE FICA NO PRODUTO E NÃO NA PUBLICAÇÃO: escreve-se uma vez
-- e reusa-se para sempre. O mesmo perfume volta ao canal seis vezes
-- por ano; redigitar a nota a cada vez garante que ela some.
-- =============================================================

alter table public.produto
  add column nota_curador text;

comment on column public.produto.nota_curador is
  'Opinião de quem entende, escrita à mão e reusada em toda publicação deste produto. Nunca fala de preço — isso é do template.';

-- A nota entra na mensagem por uma variável própria, e o modelo
-- decide onde ela cai. Sem a variável no corpo, ela simplesmente não
-- aparece — quem não quiser opinião no canal não precisa mudar nada.
alter table public.modelo_mensagem
  add column nota_prefixo text not null default '💬';

comment on column public.modelo_mensagem.nota_prefixo is
  'O que abre a linha da nota do curador. Sai junto quando não há nota, para não deixar emoji órfão.';
