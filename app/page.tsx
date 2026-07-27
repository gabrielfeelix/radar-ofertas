import { FormularioAnuncio } from "@/app/componentes/FormularioAnuncio";
import { formataReais } from "@/lib/dinheiro";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type {
  AnuncioLinha,
  AnuncioSerieLinha,
  MarketplaceLinha,
  ProdutoLinha,
} from "@/lib/supabase/tipos";

/**
 * Painel da Fase 1 — radar silencioso.
 *
 * A Fase 1 tem uma meta só: chegar a 150 anúncios com 21 dias de
 * série contínua. Então esta tela responde exatamente duas
 * perguntas, e nenhuma outra:
 *
 *   1. Quanto falta para a meta?
 *   2. Qual anúncio parou de coletar?
 *
 * Nada de gráfico, nota de oferta ou fila de publicação. Isso é
 * Fase 2 em diante (docs/roadmap.md).
 */

// Painel de operação: sempre o estado atual do banco, nunca cache.
export const dynamic = "force-dynamic";

const META_ANUNCIOS = 150;
const META_DIAS_DE_SERIE = 21;

/** Dias sem coleta a partir dos quais o anúncio é considerado parado. */
const DIAS_PARA_ALERTA = 2;

export default async function Painel() {
  let dados: Awaited<ReturnType<typeof buscaDados>>;

  try {
    dados = await buscaDados();
  } catch (erro) {
    return <AvisoDeConfiguracao mensagem={(erro as Error).message} />;
  }

  const { anuncios, produtos, marketplaces, series, agora } = dados;

  const porProduto = new Map(produtos.map((p) => [p.id, p]));
  const porMarketplace = new Map(marketplaces.map((m) => [m.id, m]));
  const porAnuncio = new Map(series.map((s) => [s.anuncio_id, s]));

  const ativos = anuncios.filter((a) => a.ativo);
  const comMetaDeSerie = ativos.filter(
    (a) => (porAnuncio.get(a.id)?.dias_de_serie ?? 0) >= META_DIAS_DE_SERIE,
  ).length;

  const parados = ativos.filter((a) => diasDesde(a.ultima_coleta_em, agora) >= DIAS_PARA_ALERTA);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Radar de Ofertas</h1>
        <p className="text-sm text-neutral-500">
          Fase 1 · radar silencioso. Nenhum grupo ainda — o objetivo aqui é acumular série de preço
          antes de precisar dela.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Indicador
          rotulo="Anúncios ativos"
          valor={`${ativos.length}`}
          detalhe={`meta ${META_ANUNCIOS}`}
          atingido={ativos.length >= META_ANUNCIOS}
        />
        <Indicador
          rotulo={`Com ${META_DIAS_DE_SERIE}+ dias de série`}
          valor={`${comMetaDeSerie}`}
          detalhe={`meta ${META_ANUNCIOS}`}
          atingido={comMetaDeSerie >= META_ANUNCIOS}
        />
        <Indicador
          rotulo="Parados"
          valor={`${parados.length}`}
          detalhe={`sem coleta há ${DIAS_PARA_ALERTA}+ dias`}
          atingido={parados.length === 0}
        />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-medium">Cadastrar anúncio</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Título e preço são digitados à mão por enquanto. Buscar isso sozinho na página depende dos
          termos de cada marketplace, e essa decisão ainda está em aberto.
        </p>
        <FormularioAnuncio />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Anúncios monitorados{" "}
          <span className="text-sm font-normal text-neutral-500">({anuncios.length})</span>
        </h2>

        {anuncios.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            Nenhum anúncio ainda. Cole o primeiro link acima.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Loja</th>
                  <th className="px-3 py-2 font-medium">Série</th>
                  <th className="px-3 py-2 font-medium">Menor / Mediana</th>
                  <th className="px-3 py-2 font-medium">Última coleta</th>
                </tr>
              </thead>
              <tbody>
                {anuncios.map((anuncio) => {
                  const produto = porProduto.get(anuncio.produto_id);
                  const marketplace = porMarketplace.get(anuncio.marketplace_id);
                  const serie = porAnuncio.get(anuncio.id);
                  const dias = serie?.dias_de_serie ?? 0;
                  const atraso = diasDesde(anuncio.ultima_coleta_em, agora);

                  return (
                    <tr key={anuncio.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-3 py-2">
                        <a
                          href={anuncio.url_original}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-neutral-300 underline-offset-2"
                        >
                          {produto?.titulo_canonico ?? "—"}
                        </a>
                        <span className="ml-2 font-mono text-xs text-neutral-400">
                          {anuncio.sku_externo}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {marketplace?.nome ?? "—"}
                        {marketplace && !marketplace.base_de_historico && (
                          // Amazon: a política limita a retenção de preço a 24h,
                          // então esta linha nunca vai acumular série.
                          <span
                            className="ml-1 text-xs text-neutral-400"
                            title="Não forma série histórica: a política da loja limita a retenção de preço."
                          >
                            (sem histórico)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {marketplace?.base_de_historico === false ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <span className={dias >= META_DIAS_DE_SERIE ? "text-green-700" : ""}>
                            {dias} {dias === 1 ? "dia" : "dias"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {serie?.menor_preco_centavos != null
                          ? `${formataReais(serie.menor_preco_centavos)} / ${formataReais(
                              serie.mediana_preco_centavos ?? serie.menor_preco_centavos,
                            )}`
                          : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 ${
                          atraso >= DIAS_PARA_ALERTA ? "text-red-700" : "text-neutral-500"
                        }`}
                      >
                        {descreveAtraso(anuncio.ultima_coleta_em, agora)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

async function buscaDados() {
  const db = supabaseServidor();

  const [anuncios, produtos, marketplaces, series] = await Promise.all([
    db.from("anuncio").select("*").order("criado_em", { ascending: false }),
    db.from("produto").select("*"),
    db.from("marketplace").select("*"),
    db.from("anuncio_serie").select("*"),
  ]);

  const falha = [anuncios, produtos, marketplaces, series].find((r) => r.error);
  if (falha?.error) {
    throw new Error(
      `O banco respondeu com erro: ${falha.error.message}. ` +
        `Se as tabelas ainda não existem, rode "pnpm db:reset" para aplicar as migrations.`,
    );
  }

  return {
    anuncios: (anuncios.data ?? []) as AnuncioLinha[],
    produtos: (produtos.data ?? []) as ProdutoLinha[],
    marketplaces: (marketplaces.data ?? []) as MarketplaceLinha[],
    series: (series.data ?? []) as AnuncioSerieLinha[],
    // Lido aqui, e não durante a renderização: o relógio é impuro
    // e o componente precisa ser previsível a cada render.
    agora: Date.now(),
  };
}

/** Dias inteiros desde a última coleta. Nunca coletado conta como infinito. */
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

function Indicador({
  rotulo,
  valor,
  detalhe,
  atingido,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  atingido: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{rotulo}</p>
      <p className={`text-2xl font-semibold tabular-nums ${atingido ? "text-green-700" : ""}`}>
        {valor}
      </p>
      <p className="text-xs text-neutral-400">{detalhe}</p>
    </div>
  );
}

/**
 * Tela de erro amigável. O painel roda na máquina do dono, que não
 * é desenvolvedor — despejar stack trace aqui não ajuda ninguém.
 */
function AvisoDeConfiguracao({ mensagem }: { mensagem: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Falta configurar</h1>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">{mensagem}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-600">
        <li>
          <code className="font-mono">pnpm db:sobe</code> — sobe o banco local em Docker
        </li>
        <li>
          <code className="font-mono">pnpm db:status</code> — mostra a URL e as chaves locais
        </li>
        <li>
          Copie esses valores para o arquivo <code className="font-mono">.env</code>
        </li>
      </ol>
      <p className="text-sm text-neutral-500">Passo a passo completo em docs/ambiente.md.</p>
    </main>
  );
}
