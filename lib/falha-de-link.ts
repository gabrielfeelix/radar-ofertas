/**
 * A falha de geração de link tem conserto numa próxima rodada?
 *
 * POR QUE ISTO EXISTE, e o número que forçou.
 *
 * Até 04/08 o publicador tratava toda falha igual: devolvia `false` e a
 * publicação continuava `pendente`. Como a fila de cada rodada é lida
 * por `estado = 'pendente'`, e não havia estado terminal nem contador de
 * tentativa, o item que não tinha conserto voltava para sempre.
 *
 * Medido no log do Actions em 04/08: o contador de "sem link" subiu de 7
 * para 11 ao longo do dia, sempre com as mesmas URLs, e a mesma
 * prateleira reprovada apareceu em 4 de 4 execuções examinadas. Onze
 * execuções concluídas davam da ordem de noventa chamadas por dia ao
 * gerador da Central — que é o painel de outra empresa, batido com a
 * sessão do dono. É assim que conta de afiliado é limitada.
 *
 * A LISTA É CURTA E LITERAL, DE PROPÓSITO.
 *
 * Errar para o lado de `permanente` significa encerrar em silêncio uma
 * oferta que teria dado certo, e publicação que some sem explicação é
 * exatamente o desfecho que o publicador inteiro tenta evitar. Então o
 * padrão é `transitorio`: o desconhecido volta a tentar.
 *
 * É a mesma escolha da D-036 sobre lista preta contra lista branca,
 * invertida de propósito, porque aqui o custo de errar é o oposto: lá o
 * desconhecido tinha que separar, aqui ele tem que passar.
 */

export type TipoDeFalhaDeLink =
  /** A URL não vai ser aceita amanhã também. Encerra a publicação. */
  | "permanente"
  /** Cadastro do canal, e vale para toda a fila dele. Trava o canal na rodada. */
  | "canal"
  /** Sessão, rede, resposta vazia. Continua pendente e tenta de novo. */
  | "transitorio";

export type FalhaDoGeradorDeLink = {
  motivo?: string;
  /** 109 = etiqueta não associada a este afiliado. */
  codigo?: number;
};

export function classificaFalhaDeLink(falha?: FalhaDoGeradorDeLink | null): TipoDeFalhaDeLink {
  const motivo = String(falha?.motivo ?? "");

  /*
    ETIQUETA NÃO CADASTRADA NA CENTRAL.

    Testado com uma etiqueta inventada, e a resposta é literal:
    `{"message":"Tag is not associated with this affiliate.","error_code":109}`.

    É configuração do canal, não do item: todo item da fila daquele
    canal receberia a mesma recusa. Por isso ele trava o canal na rodada
    em vez de encerrar publicação — consertar a etiqueta na Central tem
    que voltar a funcionar sozinho, sem ninguém desfazer nada no banco.
    É a pendência do Beauty com `radargeral` (D-045).
  */
  if (falha?.codigo === 109 || /tag is not associated/i.test(motivo)) {
    return "canal";
  }

  /*
    A URL NÃO SERVE, e vem de dois lugares diferentes.

    Do gerador do Mercado Livre: `URL not allowed in affiliates
    program`, que foi o motivo de 7 a 11 falhas por rodada em 04/08, o
    dia inteiro, sempre nas mesmas URLs. Não é sessão e não é rede: é o
    catálogo do programa dizendo que aquele anúncio não participa.

    De `montaLinkDeAfiliado`, no caminho da Amazon e da Shopee: a URL
    guardada no anúncio não é uma URL. Também não conserta sozinha.

    As duas frases estão listadas literalmente em vez de uma regex
    esperta com "inválid": `sessão inválida` casaria nela, e sessão é
    justamente o caso que TEM que voltar a tentar. Um falso positivo
    aqui apaga a fila inteira quando o cookie expira.
  */
  const urlNaoServe =
    /url not allowed|invalid url/i.test(motivo) ||
    /url do an[úu]ncio [ée] inv[áa]lida/i.test(motivo) ||
    /n[ãa]o tem url/i.test(motivo);

  if (urlNaoServe) {
    return "permanente";
  }

  /*
    O RESTO VOLTA A TENTAR, e a sessão é o caso principal.

    O gerador responde 401/403 quando o cookie expira, e às vezes devolve
    HTML de login com status 200 — que `geraLinks` já traduz para
    `sessao_da_central: ...`. Renovar a sessão faz tudo voltar, então
    encerrar aqui seria jogar fora a fila inteira por causa de um cookie.
  */
  return "transitorio";
}
