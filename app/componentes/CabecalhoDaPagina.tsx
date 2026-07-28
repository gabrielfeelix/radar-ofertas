/**
 * A moldura de uma tela: medida, cabeçalho e faixa de indicadores.
 *
 * A `Pagina` existe por um defeito que só aparece na captura de tela:
 * o cabeçalho e a faixa de indicadores iam até a borda da janela
 * enquanto o conteúdo parava numa medida menor, e a medida escolhida
 * variava de tela para tela — havia cinco larguras diferentes no mesmo
 * painel. Ninguém revisa isso lendo o código de uma tela só, porque
 * dentro de cada arquivo está tudo coerente.
 *
 * A correção não é combinar a largura: é tirar a escolha das telas. A
 * página declara **uma** medida, e cabeçalho, indicadores e conteúdo
 * ficam todos dentro dela por construção.
 */

const MEDIDA = {
  /** Formulário e leitura curta. Uma coluna. */
  estreita: "max-w-2xl",
  /** Texto longo e listas simples. */
  media: "max-w-4xl",
  /** O padrão: lista com colunas de número à direita. */
  larga: "max-w-6xl",
  /** Tabela densa que não cabe em medida nenhuma. */
  cheia: "max-w-none",
} as const;

export function Pagina({
  trilha,
  titulo,
  subtitulo,
  acoes,
  kpis,
  medida = "larga",
  children,
}: {
  trilha: string;
  titulo: string;
  subtitulo?: React.ReactNode;
  acoes?: React.ReactNode;
  kpis?: ItemDeKpi[];
  medida?: keyof typeof MEDIDA;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex w-full flex-col gap-5 px-6 pt-6 pb-10 ${MEDIDA[medida]}`}>
      <CabecalhoDaPagina trilha={trilha} titulo={titulo} subtitulo={subtitulo} acoes={acoes} />
      {kpis && kpis.length > 0 && <Kpis itens={kpis} />}
      {children}
    </div>
  );
}

/**
 * Cabeçalho de página — trilha, título, subtítulo e ações da tela.
 *
 * O subtítulo não é enfeite: em quase toda tela deste sistema ele
 * carrega a regra que a tela obedece ("o preço de referência é a
 * mediana da nossa série"), e é a única chance de explicá-la a quem
 * não leu documentação nenhuma.
 */
export function CabecalhoDaPagina({
  trilha,
  titulo,
  subtitulo,
  acoes,
}: {
  trilha: string;
  titulo: string;
  subtitulo?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-5">
      <div className="flex min-w-64 flex-1 flex-col gap-2">
        <p className="flex items-center gap-2 text-sm text-texto-fraco">
          <span>{trilha}</span>
          <span aria-hidden>/</span>
          <span className="font-semibold text-texto-medio">{titulo}</span>
        </p>
        <h1 className="text-2xl font-extrabold tracking-titulo">{titulo}</h1>
        {subtitulo && <div className="max-w-[70ch] text-base text-texto-fraco">{subtitulo}</div>}
      </div>

      {acoes && <div className="flex items-center gap-3">{acoes}</div>}
    </div>
  );
}

export type ItemDeKpi = { rotulo: string; valor: string; nota?: string; cor?: string };

/**
 * Faixa de indicadores.
 *
 * Duas correções contra a versão anterior, as duas vindas da comparação
 * com o protótipo:
 *
 * O número saiu do monoespaçado. Mono serve para **coluna que se
 * compara na vertical** — preço em cima de preço. Um número sozinho em
 * mono só parece despejo de terminal; o que ele precisa é de algarismo
 * de largura fixa, e isso é `tabular-nums`, que a fonte do texto já tem.
 *
 * E a caixa deixou de esticar. Com três indicadores numa tela larga,
 * cada um virava um retângulo de quase 500px com um número perdido no
 * meio — o que fazia a faixa pesar mais que o conteúdo abaixo dela.
 */
export function Kpis({ itens }: { itens: ItemDeKpi[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {itens.map((kpi) => (
        <div
          key={kpi.rotulo}
          className="flex min-w-40 flex-none flex-col gap-1 rounded-lg border border-borda bg-superficie px-4 py-3"
        >
          <p className="text-sm font-semibold text-texto-fraco">{kpi.rotulo}</p>
          <p className="text-2xl font-extrabold tabular-nums tracking-titulo">{kpi.valor}</p>
          {kpi.nota && (
            <p className={`text-xs font-semibold ${kpi.cor ?? "text-texto-fraco"}`}>{kpi.nota}</p>
          )}
        </div>
      ))}
    </div>
  );
}
