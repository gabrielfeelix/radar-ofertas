-- =============================================================
-- 65 · Cada canal ganha a própria voz no gancho
--
-- A migration 64 ligou a IA na primeira linha do post e deixou a voz
-- cadastrada **só no Radar Delas**, de propósito: era o canal do pedido.
-- Os outros oito continuaram sem gancho, porque `instrucao_gancho` nula
-- é como se escolhe onde ele vale.
--
-- Duas coisas mudaram em 11/08, depois de ler os dois primeiros ganchos
-- que foram ao ar:
--
--     CHEGA DE SOFRER COM SECADOR FRAQUINHO 💨
--     AQUELE QUE SÓ SAI COM REZA BRAVA 💄
--
-- O `CHEGA DE` é o carimbo que a própria 64 já tinha medido (quatro em
-- seis), e a caixa alta em toda linha era instrução nossa. O registro foi
-- refeito em `lib/gancho.ts`: minúscula por padrão, maiúscula só no soco,
-- e seis modos sorteados entre os posts. **O conserto do carimbo não é
-- escrever mais engraçado, é variar o tipo de frase.**
--
-- Com o registro consertado, ligar os outros canais deixou de ser risco.
--
-- O QUE ENTRA AQUI
--
--   1. `{gancho}` entra no corpo GLOBAL, acima do produto e abaixo do
--      `#publi`. Vazio ele some junto com a quebra, como a nota e o
--      frete já fazem, então canal sem voz não fica com buraco no topo.
--   2. Um `modelo_mensagem` por canal, com a voz de quem lê aquele
--      grupo. As personas saíram de `docs/personas-dos-canais.md`, que é
--      auditoria feita com 1.000 publicações reais, não invenção.
--   3. A voz do Delas é reescrita no mesmo padrão das outras.
--
-- A VOZ DESCREVE QUEM LÊ, NUNCA O TEXTO PRONTO. O que sai de "homem de
-- trinta que sabe quanto custa um SSD" é diferente do que sai de "escreva
-- engraçado", e a segunda forma é a que produz piada genérica. Quem
-- escreve a linha é a IA; quem escolhe o registro é `INSTRUCAO_BASE`;
-- esta coluna só diz com quem ela está falando.
--
-- O PREÇO DISTO, dito antes que alguém descubra sozinho: cada canal passa
-- a ter cópia própria do corpo, e mudar o corpo global deixa de alcançar
-- os nove. As cópias nascem idênticas ao global (é um `select` dele,
-- logo abaixo), então a divergência só existe a partir da primeira edição
-- em `/ajustes/modelos`. Foi aceito porque a alternativa era guardar a
-- voz fora de `modelo_mensagem`, que é onde a voz de canal já mora.
-- =============================================================


-- -------------------------------------------------------------
-- 1. O corpo global aprende a receber o gancho
--
-- Feito ANTES da cópia, de propósito: as cópias por canal saem deste
-- corpo já corrigido, e não de um que precisaria ser consertado nove
-- vezes.
-- -------------------------------------------------------------
update public.modelo_mensagem
   set corpo = replace(corpo, '#publi · {loja}', '#publi · {loja}' || E'\n\n{gancho}'),
       atualizado_em = now()
 where canal_id is null
   and ativo
   and corpo like '#publi · {loja}%'
   and corpo not like '%{gancho}%';


-- -------------------------------------------------------------
-- 2. A voz de cada canal
--
-- O Delas é `update` porque já tem modelo próprio desde a 64; os outros
-- são `insert`, copiando o global inteiro e trocando só a voz.
-- -------------------------------------------------------------

update public.modelo_mensagem
   set instrucao_gancho =
         'Quem lê são mulheres adultas, brasileiras, num grupo de WhatsApp sobre beleza, autocuidado, cabelo, perfume e casa. Ticket entre trinta e cento e cinquenta reais. O tom é o de uma amiga que achou a coisa e veio contar, não o de quem está vendendo: espontânea, direta, com humor do cotidiano quando cabe. Nada de linguagem de loja e nada de comentário sobre o corpo de quem lê.',
       atualizado_em = now()
 where canal_id = (select id from public.canal where nome = 'Radar Delas')
   and ativo;

insert into public.modelo_mensagem (
  operacao_id, nome, canal_id, corpo,
  lastro_com, lastro_sem, lastro_queda, lastro_declarado,
  linha_frete, linha_cupom, nota_prefixo, corpo_cupom,
  instrucao_gancho, ativo
)
select
  g.operacao_id, c.nome, c.id, g.corpo,
  g.lastro_com, g.lastro_sem, g.lastro_queda, g.lastro_declarado,
  g.linha_frete, g.linha_cupom, g.nota_prefixo, g.corpo_cupom,
  v.voz, true
from public.modelo_mensagem g
join public.canal c
  on c.operacao_id = g.operacao_id
join (values

  ('Radar Beauty',
   'Quem lê são mulheres de vinte e poucos a trinta e poucos, brasileiras, que compram skincare, maquiagem e produto de cabelo. Conhecem as marcas nacionais e compram influenciadas por antes e depois, não por ficha técnica. Ticket entre trinta e cento e cinquenta reais. O tom é o de uma amiga contando o que testou, com humor leve do cotidiano. Muitas não sabem para que serve o ativo do rótulo, então fale do resultado na vida real e nunca do nome do ingrediente. Nada de comentário sobre o corpo de quem lê.'),

  ('Radar Casa',
   'Quem lê são adultos brasileiros que cuidam da própria casa, boa parte em apartamento pequeno, com pouco armário e pouca bancada. Compram organização, cozinha, cama, mesa e banho. O que resolve para eles é espaço, bagunça e tarefa chata que some. O tom é de alguém que mora igual e achou uma solução, sem entusiasmo de propaganda. O humor, quando aparece, é sobre a bagunça e nunca sobre quem faz a bagunça.'),

  ('Radar Pet',
   'Quem lê tem cachorro pequeno ou gato dentro de apartamento, e trata o bicho como parte da casa. Compra ração, areia, petisco, antipulgas e brinquedo, e ração é a compra mensal que ancora tudo. Ticket entre quarenta e cento e oitenta reais. O tom é de quem tem bicho e entende a rotina: o pelo no sofá, a areia espalhada, o brinquedo que dura uma tarde. Humor sobre a bagunça que o bicho faz é bem-vindo; deboche do bicho ou do dono, não. Em medicamento, nada de tom de brincadeira.'),

  ('Radar Kids',
   'Quem lê são mães brasileiras de filho pequeno, de bebê a idade escolar, comprando online por falta de tempo e não por falta de dinheiro. Ticket entre quarenta e cento e cinquenta reais. O que decide a compra delas é o que serve e o que evita briga de manhã. O tom é de outra mãe cansada falando com honestidade, com humor sobre a rotina e nunca sobre a criança nem sobre a mãe. Nada de fofura exagerada e nada de tom de manual de maternidade.'),

  ('Radar Tech',
   'Quem lê são homens de vinte e poucos a trinta e poucos que trabalham com computador ou montaram home office. Compram fone, carregador, SSD, monitor, cadeira, suporte, roteador. Eles sabem de cor quanto custam essas coisas, então promessa vaga não convence: convence reconhecer o problema real, o cabo que dura um mês, a mesa cheia de fio, o espaço que acabou. O tom é seco e direto, com ironia de quem entende do assunto. Nada de entusiasmo de propaganda e nada de explicar o óbvio para quem já sabe.'),

  ('Radar Geek',
   'Quem lê é público geek adulto: joga console, coleciona Funko, joga card game com os amigos, monta Lego. O gatilho dele é reconhecimento, não necessidade, e ele sabe quando a coisa é boa antes de ler o preço. O tom é de alguém de dentro, que fala da coleção, da estante, da sexta à noite e do jogo parado no meio. Referência só quando o título garantir, nunca inventada. Nada de tom de tio explicando o que é geek.'),

  ('Radar Fitness',
   'Quem lê treina com constância: academia durante a semana, corrida no fim de semana. Compram whey, creatina, pré-treino, legging, top, tênis, garrafa, acessório de treino. Eles calculam sozinhos e desconfiam de promessa, então nada de milagre e nada de resultado prometido. O tom é de parceiro de treino, direto e sem discurso motivacional. Humor sobre a rotina do treino cabe; comentário sobre corpo, peso, barriga ou dieta de quem lê, nunca.'),

  ('Radar Perfumes (masc)',
   'Quem lê são homens brasileiros de trinta e poucos que têm dois perfumes e querem um terceiro. Não conhecem nota olfativa nem vocabulário de perfumaria: sabem que o do amigo dura o dia todo e que preço estranho costuma ser falsificação. O tom é de indicação entre amigos, curta e sem floreio. Fale de ocasião, de fixação e de impressão que o cheiro deixa, sempre em linguagem comum. Nada de linguagem de revista de luxo e nada de sedução caricata.')

) as v(canal, voz)
  on v.canal = c.nome
where g.canal_id is null
  and g.ativo
  and not exists (
    select 1 from public.modelo_mensagem m where m.canal_id = c.id
  );
