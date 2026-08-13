import { diaEmSaoPaulo } from "./ritmo.ts";

/**
 * O aquecimento do chip.
 *
 * Número novo não sai publicando no volume de operação. A D-053 mediu
 * conta caindo em 2 a 8 semanas, e o padrão que derruba é volume alto
 * em número sem história. A rampa é o que separa "chip novo" de "chip
 * queimado na primeira semana".
 *
 * ISTO VIVE NO CÓDIGO E NÃO NO BANCO, de propósito. Curva em parâmetro
 * seria um botão que ninguém audita: mudaria em produção sem commit,
 * sem teste e sem ninguém lembrar por quê seis meses depois. É
 * política, não configuração. Só a data de início é dado, e ela mora
 * em `bot.aquecimento_inicio`.
 *
 * **O que esta curva NÃO conta:** o que a pessoa manda do aparelho. Os
 * 10 do dia 1 são de promo. Se o número não tiver conversa humana
 * junto, os 10 são o dia inteiro do chip, e aí o padrão fica visível.
 * Isso é operação, não código, e está escrito na regra 3.2.
 */

/**
 * A curva, decidida pelo dono em 10/08/2026.
 *
 * Ela é em POSTS POR HORA: 5 até o dia 10, 10 até o dia 14, e do 15º em
 * diante vale o teto do chip.
 */
/*
  A CURVA FOI REESCRITA EM 11/08, A PEDIDO DIRETO DO DONO.

  A anterior era 10, 15, 20, 25 e depois 30 até o dia 14, e ela nasceu
  da pesquisa da D-053. O dono a derrubou olhando o canal parado às
  14h29 de 11/08, com o chip no dia 2 e os 15 posts do dia gastos desde
  as 12h21:

    *"quero pelo menos 3 promoções por hora... 72 por dia nos 5
    primeiros dias, depois aumenta o ritmo pra 5 posts por hora, dps
    10, até entrar no ritmo normal"*

  E ele sabe o que está trocando: *"bem mais que o que eu pedi de 10 a
  15 por dia, mas sou EU que estou pedindo"*. É a mesma decisão da
  D-071, em que ele assumiu o custo do chip: *"n ligo de derrubar conta
  do numero, vou ir comprando varios"*.

  A CURVA AGORA É EM POSTS POR HORA, e não em total do dia, porque foi
  assim que ele pediu e porque é o que o intervalo consome. O total do
  dia sai da multiplicação pelas horas que o canal tem janela.

  O QUE NÃO MUDA, e é o que separa isto de disparo em massa: continua
  havendo rampa, o `bot.envios_dia_max` continua sendo teto duro por
  cima de tudo, e o `horarios_permitidos` continua sendo quem impede o
  grupo de tocar de madrugada.
*/
/*
  O PRIMEIRO DEGRAU SUBIU DE 3 PARA 5 EM 13/08, A PEDIDO DIRETO DO DONO:

    *"quero que mude outra regra: tá pra 3 anúncios por hora, quero 5
    por hora agora, pra aquecer mais o número"*

  O chip estava no dia 4 dos cinco de 3/h. O degrau de 5/h já existia
  logo abaixo, e o pedido é para antecipá-lo — não para inventar um
  ritmo novo: o que era dia 6 vira dia 1, e a curva daqui para a frente
  é a mesma que já estava escrita.

  E os dois primeiros degraus viram UM SÓ, em vez de virarem dois com o
  mesmo valor. Um degrau de 5/h até o dia 5 seguido de outro de 5/h até
  o dia 10 seria uma linha que não muda nada e que o próximo leitor
  precisaria conferir para descobrir isso.

  O QUE NÃO MUDA: continua havendo rampa (5 até o dia 10, 10 até o 14,
  teto cheio depois), o `bot.envios_dia_max` continua sendo teto duro,
  e o `horarios_permitidos` continua fechando a madrugada. No Radar
  Delas, cuja janela é das 9h às 21h, 5/h dão ~65 posts no dia contra os
  72 do `posts_por_dia_max` — o teto do canal não passa a ser o freio.
*/
const RAMPA_POR_HORA: Array<{ ateODia: number; porHora: number }> = [
  { ateODia: 10, porHora: 5 },
  { ateODia: 14, porHora: 10 },
];

/** Do dia 15 em diante vale o teto do chip, sem curva. */
const DIA_DA_OPERACAO = 15;

/**
 * Quantos posts por hora este dia do aquecimento permite.
 *
 * É daqui que sai o intervalo entre um post e o seguinte
 * (`lib/ritmo.ts`), e é o número que o dono pediu em 11/08.
 */
export function porHoraDoDia(dia: number): number {
  if (dia < 1) return 0;
  for (const degrau of RAMPA_POR_HORA) {
    if (dia <= degrau.ateODia) return degrau.porHora;
  }
  return RAMPA_POR_HORA[RAMPA_POR_HORA.length - 1].porHora;
}

/** Milissegundos num dia. */
const UM_DIA = 86_400_000;

/**
 * Em que dia do aquecimento este chip está.
 *
 * O dia de início é o dia 1, e não o dia 0: "primeiro dia" é o dia em
 * que se começa, que é como a pessoa que cadastrou vai contar.
 *
 * A conta é feita entre datas de São Paulo (regra 3.9), e não entre
 * instantes: por UTC, a virada aconteceria às 21h, e o chip ganharia
 * um degrau da rampa três horas antes da hora.
 *
 * O deslocamento fixo de `-03:00` vale porque o Brasil não tem horário
 * de verão desde 2019. É a mesma premissa de `inicioDoDiaEmSaoPaulo`,
 * e se ele voltar, as duas linhas mudam juntas.
 */
export function diaDoAquecimento(inicio: string, agora: Date): number {
  const hoje = diaEmSaoPaulo(agora);
  const decorrido =
    Date.parse(`${hoje}T00:00:00-03:00`) - Date.parse(`${inicio}T00:00:00-03:00`);

  return Math.floor(decorrido / UM_DIA) + 1;
}

/**
 * Quantas promos este chip pode mandar hoje.
 *
 * `tetoCheio` é o `bot.envios_dia_max`, e ele é o limite superior em
 * qualquer dia: um chip cadastrado com teto de 12 não manda 30 no dia 5
 * só porque a curva diz 30.
 *
 * Dia menor que 1 devolve zero. Isso só acontece com data de início no
 * futuro, que é erro de digitação no cadastro — e zero é o que impede
 * o erro de virar disparo.
 */
export function tetoDoDia(dia: number, tetoCheio: number, horasDeJanela: number = 24): number {
  if (dia < 1) return 0;
  if (dia >= DIA_DA_OPERACAO) return tetoCheio;

  /*
    O TETO DO DIA SAI DA TAXA POR HORA, e a janela é o multiplicador.

    24 horas é o padrão porque foi a conta que o dono fez ao pedir
    ("3 por hora x 24 vai dar 72"). Quem sabe a janela real do canal
    passa `horasDeJanela` e recebe o teto que aquele canal consegue
    cumprir sem tocar fora do horário permitido.
  */
  const daCurva = porHoraDoDia(dia) * horasDeJanela;
  return Math.min(daCurva, tetoCheio);
}
