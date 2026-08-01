/**
 * Reclassifica o catálogo pelo domínio do marketplace (Frente B4).
 *
 * POR QUE ELE EXISTE, e por que roda uma vez e não sempre: até 01/08 o
 * nicho de um produto era decidido por qual lista de termos o
 * encontrou, e `products/search` casa por texto de forma frouxa. O
 * catálogo ficou com Galaxy Buds, papel fotográfico e tanquinho dentro
 * do nicho pet, e com um whey dentro de eletrônico que acabou
 * publicado no canal de pet.
 *
 * O coletor já nasce consertado. Este script conserta o que entrou
 * antes dele: pergunta à API o `domain_id` de cada produto de
 * catálogo, grava no anúncio, e reatribui o nicho pela tabela
 * `nicho_dominio`.
 *
 * ELE PODE TIRAR NICHO, e isso é o certo. Produto de domínio não
 * mapeado fica sem nicho, cai em `/produtos/sem-nicho` e para de
 * publicar até alguém decidir. Deixá-lo publicando no nicho errado
 * seria pior.
 *
 * Rode com `--seco` para ver o que mudaria sem mudar nada.
 */

import { createClient } from "@supabase/supabase-js";

const API = "https://api.mercadolibre.com";
const SECO = process.argv.includes("--seco");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

async function pegaToken() {
  const { data: mkt } = await db.from("marketplace").select("id").eq("slug", "mercado_livre").single();
  const { data: cred } = await db
    .from("credencial_rotativa")
    .select("valor")
    .eq("marketplace_id", mkt.id)
    .eq("chave", "refresh_token")
    .maybeSingle();

  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: cred?.valor ?? process.env.ML_REFRESH_TOKEN,
    }),
  });

  const t = await r.json();
  if (!t.access_token) throw new Error(`token: ${JSON.stringify(t).slice(0, 200)}`);
  return { acesso: t.access_token, mktId: mkt.id };
}

async function main() {
  const { acesso, mktId } = await pegaToken();
  const cabecalho = { Authorization: `Bearer ${acesso}` };

  const { data: mapeamento } = await db
    .from("nicho_dominio")
    .select("dominio_externo, nicho_id")
    .eq("marketplace_id", mktId);

  const porDominio = new Map((mapeamento ?? []).map((m) => [m.dominio_externo, m.nicho_id]));

  const { data: porRaiz } = await db
    .from("nicho_categoria")
    .select("categoria_raiz, nicho_id")
    .eq("marketplace_id", mktId);

  const porCategoria = new Map((porRaiz ?? []).map((c) => [c.categoria_raiz, c.nicho_id]));

  // O nível do meio (migration 46).
  const { data: porRamoLinhas } = await db
    .from("nicho_ramo")
    .select("ramo, nicho_id")
    .eq("marketplace_id", mktId);

  const porRamo = new Map((porRamoLinhas ?? []).map((r) => [r.ramo, r.nicho_id]));
  console.log(
    `${porDominio.size} domínios, ${porRamo.size} ramos e ${porCategoria.size} categorias raiz mapeados`,
  );

  /**
   * A raiz E o ramo de uma categoria, com cache.
   *
   * O ramo é `path_from_root[1]`, e vem na mesma resposta que já era
   * pedida para descobrir a raiz: custo zero de chamada nova. Ele é o
   * nível do meio da migration 46, que é o que separa "academia" do
   * resto de "Esportes e Fitness".
   */
  const arvoreDe = new Map();
  async function arvoreDaCategoria(id) {
    if (!id) return { raiz: null, ramo: null };
    if (arvoreDe.has(id)) return arvoreDe.get(id);
    const c = await fetch(`${API}/categories/${id}`, { headers: cabecalho })
      .then((r) => r.json())
      .catch(() => null);
    const arvore = {
      raiz: c?.path_from_root?.[0]?.id ?? null,
      ramo: c?.path_from_root?.[1]?.id ?? null,
    };
    arvoreDe.set(id, arvore);
    return arvore;
  }

  /** Domínio vence ramo, ramo vence raiz, e "não roteia" bloqueia os de baixo. */
  function decideNicho(dominio, raiz, ramo) {
    if (dominio && porDominio.has(dominio)) return porDominio.get(dominio) ?? null;
    if (ramo && porRamo.has(ramo)) return porRamo.get(ramo) ?? null;
    return raiz ? (porCategoria.get(raiz) ?? null) : null;
  }

  /*
    PAGINADO, e isto era um defeito silencioso. O PostgREST devolve no
    máximo 1.000 linhas por consulta, e o script pedia todos os anúncios
    de uma vez: com 1.800 no banco, ele reclassificava 1.000 e dizia
    "1000 lidos" como se fosse o total. Os outros 800 ficavam com o nicho
    velho, sem erro nenhum e sem aviso.

    Só apareceu quando a base passou de mil. Antes disso o script estava
    certo por sorte.
  */
  const anuncios = [];
  for (let de = 0; ; de += 1000) {
    const { data: pagina } = await db
      .from("anuncio")
      .select("id, url_original, produto_id, produto:produto_id ( titulo_canonico, nicho_id )")
      .eq("marketplace_id", mktId)
      .range(de, de + 999);
    if (!pagina || pagina.length === 0) break;
    anuncios.push(...pagina);
    if (pagina.length < 1000) break;
  }

  console.log(`${anuncios.length} anúncios a conferir\n`);

  let lidos = 0;
  let mudaram = 0;
  let perderamNicho = 0;
  const semMapa = new Map();

  // De 12 em 12 para não estourar a cota nem serializar 500 chamadas.
  const lote = 12;
  for (let i = 0; i < (anuncios ?? []).length; i += lote) {
    const pedaco = anuncios.slice(i, i + lote);

    const resultados = await Promise.all(
      pedaco.map(async (a) => {
        const produtoId = (a.url_original ?? "").match(/\/p\/(MLB\d+)/)?.[1];
        if (!produtoId) return null;
        const [p, itens] = await Promise.all([
          fetch(`${API}/products/${produtoId}`, { headers: cabecalho }).then((r) => r.json()).catch(() => null),
          fetch(`${API}/products/${produtoId}/items?limit=1`, { headers: cabecalho }).then((r) => r.json()).catch(() => null),
        ]);
        const item = itens?.results?.[0];
        if (!p?.domain_id) return null;
        return {
          anuncio: a,
          dominio: p.domain_id,
          folha: item?.category_id ?? null,
          frete: item?.shipping?.free_shipping ?? null,
        };
      }),
    );

    for (const r of resultados) {
      if (!r) continue;
      lidos++;

      const { anuncio, dominio, folha, frete } = r;
      const { raiz, ramo } = await arvoreDaCategoria(folha);

      if (raiz && !porCategoria.has(raiz)) semMapa.set(raiz, (semMapa.get(raiz) ?? 0) + 1);

      const nichoNovo = decideNicho(dominio, raiz, ramo);
      const nichoAntigo = anuncio.produto?.nicho_id ?? null;

      if (!SECO) {
        await db
          .from("anuncio")
          .update({
            dominio_externo: dominio,
            categoria_raiz: raiz,
            categoria_ramo: ramo,
            categoria_folha: folha,
            frete_gratis: frete,
          })
          .eq("id", anuncio.id);
      }

      if (nichoNovo === nichoAntigo) continue;

      if (!SECO) {
        await db.from("produto").update({ nicho_id: nichoNovo }).eq("id", anuncio.produto_id);
      }

      mudaram++;
      if (nichoNovo === null) perderamNicho++;

      if (mudaram <= 25) {
        const titulo = (anuncio.produto?.titulo_canonico ?? "").slice(0, 44);
        console.log(`  ${nichoNovo ? "→" : "✗"} ${dominio.replace("MLB-", "").padEnd(34)} ${titulo}`);
      }
    }
  }

  console.log(
    `\n${lidos} lidos · ${mudaram} mudaram de nicho · ${perderamNicho} ficaram sem nicho${SECO ? "  (SECO, nada gravado)" : ""}`,
  );

  if (semMapa.size > 0) {
    console.log(`\n${semMapa.size} categoria(s) raiz sem mapeamento, da mais frequente:`);
    for (const [d, n] of [...semMapa].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`  ${String(n).padStart(4)}  ${d}`);
    }
    console.log("\nMapeie em `nicho_categoria`. Enquanto não mapear, esses produtos não publicam.");
  }
}

await main();
