import Link from "next/link";

import { alternaFonteAtiva, defineNichoDaFonte } from "@/app/acoes/fontes";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { FormularioFonte } from "@/app/componentes/FormularioFonte";
import { enderecoPublico } from "@/lib/canais";
import { formataReais } from "@/lib/dinheiro";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type {
  AnuncioLinha,
  AnuncioSerieLinha,
  MencaoLinha,
  NichoLinha,
  ProdutoLinha,
  RendimentoDaFonteLinha,
} from "@/lib/supabase/tipos";

/**
 * Fontes de colheita.
 *
 * A tela responde uma pergunta só: **qual canal vale a leitura.**
 *
 * Um canal que traz 300 links por dia e nenhum anúncio novo é ruído
 * caro — gasta requisição, enche a fila de menção com problema e não
 * acrescenta catálogo. Sem esta tela isso ficaria invisível, porque
 * a colheita não reclama de nada: ela simplesmente rende pouco.
 *
 * A segunda seção, preço alegado × observado, existe para flagrar
 * canal que mente. Ela não tem consumidor automático de propósito:
 * o que fazer com um canal que exagera preço é decisão de pessoa.
 */

export const dynamic = "force-dynamic";

/** Menções recentes com preço alegado que a comparação considera. */
const COMPARACOES_EXIBIDAS = 40;

export default async function Fontes() {
  let dados: Awaited<ReturnType<typeof buscaDados>>;

  try {
    dados = await buscaDados();
  } catch (erro) {
    return <AvisoDeConfiguracao mensagem={(erro as Error).message} />;
  }

  const { fontes, nichos, comparacoes } = dados;

  const ativas = fontes.filter((f) => f.ativo);
  const mencoes = soma(fontes, (f) => f.mencoes);
  const novos = soma(fontes, (f) => f.anuncios_novos);
  const descartadas = soma(fontes, (f) => f.descartadas);

  return (
    <>
      <Pagina
        trilha="Catálogo"
        titulo="Fontes de colheita"
        subtitulo="Canais de terceiros que lemos em busca de candidatas. Nunca publicamos nada neles, e o preço que eles alegam nunca entra na nossa série — quem decide se está barato é o motor, pelas mesmas comportas de qualquer anúncio."
        kpis={[
        { rotulo: "Canais lendo", valor: `${ativas.length}`, nota: `${fontes.length} cadastrados` },
        { rotulo: "Menções", valor: `${mencoes}`, nota: "links avistados" },
        { rotulo: "Anúncios novos", valor: `${novos}`, nota: "entraram no catálogo" },
        {
          rotulo: "Descartadas",
          valor: `${descartadas}`,
          nota: mencoes > 0 ? `${Math.round((descartadas / mencoes) * 100)}% do total` : "—",
          cor: descartadas > 0 ? "text-atencao" : undefined,
        },
      ]}
        medida="larga"
      >
      <section>
        <h2 className="mb-4 text-lg font-bold tracking-titulo">Rendimento por canal</h2>

        {fontes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda-forte p-8 text-center text-base text-texto-fraco">
            Nenhum canal ainda. Adicione o primeiro abaixo — a colheita da madrugada já lê.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <table className="w-full text-left text-base">
              <thead className="border-b border-borda bg-superficie-alt text-xs font-semibold uppercase tracking-eyebrow text-texto-fraco">
                <tr>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Nicho herdado</th>
                  <th className="px-4 py-3 text-right">Menções</th>
                  <th className="px-4 py-3 text-right">Novos</th>
                  <th className="px-4 py-3 text-right">Conhecidos</th>
                  <th className="px-4 py-3 text-right">Descartadas</th>
                  <th className="px-4 py-3">Última leitura</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {fontes.map((fonte) => (
                  <tr
                    key={fonte.fonte_id}
                    className={`border-b border-borda-sutil last:border-0 ${
                      fonte.ativo ? "" : "bg-superficie-alt"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <a
                        href={enderecoPublico(fonte.identificador)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline decoration-borda-forte underline-offset-2"
                      >
                        @{fonte.identificador}
                      </a>
                      {fonte.nome && (
                        <span className="ml-2 text-sm text-texto-fraco">{fonte.nome}</span>
                      )}
                      {!fonte.ativo && (
                        <span className="ml-2 rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-medio">
                          desligado
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {/*
                        Trocar o nicho vale daqui para frente: produto já
                        colhido guarda o nicho que herdou na hora.
                      */}
                      <form action={defineNichoDaFonte} className="flex items-center gap-2">
                        <input type="hidden" name="fonte_id" value={fonte.fonte_id} />
                        <select
                          name="nicho_id"
                          defaultValue={fonte.nicho_id ?? ""}
                          className={`rounded-md border bg-superficie px-3 py-2 text-sm ${
                            fonte.nicho_id ? "border-borda-forte" : "border-atencao-borda bg-atencao-fundo"
                          }`}
                        >
                          <option value="" disabled>
                            sem nicho
                          </option>
                          {nichos.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.nome}
                            </option>
                          ))}
                        </select>
                        <Botao type="submit" variante="secundaria" tamanho="sm">
                          trocar
                        </Botao>
                      </form>
                      {!fonte.nicho_id && (
                        <p className="mt-1 text-xs text-atencao">
                          Sem nicho, o produto colhido não chega a canal nenhum.
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">{fonte.mencoes}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-sucesso">
                      {fonte.anuncios_novos}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-texto-medio">
                      {fonte.ja_conhecidos}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        fonte.descartadas > 0 ? "text-atencao" : "text-texto-medio"
                      }`}
                    >
                      {fonte.descartadas}
                    </td>
                    <td className="px-4 py-3 text-texto-medio">
                      {descreveQuando(fonte.ultima_leitura_em)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={alternaFonteAtiva}>
                        <input type="hidden" name="fonte_id" value={fonte.fonte_id} />
                        <input type="hidden" name="ativo" value={fonte.ativo ? "false" : "true"} />
                        <Botao type="submit" variante="secundaria" tamanho="sm">
                          {fonte.ativo ? "desligar" : "ligar"}
                        </Botao>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {descartadas > 0 && (
          <p className="mt-3 text-base text-texto-fraco">
            {descartadas} {descartadas === 1 ? "menção descartada" : "menções descartadas"}.{" "}
            <Link href="/colheita/mencoes" className="font-semibold text-marca-texto underline">
              Ver o que não foi reconhecido
            </Link>{" "}
            — link descartado em massa costuma ser formato de loja que o leitor ainda não entende,
            não canal ruim.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-borda bg-superficie p-5">
        <h2 className="mb-1 text-lg font-bold tracking-titulo">Adicionar canal</h2>
        <p className="mb-5 text-base text-texto-fraco">
          Só canal público. Grupo fechado depende de leitura por conta de usuário, que ainda não
          existe — falta a string de sessão, e ela nunca entra no Git.
        </p>
        <FormularioFonte nichos={nichos.map((n) => ({ id: n.id, nome: n.nome }))} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold tracking-titulo">Preço alegado × observado</h2>
        <p className="mb-4 text-base text-texto-fraco">
          O que o canal disse, contra o que nós medimos. Diferença grande e repetida é canal que
          exagera — e a decisão do que fazer com ele é sua, não do sistema.
        </p>

        {comparacoes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda-forte p-8 text-center text-base text-texto-fraco">
            Nada para comparar ainda. Aparece aqui quando um anúncio colhido com preço alegado
            acumular ponto de preço nosso.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <table className="w-full text-left text-base">
              <thead className="border-b border-borda bg-superficie-alt text-xs font-semibold uppercase tracking-eyebrow text-texto-fraco">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3 text-right">Alegado</th>
                  <th className="px-4 py-3 text-right">Menor nosso</th>
                  <th className="px-4 py-3 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {comparacoes.map((linha) => (
                  <tr key={linha.id} className="border-b border-borda-sutil last:border-0">
                    <td className="px-4 py-3">
                      {linha.url ? (
                        <a
                          href={linha.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-borda-forte underline-offset-2"
                        >
                          {linha.titulo}
                        </a>
                      ) : (
                        linha.titulo
                      )}
                    </td>
                    <td className="px-4 py-3 text-texto-medio">@{linha.canal}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formataReais(linha.alegado)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formataReais(linha.observado)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-bold ${
                        linha.diferencaPct > 10
                          ? "text-perigo"
                          : linha.diferencaPct < -10
                            ? "text-sucesso"
                            : "text-texto-medio"
                      }`}
                    >
                      {linha.diferencaPct > 0 ? "+" : ""}
                      {linha.diferencaPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-borda-sutil px-4 py-3 text-sm text-texto-fraco">
              Positivo quer dizer que o canal alegou preço mais alto do que o menor que nós
              observamos. Negativo quer dizer que ele viu mais barato do que já vimos — pode ser
              oferta relâmpago que a coleta não pegou, e não é acusação.
            </p>
          </div>
        )}
      </section>
      </Pagina>
    </>
  );
}

type Comparacao = {
  id: number;
  titulo: string;
  url: string | null;
  canal: string;
  alegado: number;
  observado: number;
  diferencaPct: number;
};

async function buscaDados() {
  const db = supabaseServidor();

  const [fontes, nichos, mencoes] = await Promise.all([
    db.from("rendimento_da_fonte").select("*").order("mencoes", { ascending: false }),
    db.from("nicho").select("*").eq("ativo", true).order("nome"),
    db
      .from("mencao")
      .select("*")
      .not("preco_alegado_centavos", "is", null)
      .not("anuncio_id", "is", null)
      .order("vista_em", { ascending: false })
      .limit(COMPARACOES_EXIBIDAS * 4),
  ]);

  const falha = [fontes, nichos, mencoes].find((r) => r.error);
  if (falha?.error) {
    throw new Error(
      `O banco respondeu com erro: ${falha.error.message}. ` +
        `Se as tabelas ainda não existem, rode "pnpm db:reset" para aplicar as migrations.`,
    );
  }

  const linhasFonte = (fontes.data ?? []) as RendimentoDaFonteLinha[];
  const linhasMencao = (mencoes.data ?? []) as MencaoLinha[];

  return {
    fontes: linhasFonte,
    nichos: (nichos.data ?? []) as NichoLinha[],
    comparacoes: await montaComparacoes(linhasMencao, linhasFonte),
  };
}

/**
 * Compara a alegação do canal com a nossa série.
 *
 * A junção é feita aqui, e não em view: isto é comparação de
 * exibição, não regra de curadoria. Regra de curadoria mora no
 * banco, em `avalia_anuncios`, e nada nesta tela alimenta decisão
 * automática.
 */
async function montaComparacoes(
  mencoes: MencaoLinha[],
  fontes: RendimentoDaFonteLinha[],
): Promise<Comparacao[]> {
  if (mencoes.length === 0) return [];

  const db = supabaseServidor();
  const anuncioIds = [...new Set(mencoes.map((m) => m.anuncio_id!))];

  const [anuncios, series] = await Promise.all([
    db.from("anuncio").select("*").in("id", anuncioIds),
    db.from("anuncio_serie").select("*").in("anuncio_id", anuncioIds),
  ]);

  const linhasAnuncio = (anuncios.data ?? []) as AnuncioLinha[];
  const produtoIds = [...new Set(linhasAnuncio.map((a) => a.produto_id))];

  const produtos =
    produtoIds.length === 0
      ? { data: [] }
      : await db.from("produto").select("*").in("id", produtoIds);

  const porAnuncio = new Map(linhasAnuncio.map((a) => [a.id, a]));
  const porProduto = new Map(((produtos.data ?? []) as ProdutoLinha[]).map((p) => [p.id, p]));
  const porSerie = new Map(
    ((series.data ?? []) as AnuncioSerieLinha[]).map((s) => [s.anuncio_id, s]),
  );
  const porFonte = new Map(fontes.map((f) => [f.fonte_id, f]));

  const comparacoes: Comparacao[] = [];

  for (const mencao of mencoes) {
    const serie = porSerie.get(mencao.anuncio_id!);
    const observado = serie?.menor_preco_centavos;
    // Sem ponto de preço nosso não existe comparação — e inventar
    // uma referência aqui seria exatamente o dado falso que o plano
    // proíbe.
    if (observado == null || observado <= 0) continue;

    const anuncio = porAnuncio.get(mencao.anuncio_id!);
    const produto = anuncio ? porProduto.get(anuncio.produto_id) : undefined;
    const alegado = mencao.preco_alegado_centavos!;

    comparacoes.push({
      id: mencao.id,
      titulo: produto?.titulo_canonico ?? anuncio?.sku_externo ?? "—",
      url: anuncio?.url_original ?? null,
      canal: porFonte.get(mencao.fonte_id)?.identificador ?? "?",
      alegado,
      observado,
      diferencaPct: Math.round(((alegado - observado) / observado) * 100),
    });

    if (comparacoes.length >= COMPARACOES_EXIBIDAS) break;
  }

  return comparacoes;
}

function soma<T>(itens: T[], valor: (item: T) => number): number {
  return itens.reduce((total, item) => total + valor(item), 0);
}

function descreveQuando(quando: string | null): string {
  if (!quando) return "nunca";
  const dias = Math.floor((Date.now() - new Date(quando).getTime()) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
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
