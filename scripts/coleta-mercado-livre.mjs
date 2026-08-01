/**
 * Coletor do Mercado Livre — pela API oficial, sem raspagem.
 *
 * O CAMINHO É INDIRETO, E ISSO PRECISA FICAR ESCRITO, porque ninguém
 * o encontra sozinho. Em 31/07/2026 o Mercado Livre fechou
 * `GET /items/{id}` e `GET /sites/MLB/search` com `403 PolicyAgent`
 * — para todo mundo, com ou sem token, e há uma fila de reclamações
 * públicas de outros desenvolvedores sobre isso.
 *
 * O que continua aberto, com a permissão **Publicação e sincronização**
 * marcada na aplicação, é a rota pelo *produto de catálogo*:
 *
 *   highlights/MLB/category/{cat}  → ids de PRODUTO mais vendidos
 *   products/search?q=...          → ids de PRODUTO por palavra
 *   products/{id}                  → nome, fotos, atributos
 *   products/{id}/items            → PREÇO, por vendedor  ← o pulo do gato
 *
 * `products/{id}/items` devolve `item_id`, `price`, `seller_id` e
 * `official_store_id`, que é exatamente o que `anuncio` precisa. O
 * `/items/{id}` individual segue fechado e **não é mais necessário**.
 *
 * O escopo mora no token, gravado no momento da autorização: se você
 * mexer nas permissões da aplicação, **o token velho continua com o
 * escopo velho** e tudo volta a dar 403. Refaça a autorização.
 *
 * USO
 *
 *   node --env-file=.env scripts/coleta-mercado-livre.mjs
 *   node --env-file=.env.producao scripts/coleta-mercado-livre.mjs
 *
 * Ele é idempotente: rodar de novo não duplica produto nem anúncio,
 * e acrescenta um ponto novo à série de preço.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://api.mercadolibre.com";

/**
 * De onde sai o catálogo de cada nicho.
 *
 * Categoria do Mercado Livre, e não palavra-chave, porque
 * "mais vendidos da categoria" é uma lista curada por eles a partir de
 * venda real — e produto que vende é produto cujo preço vale a pena
 * acompanhar. Busca por palavra traz o que o texto casa, que é outra
 * coisa.
 */
const CATEGORIAS = {
  pet: ["MLB1071"],
  casa: ["MLB1574", "MLB264586"],
  eletronico: ["MLB1000", "MLB1648"],
};

/** Quantos produtos por nicho. Baixo de propósito: a série vale mais que a largura. */
const POR_NICHO = Number(process.env.ML_PRODUTOS_POR_NICHO ?? 12);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clientId = process.env.ML_CLIENT_ID;
const clientSecret = process.env.ML_CLIENT_SECRET;
const refreshToken = process.env.ML_REFRESH_TOKEN;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
// O refresh token pode vir só do banco: no agendador não há `.env`.
if (!clientId || !clientSecret) {
  console.error("Faltam ML_CLIENT_ID ou ML_CLIENT_SECRET.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

/**
 * Renova o acesso.
 *
 * ⚠️ O Mercado Livre **troca o refresh token a cada renovação** e
 * invalida o anterior. Quem chama isto precisa gravar o novo em algum
 * lugar que sobreviva ao processo, senão a próxima execução fria
 * falha. Aqui ele é devolvido junto, e o chamador decide.
 */
async function pegaToken(guardado) {
  // O do banco vence o do arquivo: no agendador o `.env` nem existe,
  // e na máquina o do arquivo envelhece assim que o agendador roda.
  const corpo = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: guardado ?? refreshToken,
  });

  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`não renovei o token: ${JSON.stringify(d)}`);
  return { acesso: d.access_token, refreshNovo: d.refresh_token };
}

let ACESSO = "";

/**
 * Grava o refresh token novo por cima do velho.
 *
 * ISTO NÃO É CONVENIÊNCIA, É O CONSERTO DE UM DEFEITO CONHECIDO. O
 * Mercado Livre troca o refresh token a cada renovação e invalida o
 * anterior. Sem gravar, a primeira execução funciona e a segunda
 * falha com `invalid_grant` — e o sintoma é o coletor dizendo que
 * pulou a loja, sem nenhuma pista de por quê.
 *
 * O arquivo é escolhido pelo `--env-file` que subiu o processo, e cai
 * no `.env` quando não dá para saber. Em ambiente sem arquivo (Edge
 * Function, GitHub Actions) ele avisa em vez de morrer calado: lá o
 * token precisa de outro lugar para viver, e isso continua em aberto.
 */
async function guardaRefresh(novo, marketplaceId) {
  // O banco primeiro: é ele que sobrevive ao agendador, onde cada
  // execução começa de um clone limpo.
  const { error } = await db
    .from("credencial_rotativa")
    .update({ valor: novo, atualizado_em: new Date().toISOString() })
    .eq("marketplace_id", marketplaceId)
    .eq("chave", "refresh_token");

  if (error) {
    console.log(`\n⚠️  Não gravei o token novo no banco: ${error.message}`);
    console.log(`   Guarde à mão, senão a próxima execução falha:\n   ${novo}\n`);
    return;
  }

  // E o .env também, quando existir, para o desenvolvimento na
  // máquina não sair de sincronia com o banco.
  const alvo = process.execArgv.find((a) => a.startsWith("--env-file="))?.slice(11);
  if (alvo) {
    try {
      const antes = readFileSync(alvo, "utf8");
      writeFileSync(alvo, antes.replace(/^ML_REFRESH_TOKEN=.*$/m, `ML_REFRESH_TOKEN=${novo}`));
    } catch {
      /* arquivo somente leitura não é motivo para parar: o banco já tem. */
    }
  }
}

async function api(caminho) {
  const r = await fetch(`${API}/${caminho}`, {
    headers: { Authorization: `Bearer ${ACESSO}` },
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const codigo = d?.code || d?.error || r.status;
    throw new Error(`${caminho} → ${codigo}`);
  }
  return d;
}

/** Ids de produto mais vendidos da categoria. */
async function maisVendidos(categoria) {
  const d = await api(`highlights/MLB/category/${categoria}`);
  return (d.content ?? []).filter((c) => c.type === "PRODUCT").map((c) => c.id);
}

/**
 * A melhor oferta viva de um produto.
 *
 * O menor preço entre vendedores, e não o primeiro da lista: é o preço
 * que a pessoa do grupo vai encontrar se clicar. Item usado fica de
 * fora — desconto em usado não é a mesma oferta.
 */
async function melhorOferta(produtoId) {
  const d = await api(`products/${produtoId}/items?limit=50`);
  const vivas = (d.results ?? []).filter(
    (i) => i.condition === "new" && typeof i.price === "number" && i.price > 0,
  );
  if (vivas.length === 0) return null;
  return vivas.reduce((menor, i) => (i.price < menor.price ? i : menor));
}

async function main() {
  const { data: operacao } = await db.from("operacao").select("id").limit(1).single();
  const { data: mkt } = await db
    .from("marketplace")
    .select("id")
    .eq("slug", "mercado_livre")
    .single();

  const { data: credencial } = await db
    .from("credencial_rotativa")
    .select("valor")
    .eq("marketplace_id", mkt.id)
    .eq("chave", "refresh_token")
    .maybeSingle();

  const { acesso, refreshNovo } = await pegaToken(credencial?.valor);
  ACESSO = acesso;
  if (refreshNovo && refreshNovo !== (credencial?.valor ?? refreshToken)) {
    await guardaRefresh(refreshNovo, mkt.id);
  }
  const { data: nichos } = await db.from("nicho").select("id, slug");

  const porSlug = new Map((nichos ?? []).map((n) => [n.slug, n.id]));
  let produtosNovos = 0;
  let anunciosNovos = 0;
  let pontos = 0;
  const problemas = [];

  for (const [slug, categorias] of Object.entries(CATEGORIAS)) {
    const nichoId = porSlug.get(slug);
    if (!nichoId) {
      problemas.push(`nicho "${slug}" não existe no banco`);
      continue;
    }

    const ids = [];
    for (const cat of categorias) {
      try {
        ids.push(...(await maisVendidos(cat)));
      } catch (e) {
        problemas.push(`categoria ${cat}: ${e.message}`);
      }
    }

    const escolhidos = [...new Set(ids)].slice(0, POR_NICHO);
    console.log(`\n${slug} — ${escolhidos.length} produtos`);

    for (const produtoId of escolhidos) {
      try {
        const [produto, oferta] = await Promise.all([
          api(`products/${produtoId}`),
          melhorOferta(produtoId),
        ]);
        if (!oferta) {
          console.log(`  · ${produtoId} sem oferta nova viva`);
          continue;
        }

        // O produto: chave é o título canônico dentro da operação.
        let { data: linha } = await db
          .from("produto")
          .select("id")
          .eq("operacao_id", operacao.id)
          .eq("titulo_canonico", produto.name)
          .maybeSingle();

        if (!linha) {
          const { data: novo, error } = await db
            .from("produto")
            .insert({
              operacao_id: operacao.id,
              nicho_id: nichoId,
              titulo_canonico: produto.name,
            })
            .select("id")
            .single();
          if (error) throw new Error(`produto: ${error.message}`);
          linha = novo;
          produtosNovos++;
        }

        // O anúncio: marketplace + sku_externo é o que impede a série
        // de preço de partir em duas.
        const sku = oferta.item_id;
        let { data: anuncio } = await db
          .from("anuncio")
          .select("id")
          .eq("marketplace_id", mkt.id)
          .eq("sku_externo", sku)
          .maybeSingle();

        if (!anuncio) {
          const { data: novo, error } = await db
            .from("anuncio")
            .insert({
              operacao_id: operacao.id,
              produto_id: linha.id,
              marketplace_id: mkt.id,
              sku_externo: sku,
              url_original: `https://www.mercadolivre.com.br/p/${produtoId}`,
              vendedor: oferta.official_store_id ? "loja oficial" : `vendedor ${oferta.seller_id}`,
              loja_oficial: Boolean(oferta.official_store_id),
              ultima_coleta_em: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (error) throw new Error(`anuncio: ${error.message}`);
          anuncio = novo;
          anunciosNovos++;
        } else {
          await db
            .from("anuncio")
            .update({ ultima_coleta_em: new Date().toISOString() })
            .eq("id", anuncio.id);
        }

        // O ponto de preço vai pela função do banco, e não por insert
        // direto: é ela que resolve o dia local e guarda o menor do dia.
        const centavos = Math.round(oferta.price * 100);
        const { error: erroPreco } = await db.rpc("registra_preco", {
          p_anuncio_id: anuncio.id,
          p_preco_centavos: centavos,
        });
        if (erroPreco) throw new Error(`preço: ${erroPreco.message}`);
        pontos++;

        console.log(
          `  ✓ R$ ${(centavos / 100).toFixed(2).padStart(9)}  ${produto.name.slice(0, 52)}`,
        );
      } catch (e) {
        problemas.push(`${produtoId}: ${e.message}`);
        console.log(`  ✗ ${produtoId}: ${e.message}`);
      }
    }
  }

  console.log(
    `\n${produtosNovos} produtos novos · ${anunciosNovos} anúncios novos · ${pontos} pontos de preço`,
  );
  if (problemas.length > 0) {
    console.log(`\n${problemas.length} problema(s):`);
    for (const p of problemas.slice(0, 10)) console.log(`  ${p}`);
  }
}

await main();
