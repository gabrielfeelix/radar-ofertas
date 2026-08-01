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
  /**
   * Reprovar quando o produto não declara o atributo? (migration 43)
   *
   * Padrão falso, e o padrão está certo no geral. Mas o par
   * Beauty/Perfumes mostrou que ele não pode ser o único comportamento:
   * o primeiro perfume que entrou no catálogo veio com `atributos`
   * nulo, e com "sem atributo passa" nos dois lados ele casava com
   * `inclui Masculino` E com `exclui Masculino` — saindo nos dois
   * canais.
   *
   * Quem é RECORTE exige (canal mudo é menos ruim que canal errado).
   * Quem é RESTO não exige, e fica com o que não declara.
   */
  exigeAtributo?: boolean;
  /**
   * A que nicho este filtro se aplica (migration 47).
   *
   * Nulo vale para o canal inteiro. Preenchido existe porque o Radar
   * Beauty aceita `beleza` e `perfume`, e o filtro de `GENDER` só faz
   * sentido no segundo: com escopo global, shampoo e protetor solar —
   * que não declaram gênero — caíam no `exigeAtributo` e eram
   * reprovados. Doze produtos legítimos, na primeira simulação.
   */
  nichoId?: string | null;
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
  nichoId?: string | null,
): boolean {
  if (!filtros || filtros.length === 0) return true;

  for (const filtro of filtros) {
    // Filtro com escopo só opina sobre o nicho dele.
    if (filtro.nichoId && filtro.nichoId !== nichoId) continue;

    const bruto = atributos?.[filtro.atributo];

    // O produto não declara o atributo. O filtro só opina se exigir.
    if (!bruto) {
      if (filtro.exigeAtributo) return false;
      continue;
    }

    const valor = normaliza(bruto);
    const casa = filtro.valores.some((v) => normaliza(v) === valor);

    if (filtro.modo === "inclui" && !casa) return false;
    if (filtro.modo === "exclui" && casa) return false;
  }

  return true;
}
