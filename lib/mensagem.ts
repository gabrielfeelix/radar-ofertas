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
  /** O que abre a linha da nota. Sai junto quando não há nota. */
  notaPrefixo?: string;
  lastroCom: string;
  lastroSem: string;
  /**
   * O terceiro caso: a oferta que nasceu de uma queda de hoje, não da
   * série. Ela não fala de histórico nenhum — fala do que aconteceu
   * nas últimas horas, e é a afirmação mais forte que sustenta.
   */
  lastroQueda: string;
  /**
   * O quarto caso: a loja marcou o anúncio como promoção e nós não
   * medimos nada. **Tem que atribuir a alegação à loja**, porque o
   * `original_price` do Mercado Livre é frequentemente inflado, e
   * assumi-lo como nosso é repetir a mentira que a regra 3.4 proíbe.
   */
  lastroDeclarado: string;
  /**
   * A linha de frete grátis, quando a loja declara.
   *
   * É a linha que os canais que funcionam sempre põem e nós não
   * púnhamos: em produto barato o frete é metade do preço, e o dado
   * vinha na resposta da API desde sempre.
   */
  linhaFrete?: string;
};

/**
 * O que fez a oferta existir.
 *
 * `serie` = está barata contra a mediana que NÓS observamos, com
 * série suficiente. `queda` = caiu desde a leitura anterior, e pode
 * ter três horas de vida. `declarado` = a LOJA diz que está em
 * promoção, e nós não medimos nada.
 *
 * NÃO É DETALHE DE ORIGEM, É O QUE A MENSAGEM PODE AFIRMAR. Uma queda
 * de três horas escrita como "menor preço que observamos" é
 * exatamente a mentira que a regra 3.4 existe para impedir — e é a
 * que queima o canal.
 *
 * O `declarado` é o mais fraco dos três e por isso o mais perigoso: o
 * preço de antes é alegação de terceiro. A mensagem dele nomeia a loja
 * como quem afirma, e é essa atribuição que separa reportar de mentir.
 */
export type GatilhoDaOferta = "serie" | "queda" | "declarado";

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
  /** O que fez a oferta existir. Ausente = série, que era o único caso antes. */
  gatilho?: GatilhoDaOferta;
  /**
   * A nota do curador, escrita à mão no produto.
   *
   * É o que a máquina não sabe — "amadeirado clássico, ideal pra
   * fumante de Malboro" não sai de API nenhuma. Vazia na maioria dos
   * produtos, e a linha inteira some quando não há nota: emoji órfão
   * num canal que publica trinta por dia vira sujeira.
   */
  notaDoCurador?: string | null;
  /**
   * A loja declara frete grátis?
   *
   * **Nulo é diferente de falso, e a diferença sai na mensagem.** Nulo
   * é "não medimos", e nesse caso a linha some inteira: dizer "frete
   * não incluso" sobre um anúncio que talvez tenha frete grátis é
   * mentir para o lado caro, e custa a venda sem motivo.
   */
  freteGratis?: boolean | null;
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
  { chave: "nota", explica: "a sua opinião sobre o produto, escrita na ficha dele. Some quando não há" },
  { chave: "frete", explica: "a linha de frete grátis. Some quando a loja não declara" },
  { chave: "link", explica: "o link com subid, do nosso redirecionador" },
] as const;

/**
 * Como se identifica publicidade, e onde isso pode aparecer.
 *
 * Regra 3.10. Link de afiliado gera comissão, e conteúdo remunerado é
 * publicidade — o CONAR é explícito em dizer que remuneração por
 * performance não muda isso, e a própria Shopee repete a regra para os
 * afiliados dela.
 *
 * `#ad` está fora de propósito: a orientação é que termo em inglês não
 * é reconhecido pelo público brasileiro, e identificação que ninguém
 * entende não identifica nada.
 */
export const IDENTIFICACOES = ["#publi", "#publicidade", "#parceriapaga", "#conteúdopago"];

/**
 * Onde a identificação ainda conta como "de imediato".
 *
 * O CONAR pede que a natureza publicitária apareça sem a pessoa
 * precisar rolar a tela ou abrir o "mais". Numa mensagem curta de
 * oferta, isso quer dizer as primeiras linhas — não a última, depois
 * do link, onde o costume do mercado a esconde.
 */
const LINHAS_VISIVEIS = 3;

export function temIdentificacaoPublicitaria(corpo: string): boolean {
  const texto = corpo.toLowerCase();
  return IDENTIFICACOES.some((marca) => texto.includes(marca));
}

/** A identificação existe, mas só depois do que a pessoa lê de cara. */
export function identificacaoEstaEscondida(corpo: string): boolean {
  if (!temIdentificacaoPublicitaria(corpo)) return false;
  const inicio = corpo.split("\n").slice(0, LINHAS_VISIVEIS).join("\n").toLowerCase();
  return !IDENTIFICACOES.some((marca) => inicio.includes(marca));
}

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
/**
 * Tem travessão? (regra 3.11)
 *
 * Parece implicância e não é: travessão em texto de canal **tem cara
 * de IA**, e canal de oferta vive de parecer gente. O leitor não sabe
 * explicar por quê, mas sente, e desconfiança custa a venda.
 *
 * Vale só para o que o público lê. Código e documentação seguem
 * normais.
 */
export function temTravessao(texto: string): boolean {
  return /[—–]/.test(texto);
}

export function afirmaMinimoSemLastro(texto: string): boolean {
  return PROIBIDAS.some((padrao) => padrao.test(texto));
}

/** Renderiza o modelo com os dados de uma oferta. */
export function montaMensagem(modelo: ModeloDeMensagem, dados: DadosDaMensagem): string {
  // A queda vem primeiro e ignora `podeAfirmarMinimo`: numa oferta de
  // queda ele é sempre falso, mas depender disso deixaria a regra
  // valendo por acidente. Aqui ela vale por decisão.
  const molde =
    dados.gatilho === "queda"
      ? modelo.lastroQueda
      : dados.gatilho === "declarado"
        ? modelo.lastroDeclarado
        : dados.podeAfirmarMinimo
          ? modelo.lastroCom
          : modelo.lastroSem;

  const lastro = preenche(molde, {
    janela: String(dados.janelaDias),
    desde: formataDia(dados.observadoDesde),
    antes: reais(dados.precoAntesCentavos),
    agora: reais(dados.precoCentavos),
  });

  // A linha inteira some quando não há nota. Deixar o prefixo sozinho
  // seria pior que não ter: um emoji solto numa mensagem por dia é
  // detalhe, em trinta por dia é sujeira.
  const nota = dados.notaDoCurador?.trim()
    ? `${modelo.notaPrefixo ?? "💬"} ${dados.notaDoCurador.trim()}`
    : "";

  /*
    A linha do frete some quando não há frete grátis, pela mesma razão
    da nota do curador: rótulo órfão numa mensagem por dia é detalhe,
    em trinta por dia é sujeira. E `false` some junto com `null` de
    propósito — anunciar que o frete é pago não ajuda ninguém.
  */
  const frete = dados.freteGratis ? (modelo.linhaFrete ?? "🚚 Frete grátis") : "";

  /*
    As linhas opcionais somem, e o BURACO DELAS TAMBÉM.

    `{nota}` e `{frete}` ficam vazios na maioria das mensagens, e cada
    um deixava para trás o par de quebras que o separava das vizinhas.
    Com os dois vazios o post saía com quatro linhas em branco no meio,
    e nenhum teste pegava isso: o texto estava certo, o espaçamento é
    que estava sobrando. Só aparece lendo o post publicado.

    Três quebras ou mais viram duas, que é o parágrafo. Nunca vira uma:
    o respiro entre blocos é o que faz a mensagem ser lida na rolagem.
  */
  const texto = preenche(modelo.corpo, {
    frete,
    nota,
    produto: dados.produto,
    preco: reais(dados.precoCentavos),
    preco_antes: reais(dados.precoAntesCentavos),
    desconto: String(dados.descontoPct),
    loja: dados.loja,
    vendedor: dados.vendedor,
    lastro,
    link: dados.link,
  });

  return texto.replace(/\n{3,}/g, "\n\n").trim();
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
