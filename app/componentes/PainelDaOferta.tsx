import Link from "next/link";

import { adiaOferta, aprovaOferta, rejeitaOferta } from "@/app/acoes/curadoria";
import { Botao } from "@/app/componentes/Botao";
import { EtiquetaDeLoja } from "@/app/componentes/EtiquetaDeLoja";
import { formataReais } from "@/lib/dinheiro";
import {
  COR_DA_LOJA,
  MOTIVOS_DE_REJEICAO,
  NOME_DA_LOJA,
  canaisElegiveis,
  nomeDoNicho,
  serieDePrecos,
  type OfertaSimulada,
} from "@/lib/simulacao/loja";

/**
 * Painel de detalhe da oferta — "esta aqui eu quero olhar".
 *
 * A decisão continua morando na linha, porque abrir um painel por
 * oferta custa cerca de 60 rolagens em 30 ofertas. Este painel é a
 * exceção: a oferta que faz o dono parar, olhar a série e escolher
 * canal por canal.
 *
 * É rota, não estado de componente: `?oferta=o3`. Isso dá três coisas
 * de graça — o painel sobrevive a recarregar a página, o botão voltar
 * do navegador fecha, e o endereço pode ser mandado para outra pessoa.
 *
 * O que só existe aqui, e não na linha: a série desenhada, a redação
 * honesta que a mensagem vai usar, e a escolha de canais. Escolher
 * canal é a exceção do fluxo ("esta serve só para o de pet"), então
 * fica onde a exceção mora.
 */

export function PainelDaOferta({ oferta }: { oferta: OfertaSimulada }) {
  const canais = canaisElegiveis(oferta.nicho);
  const serie = serieDePrecos(oferta);

  return (
    <>
      {/* Fundo escuro: clicar fora fecha, como qualquer gaveta. */}
      <Link
        href="/aprovar"
        aria-label="Fechar o detalhe"
        className="fixed inset-0 z-30 bg-[rgba(20,22,26,0.34)]"
      />

      <aside className="fixed top-0 right-0 z-40 flex h-full w-[520px] max-w-full flex-col gap-5 overflow-y-auto border-l border-borda bg-superficie p-6 shadow-gaveta">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
            detalhe da oferta
          </p>
          <Link
            href="/aprovar"
            className="flex size-8 items-center justify-center rounded-md border border-borda text-texto-medio hover:bg-fundo"
            aria-label="Fechar"
          >
            ×
          </Link>
        </div>

        <span
          className="flex h-52 flex-none items-center justify-center rounded-lg border border-borda-sutil bg-preenchimento text-sm text-texto-fraco"
          aria-hidden
        >
          foto do produto
        </span>

        <div>
          <h2 className="text-lg font-bold leading-titulo tracking-titulo">{oferta.produto}</h2>
          <p className="mt-2 flex items-center gap-2">
            <EtiquetaDeLoja
              nome={NOME_DA_LOJA[oferta.loja]}
              corTexto={COR_DA_LOJA[oferta.loja].texto}
              corFundo={COR_DA_LOJA[oferta.loja].fundo}
            />
            <span className="text-sm text-texto-fraco">
              {oferta.vendedor} · nicho {nomeDoNicho(oferta.nicho)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4 rounded-lg border border-marca-borda bg-[#FFF8F2] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-eyebrow text-marca-texto">agora</p>
            <p className="font-mono text-2xl font-extrabold leading-titulo tracking-titulo tabular-nums">
              {formataReais(oferta.precoAtualCentavos)}
            </p>
          </div>
          <div className="pb-1">
            <p className="text-xs font-bold uppercase tracking-eyebrow text-marca-texto">
              referência própria
            </p>
            <p className="font-mono text-base font-semibold text-texto-medio tabular-nums">
              {formataReais(oferta.precoReferenciaCentavos)}
            </p>
          </div>
          <span className="ml-auto rounded-md bg-marca px-3 py-2 font-mono text-base font-extrabold text-white tabular-nums">
            −{oferta.descontoPct}%
          </span>
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
              série própria · {oferta.diasDeSerie} dias
            </p>
            <p className="text-xs text-texto-fraco">desde {formataDia(oferta.observadoDesde)}</p>
          </div>

          <GraficoDaSerie serie={serie} referencia={oferta.precoReferenciaCentavos} />

          {/*
            A redação honesta, à vista de quem aprova. Abaixo de 14
            dias de série a mensagem não pode falar em mínimo histórico
            — e é melhor descobrir isso aqui do que depois de publicar.
          */}
          <p className="text-sm leading-longo text-texto-medio">
            {oferta.podeAfirmarMinimo
              ? `A mensagem pode dizer: "menor preço em ${oferta.referenciaJanelaDias} dias". São ${oferta.diasDeSerie} dias de série própria, acima dos 14 que a regra exige.`
              : `Só temos ${oferta.diasDeSerie} dias de série. A mensagem vai dizer "menor preço que observamos desde ${formataDia(oferta.observadoDesde)}" — não pode falar em mínimo histórico.`}
          </p>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie-alt p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">nota</p>
            <p className="font-mono text-lg font-extrabold tracking-titulo tabular-nums">
              {oferta.nota}
              <span className="text-sm font-semibold text-texto-fraco">/100</span>
            </p>
          </div>

          <Parcela rotulo="desconto" valor={oferta.parcelas.desconto} maximo={50} />
          <Parcela rotulo="comissão" valor={oferta.parcelas.comissao} maximo={30} />
          <Parcela rotulo="vendedor" valor={oferta.parcelas.vendedor} maximo={20} />

          <details>
            <summary className="cursor-pointer list-none pt-1 text-sm font-bold text-marca-texto">
              Por que esta oferta apareceu →
            </summary>
            <table className="mt-3 w-full text-left text-sm">
              <tbody>
                {oferta.comportas.map((comporta) => (
                  <tr key={comporta.nome} className="border-t border-borda-sutil">
                    <td className="py-2">
                      <span className={comporta.passou ? "text-sucesso" : "text-perigo"}>
                        {comporta.passou ? "passou" : "barrou"}
                      </span>{" "}
                      <span className="text-texto-medio">{comporta.nome}</span>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{comporta.observado}</td>
                    <td className="py-2 text-right font-mono text-texto-fraco tabular-nums">
                      {comporta.limiar}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <section className="flex flex-col gap-2 text-base">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-texto-fraco">Comissão estimada</span>
            <span className="font-mono font-bold tabular-nums">
              {formataReais(oferta.comissaoEstimadaCentavos)}{" "}
              <span className="font-sans text-xs font-semibold text-texto-fraco">est.</span>
            </span>
          </p>
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-texto-fraco">Último post deste produto</span>
            <span className="font-semibold">
              {oferta.publicadaAntesEm ? formataDia(oferta.publicadaAntesEm) : "nunca"}
            </span>
          </p>
        </section>

        {/*
          Aprovar é UM ato: por padrão vai para todos os canais
          elegíveis. Desmarcar é a exceção — "esta serve só para o de
          pet" — e por isso mora aqui, e não na linha.
        */}
        <form action={aprovaOferta} className="flex flex-col gap-3">
          <input type="hidden" name="oferta_id" value={oferta.id} />

          <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">iria para</p>

          <div className="flex flex-wrap gap-2">
            {canais.map((canal) => (
              <label
                key={canal.id}
                className="flex items-center gap-2 rounded-md border border-borda bg-superficie px-3 py-3 text-sm font-semibold text-texto-medio"
              >
                <input
                  type="checkbox"
                  name="canal_id"
                  value={canal.id}
                  defaultChecked
                  className="size-4 accent-marca"
                />
                <span
                  className={`size-2 rounded-circulo ${
                    canal.plataforma === "telegram" ? "bg-telegram" : "bg-whatsapp"
                  }`}
                  aria-hidden
                />
                {canal.nome}
                <span className="text-xs font-normal text-texto-fraco">
                  {canal.tetoDiario - canal.publicadasHoje} vagas
                </span>
              </label>
            ))}
            {canais.length === 0 && (
              <p className="text-sm text-atencao">
                Nenhum canal aceita {nomeDoNicho(oferta.nicho)}. Aprovar aqui seria ato sem efeito —
                cadastre um canal com esse nicho antes.
              </p>
            )}
          </div>

          <Botao type="submit" variante="primaria" tamanho="lg" disabled={canais.length === 0}>
            Aprovar
          </Botao>
        </form>

        <div className="flex flex-wrap gap-3">
          <form action={adiaOferta}>
            <input type="hidden" name="oferta_id" value={oferta.id} />
            <Botao type="submit" variante="secundaria">
              Adiar para amanhã
            </Botao>
          </form>

          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center rounded-md border border-perigo-borda bg-superficie px-4 py-3 text-base font-bold text-perigo">
              Rejeitar
            </summary>
            <div className="absolute right-0 bottom-full z-20 mb-2 w-72 rounded-lg border border-borda bg-superficie p-3 shadow-modal">
              <p className="mb-2 px-2 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
                por quê?
              </p>
              {MOTIVOS_DE_REJEICAO.map((motivo) => (
                <form action={rejeitaOferta} key={motivo}>
                  <input type="hidden" name="oferta_id" value={oferta.id} />
                  <input type="hidden" name="motivo" value={motivo} />
                  <button
                    type="submit"
                    className="w-full rounded-md px-3 py-3 text-left text-base text-texto-medio hover:bg-superficie-alt"
                  >
                    {motivo}
                  </button>
                </form>
              ))}
            </div>
          </details>
        </div>
      </aside>
    </>
  );
}

/**
 * A série, em linha.
 *
 * O tracejado é a referência — a mediana que nós calculamos. O ponto
 * cheio é hoje. Não é gráfico de contemplação (isso está fora de
 * escopo em `docs/telas.md`): é a prova de que a queda existe.
 */
function GraficoDaSerie({ serie, referencia }: { serie: number[]; referencia: number }) {
  const maior = Math.max(...serie, referencia);
  const menor = Math.min(...serie, referencia);
  const faixa = Math.max(1, maior - menor);

  const x = (i: number) => (i / Math.max(1, serie.length - 1)) * 400;
  const y = (valor: number) => 84 - ((valor - menor) / faixa) * 72;

  const linha = serie.map((valor, i) => `${x(i)},${y(valor)}`).join(" ");
  const area = `0,92 ${linha} 400,92`;
  const linhaRef = `0,${y(referencia)} 400,${y(referencia)}`;

  return (
    <svg
      viewBox="0 0 400 92"
      preserveAspectRatio="none"
      className="h-24 w-full rounded-lg border border-borda-sutil bg-superficie-alt"
      role="img"
      aria-label={`Série de ${serie.length} pontos de preço`}
    >
      <defs>
        <linearGradient id="serie-fundo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F16A0D" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#F16A0D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#serie-fundo)" />
      <polyline
        points={linhaRef}
        fill="none"
        stroke="#CFD3DA"
        strokeWidth="1"
        strokeDasharray="4 5"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={linha}
        fill="none"
        stroke="#F16A0D"
        strokeWidth="1.8"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={x(serie.length - 1)}
        cy={y(serie[serie.length - 1])}
        r="3.6"
        fill="#FFFFFF"
        stroke="#F16A0D"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function Parcela({ rotulo, valor, maximo }: { rotulo: string; valor: number; maximo: number }) {
  return (
    <span className="grid grid-cols-[72px_1fr_42px] items-center gap-3">
      <span className="text-sm text-texto-fraco">{rotulo}</span>
      <span className="h-2 rounded-xs bg-preenchimento" aria-hidden>
        <span
          className="block h-2 rounded-xs bg-marca"
          style={{ width: `${Math.round((valor / maximo) * 100)}%` }}
        />
      </span>
      <span className="text-right font-mono text-xs font-semibold text-texto-fraco tabular-nums">
        {valor}/{maximo}
      </span>
    </span>
  );
}

function formataDia(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
