/**
 * A identidade de um produto, que é o que diz se dois anúncios são a
 * mesma coisa.
 *
 * POR QUE ISTO PRECISOU EXISTIR, e o caso é literal: em 01/08 o canal
 * publicou uma ração a R$ 130,00. O mesmo saco estava a R$ 119,90, e a
 * gente não viu. Não foi erro de escolha de vendedor: dentro do
 * catálogo que olhamos, R$ 130 era mesmo o menor de 35 vendedores.
 *
 * O problema é que o Mercado Livre cadastra o MESMO produto físico
 * várias vezes:
 *
 *   MLB36519405  R$ 119,90  "Special Cat Mix Premium Ração Para Gato Adulto 10,1kg"
 *   MLB24441152  R$ 130,00  "Alimento Special Cat Mix Adultos 10,1kg"
 *   MLB44069604  R$ 135,90  "Alimento Para Gatos Adultos Special Cat Mix 10,1kg"
 *
 * Três títulos, três catálogos, e os atributos são idênticos: marca
 * Special Cat, linha Premium, peso 10.1 kg, sabor Mix.
 *
 * E O DEFEITO ERA NOSSO, não do ML. O `docs/dados.md` sempre disse que
 * `produto` é "a identidade da coisa" e `anuncio` é "esse produto numa
 * loja específica". Na prática o `produto` era chaveado pelo TÍTULO do
 * catálogo — então quatro títulos viraram quatro produtos, e a
 * comparação de preço nunca atravessava entre eles.
 *
 * Aqui a identidade deixa de depender do título.
 */

/** Os atributos do produto, como o ML devolve: id → valor. */
export type AtributosDoProduto = Record<string, string | null | undefined>;

/**
 * Normaliza um pedaço da chave.
 *
 * Agressivo de propósito: "10.1 kg", "10,1 Kg" e "10.1kg" são o mesmo
 * peso, e se sobreviverem diferentes a identidade se parte de novo,
 * que é exatamente o defeito que isto conserta.
 */
export function normaliza(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/,/g, ".")
    // "10.10 kg" e "10.1 kg" são o mesmo peso: zero à direita de decimal cai.
    .replace(/(\d+\.\d*?)0+(?=\D|$)/g, "$1")
    .replace(/(\d+)\.(?=\D|$)/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Os atributos que compõem a identidade, em ordem.
 *
 * A escolha é conservadora: só entra atributo que, se mudar, muda o
 * produto de verdade. Cor não entra em ração; peso entra sempre.
 * Errar para o lado de NÃO fundir é o lado barato — dois produtos
 * separados custam uma comparação perdida, enquanto dois produtos
 * fundidos por engano fazem o canal anunciar o preço de um item
 * mostrando a foto de outro.
 */
const COMPOEM = [
  "BRAND",
  "LINE",
  "MODEL",
  "UNIT_WEIGHT",
  "WEIGHT",
  "VOLUME",
  "UNIT_VOLUME",
  "FLAVOR",
  "PACKAGE_UNITS",
  "CAPACITY",
  /*
    Os quatro abaixo entraram depois de a primeira versão errar feio, e
    o erro é o argumento para eles existirem.

    Sem `INTERNAL_MEMORY` e `RAM`, o Galaxy A17 de 128GB/4GB (R$ 925) e
    o de 256GB/8GB (R$ 1.877) caíam na MESMA identidade: marca, linha,
    modelo e peso são idênticos nos dois. O canal anunciaria o celular
    caro pelo preço do barato, que é pior do que não comparar nada.

    `COLOR` e `SIZE` entram pelo mesmo motivo, com um custo aceito:
    eles fragmentam a identidade em produto onde a cor não muda preço,
    e a gente perde algumas comparações. É o lado barato de errar.
  */
  "INTERNAL_MEMORY",
  "RAM",
  "COLOR",
  "SIZE",
];

/**
 * As quantidades que aparecem no TÍTULO, normalizadas e ordenadas.
 *
 * POR QUE ISTO PRECISOU EXISTIR, e a lição é geral: a lista de
 * atributos acima é uma lista BRANCA, e lista branca só enxerga o que
 * alguém lembrou de pôr nela. A primeira varredura de irmãos, rodada
 * contra o catálogo real, casou:
 *
 *   "Cabo Hdmi 5m"        com  "Cabo Hdmi 20m"
 *   "Omo em pó 800gr"     com  "Omo em pó 4kg"
 *   "Papel Neve 4 rolos"  com  "Papel Neve 24 rolos"
 *   "Kit 30 cabides"      com  "Kit 50 cabides"
 *
 * Em todos, o atributo que diferenciava (comprimento, peso líquido,
 * unidades por pacote) simplesmente não estava cadastrado, ou estava
 * com um id que a lista não previa. Ampliar a lista resolveria estes
 * quatro e deixaria o quinto passar.
 *
 * O título, ao contrário, quase sempre carrega a quantidade — porque é
 * o que o comprador procura. Então ele vira uma trava independente:
 * dois produtos só são o mesmo se as quantidades do título baterem.
 *
 * É grosseiro e é de propósito. Ele não tenta entender o título, só
 * recusa quando os números discordam.
 */
export function quantidadesDoTitulo(titulo: string): string {
  const unidades = "kg|kgs|g|gr|gramas|ml|l|litros?|m|cm|mm|un|unid|unidades?|rolos?|folhas?|pe(c|ç)as?|pcs|caps(ulas)?|comprimidos?";
  const achados: string[] = [];

  for (const m of titulo.toLowerCase().matchAll(
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${unidades})\\b`, "gi"),
  )) {
    achados.push(normaliza(`${m[1]}${m[2]}`));
  }

  // "Kit 3un", "Kit com 72", "50 Cabides": quantidade de pacote que
  // vem antes da palavra, sem unidade colada.
  for (const m of titulo.toLowerCase().matchAll(/\b(?:kit|leve|com|pack)\s*(?:com\s*)?(\d{1,3})\b/gi)) {
    achados.push(normaliza(`kit${m[1]}`));
  }

  // Ordenado para "5m 4k" e "4k 5m" darem o mesmo, e sem repetição.
  return [...new Set(achados)].sort().join("+");
}

/**
 * A chave de identidade, ou nulo quando não dá para afirmar.
 *
 * NULO É RESPOSTA, e é o caso mais comum em produto genérico sem marca
 * cadastrada. Produto sem identidade não funde com ninguém e continua
 * valendo por si — o que se perde é a comparação entre catálogos, não
 * o produto.
 *
 * O GTIN vence tudo quando existe: é o código de barras, e dois itens
 * com o mesmo GTIN são o mesmo item, sem discussão.
 */
export function chaveDeIdentidade(
  atributos: AtributosDoProduto,
  dominio?: string | null,
  titulo?: string | null,
): string | null {
  const gtin = normaliza(atributos.GTIN);
  if (gtin && gtin.length >= 8) return `gtin:${gtin}`;

  const partes = COMPOEM.map((id) => normaliza(atributos[id])).filter(Boolean);

  // Marca sozinha não identifica nada: "special-cat" casaria a ração de
  // gato adulto com a de filhote. Exige-se marca MAIS um qualificador.
  const temMarca = Boolean(normaliza(atributos.BRAND));
  if (!temMarca || partes.length < 2) return null;

  // O domínio entra na chave porque a mesma marca vende coisas
  // diferentes: "Premier 500g" de ração e de petisco são dois produtos.
  const escopo = normaliza(dominio) || "sem-dominio";

  // A trava das quantidades entra por último e só quando existe. Título
  // sem número nenhum não fica mais frouxo do que já era.
  const quantidades = titulo ? quantidadesDoTitulo(titulo) : "";
  const sufixo = quantidades ? `#${quantidades}` : "";

  return `${escopo}:${partes.join("_")}${sufixo}`;
}

/**
 * Atributos que NÃO dizem nada sobre a identidade.
 *
 * ESTA LISTA É PRETA, E A INVERSÃO É A LIÇÃO PRINCIPAL DESTE ARQUIVO.
 *
 * A lista branca `COMPOEM` perdeu três vezes contra o catálogo real, e
 * sempre do mesmo jeito: o atributo que separava os dois produtos
 * existia, e simplesmente não estava nela.
 *
 *   Galaxy A17 128GB vs 256GB   →  faltava INTERNAL_MEMORY
 *   Cabo HDMI 5m vs 20m         →  faltava o comprimento
 *   Essência Bambu vs Lavanda   →  faltava FRAGRANCE
 *
 * Ampliar a lista branca conserta o caso que apareceu e deixa o
 * próximo passar, porque cada domínio do Mercado Livre tem o seu
 * atributo discriminante e são milhares.
 *
 * Com lista preta o padrão se inverte: atributo desconhecido SEPARA em
 * vez de ser ignorado. Errar passa a custar uma comparação perdida, e
 * não um anúncio com o preço de outro produto.
 */
const RUIDO = new Set([
  "SHELF_LIFE",
  "SALE_FORMAT",
  "IS_SPARE",
  "SPACES_USE",
  "WITH_ETHANOL",
  "IS_ANTISEPTIC",
  "IS_ANTIDAMPNESS",
  "IS_KIT",
  "WARRANTY_TYPE",
  "WARRANTY_TIME",
  "ITEM_CONDITION",
  "EMPTY_GTIN_REASON",
  "MANUFACTURER",
  "SUPPLIER",
  "DETAILED_MODEL",
  "MAIN_COLOR",
]);

/**
 * Estes dois catálogos são o mesmo produto?
 *
 * A CHAVE AGRUPA, MAS QUEM DECIDE É ISTO. A chave é grossa por
 * necessidade: ela é calculada com um produto de cada vez, e não pode
 * saber quais atributos o outro tem. A comparação aos pares pode, e é
 * onde a decisão fica honesta.
 *
 * A regra: todo atributo presente NOS DOIS precisa bater. Atributo que
 * só um tem é ignorado, porque catálogo duplicado costuma ter
 * preenchimento desigual — e exigir presença nos dois separaria o que
 * a gente quer juntar.
 */
export function saoOMesmoProduto(
  a: { atributos: AtributosDoProduto; titulo: string },
  b: { atributos: AtributosDoProduto; titulo: string },
): boolean {
  const gtinA = normaliza(a.atributos.GTIN);
  const gtinB = normaliza(b.atributos.GTIN);
  if (gtinA.length >= 8 && gtinB.length >= 8) return gtinA === gtinB;

  // Os números do título têm que bater. É a trava que pega o que os
  // atributos não cadastrados deixam passar.
  if (quantidadesDoTitulo(a.titulo) !== quantidadesDoTitulo(b.titulo)) return false;

  let emComum = 0;

  for (const id of Object.keys(a.atributos)) {
    if (RUIDO.has(id)) continue;
    const va = normaliza(a.atributos[id]);
    const vb = normaliza(b.atributos[id]);
    if (!va || !vb) continue;
    if (va !== vb) return false;
    emComum++;
  }

  // Dois atributos em comum é o mínimo para afirmar qualquer coisa.
  // Só a marca batendo casaria toda a prateleira de um fabricante.
  return emComum >= 2;
}

/** Extrai `{ID: valor}` da lista de atributos que o ML devolve. */
export function atributosDe(produto: {
  attributes?: Array<{ id?: string; value_name?: string | null }> | null;
}): AtributosDoProduto {
  const saida: AtributosDoProduto = {};
  for (const a of produto.attributes ?? []) {
    if (a?.id) saida[a.id] = a.value_name ?? null;
  }
  return saida;
}
