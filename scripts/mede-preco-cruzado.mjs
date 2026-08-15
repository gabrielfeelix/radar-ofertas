/**
 * MEDE QUANTO O CANAL DEIXA NA MESA POR NÃO CRUZAR MARKETPLACE.
 *
 * A PERGUNTA, que é do dono em 15/08: *"eu vou na Shopee, procuro o
 * mesmo produto, e muitas vezes tem bem mais barato. A gente não achou
 * o produto mais barato, a gente só achou um produto com a comissão."*
 *
 * POR QUE MEDIR ANTES DE CONSTRUIR: se em 5% das ofertas existe mais
 * barato do outro lado, isto é otimização e espera. Se for 40%, é a
 * coisa mais importante do roadmap. Os dois caminhos custam caro e são
 * diferentes, e escolher sem o número é chute.
 *
 * NÃO PRECISA DE API NENHUMA. Os 27.977 anúncios da Shopee já estão no
 * banco, colhidos do feed de produto. O que nunca aconteceu foi
 * COMPARAR os dois catálogos, porque a identidade é montada a partir
 * dos atributos do Mercado Livre e o feed da Shopee não traz atributo.
 *
 * A PRIMEIRA VERSÃO DESTE SCRIPT MENTIU, e o registro fica porque a
 * lição vale mais que o script. Ela exigia três palavras em comum e
 * quantidades iguais, e o comentário afirmava que isso "erra para o
 * lado de não casar, então o número é um PISO". Deu 71%, e os pares
 * mostravam o contrário:
 *
 *   "Protetor solar Sallve 90FPS"     casou com  "Arroz Prego Quadro Óculos"
 *   "Shampoo A Seco Eimi Wella"       casou com  "Shampoo Cães e Gatos Neem Pet"
 *   "Máscara Facial LED 7 Cores"      casou com  "Mini Lanterna Chaveiro LED"
 *
 * Três palavras em comum não é semelhança quando o título tem quinze.
 * O número não era piso, era ruído, e reportá-lo teria enviesado uma
 * decisão de roadmap.
 *
 * AGORA O CASAMENTO EXIGE PROPORÇÃO, não contagem: metade das palavras
 * significativas do nosso título tem que estar no deles, a primeira
 * palavra (que carrega marca ou tipo) tem que bater, e as quantidades
 * continuam tendo que ser idênticas. Ainda erra, e por isso o script
 * imprime cada par: **o número só vale depois de olhar a lista.**
 *
 * Rodar:
 *   node --env-file=.env.producao --experimental-strip-types \
 *     scripts/mede-preco-cruzado.mjs [quantas]
 */
import { createClient } from "@supabase/supabase-js";

const ML = "c2ac8b78-6478-49f8-a217-e3f94f5450d1";
const SHOPEE = "80f32767-0759-40d0-8e3b-b0cb89a44a74";
const BELEZA = "349ce193-5ee0-40a5-945e-7a70799bf050";
const QUANTAS = Number(process.argv[2] ?? 30);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Palavras sem valor discriminante num título de produto. */
const VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "para", "por", "e", "a", "o", "as", "os", "em",
  "un", "kit", "original", "novo", "nova", "promocao", "frete", "gratis", "envio", "pronta",
  "entrega", "ml", "g", "kg", "gr", "cor", "tom", "tipo", "linha", "the", "of",
]);

const palavras = (t) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !VAZIAS.has(p) && !/^\d+$/.test(p));

/**
 * Números que precisam bater exatamente.
 *
 * A lista de unidades cresceu depois da segunda rodada, que ainda
 * casava `Gillette Mach3 16 Unidades` com `Gillette Mach3 2 Cartuchos`
 * e `Kit Brae 3 Itens` com um leave-in avulso. Peso e volume estavam
 * cobertos; contagem de peça não estava, e é justamente onde a
 * diferença de preço engana.
 */
const quantidades = (t) => {
  const un = "ml|g|gr|kg|l|un|unid|unidades?|itens|item|pe(c|ç)as?|cartuchos?|cargas?|refis|refil|folhas?|caps(ulas)?";
  const limpo = t.toLowerCase().replace(new RegExp(`(\\d)\\s+(${un})\\b`, "g"), "$1$2");
  const achados = [...limpo.matchAll(new RegExp(`\\d+(?:[.,]\\d+)?(?:${un})\\b`, "g"))].map((m) =>
    m[0].replace(",", "."),
  );
  // "Kit com 3", "leve 5": contagem que vem antes da palavra.
  for (const m of limpo.matchAll(/\b(?:kit|leve|com|pack)\s*(?:com\s*)?(\d{1,3})\b/g)) {
    achados.push(`kit${m[1]}`);
  }
  return new Set(achados);
};

const reais = (c) => (c / 100).toFixed(2).replace(".", ",");

console.log(`\nLendo ${QUANTAS} ofertas de beleza do Mercado Livre...\n`);

const { data: ofertas, error } = await db
  .from("oferta")
  .select(
    "id, preco_atual_centavos, anuncio:anuncio_id!inner(id, marketplace_id, produto:produto_id!inner(titulo_canonico, nicho_id))",
  )
  .eq("status", "aprovada")
  .eq("anuncio.marketplace_id", ML)
  .eq("anuncio.produto.nicho_id", BELEZA)
  .order("detectada_em", { ascending: false })
  .limit(QUANTAS);

if (error) {
  console.error("não consegui ler as ofertas:", error.message);
  process.exit(1);
}
if (!ofertas?.length) {
  console.error("nenhuma oferta aprovada de beleza no Mercado Livre agora.");
  process.exit(1);
}

// O catálogo da Shopee inteiro, uma vez, em memória. São dezenas de
// milhares de linhas curtas: cabe, e evita uma consulta por oferta.
console.log("Carregando o catálogo da Shopee...");
const shopee = [];
for (let off = 0; ; off += 1000) {
  const { data } = await db
    .from("anuncio")
    .select("preco_leitura_centavos, url_original, produto:produto_id!inner(titulo_canonico)")
    .eq("marketplace_id", SHOPEE)
    .eq("ativo", true)
    .not("preco_leitura_centavos", "is", null)
    .range(off, off + 999);
  if (!data?.length) break;
  for (const a of data) {
    const t = a.produto?.titulo_canonico;
    if (!t) continue;
    shopee.push({
      titulo: t,
      centavos: a.preco_leitura_centavos,
      url: a.url_original,
      palavras: new Set(palavras(t)),
      quantidades: quantidades(t),
    });
  }
  if (data.length < 1000) break;
}
console.log(`  ${shopee.length} anúncios da Shopee em memória\n`);

let comparaveis = 0;
let temMaisBarato = 0;
let economiaTotal = 0;
const achados = [];

for (const o of ofertas) {
  const titulo = o.anuncio.produto.titulo_canonico;
  const pals = palavras(titulo);
  const qtds = quantidades(titulo);
  if (pals.length < 2) continue;

  // A marca é a primeira palavra significativa que não é o tipo do
  // produto. Grosseiro, e é o suficiente para exigir que ela apareça.
  const candidatos = shopee.filter((s) => {
    // A primeira palavra significativa carrega marca ou tipo, e sem ela
    // "shampoo de cachorro" vira par de "shampoo a seco Wella".
    if (!s.palavras.has(pals[0])) return false;

    const comuns = pals.filter((p) => s.palavras.has(p));
    // Proporção, e não contagem: três palavras em comum num título de
    // quinze é coincidência, num de quatro é o mesmo produto.
    if (comuns.length / pals.length < 0.5) return false;
    if (comuns.length < 3) return false;

    // Toda quantidade do nosso título tem que existir no deles. 90FPS
    // não casa com nada que não diga 90.
    for (const q of qtds) if (!s.quantidades.has(q)) return false;
    return true;
  });

  if (!candidatos.length) continue;
  comparaveis++;

  const maisBarato = candidatos.reduce((a, b) => (b.centavos < a.centavos ? b : a));
  if (maisBarato.centavos < o.preco_atual_centavos) {
    temMaisBarato++;
    const economia = o.preco_atual_centavos - maisBarato.centavos;
    economiaTotal += economia;
    achados.push({
      titulo,
      nosso: o.preco_atual_centavos,
      deles: maisBarato.centavos,
      economia,
      pct: Math.round((economia / o.preco_atual_centavos) * 100),
      tituloDeles: maisBarato.titulo,
      url: maisBarato.url,
    });
  }
}

console.log("=".repeat(66));
console.log(`Ofertas lidas:                       ${ofertas.length}`);
console.log(`Com algum par plausível na Shopee:   ${comparaveis}`);
console.log(`Em que a Shopee está mais barata:    ${temMaisBarato}`);
if (comparaveis) {
  console.log(`                                     ${Math.round((temMaisBarato / comparaveis) * 100)}% das comparáveis`);
}
console.log(`                                     ${Math.round((temMaisBarato / ofertas.length) * 100)}% de tudo que lemos`);
if (temMaisBarato) {
  console.log(`Economia somada:                     R$ ${reais(economiaTotal)}`);
  console.log(`Economia média por achado:           R$ ${reais(Math.round(economiaTotal / temMaisBarato))}`);
}
console.log("=".repeat(66));

if (achados.length) {
  console.log("\nOs achados, do maior para o menor. CONFIRA À MÃO antes de acreditar:");
  console.log("o casamento é por palavra, e palavra casa produto parecido.\n");
  for (const a of achados.sort((x, y) => y.economia - x.economia).slice(0, 12)) {
    console.log(`  ${a.titulo.slice(0, 60)}`);
    console.log(`    nós:    R$ ${reais(a.nosso)}`);
    console.log(`    Shopee: R$ ${reais(a.deles)}  (${a.pct}% menos)  ${a.tituloDeles.slice(0, 46)}`);
    console.log(`    ${a.url ?? ""}\n`);
  }
}

console.log(
  "\nLEIA ISTO ANTES DE DECIDIR. O casamento é por palavra, e palavra casa\n" +
    "produto parecido: a primeira versão deste script deu 71% casando\n" +
    "protetor solar com quadro de arroz. Olhe a lista acima par por par e\n" +
    "risque os falsos ANTES de usar a porcentagem para decidir qualquer\n" +
    "coisa. O número sozinho não vale nada.\n",
);
