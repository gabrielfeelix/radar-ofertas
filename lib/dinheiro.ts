/**
 * Dinheiro no projeto é SEMPRE inteiro de centavos (D-005).
 *
 * O motivo é chato mas real: 0.1 + 0.2 em ponto flutuante dá
 * 0.30000000000000004. Esse erro se acumula e aparece justamente
 * no cálculo de repasse ao parceiro, que é onde a confiança está
 * em jogo. Centavo inteiro não erra nunca.
 *
 * Regra prática: reais só existem na tela. Em qualquer outro
 * lugar — banco, cálculo, API — é centavo inteiro.
 */

/** Erro de conversão de valor monetário, para tratar sem `catch` cego. */
export class ValorInvalidoError extends Error {
  constructor(entrada: string) {
    super(`Não consegui ler "${entrada}" como um valor em reais.`);
    this.name = "ValorInvalidoError";
  }
}

/**
 * Converte texto digitado ou raspado para centavos.
 *
 * Aceita as formas que aparecem de verdade nos marketplaces
 * brasileiros: "R$ 1.234,56", "1234,56", "1.234", "1234.56".
 *
 * A ambiguidade real é "1.234": ponto de milhar ou decimal?
 * Aqui vale a convenção brasileira — ponto separa milhar. Um
 * ponto seguido de exatamente 2 dígitos e sem vírgula na string
 * é tratado como decimal, que é o formato que a maioria das
 * APIs devolve.
 */
export function paraCentavos(entrada: string | number): number {
  if (typeof entrada === "number") {
    if (!Number.isFinite(entrada)) throw new ValorInvalidoError(String(entrada));
    return Math.round(entrada * 100);
  }

  const limpo = entrada.replace(/[R$\s ]/gi, "").trim();
  if (limpo === "") throw new ValorInvalidoError(entrada);

  let normalizado: string;

  if (limpo.includes(",")) {
    // Tem vírgula: ela é o decimal, pontos são milhar.
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{2}$/.test(limpo)) {
    // "1234.56" — formato de API, ponto decimal.
    normalizado = limpo;
  } else {
    // "1.234" ou "1234" — pontos são milhar.
    normalizado = limpo.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(normalizado)) throw new ValorInvalidoError(entrada);

  const reais = Number(normalizado);
  if (!Number.isFinite(reais)) throw new ValorInvalidoError(entrada);

  return Math.round(reais * 100);
}

/** Formata centavos para exibição. Só use na camada de tela. */
export function formataReais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/**
 * Desconto percentual entre dois preços em centavos.
 * Retorna número positivo quando o atual está mais barato.
 */
export function descontoPct(referenciaCentavos: number, atualCentavos: number): number {
  if (referenciaCentavos <= 0) return 0;
  return ((referenciaCentavos - atualCentavos) / referenciaCentavos) * 100;
}
