/**
 * Cartão — a superfície elevada, uma só.
 *
 * O plano dizia que o cartão entraria "quando a primeira tela pedir",
 * para não congelar cedo demais o que uma oferta mostra. Cinco telas
 * pediram, e cada uma inventou o seu: mesma borda, mesmo raio, mesmo
 * fundo, escritos à mão em cinco lugares com padding diferente. O
 * resultado não é feio numa tela isolada — é feio ao trocar de tela,
 * que é onde ninguém revisa.
 *
 * `tom="apagado"` é para o que existe mas não participa: canal
 * desligado, loja desativada. Ele desce de plano em vez de sumir,
 * porque a tela precisa mostrar que a coisa está lá e está parada.
 */

const TOM = {
  /* Borda sutil **e** sombra de repouso: a borda sozinha desenhava um
     retângulo, a sombra sozinha some contra o fundo claro. Juntas, e
     ambas fracas, é o que faz o olho ler "objeto" em vez de "moldura". */
  normal: "border-borda-sutil bg-superficie shadow-repouso",
  /* O que existe e não participa — canal desligado, loja desativada —
     não flutua: fica no plano do fundo, com borda visível para não
     desaparecer. É a diferença entre "parado" e "ausente". */
  apagado: "border-borda bg-superficie-alt",
} as const;

const ESPACO = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export function Cartao({
  children,
  tom = "normal",
  espaco = "md",
  className = "",
  ...props
}: {
  tom?: keyof typeof TOM;
  espaco?: keyof typeof ESPACO;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-lg border ${TOM[tom]} ${ESPACO[espaco]} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Rótulo de seção dentro de um cartão.
 *
 * Maiúsculas pequenas com entreletra aberta, como no protótipo. Existe
 * como componente porque estava copiado com três tamanhos diferentes, e
 * é o elemento que mais aparece em tela de ajuste.
 */
export function RotuloDeSecao({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-eyebrow text-texto-fraco uppercase">{children}</p>
  );
}
