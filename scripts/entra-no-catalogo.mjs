/**
 * Põe produtos escolhidos à mão no catálogo, pelo mesmo caminho do
 * coletor.
 *
 * POR QUE ISTO EXISTE E NÃO É UM ATALHO: quando o dono pede "publica
 * este produto agora", a tentação é montar a mensagem e mandar direto
 * pelo bot. Isso pula o subid (regra 3.6), pula as comportas de
 * confiança e não deixa rastro em `publicacao` — a venda, se houver,
 * não é atribuível a canal nenhum.
 *
 * Aqui o produto entra no catálogo como qualquer outro: com domínio,
 * categoria, frete, vendedor, nota e preço original. Daí em diante
 * quem decide é a máquina de sempre. Se o produto merecer virar oferta,
 * `detecta_declarados` ou `detecta_quedas` cria; se não merecer, ele
 * fica no radar acumulando série, que é o desfecho certo.
 *
 * USO
 *   node scripts/entra-no-catalogo.mjs MLB62194379 MLB24441152 ...
 */

import { createClient } from "@supabase/supabase-js";

const API = "https://api.mercadolibre.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, chave, { auth: { persistSession: false } });

const PRODUTOS = process.argv.slice(2).filter((a) => /^MLB\d+$/.test(a));
if (PRODUTOS.length === 0) {
  console.error("Passe ao menos um id de produto: node scripts/entra-no-catalogo.mjs MLB123...");
  process.exit(1);
}

let ACESSO = "";
const api = async (rota) => {
  const r = await fetch(`${API}/${rota}`, { headers: { Authorization: `Bearer ${ACESSO}` } });
  return r.ok ? r.json() : null;
};

/** A mesma normalização do coletor: duas escalas do ML viram um número. */
function reputacaoDoVendedor(usuario) {
  const r = usuario?.seller_reputation;
  if (!r) return null;
  const porNivel = {
    "5_green": 1.0,
    "4_light_green": 0.8,
    "3_yellow": 0.6,
    "2_orange": 0.35,
    "1_red": 0.1,
  };
  return porNivel[r.level_id] ?? null;
}

const RAIZ_DE = new Map();
async function categoriaRaiz(id) {
  if (!id) return null;
  if (RAIZ_DE.has(id)) return RAIZ_DE.get(id);
  const c = await api(`categories/${id}`);
  const raiz = c?.path_from_root?.[0]?.id ?? null;
  RAIZ_DE.set(id, raiz);
  return raiz;
}

async function main() {
  const { data: mkt } = await db
    .from("marketplace")
    .select("id, operacao_id")
    .eq("slug", "mercado_livre")
    .single();

  const { data: cred } = await db
    .from("credencial_rotativa")
    .select("valor")
    .eq("marketplace_id", mkt.id)
    .eq("chave", "refresh_token")
    .maybeSingle();

  const t = await (
    await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        refresh_token: cred?.valor ?? process.env.ML_REFRESH_TOKEN,
      }),
    })
  ).json();
  ACESSO = t.access_token;

  const [{ data: dom }, { data: cat }] = await Promise.all([
    db.from("nicho_dominio").select("dominio_externo, nicho_id").eq("marketplace_id", mkt.id),
    db.from("nicho_categoria").select("categoria_raiz, nicho_id").eq("marketplace_id", mkt.id),
  ]);
  const porDominio = new Map((dom ?? []).map((d) => [d.dominio_externo, d.nicho_id]));
  const porCategoria = new Map((cat ?? []).map((c) => [c.categoria_raiz, c.nicho_id]));

  for (const produtoId of PRODUTOS) {
    try {
      const [produto, itens] = await Promise.all([
        api(`products/${produtoId}`),
        api(`products/${produtoId}/items?limit=10`),
      ]);
      if (!produto?.name) throw new Error("produto não encontrado");

      const vivas = (itens?.results ?? []).filter((i) => i.condition === "new" && i.price > 0);
      if (vivas.length === 0) throw new Error("sem oferta viva");

      // A mesma escolha do coletor: dentro de 5% do menor preço, ganha
      // o melhor vendedor. Nunca o mais barato e ponto.
      const menor = Math.min(...vivas.map((i) => i.price));
      const candidatos = await Promise.all(
        vivas
          .filter((i) => i.price <= menor * 1.05)
          .slice(0, 6)
          .map(async (i) => ({
            item: i,
            usuario: await api(`users/${i.seller_id}`),
          })),
      );
      candidatos.sort((a, b) => {
        const oa = Boolean(a.item.official_store_id);
        const ob = Boolean(b.item.official_store_id);
        if (oa !== ob) return oa ? -1 : 1;
        const ra = reputacaoDoVendedor(a.usuario) ?? 0;
        const rb = reputacaoDoVendedor(b.usuario) ?? 0;
        if (rb !== ra) return rb - ra;
        return a.item.price - b.item.price;
      });

      const { item, usuario } = candidatos[0];
      const avaliacoes = await api(`reviews/item/${item.item_id}`);
      const raiz = await categoriaRaiz(item.category_id);
      const nichoId =
        (porDominio.has(produto.domain_id)
          ? porDominio.get(produto.domain_id)
          : porCategoria.get(raiz)) ?? null;

      let { data: linha } = await db
        .from("produto")
        .select("id")
        .eq("operacao_id", mkt.operacao_id)
        .eq("titulo_canonico", produto.name)
        .maybeSingle();

      if (!linha) {
        const { data: novo, error } = await db
          .from("produto")
          .insert({
            operacao_id: mkt.operacao_id,
            nicho_id: nichoId,
            titulo_canonico: produto.name,
          })
          .select("id")
          .single();
        if (error) throw new Error(`produto: ${error.message}`);
        linha = novo;
      }

      const campos = {
        dominio_externo: produto.domain_id ?? null,
        categoria_raiz: raiz,
        categoria_folha: item.category_id ?? null,
        frete_gratis: item.shipping?.free_shipping ?? null,
        vendedor: usuario?.nickname ?? `vendedor ${item.seller_id}`,
        loja_oficial: Boolean(item.official_store_id),
        reputacao_vendedor: reputacaoDoVendedor(usuario),
        vendas_estimadas: usuario?.seller_reputation?.transactions?.total ?? null,
        avaliacao: avaliacoes?.rating_average ?? null,
        avaliacao_qtd: avaliacoes?.paging?.total ?? null,
        imagem_url: produto.pictures?.[0]?.url ?? produto.pictures?.[0]?.secure_url ?? null,
        imagem_obtida_em: new Date().toISOString(),
        ultima_coleta_em: new Date().toISOString(),
        promocoes: item.deal_ids ?? null,
      };

      if (Number.isFinite(Number(item.original_price)) && item.original_price > item.price) {
        campos.preco_original_centavos = Math.round(item.original_price * 100);
        campos.preco_original_visto_em = new Date().toISOString();
      }

      let { data: anuncio } = await db
        .from("anuncio")
        .select("id")
        .eq("marketplace_id", mkt.id)
        .eq("sku_externo", item.item_id)
        .maybeSingle();

      if (!anuncio) {
        const { data: novo, error } = await db
          .from("anuncio")
          .insert({
            operacao_id: mkt.operacao_id,
            produto_id: linha.id,
            marketplace_id: mkt.id,
            sku_externo: item.item_id,
            url_original: `https://www.mercadolivre.com.br/p/${produtoId}`,
            ...campos,
          })
          .select("id")
          .single();
        if (error) throw new Error(`anuncio: ${error.message}`);
        anuncio = novo;
      } else {
        await db.from("anuncio").update(campos).eq("id", anuncio.id);
      }

      const centavos = Math.round(item.price * 100);
      await db.rpc("registra_preco", { p_anuncio_id: anuncio.id, p_preco_centavos: centavos });
      await db.rpc("registra_leitura", { p_anuncio_id: anuncio.id, p_preco_centavos: centavos });

      console.log(
        `  ✓ R$ ${(centavos / 100).toFixed(2).padStart(8)}  ${nichoId ? "com nicho" : "SEM NICHO"}  ${produto.name.slice(0, 50)}`,
      );
    } catch (e) {
      console.log(`  ✗ ${produtoId}: ${e.message}`);
    }
  }
}

await main();
