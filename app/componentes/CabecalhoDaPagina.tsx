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
  contexto,
  medida = "larga",
  children,
}: {
  trilha: string;
  titulo: string;
  subtitulo?: React.ReactNode;
  acoes?: React.ReactNode;
  kpis?: ItemDeKpi[];
  /**
   * A coluna da direita: o resumo do que está sendo decidido à
   * esquerda. Ela existe para telas em que a medida do conteúdo é
   * menor que a tela — sem ela, o que sobra à direita é sobra, e não
   * respiro. Fica colada no rolar, porque o número que ela mostra é
   * consultado no meio da lista, não no começo.
   */
  contexto?: React.ReactNode;
  medida?: keyof typeof MEDIDA;
  children: React.ReactNode;
}) {
  // Com coluna de contexto, a medida do conteúdo continua valendo — o
  // que muda é que ela passa a valer só para a coluna da esquerda, e a
  // página inteira ganha o espaço das duas.
  const larguraDaPagina = contexto && medida !== "cheia" ? MEDIDA.cheia : MEDIDA[medida];

  const cabecalho = (
    <>
      <CabecalhoDaPagina trilha={trilha} titulo={titulo} subtitulo={subtitulo} acoes={acoes} />
      {kpis && kpis.length > 0 && <Kpis itens={kpis} />}
    </>
  );

  return (
    // `mx-auto` centraliza o que sobra. Sem ele, a medida empurrava
    // tudo para a esquerda e o resto da tela virava um vazio de um
    // lado só — o que numa tela larga lê como página quebrada, não
    // como margem.
    <div className={`mx-auto flex w-full flex-col gap-5 px-6 pt-6 pb-10 ${larguraDaPagina}`}>
      {cabecalho}

      {contexto ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={`flex min-w-0 flex-col gap-5 ${MEDIDA[medida]}`}>{children}</div>
          <aside className="flex flex-col gap-4 lg:sticky lg:top-20">{contexto}</aside>
        </div>
      ) : (
        children
      )}
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
          className="flex min-w-44 flex-none flex-col gap-2 rounded-lg border border-borda-sutil bg-superficie px-5 py-4 shadow-repouso"
        >
          {/*
            O rótulo desce a sobrescrito — pequeno, em maiúsculas, com
            entreletra aberta — e o valor sobe para 32px. A ordem de
            leitura que se quer é valor primeiro, rótulo depois, e o
            que produz essa ordem é contraste de tamanho. Com rótulo e
            valor em pesos parecidos, o olho lia a caixa da esquerda
            para a direita, como texto, e o número virava só mais uma
            palavra.
          */}
          <p className="text-xs font-bold tracking-eyebrow text-texto-fraco uppercase">
            {kpi.rotulo}
          </p>
          {/*
            Sem dado, o traço não vira número grande.

            Três indicadores vazios mostravam três travessões de 32px,
            que é a forma mais chamativa possível de não dizer nada — e
            a explicação verdadeira ("o motor ainda não rodou") ficava
            de miúda embaixo. Quando não há valor, quem sobe é a
            explicação, e o traço fica do tamanho do que ele informa.
          */}
          {kpi.valor === "—" ? (
            <p className="text-md leading-padrao font-semibold text-texto-fraco">
              {kpi.nota ?? "sem dado ainda"}
            </p>
          ) : (
            <>
              <p className="text-3xl leading-titulo font-extrabold tabular-nums tracking-titulo">
                {kpi.valor}
              </p>
              {kpi.nota && (
                <p className={`text-sm font-semibold ${kpi.cor ?? "text-texto-fraco"}`}>
                  {kpi.nota}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
