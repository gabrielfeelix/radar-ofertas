/**
 * Coleta da Shopee — pelo feed de produto, não pela Open API.
 *
 * POR QUE ISTO EXISTE ANTES DA OPEN API
 *
 * O chamado da Open API foi aberto em 03/08 e não tem prazo conhecido.
 * Enquanto ele não volta, a Shopee ficava fora do sistema inteira: sem
 * catálogo, sem preço, sem oferta.
 *
 * Só que o painel de afiliado tem **Criativo → Feed de produto**, e ele
 * entrega o que faltava (D-058): dois CSV atualizados todo dia, com
 * preço, preço original, desconto calculado, nota, imagem, categoria e
 * o link do produto. Nada disso depende de credencial de API.
 *
 * OS DOIS FEEDS SÃO CATÁLOGOS DIFERENTES, e por isso os dois entram:
 *
 *   Shopee Oficial BR   100.000 itens   tem shop_rating e shop_name
 *   Shopee Brasil        10.000 itens   tem global_item_attributes
 *
 * A sobreposição medida entre eles foi de 334 itens. Ficar com um só
 * jogaria fora a maior parte do catálogo.
 *
 * O QUE ELE NÃO FAZ, e é o que a Open API vai resolver: reler o preço
 * de um anúncio específico. O feed é uma foto diária. Se o preço mudar
 * às 15h, só sabemos amanhã — por isso o gatilho aqui é sempre
 * `declarado`, nunca `queda`.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CHAVE;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

/**
 * Leitor de CSV que respeita aspas.
 *
 * Não dá para quebrar por linha: a coluna `description` do feed tem
 * quebra de linha dentro das aspas, e um `split("\n")` ingênuo
 * espatifaria o arquivo em pedaços que não são registros. Isso não
 * daria erro — daria produto com título cortado e preço de outro item.
 */
function* leCsv(texto) {
  let campo = "";
  let linha = [];
  let dentroDeAspas = false;
  let cabecalho = null;

  const fecha = () => {
    linha.push(campo);
    campo = "";
    const atual = linha;
    linha = [];
    if (!cabecalho) {
      cabecalho = atual.map((c) => c.replace(/^﻿/, "").trim());
      return null;
    }
    const objeto = {};
    cabecalho.forEach((nome, i) => (objeto[nome] = atual[i] ?? ""));
    return objeto;
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (dentroDeAspas) {
      if (c === '"') {
        // Aspas dobradas dentro do campo são uma aspa literal.
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
      continue;
    }

    if (c === '"') dentroDeAspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { const r = fecha(); if (r) yield r; }
    else if (c !== "\r") campo += c;
  }

  if (campo || linha.length) { const r = fecha(); if (r) yield r; }
}

/** Preço do feed vem em reais decimais. Vira centavo e nunca volta (D-005). */
function centavos(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/**
 * O SKU da Shopee é a loja e o item juntos, no formato que o
 * `lib/marketplaces.ts` já usa. O id do item sozinho não é único entre
 * lojas, e guardar só ele misturaria anúncio de vendedores diferentes.
 */
function skuDe(produtoLink) {
  const m = String(produtoLink).match(/\/product\/(\d+)\/(\d+)/);
  return m ? `${m[1]}.${m[2]}` : null;
}

async function parametros() {
  const { data } = await db.from("parametro").select("chave, valor").is("nicho_id", null);
  const mapa = {};
  for (const p of data ?? []) mapa[p.chave] = Number(p.valor);
  return mapa;
}

async function baixa(endereco) {
  const resposta = await fetch(endereco, { redirect: "follow" });
  if (!resposta.ok) {
    throw new Error(
      `HTTP ${resposta.status}. A URL do feed pode ter sido trocada pela Shopee — ` +
        "pegue a nova em Criativo → Feed de produto e atualize `credencial_rotativa`.",
    );
  }
  return resposta.text();
}

async function main() {
  const { data: mkt } = await db
    .from("marketplace")
    .select("id, operacao_id")
    .eq("slug", "shopee")
    .single();

  if (!mkt) {
    console.error("Marketplace `shopee` não existe no banco.");
    process.exit(1);
  }

  /*
    AS URLS DO FEED SÃO SEGREDO, e moram no banco pelo mesmo motivo do
    refresh token do ML: elas carregam um token de acesso no parâmetro
    `id`, e este repositório é público.

    Elas são ALÇAS PERMANENTES, não links de arquivo: medido em 03/08,
    duas chamadas seguidas devolveram o mesmo `outer_feed_id` com
    `nonce` e `timestamp` diferentes. A Shopee assina um endereço novo a
    cada chamada. Então guardar uma vez basta — e se um dia parar de
    valer, o erro acima diz o que fazer.
  */
  const { data: credenciais } = await db
    .from("credencial_rotativa")
    .select("chave, valor")
    .eq("marketplace_id", mkt.id)
    .in("chave", ["feed_oficial", "feed_brasil"]);

  const feeds = (credenciais ?? []).filter((c) => c.valor);
  if (feeds.length === 0) {
    console.error(
      "Faltam as URLs do feed em `credencial_rotativa` (`feed_oficial` e `feed_brasil`).\n" +
        "Elas saem de Criativo → Feed de produto, no painel de afiliado.",
    );
    process.exit(1);
  }

  const par = await parametros();
  // O mesmo piso que a curadoria automática usa para desconto declarado:
  // trazer para o catálogo o que ela reprovaria depois é encher o banco
  // de item que nunca vira post.
  const descontoMin = par.desconto_declarado_min_pct ?? 25;
  const descontoTeto = par.desconto_declarado_teto_pct ?? 70;
  const notaMin = par.avaliacao_minima ?? 3.8;

  // Filtrado por marketplace: a tabela é chaveada por loja, e ler tudo
  // traria as 125 linhas `MLB-*` do Mercado Livre junto, sem uso aqui.
  const { data: mapeamento } = await db
    .from("nicho_dominio")
    .select("dominio_externo, nicho_id")
    .eq("marketplace_id", mkt.id);

  const porCategoria = new Map((mapeamento ?? []).map((m) => [m.dominio_externo, m.nicho_id]));

  /*
    LER TUDO PRIMEIRO, ESCREVER O MELHOR DEPOIS.

    Os dois feeds somam 110 mil itens, e uns 24 mil passam nas comportas
    de desconto e nota. Escrever todos custaria quase cem mil chamadas ao
    banco e horas de execução, para encher o catálogo de item que a
    curadoria vai reprovar depois de qualquer jeito.

    Então a leitura é completa, a escrita é limitada, e o critério de
    corte é o maior desconto. O catálogo cresce um pouco por dia, e o que
    entra primeiro é o que tem mais chance de virar post.

    `SHOPEE_MAX_ITENS` controla o teto para quem quiser uma carga maior
    de uma vez.
  */
  const TETO = Number(process.env.SHOPEE_MAX_ITENS ?? 4000);

  let vistos = 0;
  let entraram = 0;
  let atualizados = 0;
  const recusados = { desconto: 0, nota: 0, importado: 0, usado: 0, sem_sku: 0, sem_preco: 0, sem_nicho: 0 };
  const semNicho = new Map();
  const candidatos = [];

  for (const feed of feeds) {
    console.log(`\n${feed.chave}: baixando…`);
    let texto;
    try {
      texto = await baixa(feed.valor);
    } catch (erro) {
      console.error(`  ✗ ${erro.message}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`  ${(texto.length / 1_048_576).toFixed(1)} MB`);

    for (const linha of leCsv(texto)) {
      vistos++;

      // `cb_option` e `condition` só existem no feed grande. Ausente
      // quer dizer "não sabemos", e aí não barra.
      if (linha.cb_option === "Cross border") { recusados.importado++; continue; }
      if (linha.condition === "Second hand") { recusados.usado++; continue; }

      const desconto = Number(linha.discount_percentage);
      if (!Number.isFinite(desconto) || desconto < descontoMin || desconto > descontoTeto) {
        recusados.desconto++;
        continue;
      }

      const nota = Number(linha.item_rating);
      // Nota zero na Shopee quer dizer "sem avaliação", não "nota zero".
      if (Number.isFinite(nota) && nota > 0 && nota < notaMin) { recusados.nota++; continue; }

      const sku = skuDe(linha.product_link);
      if (!sku) { recusados.sem_sku++; continue; }

      const agora = centavos(linha.sale_price);
      const antes = centavos(linha.price);
      if (!agora) { recusados.sem_preco++; continue; }

      /*
        O NICHO VEM DA CATEGORIA, pela mesma tabela que o Mercado Livre
        usa (D-023). A chave é `SHOPEE-<catid2>` para não colidir com os
        `MLB-*` que já estão lá.

        Categoria sem mapa não vira erro: o item entra sem nicho e o
        resumo no fim diz quais faltam, com o nome ao lado. Mapear é
        trabalho de trinta segundos, e é do dono.
      */
      const chaveCategoria = linha.global_catid2 ? `SHOPEE-${linha.global_catid2}` : null;
      const nichoId = chaveCategoria ? (porCategoria.get(chaveCategoria) ?? null) : null;

      if (!nichoId) {
        /*
          Sem nicho o anúncio não acha canal, então gravar seria encher
          o banco de item que nunca vira post.

          MAS SÓ RECLAMA DO QUE NINGUÉM OLHOU. Linha em `nicho_dominio`
          com nicho nulo quer dizer "olhamos e decidimos que não roteia"
          — é o caso de Watches e Travel & Luggage, decidido em 03/08.
          Ausência de linha é outra coisa: é categoria nova.

          A primeira versão disto reclamava dos dois, e teria repetido
          as mesmas oito categorias em todo relatório, para sempre, até
          alguém decidir de novo o que já estava decidido. Isso é o que
          a migration 45 existia para evitar.
        */
        if (chaveCategoria && !porCategoria.has(chaveCategoria)) {
          const nome = `${linha.global_category1} > ${linha.global_category2}`;
          const atual = semNicho.get(chaveCategoria) ?? { nome, n: 0 };
          atual.n++;
          semNicho.set(chaveCategoria, atual);
        }
        recusados.sem_nicho++;
        continue;
      }

      candidatos.push({ linha, sku, agora, antes, nota, nichoId, chaveCategoria, desconto });
    }
  }

  candidatos.sort((a, b) => b.desconto - a.desconto);
  const escolhidos = candidatos.slice(0, TETO);
  console.log(
    `\n${vistos} lidos · ${candidatos.length} passaram nas comportas · gravando os ${escolhidos.length} de maior desconto`,
  );

  {
    for (const { linha, sku, agora, antes, nota, nichoId, chaveCategoria } of escolhidos) {
      let { data: anuncio } = await db
        .from("anuncio")
        .select("id, produto_id")
        .eq("marketplace_id", mkt.id)
        .eq("sku_externo", sku)
        .maybeSingle();

      const campos = {
        dominio_externo: chaveCategoria,
        categoria_raiz: linha.global_category1 || null,
        categoria_folha: linha.global_category2 || null,
        vendedor: linha.shop_name || null,
        avaliacao: Number.isFinite(nota) && nota > 0 ? nota : null,
        imagem_url: linha.image_link || null,
        imagem_obtida_em: new Date().toISOString(),
        ultima_coleta_em: new Date().toISOString(),
      };

      // O "de" da loja é o que sustenta a oferta aqui: sem série
      // própria, é ele ou nada. Só entra quando é maior que o "por",
      // senão vira desconto inventado (regra 3.4).
      if (antes && antes > agora) {
        campos.preco_original_centavos = antes;
        campos.preco_original_visto_em = new Date().toISOString();
      }

      if (!anuncio) {
        const { data: produto, error: erroProduto } = await db
          .from("produto")
          .insert({
            operacao_id: mkt.operacao_id,
            nicho_id: nichoId,
            titulo_canonico: linha.title,
          })
          .select("id")
          .single();
        if (erroProduto) { console.error(`  ✗ produto: ${erroProduto.message}`); continue; }

        const { data: novo, error: erroAnuncio } = await db
          .from("anuncio")
          .insert({
            operacao_id: mkt.operacao_id,
            produto_id: produto.id,
            marketplace_id: mkt.id,
            sku_externo: sku,
            url_original: linha.product_link,
            ...campos,
          })
          .select("id")
          .single();
        if (erroAnuncio) { console.error(`  ✗ anuncio: ${erroAnuncio.message}`); continue; }

        anuncio = novo;
        entraram++;
      } else {
        await db.from("anuncio").update(campos).eq("id", anuncio.id);
        atualizados++;
      }

      await db.rpc("registra_preco", { p_anuncio_id: anuncio.id, p_preco_centavos: agora });
      await db.rpc("registra_leitura", { p_anuncio_id: anuncio.id, p_preco_centavos: agora });
    }
  }

  console.log(`\n${entraram} novos · ${atualizados} atualizados`);
  console.log(`recusados: ${JSON.stringify(recusados)}`);

  if (semNicho.size > 0) {
    console.log(`\n${semNicho.size} categorias sem nicho mapeado. As dez maiores:`);
    const maiores = [...semNicho.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10);
    for (const [chaveCat, { nome, n }] of maiores) {
      console.log(`  ${chaveCat}  ${nome}  (${n} itens)`);
    }
    console.log("Mapear em `nicho_dominio`: uma linha por categoria, apontando para o nicho.");
  }
}

await main();
