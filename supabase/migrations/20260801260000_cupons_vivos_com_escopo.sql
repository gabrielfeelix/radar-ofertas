-- =============================================================
-- 35 · `cupons_vivos` volta a mostrar todas as colunas
--
-- A migration 34 acrescentou `cupom.geral`, e a view não enxergou.
--
-- O MOTIVO É UMA ARMADILHA DO POSTGRES QUE VALE ANOTAR: `cupons_vivos`
-- foi criada com `select c.*`, e o `*` **é expandido na criação da
-- view**, não a cada consulta. A lista de colunas ficou congelada em
-- 31/07, e coluna acrescentada depois simplesmente não aparece — sem
-- erro, sem aviso. O sintoma foi o post de cupom nunca achar nenhum
-- elegível, porque `geral` vinha indefinido para todos.
--
-- Recriar é o conserto, e a lição é a de sempre neste projeto: `*` em
-- objeto que vai durar economiza um minuto hoje e cobra depois.
-- Aqui as colunas estão nomeadas uma a uma, de propósito.
-- =============================================================

create or replace view public.cupons_vivos as
  select c.id,
         c.operacao_id,
         c.marketplace_id,
         c.nicho_id,
         c.codigo,
         c.descricao,
         c.tipo,
         c.valor,
         c.valor_minimo_centavos,
         c.teto_desconto_centavos,
         c.vigente_de,
         c.vigente_ate,
         c.esgotado_em,
         c.ativo,
         c.criado_em,
         c.atualizado_em,
         m.slug as marketplace_slug,
         m.nome as marketplace_nome,
         n.slug as nicho_slug,
         case
           when c.vigente_ate is null then null
           else extract(epoch from (c.vigente_ate - now())) / 3600
         end as horas_restantes,
         -- A coluna nova vai NO FIM, e não junto das irmãs dela.
         -- `create or replace view` aceita acrescentar coluna ao final,
         -- e recusa reordenar: pôr `geral` ao lado de `ativo` devolve
         -- "cannot change name of view column criado_em to geral".
         -- Trocar a ordem exigiria derrubar a view, e derrubar view que
         -- a tela consulta é risco maior que uma coluna fora de lugar.
         c.geral
  from public.cupom c
  join public.marketplace m on m.id = c.marketplace_id
  left join public.nicho n on n.id = c.nicho_id
  where c.ativo
    and c.esgotado_em is null
    and c.vigente_de <= now()
    and (c.vigente_ate is null or c.vigente_ate > now());

comment on view public.cupons_vivos is
  'Cupons que podem entrar numa mensagem AGORA. As três condições de "vivo" moram só aqui. Colunas nomeadas: `*` congela a lista na criação da view.';

grant select on public.cupons_vivos to authenticated, service_role;
