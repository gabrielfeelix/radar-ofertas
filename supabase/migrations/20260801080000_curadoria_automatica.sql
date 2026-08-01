-- =============================================================
-- 22 · Curadoria automática e ritmo de publicação (D-033)
--
-- O dono encerrou a aprovação manual: "ninguém vai ficar na minha
-- equipe vasculhando sobre o vendedor". Aprovação a mão não sobrevive
-- a trinta ofertas por dia, e muito menos a sete canais.
--
-- O que substitui o olho humano são estes números. Todos vivem em
-- `parametro` e não em código, para calibrar sem publicar versão nova
-- (D-023) — é a diferença entre ajustar em trinta segundos e esperar
-- um deploy quando o canal está publicando lixo.
-- =============================================================

-- As comportas de confiança. As duas primeiras já existiam e estavam
-- sem valor; as duas últimas são novas.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'avaliacao_minima', 3.5,
       'Nota do produto na loja, de 0 a 5. Abaixo disso não entra: produto ruim queima o canal igual a preço falso.'
  from public.operacao
on conflict do nothing;

insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'reputacao_minima', 0.6,
       'Reputação do vendedor, de 0 a 1. Corta vermelho e laranja; do amarelo para cima passa.'
  from public.operacao
on conflict do nothing;

-- Nota alta com poucas avaliações é ruído, não sinal: 5,0 sobre duas
-- opiniões diz menos que 4,3 sobre duas mil.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'avaliacoes_minimas', 20,
       'Quantas avaliações o produto precisa ter para a nota valer. Loja oficial e vendedor platinum dispensam.'
  from public.operacao
on conflict do nothing;

-- Reputação verde com 16 vendas é novato sortudo, não histórico. Foi
-- um caso real da primeira coleta: nota 4,7 e 16 transações.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'vendas_minimas_vendedor', 100,
       'Transações do vendedor. Reputação boa com pouca venda é sorte, não histórico.'
  from public.operacao
on conflict do nothing;

-- Quanto a mais vale pagar para ficar com o vendedor melhor. O
-- coletor escolhia o MENOR PREÇO e ponto — o vendedor de nível
-- vermelho ganhava por dois reais de diferença.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'tolerancia_preco_vendedor_pct', 5,
       'Até quanto por cento a mais aceitar para publicar o anúncio do vendedor melhor, no mesmo produto.'
  from public.operacao
on conflict do nothing;


-- -------------------------------------------------------------
-- O ritmo — intervalo entre posts, não cota diária
--
-- Cota gasta tudo de manhã e deixa a tarde muda. Intervalo distribui
-- sozinho e sobrevive a um dia em que a detecção acha trinta ofertas
-- às 8h.
--
-- Os números vêm de duas fontes que discordavam, e a discordância é
-- real: a pesquisa de 28/07 fixou 5 a 8 por dia, e isso era sobre
-- WHATSAPP. Canal de Telegram não notifica como grupo, e a referência
-- de mercado para canal de nicho é 20 a 50 por dia. Aplicar o número
-- do WhatsApp ao Telegram desperdiça o canal; o contrário mata o grupo.
-- -------------------------------------------------------------
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'intervalo_pico_min', 10,
       'Minutos entre posts no Telegram durante os picos (07-09, 12-13, 19-22). É quando a pessoa está no celular.'
  from public.operacao
on conflict do nothing;

insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'intervalo_normal_min', 30,
       'Minutos entre posts no Telegram fora de pico. Mantém vivo sem cansar.'
  from public.operacao
on conflict do nothing;

insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'intervalo_madrugada_min', 90,
       'Minutos entre posts no Telegram entre 00h e 07h. Publica, mas devagar.'
  from public.operacao
on conflict do nothing;

-- Ligado À MÃO de propósito: sistema que decide sozinho que hoje é
-- Black Friday vai errar num dia comum, e errar aqui é despejar
-- quarenta posts numa terça.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'modo_intenso', 0,
       'Dia de pico (Black Friday, 8.8): 1 divide os intervalos por três. Liga e desliga à mão.'
  from public.operacao
on conflict do nothing;

-- O interruptor. Sem ele, o único jeito de parar uma publicação
-- automática errada seria mexer em código com o canal enchendo.
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'publicacao_automatica', 1,
       'Zero desliga a publicação automática no Telegram. É o freio de mão.'
  from public.operacao
on conflict do nothing;


comment on column public.anuncio.reputacao_vendedor is
  'De 0 a 1, derivada de level_id e power_seller_status do ML. Nulo = não medimos, e a comporta só reprova o que mediu.';
