/**
 * A série de preço em miniatura, dentro da linha da fila.
 *
 * Existe porque a informação que **decide** a oferta não estava na
 * tela onde a decisão acontece. A linha dizia "34 dias de série" — um
 * número que diz que existe história, não que história é essa. Cair de
 * R$149 para R$89 depois de meses parado e cair depois de subir na
 * semana passada são a mesma linha hoje, e são decisões diferentes.
 *
 * Trinta pontos em 88px não servem para ler valor: servem para ler
 * **forma**. Quem quiser o valor abre o painel, onde o mesmo desenho
 * aparece grande, com a linha da mediana e os eixos.
 *
 * SVG à mão, sem biblioteca. São poucas linhas, e uma dependência de
 * gráfico entra pesada no limite de 3 MiB do Worker do plano gratuito
 * (D-016).
 */

export function Sparkline({
  serie,
  referencia,
  rotulo,
}: {
  serie: number[];
  /** A mediana. Vira a linha tracejada — é contra ela que o desconto é medido. */
  referencia?: number;
  rotulo: string;
}) {
  // Menos de dois pontos não é série, é um ponto. Desenhar uma reta
  // deixaria "sem história" com a mesma cara de "história estável".
  if (serie.length < 2) {
    return (
      <span className="text-xs text-texto-fraco" title="Série curta demais para desenhar">
        —
      </span>
    );
  }

  const L = 88;
  const A = 28;

  const valores = referencia != null ? [...serie, referencia] : serie;
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  // Série achatada — preço que não mexeu — dividiria por zero e sumiria
  // do desenho. Com faixa mínima de 1, ela vira uma linha no meio, que
  // é exatamente o que aconteceu com o preço.
  const faixa = Math.max(1, maior - menor);

  const x = (i: number) => (i / (serie.length - 1)) * L;
  const y = (valor: number) => A - 3 - ((valor - menor) / faixa) * (A - 6);

  const pontos = serie.map((valor, i) => `${x(i)},${y(valor)}`).join(" ");
  const ultimo = serie[serie.length - 1];

  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      className="h-7 w-22 overflow-visible"
      role="img"
      aria-label={rotulo}
    >
      {referencia != null && (
        <line
          x1="0"
          y1={y(referencia)}
          x2={L}
          y2={y(referencia)}
          stroke="var(--color-borda-forte)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}
      <polyline
        points={pontos}
        fill="none"
        stroke="var(--color-marca)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* O ponto de hoje. Sem ele, o olho não sabe de que lado a linha termina. */}
      <circle cx={L} cy={y(ultimo)} r="2.5" fill="var(--color-marca)" />
    </svg>
  );
}
