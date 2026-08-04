/**
 * Grava o nicho dos anúncios da Amazon, lendo o título.
 *
 * POR QUE ELE EXISTE. `lib/nicho-pelo-titulo.ts` foi escrito e medido em
 * 04/08 contra o catálogo real, e **o resultado nunca foi gravado**. Os
 * 99 anúncios da Amazon continuam com `produto.nicho_id` nulo (um só tem
 * nicho, e veio de fusão de identidade com um anúncio do Mercado Livre).
 * Sem nicho não há canal, e sem canal nada publica: esse é o bloqueio
 * real da Amazon, e não o preço.
 *
 * POR QUE PELO TÍTULO, e só aqui. O nicho normalmente vem do `domain_id`
 * do marketplace (D-023), que é a fonte boa porque é do catálogo da
 * própria loja. A Amazon não tem domínio nenhum aqui: os anúncios dela
 * não vêm de coleta, vêm da colheita de canais de terceiros. Sobra o
 * título.
 *
 * O QUE ELE FAZ, e são duas coisas:
 *
 * 1. **Desativa o que nem é produto.** Parte dos "anúncios" da Amazon é
 *    conversa de canal que virou linha de catálogo: "Cupom Amazon
 *    #anuncio", "Se prepara cupom Amazon 16:30", "Novo brinde L'Oréal
 *    Elseve". Nenhuma classificação de nicho pegaria isso, porque o
 *    título parece pet e parece beleza. Eles vão para `ativo = false`,
 *    que é a alavanca que já existe e que a detecção inteira respeita
 *    (`detecta_quedas`, `detecta_declarados` e o motivo
 *    `anuncio_inativo` de `avalia_anuncios`).
 *
 * 2. **Preenche o nicho de quem está sem.**
 *
 * ELE SÓ PREENCHE NULO, NUNCA SOBRESCREVE. O título é a fonte fraca,
 * usada por falta de outra. Quando um produto já tem nicho, ele veio do
 * domínio ou da fusão de identidade, que são fontes melhores, e trocar
 * seria rebaixar o dado. É o contrário do `reclassifica-nichos.mjs`, que
 * pode tirar nicho de propósito porque lá a fonte nova é a melhor.
 *
 * ELE NÃO PUBLICA NADA. Ter nicho é condição para existir canal, não
 * para virar oferta. A Amazon continua reprovada por `loja_sem_historico`
 * (`marketplace.base_de_historico = false`), e isso está certo: construir
 * série de preço da Amazon viola a regra 3.3 e custa a conta. O caminho
 * que transforma menção em oferta é outro e ainda não existe.
 *
 * Rode com `--seco` para ver o que mudaria sem mudar nada. Faça isso
 * primeiro e OLHE a amostra: foi assim que apareceram os títulos que não
 * são produto, e é a lição do Beauty, onde uma regra escrita de cabeça
 * marcou "Lip Gloss Seringa" como insumo de clínica.
 *
 *   node --experimental-strip-types --env-file=.env.producao \
 *        scripts/nicho-da-amazon.mjs --seco
 */

import { createClient } from "@supabase/supabase-js";

import { ehTituloDeProduto, nichoPeloTitulo } from "../lib/nicho-pelo-titulo.ts";

const SECO = process.argv.includes("--seco");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

async function main() {
  const { data: mkt, error: erroMkt } = await db
    .from("marketplace")
    .select("id")
    .eq("slug", "amazon")
    .single();

  if (erroMkt || !mkt) {
    console.error(`Não achei o marketplace 'amazon': ${erroMkt?.message ?? "sem linha"}`);
    process.exit(1);
  }

  // O nicho é entidade, e o que se grava é o id. Sem o mapa de slug para
  // id, `nichoPeloTitulo` devolveria um nome que não vira nada.
  const { data: nichos } = await db.from("nicho").select("id, slug");
  const idDoNicho = new Map((nichos ?? []).map((n) => [n.slug, n.id]));

  /*
    PAGINADO, mesmo com 99 anúncios. O PostgREST corta em 1.000 linhas e
    devolve a página sem avisar que cortou — foi assim que o
    `reclassifica-nichos.mjs` reclassificou 1.000 de 1.800 dizendo que
    tinha visto tudo. A Amazon cabe hoje e pode não caber amanhã, e o
    laço custa três linhas.
  */
  const anuncios = [];
  for (let de = 0; ; de += 1000) {
    const { data: pagina, error } = await db
      .from("anuncio")
      .select("id, ativo, produto_id, produto:produto_id ( titulo_canonico, nicho_id )")
      .eq("marketplace_id", mkt.id)
      .range(de, de + 999);
    if (error) throw new Error(`leitura: ${error.message}`);
    if (!pagina || pagina.length === 0) break;
    anuncios.push(...pagina);
    if (pagina.length < 1000) break;
  }

  console.log(`${anuncios.length} anúncios da Amazon\n`);

  const naoProduto = [];
  const classificados = [];
  const semNicho = [];
  const jaTinham = [];
  const nichoDesconhecido = new Set();

  for (const a of anuncios) {
    const titulo = a.produto?.titulo_canonico ?? "";

    if (!ehTituloDeProduto(titulo)) {
      naoProduto.push({ ...a, titulo });
      continue;
    }

    if (a.produto?.nicho_id) {
      jaTinham.push({ ...a, titulo });
      continue;
    }

    const slug = nichoPeloTitulo(titulo);
    if (!slug) {
      semNicho.push({ ...a, titulo });
      continue;
    }

    const nichoId = idDoNicho.get(slug);
    if (!nichoId) {
      // Regra que aponta para nicho inexistente é defeito, não "sem
      // nicho". Some na estatística se for tratada como o segundo.
      nichoDesconhecido.add(slug);
      semNicho.push({ ...a, titulo });
      continue;
    }

    classificados.push({ ...a, titulo, slug, nichoId });
  }

  // A AMOSTRA, e ela é o ponto. Não aplique sem ler.
  console.log(`✗ ${naoProduto.length} não são produto, e vão para ativo = false:`);
  for (const a of naoProduto) {
    console.log(`    ${a.titulo.slice(0, 68)}${a.ativo ? "" : "   (já inativo)"}`);
  }

  console.log(`\n→ ${classificados.length} ganham nicho:`);
  const porNicho = new Map();
  for (const a of classificados) porNicho.set(a.slug, (porNicho.get(a.slug) ?? 0) + 1);
  for (const [slug, n] of [...porNicho].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${slug}`);
  }
  console.log();
  for (const a of classificados) {
    console.log(`    ${a.slug.padEnd(12)} ${a.titulo.slice(0, 62)}`);
  }

  console.log(`\n· ${semNicho.length} ficam sem nicho, e continuam sem publicar:`);
  for (const a of semNicho) console.log(`    ${a.titulo.slice(0, 68)}`);

  if (jaTinham.length > 0) {
    console.log(`\n· ${jaTinham.length} já tinham nicho de fonte melhor, e não são tocados.`);
  }

  if (nichoDesconhecido.size > 0) {
    console.log(
      `\n⚠ regra aponta para nicho que não existe na tabela: ${[...nichoDesconhecido].join(", ")}`,
    );
  }

  if (SECO) {
    console.log("\n(SECO, nada gravado)");
    return;
  }

  let desativados = 0;
  for (const a of naoProduto) {
    if (!a.ativo) continue;
    const { error } = await db.from("anuncio").update({ ativo: false }).eq("id", a.id);
    if (error) throw new Error(`desativar ${a.id}: ${error.message}`);
    desativados++;
  }

  /*
    Um `update` por produto, e não por anúncio: dois anúncios da Amazon
    podem apontar para o mesmo produto depois da fusão de identidade, e
    aí o segundo escreveria por cima do primeiro sem motivo.
  */
  const nichoPorProduto = new Map();
  for (const a of classificados) {
    if (!nichoPorProduto.has(a.produto_id)) nichoPorProduto.set(a.produto_id, a.nichoId);
  }

  let gravados = 0;
  for (const [produtoId, nichoId] of nichoPorProduto) {
    const { error } = await db.from("produto").update({ nicho_id: nichoId }).eq("id", produtoId);
    if (error) throw new Error(`nicho de ${produtoId}: ${error.message}`);
    gravados++;
  }

  console.log(`\n${desativados} desativados · ${gravados} produtos ganharam nicho`);
}

await main();
