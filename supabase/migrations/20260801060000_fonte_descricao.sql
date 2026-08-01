-- =============================================================
-- 20 · Descrição da fonte, e o que o rastreador achou
--
-- O catálogo de fontes deixou de ser digitado à mão: um rastreador
-- parte das fontes conhecidas, segue as menções entre canais e
-- sugere novos. Ele acha 24 canais legíveis a partir de 10 sementes,
-- e a maioria dos nomes não diz nada — `chinasuperofertas` é um
-- canal de eletrônicos, `arcodasofertas` é geral.
--
-- Sem a descrição, escolher qual cadastrar vira abrir 24 abas.
-- =============================================================

alter table public.fonte_descoberta
  add column descricao text,
  -- Quantos links de loja o rastreador viu na última página pública.
  -- É a ÚNICA métrica que importa para decidir se vale cadastrar:
  -- canal com 20 posts e zero links não rende nada — ele posta imagem
  -- ou usa encurtador que não resolve do servidor.
  add column links_vistos integer,
  add column descoberta_em timestamptz;

comment on column public.fonte_descoberta.descricao is
  'A descrição pública do canal. Serve para escolher entre dezenas de sugestões sem abrir cada uma.';
comment on column public.fonte_descoberta.links_vistos is
  'Links de loja na última leitura. Zero = canal que não rende, por mais posts que tenha.';
