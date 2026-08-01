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
  console.log(`${porDominio.size} domínios mapeados`);

  const { data: anuncios } = await db
    .from("anuncio")
    .select("id, url_original, produto_id, produto:produto_id ( titulo_canonico, nicho_id )")
    .eq("marketplace_id", mktId);

  console.log(`${(anuncios ?? []).length} anúncios a conferir\n`);

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
        const p = await fetch(`${API}/products/${produtoId}`, { headers: cabecalho })
          .then((r) => r.json())
          .catch(() => null);
        return p?.domain_id ? { anuncio: a, dominio: p.domain_id } : null;
      }),
    );

    for (const r of resultados) {
      if (!r) continue;
      lidos++;

      const { anuncio, dominio } = r;

      if (!porDominio.has(dominio)) {
        semMapa.set(dominio, (semMapa.get(dominio) ?? 0) + 1);
      }

      const nichoNovo = porDominio.get(dominio) ?? null;
      const nichoAntigo = anuncio.produto?.nicho_id ?? null;

      if (!SECO) {
        await db.from("anuncio").update({ dominio_externo: dominio }).eq("id", anuncio.id);
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
    console.log(`\n${semMapa.size} domínio(s) sem mapeamento, do mais frequente:`);
    for (const [d, n] of [...semMapa].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`  ${String(n).padStart(4)}  ${d}`);
    }
    console.log("\nMapeie em `nicho_dominio`. Enquanto não mapear, esses produtos não publicam.");
  }
}

await main();
