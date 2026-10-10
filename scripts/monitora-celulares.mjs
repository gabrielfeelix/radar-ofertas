/**
 * Monitor pessoal de celular do dono, com aviso no privado do Telegram.
 *
 * NÃO É PRODUTO, e isso precisa ficar escrito. Não passa pela curadoria,
 * não gera oferta nem publicação, não usa link de afiliado. Pedido do
 * dono em 10/10/2026, no 10.10, procurando celular para trocar o S22+:
 * *"toda e qualquer promoção de s25, s26, s25 plus, s25 ultra, xiaomi
 * 17T pro, pocophone, iphone 17, quero ser notificado"*.
 *
 * Link de afiliado fica de fora de propósito: comprar pelo próprio link
 * é autocompra, e os programas tratam isso como fraude de comissão.
 *
 * O QUE ELE FAZ, de 15 em 15 minutos (`monitor-celular.yml`, disparado
 * pelo `pg_cron`):
 *
 *   1. Para cada modelo da lista, acha o menor preço de item NOVO no
 *      Mercado Livre (API de catálogo, a mesma rota do coletor) e na
 *      Shopee (API de afiliado, `productOfferV2` por palavra).
 *   2. Se o menor preço está abaixo do teto do modelo, manda mensagem.
 *   3. Grava o preço avisado em `parametro`, para não repetir.
 *
 * QUANDO AVISA DE NOVO: só se o preço cair mais R$ 20 abaixo do último
 * aviso. Se subir acima do teto, a trava solta, e a próxima queda abaixo
 * do teto avisa outra vez. Sem isso, um S25+ parado em R$ 3.450 mandaria
 * 24 mensagens por dia iguais.
 *
 * O PREÇO É O DE ANÚNCIO, sem cupom nem desconto de Pix. Medido em
 * 10/10 no carrinho: o S25+ de R$ 3.977 na API fechou em R$ 3.777 com
 * cupom. Por isso o teto conta com o cupom ainda por vir.
 *
 * A Amazon fica de fora porque o projeto não tem API de preço dela.
 *
 * USO
 *
 *   node --env-file=.env --env-file=.env.producao scripts/monitora-celulares.mjs --teste
 *
 * `--teste` imprime o que mandaria e não manda nem grava nada.
 * `--envia-teste` manda uma mensagem de exemplo aos destinos e sai, sem
 * consultar loja nenhuma. É o que o `monitor-celular-teste.yml` roda.
 *
 * DESTINOS: o privado do Telegram (`MONITOR_CELULAR_CHAT_ID`) e o
 * WhatsApp do dono (`MONITOR_CELULAR_WHATSAPP`, número com DDI), cada um
 * ligado quando a variável existe. O WhatsApp sai pelo chip do bot, e o
 * dono pediu isso sabendo: são poucas mensagens por dia, para um número
 * que conversa com o chip, o que não tem cara de disparo em massa.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * A lista que o dono pediu, com o teto de cada um em reais.
 *
 * DE ONDE SAEM OS TETOS: pesquisa de 10/10 no Pelando, Oficina da Net,
 * Tecnoblog e MacMagazine, de meados de agosto até o dia, mais o preço
 * da API do ML no mesmo dia. O teto é um preço AGRESSIVO QUE JÁ
 * ACONTECEU, sem condição estranha: plano de operadora, "leve 2" e o
 * bug de Pix em dobro da Amazon no S25 Ultra (R$ 3.543, 09/10) não
 * contam. Ao lado de cada um, o preço "bom" que se repete.
 *
 * O teto vale para a versão mais barata que casar, de qualquer
 * armazenamento.
 *
 * `inclui` e `exclui` existem porque a busca por "galaxy s25" devolve
 * FE, Edge, Ultra, capa e caneta.
 *
 * `sementes` são produtos de catálogo do ML conferidos à mão em 10/10.
 * A busca do ML não é estável: no teste, "galaxy s25 ultra 256gb" não
 * devolveu o produto de 256GB que estava R$ 700 mais barato que tudo o
 * que ela trouxe. A semente garante que ele é sempre relido.
 *
 * Poco F9, Xiaomi 18 Pro e iPhone 18 ainda não tinham preço limpo no ML
 * em 10/10. Ficam na lista para avisar quando aparecerem baratos.
 *
 * A SHOPEE TRAZ IMPORTADOR. iPhone 17 Pro Max a R$ 6.943 é real, mas
 * com frete de R$ 400 a R$ 600 fora de SP, e Xiaomi/Poco quase só
 * existe por importador, com garantia do vendedor. O aviso diz a loja, e
 * quem decide é o dono.
 */
const MODELOS = [
  // ── Samsung ──
  {
    // Bom: R$ 3.450 a 3.580. Já foi a R$ 3.329 (ML, 14/09, cupom + Pix).
    nome: "Galaxy S25",
    termos: ["samsung galaxy s25 256gb", "samsung galaxy s25 512gb"],
    sementes: ["MLB45513356", "MLB45502223", "MLB45502235", "MLB45520367"],
    inclui: /galaxy s25\b/i,
    exclui: /s25\s*(\+|plus|ultra|fe|edge)/i,
    teto: 3400,
  },
  {
    // Bom: R$ 3.780 a 3.990. Já foi a R$ 3.527 (Vivo, 14/09) e R$ 3.680
    // com 512GB e fone (Shopee, 22/09).
    nome: "Galaxy S25+",
    termos: ["samsung galaxy s25+ 256gb", "samsung galaxy s25 plus 512gb"],
    sementes: ["MLB45513966", "MLB45513357", "MLB45524546", "MLB60857188"],
    inclui: /s25\s*(\+|plus)/i,
    exclui: null,
    teto: 3700,
  },
  {
    // Bom: R$ 4.650 a 4.950. Já foi a R$ 3.989 (Vivo outlet, 12/09).
    nome: "Galaxy S25 Ultra",
    termos: ["samsung galaxy s25 ultra 256gb", "samsung galaxy s25 ultra 512gb"],
    sementes: ["MLB45517552", "MLB45524778", "MLB45514086", "MLB45502333", "MLB46541360", "MLB45515203", "MLB66698021"],
    inclui: /s25 ultra/i,
    exclui: null,
    teto: 4000,
  },
  {
    // Fora da pesquisa de 10/10. ML no dia: R$ 4.553.
    nome: "Galaxy S26",
    termos: ["samsung galaxy s26 256gb", "samsung galaxy s26 512gb"],
    sementes: ["MLB65560109", "MLB66001283", "MLB65560107", "MLB65560103"],
    inclui: /galaxy s26\b/i,
    exclui: /s26\s*(\+|plus|ultra|fe|edge)/i,
    teto: 4000,
  },

  // ── iPhone ──
  {
    // "17e" não casa: não há fronteira de palavra entre o 7 e o e.
    // Bom: R$ 5.000 a 5.200. Passou abaixo de R$ 5.000 várias vezes.
    nome: "iPhone 17",
    termos: ["iphone 17 256gb", "iphone 17 512gb"],
    sementes: ["MLB55308917", "MLB55308843", "MLB55308852", "MLB55309009", "MLB55308835"],
    inclui: /iphone 17\b/i,
    exclui: /iphone 17\s*(pro|air|plus)/i,
    teto: 4999,
  },
  {
    // Bom: R$ 3.950 a 4.050.
    nome: "iPhone 17e",
    termos: ["iphone 17e 256gb"],
    inclui: /iphone 17e\b/i,
    exclui: null,
    teto: 3949,
  },
  {
    // Bom desde setembro: uns R$ 5.800. Foi a R$ 5.759 (ML oficial, 10/09).
    nome: "iPhone Air",
    termos: ["iphone air 256gb"],
    inclui: /iphone (17 )?air\b/i,
    exclui: null,
    teto: 5799,
  },
  {
    // Bom: R$ 8.000 a 8.300. Foi a R$ 7.798 (Amazon, 05/08).
    nome: "iPhone 17 Pro",
    termos: ["iphone 17 pro 256gb"],
    sementes: ["MLB55308774", "MLB55308767", "MLB55308781"],
    inclui: /iphone 17 pro\b/i,
    exclui: /pro max/i,
    teto: 7999,
  },
  {
    // Bom em loja oficial: R$ 8.800 a 9.000.
    nome: "iPhone 17 Pro Max",
    termos: ["iphone 17 pro max 256gb"],
    sementes: ["MLB55308620", "MLB55308605", "MLB55308632"],
    inclui: /iphone 17 pro max/i,
    exclui: null,
    teto: 8799,
  },
  {
    // Sem desconto real até 10/10: o à vista da Apple é R$ 10.799. O
    // teto fica abaixo dele para pegar o primeiro desconto de verdade.
    nome: "iPhone 18 Pro",
    termos: ["iphone 18 pro 256gb"],
    inclui: /iphone 18 pro\b/i,
    exclui: /pro max/i,
    teto: 10499,
  },
  {
    // À vista da Apple: R$ 11.699.
    nome: "iPhone 18 Pro Max",
    termos: ["iphone 18 pro max 256gb"],
    inclui: /iphone 18 pro max/i,
    exclui: null,
    teto: 11399,
  },

  // ── Xiaomi e Poco ──
  {
    // Bom: R$ 2.900 a 3.100 (256GB). Já foi a R$ 2.720 em julho.
    nome: "Poco X8 Pro Max",
    termos: ["poco x8 pro max 256gb", "poco x8 pro max 512gb"],
    inclui: /poco x8 pro max/i,
    exclui: null,
    teto: 2750,
  },
  {
    // Bom: R$ 3.200 a 3.500. Importador na Shopee a R$ 2.878 (05/10).
    nome: "Poco F8 Pro",
    termos: ["poco f8 pro 256gb", "poco f8 pro 512gb"],
    sementes: ["MLB67289426", "MLB80120678", "MLB67289427"],
    inclui: /poco f8 pro/i,
    exclui: null,
    teto: 2900,
  },
  {
    // Bom: R$ 4.200 a 4.500. Foi a R$ 3.989 (Shopee, 08/08).
    nome: "Poco F8 Ultra",
    termos: ["poco f8 ultra"],
    inclui: /poco f8 ultra/i,
    exclui: null,
    teto: 4000,
  },
  {
    // A linha mais nova (01/09). Só importador, uns R$ 4.780. Menor
    // registrado: R$ 4.461.
    nome: "Poco F9 Pro",
    termos: ["poco f9 pro"],
    inclui: /poco f9 pro/i,
    exclui: null,
    teto: 4470,
  },
  {
    // Só importador, uns R$ 5.400 a 5.500, sem promoção registrada.
    nome: "Poco F9 Ultra",
    termos: ["poco f9 ultra"],
    inclui: /poco f9 ultra/i,
    exclui: null,
    teto: 5200,
  },
  {
    // Importador: bom de R$ 3.500 a 3.900. Foi a R$ 3.403 (Shopee, 06/10).
    // O oficial no Brasil custa R$ 8.699 e não entra nessa conta.
    nome: "Xiaomi 17T",
    termos: ["xiaomi 17t 512gb"],
    inclui: /xiaomi 17t\b/i,
    exclui: /17t pro/i,
    teto: 3400,
  },
  {
    // Só importador, R$ 4.990 a 5.150 na pesquisa. O dono achou a
    // R$ 4.412 na Shopee em 10/10, e é o celular que ele quer: o teto
    // fica logo acima disso, para cada queda nova chegar.
    nome: "Xiaomi 17T Pro",
    termos: ["xiaomi 17t pro"],
    inclui: /xiaomi 17t pro/i,
    exclui: null,
    teto: 4500,
  },
  {
    // Anunciado na China em 23/09, global esperado para novembro. Sem
    // preço em real ainda: o teto é chute de partida, revisar quando
    // houver dado.
    nome: "Xiaomi 18 Pro / Pro Max",
    termos: ["xiaomi 18 pro"],
    inclui: /xiaomi 18 pro/i,
    exclui: null,
    teto: 6000,
  },
];

/** Título com isto não é o celular, é acessório ou aparelho usado. */
const NAO_E_CELULAR =
  /capa|capinha|pel[ií]cula|case|cabo|carregador|caneta|s ?pen|l[aá]pis|fone|suporte|lente|tela lcd|frontal|bateria|carca|vidro|adesivo|usado|seminovo|vitrine|recondicionado|r[eé]plica|pe[cç]a/i;

/**
 * Abaixo desta fração do teto, o preço é golpe ou erro, não promoção.
 *
 * Medido no primeiro teste, em 10/10: um "Galaxy S25 256GB" a R$ 1.000
 * no catálogo do ML, com o modelo custando R$ 3.859 nos outros
 * vendedores. Avisar isso seria mandar o dono para um golpe.
 */
const PISO_DO_TETO = 0.5;

/** Teto de consultas de vendedor por modelo, para a rodada caber na hora. */
const MAX_VENDEDORES_CONSULTADOS = 20;

/** Quanto o preço precisa cair abaixo do último aviso para avisar de novo. */
const QUEDA_MINIMA_CENTAVOS = 2000;

const TESTE = process.argv.includes("--teste");
const TEMPO_LIMITE_MS = 20_000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENVIA_TESTE = process.argv.includes("--envia-teste");
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.MONITOR_CELULAR_CHAT_ID;
const whatsappDono = (process.env.MONITOR_CELULAR_WHATSAPP ?? "").replace(/\D/g, "");
const whatsappBase = (process.env.WHATSAPP_API_URL ?? "").replace(/\/+$/, "");
const whatsappChave = process.env.WHATSAPP_API_KEY;
const whatsappInstancia = process.env.MONITOR_CELULAR_INSTANCIA ?? "radar01";

const temTelegram = Boolean(botToken && chatId);
const temWhatsApp = Boolean(whatsappDono && whatsappBase && whatsappChave);

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!TESTE && !temTelegram && !temWhatsApp) {
  console.error(
    "Nenhum destino: falta MONITOR_CELULAR_CHAT_ID (com TELEGRAM_BOT_TOKEN) " +
      "ou MONITOR_CELULAR_WHATSAPP (com WHATSAPP_API_URL e WHATSAPP_API_KEY).",
  );
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

// ── Mercado Livre ─────────────────────────────────────────────────────

const API_ML = "https://api.mercadolibre.com";
let acessoMl = "";

/** Onde o monitor guarda o token de acesso do ML, em `credencial_rotativa`. */
const CHAVE_DO_ACESSO = "monitor_celular_acesso";

/**
 * Entra no ML, renovando o token só quando o guardado está vencendo.
 *
 * O ML INVALIDA O REFRESH TOKEN VELHO A CADA RENOVAÇÃO, e o coletor
 * renova o mesmo. Duas renovações ao mesmo tempo derrubam uma das duas.
 * Este monitor roda de 15 em 15 minutos, então renovar a cada rodada
 * seria 96 chances por dia de pisar no coletor.
 *
 * O token de ACESSO vale 6 horas e não invalida nada ao ser usado. O
 * monitor guarda o dele com o vencimento e reaproveita: renova uma vez a
 * cada ~6 horas, e o choque com o coletor fica improvável.
 */
async function entraNoMl(marketplaceId, operacaoId) {
  const { data: guardado } = await db
    .from("credencial_rotativa")
    .select("valor")
    .eq("marketplace_id", marketplaceId)
    .eq("chave", CHAVE_DO_ACESSO)
    .maybeSingle();
  const [venceEm, token] = String(guardado?.valor ?? "").split("|");
  if (token && Number(venceEm) > Date.now() + 10 * 60_000) {
    acessoMl = token;
    return;
  }

  const { data: credencial } = await db
    .from("credencial_rotativa")
    .select("valor")
    .eq("marketplace_id", marketplaceId)
    .eq("chave", "refresh_token")
    .single();

  const r = await fetch(`${API_ML}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: credencial?.valor ?? process.env.ML_REFRESH_TOKEN,
    }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`não renovei o token do ML: ${JSON.stringify(d)}`);
  acessoMl = d.access_token;

  const venceNovo = Date.now() + Number(d.expires_in ?? 21_600) * 1000;
  const { error: erroDoAcesso } = await db.from("credencial_rotativa").upsert(
    {
      operacao_id: operacaoId,
      marketplace_id: marketplaceId,
      chave: CHAVE_DO_ACESSO,
      valor: `${venceNovo}|${d.access_token}`,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "marketplace_id,chave" },
  );
  if (erroDoAcesso) console.log(`⚠️  Não guardei o token de acesso: ${erroDoAcesso.message}`);

  if (d.refresh_token && d.refresh_token !== credencial?.valor) {
    const { error } = await db
      .from("credencial_rotativa")
      .update({ valor: d.refresh_token, atualizado_em: new Date().toISOString() })
      .eq("marketplace_id", marketplaceId)
      .eq("chave", "refresh_token");
    if (error) console.log(`⚠️  Não gravei o token novo do ML: ${error.message}`);

    const arquivo = process.execArgv.find((a) => a.startsWith("--env-file=.env"))?.slice(11);
    if (arquivo) {
      try {
        const antes = readFileSync(arquivo, "utf8");
        if (/^ML_REFRESH_TOKEN=/m.test(antes)) {
          writeFileSync(arquivo, antes.replace(/^ML_REFRESH_TOKEN=.*$/m, `ML_REFRESH_TOKEN=${d.refresh_token}`));
        }
      } catch {
        /* o banco já tem o token novo */
      }
    }
  }
}

async function ml(caminho) {
  const r = await fetch(`${API_ML}/${caminho}`, {
    headers: { Authorization: `Bearer ${acessoMl}` },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!r.ok) throw new Error(`${caminho} → ${r.status}`);
  return r.json();
}

/** O item novo mais barato do modelo no ML, entre todos os vendedores. */
async function maisBaratoNoMl(modelo) {
  const candidatos = [];
  const vistos = new Set();

  const produtosDasSementes = [];
  for (const id of modelo.sementes ?? []) {
    try {
      const p = await ml(`products/${id}`);
      produtosDasSementes.push({ id, name: p.name });
    } catch {
      /* produto de catálogo removido: a busca ainda cobre o modelo */
    }
  }

  for (const termo of [null, ...modelo.termos]) {
    let produtos = produtosDasSementes;
    if (termo !== null) {
      try {
        const d = await ml(
          `products/search?site_id=MLB&status=active&limit=50&q=${encodeURIComponent(termo)}`,
        );
        produtos = d.results ?? [];
      } catch (e) {
        console.log(`  ML "${termo}": ${e.message}`);
        continue;
      }
    }

    for (const p of produtos) {
      if (vistos.has(p.id)) continue;
      vistos.add(p.id);
      if (!casa(modelo, p.name)) continue;

      let itens;
      try {
        itens = (await ml(`products/${p.id}/items?limit=50`)).results ?? [];
      } catch {
        continue;
      }
      for (const i of itens) {
        if (i.condition !== "new" || !(i.price > 0)) continue;
        const centavos = Math.round(i.price * 100);
        if (centavos < modelo.teto * 100 * PISO_DO_TETO) continue;
        candidatos.push({
          loja: "Mercado Livre",
          titulo: p.name,
          centavos,
          deCentavos: i.original_price ? Math.round(i.original_price * 100) : null,
          link: `https://www.mercadolivre.com.br/p/${p.id}`,
          produtoId: p.id,
          vendedorId: i.seller_id,
          oficial: Boolean(i.official_store_id),
        });
      }
    }
  }

  // Do mais barato para cima, o primeiro vendedor confiável ganha.
  candidatos.sort((a, b) => a.centavos - b.centavos);
  let consultas = 0;
  for (const c of candidatos) {
    if (c.oficial) return comFoto(c);
    if (consultas++ >= MAX_VENDEDORES_CONSULTADOS) break;
    if (await vendedorConfiavel(c.vendedorId)) return comFoto(c);
  }
  return null;
}

/**
 * A foto do produto de catálogo, buscada só para o vencedor.
 *
 * O dono pediu em 10/10: aviso de promoção tem que ter a imagem do
 * celular. É só o LINK da foto, que vai direto para o Telegram e a
 * Evolution baixarem; nada é guardado.
 */
async function comFoto(candidato) {
  try {
    const p = await ml(`products/${candidato.produtoId}`);
    const foto = p?.pictures?.[0]?.url ?? null;
    return { ...candidato, imagem: foto ? foto.replace(/^http:/, "https:") : null };
  } catch {
    return { ...candidato, imagem: null };
  }
}

const confiancaDoVendedor = new Map();

/**
 * Vendedor terceiro só conta com reputação verde.
 *
 * POR QUE: no teste de 10/10, o mais barato de iPhone 18 Pro Max no ML
 * era R$ 8.500 contra R$ 11.699 da Apple, de vendedor terceiro. O
 * Pelando já tinha registrado o padrão em 10/09 com o iPhone 17 Pro Max
 * a R$ 6.750 da "MEGA FONTE": pedidos cancelados e vendedor bloqueado.
 * Os níveis são os mesmos de `reputacaoDoVendedor`, no coletor.
 *
 * Só o nível, e não o número de vendas: em 10/10 o `users/{id}` devolvia
 * `seller_reputation.transactions` sem o `completed`, para todo vendedor.
 */
async function vendedorConfiavel(vendedorId) {
  if (confiancaDoVendedor.has(vendedorId)) return confiancaDoVendedor.get(vendedorId);
  let confiavel = false;
  try {
    const u = await ml(`users/${vendedorId}`);
    const r = u?.seller_reputation;
    confiavel = ["5_green", "4_light_green"].includes(r?.level_id);
  } catch {
    /* sem como conferir, não confia */
  }
  confiancaDoVendedor.set(vendedorId, confiavel);
  return confiavel;
}

// ── Shopee ────────────────────────────────────────────────────────────

/** Mesma assinatura de `lib/shopee-api.ts`. */
async function shopee(query) {
  const payload = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const assinatura = createHash("sha256")
    .update(`${process.env.SHOPEE_APP_ID}${ts}${payload}${process.env.SHOPEE_APP_SECRET}`)
    .digest("hex");
  const r = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${process.env.SHOPEE_APP_ID}, Timestamp=${ts}, Signature=${assinatura}`,
    },
    body: payload,
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  const d = await r.json();
  if (d.errors?.length) throw new Error(d.errors.map((e) => e.message).join("; "));
  return d.data;
}

/**
 * O anúncio mais barato do modelo na Shopee.
 *
 * Exige loja com nota 4,5 ou mais: a Shopee tem réplica e golpe em
 * celular caro, e o título sozinho não separa.
 */
async function maisBaratoNaShopee(modelo) {
  if (!process.env.SHOPEE_APP_ID || !process.env.SHOPEE_APP_SECRET) return null;
  let melhor = null;

  for (const termo of modelo.termos) {
    let nos = [];
    try {
      const d = await shopee(
        `{productOfferV2(keyword:${JSON.stringify(termo)}, sortType:1, page:1, limit:50)` +
          `{nodes{itemId shopId productName price priceMin ratingStar shopName imageUrl}}}`,
      );
      nos = d.productOfferV2?.nodes ?? [];
    } catch (e) {
      console.log(`  Shopee "${termo}": ${e.message}`);
      continue;
    }

    for (const n of nos) {
      if (!casa(modelo, n.productName)) continue;
      if (Number(n.ratingStar) < 4.5) continue;
      const centavos = Math.round(Number(n.priceMin ?? n.price) * 100);
      if (!(centavos > 0) || centavos < modelo.teto * 100 * PISO_DO_TETO) continue;
      if (!melhor || centavos < melhor.centavos) {
        melhor = {
          loja: `Shopee (${n.shopName})`,
          titulo: n.productName,
          centavos,
          deCentavos: null,
          link: `https://shopee.com.br/product/${n.shopId}/${n.itemId}`,
          imagem: n.imageUrl ?? null,
        };
      }
    }
  }
  return melhor;
}

// ── Regra e aviso ─────────────────────────────────────────────────────

function casa(modelo, titulo) {
  if (!titulo || NAO_E_CELULAR.test(titulo)) return false;
  if (!modelo.inclui.test(titulo)) return false;
  return !(modelo.exclui && modelo.exclui.test(titulo));
}

const reais = (centavos) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** A chave em `parametro` que guarda o último preço avisado do modelo. */
const chaveDoModelo = (modelo) =>
  `monitor_celular:${modelo.nome.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

function mensagem(modelo, achado) {
  const de = achado.deCentavos && achado.deCentavos > achado.centavos ? ` (de ${reais(achado.deCentavos)})` : "";
  return [
    `📱 ${modelo.nome} por ${reais(achado.centavos)}${de}`,
    `Teto: ${reais(modelo.teto * 100)}. Loja: ${achado.loja}`,
    achado.titulo,
    "Preço de anúncio, sem cupom nem Pix. No carrinho pode sair menor.",
    achado.link,
  ].join("\n");
}

/**
 * Com foto quando existe. Foto que a loja se recusa a servir cai para
 * texto, igual no publicador: o aviso vale mais que a imagem.
 */
async function avisaNoTelegram(texto, imagem) {
  const comFotoAnexada = Boolean(imagem);
  const r = await fetch(
    `https://api.telegram.org/bot${botToken}/${comFotoAnexada ? "sendPhoto" : "sendMessage"}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        comFotoAnexada
          ? { chat_id: chatId, photo: imagem, caption: texto }
          : { chat_id: chatId, text: texto, disable_web_page_preview: false },
      ),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    },
  );
  const d = await r.json();
  if (!d.ok && comFotoAnexada) return avisaNoTelegram(texto, null);
  if (!d.ok) throw new Error(`Telegram recusou: ${d.description}`);
}

async function evolution(caminho, corpo) {
  const r = await fetch(`${whatsappBase}/${caminho}/${encodeURIComponent(whatsappInstancia)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: whatsappChave },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(30_000),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Evolution recusou (${r.status}): ${JSON.stringify(d?.response?.message ?? d)}`);
  return d;
}

let jidDoDono = null;

/**
 * O endereço do dono no WhatsApp, perguntado ao próprio WhatsApp.
 *
 * Celular brasileiro tem o nono dígito, e conta antiga às vezes está
 * registrada sem ele. Mandar para a forma errada não dá erro: a mensagem
 * some. Por isso o número é conferido nas duas formas antes.
 */
async function enderecoDoDono() {
  if (jidDoDono) return jidDoDono;
  const semNono = whatsappDono.replace(/^(55\d{2})9(\d{8})$/, "$1$2");
  const formas = [...new Set([whatsappDono, semNono])];
  const d = await evolution("chat/whatsappNumbers", { numbers: formas });
  const achado = (Array.isArray(d) ? d : []).find((n) => n.exists);
  if (!achado) throw new Error(`o número ${whatsappDono} não está no WhatsApp`);
  jidDoDono = achado.jid;
  return jidDoDono;
}

async function avisaNoWhatsApp(texto, imagem) {
  const numero = await enderecoDoDono();
  if (imagem) {
    try {
      await evolution("message/sendMedia", { number: numero, mediatype: "image", media: imagem, caption: texto });
      return;
    } catch (e) {
      console.log(`  foto recusada no WhatsApp, vai texto: ${e.message}`);
    }
  }
  await evolution("message/sendText", { number: numero, text: texto, linkPreview: true });
}

/**
 * Manda a todos os destinos ligados. Um falhar não cala o outro.
 *
 * Só falha se NENHUM entregou. Com um entregue, o aviso conta como dado:
 * em 10/10 o chip estava desconectado, e se a falha do WhatsApp
 * derrubasse o aviso inteiro, o estado não seria gravado e o Telegram
 * receberia a mesma mensagem de hora em hora até o chip voltar.
 */
async function avisa(texto, imagem = null) {
  const falhas = [];
  let entregues = 0;
  for (const [ligado, envia] of [
    [temTelegram, avisaNoTelegram],
    [temWhatsApp, avisaNoWhatsApp],
  ]) {
    if (!ligado) continue;
    try {
      await envia(texto, imagem);
      entregues++;
    } catch (e) {
      falhas.push(e.message);
    }
  }
  if (falhas.length) console.log(`  ⚠️  ${falhas.join(" | ")}`);
  if (entregues === 0) throw new Error("nenhum destino recebeu o aviso");
}

async function main() {
  if (ENVIA_TESTE) {
    const destinos = [temTelegram && "Telegram", temWhatsApp && "WhatsApp"].filter(Boolean);
    await avisa(
      [
        "📱 Teste do monitor de celular do Radar",
        "Se chegou, está funcionando. A partir de agora, quando um celular da sua lista",
        "ficar abaixo do teto, o aviso chega aqui.",
      ].join("\n"),
    );
    console.log(`teste enviado: ${destinos.join(" e ")}`);
    return;
  }

  const { data: mkt } = await db
    .from("marketplace")
    .select("id, operacao_id")
    .eq("slug", "mercado_livre")
    .single();
  if (!mkt) throw new Error("não achei o marketplace mercado_livre");

  await entraNoMl(mkt.id, mkt.operacao_id);

  const { data: estado } = await db
    .from("parametro")
    .select("chave, valor")
    .like("chave", "monitor_celular:%")
    .is("nicho_id", null);
  const avisado = Object.fromEntries((estado ?? []).map((p) => [p.chave, Number(p.valor)]));

  for (const modelo of MODELOS) {
    const candidatos = [await maisBaratoNoMl(modelo), await maisBaratoNaShopee(modelo)].filter(Boolean);
    const achado = candidatos.sort((a, b) => a.centavos - b.centavos)[0];
    const chaveEstado = chaveDoModelo(modelo);
    const ultimo = avisado[chaveEstado] ?? 0;
    const tetoCentavos = modelo.teto * 100;

    if (!achado) {
      console.log(`${modelo.nome}: nada à venda`);
      continue;
    }
    console.log(`${modelo.nome}: ${reais(achado.centavos)} em ${achado.loja} (teto ${reais(tetoCentavos)})`);

    let novoEstado = ultimo;
    if (achado.centavos > tetoCentavos) {
      // Voltou acima do teto: solta a trava para a próxima queda avisar.
      novoEstado = 0;
    } else if (ultimo === 0 || achado.centavos <= ultimo - QUEDA_MINIMA_CENTAVOS) {
      const texto = mensagem(modelo, achado);
      if (TESTE) {
        console.log(`\n--- mandaria ---\n${texto}\n`);
      } else {
        await avisa(texto, achado.imagem);
        console.log("  avisado");
      }
      novoEstado = achado.centavos;
    }

    if (!TESTE && novoEstado !== ultimo) {
      const { error } = await db.from("parametro").upsert(
        {
          operacao_id: mkt.operacao_id,
          chave: chaveEstado,
          nicho_id: null,
          valor: novoEstado,
          descricao: `Monitor pessoal de celular: último preço avisado de ${modelo.nome}, em centavos. 0 = nada avisado.`,
        },
        { onConflict: "operacao_id,chave,nicho_id" },
      );
      if (error) console.log(`  ⚠️  não gravei o estado: ${error.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
