/**
 * Dá identidade ao catálogo e funde o que era o mesmo produto.
 *
 * O QUE ELE CONSERTA: até 01/08 o `produto` era chaveado pelo título
 * do catálogo do Mercado Livre. Como o ML cadastra o mesmo item
 * físico com vários títulos, o mesmo saco de ração virou vários
 * produtos nossos, e a comparação de preço nunca cruzou entre eles.
 * O canal publicou R$ 130,00 existindo R$ 119,90 do mesmo item.
 *
 * O QUE ELE FAZ, em duas passadas:
 *
 *   1. pergunta à API os atributos de cada catálogo, calcula a chave
 *      de identidade e grava
 *   2. funde os produtos que caíram na mesma chave: os anúncios migram
 *      para o mais antigo, e os vazios são apagados
 *
 * E UMA TERCEIRA, opcional e mais cara: `--procura-irmaos` busca no
 * catálogo do ML por outras prateleiras do mesmo produto que a gente
 * ainda não conhece. É o que transforma "comparo o que eu tenho" em
 * "comparo o que existe".
 *
 * Rode com `--seco` para ver o que mudaria sem mudar nada.
 */

import { createClient } from "@supabase/supabase-js";

import { atributosDe, chaveDeIdentidade, saoOMesmoProduto } from "../lib/identidade.ts";

const API = "https://api.mercadolibre.com";
const SECO = process.argv.includes("--seco");
const PROCURA_IRMAOS = process.argv.includes("--procura-irmaos");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let ACESSO = "";
const api = async (rota) => {
  const r = await fetch(`${API}/${rota}`, { headers: { Authorization: `Bearer ${ACESSO}` } });
  return r.ok ? r.json() : null;
};

async function autentica(mktId) {
  const { data: cred } = await db
    .from("credencial_rotativa")
    .select("valor")
    .eq("marketplace_id", mktId)
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
  if (!t.access_token) throw new Error("não renovei o token");
  ACESSO = t.access_token;
}

const reais = (c) => (c == null ? "  —  " : `R$ ${(c / 100).toFixed(2)}`);

async function main() {
  const { data: mkt } = await db
    .from("marketplace")
    .select("id, operacao_id")
    .eq("slug", "mercado_livre")
    .single();

  await autentica(mkt.id);

  const { data: anuncios } = await db
    .from("anuncio")
    .select("id, produto_id, produto_externo_id, url_original, preco_leitura_centavos")
    .eq("marketplace_id", mkt.id);

  console.log(`${(anuncios ?? []).length} anúncios\n`);

  // ---- 1. a identidade de cada catálogo -----------------------
  const identidadeDe = new Map(); // produtoExternoId -> chave
  const atributosDe_ = new Map(); // produtoExternoId -> atributos
  const catalogos = [...new Set((anuncios ?? []).map((a) => a.produto_externo_id).filter(Boolean))];

  const lote = 12;
  for (let i = 0; i < catalogos.length; i += lote) {
    const resultados = await Promise.all(
      catalogos.slice(i, i + lote).map(async (id) => {
        const p = await api(`products/${id}`);
        if (!p?.name) return null;
        return {
          id,
          chave: chaveDeIdentidade(atributosDe(p), p.domain_id, p.name),
          atributos: atributosDe(p),
        };
      }),
    );
    for (const r of resultados) {
      if (!r?.chave) continue;
      identidadeDe.set(r.id, r.chave);
      atributosDe_.set(r.id, r.atributos);
    }
  }

  console.log(`${identidadeDe.size} de ${catalogos.length} catálogos têm identidade`);

  // ---- 2. quem funde com quem ---------------------------------
  const porChave = new Map(); // chave -> Set(produto_id)
  for (const a of anuncios ?? []) {
    const chave = identidadeDe.get(a.produto_externo_id);
    if (!chave) continue;
    if (!porChave.has(chave)) porChave.set(chave, new Set());
    porChave.get(chave).add(a.produto_id);
  }

  const fusoes = [...porChave].filter(([, ids]) => ids.size > 1);
  console.log(`${fusoes.length} identidades com mais de um produto\n`);

  let fundidos = 0;
  let economiaTotal = 0;

  for (const [chave, ids] of fusoes) {
    const lista = [...ids];

    const { data: produtos } = await db
      .from("produto")
      .select("id, titulo_canonico, nicho_id, nota_curador, criado_em")
      .in("id", lista)
      .order("criado_em");

    // O mais antigo sobrevive: ele é o que tem mais chance de já ter
    // nota do curador escrita e de estar referenciado em publicação.
    const [ficam, ...somem] = produtos ?? [];
    if (!ficam) continue;

    const precos = (anuncios ?? [])
      .filter((a) => lista.includes(a.produto_id) && a.preco_leitura_centavos != null)
      .map((a) => a.preco_leitura_centavos);

    const diferenca = precos.length > 1 ? Math.max(...precos) - Math.min(...precos) : 0;
    economiaTotal += diferenca;

    console.log(`  ${chave}`);
    console.log(
      `    ${lista.length} produtos · ${precos.length} anúncios · de ${reais(Math.min(...precos))} a ${reais(Math.max(...precos))}` +
        (diferenca > 0 ? `  ← ${reais(diferenca)} de diferença` : ""),
    );

    if (SECO) continue;

    // Os anúncios migram para o sobrevivente, e a nota do curador é
    // herdada se ele não tiver: opinião escrita à mão não se perde
    // numa fusão automática.
    const notaHerdada = ficam.nota_curador ?? somem.find((p) => p.nota_curador)?.nota_curador ?? null;
    const nichoHerdado = ficam.nicho_id ?? somem.find((p) => p.nicho_id)?.nicho_id ?? null;

    await db
      .from("anuncio")
      .update({ produto_id: ficam.id })
      .in(
        "produto_id",
        somem.map((p) => p.id),
      );

    await db
      .from("produto")
      .update({
        chave_identidade: chave,
        nota_curador: notaHerdada,
        nicho_id: nichoHerdado,
        atributos:
          atributosDe_.get(
            (anuncios ?? []).find((a) => lista.includes(a.produto_id))?.produto_externo_id,
          ) ?? null,
      })
      .eq("id", ficam.id);

    // Só apaga o que ficou vazio. Produto ainda referenciado em
    // publicação fica, mesmo sem anúncio: apagar reescreveria o
    // histórico do que já foi ao canal.
    for (const p of somem) {
      const { count } = await db
        .from("anuncio")
        .select("id", { count: "exact", head: true })
        .eq("produto_id", p.id);
      if ((count ?? 0) === 0) await db.from("produto").delete().eq("id", p.id);
    }

    fundidos += somem.length;
  }

  // ---- 3. identidade para quem não fundiu ---------------------
  if (!SECO) {
    for (const a of anuncios ?? []) {
      const chave = identidadeDe.get(a.produto_externo_id);
      if (!chave) continue;
      await db
        .from("produto")
        .update({ chave_identidade: chave, atributos: atributosDe_.get(a.produto_externo_id) ?? null })
        .eq("id", a.produto_id)
        .is("chave_identidade", null);
    }
  }

  console.log(
    `\n${fundidos} produtos fundidos · ${reais(economiaTotal)} de diferença somada entre prateleiras${SECO ? "  (SECO)" : ""}`,
  );

  // ---- 4. procurar prateleiras que ainda não conhecemos --------
  if (PROCURA_IRMAOS) await procuraIrmaos(mkt, anuncios ?? [], identidadeDe);
}

/**
 * Procura no catálogo do ML outras prateleiras do mesmo produto.
 *
 * É a diferença entre "comparo o que eu tenho" e "comparo o que
 * existe". Custa uma busca por produto, então roda sob demanda e não a
 * cada coleta.
 *
 * O casamento é pela CHAVE, nunca pelo texto: a busca só serve para
 * levantar candidatos, e quem decide se é o mesmo item é a identidade.
 * Casar por título foi o que causou a bagunça de nicho na semana
 * passada.
 */
async function procuraIrmaos(mkt, anuncios, identidadeDe) {
  const conhecidos = new Set(anuncios.map((a) => a.produto_externo_id));

  const { data: produtos } = await db
    .from("produto")
    .select("id, titulo_canonico, chave_identidade, atributos")
    .eq("operacao_id", mkt.operacao_id)
    .not("chave_identidade", "is", null)
    .limit(Number(process.env.ML_IRMAOS_POR_RODADA ?? 60));

  console.log(`\nprocurando irmãos de ${(produtos ?? []).length} produtos\n`);

  let achados = 0;

  for (const p of produtos ?? []) {
    const busca = await api(
      `products/search?site_id=MLB&status=active&limit=12&q=${encodeURIComponent(p.titulo_canonico.slice(0, 60))}`,
    );

    for (const r of busca?.results ?? []) {
      if (conhecidos.has(r.id)) continue;

      const cat = await api(`products/${r.id}`);
      if (!cat?.name) continue;

      /*
        A CHAVE SÓ LEVANTA CANDIDATO. QUEM DECIDE É A COMPARAÇÃO AOS
        PARES, e a diferença não é acadêmica: com a chave sozinha, a
        primeira varredura casou o cabo HDMI de 5m com o de 20m, o Omo
        de 800g com o de 4kg e seis essências de perfumes diferentes.

        A comparação aos pares enxerga os atributos dos DOIS, então
        `FRAGRANCE = Bambu` contra `FRAGRANCE = Lavanda` separa mesmo
        que ninguém tenha previsto que perfume importa.
      */
      const chave = chaveDeIdentidade(atributosDe(cat), cat.domain_id, cat.name);
      if (chave !== p.chave_identidade) continue;

      const mesmo = saoOMesmoProduto(
        { atributos: atributosDe(cat), titulo: cat.name },
        { atributos: p.atributos ?? {}, titulo: p.titulo_canonico },
      );
      if (!mesmo) continue;

      const itens = await api(`products/${r.id}/items?limit=20`);
      const vivas = (itens?.results ?? []).filter((i) => i.condition === "new" && i.price > 0);
      if (vivas.length === 0) continue;

      const menor = Math.min(...vivas.map((i) => i.price));
      console.log(`  + ${r.id} ${reais(Math.round(menor * 100))}  ${cat.name.slice(0, 50)}`);
      console.log(`      irmão de: ${p.titulo_canonico.slice(0, 50)}`);
      achados++;
      conhecidos.add(r.id);

      if (SECO) continue;

      // Entra como anúncio do MESMO produto. O preço dele passa a
      // concorrer na hora de escolher o que publicar, que é o ponto.
      const escolhida = vivas.reduce((m, i) => (i.price < m.price ? i : m));
      const { error } = await db.from("anuncio").insert({
        operacao_id: mkt.operacao_id,
        produto_id: p.id,
        marketplace_id: mkt.id,
        sku_externo: escolhida.item_id,
        produto_externo_id: r.id,
        url_original: `https://www.mercadolivre.com.br/p/${r.id}`,
        dominio_externo: cat.domain_id ?? null,
        categoria_folha: escolhida.category_id ?? null,
        frete_gratis: escolhida.shipping?.free_shipping ?? null,
        loja_oficial: Boolean(escolhida.official_store_id),
        ultima_coleta_em: new Date().toISOString(),
      });
      if (error) console.log(`      ✗ ${error.message}`);
    }
  }

  console.log(`\n${achados} prateleira(s) nova(s) do mesmo produto${SECO ? "  (SECO)" : ""}`);
}

/**
 * Confere as fusões que já estão no banco e desfaz as erradas.
 *
 * POR QUE ELE PRECISOU EXISTIR: a primeira fusão rodou com a chave
 * frouxa, antes da trava de quantidades e da comparação aos pares. Ela
 * juntou coisas que não são o mesmo produto, e o estrago ficou gravado
 * — fundir apaga o produto antigo, então não há como "desfazer" pelo
 * histórico.
 *
 * Enquanto a fusão errada só bagunçava o catálogo, dava para conviver.
 * A partir do momento em que a publicação TROCA de prateleira pela mais
 * barata do mesmo produto, uma fusão errada faz o canal anunciar o
 * preço de um item com o nome de outro. Aí vira urgência.
 *
 * Ele separa de novo: cada anúncio que não passa na comparação aos
 * pares contra o primeiro ganha um produto próprio.
 */
async function revisaFusoes(mkt) {
  const { data: produtos } = await db
    .from("produto")
    .select("id, titulo_canonico, nicho_id, chave_identidade, anuncio(id, produto_externo_id)")
    .eq("operacao_id", mkt.operacao_id);

  const suspeitos = (produtos ?? []).filter(
    (p) => new Set((p.anuncio ?? []).map((a) => a.produto_externo_id)).size > 1,
  );

  console.log(`\n${suspeitos.length} produtos com mais de uma prateleira, conferindo`);

  let separados = 0;

  for (const p of suspeitos) {
    const catalogos = [...new Set((p.anuncio ?? []).map((a) => a.produto_externo_id))].filter(Boolean);

    const fichas = new Map();
    for (const c of catalogos) {
      const cat = await api(`products/${c}`);
      if (cat?.name) fichas.set(c, { atributos: atributosDe(cat), titulo: cat.name });
    }

    const [base, ...resto] = catalogos;
    const fichaBase = fichas.get(base);
    if (!fichaBase) continue;

    for (const c of resto) {
      const f = fichas.get(c);
      if (!f) continue;
      if (saoOMesmoProduto(fichaBase, f)) continue;

      console.log(`  ✂ ${c} não é o mesmo que ${base}`);
      console.log(`      ${f.titulo.slice(0, 58)}`);
      console.log(`      ${fichaBase.titulo.slice(0, 58)}`);
      separados++;

      if (SECO) continue;

      const { data: novo } = await db
        .from("produto")
        .insert({
          operacao_id: mkt.operacao_id,
          nicho_id: p.nicho_id,
          titulo_canonico: f.titulo,
          chave_identidade: chaveDeIdentidade(f.atributos, null, f.titulo)
            ? `${chaveDeIdentidade(f.atributos, null, f.titulo)}|${c}`
            : null,
          atributos: f.atributos,
        })
        .select("id")
        .single();

      if (!novo) continue;

      await db
        .from("anuncio")
        .update({ produto_id: novo.id })
        .eq("produto_id", p.id)
        .eq("produto_externo_id", c);
    }
  }

  console.log(`\n${separados} prateleira(s) separada(s) de volta${SECO ? "  (SECO)" : ""}`);
}

if (process.argv.includes("--revisa")) {
  const { data: mkt } = await db
    .from("marketplace")
    .select("id, operacao_id")
    .eq("slug", "mercado_livre")
    .single();
  await autentica(mkt.id);
  await revisaFusoes(mkt);
} else {
  await main();
}
