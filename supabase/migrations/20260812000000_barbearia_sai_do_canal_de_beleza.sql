-- =============================================================
-- 71 · Máquina de cortar pelo sai do canal de beleza
--
-- Pergunta do dono em 11/08, depois de ver o post: *"aparador, gilete,
-- etc não entram no grupo de BELEZA né amigão, ele pode até não ser
-- masculino, mas por que um aparador entra no grupo de beleza?"*
--
-- A migration 70 tinha fechado o caso pelo GÊNERO, e isso resolve só
-- metade: `GENDER` só pega quem declara, e em beleza a maioria dos
-- anúncios não declara nada. O `Aparador Cortador de Pelos Kemei
-- KM-6511` está no banco com `GENDER` ausente e passaria igual.
--
-- O CORTE CERTO É PELO QUE A COISA É. Máquina de barbear e de cortar
-- cabelo não é do canal de skincare, cabelo e maquiagem, com gênero
-- declarado ou sem.
--
-- POR QUE ELES ENTRAVAM, e não era defeito de ninguém: o Mercado Livre
-- classifica aparador em `Cuidados pessoais`, e o nosso nicho `beleza`
-- herda essa árvore. Pela taxonomia está certo; pelo grupo, não.
--
-- DEPILAÇÃO FICA, e a distinção é a persona. Depilador, epilador, cera,
-- pinça e a lâmina feminina são rotina de beleza de quem está no canal
-- — o `Aparelho Para Depilar Gillette Venus` que já saiu é post bom. A
-- linha é máquina de cortar cabelo e barba, não remoção de pelo.
--
-- Mecanismo: o mesmo `TIPO` da migration 66, com um segundo valor. A
-- regra viva está em `lib/eletronico-em-beleza.ts`.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Os dois canais de beleza passam a recusar também barbearia
-- -------------------------------------------------------------
update public.canal_atributo a
   set valores = array['eletronico', 'barbearia'],
       atualizado_em = now()
  from public.canal c
 where c.id = a.canal_id
   and a.atributo = 'TIPO'
   and c.nome in ('Radar Delas', 'Radar Delas (Telegram)')
   and not ('barbearia' = any (a.valores));


-- -------------------------------------------------------------
-- 2. O catálogo que já está no banco
--
-- Só beleza e perfume, pela mesma razão da 66: nenhum outro canal
-- exclui `TIPO`, então marcar o resto não mudaria nada hoje e faria
-- esta migration tocar dezenas de milhares de linhas à toa.
--
-- A lista repete `lib/eletronico-em-beleza.ts`. Se divergirem, a do
-- TypeScript é a que vale: lá é a regra viva, aqui é remendo de uma vez.
-- -------------------------------------------------------------
update public.produto p
   set atributos = coalesce(p.atributos, '{}'::jsonb) || '{"TIPO":"barbearia"}'::jsonb,
       atualizado_em = now()
  from public.nicho n
 where n.id = p.nicho_id
   and n.slug in ('beleza', 'perfume')
   and (p.atributos ->> 'TIPO') is null
   and lower(p.titulo_canonico) ~ '(aparador de pelo|aparador de barba|aparador cortador|aparador nasal|barbeador|maquina de barbear|maquina de cortar cabelo|maquina de corte|maquina de acabamento|cortador de cabelo|cortador de pelo|lamina de barbear|l[âa]mina de barbear|gilete|navalha|multigroomer|trimmer|barba e cabelo|pelos do nariz)';
