/**
 * O gênero de um perfume, lido do título.
 *
 * POR QUE ISTO EXISTE. O coletor da Shopee não traz atributo nenhum: o
 * feed de produto tem título, preço e categoria, e mais nada. O canal
 * "Radar Perfumes (masc)" filtra por `GENDER` com `exige_atributo:
 * true`, então **todo perfume da Shopee é invisível para ele** — 33
 * produtos, zero publicáveis (D-063). O Mercado Livre traz o `GENDER`
 * de verdade, pela API; a Shopee não tem de onde.
 *
 * O título tem a informação. "Perfume Spray Masculino Odyssey SPECTRA
 * Armaf" diz o que precisa ser dito, e é o que o comprador lê para
 * decidir.
 *
 * ISTO É PALPITE, E PALPITE ERRADO AQUI CUSTA CARO. A
 * `docs/onde-paramos.md` registra o caso: *"um perfume feminino saiu no
 * canal masculino e não havia como tirar"*. Publicar no canal errado é
 * pior que não publicar — o membro não reclama, ele sai.
 *
 * POR ISSO A REGRA É COVARDE, e de propósito:
 *
 *   diz "masculino" e NÃO diz "feminino"  →  Masculino
 *   diz "feminino"  e NÃO diz "masculino" →  Feminino
 *   diz os dois, ou nenhum, ou "unissex"  →  null, e não publica
 *
 * O `null` não é falha, é a resposta certa. "Kit Masculino e Feminino"
 * é literalmente os dois, e mandá-lo para qualquer um dos canais seria
 * errar metade das vezes. Fica de fora, e o custo é uma oferta não
 * publicada — que é o lado barato de errar.
 *
 * É a mesma escolha da D-036, e pelo mesmo motivo: quando o universo é
 * grande e desconhecido, o desconhecido **separa** em vez de ser
 * chutado.
 *
 * NÃO INVENTA ATRIBUTO ONDE JÁ EXISTE UM. Quem tem `GENDER` vindo da
 * API do Mercado Livre continua com o dele; isto só preenche o vazio.
 */

/** Os valores que o `canal_atributo` dos nossos canais conhece. */
export type GeneroDoProduto = "Masculino" | "Feminino";

function normaliza(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    // Tira acento: "masculíno" e "MASCULINO" têm que casar igual.
    .replace(/[̀-ͯ]/g, "");
}

/*
  As marcas de cada lado.

  Além do português, entram as formas que aparecem em perfume importado
  e árabe, que é boa parte do catálogo da Shopee: `pour homme`, `for
  men`, `for her`. Elas vêm no título em inglês ou francês mesmo, sem
  tradução.

  `masc` e `fem` abreviados NÃO entram: "fem" casa dentro de "feminino"
  mas também dentro de palavras que não têm nada a ver, e a lista existe
  para ser conservadora.
*/
const MARCAS_MASCULINAS = [
  "masculino",
  "masculina",
  "pour homme",
  "for men",
  "for him",
  "men's",
  "homem",
  /*
    APARELHO DE BARBA, acrescentado em 10/08 depois de medir o que o
    canal de beleza publicou: cinco barbeadores masculinos saíram para
    um grupo de mulheres. Kemei, Philips OneBlade, "Multigroom para
    Barba e Corpo".

    Não é que mulher não use aparelho de barba: é que o produto é
    vendido para homem, e num grupo chamado Radar Delas ele é o item
    que faz alguém sair. A regra continua covarde — "Depiladora
    Elétrica Feminina" diz `feminina` e continua feminino, e um
    improvável "barbeador feminino" diria os dois e viraria nulo.
  */
  "barbeador",
  "aparador de pelos",
  "aparador de barba",
  "oneblade",
  "one blade",
  "multigroom",
  "para barba",
  "de barba",
];

const MARCAS_FEMININAS = [
  "feminino",
  "feminina",
  "pour femme",
  "for women",
  "for her",
  "women's",
  "mulher",
];

/*
  O que anula os dois lados.

  "Unissex" é uma afirmação explícita de que não é de um gênero só, e
  respeitá-la é o mínimo. "Infantil" e "kids" também saem: perfume de
  criança não é do canal masculino nem do feminino, é do Radar Kids, e
  o nicho já resolve isso.
*/
const ANULA = ["unissex", "unisex", "infantil", "kids", "para ambos"];

/**
 * Devolve o gênero quando o título é inequívoco, e `null` quando não é.
 *
 * `null` cobre quatro casos diferentes de propósito, porque a resposta
 * é a mesma para todos: título que diz os dois, título que não diz
 * nenhum, título que se declara unissex, e título vazio.
 */
export function generoPeloTitulo(titulo: string | null | undefined): GeneroDoProduto | null {
  if (!titulo) return null;

  const t = normaliza(titulo);

  if (ANULA.some((m) => t.includes(m))) return null;

  const masculino = MARCAS_MASCULINAS.some((m) => t.includes(m));
  const feminino = MARCAS_FEMININAS.some((m) => t.includes(m));

  // Os dois, ou nenhum: a mesma resposta.
  if (masculino === feminino) return null;

  return masculino ? "Masculino" : "Feminino";
}

/**
 * Os atributos de um produto, com o gênero preenchido quando dá.
 *
 * Devolve `null` quando não há nada a acrescentar, para quem chama
 * poder pular a escrita em vez de gravar um objeto igual ao que já
 * estava lá.
 *
 * **Nunca sobrescreve** um `GENDER` existente: o do Mercado Livre veio
 * da API e vale mais que a nossa leitura de título.
 */
export function atributosComGenero(
  titulo: string | null | undefined,
  atuais: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (atuais && typeof atuais.GENDER === "string" && atuais.GENDER.trim() !== "") {
    return null;
  }

  const genero = generoPeloTitulo(titulo);
  if (!genero) return null;

  return { ...(atuais ?? {}), GENDER: genero };
}
