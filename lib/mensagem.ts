/**
 * O modelo da mensagem publicada, e como ele vira texto.
 *
 * POR QUE UM MODELO SÓ, E NÃO DOIS
 *
 * A especificação (`docs/telas.md`) pedia "as duas redações lado a
 * lado, a completa e a honesta reduzida, para que a diferença seja
 * escolhida conscientemente e não descoberta em produção".
 *
 * O objetivo está certo; tratá-las como duas **opções** está errado, e
 * o erro é de regra, não de gosto. Pela regra 3.4 do `AGENTS.md`, com
 * menos de 14 dias de série a redação honesta não é preferível — é
 * **obrigatória**. Duas caixas de texto em pé de igualdade convidam a
 * escolher a que mente, que é exatamente o que a regra existe para
 * impedir.
 *
 * Então o modelo é um corpo só, e o que muda com a série é o trecho do
 * lastro. A prévia mostra o **mesmo** modelo renderizado nos dois
 * estados: a pessoa vê o que as palavras dela viram quando o histórico
 * não existe, em vez de escolher entre dizer a verdade e não dizer.
 */

export type ModeloDeMensagem = {
  corpo: string;
  lastroCom: string;
  lastroSem: string;
};

export type DadosDaMensagem = {
  produto: string;
  precoCentavos: number;
  precoAntesCentavos: number;
  descontoPct: number;
  loja: string;
  vendedor: string;
  /** Dias da janela de referência. Vira `{janela}` no lastro com lastro. */
  janelaDias: number;
  /** Desde quando observamos. Vira `{desde}` no lastro sem lastro. */
  observadoDesde: string;
  link: string;
  /** A série alcançou o mínimo para afirmar mínimo histórico? */
  podeAfirmarMinimo: boolean;
};

/** As variáveis que o corpo aceita, para a tela listar sem inventar. */
export const VARIAVEIS = [
  { chave: "produto", explica: "o título do produto" },
  { chave: "preco", explica: "o preço de agora" },
  { chave: "preco_antes", explica: "a mediana que observamos" },
  { chave: "desconto", explica: "a queda em porcento, sem o sinal" },
  { chave: "loja", explica: "Mercado Livre, Shopee, Amazon" },
  { chave: "vendedor", explica: "quem vende no anúncio" },
  { chave: "lastro", explica: "a frase do histórico — muda com a série" },
  { chave: "link", explica: "o link com subid, do nosso redirecionador" },
] as const;

/**
 * Frases que afirmam mínimo histórico sem poder.
 *
 * A checagem é grosseira de propósito: ela não tenta entender a frase,
 * só recusa as construções que dizem "o menor de sempre". Falso
 * positivo aqui custa uma reescrita; falso negativo custa a confiança
 * do grupo, que é o ativo (regra 3.4).
 */
const PROIBIDAS = [
  /menor pre[çc]o hist[óo]rico/i,
  /pre[çc]o mais baixo (de|da) (todos|sempre|hist[óo]ria)/i,
  /nunca (esteve|foi) t[ãa]o barato/i,
  /m[íi]nimo hist[óo]rico/i,
  /o mais barato de todos/i,
];

/**
 * O `lastro_sem` viola a regra 3.4?
 *
 * Vale só para essa coluna. O `lastro_com` pode afirmar mínimo — ele
 * só é usado quando a série alcança os 14 dias, que é justamente
 * quando a afirmação passa a ter lastro.
 */
export function afirmaMinimoSemLastro(texto: string): boolean {
  return PROIBIDAS.some((padrao) => padrao.test(texto));
}

/** Renderiza o modelo com os dados de uma oferta. */
export function montaMensagem(modelo: ModeloDeMensagem, dados: DadosDaMensagem): string {
  const lastro = preenche(dados.podeAfirmarMinimo ? modelo.lastroCom : modelo.lastroSem, {
    janela: String(dados.janelaDias),
    desde: formataDia(dados.observadoDesde),
  });

  return preenche(modelo.corpo, {
    produto: dados.produto,
    preco: reais(dados.precoCentavos),
    preco_antes: reais(dados.precoAntesCentavos),
    desconto: String(dados.descontoPct),
    loja: dados.loja,
    vendedor: dados.vendedor,
    lastro,
    link: dados.link,
  });
}

/**
 * A prévia: o mesmo modelo, nos dois estados da série.
 *
 * Devolve os dois sempre, e não o que se aplica agora, porque a
 * pergunta da tela é "o que isto vira quando eu não tiver histórico" —
 * e essa pergunta não se responde olhando o caso feliz.
 */
export function previa(
  modelo: ModeloDeMensagem,
  dados: Omit<DadosDaMensagem, "podeAfirmarMinimo">,
): { comLastro: string; semLastro: string } {
  return {
    comLastro: montaMensagem(modelo, { ...dados, podeAfirmarMinimo: true }),
    semLastro: montaMensagem(modelo, { ...dados, podeAfirmarMinimo: false }),
  };
}

/**
 * Uma oferta de exemplo para a prévia.
 *
 * Números redondos e título curto seriam mentira confortável: o real
 * traz título de 180 caracteres vindo de canal alheio, e é nele que a
 * mensagem quebra. Este exemplo é deliberadamente feio (D-026).
 */
export const EXEMPLO: Omit<DadosDaMensagem, "podeAfirmarMinimo"> = {
  produto: "Tapete Higiênico SuperSecão 80x60 Pacote com 60 Unidades Super Absorvente Cães",
  precoCentavos: 8990,
  precoAntesCentavos: 14990,
  descontoPct: 40,
  loja: "Mercado Livre",
  vendedor: "PetShop Oficial",
  janelaDias: 30,
  observadoDesde: "2026-06-14",
  link: "https://go.seudominio.com.br/a1b2c3",
};

function preenche(texto: string, valores: Record<string, string>): string {
  // Só troca chave conhecida: `{qualquer_coisa}` digitado por engano
  // fica visível no texto, em vez de sumir e virar um buraco na
  // mensagem que ninguém percebe até ela ir para o grupo.
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) =>
    chave in valores ? valores[chave] : inteiro,
  );
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formataDia(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
