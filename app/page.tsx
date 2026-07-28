import { CabecalhoDaPagina } from "@/app/componentes/CabecalhoDaPagina";
import { FormularioAnuncio } from "@/app/componentes/FormularioAnuncio";
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

  const { anuncios, produtos, marketplaces, nichos, series, agora } = dados;

  const porProduto = new Map(produtos.map((p) => [p.id, p]));
  const porMarketplace = new Map(marketplaces.map((m) => [m.id, m]));
  const porAnuncio = new Map(series.map((s) => [s.anuncio_id, s]));

  const ativos = anuncios.filter((a) => a.ativo);
  const comMetaDeSerie = ativos.filter(
    (a) => (porAnuncio.get(a.id)?.dias_de_serie ?? 0) >= META_DIAS_DE_SERIE,
  ).length;

  const parados = ativos.filter((a) => diasDesde(a.ultima_coleta_em, agora) >= DIAS_PARA_ALERTA);

  return (
    <>
      <CabecalhoDaPagina
        trilha="Catálogo"
        titulo="Anúncios monitorados"
        subtitulo="Fase 1 · radar silencioso. Nenhum grupo ainda — o objetivo aqui é acumular série de preço antes de precisar dela."
      />

      <div className="flex w-full max-w-5xl flex-col gap-8 px-6 pt-5 pb-10">
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

      <section className="rounded-lg border border-borda bg-superficie p-5">
        <h2 className="mb-1 text-lg font-bold tracking-titulo">Cadastrar anúncio</h2>
        <p className="mb-5 text-base text-texto-fraco">
          Título e preço são digitados à mão por enquanto. Buscar isso sozinho na página depende dos
          termos de cada marketplace, e essa decisão ainda está em aberto.
        </p>
        <FormularioAnuncio nichos={nichos.map((n) => ({ id: n.id, nome: n.nome }))} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-titulo">
          Anúncios monitorados{" "}
          <span className="text-sm font-normal text-texto-fraco">({anuncios.length})</span>
        </h2>

        {anuncios.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda-forte p-8 text-center text-base text-texto-fraco">
            Nenhum anúncio ainda. Cole o primeiro link acima.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <table className="w-full text-left text-base">
              <thead className="border-b border-borda bg-superficie-alt text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Loja</th>
                  <th className="px-4 py-3">Série</th>
                  <th className="px-4 py-3">Menor / Mediana</th>
                  <th className="px-4 py-3">Última coleta</th>
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
                    <tr key={anuncio.id} className="border-b border-borda-sutil last:border-0">
                      <td className="px-4 py-3">
                        <a
                          href={anuncio.url_original}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-borda-forte underline-offset-2"
                        >
                          {produto?.titulo_canonico ?? "—"}
                        </a>
                        <span className="ml-2 font-mono text-xs text-texto-fraco">
                          {anuncio.sku_externo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {marketplace?.nome ?? "—"}
                        {marketplace && !marketplace.base_de_historico && (
                          // Amazon: a política limita a retenção de preço a 24h,
                          // então esta linha nunca vai acumular série.
                          <span
                            className="ml-1 text-xs text-texto-fraco"
                            title="Não forma série histórica: a política da loja limita a retenção de preço."
                          >
                            (sem histórico)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {marketplace?.base_de_historico === false ? (
                          <span className="text-texto-fraco">—</span>
                        ) : (
                          <span className={dias >= META_DIAS_DE_SERIE ? "text-sucesso" : ""}>
                            {dias} {dias === 1 ? "dia" : "dias"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        {serie?.menor_preco_centavos != null
                          ? `${formataReais(serie.menor_preco_centavos)} / ${formataReais(
                              serie.mediana_preco_centavos ?? serie.menor_preco_centavos,
                            )}`
                          : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 ${
                          atraso >= DIAS_PARA_ALERTA ? "text-perigo" : "text-texto-fraco"
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
      </div>
    </>
  );
}

async function buscaDados() {
  const db = supabaseServidor();

  const [anuncios, produtos, marketplaces, nichos, series] = await Promise.all([
    db.from("anuncio").select("*").order("criado_em", { ascending: false }),
    db.from("produto").select("*"),
    db.from("marketplace").select("*"),
    db.from("nicho").select("*").eq("ativo", true).order("nome"),
    db.from("anuncio_serie").select("*"),
  ]);

  const falha = [anuncios, produtos, marketplaces, nichos, series].find((r) => r.error);
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
    nichos: (nichos.data ?? []) as NichoLinha[],
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
    <div className="rounded-lg border border-borda bg-superficie p-4">
      <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">{rotulo}</p>
      <p className={`font-mono text-2xl font-extrabold tabular-nums tracking-titulo ${atingido ? "text-sucesso" : ""}`}>
        {valor}
      </p>
      <p className="text-xs text-texto-fraco">{detalhe}</p>
    </div>
  );
}

/**
 * Tela de erro amigável. O painel roda na máquina do dono, que não
 * é desenvolvedor — despejar stack trace aqui não ajuda ninguém.
 */
function AvisoDeConfiguracao({ mensagem }: { mensagem: string }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-extrabold tracking-titulo">Falta configurar</h1>
      <p className="rounded-lg border border-atencao-borda bg-atencao-fundo p-4 text-sm">{mensagem}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-texto-medio">
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
      <p className="text-base text-texto-fraco">Passo a passo completo em docs/ambiente.md.</p>
    </div>
  );
}
