-- -------------------------------------------------------------
-- A LINHA DE LASTRO DEIXA DE DIZER DATA E PASSA A DIZER TEMPO
--
-- Decisão do dono em 15/08: *"não precisa colocar exatamente desde o
-- dia dois, desde o dia um"*. Ele tem razão, e o motivo é de leitor:
-- "menor preço que observamos desde 02/08" obriga quem lê a fazer a
-- conta de quantos dias são, no meio de um post de promoção.
--
-- AS FAIXAS VIVEM EM `lib/lastro.ts`, e não aqui, porque são REGRA. O
-- que mora nesta tabela é o TEXTO de cada faixa, que é do dono e ele
-- troca pelo painel sem migration.
--
-- TRINTA DIAS PARA AFIRMAR HISTÓRICO, e isso é mais duro que os 14 da
-- regra 3.4. Também é decisão do dono, e fica: em afirmação de preço,
-- mais conservador nunca é o erro caro.
--
-- MEDIDO NO DIA EM QUE ISTO FOI ESCRITO, e vale registrar para ninguém
-- achar que quebrou: das 1.000 ofertas mais recentes, NENHUMA tinha 30
-- dias de série. A coleta começou em agosto. 30% tinham 1 dia, 56%
-- tinham de 2 a 6, e 12% tinham de 7 a 13. O selo de histórico é
-- verdadeiro e raro de propósito, e passa a aparecer quando a série
-- amadurecer sozinha.
-- -------------------------------------------------------------

alter table public.modelo_mensagem
  add column if not exists lastro_mes    text not null default '🔥 <b>Menor preço do último mês</b>',
  add column if not exists lastro_semana text not null default '📉 <b>Menor preço da semana</b>',
  add column if not exists lastro_hoje   text not null default '⚡ <b>Baixou de novo hoje</b>';

comment on column public.modelo_mensagem.lastro_mes is
  'Série de 14 a 29 dias. Não afirma mínimo histórico (regra 3.4).';
comment on column public.modelo_mensagem.lastro_semana is
  'Série de 7 a 13 dias.';
comment on column public.modelo_mensagem.lastro_hoje is
  'O preço caiu de novo no mesmo dia. Só passa a existir com releitura intradiária, que ainda não temos.';

-- O texto do Radar Delas (WhatsApp). Só ele muda agora: o formato novo
-- roda uma semana num canal antes de ir para os outros oito.
update public.modelo_mensagem
   set lastro_com   = '🔥 <b>Menor valor histórico!</b>',
       lastro_sem   = '📉 <b>Menor preço em dias</b>',
       lastro_queda = '⚡ <b>Baixou {queda}% desde ontem</b>'
 where canal_id = '1b22b636-b723-4592-95fd-a87053b7dcc6';
