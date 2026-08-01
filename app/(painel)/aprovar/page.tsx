import { Identidade } from "@/app/componentes/Identidade";
import Link from "next/link";

import {
  adiaOferta,
  aprovaOferta,
  desfazDecisaoDaOferta,
  rejeitaOferta,
} from "@/app/acoes/curadoria";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { EtiquetaDeLoja } from "@/app/componentes/Chip";
import { PainelDaOferta } from "@/app/componentes/PainelDaOferta";
import { Sparkline } from "@/app/componentes/Sparkline";
import { formataReais } from "@/lib/dinheiro";
import { vagasDeHoje, type Canal } from "@/lib/distribuicao";
import {
  MOTIVOS_DE_REJEICAO,
  buscaOferta,
  funilDeHoje,
  ofertasDaFila,
  ofertasDecididasHoje,
  publicacoesSeAprovarTudo,
  type Oferta,
} from "@/lib/ofertas";

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
  searchParams: Promise<{ ordem?: string; oferta?: string; nicho?: string }>;
}) {
  const { ordem: ordemBruta, oferta: ofertaAberta, nicho: nichoFiltro } = await searchParams;
  const ordem: Ordem = ordemBruta === "comissao" ? "comissao" : "nota";

  // Uma leitura só do banco para as duas listas e os dois KPIs. O
  // `ofertasDaFila` já vem ordenado por nota; a ordem por comissão é
  // reordenação da mesma lista, não outra consulta.
  const [fila0, decididas, publicacoes, vagas] = await Promise.all([
    ofertasDaFila(),
    ofertasDecididasHoje(),
    publicacoesSeAprovarTudo(),
    vagasDeHoje(),
  ]);

  /*
    O filtro por nicho existe porque publicar é por canal, e canal é
    de um nicho. "Quero ver só tecnologia agora, para postar naquele
    grupo" é o pedido literal de quem opera — sem ele, decidir para um
    canal significa varrer a fila inteira ignorando o que não serve.

    Ele filtra a FILA, não os KPIs: as vagas e o total do dia
    continuam sendo os da operação inteira. Um teto que mudasse ao
    trocar de aba faria o número que controla o dia parecer outro a
    cada clique.
  */
  const nichosDaFila = [...new Set(fila0.map((o) => o.nicho))]
    .map((slug) => ({ slug, nome: fila0.find((o) => o.nicho === slug)?.nichoNome ?? slug }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const filtrada = nichoFiltro ? fila0.filter((o) => o.nicho === nichoFiltro) : fila0;

  const fila = [...filtrada].sort((a, b) =>
    ordem === "comissao"
      ? b.comissaoEstimadaCentavos - a.comissaoEstimadaCentavos
      : b.nota - a.nota,
  );

  /** Preserva o nicho ao trocar a ordem, e vice-versa. */
  const comFiltros = (mudanca: { ordem?: string; nicho?: string }) => {
    const p = new URLSearchParams();
    const o = mudanca.ordem ?? (ordem === "comissao" ? "comissao" : "");
    const n = mudanca.nicho ?? nichoFiltro ?? "";
    if (o) p.set("ordem", o);
    if (n) p.set("nicho", n);
    const q = p.toString();
    return q ? `/aprovar?${q}` : "/aprovar";
  };
  const estouro = publicacoes - vagas;

  // O painel é rota, não estado: sobrevive a recarregar, o botão
  // voltar fecha, e o endereço pode ser mandado para outra pessoa.
  const detalhe = ofertaAberta ? await buscaOferta(ofertaAberta) : undefined;

  return (
    <>
      <Pagina
        trilha="Hoje"
        titulo="Aprovar"
        subtitulo="O que o motor detectou hoje. O preço de referência é a mediana da nossa própria série — nunca o “preço de” da loja."
        medida="cheia"
        acoes={
          fila.length > 0 ? (
            <div className="flex items-center gap-1 rounded-md border border-borda bg-superficie p-1">
              <span className="px-2 text-xs text-texto-fraco">ordenar</span>
              <Aba href={comFiltros({ ordem: "" })} rotulo="Nota" ativo={ordem === "nota"} />
              <Aba
                href={comFiltros({ ordem: "comissao" })}
                rotulo="Comissão"
                ativo={ordem === "comissao"}
              />
            </div>
          ) : undefined
        }
        kpis={[
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
      >
        {/*
          As abas de nicho só aparecem com mais de um nicho na fila:
          com um só, elas seriam uma linha de interface que não decide
          nada.
        */}
        {nichosDaFila.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <Aba href={comFiltros({ nicho: "" })} rotulo="Todos" ativo={!nichoFiltro} />
            {nichosDaFila.map((n) => (
              <Aba
                key={n.slug}
                href={comFiltros({ nicho: n.slug })}
                rotulo={`${n.nome} (${fila0.filter((o) => o.nicho === n.slug).length})`}
                ativo={nichoFiltro === n.slug}
              />
            ))}
          </div>
        )}

        {fila.length === 0 && nichoFiltro ? (
          <div className="rounded-lg border border-borda-sutil bg-superficie p-8 shadow-repouso">
            <p className="text-base text-texto-fraco">
              Nada de{" "}
              <strong className="font-bold text-texto">
                {nichosDaFila.find((n) => n.slug === nichoFiltro)?.nome ?? nichoFiltro}
              </strong>{" "}
              esperando decisão agora.{" "}
              <Link href={comFiltros({ nicho: "" })} className="text-marca-texto underline">
                Ver a fila inteira
              </Link>
              .
            </p>
          </div>
        ) : fila.length === 0 ? (
          <FilaVazia decididas={decididas.length} />
        ) : (
          // Sem `overflow-hidden`: ele cortava a lista de motivos da
          // rejeição, aberta de dentro da linha. Menu que aparece pela
          // metade transforma a ação mais sensível da tela em
          // tentativa e erro.
          <div className="rounded-lg border border-borda-sutil bg-superficie shadow-repouso">
            {/*
              A grade mudou em 31/07, com as capturas de tela na mão.

              Preço, desconto e comissão eram três colunas soltas com
              uns 200px de vazio entre elas — o olho atravessava a
              linha inteira para juntar três números que só fazem
              sentido lidos juntos. Agora são um bloco só, alinhado à
              direita, e a coluna que sobrou virou a série de preço,
              que é o dado que realmente decide e antes só existia
              dentro do painel.
            */}
            <div className="hidden grid-cols-[minmax(150px,1fr)_96px_52px_180px_auto] items-center gap-4 border-b border-borda bg-superficie-alt px-5 py-3 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco lg:grid">
              <span>Produto</span>
              <span>30 dias</span>
              <span>Nota</span>
              <span className="text-right">Preço e comissão</span>
              <span className="text-right">Decisão</span>
            </div>

            {fila.map((oferta) => (
              <LinhaDeOferta key={oferta.id} oferta={oferta} canais={oferta.canais} />
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
      </Pagina>

      {detalhe && detalhe.status === "nova" && <PainelDaOferta oferta={detalhe} />}
    </>
  );
}

function LinhaDeOferta({ oferta, canais }: { oferta: Oferta; canais: Canal[] }) {
  // Aprovar com todos os canais no teto não é erro — a publicação
  // espera amanhã, porque o teto é combinado com o parceiro. Mas
  // precisa estar dito antes, senão o dono aprova achando que sai
  // hoje e descobre a diferença na hora de publicar.
  const vagas = canais.reduce((total, c) => total + Math.max(0, c.tetoDiario - c.publicadasHoje), 0);

  return (
    <article className="group relative grid grid-cols-1 gap-4 border-b border-borda-sutil px-5 py-3 last:border-0 hover:bg-superficie-alt lg:grid-cols-[minmax(150px,1fr)_96px_52px_180px_auto] lg:items-center">
      {/*
        A linha inteira abre o detalhe. É uma camada por cima, e não
        um <a> em volta de tudo, porque botão dentro de link é HTML
        inválido e quebra o teclado: o foco entra no link e nunca
        chega no "Aprovar".
      */}
      <Link
        href={`/aprovar?oferta=${oferta.id}`}
        aria-label={`Abrir o detalhe de ${oferta.produto}`}
        className="absolute inset-0"
      />

      {/* Produto: identidade, loja, nicho, série e os avisos que mudam a decisão. */}
      <div className="flex min-w-0 items-center gap-4">
        {/*
          A foto do produto não é enfeite — é metade do reconhecimento
          numa lista de trinta. Enquanto a coleta não trouxer imagem, a
          inicial sobre cor derivada do nome faz o mesmo trabalho: o
          mesmo produto tem sempre a mesma cor.
        */}
        <Identidade nome={oferta.produto} forma="caixa" tamanho="md" />

        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-base font-semibold tracking-titulo">{oferta.produto}</p>
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetaDeLoja
              nome={oferta.loja.nome}
              corTexto={oferta.loja.corTexto}
              corFundo={oferta.loja.corFundo}
            />
            <span className="text-xs text-texto-fraco">
              {oferta.nichoNome} · {oferta.diasDeSerie} dias de série ·{" "}
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
            {canais.length > 0 && vagas === 0 && (
              <span
                className="rounded-sm bg-info-fundo px-2 py-1 text-xs font-semibold text-info"
                title="Os canais elegíveis já usaram o teto de hoje. A publicação espera amanhã."
              >
                sai amanhã
              </span>
            )}
          </div>
        </div>
      </div>

      {/*
        A forma da série, do tamanho de um polegar. Cair depois de meses
        parado e cair depois de subir na semana passada são a mesma
        linha de texto ("34 dias de série") e decisões diferentes.
      */}
      <Sparkline
        serie={oferta.serie}
        referencia={oferta.precoReferenciaCentavos}
        rotulo={`Preço de ${oferta.produto} nos últimos ${Math.min(oferta.diasDeSerie, 30)} dias`}
      />

      <AnelDaNota oferta={oferta} />

      {/* Os três números que se leem juntos, num bloco só. */}
      <div className="flex flex-col items-start gap-1 leading-titulo lg:items-end">
        <div className="flex items-baseline gap-2">
          <span className="text-md font-bold tracking-titulo tabular-nums">
            {formataReais(oferta.precoAtualCentavos)}
          </span>
          <span className="text-xs text-texto-fraco line-through tabular-nums">
            {formataReais(oferta.precoReferenciaCentavos)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-marca-fundo px-2 py-1 text-xs font-bold text-marca-texto tabular-nums">
            −{oferta.descontoPct}%
          </span>
          <span
            className="text-sm font-semibold text-texto-fraco tabular-nums"
            title="Comissão estimada desta publicação"
          >
            {formataReais(oferta.comissaoEstimadaCentavos)}
          </span>
        </div>
      </div>

      {/*
        As ações ficam acima da camada de clique da linha (`relative
        z-10`), senão abrir o detalhe engoliria o "Aprovar" — que é o
        toque mais frequente da tela.
      */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 lg:justify-end">
        {/*
          O "Aprovar" só fica laranja na linha em que o cursor (ou o
          foco do teclado) está.

          Doze linhas × um botão cheio davam doze blocos laranja
          empilhados, formando uma faixa vertical que puxava o olho
          para a borda direita — longe do produto, que é o que se está
          decidindo. E a marca que aparece doze vezes na mesma tela não
          destaca nada: ela vira o fundo.

          O botão continua sempre visível e sempre clicável, inclusive
          no toque, onde não existe cursor. O que muda é só o peso.

          Em repouso ele NÃO fica igual ao "Rejeitar": leva o laranja
          em tinta — fundo claro da marca, texto escuro dela. Deixá-los
          idênticos até o cursor chegar tirava a hierarquia da tela
          inteira em quem só olha, e ler qual é o botão do "sim" não
          pode depender de passar o mouse.
        */}
        <form action={aprovaOferta}>
          <input type="hidden" name="oferta_id" value={oferta.id} />
          <Botao
            type="submit"
            variante="secundaria"
            tamanho="sm"
            disabled={canais.length === 0}
            className={
              canais.length === 0
                ? ""
                : "border-marca-borda bg-marca-fundo text-marca-texto group-hover:border-marca group-hover:bg-marca group-hover:text-white group-hover:shadow-marca group-focus-within:border-marca group-focus-within:bg-marca group-focus-within:text-white"
            }
          >
            Aprovar
          </Botao>
        </form>

        {/*
          Rejeitar custa o mesmo que aprovar: um toque abre a lista, o
          segundo decide. Fila em que dizer não custa mais que dizer sim
          produz curadoria que vira carimbo.
        */}
        <details className="relative">
          <summary className="inline-flex cursor-pointer list-none items-center rounded-md border border-borda-forte bg-superficie px-3 py-2 text-sm font-semibold text-texto-medio hover:bg-fundo">
            Rejeitar
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-borda-sutil bg-superficie p-3 shadow-modal">
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
          <Botao type="submit" variante="fantasma" tamanho="sm">
            Adiar
          </Botao>
        </form>
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
function AnelDaNota({ oferta }: { oferta: Oferta }) {
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
      <span className="absolute text-sm font-bold tabular-nums">{oferta.nota}</span>
    </span>
  );
}

function LinhaDecidida({ oferta }: { oferta: Oferta }) {
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
        <Botao type="submit" variante="fantasma" tamanho="sm">
          desfazer
        </Botao>
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
async function FilaVazia({ decididas }: { decididas: number }) {
  const cores = ["#1B76B8", "#F16A0D", "#9AA0AA"];
  const funil = await funilDeHoje();
  const maior = Math.max(...funil.map((f) => f.n), 1);

  return (
    <div className="flex max-w-3xl flex-col gap-5 rounded-lg border border-borda-sutil bg-superficie shadow-repouso p-8">
      <h2 className="text-xl font-extrabold tracking-titulo">
        {decididas > 0 ? "Fila zerada." : "Nenhuma oferta hoje."}
      </h2>

      {decididas > 0 ? (
        <p className="text-base text-texto-fraco">
          Você decidiu as {decididas} ofertas de hoje. As aprovadas estão esperando na fila de
          publicação.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {funil.map((etapa, i) => (
              <div
                key={etapa.rotulo}
                className="flex items-center gap-4 rounded-md border border-borda-sutil bg-superficie-alt px-4 py-3"
              >
                <span
                  className="w-14 text-right text-lg font-extrabold tabular-nums tracking-titulo"
                  style={{ color: cores[i] }}
                >
                  {etapa.n}
                </span>
                <span className="flex-1 text-base text-texto-fraco">{etapa.rotulo}</span>
                <span className="h-2 w-28 rounded-xs bg-preenchimento" aria-hidden>
                  <span
                    className="block h-2 rounded-xs"
                    style={{ width: `${Math.max(2, (etapa.n / maior) * 100)}%`, background: cores[i] }}
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
          className="self-start rounded-md bg-marca px-5 py-4 text-md font-bold text-white shadow-marca hover:bg-marca-hover"
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
