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
 * Os quatro primeiros dias sobem de cinco em cinco; do 5º ao 14º fica
 * em 30; do 15º em diante vale o teto do chip.
 */
const CURVA_INICIAL = [10, 15, 20, 25];
const PLATO = 30;
const DIA_DA_OPERACAO = 15;

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
export function tetoDoDia(dia: number, tetoCheio: number): number {
  if (dia < 1) return 0;
  if (dia >= DIA_DA_OPERACAO) return tetoCheio;

  const daCurva = dia <= CURVA_INICIAL.length ? CURVA_INICIAL[dia - 1] : PLATO;
  return Math.min(daCurva, tetoCheio);
}
