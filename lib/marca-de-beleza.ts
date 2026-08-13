/**
 * A marca de beleza, e o quanto ela vale para quem lê o grupo.
 *
 * POR QUE ISTO EXISTE. Pedido do dono em 13/08, olhando o Radar Delas
 * depois de o revezamento por família já estar no ar:
 *
 *   *"meu problema É NÃO APARECER COISA DE SKINCARE, BELEZA, MAQUIAGEM,
 *   PRODUTOS DE QUALIDADE. Até eu, que sou homem e não manjo, estou
 *   agoniado que não tem um produto da WePink ali. Tem a porra de
 *   SECADORES, 10 SECADORES E 0 WEPINK. Eu não estou falando isso para
 *   ter WePink, estou falando para ter MARCAS BOAS E SÓ TEM BOMBA."*
 *
 * E A FILA DAVA RAZÃO A ELE PELO MOTIVO OPOSTO AO QUE PARECIA. Medida
 * em 13/08, a fila do canal tinha 1.544 itens, e dentro dela **194 de
 * maquiagem e 154 de skincare**: Quem Disse Berenice, Kiko Milano,
 * Océane, Ruby Rose, Payot Boca Rosa, Mari Maria, Revlon, Sallve, La
 * Roche-Posay, Vichy, Eucerin, Principia, Creamy, Nivea. O catálogo não
 * era o problema. O problema era a ORDEM.
 *
 * `lib/marca-de-perfume.ts` já resolvia isto para o canal de perfume
 * desde 06/08, com o mesmo pedido em outras palavras (*"só está vindo
 * body splash e perfume duvidoso"*). O publicador põe marca reconhecida
 * na frente. Só que a lista dele é de PERFUME: Azzaro, Lattafa, Natura.
 * Dos 348 produtos de maquiagem e skincare da fila, **três** casavam.
 * Todo o resto caía no segundo bloco, atrás de qualquer perfume
 * desconhecido, e nunca chegava à janela do publicador.
 *
 * **ISTO NÃO FILTRA, ORDENA**, exatamente como a lista de perfume. Nada
 * é descartado e nada muda de nota. Marca que ninguém conhece continua
 * publicada: o que muda é que, havendo um batom da Quem Disse Berenice
 * e um batom sem marca na fila, o da Quem Disse Berenice sai primeiro.
 *
 * A LISTA NASCEU DO CATÁLOGO, não de memória. Cada nome daqui foi lido
 * num título de verdade da fila ou do catálogo de beleza em 13/08, com
 * duas exceções declaradas: as marcas coreanas (`cosrx`, `anua`, `some
 * by mi` e as outras) e as brasileiras de influenciadora (`wepink`,
 * `franciny`) entraram porque **acabaram de virar termo de busca do
 * coletor** — elas vão aparecer, e é melhor a lista já reconhecê-las do
 * que descobrir na semana que vem que o primeiro COSRX do catálogo saiu
 * atrás de um kit de shampoo genérico.
 *
 * CABELO ESTÁ FORA DESTA LISTA, DE PROPÓSITO, e esta é a decisão que
 * mais precisa estar escrita. Wella, Kérastase, L'Oréal Professionnel,
 * Braé, Lola e Widi Care são marcas ótimas e o dono nunca reclamou
 * delas. Só que cabelo já é **57% da fila** (química, aparelho e o que
 * o classificador não reconheceu), e uma lista de prioridade serve para
 * trazer para a frente o que NUNCA aparece, não para reforçar o que já
 * domina. Pôr Wella aqui seria devolver o problema com nome melhor.
 * Cabelo continua saindo pelo revezamento de família, que é o lugar
 * certo dele.
 *
 * O QUE ELA NÃO É: julgamento de qualidade de cosmético. É
 * reconhecimento de marca, que é o que faz alguém parar de rolar a
 * tela. SACE LADY vende bem e pode ser boa; ela só não é o que a pessoa
 * entrou no grupo esperando ver.
 */

/**
 * Tira o acento antes de comparar, e é por isso que nenhum padrão
 * abaixo tem acento nenhum.
 *
 * `lib/marca-de-perfume.ts` não faz isso, e escreve `l'?or[ée]al` e
 * `bior[ée]` à mão para cada caso. Funciona, mas cada marca nova é uma
 * chance de esquecer uma variante — foi assim que "Océane" passou
 * despercebida no primeiro teste deste arquivo, com `é` no lugar do
 * `e`. Normalizar uma vez resolve a classe inteira do problema:
 * "L'Oréal", "Bioré", "Avène" e "Océane" viram texto simples, e o
 * catálogo escreve as quatro dos dois jeitos.
 */
function normaliza(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type FaixaDeBeleza =
  | "maquiagem-conhecida"
  | "skincare-conhecida"
  | "coreana"
  | "desconhecida";

/**
 * Maquiagem que a compradora brasileira reconhece sem pensar.
 *
 * As nacionais vêm de duas origens que valem a mesma coisa aqui: a
 * marca de varejo (Ruby Rose, Vult, Dailus, Océane) e a marca de
 * influenciadora (Boca Rosa, Bruna Tavares, Mari Maria, WePink,
 * Franciny). O dono citou a segunda por nome, e ela é a que move
 * comentário em grupo.
 */
const MAQUIAGEM =
  /\b(quem disse,? berenice|ruby rose|oceane|payot|boca rosa|bruna tavares|bt beauty|mari maria|wepink|we ?pink|franciny|nah cardoso|vult|dailus|tracta|simple organic|max love|eudora|natura|avon|o boticario|koloss|melu|revlon|kiko milano|maybelline|l'?oreal paris|nyx|catrice|essence makeup|too faced|fenty|rimmel|wet ?n ?wild|mac cosmetics|benefit|clinique|urban decay)\b/;

/**
 * Skincare que a pessoa reconhece, e a dermocosmética que é o que ela
 * pesquisa antes de comprar.
 */
const SKINCARE =
  /\b(cerave|cera ?ve|la roche[- ]?posay|vichy|eucerin|neutrogena|nivea|principia|creamy|sallve|adcos|isdin|epidrat|episol|mantecorp|biore|garnier|korres|the ordinary|skinceuticals|avene|uriage|dermage|anasol|sundown|australian gold|cetaphil|bepantol|hidraderm|ada tina|profuse|dermacyd)\b/;

/**
 * As coreanas. O dono pediu K-beauty por nome em 13/08, e elas viraram
 * termo de busca do coletor no mesmo dia.
 */
const COREANAS =
  /\b(cosrx|some by mi|beauty of joseon|anua|skin1004|mediheal|laneige|innisfree|missha|torriden|round lab|isntree|purito|dr\.? ?jart|etude house|holika|tocobo|numbuzin|axis-?y|abib)\b|coreano|coreana|k-?beauty/;

export type MarcaDeBelezaLida = {
  faixa: FaixaDeBeleza;
  /** O que casou, para o log. Nulo quando nada casou. */
  marca: string | null;
};

export function marcaDeBeleza(titulo: string | null | undefined): MarcaDeBelezaLida {
  const t = normaliza((titulo ?? "").trim());

  /*
    A ORDEM É DELIBERADA e resolve o cruzamento real do catálogo: "Kit
    Payot Vitamina C Limpeza e Anti Idade" casa com maquiagem (Payot) e
    com skincare (nada), e "Base matte Payot Boca Rosa Beauty" casa com
    as duas listas de maquiagem. Como as três faixas valem o mesmo peso,
    qual ganha só muda o texto do log — mas o log precisa ser estável
    para que "por que este saiu na frente" tenha uma resposta só.

    A coreana vem por último porque ela é a mais frouxa das três: ela
    casa com a palavra "coreano" solta, que aparece em título de
    vendedor que só está pegando carona no assunto.
  */
  const maquiagem = t.match(MAQUIAGEM);
  if (maquiagem) return { faixa: "maquiagem-conhecida", marca: maquiagem[0] };

  const skincare = t.match(SKINCARE);
  if (skincare) return { faixa: "skincare-conhecida", marca: skincare[0] };

  const coreana = t.match(COREANAS);
  if (coreana) return { faixa: "coreana", marca: coreana[0] };

  return { faixa: "desconhecida", marca: null };
}

/**
 * O peso da faixa na ordem da fila. Maior sai primeiro.
 *
 * As três faixas boas valem o mesmo, pelo mesmo motivo da lista de
 * perfume: o dono pediu as três no mesmo pedido, sem hierarquia, e
 * inventar uma seria decidir por ele qual grupo o Radar Delas é.
 */
export function pesoDaMarcaDeBeleza(titulo: string | null | undefined): number {
  return marcaDeBeleza(titulo).faixa === "desconhecida" ? 0 : 1;
}
