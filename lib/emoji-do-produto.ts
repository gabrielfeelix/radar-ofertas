/**
 * O emoji que abre a mensagem, lido pelo título.
 *
 * POR QUE PELO TÍTULO, e não pela categoria. A primeira ideia foi mapear
 * `categoria_ramo`, e o catálogo derrubou ela: o ramo é código do
 * Mercado Livre (`MLB1072`), vem nulo em cerca de um quarto dos
 * anúncios publicados, e `produto.categoria` estava **nulo em 47 de 47**
 * produtos de beleza medidos em 10/08. Mapear emoji nisso seria
 * manutenção infinita de códigos opacos.
 *
 * Título é o que sempre existe, e é o padrão que o projeto já usa em
 * `nicho-pelo-titulo.ts` e `genero-pelo-titulo.ts`.
 *
 * O QUE O CATÁLOGO ENSINOU SOBRE BELEZA, e que eu teria errado de
 * cabeça: **cabelo domina**. Numa amostra de produtos de beleza já
 * publicados, a maioria é Soft Hair, Braé, Wella, Truss, Joico,
 * leave-in, shampoo, máscara e óleo capilar. Skincare vem depois, e
 * maquiagem é minoria. Um canal "de beleza" com emoji de batom estaria
 * errado na maior parte das mensagens.
 *
 * A REGRA É COVARDE, igual às irmãs: sem certeza, cai no emoji do
 * nicho, e sem nicho cai no genérico. Emoji errado não queima o canal,
 * mas emoji de batom em ração queima a confiança de quem lê.
 *
 * Vale para o WhatsApp e para o Telegram: é o texto do modelo, não a
 * plataforma, que decide se `{emoji}` é usado.
 */

/**
 * O emoji de cada nicho, quando o título não disser nada mais fino.
 *
 * A lista cobre os nichos que existem hoje e alguns que a fase seguinte
 * vai trazer. Nicho desconhecido cai em `PADRAO` em vez de quebrar.
 */
const POR_NICHO: Record<string, string> = {
  beleza: "✨",
  perfume: "🌸",
  bebe: "🍼",
  brinquedo: "🧸",
  pet: "🐾",
  eletronico: "💻",
  games: "🎮",
  geek: "👾",
  suplemento: "💪",
  fitness: "🏋️",
  esporte: "⚽",
  casa: "🏡",
  automotivo: "🚗",
  mercado: "🛒",
};

/** Quando não se sabe o nicho nem o tipo. Neutro de propósito. */
const PADRAO = "🛍️";

/**
 * As regras finas, na ordem em que são testadas. **A primeira que casa
 * vence**, e por isso a ordem é decisão, não arrumação.
 *
 * Duas armadilhas que o catálogo real mostrou:
 *
 * `máscara` sozinha é ambígua: existe máscara capilar (Soft Hair,
 * Braé), máscara facial e máscara de cílios. Ela aparece qualificada em
 * cada regra, nunca solta.
 *
 * `escova` e `modelador` são ferramenta de cabelo, e cabem no mesmo
 * emoji do cabelo. Separá-las em "eletrônico" mandaria secador para o
 * canal de tecnologia.
 */
/*
  AS BORDAS SÃO UNICODE, e não `\b`.

  `\b` do JavaScript é fronteira ASCII: antes de "Á" ele não existe,
  porque "Á" não é caractere de palavra para ele. Medido escrevendo
  estas regras: `/\b[áa]gua micelar/` **não casa** com "Água Micelar",
  e o mesmo valeria para "Óleo Capilar" e "Ácido Hialurônico". O teste
  pegou; de cabeça eu não teria pegado.

  `INICIO` e `FIM` são a versão que entende acento, com a flag `u`.
*/
const INICIO = "(?<![\\p{L}\\p{N}])";
const FIM = "(?![\\p{L}\\p{N}])";
const regra = (corpo: string) => new RegExp(`${INICIO}(?:${corpo})${FIM}`, "iu");

const REGRAS: { emoji: string; padrao: RegExp; nota: string }[] = [
  {
    emoji: "💄",
    nota: "maquiagem",
    padrao: regra(
      "batom|gloss|l[áa]bial|blush|base l[íi]quida|cushion|corretivo|p[óo] compacto|delineador|r[íi]mel|m[áa]scara de c[íi]lios|sombra|paleta|contorno|iluminador|primer facial",
    ),
  },
  {
    emoji: "💅",
    nota: "unhas e pés",
    padrao: regra(
      "esmalte|unhas?|alicate|cut[íi]cula|lixa (?:el[ée]trica )?(?:para |de |d)?(?:os )?p[ée]s|pedicuro|manicure|gel builder|acetona",
    ),
  },
  {
    emoji: "💇",
    nota: "cabelo, produto e ferramenta",
    padrao: regra(
      "shampoo|xampu|condicionador|creme para pentear|creme de pentear|leave[- ]?in|m[áa]scara (?:capilar|p[óo]s[- ]?qu[íi]mica|de tratamento)|[óo]leo capilar|finalizador|progressiva|antirres[íi]duo|hidrata[çc][ãa]o capilar|matizador|tintura|colora[çc][ãa]o|secador|chapinha|prancha alisadora|modelador de cachos|escova (?:de cabelo|de madeira|secadora|alisadora)|soft hair|bra[ée]|truss|wella|joico|keune",
    ),
  },
  /*
    PERFUMARIA VEM ANTES DE CORPO E BANHO, e isto é um caso medido.

    "Perfume Malbec Desodorante Colônia 100ml" tem a palavra
    `desodorante`, mas deo colônia é perfume no Brasil, não
    antitranspirante. Com banho na frente, todo perfume de farmácia
    saía com emoji de banheira.
  */
  {
    emoji: "🌸",
    nota: "perfumaria",
    padrao: regra(
      "perfume|eau de (?:parfum|toilette|cologne)|edp|edt|col[ôo]nia|body splash",
    ),
  },
  {
    emoji: "🧴",
    nota: "skincare",
    padrao: regra(
      "[áa]gua micelar|demaquilante|s[ée]rum|hidratante facial|protetor solar|fps\\s*\\d+|[áa]cido hialur[ôo]nico|niacinamida|vitamina c|esfoliante facial|t[ôo]nico facial|peel(?:ing)?|skincare|anti[- ]?idade|creme facial",
    ),
  },
  {
    emoji: "🛁",
    nota: "corpo e banho",
    padrao: regra(
      "sabonete|desodorante|antitranspirante|hidratante corporal|lo[çc][ãa]o hidratante|depila[çc][ãa]o|depilat[óo]ri[ao]|cera depilat|[óo]leo corporal|talco|banho",
    ),
  },
];

/**
 * O emoji de uma oferta.
 *
 * `titulo` manda quando reconhece o tipo; senão vale o emoji do nicho;
 * senão o genérico. Os três degraus existem porque a mensagem não pode
 * sair sem emoji quando o modelo pede `{emoji}`.
 */
export function emojiDoProduto(
  titulo: string | null | undefined,
  nichoSlug: string | null | undefined = null,
): string {
  const t = (titulo ?? "").trim();

  if (t) {
    const fina = REGRAS.find((r) => r.padrao.test(t));
    if (fina) return fina.emoji;
  }

  return POR_NICHO[(nichoSlug ?? "").trim()] ?? PADRAO;
}

/** Para a tela de ajustes mostrar o de-para sem duplicar a tabela. */
export function tabelaDeEmojis(): { emoji: string; nota: string }[] {
  return [
    ...REGRAS.map((r) => ({ emoji: r.emoji, nota: r.nota })),
    ...Object.entries(POR_NICHO).map(([nicho, emoji]) => ({
      emoji,
      nota: `nicho ${nicho}`,
    })),
    { emoji: PADRAO, nota: "quando nada casa" },
  ];
}
