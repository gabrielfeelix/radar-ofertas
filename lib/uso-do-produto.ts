/**
 * O produto é para quem compra para si, ou para quem revende?
 *
 * POR QUE ISTO EXISTE. O canal Radar Beauty publicou, entre outros:
 *
 *   Kit 2 Caixas Microcanula Sc22g 50mm (cx C/10)      R$ 289,87
 *   Shampoo Expert Pro Longer 1,5L L'Oreal             R$ 316,42
 *   Kit 12 Spray Liso Obrigatorio 200ml                R$ 171,90
 *
 * Microcânula é insumo de clínica de preenchimento facial. Um litro e
 * meio de shampoo e caixa com doze unidades são revenda. Medido em
 * 04/08: 14 das 257 publicações do canal, 5,5%.
 *
 * **NÃO É SOBRE PREÇO**, e essa é a distinção que importa. O canal tem
 * membro de todo bolso, e produto caro pode ser exatamente o que
 * alguém quer. O problema é o produto não ser **para ela** — ninguém
 * compra caixa de cânula ou doze sprays para usar em casa.
 *
 * COMO ISSO SE LIGA AO RESTO. O mecanismo é o mesmo do `GENDER`
 * (migration 37): o atributo sai do título, e o canal decide se quer ou
 * não por `canal_atributo`. Nenhuma tabela nova, e a decisão fica sendo
 * dado — outro canal pode querer justamente o atacado, e é só não
 * excluir.
 *
 * A LISTA É CURTA E LITERAL, pelo mesmo motivo de sempre: o falso
 * positivo aqui apaga oferta boa em silêncio. "Kit 3" não entra, porque
 * kit de três produtos diferentes é compra normal de quem cuida do
 * cabelo; "Kit 12" entra, porque doze do mesmo é estoque.
 */

/** O valor que vai para `produto.atributos.USO`. */
export const USO_PROFISSIONAL = "profissional";

function normaliza(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/*
  Insumo de clínica e de salão. Nada disto se usa em casa.

  `cx c/` é a forma como o Mercado Livre escreve "caixa com", e ela
  aparece literalmente no título da microcânula.
*/
const INSUMO = [
  "microcanula",
  "canula",
  // "seringa" NAO entra: "Lip Gloss Seringa" e formato de embalagem, e
  // gloss e exatamente o que o canal existe para publicar. `agulha` e
  // `derma pen` cobrem o insumo de verdade sem esse custo.
  "derma pen",
  "agulha",
  "cx c/",
  "caixa c/",
  "extensao de cilios",
  "para extensao",
];

/*
  Quantidade de revenda.

  Dois dígitos ou mais de unidades iguais. `kit 3`, `kit 4` e `com 6`
  ficam de fora de propósito: kit pequeno é compra de consumidor.
*/
const QUANTIDADE = [
  /*
    `kit 12` do MESMO item e revenda. `Kit 13 Pcs Pinceis de Maquiagem`
    sao treze pecas DIFERENTES, e e compra normal de quem se maquia — o
    `(?!\s*(pcs|pecas|pinceis|unidades de))` tira esse caso. A regex nao
    sabe a diferenca sozinha, e errar aqui apaga produto-alvo do canal.
  */
  /\bkit\s*[1-9][0-9]\b(?!\s*(pcs|pc\b|pecas|pincei))/,
  /\b[1-9][0-9]\s*(unidades|un\b|pecas)/,
  /\bcom\s*[1-9][0-9]\s*(unidades|un\b)/,
  /\batacado\b/,
  /\brevenda\b/,
  /\bfardo\b/,
];

/*
  Volume de salão.

  Um litro e meio de shampoo não entra no box de ninguém. O corte é em
  1 litro: abaixo disso é tamanho de casa (500ml é comum), acima é
  profissional.

  ⚠️ **SÓ VALE EM BELEZA E PERFUME**, e isto custou uma migration para
  ficar claro. A primeira versão aplicou a regra ao catálogo inteiro e
  marcou "Panela De Pressão 4,2l" e "Chaleira 2,7 L" como suprimento
  profissional. Panela de quatro litros é panela.

  Litro não é um sinal, é um sinal dentro de um contexto: em shampoo
  quer dizer revenda, em panela quer dizer o produto. Quem chamar
  `ehSuprimentoProfissional` fora de beleza tem que ignorar este bloco
  — hoje quem chama é o coletor da Shopee, e o filtro que consome vive
  no canal de Beauty (migration 56).
*/
const VOLUME_DE_SALAO = [
  /\b1[,.]5\s*l\b/,
  /\b[2-9]\s*l\b/,
  /\b[1-9][0-9]+\s*litros?\b/,
  /\b1\s*litro\b/,
  /\b[2-9]\s*litros\b/,
  /\b[1-9][0-9]{3,}\s*ml\b/,
];

/*
  CONJUNTO DE PEÇAS DIFERENTES NÃO É REVENDA, e esta lista existe porque
  a exclusão que já havia estava sendo anulada uma linha abaixo dela.

  O padrão de `kit NN` tem um `(?!\s*(pcs|pc|pecas|pincei))` escrito com
  todo cuidado para deixar "Kit 13 Pcs Pinceis" passar. Só que a regra
  seguinte de `QUANTIDADE` casa com `NN pecas` sem olhar o contexto, e
  remarcava o mesmo título. As duas se anulavam, e a segunda ganhava.

  Medido em 04/08, à noite: NOVE kits de pincel de maquiagem estavam
  marcados como profissional no catálogo, incluindo "Kit 13 Pçs Pincéis
  de Maquiagem Com Bolsa de Veludo" — que é literalmente o título que a
  migration 57 foi escrita para consertar, e que continuou quebrado.

  Trinta pincéis DIFERENTES são um estojo de maquiagem, que é
  produto-alvo do Radar Beauty. Trinta sprays IGUAIS são estoque. A
  diferença está na palavra, não no número.

  `pince` cobre pincel, pincéis e pinceis de uma vez, depois de o
  acento cair em `normaliza`.
*/
const CONJUNTO_DE_PECAS_DIFERENTES = [
  /\b(kit|conjunto|jogo|paleta)\b.{0,44}?\bpince/,
  /\b(kit|conjunto|jogo)\s*[1-9][0-9]\s*(pcs|pc\b|pecas)\b/,
];

/**
 * O título indica produto que não é para uso próprio?
 *
 * Devolve `false` no caso duvidoso, e isso é deliberado: a regra existe
 * para tirar o que é claramente de revenda, não para adivinhar.
 */
export function ehSuprimentoProfissional(
  titulo: string | null | undefined,
  /**
   * O volume grande conta como sinal? Só conta em beleza e perfume.
   *
   * ISTO SÓ EXISTIA NO SQL, e essa era metade do problema. A migration
   * 56 desfez 741 marcações erradas porque "litro" tem dois significados
   * opostos: shampoo de 1,5L é tamanho de salão, panela de 4,2L é
   * panela. Mas a correção morava só na migration, e esta função, que é
   * a regra VIVA usada pelos coletores, continuou marcando chaleira.
   *
   * Enquanto o único canal que exclui `USO` era o Beauty, isso não
   * gerava post errado — panela não é do nicho dele. Passa a gerar no
   * dia em que existir canal de casa, que nasceria filtrando panela
   * grande sem ninguém entender por quê.
   *
   * O padrão é `true` para não mudar o comportamento de quem já chama
   * sem o argumento. Quem sabe o nicho deve passar.
   */
  volumeConta: boolean = true,
): boolean {
  if (!titulo) return false;
  const t = normaliza(titulo);

  /*
    O insumo de clínica vem primeiro e o conjunto de peças NÃO o
    desfaz: "Kit Limpeza Extensão de Cílios com Pincel" tem pincel e
    continua sendo insumo, porque `extensao de cilios` é o sinal forte.
    O conjunto só neutraliza o sinal fraco, que é a contagem.
  */
  if (INSUMO.some((m) => t.includes(m))) return true;
  if (volumeConta && VOLUME_DE_SALAO.some((r) => r.test(t))) return true;

  if (CONJUNTO_DE_PECAS_DIFERENTES.some((r) => r.test(t))) return false;
  if (QUANTIDADE.some((r) => r.test(t))) return true;

  return false;
}

/**
 * Os atributos com `USO` preenchido, ou `null` quando não há o que
 * acrescentar.
 *
 * Não sobrescreve um `USO` que já exista: se alguém marcou à mão, a
 * mão ganha.
 */
export function atributosComUso(
  titulo: string | null | undefined,
  atuais: Record<string, string> | null | undefined,
  /** Repassado a `ehSuprimentoProfissional`. Quem sabe o nicho, passa. */
  volumeConta: boolean = true,
): Record<string, string> | null {
  if (atuais && typeof atuais.USO === "string" && atuais.USO.trim() !== "") return null;
  if (!ehSuprimentoProfissional(titulo, volumeConta)) return null;
  return { ...(atuais ?? {}), USO: USO_PROFISSIONAL };
}
