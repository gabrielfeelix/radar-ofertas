/**
 * Preenche `produto.atributos` para quem entrou sem eles.
 *
 * POR QUE ELE EXISTE, e por que roda uma vez e não sempre: a migration
 * 31 criou a coluna para a comparação de irmãos, e quem a preenchia era
 * só `funde-identidades.mjs`, que roda à parte e só sobre quem ele
 * compara. O coletor calculava os atributos para montar a chave de
 * identidade e **descartava** — mesmo padrão do `domain_id` antes da
 * migration 24 e do `message_id` antes da 44: o dado vem na resposta e
 * é jogado fora.
 *
 * Resultado medido em 01/08: 471 de 1.714 produtos com atributos.
 *
 * O QUE ISSO CUSTOU, e é concreto: o Radar Perfumes (masc) filtra por
 * `GENDER` (migration 43) e exige o atributo, porque perfume sem gênero
 * conhecido não é "provavelmente masculino". Os sete perfumes do
 * catálogo estavam todos com `atributos` nulo, e o canal ficaria mudo
 * para sempre — não por falta de oferta, mas por falta de um dado que
 * a API sempre mandou.
 *
 * O coletor já nasce consertado (grava no insert e completa quem falta
 * quando reencontra). Este script conserta o que entrou antes dele, sem
 * esperar a descoberta reencontrar 1.243 produtos um a um.
 *
 * USO
 *
 *   node --env-file=.env --env-file=.env.producao scripts/preenche-atributos.mjs --seco
 *   node --env-file=.env --env-file=.env.producao scripts/preenche-atributos.mjs
 *
 * `--nicho=perfume` limita a um nicho, para consertar o urgente antes
 * de varrer a base inteira.
 */

import { createClient } from "@supabase/supabase-js";

import { atributosDe } from "../lib/identidade.ts";

const API = "https://api.mercadolibre.com";
const SECO = process.argv.includes("--seco");
const NICHO = process.argv.find((a) => a.startsWith("--nicho="))?.slice(8) ?? null;

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
    signal: AbortSignal.timeout(20_000),
  });

  const t = await r.json();
  if (!t.access_token) throw new Error(`token: ${JSON.stringify(t).slice(0, 200)}`);

  // O ML troca o refresh a cada renovação e invalida o anterior. Sem
  // gravar, a próxima execução do coletor falha com invalid_grant.
  if (t.refresh_token) {
    await db
      .from("credencial_rotativa")
      .update({ valor: t.refresh_token, atualizado_em: new Date().toISOString() })
      .eq("marketplace_id", mkt.id)
      .eq("chave", "refresh_token");
  }

  return { acesso: t.access_token, mktId: mkt.id };
}

async function main() {
  const { acesso, mktId } = await pegaToken();
  const cabecalho = { Authorization: `Bearer ${acesso}` };

  let nichoId = null;
  if (NICHO) {
    const { data } = await db.from("nicho").select("id").eq("slug", NICHO).maybeSingle();
    if (!data) {
      console.error(`nicho "${NICHO}" não existe.`);
      process.exit(1);
    }
    nichoId = data.id;
  }

  // O id de produto do ML sai da URL do anúncio (`/p/MLB...`), que é o
  // mesmo caminho que `reclassifica-nichos.mjs` usa. Anúncio que não é
  // de catálogo não tem esse formato e fica de fora.
  let consulta = db
    .from("anuncio")
    .select("url_original, produto_id, produto:produto_id ( titulo_canonico, atributos, nicho_id )")
    .eq("marketplace_id", mktId);

  const { data: anuncios } = await consulta;

  const alvos = new Map();
  for (const a of anuncios ?? []) {
    if (a.produto?.atributos) continue;
    if (nichoId && a.produto?.nicho_id !== nichoId) continue;
    const produtoId = (a.url_original ?? "").match(/\/p\/(MLB\d+)/)?.[1];
    if (!produtoId) continue;
    // Um produto nosso pode ter vários anúncios; basta uma consulta.
    if (!alvos.has(a.produto_id)) alvos.set(a.produto_id, { produtoId, titulo: a.produto?.titulo_canonico });
  }

  console.log(`${alvos.size} produto(s) sem atributos${NICHO ? ` no nicho ${NICHO}` : ""}\n`);

  let preenchidos = 0;
  let semResposta = 0;
  const lote = 10;
  const entradas = [...alvos.entries()];

  for (let i = 0; i < entradas.length; i += lote) {
    const pedaco = entradas.slice(i, i + lote);

    const resultados = await Promise.all(
      pedaco.map(async ([nossoId, { produtoId, titulo }]) => {
        const p = await fetch(`${API}/products/${produtoId}`, {
          headers: cabecalho,
          signal: AbortSignal.timeout(20_000),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        return { nossoId, titulo, atributos: p ? atributosDe(p) : null };
      }),
    );

    for (const r of resultados) {
      if (!r.atributos || Object.keys(r.atributos).length === 0) {
        semResposta++;
        continue;
      }
      if (!SECO) {
        await db.from("produto").update({ atributos: r.atributos }).eq("id", r.nossoId);
      }
      preenchidos++;
      if (preenchidos <= 20) {
        const g = r.atributos.GENDER ? `GENDER=${r.atributos.GENDER}  ` : "";
        console.log(`  ✓ ${g}${(r.titulo ?? "").slice(0, 52)}`);
      }
    }
  }

  console.log(
    `\n${preenchidos} preenchidos · ${semResposta} sem resposta da API${SECO ? "  (SECO, nada gravado)" : ""}`,
  );
}

await main();
