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
  /**
   * A linha do cupom dentro do post da oferta (migration 64).
   *
   * Some inteira quando não há cupom que sirva, igual à do frete. O
   * cupom continua saindo como post próprio também (D-039): as duas
   * coisas convivem, porque quem entrou no canal depois do post de
   * cupom não o viu.
   */
  linhaCupom?: string;
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
  /**
   * A leitura ANTERIOR nossa, quando existe.
   *
   * É o que vira `{queda}` no lastro, e é o único número da mensagem que
   * não veio da loja. O "de" e o "por" são alegação e preço dela; a
   * queda é medição nossa, entre duas leituras.
   *
   * Isto é o que o canal tem e o concorrente não: quem repassa oferta
   * alheia só sabe o que a loja disse. Por isso o lastro carrega o
   * número, e não uma frase genérica: "baixou 18%" se confere, "vimos o
   * preço mudar" não diz nada.
   */
  precoAnteriorCentavos?: number | null;
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
  /**
   * Quantas vendas o vendedor tem, quando a loja informa.
   *
   * É o sinal de confiança mais barato que existe, e é o que os canais
   * que funcionam publicam: *"Loja: BAGATELLE (+10.000 vendas,
   * mercadolíder)"*. Medido em 04/08: o Mercado Livre informa em **100%**
   * dos nossos anúncios, a Shopee em nenhum.
   *
   * Arredondado para baixo na exibição, e nunca para cima: dizer
   * "+10.000" com 10.400 é honesto, com 9.900 é mentira pequena.
   */
  vendasDoVendedor?: number | null;
  /**
   * O selo cru do marketplace (`platinum`, `gold`, `silver`).
   *
   * Vem separado da reputação de propósito: `reputacao_vendedor` é
   * número para a comporta comparar, e o número perde o selo no teto
   * (verde comum e verde platinum viram 1,0). Este campo é para LER.
   */
  seloDoVendedor?: string | null;
  /** O vendedor é loja oficial do marketplace? */
  lojaOficial?: boolean | null;
  /**
   * O cupom que serve para ESTE produto, se houver.
   *
   * Quem decide se serve é quem chama, com o escopo de `cupons_vivos`:
   * cupom de nicho só vale no nicho, e cupom de outra loja nunca vale.
   * Aqui ele só é escrito.
   */
  cupom?: { codigo: string } | null;
};

/**
 * Escapa o que vira `parse_mode: "HTML"` no Telegram.
 *
 * A regra da API é literal: *"All `<`, `>` and `&` symbols that are not
 * a part of a tag or an HTML entity must be replaced with the
 * corresponding HTML entities"*, e as únicas entidades nomeadas aceitas
 * são `&lt;`, `&gt;`, `&amp;` e `&quot;`.
 *
 * ISTO VALE SÓ PARA VALOR VINDO DE DADO, e a distinção é o coração
 * disto. O corpo do modelo é escrito pelo dono e **contém HTML de
 * propósito** desde a migration 49: `<a href="{link}">`, `<b>`, `<s>`.
 * Escapar o corpo inteiro transformaria a mensagem publicada num
 * amontoado de `&lt;a href=...&gt;` à vista de todo mundo.
 *
 * Então a fronteira é: título de produto, nome de vendedor, nome de
 * loja, nota do curador e o link — que vêm de marketplace ou de banco e
 * ninguém revisou — são escapados. O texto que o dono digitou em
 * Ajustes passa inteiro.
 *
 * O CASO QUE MAIS IMPORTA É O LINK, e ele é o mais recente. Desde a
 * migration 49 o link vai dentro de `href="..."`, e o da Shopee e o da
 * Amazon carregam `&` entre os parâmetros:
 *
 *   an_redir?origin_link=...&affiliate_id=18378371108&sub_id=xxxx----
 *
 * Um `&` cru dentro de atributo está fora da especificação. O link do
 * Mercado Livre é `meli.la/...` e não tem `&`, e é por isso que nada
 * quebrou até hoje: em 04/08 as 11 execuções publicaram só Mercado
 * Livre. O primeiro post de Shopee depois da migration 49 é que decide,
 * e escapar custa nada.
 */
export function escapaHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** As variáveis que o corpo aceita, para a tela listar sem inventar. */
export const VARIAVEIS = [
  { chave: "produto", explica: "o título do produto" },
  { chave: "preco", explica: "o preço de agora" },
  { chave: "preco_antes", explica: "a mediana que observamos" },
  { chave: "desconto", explica: "a queda em porcento, sem o sinal" },
  { chave: "loja", explica: "Mercado Livre, Shopee, Amazon" },
  { chave: "vendedor", explica: "quem vende no anúncio" },
  { chave: "lastro", explica: "a frase do histórico — muda com a série" },
  { chave: "queda", explica: "quanto baixou desde a nossa leitura anterior, em porcento. Só existe dentro do lastro de queda" },
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

/**
 * Como o vendedor é descrito na mensagem.
 *
 * POR QUE ISTO EXISTE. Até 04/08 a linha era só o nome, ou a palavra
 * "Loja oficial". Os canais que funcionam publicam mais, e é o sinal de
 * confiança mais barato que existe. Copiado de post real do
 * `@emanalise`, lido em `docs/concorrentes-lidos.md`:
 *
 *   🏪 Loja: BAGATELLE (+10.000 vendas, mercadolíder)
 *
 * O QUE ENTRA, e cada pedaço só entra quando o dado existe:
 *
 *   nome                        sempre que a loja informa
 *   loja oficial                é o selo mais forte, e substitui o resto
 *   +N vendas                   Mercado Livre informa em 100%; Shopee, nunca
 *   MercadoLíder / Platinum     do `power_seller_status` (migration 64)
 *
 * O ARREDONDAMENTO É SEMPRE PARA BAIXO, e isso é a regra 3.4 aplicada a
 * outro número: "+10.000 vendas" com 10.400 é honesto, com 9.900 é
 * mentira pequena. Mentira pequena sobre número verificável é a mais
 * cara de todas, porque quem confere uma vez não confia mais em nenhuma.
 *
 * Some inteiro quando não há nem nome: linha com parêntese vazio é pior
 * que linha nenhuma.
 */
export function descreveVendedor(dados: {
  vendedor: string;
  vendasDoVendedor?: number | null;
  seloDoVendedor?: string | null;
  lojaOficial?: boolean | null;
}): string {
  const partes: string[] = [];

  const vendas = dados.vendasDoVendedor;
  if (typeof vendas === "number" && Number.isFinite(vendas) && vendas >= 100) {
    partes.push(`+${arredondaParaBaixo(vendas)} vendas`);
  }

  /*
    O selo do Mercado Livre em português, como o comprador o vê no
    site. `platinum` e `gold` são MercadoLíder; `silver` é o degrau de
    entrada e não vale linha.
  */
  const selo = dados.seloDoVendedor?.toLowerCase();
  if (selo === "platinum") partes.push("MercadoLíder Platinum");
  else if (selo === "gold") partes.push("MercadoLíder Gold");
  else if (selo === "silver") partes.push("MercadoLíder");

  const nome = dados.lojaOficial ? "Loja oficial" : dados.vendedor?.trim();
  if (!nome) {
    // Sem nome, o que sobra ainda vale: "+10.000 vendas" sozinho
    // informa, e some quando não há nem isso.
    return partes.length ? escapaHtml(partes.join(", ")) : "";
  }

  return partes.length
    ? `${escapaHtml(nome)} (${escapaHtml(partes.join(", "))})`
    : escapaHtml(nome);
}

/**
 * O degrau de baixo mais próximo, na escala que o comprador lê.
 *
 * 10.400 vira 10.000 e 9.900 vira 5.000, nunca o contrário. Os degraus
 * são os mesmos que os canais usam, porque são os que a pessoa
 * reconhece sem pensar.
 */
function arredondaParaBaixo(n: number): string {
  const degraus = [100_000, 50_000, 10_000, 5_000, 1_000, 500, 100];
  for (const d of degraus) {
    if (n >= d) return d.toLocaleString("pt-BR");
  }
  return String(n);
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

  /*
    A QUEDA É A ÚNICA COISA QUE NÓS MEDIMOS.

    `{antes}` e `{agora}` são preços da loja. `{queda}` é a diferença
    entre duas leituras NOSSAS, e é o que sustenta a confiança: nenhum
    canal que repassa oferta alheia consegue dizer isso.

    Arredonda para inteiro porque "baixou 18%" é o que a pessoa lê;
    "17,86%" tem cara de planilha e não de gente.
  */
  const quedaPct =
    dados.precoAnteriorCentavos && dados.precoAnteriorCentavos > dados.precoCentavos
      ? Math.round(
          ((dados.precoAnteriorCentavos - dados.precoCentavos) / dados.precoAnteriorCentavos) * 100,
        )
      : null;

  /*
    Sem o número, a linha da queda não sai.

    `⚡ Baixou % desde a leitura de ontem.` é pior que linha nenhuma: o
    buraco no lugar do número faz a mensagem inteira parecer quebrada, e
    numa oferta de queda o `preco_anterior` sempre existe — se ele
    faltar, algo está errado e o silêncio é o desfecho certo.
  */
  const semNumeroDaQueda = dados.gatilho === "queda" && quedaPct == null && molde.includes("{queda}");

  const lastro = semNumeroDaQueda
    ? ""
    : preenche(molde, {
        janela: String(dados.janelaDias),
        desde: formataDia(dados.observadoDesde),
        antes: reais(dados.precoAntesCentavos),
        agora: reais(dados.precoCentavos),
        queda: quedaPct != null ? String(quedaPct) : "",
      });

  // A linha inteira some quando não há nota. Deixar o prefixo sozinho
  // seria pior que não ter: um emoji solto numa mensagem por dia é
  // detalhe, em trinta por dia é sujeira.
  // O prefixo é do modelo e passa inteiro; a nota é texto guardado no
  // produto e vai escapada.
  const nota = dados.notaDoCurador?.trim()
    ? `${modelo.notaPrefixo ?? "💬"} ${escapaHtml(dados.notaDoCurador.trim())}`
    : "";

  /*
    A linha do frete some quando não há frete grátis, pela mesma razão
    da nota do curador: rótulo órfão numa mensagem por dia é detalhe,
    em trinta por dia é sujeira. E `false` some junto com `null` de
    propósito — anunciar que o frete é pago não ajuda ninguém.
  */
  const frete = dados.freteGratis ? (modelo.linhaFrete ?? "🚚 Frete grátis") : "";

  /*
    A LINHA DO CUPOM, e ela some junto com o cupom.

    O código vem de texto colhido de canal alheio, que é a entrada menos
    confiável do sistema inteiro, então vai escapado. O resto da linha é
    do modelo, que é texto do dono.
  */
  const cupom = dados.cupom?.codigo
    ? preenche(modelo.linhaCupom ?? "🎟 Cupom: <b>{codigo}</b>", {
        codigo: escapaHtml(dados.cupom.codigo),
      })
    : "";

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
    // `frete`, `nota` e `lastro` já vêm montados do modelo, que é texto
    // do dono. O que é dado de fora vai escapado (ver `escapaHtml`).
    frete,
    nota,
    cupom,
    lastro,
    produto: escapaHtml(dados.produto),
    preco: reais(dados.precoCentavos),
    preco_antes: reais(dados.precoAntesCentavos),
    desconto: String(dados.descontoPct),
    loja: escapaHtml(dados.loja),
    vendedor: descreveVendedor(dados),
    /*
      O LINK TAMBÉM É ESCAPADO, e isto só pôde ser feito depois de medir.

      O link da Shopee e o da Amazon levam `&` entre os parâmetros, e vão
      dentro de `href="..."` desde a migration 49. A especificação manda
      escapar; o medo era o contrário — que o Telegram passasse `&amp;`
      literal para a URL, o destino lesse `amp;affiliate_id` e **a
      comissão não fosse atribuída**. Post bonito, zero real, que é o
      pior modo de falha deste projeto.

      MEDIDO EM 04/08, com o bot de verdade. Mandei as duas formas para
      um canal e li o campo `url` da entidade `text_link` que a própria
      API devolve — que é a URL como o Telegram a guardou, sem depender
      de ninguém clicar:

        com `&amp;`  →  ...&affiliate_id=18378371108&sub_id=teste01----
        com `&` cru  →  ...&affiliate_id=18378371108&sub_id=teste01----

      Idênticas, e idênticas à original. Ele decodifica a entidade dentro
      do atributo. As duas mensagens de teste foram apagadas em seguida.

      Com isso o escape deixa de ter risco e passa a valer para a
      mensagem inteira, sem exceção.
    */
    link: escapaHtml(dados.link),
  });

  return texto.replace(/\n{3,}/g, "\n\n").trim();
}

/** O que um post de cupom precisa saber. */
export type DadosDoCupom = {
  codigo: string;
  loja: string;
  percentual: number;
  /** Zero quer dizer sem mínimo declarado, e a condição some. */
  minimoCentavos: number;
  /** Nulo quer dizer sem teto declarado, e a condição some. */
  tetoCentavos: number | null;
  /** O nome da categoria, quando o cupom é de uma. Vazio se é geral. */
  onde?: string | null;
  /** `YYYY-MM-DD` do último dia em que vale. */
  validade: string;
};

/**
 * O post de cupom.
 *
 * POR QUE ELE EXISTE COMO MENSAGEM PRÓPRIA, e não como linha dentro de
 * uma oferta: o cupom do Mercado Livre é **por categoria**, e colá-lo
 * num produto que não é daquela categoria faz o desconto falhar no
 * carrinho. A pesquisa listou isso como a armadilha mais comum de quem
 * republica cupom alheio, e o custo dela é reclamação de seguidor, que
 * é o que a regra 3.4 existe para evitar em outro contexto.
 *
 * Como post separado, ele diz o que é e o leitor decide onde usar.
 *
 * E ele resolve um problema de calendário: a série de preço tem dois
 * dias, então quase toda oferta hoje vem do desconto que a loja
 * declara. O cupom **não depende de série nenhuma** e é conteúdo
 * verdadeiro no primeiro dia.
 *
 * NADA AQUI AFIRMA PREÇO. O cupom é um percentual sobre o que o leitor
 * escolher, então não há "de/por" para inflar, e a regra 3.4 não tem
 * como ser violada por esta mensagem.
 */
export function montaMensagemDeCupom(corpoCupom: string, dados: DadosDoCupom): string {
  /*
    AS CONDIÇÕES SÃO SÓ AS DECLARADAS.

    Mínimo zero e teto nulo não viram "sem mínimo" nem "sem limite":
    viram silêncio. Nós lemos o cupom do texto de um canal, e o que ele
    não disse nós não sabemos — afirmar ausência de limite seria
    inventar uma condição melhor do que a que foi lida.
  */
  const condicoes = [
    dados.minimoCentavos > 0 ? `Compra mínima de ${reais(dados.minimoCentavos)}` : null,
    dados.tetoCentavos != null ? `desconto de até ${reais(dados.tetoCentavos)}` : null,
  ].filter(Boolean);

  const texto = preenche(corpoCupom, {
    // Código e loja vêm do texto colhido de canal alheio, que é a
    // entrada menos confiável do sistema inteiro.
    codigo: escapaHtml(dados.codigo),
    loja: escapaHtml(dados.loja),
    percentual: String(dados.percentual),
    onde: dados.onde?.trim() ? ` em ${escapaHtml(dados.onde.trim())}` : "",
    condicoes: condicoes.length > 0 ? `${condicoes.join(", ")}.` : "",
    validade: formataDia(dados.validade),
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
