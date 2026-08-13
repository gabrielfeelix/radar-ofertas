/**
 * Variedade na fila de publicação.
 *
 * A pesquisa de operação (`docs/pesquisa-operacao.md`) lista falta de
 * variedade entre as cinco causas de morte de um grupo, com o exemplo
 * literal: *"repetir cremes faciais quatro vezes seguidas vira ruído —
 * varie cor, marca e faixa de preço"*.
 *
 * E o nosso desenho **piora** isso sem querer. A comporta de fadiga
 * bloqueia produto repetido, que é outro problema. O que sobra depois
 * dela ainda é ordenado por nota — e ofertas parecidas pontuam
 * parecido, porque desconto, comissão e reputação de vendedor andam
 * juntos dentro de um mesmo nicho e faixa de preço. O resultado é que
 * as melhores notas do dia tendem a ser oito variações da mesma coisa,
 * publicadas em sequência.
 *
 * ISTO NÃO É CURADORIA, E NÃO DEVE VIRAR. A nota decide **o que**
 * publicar; esta função decide apenas **em que ordem** o que já foi
 * aprovado sai. Nada é descartado, nada muda de nota, e o conjunto
 * publicado no fim do dia é exatamente o mesmo. Se um dia isso passar
 * a excluir oferta, virou regra de curadoria e o lugar dela é o banco,
 * em `avalia_anuncios`, não aqui.
 */

/** O que a intercalação precisa saber de um item. O resto ela ignora. */
export type ItemComVariedade = {
  /** O eixo principal: nicho, categoria, assunto. */
  grupo: string | null;
  /** Em centavos. Duas ofertas de R$ 20 se parecem mesmo em nichos diferentes. */
  precoCentavos: number;
};

/**
 * As faixas de preço que contam como "parecidas".
 *
 * Os cortes não são redondos por acaso: eles separam compra por
 * impulso (até 50), compra pensada (até 200) e compra planejada. Duas
 * ofertas na mesma faixa competem pelo mesmo bolso no mesmo momento.
 */
function faixa(precoCentavos: number): string {
  if (precoCentavos < 5_000) return "ate-50";
  if (precoCentavos < 20_000) return "ate-200";
  if (precoCentavos < 60_000) return "ate-600";
  return "acima-600";
}

function assinatura(item: ItemComVariedade): string {
  return `${item.grupo ?? "sem-nicho"}|${faixa(item.precoCentavos)}`;
}

/**
 * A assinatura de um item, para quem precisa guardar a última publicada.
 *
 * Existe porque o revezamento não pode começar do zero a cada rodada.
 * Ver `intercalaPorVariedade`.
 */
export function assinaturaDe(item: ItemComVariedade): string {
  return assinatura(item);
}

/**
 * Reordena para que itens parecidos não saiam em sequência.
 *
 * O algoritmo é ganancioso e simples de propósito: a cada passo pega o
 * primeiro item cuja assinatura seja diferente da última publicada; se
 * não houver nenhum, pega o primeiro que sobrou. Isso preserva a ordem
 * relativa por nota **dentro** de cada assinatura — a melhor oferta de
 * pet continua saindo antes da segunda melhor de pet — e só intercala
 * entre assinaturas.
 *
 * Não tenta ser ótimo. Uma fila que é toda do mesmo nicho continua
 * toda do mesmo nicho, porque não há o que intercalar, e forçar
 * qualquer outra coisa seria mentir sobre o que existe.
 *
 * `ultimaPublicada` É A MEMÓRIA ENTRE RODADAS, e sem ela metade do
 * revezamento não acontecia. O publicador roda de hora em hora e monta
 * a fila do zero; a intercalação sabia o que ela mesma tinha acabado de
 * pôr na frente, mas não sabia o que o canal PUBLICOU na rodada
 * anterior. O primeiro post de cada rodada era, então, um sorteio — e
 * quando o catálogo do dia é dominado por uma família, o sorteio dá
 * sempre nela. Foi assim que o Radar Delas abriu 12/08 e 13/08 com
 * secador nas duas.
 *
 * Quem chama passa a assinatura do último post ENVIADO daquele canal, e
 * o revezamento continua de onde parou. Sem o argumento, o
 * comportamento é o de antes.
 */
export function intercalaPorVariedade<T extends ItemComVariedade>(
  itens: T[],
  ultimaPublicada: string | null = null,
): T[] {
  if (itens.length <= 1) return [...itens];

  const restantes = [...itens];
  const ordenados: T[] = [];
  let ultima: string | null = ultimaPublicada;

  while (restantes.length > 0) {
    let escolhido = restantes.findIndex((item) => assinatura(item) !== ultima);
    // Só sobrou do mesmo tipo: segue a ordem original em vez de travar.
    if (escolhido === -1) escolhido = 0;

    const [item] = restantes.splice(escolhido, 1);
    ordenados.push(item);
    ultima = assinatura(item);
  }

  return ordenados;
}

/**
 * Quantos pares seguidos ficaram parecidos.
 *
 * Serve para a tela avisar quando não deu para variar — o que não é
 * defeito, é o catálogo do dia sendo monótono. Sem esse aviso, o dono
 * olha uma fila de oito ofertas de eletrônico e conclui que o sistema
 * está quebrado, quando o sistema está mostrando a verdade.
 */
export function repeticoesSeguidas(itens: ItemComVariedade[]): number {
  let repetidos = 0;
  for (let i = 1; i < itens.length; i += 1) {
    if (assinatura(itens[i]) === assinatura(itens[i - 1])) repetidos += 1;
  }
  return repetidos;
}
