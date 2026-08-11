-- =============================================================
-- 63 · O WhatsApp ganha card de link no lugar da foto anexada
--
-- O QUE O DONO VIU, comparando o nosso grupo com os concorrentes em
-- 10/08: *"percebi que carrega imagem quando é whatsapp, ne? mas a
-- maioria coloca a config de nao carregar img p n lotar a galeria
-- delas"*.
--
-- Ele está certo, e o mecanismo é este: `sendMedia` é mensagem de MÍDIA.
-- O WhatsApp baixa sozinho e, no Android, o arquivo aparece na galeria
-- junto das fotos de família. A trinta posts por dia dá da ordem de
-- 90 MB por mês no celular de quem lê. `docs/pesquisa/sintese.md` §5
-- mede que volume é o motivo número um de alguém sair de um canal;
-- encher a galeria é primo disso.
--
-- O que os concorrentes fazem, e o print mostra, é mandar TEXTO e deixar
-- o WhatsApp montar o card a partir do link. O card tem foto, mas não é
-- mídia: não baixa, não ocupa, não polui.
--
-- POR QUE ISTO É HÍBRIDO E NÃO UM SIM PARA TODOS
--
-- O card vem das meta tags `og:` do destino, e as três lojas respondem
-- diferente. Medido em 10/08, seguindo os NOSSOS links até o fim:
--
--   Mercado Livre  meli.la           →  og:image com a foto e og:title
--                                       com o nome do produto. Completo.
--   Shopee         s.shopee.com.br   →  sem og: nenhum.
--   Amazon         amazon.com.br/dp  →  1 MB de HTML, sem og:image.
--
-- Ligar para as três calaria a foto de duas, e a Shopee é a maior parte
-- da fila do Radar Delas: seria trocar galeria cheia por post sem
-- imagem, que converte pior. Então só o Mercado Livre muda agora.
--
-- A LISTA MORRE NA FASE 2. Com o redirecionador próprio, o `og:` passa a
-- ser nosso em qualquer loja e o card vale para todas: é o que o
-- concorrente do print já faz, com `amzn.divulgador.link`. A observação
-- do dono acrescentou um segundo motivo para aquele redirecionador
-- existir, além do subid.
--
-- POR QUE O PARÂMETRO EXISTE
--
-- Quem monta o card é o Baileys, dentro da Evolution, na VPS. Isso não
-- tem como ser conferido da máquina de desenvolvimento: só o chip de
-- verdade responde. Se o card não aparecer, ou aparecer sem foto, o
-- conserto tem que ser de um clique e não de um deploy, porque o canal
-- estaria publicando sem imagem enquanto isso. Zerar aqui devolve o
-- `sendMedia` para todo mundo na rodada seguinte.
-- =============================================================

insert into public.parametro (operacao_id, chave, valor, descricao)
select o.id, v.chave, v.valor, v.descricao from public.operacao o,
(values
  ('whatsapp_link_preview', 1,
   'No WhatsApp, manda TEXTO com card de link em vez de foto anexada, nas lojas cujo link já traz og:image (hoje só o Mercado Livre, ver lib/texto-whatsapp.ts). 1 liga, 0 devolve o sendMedia para todos. Existe para desligar sem publicar versão: quem monta o card é o Baileys na VPS, e isso só se confere no chip real.')
) as v(chave, valor, descricao)
where not exists (
  select 1 from public.parametro p
  where p.operacao_id = o.id and p.chave = v.chave and p.nicho_id is null
);
