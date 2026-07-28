/**
 * Cabeçalho de página — a faixa entre a barra superior e o conteúdo.
 *
 * Trilha, título, subtítulo e ações da tela, como no protótipo. O
 * subtítulo não é enfeite: em quase toda tela deste sistema ele
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
    <div className="flex flex-wrap items-end gap-5 px-6 pt-6 pb-2">
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

/** Faixa de indicadores logo abaixo do cabeçalho. */
export function Kpis({
  itens,
}: {
  itens: Array<{ rotulo: string; valor: string; nota?: string; cor?: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-4 px-6 pt-4">
      {itens.map((kpi) => (
        <div
          key={kpi.rotulo}
          className="flex min-w-40 flex-1 flex-col gap-2 rounded-lg border border-borda bg-superficie px-5 py-4"
        >
          <p className="text-sm font-semibold text-texto-fraco">{kpi.rotulo}</p>
          <p className="font-mono text-2xl font-extrabold tabular-nums tracking-titulo">
            {kpi.valor}
          </p>
          {kpi.nota && (
            <p className={`text-xs font-semibold ${kpi.cor ?? "text-texto-fraco"}`}>{kpi.nota}</p>
          )}
        </div>
      ))}
    </div>
  );
}
