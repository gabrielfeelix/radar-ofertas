import Link from "next/link";
import { notFound } from "next/navigation";

import {
  alternaAnuncioAtivo,
  defineNichoDoProduto,
  salvaNotaDoCurador,
} from "@/app/acoes/catalogo";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { EtiquetaDeLoja } from "@/app/componentes/Chip";
import { formataReais } from "@/lib/dinheiro";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type {
  AnuncioLinha,
  AnuncioSerieLinha,
  MarketplaceLinha,
  NichoLinha,
  OfertaLinha,
  ProdutoLinha,
} from "@/lib/supabase/tipos";

/**
 * Produto — como o preço se comportou, e onde ele está mais barato.
 *
 * A tela existe para duas perguntas que a lista não responde: **este
 * desconto é real?** e **por que este produto não virou oferta?**
 *
 * O HISTÓRICO DE REJEIÇÃO É TÃO IMPORTANTE QUANTO O DE APROVAÇÃO, e
 * essa é a parte que costuma faltar em ferramenta parecida. É olhando
 * a sequência de rejeições que se descobre que um limiar está apertado
 * demais — sem isso, o dono ajusta parâmetro no chute até a curadoria
 * virar carimbo.
 *
 * ANÚNCIO DA AMAZON NÃO EXIBE SÉRIE. A política de associados limita a
 * retenção de preço a 24 horas, então essa linha nunca acumula
 * histórico. A tela precisa dizer isso, e não mostrar um espaço vazio
 * que parece defeito.
 */

export const dynamic = "force-dynamic";

const DIAS_PARA_AFIRMAR_MINIMO = 14;

export default async function Produto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const dados = await buscaProduto(id);
  if (!dados) notFound();

  const { produto, anuncios, marketplaces, nichos, series, ofertas } = dados;

  const porMarketplace = new Map(marketplaces.map((m) => [m.id, m]));
  const porSerie = new Map(series.map((s) => [s.anuncio_id, s]));
  const nicho = produto.nicho_id ? nichos.find((n) => n.id === produto.nicho_id) : undefined;

  const comHistorico = anuncios.filter(
    (a) => porMarketplace.get(a.marketplace_id)?.base_de_historico !== false,
  );
  const diasDeSerie = Math.max(
    0,
    ...comHistorico.map((a) => porSerie.get(a.id)?.dias_de_serie ?? 0),
  );

  const rejeitadas = ofertas.filter((o) => o.status === "rejeitada");

  return (
    <>
      <Pagina
        trilha="Catálogo"
        titulo={produto.titulo_canonico}
        subtitulo={`${anuncios.length} ${anuncios.length === 1 ? "anúncio" : "anúncios"} · ${
          diasDeSerie > 0 ? `${diasDeSerie} dias de série` : "sem série ainda"
        }${produto.categoria ? ` · ${produto.categoria}` : ""}`}
        medida="media"
      >
        <p className="text-sm text-texto-fraco">
          <Link href="/produtos" className="font-semibold text-marca-texto">
            ← voltar ao catálogo
          </Link>
        </p>

        {/*
          A nota do curador — o que a máquina não sabe.

          Os canais que funcionam publicam uma linha de opinião junto da
          oferta: "amadeirado clássico, ideal pra fumante de Malboro".
          Isso não sai de API nenhuma, e é a razão de alguém continuar
          seguindo: preço qualquer um copia.

          Fica no PRODUTO e não na publicação porque se escreve uma vez
          e reusa para sempre — o mesmo item volta ao canal várias vezes
          por ano.
        */}
        <section className="rounded-lg border border-borda bg-superficie p-5">
          <h2 className="text-lg font-bold tracking-titulo">Sua nota sobre este produto</h2>
          <p className="mt-1 mb-4 text-base text-texto-fraco">
            Vai em toda publicação deste produto, sempre. É o que a ficha da loja não diz — para
            quem serve, com o que se parece, o que você acha. <strong>Não fale de preço aqui:</strong>{" "}
            ele muda a cada oferta e sai do modelo.
          </p>
          <form action={salvaNotaDoCurador} className="flex flex-col gap-3">
            <input type="hidden" name="produto_id" value={produto.id} />
            <textarea
              name="nota_curador"
              rows={3}
              defaultValue={produto.nota_curador ?? ""}
              placeholder="Amadeirado clássico. Ideal pra quem gosta de fumaça e couro — lembra Malboro."
              className="w-full rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base"
            />
            <Botao type="submit" variante="secundaria" tamanho="sm" className="self-start">
              Salvar nota
            </Botao>
          </form>
        </section>

        {/*
          O nicho vem primeiro porque é o que decide se este produto
          chega a algum canal. Produto sem nicho não dá erro em lugar
          nenhum: ele só nunca acontece.
        */}
        <section
          className={`rounded-lg border p-5 ${
            nicho ? "border-borda bg-superficie" : "border-atencao-borda bg-atencao-fundo"
          }`}
        >
          <h2 className="text-lg font-bold tracking-titulo">Nicho</h2>
          <p className="mt-1 mb-4 text-base text-texto-fraco">
            {nicho
              ? "É o que roteia este produto para os canais. Trocar vale das próximas ofertas em diante."
              : "Sem nicho, este produto não chega a canal nenhum — mesmo que vire oferta."}
          </p>

          <form action={defineNichoDoProduto} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="produto_id" value={produto.id} />
            <select
              name="nicho_id"
              defaultValue={produto.nicho_id ?? ""}
              className="rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base"
            >
              <option value="" disabled>
                escolha…
              </option>
              {nichos.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </select>
            <Botao type="submit" variante={nicho ? "secundaria" : "primaria"}>
              {nicho ? "Trocar nicho" : "Definir nicho"}
            </Botao>
          </form>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold tracking-titulo">
            Onde está anunciado{" "}
            <span className="text-base font-normal text-texto-fraco">
              ({anuncios.length} {anuncios.length === 1 ? "loja" : "lojas"})
            </span>
          </h2>

          <ul className="flex flex-col gap-3">
            {anuncios.map((anuncio) => (
              <li key={anuncio.id}>
                <CartaoDoAnuncio
                  anuncio={anuncio}
                  loja={porMarketplace.get(anuncio.marketplace_id)}
                  serie={porSerie.get(anuncio.id)}
                  produtoId={produto.id}
                />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold tracking-titulo">Ofertas que este produto gerou</h2>
          <p className="mb-4 max-w-[75ch] text-base text-texto-fraco">
            O histórico de rejeição vale tanto quanto o de aprovação: é aqui que se descobre que um
            limiar está apertado demais, em vez de ajustar parâmetro no escuro.
          </p>

          {ofertas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-borda-forte p-8 text-center text-base text-texto-fraco">
              Nenhuma oferta ainda.{" "}
              {diasDeSerie < DIAS_PARA_AFIRMAR_MINIMO
                ? `Com ${diasDeSerie} dias de série, o motor ainda está juntando referência — é tempo passando, não defeito.`
                : "O preço não caiu o suficiente desde que começamos a observar."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ofertas.map((oferta) => (
                <li
                  key={oferta.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-borda bg-superficie px-4 py-3"
                >
                  <span
                    className={`rounded-sm px-2 py-1 text-xs font-bold ${
                      oferta.status === "aprovada"
                        ? "bg-sucesso-fundo text-sucesso"
                        : oferta.status === "rejeitada"
                          ? "bg-perigo-fundo text-perigo"
                          : "bg-preenchimento text-texto-medio"
                    }`}
                  >
                    {oferta.status}
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {formataReais(oferta.preco_atual_centavos)}
                  </span>
                  <span className="text-sm text-texto-fraco">
                    −{oferta.desconto_pct}% sobre {formataReais(oferta.preco_referencia_centavos)}
                  </span>
                  <span className="text-sm text-texto-fraco">nota {oferta.nota}</span>
                  {oferta.motivo_rejeicao && (
                    <span className="text-sm text-perigo">{oferta.motivo_rejeicao}</span>
                  )}
                  <span className="ml-auto text-sm text-texto-fraco">
                    {new Date(oferta.detectada_em).toLocaleDateString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {rejeitadas.length >= 3 && (
            <p className="mt-3 rounded-md border border-info-borda bg-info-fundo px-4 py-3 text-base text-info">
              {rejeitadas.length} rejeições seguidas neste produto. Quando isso se repete no
              catálogo inteiro, costuma ser limiar apertado demais — e não catálogo ruim.
            </p>
          )}
        </section>
      </Pagina>
    </>
  );
}

function CartaoDoAnuncio({
  anuncio,
  loja,
  serie,
  produtoId,
}: {
  anuncio: AnuncioLinha;
  loja: MarketplaceLinha | undefined;
  serie: AnuncioSerieLinha | undefined;
  produtoId: string;
}) {
  const semHistorico = loja?.base_de_historico === false;
  const dias = serie?.dias_de_serie ?? 0;

  return (
    <article
      className={`rounded-lg border p-5 ${anuncio.ativo ? "border-borda bg-superficie" : "border-borda bg-superficie-alt"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <EtiquetaDeLoja
          nome={loja?.nome ?? "loja desconhecida"}
          corTexto={loja?.cor_texto}
          corFundo={loja?.cor_fundo}
        />
        <a
          href={anuncio.url_original}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-texto-fraco underline decoration-borda-forte underline-offset-2"
        >
          {anuncio.sku_externo}
        </a>
        {anuncio.vendedor && <span className="text-sm text-texto-fraco">{anuncio.vendedor}</span>}
        {!anuncio.ativo && (
          <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-medio">
            desativado
          </span>
        )}

        <form action={alternaAnuncioAtivo} className="ml-auto">
          <input type="hidden" name="anuncio_id" value={anuncio.id} />
          <input type="hidden" name="produto_id" value={produtoId} />
          <input type="hidden" name="ativo" value={anuncio.ativo ? "false" : "true"} />
          <Botao type="submit" variante="secundaria" tamanho="sm">
            {anuncio.ativo ? "parar de coletar" : "voltar a coletar"}
          </Botao>
        </form>
      </div>

      {semHistorico ? (
        /*
          Amazon: a política de associados limita a retenção de preço a
          24 horas. Dizer isso é melhor que mostrar um gráfico vazio que
          parece defeito de coleta.
        */
        <p className="mt-4 rounded-md border border-info-borda bg-info-fundo px-4 py-3 text-sm text-info">
          Esta loja não forma série: a política dela limita a retenção de preço a 24 horas. Entra
          como oferta pontual, nunca como referência histórica.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Numero rotulo="Série" valor={dias > 0 ? `${dias}d` : "—"} destaque={dias >= DIAS_PARA_AFIRMAR_MINIMO} />
          <Numero
            rotulo="Menor"
            valor={serie?.menor_preco_centavos != null ? formataReais(serie.menor_preco_centavos) : "—"}
          />
          <Numero
            rotulo="Mediana"
            valor={
              serie?.mediana_preco_centavos != null ? formataReais(serie.mediana_preco_centavos) : "—"
            }
          />
          <Numero rotulo="Pontos" valor={`${serie?.pontos ?? 0}`} />
        </div>
      )}

      {!semHistorico && dias > 0 && dias < DIAS_PARA_AFIRMAR_MINIMO && (
        <p className="mt-3 text-sm text-texto-fraco">
          Com menos de {DIAS_PARA_AFIRMAR_MINIMO} dias, a mensagem não pode falar em mínimo
          histórico — só em &ldquo;menor preço que observamos desde&rdquo;.
        </p>
      )}
    </article>
  );
}

function Numero({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">{rotulo}</p>
      <p
        className={`text-md font-bold tabular-nums ${destaque ? "text-sucesso" : "text-texto"}`}
      >
        {valor}
      </p>
    </div>
  );
}

async function buscaProduto(id: string) {
  try {
    const db = supabaseServidor();

    const { data: produto } = await db.from("produto").select("*").eq("id", id).maybeSingle();
    if (!produto) return null;

    const [anuncios, marketplaces, nichos] = await Promise.all([
      db.from("anuncio").select("*").eq("produto_id", id),
      db.from("marketplace").select("*"),
      db.from("nicho").select("*").eq("ativo", true).order("nome"),
    ]);

    const linhasAnuncio = (anuncios.data ?? []) as AnuncioLinha[];
    const ids = linhasAnuncio.map((a) => a.id);

    const [series, ofertas] =
      ids.length === 0
        ? [{ data: [] }, { data: [] }]
        : await Promise.all([
            db.from("anuncio_serie").select("*").in("anuncio_id", ids),
            db
              .from("oferta")
              .select("*")
              .in("anuncio_id", ids)
              .order("detectada_em", { ascending: false })
              .limit(20),
          ]);

    return {
      produto: produto as ProdutoLinha,
      anuncios: linhasAnuncio,
      marketplaces: (marketplaces.data ?? []) as MarketplaceLinha[],
      nichos: (nichos.data ?? []) as NichoLinha[],
      series: (series.data ?? []) as AnuncioSerieLinha[],
      ofertas: (ofertas.data ?? []) as OfertaLinha[],
    };
  } catch {
    return null;
  }
}
