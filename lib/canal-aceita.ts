/**
 * O filtro de atributo do canal (migration 37).
 *
 * POR QUE ELE EXISTE, e o caso é literal: em 01/08 o dono abriu um
 * grupo chamado **Radar Perfumes (masc)**. "Perfume" é nicho — existe
 * como domínio `MLB-PERFUMES` no Mercado Livre. "Masculino" não é: o
 * ML põe todo perfume na mesma prateleira e distingue por um atributo,
 * `GENDER`, cujos valores observados são "Masculino", "Feminino",
 * "Meninos", "Meninas" e "Sem gênero".
 *
 * Sem isto, só havia dois caminhos, e os dois são piores. Criar um
 * nicho `perfume_masculino` obriga a decidir o gênero na hora de
 * classificar e a duplicar o nicho a cada recorte novo. Deixar sem
 * filtro faz um canal anunciado como masculino publicar Floratta.
 *
 * PRODUTO SEM O ATRIBUTO PASSA, e essa é a decisão que mais importa
 * aqui. Boa parte do catálogo do ML não preenche boa parte dos
 * atributos, e reprovar por ausência calaria o canal por causa do
 * cadastro de um terceiro. É a mesma escolha da migration 36: quando o
 * custo de errar é "o canal fica mudo", o desconhecido passa.
 *
 * Espelha `canal_aceita_atributos` no banco. As duas existem pelo mesmo
 * motivo que `nicho_do_anuncio` tem par no coletor: o publicador roda
 * como script e decide em memória, com os canais já carregados, e não
 * vale uma ida ao banco por oferta por canal.
 */

/** Os atributos do produto, como a loja devolve: id → valor. */
export type AtributosDoProduto = Record<string, string | null | undefined>;

export type FiltroDeCanal = {
  atributo: string;
  valores: string[];
  modo: "inclui" | "exclui";
};

/**
 * Normaliza para comparar.
 *
 * O ML escreve "Masculino" com maiúscula, mas quem cadastra o produto
 * é a loja, e loja escreve como quer. Comparar cru faria "masculino"
 * escapar do filtro sem que ninguém percebesse — o sintoma seria um
 * perfume feminino no canal masculino, uma vez a cada tantas.
 */
function normaliza(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Se o canal aceita um produto, dados os filtros dele e os atributos
 * do produto.
 *
 * Canal sem filtro aceita tudo — é o comportamento de todos os canais
 * que existiam antes desta função, e nenhum deles muda por ela existir.
 */
export function canalAceitaAtributos(
  filtros: FiltroDeCanal[] | null | undefined,
  atributos: AtributosDoProduto | null | undefined,
): boolean {
  if (!filtros || filtros.length === 0) return true;

  for (const filtro of filtros) {
    const bruto = atributos?.[filtro.atributo];
    // O produto não declara o atributo: o filtro não opina.
    if (!bruto) continue;

    const valor = normaliza(bruto);
    const casa = filtro.valores.some((v) => normaliza(v) === valor);

    if (filtro.modo === "inclui" && !casa) return false;
    if (filtro.modo === "exclui" && casa) return false;
  }

  return true;
}
