import Link from "next/link";

import {
  adiaOferta,
  aprovaOferta,
  desfazDecisaoDaOferta,
  rejeitaOferta,
} from "@/app/acoes/curadoria";
import { AvisoSimulacao } from "@/app/componentes/AvisoSimulacao";
import { formataReais } from "@/lib/dinheiro";
import {
  MOTIVOS_DE_REJEICAO,
  NOME_DA_LOJA,
  canaisElegiveis,
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
 * Coleta, série histórica e motor de curadoria existem para alimentar
 * esta lista. É aqui que o projeto se separa dos concorrentes: eles
 * repassam oferta alheia sem conferir preço, e por isso não precisam
 * desta tela.
 *
 * Três decisões de forma, e o motivo de cada uma:
 *
 * DECIDIR DA LINHA. Tudo que a decisão precisa está na linha. Obrigar
 * a abrir um painel custa cerca de 60 rolagens em 30 ofertas — o
 * painel vira exceção, para "esta aqui eu quero olhar".
 *
 * REJEITAR CUSTA O MESMO QUE APROVAR. Fila em que dizer não custa
 * mais que dizer sim produz curadoria que vira carimbo. Por isso o
 * motivo é um clique numa lista curta, não um campo de texto.
 *
 * CAPACIDADE NO TOPO. "12 ofertas → 26 publicações → 15 vagas hoje" é
 * o número que muda comportamento. Sem ele o dono aprova de graça e
 * descobre o custo depois, em pé, no telefone.
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-titulo">Aprovar</h1>
          <p className="mt-2 text-base text-texto-fraco">
            O que o motor detectou hoje. O preço de referência é a mediana da nossa própria série —
            nunca o &ldquo;preço de&rdquo; da loja.
          </p>
        </div>

        <AvisoSimulacao />

        {/*
          A capacidade é a primeira coisa da tela, e é uma frase, não
          três números soltos: a relação entre eles é que informa.
        */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-borda bg-superficie px-5 py-4">
          <Numero valor={fila.length} rotulo={fila.length === 1 ? "oferta" : "ofertas"} />
          <Seta />
          <Numero valor={publicacoes} rotulo="publicações" />
          <Seta />
          <Numero
            valor={vagas}
            rotulo="vagas hoje"
            alerta={publicacoes > vagas}
          />
          {publicacoes > vagas && (
            <p className="w-full text-sm text-atencao sm:w-auto sm:flex-1">
              Aprovar tudo estoura o teto dos canais em {publicacoes - vagas}. O que passar do teto
              fica na fila para amanhã.
            </p>
          )}
        </div>
      </header>

      {fila.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-texto-fraco">Ordenar por</span>
          <Aba href="/aprovar" rotulo="nota" ativo={ordem === "nota"} />
          <Aba href="/aprovar?ordem=comissao" rotulo="comissão" ativo={ordem === "comissao"} />
          <span className="hidden text-sm text-texto-fraco sm:inline">
            — 60% de desconto num produto de doze reais não paga o post
          </span>
        </div>
      )}

      {fila.length === 0 ? (
        <FilaVazia decididas={decididas.length} />
      ) : (
        <ul className="flex flex-col gap-4">
          {fila.map((oferta) => (
            <li key={oferta.id}>
              <LinhaDeOferta oferta={oferta} canais={canaisElegiveis(oferta.nicho)} />
            </li>
          ))}
        </ul>
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
  );
}

function LinhaDeOferta({
  oferta,
  canais,
}: {
  oferta: OfertaSimulada;
  canais: CanalSimulado[];
}) {
  const repetido = oferta.publicadaAntesEm !== null;

  return (
    <article className="rounded-lg border border-borda bg-superficie">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:gap-6">
        {/* Identidade: o que é, onde está, para onde iria. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetaDeLoja loja={oferta.loja} />
            <span className="text-sm text-texto-fraco">{oferta.vendedor}</span>
            {repetido && (
              <span className="rounded-sm border border-atencao-borda bg-atencao-fundo px-2 py-1 text-xs font-semibold text-atencao">
                já publicado em {formataDia(oferta.publicadaAntesEm!)}
              </span>
            )}
          </div>

          <h3 className="mt-2 text-md font-bold tracking-titulo">
            <a
              href={oferta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-borda-forte underline-offset-2"
            >
              {oferta.produto}
            </a>
          </h3>

          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-texto-fraco">
            <span>iria para</span>
            {canais.map((canal) => (
              <span
                key={canal.id}
                className="rounded-pilula border border-borda bg-superficie-alt px-3 py-1 text-xs font-semibold text-texto-medio"
              >
                {canal.nome}
                <span className="ml-1 font-mono text-texto-fraco">
                  {canal.tetoDiario - canal.publicadasHoje} vagas
                </span>
              </span>
            ))}
            {canais.length === 0 && (
              <span className="text-atencao">nenhum canal aceita {oferta.nicho}</span>
            )}
          </p>
        </div>

        {/* Preço: o argumento. */}
        <div className="lg:w-52">
          <p className="font-mono text-2xl font-extrabold tabular-nums tracking-titulo">
            {formataReais(oferta.precoAtualCentavos)}
          </p>
          <p className="mt-1 text-sm text-texto-fraco">
            <span className="line-through">{formataReais(oferta.precoReferenciaCentavos)}</span>{" "}
            <span className="font-bold text-sucesso">−{oferta.descontoPct}%</span>
          </p>
          {/*
            Com menos de 14 dias de série a tela não pode falar em
            desconto histórico. A redação honesta traz a data em que a
            observação começou — mentir sobre preço é o erro que mata
            os concorrentes.
          */}
          <p className="mt-2 text-xs text-texto-fraco">
            {oferta.podeAfirmarMinimo
              ? `menor preço em ${oferta.referenciaJanelaDias} dias · ${oferta.diasDeSerie} dias de série`
              : `menor que observamos desde ${formataDia(oferta.observadoDesde)} · só ${oferta.diasDeSerie} dias de série`}
          </p>
        </div>

        {/* Nota e comissão: o que o motor achou, explicável. */}
        <div className="lg:w-44">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-extrabold tabular-nums tracking-titulo">
              {oferta.nota}
            </span>
            <span className="text-sm text-texto-fraco">/ 100</span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            <Parcela valor={oferta.parcelas.desconto} maximo={50} cor="bg-marca" />
            <Parcela valor={oferta.parcelas.comissao} maximo={30} cor="bg-sucesso" />
            <Parcela valor={oferta.parcelas.vendedor} maximo={20} cor="bg-info" />
          </div>
          <p className="mt-2 text-xs text-texto-fraco">
            desconto {oferta.parcelas.desconto} · comissão {oferta.parcelas.comissao} · vendedor{" "}
            {oferta.parcelas.vendedor}
          </p>
          <p className="mt-2 font-mono text-base font-bold tabular-nums">
            {formataReais(oferta.comissaoEstimadaCentavos)}
            <span className="ml-1 font-sans text-xs font-normal text-texto-fraco">estimada</span>
          </p>
        </div>
      </div>

      {/* Ações: aprovar e rejeitar custam o mesmo. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-borda-sutil px-5 py-4">
        <form action={aprovaOferta}>
          <input type="hidden" name="oferta_id" value={oferta.id} />
          <button
            type="submit"
            disabled={canais.length === 0}
            className="rounded-md bg-marca px-5 py-4 text-base font-bold text-white shadow-marca hover:bg-marca-hover disabled:opacity-40"
          >
            Aprovar
            {canais.length > 0 && (
              <span className="ml-2 font-normal opacity-80">
                {canais.length} {canais.length === 1 ? "canal" : "canais"}
              </span>
            )}
          </button>
        </form>

        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-perigo-borda bg-superficie px-5 py-4 text-base font-semibold text-perigo">
            Rejeitar
          </summary>
          {/*
            O motivo é obrigatório e sai de uma lista curta. Campo de
            texto livre viraria motivo que ninguém agrega depois, e o
            ponto de exigir motivo é poder calibrar o motor.
          */}
          <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-borda bg-superficie p-4 shadow-modal">
            <p className="mb-3 text-sm font-semibold">Por quê?</p>
            <ul className="flex flex-col gap-2">
              {MOTIVOS_DE_REJEICAO.map((motivo) => (
                <li key={motivo}>
                  <form action={rejeitaOferta}>
                    <input type="hidden" name="oferta_id" value={oferta.id} />
                    <input type="hidden" name="motivo" value={motivo} />
                    <button
                      type="submit"
                      className="w-full rounded-md px-3 py-3 text-left text-base text-texto-medio hover:bg-superficie-alt"
                    >
                      {motivo}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </details>

        <form action={adiaOferta}>
          <input type="hidden" name="oferta_id" value={oferta.id} />
          <button
            type="submit"
            className="rounded-md px-4 py-4 text-base font-semibold text-texto-fraco hover:bg-superficie-alt"
          >
            Adiar
          </button>
        </form>

        <details className="ml-auto">
          <summary className="cursor-pointer list-none px-3 py-4 text-base font-semibold text-marca-texto">
            Por que apareceu?
          </summary>
          <Diagnostico oferta={oferta} />
        </details>
      </div>
    </article>
  );
}

/**
 * Diagnóstico da curadoria.
 *
 * Os motivos vêm da mesma implementação que decide de verdade —
 * hoje da simulação, amanhã de `avalia_anuncios`. Reescrever a
 * explicação em outro lugar produziria uma tela que explica uma
 * coisa enquanto o sistema faz outra, e a tela seria acreditada.
 */
function Diagnostico({ oferta }: { oferta: OfertaSimulada }) {
  return (
    <div className="mt-3 w-full rounded-lg border border-borda bg-superficie-alt p-4">
      <table className="w-full text-left text-sm">
        <thead className="text-xs font-semibold uppercase tracking-eyebrow text-texto-fraco">
          <tr>
            <th className="py-2">Comporta</th>
            <th className="py-2">Observado</th>
            <th className="py-2">Limiar</th>
          </tr>
        </thead>
        <tbody>
          {oferta.comportas.map((comporta) => (
            <tr key={comporta.nome} className="border-t border-borda-sutil">
              <td className="py-2">
                <span className={comporta.passou ? "text-sucesso" : "text-perigo"}>
                  {comporta.passou ? "passou" : "barrou"}
                </span>{" "}
                <span className="text-texto-medio">{comporta.nome}</span>
              </td>
              <td className="py-2 font-mono tabular-nums">{comporta.observado}</td>
              <td className="py-2 font-mono tabular-nums text-texto-fraco">{comporta.limiar}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-texto-fraco">
        Nota {oferta.nota} = desconto {oferta.parcelas.desconto}/50 + comissão{" "}
        {oferta.parcelas.comissao}/30 + vendedor {oferta.parcelas.vendedor}/20. Fadiga não tira
        ponto porque já é comporta: repetição não é oferta pior, é oferta que não deve sair.
      </p>
    </div>
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
        className={`h-2 w-2 shrink-0 rounded-full ${
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
 * Fila vazia.
 *
 * "Nenhuma oferta hoje" é inútil. O número que falta é o que impede
 * a conclusão errada de que o sistema quebrou — que é o caminho para
 * o dono afrouxar parâmetro até a curadoria virar carimbo.
 */
function FilaVazia({ decididas }: { decididas: number }) {
  const total = todasAsOfertas().length;

  return (
    <div className="rounded-lg border border-dashed border-borda-forte p-8 text-center">
      <p className="text-md font-bold tracking-titulo">
        {decididas > 0 ? "Fila zerada." : "Nenhuma oferta hoje."}
      </p>
      <p className="mx-auto mt-2 max-w-lg text-base text-texto-fraco">
        {decididas > 0
          ? `Você decidiu as ${total} ofertas de hoje. As aprovadas estão esperando na fila de publicação.`
          : "340 anúncios monitorados, 12 com série suficiente, 0 abaixo do limiar. Nas primeiras semanas isso é o normal: cada produto novo só fica avaliável depois de acumular série."}
      </p>
      {decididas > 0 && (
        <Link
          href="/publicar"
          className="mt-5 inline-block rounded-md bg-marca px-5 py-4 text-base font-bold text-white shadow-marca hover:bg-marca-hover"
        >
          Ir para a fila de publicação
        </Link>
      )}
    </div>
  );
}

function Numero({
  valor,
  rotulo,
  alerta,
}: {
  valor: number;
  rotulo: string;
  alerta?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-2">
      <span
        className={`font-mono text-2xl font-extrabold tabular-nums tracking-titulo ${
          alerta ? "text-atencao" : ""
        }`}
      >
        {valor}
      </span>
      <span className="text-sm text-texto-fraco">{rotulo}</span>
    </span>
  );
}

function Seta() {
  return (
    <span className="text-texto-apagado" aria-hidden>
      →
    </span>
  );
}

function Parcela({ valor, maximo, cor }: { valor: number; maximo: number; cor: string }) {
  return (
    <span
      className="h-2 rounded-xs bg-preenchimento"
      style={{ width: `${maximo * 2}px` }}
      title={`${valor} de ${maximo}`}
    >
      <span
        className={`block h-2 rounded-xs ${cor}`}
        style={{ width: `${Math.round((valor / maximo) * 100)}%` }}
      />
    </span>
  );
}

function EtiquetaDeLoja({ loja }: { loja: OfertaSimulada["loja"] }) {
  return (
    <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-medio">
      {NOME_DA_LOJA[loja]}
    </span>
  );
}

function Aba({ href, rotulo, ativo }: { href: string; rotulo: string; ativo: boolean }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-pilula border px-4 py-2 text-base font-semibold ${
        ativo
          ? "border-marca-borda bg-marca-fundo text-marca-texto"
          : "border-borda bg-superficie text-texto-medio hover:bg-superficie-alt"
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
