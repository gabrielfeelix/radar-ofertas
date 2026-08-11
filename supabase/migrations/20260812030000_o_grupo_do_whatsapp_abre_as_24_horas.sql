-- =============================================================
-- 74 · O grupo do WhatsApp abre as 24 horas
--
-- A migration 73 subiu o teto do Radar Delas para 72 por dia, e ele não
-- alcançava: `horarios_permitidos` tinha nove horas
-- (8,10,12,14,16,18,19,20,21), e 3 por hora em 9 horas são 27.
--
-- O dono foi direto quando eu levantei isso: *"q mané 9 o quê doido, é
-- UM GRUPO"*. A conta dele é 3 x 24 = 72, e para os 72 existirem a
-- janela tem que ser o dia inteiro.
--
-- FICA REGISTRADO O QUE ISSO CUSTA, porque é a segunda vez que a
-- madrugada aparece nesta base e das duas vezes o diagnóstico foi dele:
-- o G-01 de `docs/personas-dos-canais.md` diz que a reação a mensagem
-- de madrugada não é sair do grupo, é **silenciar** — e quem silencia
-- continua no contador de membros e nunca mais volta.
--
-- E no WhatsApp há um segundo custo, que o Telegram não tem: mensagem
-- automática às 3 da manhã é um dos padrões que a detecção olha, e o
-- chip está no dia 2 de aquecimento. A regra 3.2 diz que quando cai,
-- cai a conta do número.
--
-- **Nada disso é motivo para não fazer**: a D-071 já registra o dono
-- assumindo o custo do chip com todas as letras, e ele repetiu em
-- 11/08 pedindo o volume. Está aqui para quem ler depois saber que foi
-- escolha, e não descuido — e para ser o primeiro lugar a olhar se o
-- número cair.
-- =============================================================

update public.canal
   set horarios_permitidos = array[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
       atualizado_em = now()
 where nome = 'Radar Delas'
   and plataforma = 'whatsapp';
