/**
 * O produto é eletrônico se disfarçando de beleza?
 *
 * POR QUE ISTO EXISTE. Em 11/08 o Radar Delas, que é um grupo de
 * mulheres sobre beleza e autocuidado, publicou isto:
 *
 *   Limpador De fone AirPods Higienizador          R$ 24,83
 *
 * A curadoria não errou, e é isso que torna o caso interessante. O
 * caminho inteiro está certo:
 *
 *   Shopee diz         Beauty > Beauty Tools
 *   nicho_dominio diz  SHOPEE-100663 -> beleza
 *   canal aceita       Radar Delas cobre beleza
 *
 * **Quem classifica limpador de AirPods como ferramenta de beleza é a
 * Shopee**, e o nosso mapeamento obedece porque obedecer é o certo na
 * imensa maioria dos casos: `Beauty Tools` também é pincel, esponja,
 * pinça e espelho, que são exatamente o produto-alvo do canal. Cortar a
 * categoria inteira derrubaria o bom junto com o ruim, e foi por isso
 * que a saída escolhida foi o título e não o domínio.
 *
 * O MECANISMO É O MESMO DO `USO` (migration 55) E DO `GENDER`
 * (migration 37): o atributo sai do título, e o canal decide se quer ou
 * não por `canal_atributo`. Nenhuma tabela nova, e a decisão fica sendo
 * dado — o Radar Tech não exclui `TIPO`, então marcar um fone de
 * verdade não custa nada a ele.
 *
 * A MARCAÇÃO É GLOBAL E A EXCLUSÃO É DO CANAL, e a assimetria é de
 * propósito. Um fone marcado como eletrônico no catálogo inteiro não
 * atrapalha ninguém: só o Beauty e o Delas excluem. Se um dia existir
 * canal que queira gadget de beleza, é só não excluir.
 *
 * A LISTA É LITERAL E COVARDE, pela mesma razão de sempre: falso
 * positivo aqui apaga oferta boa em silêncio, e ninguém descobre.
 * `usb` sozinho ficou de fora porque escova alisadora recarregável diz
 * "USB" no título e é produto-alvo do canal.
 */

/** O valor que vai para `produto.atributos.TIPO`. */
export const TIPO_ELETRONICO = "eletronico";

function normaliza(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/*
  Aparelho e acessório de informática. Nada disto é beleza em nenhuma
  leitura, e a presença de qualquer um no título já decide.

  Os dois primeiros são os títulos reais que motivaram o arquivo:

    Limpador De fone AirPods Higienizador
    Kit Limpeza Celular Teclado Pc Notebook ... Fone De Ouvido Tablet
*/
const ELETRONICO = [
  "fone",
  "fones",
  "airpods",
  "air pods",
  "headset",
  "headphone",
  "earbud",
  // `celular` NÃO entra aqui. Ver `CELULAR_DE_TELEFONE` logo abaixo.
  "smartphone",
  "iphone",
  "tablet",
  "notebook",
  "laptop",
  "teclado",
  "mouse",
  "monitor",
  "computador",
  "impressora",
  "roteador",
  "pendrive",
  "ssd",
  "hd externo",
  "cabo usb",
  "carregador",
  "power bank",
  "caixa de som",
  "smartwatch",
  "controle remoto",
  "videogame",
  "playstation",
  "xbox",
  "nintendo",
  "drone",
];

/*
  `CELULAR` TEM DOIS SIGNIFICADOS, E EM COSMÉTICO É CÉLULA.

  MEDIDO NA PRÓPRIA MIGRATION 66, minutos depois de aplicá-la: de sete
  produtos marcados, QUATRO eram falso positivo, e todos pelo mesmo
  motivo:

    NIVEA Creme para Mãos Q10 Plus ... Renovação Celular
    Acquaflora Nutrição Celular  Shampoo 300ml
    Acquaflora Nutrição Celular  Condicionador 300ml
    Kit Acquaflora Nutrição Celular Duo

  Nenhum deles tem telefone nenhum. "Nutrição celular" e "renovação
  celular" são copy de cosmético, e o canal de beleza é justamente onde
  essa expressão mais aparece. Marcar esses quatro tirava do Radar Delas
  três produtos que são exatamente o que ele existe para publicar.

  É a mesma armadilha do "litro" que a migration 56 desfez em 741
  linhas: a palavra não é o sinal, a palavra DENTRO DE UM CONTEXTO é.
  Litro num shampoo quer dizer salão e numa panela quer dizer panela;
  celular num creme quer dizer célula e num suporte quer dizer telefone.

  A lista de resgate é literal e cresce com o que aparecer. Errar para o
  lado de deixar passar custa um post de suporte de celular; errar para
  o outro lado apaga a linha de tratamento inteira de uma marca.
*/
const CELULAR_DE_TELEFONE =
  /(?<!\b(?:nutricao|renovacao|regeneracao|reparacao|recuperacao|revitalizacao|oxigenacao|hidratacao|protecao|comunicacao|multiplicacao|divisao|energia|nivel|matriz|atividade|memoria|defesa|acao|estimulo)\s{1,3})\bcelular\b/;

/*
  Palavras que devolvem o produto para a beleza mesmo tendo casado
  acima.

  `escova` é a armadilha: "escova de dente elétrica" não é beleza, mas
  "escova secadora", "escova alisadora" e "escova de cabelo" são o
  coração do canal, e nenhuma delas casa com a lista acima. O que
  precisa de resgate é o caso em que a palavra eletrônica aparece
  descrevendo o PRÓPRIO produto de beleza:

    Secador Com Difusor e Cabo USB
    Espelho De Maquiagem Com Suporte Para Celular

  O segundo é justamente o que `docs/personas-dos-canais.md` listou
  como "não é beleza", então ele NÃO é resgatado. O primeiro é, e é por
  isso que a lista de resgate é de produto e não de acessório.
*/
const AINDA_E_BELEZA = [
  "secador",
  "chapinha",
  "prancha de cabelo",
  "modelador de cachos",
  "babyliss",
  "depilador",
  "barbeador",
  "aparador de pelos",
  "escova secadora",
  "escova alisadora",
  "escova rotativa",
];

/**
 * O título indica eletrônico, e não produto de beleza?
 *
 * Devolve `false` no caso duvidoso, que é a mesma covardia deliberada
 * de `ehSuprimentoProfissional`: a regra existe para tirar o que é
 * claramente de outro mundo, não para adivinhar.
 */
export function ehEletronicoEmBeleza(titulo: string | null | undefined): boolean {
  if (!titulo) return false;
  const t = normaliza(titulo);

  if (AINDA_E_BELEZA.some((m) => t.includes(m))) return false;
  if (ELETRONICO.some((m) => new RegExp(`\\b${m}\\b`).test(t))) return true;
  return CELULAR_DE_TELEFONE.test(t);
}

/**
 * Os atributos com `TIPO` preenchido, ou `null` quando não há o que
 * acrescentar.
 *
 * Não sobrescreve um `TIPO` que já exista: se alguém marcou à mão, a
 * mão ganha. É a mesma regra de `atributosComUso`.
 */
export function atributosComTipo(
  titulo: string | null | undefined,
  atuais: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (atuais && typeof atuais.TIPO === "string" && atuais.TIPO.trim() !== "") return null;
  if (!ehEletronicoEmBeleza(titulo)) return null;
  return { ...(atuais ?? {}), TIPO: TIPO_ELETRONICO };
}
