/**
 * Qual linha de lastro a série de preços sustenta.
 *
 * A REGRA 3.4 MORA AQUI. "Menor valor histórico" só sai com 30 dias de
 * série, e trinta é decisão do dono em 15/08, mais conservadora que os
 * 14 dias que a regra exige. Abaixo disso a linha fala de tempo
 * decorrido e nunca de data: o dono pediu isso com todas as letras
 * (*"não precisa colocar exatamente desde o dia dois"*), e ele tem
 * razão, porque "desde 02/08" não diz nada a quem lê o grupo.
 *
 * A QUEDA VENCE TODAS, e não é preferência estética: ela é a única
 * coisa que NÓS medimos, entre duas leituras nossas. Nenhum canal que
 * repassa oferta alheia consegue dizer isso, e é o que separa este
 * projeto de um repassador.
 *
 * MEDIDO EM 15/08, e vale saber antes de esperar o selo aparecer no
 * grupo: das 1.000 ofertas mais recentes, **nenhuma tinha 30 dias de
 * série**, porque a coleta começou em agosto. 30% tinham 1 dia, 56%
 * tinham de 2 a 6, e 12% tinham de 7 a 13. O selo de histórico é
 * verdadeiro e raro de propósito, e passa a existir quando a série
 * amadurecer sozinha.
 */
export type FaixaDeLastro =
  | "historico"
  | "mes"
  | "semana"
  | "dias"
  | "ontem"
  | "hoje"
  | "queda"
  | "nenhuma";

export function faixaDoLastro(
  dias: number | null | undefined,
  quedaPct: number | null | undefined,
): FaixaDeLastro {
  if (quedaPct !== null && quedaPct !== undefined && quedaPct > 0) return "queda";
  if (dias === null || dias === undefined || dias < 0) return "nenhuma";
  if (dias >= 30) return "historico";
  if (dias >= 14) return "mes";
  if (dias >= 7) return "semana";
  if (dias >= 2) return "dias";
  if (dias >= 1) return "ontem";
  return "hoje";
}
