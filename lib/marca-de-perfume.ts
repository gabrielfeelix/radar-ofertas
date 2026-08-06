/**
 * A marca do perfume, e o quanto ela vale para quem lê o canal.
 *
 * POR QUE ISTO EXISTE. Pedido do dono em 06/08, olhando o canal:
 * *"quase não tá vindo coisa boa, só tá vindo body splash e perfume
 * duvidoso... não tem como preferirmos perfumes de marcas boas ou
 * perfumes árabes? também marcas br tipo natura, granado"*.
 *
 * E o catálogo dá razão a ele. Amostra aleatória de 70 anúncios do nicho
 * `perfume` em 06/08: **Amakha Paris aparece mais que qualquer outra
 * coisa**, seguida de Hinode, Primacial, Barbour's Beauty e Forever
 * Liss. São marcas de revenda porta a porta, e o comprador de perfume
 * não entra num canal para ver isso.
 *
 * As boas existem e são poucas: Azzaro, Joop!, Cacharel, Mercedes Benz,
 * Marina de Bourbon, Gabriela Sabatini, Ulric de Varens, os árabes
 * Mawwal e Maison Alhambra, e as brasileiras Natura, Boticário (Malbec)
 * e Eudora.
 *
 * **ISTO NÃO FILTRA, ORDENA.** O dono foi explícito: *"não tem problema
 * a vir body splash"*. Excluir marca desconhecida calaria o canal, que
 * já ficou 30 horas mudo por falta de catálogo. O que muda é a ORDEM:
 * quando há um Azzaro e um Amakha na fila, o Azzaro sai primeiro.
 *
 * A LISTA NASCEU DO CATÁLOGO, não de memória. Cada nome aqui foi lido
 * num título de verdade, com uma exceção declarada: as casas árabes
 * `lattafa`, `armaf`, `al haramain`, `rasasi` e `swiss arabian` entraram
 * porque já são termo de busca do coletor, então elas vão aparecer.
 *
 * O QUE ELA NÃO É: julgamento de qualidade de perfume. É reconhecimento
 * de marca — o que faz alguém parar de rolar a tela. Perfume de marca
 * desconhecida pode ser ótimo, e continua sendo publicado.
 */

export type FaixaDeMarca = "conhecida" | "arabe" | "brasileira" | "desconhecida";

/**
 * As marcas que o comprador brasileiro reconhece sem pensar.
 *
 * Internacionais de perfumaria, lidas do catálogo ou trazidas pelos
 * termos de busca do coletor.
 */
/*
  JEQUITI SAIU DAQUI depois de rodar contra o catálogo: ela é venda
  direta, e o que ela trouxe foi "Colônia Turma da Mônica Cebolinha
  25mL" na frente de um Azzaro. Marca que a pessoa reconhece não é a
  mesma coisa que marca que ela quer ver num canal de perfume.
*/
const CONHECIDAS =
  /\b(azzaro|joop|cacharel|paco rabanne|carolina herrera|dior|chanel|versace|hugo boss|calvin klein|antonio banderas|jean paul gaultier|ferrari|mercedes[- ]?benz|marina de bourbon|gabriela sabatini|ulric de varens|lacoste|givenchy|dolce ?& ?gabbana|armani|guerlain|montblanc|mont blanc|bvlgari|bulgari|issey miyake|kenzo|nautica|adidas|puma)\b/i;

/**
 * As casas árabes. O dono pediu por nome, e elas são a faixa que mais
 * cresce no catálogo da Shopee.
 */
const ARABES =
  /\b(lattafa|armaf|maison alhambra|alhambra|al haramain|haramain|rasasi|swiss arabian|ajmal|afnan|mawwal|thahaani|zayed|khamrah|asad|yara)\b|perfume\s+[áa]rabe/i;

/**
 * As brasileiras que valem tanto quanto uma internacional aqui, e o
 * dono citou duas delas pelo nome.
 */
const BRASILEIRAS =
  /\b(natura|o botic[áa]rio|boticario|malbec|egeo|granado|phebo|eudora|reserva|avon|quem disse berenice|l'?occitane au br[ée]sil)\b/i;

/**
 * Marca de revenda porta a porta.
 *
 * Não barra nada — existe para o log poder dizer POR QUE um item ficou
 * no fim da fila, em vez de o dono ter que adivinhar.
 */
const REVENDA =
  /\b(amakha|hinode|primacial|forever liss|barbour'?s|agapis|icandy|gota dourada|amaxxon|abelha rainha|jafra|racco)\b/i;

export type MarcaLida = {
  faixa: FaixaDeMarca;
  /** O que casou, para o log. Nulo quando nada casou. */
  marca: string | null;
  /** É de revenda porta a porta? Só informa; não barra. */
  revenda: boolean;
};

export function marcaDePerfume(titulo: string | null | undefined): MarcaLida {
  const t = (titulo ?? "").trim();
  const revenda = REVENDA.test(t);

  /*
    A ORDEM DAS TRÊS É DELIBERADA e resolve o cruzamento real: "Kit
    Perfumaria Árabe Amakha Paris" existe no catálogo. Ele casa com
    árabe e com revenda, e o certo é ele NÃO ganhar a vaga de um Mawwal.
    Por isso revenda derruba a faixa, mesmo quando outra regra casou.
  */
  if (revenda) return { faixa: "desconhecida", marca: t.match(REVENDA)?.[0] ?? null, revenda: true };

  const conhecida = t.match(CONHECIDAS);
  if (conhecida) return { faixa: "conhecida", marca: conhecida[0], revenda: false };

  const arabe = t.match(ARABES);
  if (arabe) return { faixa: "arabe", marca: arabe[0], revenda: false };

  const br = t.match(BRASILEIRAS);
  if (br) return { faixa: "brasileira", marca: br[0], revenda: false };

  return { faixa: "desconhecida", marca: null, revenda: false };
}

/**
 * O peso da faixa na ordem da fila. Maior sai primeiro.
 *
 * As três faixas boas valem o mesmo de propósito: o dono pediu as três
 * no mesmo pedido, sem hierarquia entre elas, e inventar uma seria
 * decidir por ele qual perfume o canal é.
 */
export function pesoDaMarca(titulo: string | null | undefined): number {
  return marcaDePerfume(titulo).faixa === "desconhecida" ? 0 : 1;
}
