import Link from "next/link";

import { classificaProdutos } from "@/app/acoes/catalogo";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { Cartao } from "@/app/componentes/Cartao";
import { Chip, EtiquetaDeLoja } from "@/app/componentes/Chip";
import { classeDeCampo } from "@/app/componentes/Campo";
import { Identidade } from "@/app/componentes/Identidade";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type {
  AnuncioLinha,
  MarketplaceLinha,
  NichoLinha,
  ProdutoLinha,
} from "@/lib/supabase/tipos";

/**
 * Sem classificação — a triagem de nicho.
 *
 * É a contrapartida de "misto" ser uma escolha legítima no cadastro de
 * fonte. Canal genérico de ofertas não tem um nicho; forçar um faz o
 * produto ser roteado errado, que é pior do que não ser roteado —
 * errado é falha silenciosa, e sem nicho é falha visível, que para
 * aqui.
 *
 * DUAS COISAS QUE FAZEM ELA SER USÁVEL, e sem as quais ela vira a tela
 * que ninguém abre:
 *
 * **Classificar é em lote.** Este é o único trabalho manual por item
 * do sistema inteiro. Um canal genérico entrega dezenas de produtos
 * por dia — de um em um, com um clique e uma espera de rede cada,
 * ninguém faz na segunda semana, e o catálogo para de crescer sem
 * ninguém ter decidido isso.
 *
 * **A loja e o título aparecem inteiros.** O que decide o nicho é o
 * título, e título vindo de canal alheio é longo e ruim. Cortar em
 * "Placa de Vídeo GeForce RTX 5060 Ti 8GB OC…" tira justamente o
 * pedaço que diferencia um produto do outro.
 */

export const dynamic = "force-dynamic";

/** Quantos cabem numa passada. Além disso, a página vira rolagem sem fim. */
const POR_VEZ = 50;

export default async function SemNicho() {
  const dados = await buscaDados();

  if (!dados) {
    return (
      <Pagina trilha="Catálogo" titulo="Sem classificação" medida="estreita">
        <Cartao espaco="lg" className="border-atencao-borda bg-atencao-fundo">
          O banco não respondeu. Rode <code className="font-mono">pnpm db:sobe</code>.
        </Cartao>
      </Pagina>
    );
  }

  const { produtos, total, nichos, anunciosDoProduto, porMarketplace } = dados;

  return (
    <Pagina
      trilha="Catálogo"
      titulo="Sem classificação"
      subtitulo="Produtos que vieram de canal misto e ainda não têm nicho. Sem nicho eles não chegam a canal nenhum — e é assim mesmo: parar aqui é melhor do que sair roteado errado."
      kpis={[
        {
          rotulo: "Esperando triagem",
          valor: `${total}`,
          nota: total > 0 ? "não chegam a canal nenhum" : "nada pendente",
          cor: total > 0 ? "text-atencao" : "text-sucesso",
        },
        {
          rotulo: "Nesta página",
          valor: `${produtos.length}`,
          nota: total > POR_VEZ ? `de ${total}, ${POR_VEZ} por vez` : "todos",
        },
      ]}
    >
      {nichos.length === 0 ? (
        <Cartao espaco="lg">
          <p className="text-base">
            Não existe nicho cadastrado ainda — sem eles não há para onde classificar.{" "}
            <Link href="/ajustes/nichos" className="font-semibold text-marca-texto">
              Criar o primeiro
            </Link>
            .
          </p>
        </Cartao>
      ) : produtos.length === 0 ? (
        <Cartao espaco="lg" className="border-dashed text-center">
          <p className="text-md font-bold tracking-titulo">Nada esperando triagem.</p>
          <p className="mx-auto mt-2 max-w-md text-base text-texto-fraco">
            Todo produto do catálogo tem nicho e é roteável. Fila vazia aqui é sucesso — quer dizer
            que as fontes de um nicho só estão dando conta.
          </p>
        </Cartao>
      ) : (
        /*
          Um formulário só, com uma caixa por linha e o nicho escolhido
          uma vez no rodapé. É o que transforma trinta decisões em uma
          seleção e um clique.
        */
        <form action={classificaProdutos}>
          <Cartao espaco="sm" className="p-0">
            <ul>
              {produtos.map((produto) => {
                const anuncios = anunciosDoProduto.get(produto.id) ?? [];

                return (
                  <li
                    key={produto.id}
                    className="border-b border-borda-sutil last:border-0 hover:bg-superficie-alt"
                  >
                    <label className="flex cursor-pointer items-center gap-4 px-5 py-3">
                      <input
                        type="checkbox"
                        name="produto_id"
                        value={produto.id}
                        defaultChecked
                        className="size-4 flex-none accent-marca"
                      />
                      <Identidade nome={produto.titulo_canonico} forma="caixa" tamanho="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold">
                          {produto.titulo_canonico}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          {anuncios.length === 0 ? (
                            <Chip tom="neutro">sem anúncio</Chip>
                          ) : (
                            anuncios.map((anuncio) => {
                              const loja = porMarketplace.get(anuncio.marketplace_id);
                              return (
                                <EtiquetaDeLoja
                                  key={anuncio.id}
                                  nome={loja?.nome ?? "loja"}
                                  corTexto={loja?.cor_texto}
                                  corFundo={loja?.cor_fundo}
                                />
                              );
                            })
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Cartao>

          {/*
            O rodapé gruda embaixo: com cinquenta linhas, um botão no
            fim da página obriga a rolar até lá depois de decidir, e a
            decisão foi tomada lá em cima.
          */}
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-borda-sutil bg-superficie shadow-repouso px-5 py-4 shadow-modal">
            <span className="text-base font-semibold">Classificar as marcadas como</span>
            <select name="nicho_id" required defaultValue="" className={`${classeDeCampo} w-auto`}>
              <option value="" disabled>
                escolha o nicho…
              </option>
              {nichos.map((nicho) => (
                <option key={nicho.id} value={nicho.id}>
                  {nicho.nome}
                </option>
              ))}
            </select>
            <Botao type="submit" variante="primaria" className="ml-auto">
              Classificar
            </Botao>
          </div>
        </form>
      )}

      <p className="text-sm text-texto-fraco">
        Produto classificado passa a ser roteável e some daqui. Se um canal misto está enchendo esta
        fila com um assunto só, vale dar o nicho a ele em{" "}
        <Link href="/colheita/fontes" className="font-semibold text-marca-texto">
          Fontes
        </Link>{" "}
        — a triagem é trabalho por item, e a herança é de graça.
      </p>
    </Pagina>
  );
}

async function buscaDados(): Promise<{
  produtos: ProdutoLinha[];
  total: number;
  nichos: NichoLinha[];
  anunciosDoProduto: Map<string, AnuncioLinha[]>;
  porMarketplace: Map<string, MarketplaceLinha>;
} | null> {
  try {
    const db = supabaseServidor();

    const [produtos, contagem, nichos, marketplaces] = await Promise.all([
      db
        .from("produto")
        .select("*")
        .is("nicho_id", null)
        .order("criado_em", { ascending: false })
        .limit(POR_VEZ),
      db.from("produto").select("id", { count: "exact", head: true }).is("nicho_id", null),
      db.from("nicho").select("*").eq("ativo", true).order("nome"),
      db.from("marketplace").select("*"),
    ]);

    if (produtos.error) return null;

    const lista = (produtos.data ?? []) as ProdutoLinha[];

    // Os anúncios só dos produtos desta página: buscar o catálogo
    // inteiro para mostrar cinquenta linhas é o tipo de consulta que
    // funciona com seis produtos e trava com seis mil.
    const { data: anuncios } = await db
      .from("anuncio")
      .select("*")
      .in(
        "produto_id",
        lista.map((p) => p.id),
      );

    const anunciosDoProduto = new Map<string, AnuncioLinha[]>();
    for (const anuncio of (anuncios ?? []) as AnuncioLinha[]) {
      const doProduto = anunciosDoProduto.get(anuncio.produto_id) ?? [];
      doProduto.push(anuncio);
      anunciosDoProduto.set(anuncio.produto_id, doProduto);
    }

    return {
      produtos: lista,
      total: contagem.count ?? 0,
      nichos: (nichos.data ?? []) as NichoLinha[],
      anunciosDoProduto,
      porMarketplace: new Map(
        ((marketplaces.data ?? []) as MarketplaceLinha[]).map((m) => [m.id, m]),
      ),
    };
  } catch {
    return null;
  }
}
