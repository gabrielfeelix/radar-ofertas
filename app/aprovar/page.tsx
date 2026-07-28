import Link from "next/link";

import {
  adiaOferta,
  aprovaOferta,
  desfazDecisaoDaOferta,
  rejeitaOferta,
} from "@/app/acoes/curadoria";
import { AvisoSimulacao } from "@/app/componentes/AvisoSimulacao";
import { CabecalhoDaPagina, Kpis } from "@/app/componentes/CabecalhoDaPagina";
import { formataReais } from "@/lib/dinheiro";
import {
  MOTIVOS_DE_REJEICAO,
  NOME_DA_LOJA,
  canaisElegiveis,
  nomeDoNicho,
  ofertasDaFila,
  publicacoesSeAprovarTudo,
  todasAsOfertas,
  vagasDeHoje,
  type CanalSimulado,
  type OfertaSimulada,
} from "@/lib/simulacao/loja";

/**
 * Aprovar — a tela onde o produto acontece.
 *
 * A forma segue o protótipo: linha de tabela densa, com produto,
 * preço contra referência, desconto, nota em anel e comissão. O que o
 * protótipo não tinha e aqui existe são as ações na própria linha.
 *
 * Essa diferença é deliberada e está em `docs/plano.md`: no protótipo
 * a decisão morava no painel lateral, o que custa cerca de 60
 * rolagens em 30 ofertas. O painel continua fazendo sentido para "esta
 * aqui eu quero olhar" — vira exceção, não caminho.
 */

export const dynamic = "force-dynamic";

type Ordem = "nota" | "comissao";

export default async function Aprovar({
  searchParams,
}: {
  searchParams: Promise<{ ordem?: string }>;
}) {
  const { ordem: ordemBruta } = await searchParams;
  const ordem: Ordem = ordemBruta === "comissao" ? "comissao" : "nota";

  const fila = [...ofertasDaFila()].sort((a, b) =>
    ordem === "comissao"
      ? b.comissaoEstimadaCentavos - a.comissaoEstimadaCentavos
      : b.nota - a.nota,
  );

  const decididas = todasAsOfertas().filter((o) => o.status !== "nova");
  const publicacoes = publicacoesSeAprovarTudo();
  const vagas = vagasDeHoje();
  const estouro = publicacoes - vagas;

  return (
    <>
      <CabecalhoDaPagina
        trilha="Hoje"
        titulo="Aprovar"
        subtitulo="O que o motor detectou hoje. O preço de referência é a mediana da nossa própria série — nunca o “preço de” da loja."
        acoes={
          fila.length > 0 ? (
            <div className="flex items-center gap-1 rounded-md border border-borda bg-superficie p-1">
              <span className="px-2 text-xs text-texto-fraco">ordenar</span>
              <Aba href="/aprovar" rotulo="Nota" ativo={ordem === "nota"} />
              <Aba href="/aprovar?ordem=comissao" rotulo="Comissão" ativo={ordem === "comissao"} />
            </div>
          ) : undefined
        }
      />

      <Kpis
        itens={[
          {
            rotulo: "Ofertas na fila",
            valor: `${fila.length}`,
            nota: `${decididas.length} já decididas hoje`,
          },
          {
            rotulo: "Viram publicações",
            valor: `${publicacoes}`,
            nota: "se você aprovar tudo",
          },
          {
            rotulo: "Vagas hoje",
            valor: `${vagas}`,
            nota: estouro > 0 ? `${estouro} passariam do teto` : "cabe tudo",
            cor: estouro > 0 ? "text-atencao" : "text-sucesso",
          },
        ]}
      />

      <main className="flex flex-col gap-5 px-6 pt-5 pb-10">
        <AvisoSimulacao />

        {fila.length === 0 ? (
          <FilaVazia decididas={decididas.length} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-borda bg-superficie">
            <div className="hidden grid-cols-[minmax(150px,1fr)_112px_84px_56px_96px_auto] items-center gap-4 border-b border-borda bg-superficie-alt px-5 py-3 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco lg:grid">
              <span>Produto</span>
              <span>Preço</span>
              <span>Desconto</span>
              <span>Nota</span>
              <span className="text-right">Comissão</span>
              <span className="text-right">Decisão</span>
            </div>

            {fila.map((oferta) => (
              <LinhaDeOferta
                key={oferta.id}
                oferta={oferta}
                canais={canaisElegiveis(oferta.nicho)}
              />
            ))}

            <p className="px-5 py-3 text-sm text-texto-fraco">
              A comissão é estimativa: o percentual muda a cada campanha e só é confirmado no
              relatório da loja.
            </p>
          </div>
        )}

        {decididas.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-titulo">
              Decididas hoje{" "}
              <span className="text-base font-semibold text-texto-fraco">({decididas.length})</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {decididas.map((oferta) => (
                <li key={oferta.id}>
                  <LinhaDecidida oferta={oferta} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function LinhaDeOferta({ oferta, canais }: { oferta: OfertaSimulada; canais: CanalSimulado[] }) {
  return (
    <article className="grid grid-cols-1 gap-4 border-b border-borda-sutil px-5 py-4 last:border-0 lg:grid-cols-[minmax(150px,1fr)_112px_84px_56px_96px_auto] lg:items-center">
      {/* Produto: identidade, loja, nicho, série e os avisos que mudam a decisão. */}
      <div className="flex min-w-0 items-center gap-4">
        {/*
          Espaço de imagem. A foto do produto não é enfeite — ela é
          metade do reconhecimento numa lista de trinta. Fica cinza
          até existir coleta que traga a imagem.
        */}
        <span
          className="flex size-16 flex-none items-center justify-center rounded-md border border-borda-sutil bg-preenchimento text-xs text-texto-fraco"
          aria-hidden
        >
          foto
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <a
            href={oferta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-base font-semibold tracking-titulo hover:text-marca-texto"
          >
            {oferta.produto}
          </a>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-bold text-texto-medio">
              {NOME_DA_LOJA[oferta.loja]}
            </span>
            <span className="text-xs text-texto-fraco">
              {nomeDoNicho(oferta.nicho)} · {oferta.diasDeSerie} dias de série ·{" "}
              {canais.length} {canais.length === 1 ? "canal" : "canais"}
            </span>
            {/*
              "Sem lastro" é a regra 3.4 virando etiqueta: abaixo de 14
              dias de série, a mensagem não pode falar em mínimo
              histórico, e quem aprova precisa saber disso antes.
            */}
            {!oferta.podeAfirmarMinimo && (
              <span
                className="rounded-sm bg-atencao-fundo px-2 py-1 text-xs font-semibold text-atencao"
                title={`Só temos série desde ${formataDia(oferta.observadoDesde)}. A mensagem vai dizer "menor preço que observamos desde", não "menor preço histórico".`}
              >
                sem lastro
              </span>
            )}
            {oferta.publicadaAntesEm && (
              <span className="rounded-sm bg-perigo-fundo px-2 py-1 text-xs font-semibold text-perigo">
                repetido em {formataDia(oferta.publicadaAntesEm)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col leading-titulo">
        <span className="font-mono text-md font-bold tracking-titulo tabular-nums">
          {formataReais(oferta.precoAtualCentavos)}
        </span>
        <span className="font-mono text-xs text-texto-fraco line-through tabular-nums">
          {formataReais(oferta.precoReferenciaCentavos)}
        </span>
      </div>

      <div>
        <span className="rounded-sm bg-marca-fundo px-3 py-1 font-mono text-sm font-bold text-marca-texto tabular-nums">
          −{oferta.descontoPct}%
        </span>
      </div>

      <AnelDaNota oferta={oferta} />

      <div className="font-mono text-base font-bold tabular-nums lg:text-right">
        {formataReais(oferta.comissaoEstimadaCentavos)}
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <form action={aprovaOferta}>
          <input type="hidden" name="oferta_id" value={oferta.id} />
          <button
            type="submit"
            disabled={canais.length === 0}
            className="rounded-md bg-marca px-4 py-3 text-sm font-bold text-white shadow-marca hover:bg-marca-hover disabled:opacity-40"
          >
            Aprovar
          </button>
        </form>

        {/*
          Rejeitar custa o mesmo que aprovar: um toque abre a lista, o
          segundo decide. Fila em que dizer não custa mais que dizer sim
          produz curadoria que vira carimbo.
        */}
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-perigo-borda px-4 py-3 text-sm font-semibold text-perigo">
            Rejeitar
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-borda bg-superficie p-3 shadow-modal">
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

        <form action={adiaOferta}>
          <input type="hidden" name="oferta_id" value={oferta.id} />
          <button
            type="submit"
            className="rounded-md px-3 py-3 text-sm font-semibold text-texto-fraco hover:bg-superficie-alt"
          >
            Adiar
          </button>
        </form>

        <details className="relative">
          <summary
            className="cursor-pointer list-none rounded-md border border-borda px-3 py-3 text-sm font-bold text-marca-texto"
            title="Por que esta oferta apareceu"
          >
            ?
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-96 max-w-[80vw] rounded-lg border border-borda bg-superficie p-4 shadow-modal">
            <Diagnostico oferta={oferta} />
          </div>
        </details>
      </div>
    </article>
  );
}

/**
 * A nota em anel, como no protótipo.
 *
 * O anel diz "quanto de 100" sem exigir leitura de número, que é o
 * que permite varrer trinta linhas com o olho. As parcelas ficam no
 * diagnóstico, onde há espaço para explicá-las.
 */
function AnelDaNota({ oferta }: { oferta: OfertaSimulada }) {
  const circunferencia = 100.5;
  const preenchido = (oferta.nota / 100) * circunferencia;
  const cor = oferta.nota >= 70 ? "#1B8A4E" : oferta.nota >= 50 ? "#F16A0D" : "#B4740A";

  return (
    <span className="relative flex size-10 items-center justify-center" title={`Nota ${oferta.nota} de 100`}>
      <svg viewBox="0 0 38 38" className="size-10 -rotate-90" aria-hidden>
        <circle cx="19" cy="19" r="16" fill="none" stroke="#EDEEF1" strokeWidth="3.5" />
        <circle
          cx="19"
          cy="19"
          r="16"
          fill="none"
          stroke={cor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${circunferencia}`}
        />
      </svg>
      <span className="absolute font-mono text-sm font-bold tabular-nums">{oferta.nota}</span>
    </span>
  );
}

/**
 * Diagnóstico da curadoria.
 *
 * Os motivos vêm da mesma implementação que decide de verdade — hoje
 * da simulação, amanhã de `avalia_anuncios`. Reescrever a explicação
 * em outro lugar produziria uma tela que explica uma coisa enquanto o
 * sistema faz outra, e a tela seria acreditada.
 */
function Diagnostico({ oferta }: { oferta: OfertaSimulada }) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
        por que apareceu
      </p>
      <table className="w-full text-left text-sm">
        <tbody>
          {oferta.comportas.map((comporta) => (
            <tr key={comporta.nome} className="border-b border-borda-sutil last:border-0">
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

      <div className="mt-3 flex flex-col gap-2">
        <ParcelaDaNota rotulo="desconto" valor={oferta.parcelas.desconto} maximo={50} />
        <ParcelaDaNota rotulo="comissão" valor={oferta.parcelas.comissao} maximo={30} />
        <ParcelaDaNota rotulo="vendedor" valor={oferta.parcelas.vendedor} maximo={20} />
      </div>

      <p className="mt-3 text-xs text-texto-fraco">
        {oferta.podeAfirmarMinimo
          ? `Menor preço em ${oferta.referenciaJanelaDias} dias, sobre ${oferta.diasDeSerie} dias de série.`
          : `Só temos série desde ${formataDia(oferta.observadoDesde)} — a mensagem não pode falar em mínimo histórico.`}{" "}
        Fadiga não tira ponto porque já é comporta: repetição não é oferta pior, é oferta que não
        deve sair.
      </p>
    </div>
  );
}

function ParcelaDaNota({
  rotulo,
  valor,
  maximo,
}: {
  rotulo: string;
  valor: number;
  maximo: number;
}) {
  return (
    <span className="grid grid-cols-[72px_1fr_42px] items-center gap-3">
      <span className="text-sm text-texto-fraco">{rotulo}</span>
      <span className="h-2 rounded-xs bg-preenchimento" aria-hidden>
        <span
          className="block h-2 rounded-xs bg-marca"
          style={{ width: `${Math.round((valor / maximo) * 100)}%` }}
        />
      </span>
      <span className="text-right font-mono text-xs font-semibold tabular-nums text-texto-fraco">
        {valor}/{maximo}
      </span>
    </span>
  );
}

function LinhaDecidida({ oferta }: { oferta: OfertaSimulada }) {
  const rotulo =
    oferta.status === "aprovada"
      ? `aprovada · ${oferta.canaisEscolhidos.length} ${oferta.canaisEscolhidos.length === 1 ? "canal" : "canais"}`
      : oferta.status === "rejeitada"
        ? `rejeitada · ${oferta.motivoRejeicao}`
        : "adiada · volta amanhã se ainda valer";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-borda bg-superficie-alt px-4 py-3">
      <span
        className={`size-2 flex-none rounded-circulo ${
          oferta.status === "aprovada"
            ? "bg-sucesso"
            : oferta.status === "rejeitada"
              ? "bg-perigo"
              : "bg-texto-apagado"
        }`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-base">{oferta.produto}</span>
      <span className="text-sm text-texto-fraco">{rotulo}</span>
      <form action={desfazDecisaoDaOferta}>
        <input type="hidden" name="oferta_id" value={oferta.id} />
        <button
          type="submit"
          className="rounded-md px-3 py-2 text-sm font-semibold text-marca-texto hover:bg-superficie"
        >
          desfazer
        </button>
      </form>
    </div>
  );
}

/**
 * Fila vazia — o funil, não a frase.
 *
 * "Nenhuma oferta hoje" é inútil. O número que falta é o que impede a
 * conclusão errada de que o sistema quebrou, que é o caminho para
 * afrouxar parâmetro até a curadoria virar carimbo.
 */
function FilaVazia({ decididas }: { decididas: number }) {
  const total = todasAsOfertas().length;

  const funil = [
    { n: 340, rotulo: "anúncios monitorados", pct: 100, cor: "#1B76B8" },
    { n: 12, rotulo: "com série suficiente para avaliar", pct: 28, cor: "#F16A0D" },
    { n: 0, rotulo: "abaixo do limiar hoje", pct: 2, cor: "#9AA0AA" },
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-5 rounded-lg border border-borda bg-superficie p-8">
      <h2 className="text-xl font-extrabold tracking-titulo">
        {decididas > 0 ? "Fila zerada." : "Nenhuma oferta hoje."}
      </h2>

      {decididas > 0 ? (
        <p className="text-base text-texto-fraco">
          Você decidiu as {total} ofertas de hoje. As aprovadas estão esperando na fila de
          publicação.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {funil.map((etapa) => (
              <div
                key={etapa.rotulo}
                className="flex items-center gap-4 rounded-md border border-borda-sutil bg-superficie-alt px-4 py-3"
              >
                <span
                  className="w-14 text-right font-mono text-lg font-extrabold tabular-nums tracking-titulo"
                  style={{ color: etapa.cor }}
                >
                  {etapa.n}
                </span>
                <span className="flex-1 text-base text-texto-fraco">{etapa.rotulo}</span>
                <span className="h-2 w-28 rounded-xs bg-preenchimento" aria-hidden>
                  <span
                    className="block h-2 rounded-xs"
                    style={{ width: `${etapa.pct}%`, background: etapa.cor }}
                  />
                </span>
              </div>
            ))}
          </div>
          <p className="text-base leading-longo text-texto-fraco">
            Cada anúncio novo só passa a ser avaliável depois de acumular série própria. Na primeira
            semana quase não há oferta; a partir da sexta o normal é trinta por dia.{" "}
            <strong className="font-bold text-texto">Fila vazia agora é o previsto, não defeito.</strong>
          </p>
        </>
      )}

      {decididas > 0 && (
        <Link
          href="/publicar"
          className="self-start rounded-md bg-marca px-5 py-4 text-base font-bold text-white shadow-marca hover:bg-marca-hover"
        >
          Ir para a fila de publicação
        </Link>
      )}
    </div>
  );
}

function Aba({ href, rotulo, ativo }: { href: string; rotulo: string; ativo: boolean }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-sm px-3 py-2 text-sm font-semibold ${
        ativo ? "bg-marca-fundo text-marca-texto" : "text-texto-fraco hover:bg-superficie-alt"
      }`}
    >
      {rotulo}
    </Link>
  );
}

function formataDia(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
