import { Identidade } from "@/app/componentes/Identidade";
import Link from "next/link";

import { FormularioAnuncio } from "@/app/componentes/FormularioAnuncio";
import { Modal } from "@/app/componentes/Modal";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { EtiquetaDeLoja } from "@/app/componentes/Chip";
import { formataReais } from "@/lib/dinheiro";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type {
  AnuncioLinha,
  AnuncioSerieLinha,
  MarketplaceLinha,
  NichoLinha,
  ProdutoLinha,
} from "@/lib/supabase/tipos";

/**
 * Catálogo — o que o sistema está monitorando.
 *
 * O catálogo é o ativo do projeto: a série histórica leva meses para
 * se formar, **não pode ser refeita**, e é ela que sustenta a tese de
 * que o desconto é real. Perder o catálogo é perder o produto.
 *
 * DUAS COISAS QUE A TELA PRECISA MANTER SEPARADAS, e que quase toda
 * ferramenta parecida achata:
 *
 * **Produto** é a identidade da coisa. **Anúncio** é essa coisa numa
 * loja. O mesmo tapete na Shopee, no Mercado Livre e na Amazon é um
 * produto com três anúncios, três preços e três séries. Achatar isso
 * duplica o catálogo e torna a nota da oferta impossível de calcular.
 *
 * Por isso o grão é uma alternância, e não duas telas: é a mesma
 * pergunta — "o que estamos monitorando?" — vista de dois jeitos. A
 * visão por anúncio existe para uma finalidade operacional só:
 * encontrar depressa o que parou de coletar.
 *
 * A BUSCA É DA FASE 1, e não da 2 como estava planejado. Com a
 * colheita ligada, o catálogo nasce com milhares de itens de título
 * ruim vindo de canal alheio — sem busca, a tela vira uma lista que
 * ninguém consegue usar já na primeira semana.
 */

export const dynamic = "force-dynamic";

type Grao = "produto" | "anuncio";

/** Dias sem coleta a partir dos quais o anúncio é considerado parado. */
const DIAS_PARA_ALERTA = 2;

export default async function Produtos({
  searchParams,
}: {
  searchParams: Promise<{ grao?: string; nicho?: string; q?: string }>;
}) {
  const { grao: graoBruto, nicho: nichoFiltro, q } = await searchParams;
  const grao: Grao = graoBruto === "anuncio" ? "anuncio" : "produto";
  const busca = (q ?? "").trim();

  let dados: Awaited<ReturnType<typeof buscaDados>>;
  try {
    dados = await buscaDados();
  } catch (erro) {
    return <AvisoDeConfiguracao mensagem={(erro as Error).message} />;
  }

  const { produtos, anuncios, marketplaces, nichos, series, agora } = dados;

  const porNicho = new Map(nichos.map((n) => [n.id, n]));
  const porMarketplace = new Map(marketplaces.map((m) => [m.id, m]));
  const porProduto = new Map(produtos.map((p) => [p.id, p]));
  const serieDoAnuncio = new Map(series.map((s) => [s.anuncio_id, s]));

  const anunciosDoProduto = new Map<string, AnuncioLinha[]>();
  for (const anuncio of anuncios) {
    const lista = anunciosDoProduto.get(anuncio.produto_id) ?? [];
    lista.push(anuncio);
    anunciosDoProduto.set(anuncio.produto_id, lista);
  }

  const filtrados = produtos.filter((produto) => {
    if (nichoFiltro === "sem" && produto.nicho_id !== null) return false;
    if (nichoFiltro && nichoFiltro !== "sem" && produto.nicho_id !== nichoFiltro) return false;
    if (busca && !produto.titulo_canonico.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const anunciosFiltrados = anuncios.filter((anuncio) => {
    const produto = porProduto.get(anuncio.produto_id);
    if (!produto) return false;
    if (nichoFiltro === "sem" && produto.nicho_id !== null) return false;
    if (nichoFiltro && nichoFiltro !== "sem" && produto.nicho_id !== nichoFiltro) return false;
    if (busca && !produto.titulo_canonico.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  // Filtro é nicho OU busca. Sem nenhum dos dois, uma lista vazia quer
  // dizer "o catálogo está vazio", que é outra conversa.
  const filtrado = Boolean(nichoFiltro) || busca !== "";

  const semNicho = produtos.filter((p) => p.nicho_id === null).length;
  const parados = anuncios.filter(
    (a) => a.ativo && diasDesde(a.ultima_coleta_em, agora) >= DIAS_PARA_ALERTA,
  ).length;

  return (
    <>
      <Pagina
        trilha="Catálogo"
        titulo="Produtos"
        subtitulo="O que está no radar. A série de preço leva meses para se formar e não pode ser refeita — este catálogo é o ativo do projeto."
        acoes={
          <>
            {/*
              Cadastrar por link é botão, não item de menu: com a
              colheita ligada, ele deixou de ser o caminho principal de
              entrada do catálogo e virou a exceção — o produto que você
              viu e quer acompanhar agora.
            */}
            <Modal
              rotuloDoGatilho="Cadastrar por link"
              titulo="Cadastrar por link"
              largura="larga"
              descricao="Quando você viu um produto e quer acompanhar. Título e preço são digitados à mão — buscar isso sozinho na página depende dos termos de cada marketplace, e essa decisão ainda está em aberto."
            >
              <FormularioAnuncio nichos={nichos.map((n) => ({ id: n.id, nome: n.nome }))} />
            </Modal>
          <div className="flex items-center gap-1 rounded-md border border-borda bg-superficie p-1">
            <span className="px-2 text-xs text-texto-fraco">ver por</span>
            <Aba href={comFiltros("/produtos", { nicho: nichoFiltro, q: busca })} rotulo="Produto" ativo={grao === "produto"} />
            <Aba
              href={comFiltros("/produtos", { grao: "anuncio", nicho: nichoFiltro, q: busca })}
              rotulo="Anúncio"
              ativo={grao === "anuncio"}
            />
          </div>
          </>
        }
        kpis={[
        { rotulo: "Produtos", valor: `${produtos.length}`, nota: `${anuncios.length} anúncios` },
        {
          rotulo: "Sem nicho",
          valor: `${semNicho}`,
          nota: semNicho > 0 ? "não chegam a canal nenhum" : "todos roteáveis",
          cor: semNicho > 0 ? "text-atencao" : "text-sucesso",
        },
        {
          rotulo: "Parados",
          valor: `${parados}`,
          nota: `sem coleta há ${DIAS_PARA_ALERTA}+ dias`,
          cor: parados > 0 ? "text-perigo" : "text-sucesso",
        },
      ]}
        medida="larga"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Chip href={comFiltros("/produtos", { grao, q: busca })} rotulo="todos" ativo={!nichoFiltro} />
          {nichos.map((nicho) => (
            <Chip
              key={nicho.id}
              href={comFiltros("/produtos", { grao, nicho: nicho.id, q: busca })}
              rotulo={nicho.nome}
              ativo={nichoFiltro === nicho.id}
            />
          ))}
          {semNicho > 0 && (
            <Chip
              href={comFiltros("/produtos", { grao, nicho: "sem", q: busca })}
              rotulo={`sem nicho · ${semNicho}`}
              ativo={nichoFiltro === "sem"}
              alerta
            />
          )}

          {/*
            Busca por formulário, sem JavaScript: ela sobrevive a
            recarregar e o endereço pode ser guardado. O campo do topo
            aponta para cá pelo mesmo motivo.
          */}
          <form action="/produtos" className="ml-auto flex items-center gap-2">
            {grao === "anuncio" && <input type="hidden" name="grao" value="anuncio" />}
            {nichoFiltro && <input type="hidden" name="nicho" value={nichoFiltro} />}
            <input
              type="search"
              name="q"
              defaultValue={busca}
              placeholder="Buscar no catálogo"
              className="w-56 rounded-md border border-borda-forte bg-superficie px-4 py-2 text-base"
            />
          </form>
        </div>

        {busca && (
          <p className="text-sm text-texto-fraco">
            {(grao === "produto" ? filtrados.length : anunciosFiltrados.length)} resultado(s) para{" "}
            <strong className="text-texto">{busca}</strong>.{" "}
            <Link href={comFiltros("/produtos", { grao, nicho: nichoFiltro })} className="font-semibold text-marca-texto">
              limpar
            </Link>
          </p>
        )}

        {grao === "produto" ? (
          <TabelaDeProdutos
            filtrado={filtrado}
            produtos={filtrados}
            anunciosDoProduto={anunciosDoProduto}
            serieDoAnuncio={serieDoAnuncio}
            porNicho={porNicho}
            porMarketplace={porMarketplace}
          />
        ) : (
          <TabelaDeAnuncios
            filtrado={filtrado}
            anuncios={anunciosFiltrados}
            porProduto={porProduto}
            porMarketplace={porMarketplace}
            serieDoAnuncio={serieDoAnuncio}
            agora={agora}
          />
        )}

      </Pagina>
    </>
  );
}

function TabelaDeProdutos({
  filtrado,
  produtos,
  anunciosDoProduto,
  serieDoAnuncio,
  porNicho,
  porMarketplace,
}: {
  filtrado: boolean;
  produtos: ProdutoLinha[];
  anunciosDoProduto: Map<string, AnuncioLinha[]>;
  serieDoAnuncio: Map<string, AnuncioSerieLinha>;
  porNicho: Map<string, NichoLinha>;
  porMarketplace: Map<string, MarketplaceLinha>;
}) {
  if (produtos.length === 0) {
    // Catálogo vazio e busca sem resultado são a mesma tela e coisas
    // diferentes: uma diz "ainda não começou", a outra "procure outra
    // palavra". Dizer "nenhum produto com esse filtro" sem filtro
    // nenhum faz o dono procurar um filtro que não existe.
    return <Vazio filtrado={filtrado} />;
  }

  return (
    <div className="rounded-lg border border-borda bg-superficie">
      <div className="hidden grid-cols-[minmax(180px,1fr)_130px_90px_120px_100px] items-center gap-4 border-b border-borda bg-superficie-alt px-5 py-3 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco lg:grid">
        <span>Produto</span>
        <span>Nicho</span>
        <span>Lojas</span>
        <span>Menor observado</span>
        <span>Série</span>
      </div>

      {produtos.map((produto) => {
        const anuncios = anunciosDoProduto.get(produto.id) ?? [];
        const series = anuncios
          .map((a) => serieDoAnuncio.get(a.id))
          .filter((s): s is AnuncioSerieLinha => s !== undefined);

        const menor = series
          .map((s) => s.menor_preco_centavos)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b)[0];

        const dias = Math.max(0, ...series.map((s) => s.dias_de_serie ?? 0));
        const nicho = produto.nicho_id ? porNicho.get(produto.nicho_id) : undefined;

        return (
          <Link
            key={produto.id}
            href={`/produtos/${produto.id}`}
            className="grid grid-cols-1 gap-3 border-b border-borda-sutil px-5 py-3 last:border-0 hover:bg-superficie-alt lg:grid-cols-[minmax(180px,1fr)_130px_90px_120px_100px] lg:items-center"
          >
            <span className="flex min-w-0 items-center gap-4">
              <Identidade nome={produto.titulo_canonico} forma="caixa" tamanho="md" />
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold">
                  {produto.titulo_canonico}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  {anuncios.length === 0 ? (
                    <span className="text-xs text-texto-fraco">sem anúncio</span>
                  ) : (
                    anuncios.map((a) => {
                      const loja = porMarketplace.get(a.marketplace_id);
                      return (
                        <EtiquetaDeLoja
                          key={a.id}
                          nome={loja?.nome ?? "—"}
                          corTexto={loja?.cor_texto}
                          corFundo={loja?.cor_fundo}
                        />
                      );
                    })
                  )}
                </span>
              </span>
            </span>

            <span>
              {nicho ? (
                <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-bold text-texto-medio">
                  {nicho.nome}
                </span>
              ) : (
                <span
                  className="rounded-sm bg-atencao-fundo px-2 py-1 text-xs font-bold text-atencao"
                  title="Produto sem nicho não chega a canal nenhum."
                >
                  sem nicho
                </span>
              )}
            </span>

            <span className="text-base text-texto-medio">
              {anuncios.length} {anuncios.length === 1 ? "loja" : "lojas"}
            </span>

            <span className="text-base font-bold tabular-nums">
              {menor != null ? formataReais(menor) : "—"}
            </span>

            <span
              className={`text-base font-semibold ${dias >= 14 ? "text-sucesso" : "text-texto-fraco"}`}
            >
              {dias > 0 ? `${dias} ${dias === 1 ? "dia" : "dias"}` : "sem série"}
            </span>
          </Link>
        );
      })}

      <p className="px-5 py-3 text-sm text-texto-fraco">
        Produto e anúncio são coisas diferentes: o mesmo tapete na Shopee, no Mercado Livre e na
        Amazon é <strong className="text-texto-medio">um</strong> produto com{" "}
        <strong className="text-texto-medio">três</strong> anúncios.
      </p>
    </div>
  );
}

function TabelaDeAnuncios({
  filtrado,
  anuncios,
  porProduto,
  porMarketplace,
  serieDoAnuncio,
  agora,
}: {
  filtrado: boolean;
  anuncios: AnuncioLinha[];
  porProduto: Map<string, ProdutoLinha>;
  porMarketplace: Map<string, MarketplaceLinha>;
  serieDoAnuncio: Map<string, AnuncioSerieLinha>;
  agora: number;
}) {
  if (anuncios.length === 0) {
    return <Vazio filtrado={filtrado} anuncio />;
  }

  // Ordenado pela última coleta: a pergunta desta visão é operacional
  // — "o que parou?" — e o que parou é o mais antigo.
  const ordenados = [...anuncios].sort(
    (a, b) => diasDesde(b.ultima_coleta_em, agora) - diasDesde(a.ultima_coleta_em, agora),
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
      <table className="w-full min-w-3xl text-left text-base">
        <thead className="border-b border-borda bg-superficie-alt text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
          <tr>
            <th className="px-5 py-3">Anúncio</th>
            <th className="px-5 py-3">Loja</th>
            <th className="px-5 py-3 text-right">Série</th>
            <th className="px-5 py-3 text-right">Menor</th>
            <th className="px-5 py-3 text-right">Mediana</th>
            <th className="px-5 py-3">Última coleta</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((anuncio) => {
            const produto = porProduto.get(anuncio.produto_id);
            const loja = porMarketplace.get(anuncio.marketplace_id);
            const serie = serieDoAnuncio.get(anuncio.id);
            const atraso = diasDesde(anuncio.ultima_coleta_em, agora);
            const semHistorico = loja?.base_de_historico === false;

            return (
              <tr key={anuncio.id} className="border-b border-borda-sutil last:border-0">
                <td className="px-5 py-3">
                  <Link
                    href={`/produtos/${anuncio.produto_id}`}
                    className="block max-w-sm truncate font-semibold hover:text-marca-texto"
                  >
                    {produto?.titulo_canonico ?? "—"}
                  </Link>
                  <span className="font-mono text-xs text-texto-fraco">{anuncio.sku_externo}</span>
                </td>
                <td className="px-5 py-3">
                  <EtiquetaDeLoja
                    nome={loja?.nome ?? "—"}
                    corTexto={loja?.cor_texto}
                    corFundo={loja?.cor_fundo}
                  />
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {/*
                    Amazon nunca acumula série: a política de associados
                    limita a retenção de preço a 24 horas. A tela diz
                    isso, em vez de mostrar vazio que parece defeito.
                  */}
                  {semHistorico ? (
                    <span className="text-xs text-texto-fraco">sem histórico</span>
                  ) : (
                    `${serie?.dias_de_serie ?? 0}d`
                  )}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {serie?.menor_preco_centavos != null
                    ? formataReais(serie.menor_preco_centavos)
                    : "—"}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-texto-medio">
                  {serie?.mediana_preco_centavos != null
                    ? formataReais(serie.mediana_preco_centavos)
                    : "—"}
                </td>
                <td
                  className={`px-5 py-3 ${atraso >= DIAS_PARA_ALERTA ? "text-perigo" : "text-texto-medio"}`}
                >
                  {descreveAtraso(anuncio.ultima_coleta_em, agora)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-borda-sutil px-5 py-3 text-sm text-texto-fraco">
        Ordenado pela última coleta — a pergunta desta visão é &ldquo;o que parou de coletar?&rdquo;.
      </p>
    </div>
  );
}

async function buscaDados() {
  const db = supabaseServidor();

  const [produtos, anuncios, marketplaces, nichos, series] = await Promise.all([
    db.from("produto").select("*").order("criado_em", { ascending: false }),
    db.from("anuncio").select("*"),
    db.from("marketplace").select("*"),
    db.from("nicho").select("*").eq("ativo", true).order("nome"),
    db.from("anuncio_serie").select("*"),
  ]);

  const falha = [produtos, anuncios, marketplaces, nichos, series].find((r) => r.error);
  if (falha?.error) {
    throw new Error(
      `O banco respondeu com erro: ${falha.error.message}. ` +
        `Se as tabelas ainda não existem, rode "pnpm db:reset" para aplicar as migrations.`,
    );
  }

  return {
    produtos: (produtos.data ?? []) as ProdutoLinha[],
    anuncios: (anuncios.data ?? []) as AnuncioLinha[],
    marketplaces: (marketplaces.data ?? []) as MarketplaceLinha[],
    nichos: (nichos.data ?? []) as NichoLinha[],
    series: (series.data ?? []) as AnuncioSerieLinha[],
    agora: Date.now(),
  };
}

function comFiltros(
  base: string,
  filtros: { grao?: string; nicho?: string; q?: string },
): string {
  const parametros = new URLSearchParams();
  if (filtros.grao === "anuncio") parametros.set("grao", "anuncio");
  if (filtros.nicho) parametros.set("nicho", filtros.nicho);
  if (filtros.q) parametros.set("q", filtros.q);

  const consulta = parametros.toString();
  return consulta ? `${base}?${consulta}` : base;
}

function diasDesde(quando: string | null, agora: number): number {
  if (!quando) return Number.POSITIVE_INFINITY;
  return Math.floor((agora - new Date(quando).getTime()) / 86_400_000);
}

function descreveAtraso(quando: string | null, agora: number): string {
  if (!quando) return "nunca";
  const dias = diasDesde(quando, agora);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
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

function Chip({
  href,
  rotulo,
  ativo,
  alerta,
}: {
  href: string;
  rotulo: string;
  ativo: boolean;
  alerta?: boolean;
}) {
  const cor = alerta
    ? "border-atencao-borda bg-atencao-fundo text-atencao"
    : "border-marca-borda bg-marca-fundo text-marca-texto";

  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-md border px-4 py-2 text-base font-semibold ${
        ativo ? cor : "border-borda bg-superficie text-texto-medio hover:bg-superficie-alt"
      }`}
    >
      {rotulo}
    </Link>
  );
}

function AvisoDeConfiguracao({ mensagem }: { mensagem: string }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6">
      <h1 className="text-xl font-bold tracking-titulo">Falta configurar</h1>
      <p className="rounded-lg border border-atencao-borda bg-atencao-fundo p-5 text-base">
        {mensagem}
      </p>
      <p className="text-base text-texto-fraco">Passo a passo completo em docs/ambiente.md.</p>
    </div>
  );
}

/**
 * O vazio do catálogo, com a diferença que importa.
 *
 * Sem filtro, o catálogo está começando e o caminho é ligar fonte de
 * colheita ou cadastrar por link. Com filtro, o catálogo tem coisa e a
 * busca é que não achou — e aí o caminho é limpar o filtro.
 */
function Vazio({ filtrado, anuncio = false }: { filtrado: boolean; anuncio?: boolean }) {
  const coisa = anuncio ? "anúncio" : "produto";

  return (
    <div className="rounded-lg border border-dashed border-borda-forte p-8 text-center">
      {filtrado ? (
        <>
          <p className="text-md font-bold tracking-titulo">Nada com esse filtro.</p>
          <p className="mx-auto mt-2 max-w-md text-base text-texto-fraco">
            O catálogo tem {coisa}, mas nenhum casa com o que você pediu.
          </p>
          <Link
            href="/produtos"
            className="mt-5 inline-block rounded-md border border-borda-forte bg-superficie px-5 py-3 text-base font-bold text-texto-medio hover:bg-fundo"
          >
            Limpar filtros
          </Link>
        </>
      ) : (
        <>
          <p className="text-md font-bold tracking-titulo">O catálogo está vazio.</p>
          <p className="mx-auto mt-2 max-w-md text-base leading-longo text-texto-fraco">
            A série de preço leva semanas para se formar, então quanto antes entrar produto, antes
            existe oferta. A colheita enche sozinha toda madrugada — falta ligar a primeira fonte.
          </p>
          <Link
            href="/colheita/fontes"
            className="mt-5 inline-block rounded-md bg-marca px-5 py-3 text-base font-bold text-white shadow-marca hover:bg-marca-hover"
          >
            Ligar uma fonte de colheita
          </Link>
        </>
      )}
    </div>
  );
}
