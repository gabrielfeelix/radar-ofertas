-- =============================================================
-- O Tech para de receber jogo de tabuleiro, e o Hobbies vira brinquedo
-- =============================================================
--
-- (O número desta migration é a posição dela em `docs/migrations.md`.
-- Cite pelo carimbo `20260806190000`, não pelo número: em 04/08 dois
-- agentes numeraram em paralelo e "migration 64" virou três coisas.)
--
-- O QUE O DONO VIU, em 06/08: um "JOGO CADÊ? SONIC 54 CARTAS GGB
-- BRINQUEDOS" publicado no **Radar Tech**. Palavras dele: *"cada grupo
-- tem uma coisinha estranha subindo aqui e ali, precisamos calibrar"*.
--
-- São DOIS defeitos empilhados, e o primeiro sozinho não explicaria.
--
-- ---------------------------------------------------------------
-- 1. `SHOPEE-100739` é brinquedo, e estava em `games`
-- ---------------------------------------------------------------
--
-- A categoria é "Hobbies & Collections". Amostra aleatória do que mora
-- lá, colhida do catálogo de produção antes de mexer:
--
--   JOGO BANCO IMOBILIÁRIO MUNDO ESTRELA BRINQUEDO MESA TABULEIRO
--   Boneca Polly Pocket Básica FW19 Modelos Sortidos
--   Carrinho de Controle Remoto com 4 Funções Vermelho
--   JOGO IMAGEM E AÇÃO JÚNIOR LOUSA MÁGICA GROW
--   SUPER TRUNFO MARVEL GROW HOMEM ARANHA
--   Jogo Pescaria Infantil Clássico Fishing Game
--
-- É brinquedo, e brinquedo de criança. `games` no nosso modelo é
-- videogame — é o nicho do Radar Geek, com controle de PS5 e jogo de
-- console. Mapeado para `games`, tudo isso ia parar em canal de jogo.
--
-- **Fica em `brinquedo`, que é o Radar Kids.** Não é perfeito: os
-- sleeves de Pokémon e o Super Trunfo da Marvel têm cara de Geek. Mas a
-- categoria é uma só e a maioria dela é brinquedo infantil, e mandar
-- Polly Pocket para o canal de games é o erro maior dos dois.
--
-- ---------------------------------------------------------------
-- 2. O Radar Tech aceitava `games`, e é isso que fecha a explicação
-- ---------------------------------------------------------------
--
-- `games` estava ligado ao Radar Geek **e** ao Radar Tech. Por isso o
-- mesmo jogo de cartas saiu nos dois canais — conferido no banco: as
-- duas publicações existem, do mesmo anúncio.
--
-- Tech é eletrônico. O que é de videogame e pertence ao Tech já entra
-- por `eletronico`: controle, headset e monitor gamer são acessório de
-- computador e caem lá pelo domínio.
--
-- Isto NÃO tira volume do Tech: `eletronico` tem 3.787 anúncios contra
-- 496 de `games`, e o Tech é o canal que mais publica.

update public.nicho_dominio
   set nicho_id = (select id from public.nicho where slug = 'brinquedo')
 where dominio_externo = 'SHOPEE-100739';

-- Os anúncios que já entraram por essa categoria mudam de nicho junto,
-- senão o conserto só valeria para o que a coleta trouxer de amanhã em
-- diante, e o que está na fila hoje continuaria saindo errado.
update public.produto p
   set nicho_id = (select id from public.nicho where slug = 'brinquedo')
  from public.anuncio a
 where a.produto_id = p.id
   and a.dominio_externo = 'SHOPEE-100739';

-- E o Tech deixa de receber `games`.
delete from public.canal_nicho cn
 using public.canal c, public.nicho n
 where cn.canal_id = c.id
   and cn.nicho_id = n.id
   and c.nome = 'Radar Tech'
   and n.slug = 'games';
