/**
 * Teste do modelo de mensagem.
 *
 * Roda com `pnpm testa`. Não precisa de banco, de Docker nem de rede —
 * é função pura sobre texto.
 *
 * Por que este arquivo existe: as duas regras que a mensagem obedece
 * são as duas em que errar não dá erro em lugar nenhum. Uma mensagem
 * que afirma mínimo histórico sem lastro (regra 3.4) ou que não diz
 * que é publicidade (regra 3.10) sai perfeita do sistema e só cobra o
 * preço depois — no grupo que perde a confiança, ou na conta de
 * afiliado que a Shopee suspende.
 *
 * As frases proibidas vieram de como as pessoas realmente escrevem, e
 * não de como um validador gostaria que escrevessem.
 */

import {
  afirmaMinimoSemLastro,
  descreveVendedor,
  temTravessao,
  identificacaoEstaEscondida,
  montaMensagem,
  montaMensagemDeCupom,
  previa,
  temIdentificacaoPublicitaria,
} from "../lib/mensagem.ts";

let passou = 0;
let falhou = 0;

function confere(nome, condicao) {
  if (condicao) {
    passou += 1;
    console.log(`✓ ${nome}`);
  } else {
    falhou += 1;
    console.error(`✗ ${nome}`);
  }
}

// =============================================================
// Regra 3.4 — nunca afirmar mínimo histórico sem lastro
// =============================================================

console.log("\nregra 3.4 — afirmação de mínimo histórico\n");

for (const frase of [
  "Menor preço histórico!",
  "menor preco historico",
  "MENOR PREÇO HISTÓRICO",
  "Nunca esteve tão barato",
  "nunca foi tao barato",
  "Mínimo histórico atingido",
  "O mais barato de todos",
  "Preço mais baixo de sempre",
]) {
  confere(`recusa: "${frase}"`, afirmaMinimoSemLastro(frase));
}

for (const frase of [
  "Menor preço que observamos desde {desde}.",
  "Menor preço em {janela} dias.",
  "Bom preço para o momento.",
  "Caiu bem contra a mediana das últimas semanas.",
]) {
  confere(`aceita: "${frase}"`, !afirmaMinimoSemLastro(frase));
}

// =============================================================
// Regra 3.10 — identificação publicitária
// =============================================================

console.log("\nregra 3.10 — identificação publicitária\n");

for (const marca of ["#publi", "#publicidade", "#parceriapaga", "#conteúdopago"]) {
  confere(`reconhece ${marca}`, temIdentificacaoPublicitaria(`${marca} · Shopee\n\n🔥 Produto`));
}

confere(
  "reconhece em maiúscula",
  temIdentificacaoPublicitaria("#PUBLI · Shopee\n\n🔥 Produto"),
);

confere(
  "#ad não conta — não é reconhecida pelo público brasileiro",
  !temIdentificacaoPublicitaria("#ad · Shopee\n\n🔥 Produto"),
);

confere(
  "marcar a loja não basta",
  !temIdentificacaoPublicitaria("🔥 Produto\n\nShopee · Vendedor\n👉 link"),
);

confere(
  "corpo sem identificação nenhuma é recusado",
  !temIdentificacaoPublicitaria("🔥 Produto\n\nDe R$ 10 por R$ 5\n👉 link"),
);

console.log("\nregra 3.10 — a identificação precisa aparecer de imediato\n");

confere(
  "na primeira linha: vale",
  !identificacaoEstaEscondida("#publi · Shopee\n\n🔥 Produto\n\nDe R$ 10 por R$ 5\n👉 link"),
);

confere(
  "na terceira linha: ainda vale",
  !identificacaoEstaEscondida("🔥 Produto\n\n#publi\n\nDe R$ 10 por R$ 5\n👉 link"),
);

confere(
  "no rodapé, depois do link: NÃO vale",
  identificacaoEstaEscondida(
    "🔥 Produto\n\nDe R$ 10 por R$ 5\nMenor preço em 30 dias.\n\nVendedor\n👉 link\n\n#publi",
  ),
);

confere(
  "sem identificação nenhuma não é 'escondida', é ausente",
  !identificacaoEstaEscondida("🔥 Produto\n👉 link"),
);

// =============================================================
// Renderização
// =============================================================

console.log("\nrenderização do modelo\n");

const modelo = {
  corpo: "#publi · {loja}\n\n🔥 {produto}\n\nDe {preco_antes} por {preco} (−{desconto}%)\n{lastro}\n\n{vendedor}\n👉 {link}",
  lastroCom: "Menor preço em {janela} dias.",
  lastroSem: "Menor preço que observamos desde {desde}.",
};

const dados = {
  produto: "Tapete Higiênico 80x60",
  precoCentavos: 8990,
  precoAntesCentavos: 14990,
  descontoPct: 40,
  loja: "Mercado Livre",
  vendedor: "PetShop Oficial",
  janelaDias: 30,
  observadoDesde: "2026-06-14",
  link: "https://go.exemplo.com/a1b2c3",
};

const comLastro = montaMensagem(modelo, { ...dados, podeAfirmarMinimo: true });
const semLastro = montaMensagem(modelo, { ...dados, podeAfirmarMinimo: false });

/**
 * O `toLocaleString` do pt-BR separa "R$" do número com espaço NÃO
 * SEPARÁVEL (U+00A0), e não com espaço comum. É o comportamento certo
 * — impede o valor de quebrar linha longe do símbolo no WhatsApp — mas
 * faz qualquer comparação ingênua falhar. Fica anotado porque a
 * próxima pessoa vai bater nisto de novo.
 */
const semNbsp = (texto) => texto.replace(/\u00a0/g, " ");

confere("preço vira reais formatados", semNbsp(comLastro).includes("R$ 89,90"));
confere("preço de referência também", semNbsp(comLastro).includes("R$ 149,90"));
confere("a loja entra na linha da identificação", comLastro.startsWith("#publi · Mercado Livre"));

confere("com série, usa o lastro que afirma", comLastro.includes("Menor preço em 30 dias."));
confere(
  "sem série, usa a redação honesta com a data",
  semLastro.includes("Menor preço que observamos desde 14/06/26."),
);
confere(
  "e sem série NUNCA afirma mínimo histórico",
  !afirmaMinimoSemLastro(semLastro),
);

confere("nenhuma chave sobrou por preencher", !/\{[a-z_]+\}/.test(comLastro));

// A chave desconhecida fica visível de propósito: sumir criaria um
// buraco na mensagem que ninguém percebe até ela ir para o grupo.
confere(
  "chave desconhecida fica visível em vez de sumir",
  montaMensagem({ ...modelo, corpo: "{produto} {inventada}" }, { ...dados, podeAfirmarMinimo: true })
    .includes("{inventada}"),
);

console.log("\nprévia\n");

const dois = previa(modelo, dados);
confere("a prévia devolve os dois estados", Boolean(dois.comLastro && dois.semLastro));
confere("e eles são diferentes", dois.comLastro !== dois.semLastro);
confere(
  "os dois carregam a identificação publicitária",
  temIdentificacaoPublicitaria(dois.comLastro) && temIdentificacaoPublicitaria(dois.semLastro),
);

console.log("\ngatilho da queda\n");

/*
  Oferta de queda tem horas de vida. Escrevê-la como "menor preço que
  observamos" é a mentira que a regra 3.4 existe para impedir — e é a
  que queima o canal. Esta é a regra que não pode regredir.
*/
const modeloTres = {
  corpo: "{produto} · {lastro} · {link}",
  lastroCom: "Menor preço em {janela} dias.",
  lastroSem: "Menor preço que observamos desde {desde}.",
  lastroQueda: "Caiu de {antes} para {agora} hoje.",
  lastroDeclarado: "A loja marcou de {antes} por {agora}.",
  linhaFrete: "🚚 Frete grátis",
};

const daQueda = { ...dados, precoCentavos: 3878, precoAntesCentavos: 4407 };

const textoDaQueda = montaMensagem(modeloTres, {
  ...daQueda,
  podeAfirmarMinimo: false,
  gatilho: "queda",
});

confere("queda usa o lastro da queda", textoDaQueda.includes("Caiu de"));
confere("e cita os dois preços, o de antes e o de agora", textoDaQueda.includes("38,78") && textoDaQueda.includes("44,07"));

confere(
  "queda NUNCA afirma mínimo, nem com podeAfirmarMinimo verdadeiro",
  !montaMensagem(modeloTres, { ...daQueda, podeAfirmarMinimo: true, gatilho: "queda" }).includes(
    "Menor preço",
  ),
);

confere(
  "sem gatilho, continua decidindo pela série",
  montaMensagem(modeloTres, { ...dados, podeAfirmarMinimo: true }).includes("Menor preço em"),
);

console.log("\ntravessão, a regra 3.11\n");

/*
  Travessão em texto de canal tem cara de IA, e canal de oferta vive de
  parecer gente. Está em teste porque é o tipo de coisa que volta sem
  ninguém notar, na primeira vez que alguém reescrever um modelo.
*/
confere("pega o travessão longo", temTravessao("Caiu de R$ 36 — agora R$ 31"));
confere("e o curto", temTravessao("Menor preço – nós acompanhamos"));
confere("hífen comum passa", !temTravessao("anti-dobra, custo-benefício"));
confere("texto limpo passa", !temTravessao("Caiu agora: era R$ 36, foi para R$ 31."));

// =============================================================

console.log("\nas linhas opcionais e o buraco delas\n");

// Com nota e frete vazios, o corpo deixava quatro linhas em branco
// empilhadas no meio da mensagem. O texto estava certo; o espaçamento
// e que sobrava, e nenhum teste via.
const corpoComOpcionais = "#publi · {loja}\n\n{produto}\n\n{nota}\n\n{preco}\n\n{frete}\n\n{link}";
const semOpcionais = montaMensagem(
  { ...modeloTres, corpo: corpoComOpcionais },
  { ...dados, podeAfirmarMinimo: false, notaDoCurador: null, freteGratis: false },
);
confere("sem nota e sem frete, nao sobra linha em branco dupla", !/\n\n\n/.test(semOpcionais));
confere("mas o respiro entre blocos continua", semOpcionais.includes("\n\n"));
confere("e nao comeca nem termina com quebra", semOpcionais === semOpcionais.trim());

const comFrete = montaMensagem(
  { ...modeloTres, corpo: corpoComOpcionais },
  { ...dados, podeAfirmarMinimo: false, notaDoCurador: null, freteGratis: true },
);
confere("com frete gratis, a linha aparece", comFrete.includes("Frete grátis"));
confere("sem frete gratis, ela nao aparece", !semOpcionais.includes("Frete grátis"));
// Nulo e "nao medimos": some igual, porque dizer que o frete e pago
// sobre um anuncio que talvez tenha frete gratis custa a venda a toa.
const freteNulo = montaMensagem(
  { ...modeloTres, corpo: corpoComOpcionais },
  { ...dados, podeAfirmarMinimo: false, notaDoCurador: null, freteGratis: null },
);
confere("frete nulo some igual a falso", !freteNulo.includes("Frete grátis"));


/*
  O POST DE CUPOM.

  O modelo padrão vem da migration 34. Está repetido aqui de propósito:
  se alguém mudar o padrão no banco e quebrar a identificação
  publicitária, é este teste que precisa gritar.
*/
console.log("\npost de cupom\n");

const MODELO_CUPOM =
  "#publi · Cupom {loja}\n\n🎟 <b>{codigo}</b>\n{percentual}% de desconto{onde}\n{condicoes}\n\nVale até {validade}. Ative na aba Cupons do app antes de fechar a compra.";

const cupomCheio = montaMensagemDeCupom(MODELO_CUPOM, {
  codigo: "LOJASOFICIAIS0108",
  loja: "Mercado Livre",
  percentual: 15,
  minimoCentavos: 7900,
  tetoCentavos: 2000,
  onde: "Lojas Oficiais",
  validade: "2026-08-01",
});

confere("identifica publicidade", temIdentificacaoPublicitaria(cupomCheio));
confere("e a identificação não está escondida", !identificacaoEstaEscondida(cupomCheio));
confere("não tem travessão (regra 3.11)", !temTravessao(cupomCheio));
confere("não afirma mínimo histórico", !afirmaMinimoSemLastro(cupomCheio));
confere("traz o código", cupomCheio.includes("LOJASOFICIAIS0108"));
confere("traz o percentual", cupomCheio.includes("15% de desconto"));
confere("diz onde vale", cupomCheio.includes("em Lojas Oficiais"));
confere("diz a compra mínima", /R\$\s*79,00/.test(cupomCheio));
confere("diz o teto", /at[ée] R\$\s*20,00/.test(cupomCheio));
confere("diz a validade", cupomCheio.includes("01/08/26"));

/*
  O QUE NÃO FOI DECLARADO VIRA SILÊNCIO, não uma promessa melhor.

  Cupom lido de canal alheio não traz todas as condições. Preencher a
  lacuna com "sem mínimo" ou "sem limite" seria inventar uma condição
  mais generosa do que a que foi lida, e o leitor descobre no carrinho.
*/
const cupomSeco = montaMensagemDeCupom(MODELO_CUPOM, {
  codigo: "FULL3108",
  loja: "Mercado Livre",
  percentual: 25,
  minimoCentavos: 0,
  tetoCentavos: null,
  onde: null,
  validade: "2026-08-01",
});

confere("sem mínimo não promete 'sem mínimo'", !/m[íi]nim/i.test(cupomSeco));
confere("sem teto não promete 'sem limite'", !/limite|至|sem teto/i.test(cupomSeco));
confere("sem categoria não deixa 'em ' solto", !cupomSeco.includes("desconto em\n"));
confere("continua identificando publicidade", temIdentificacaoPublicitaria(cupomSeco));
confere(
  "e não sobra buraco de linha em branco",
  !cupomSeco.includes("\n\n\n"),
);

// =============================================================
// Escape de HTML — a mensagem sai com `parse_mode: "HTML"`
//
// A API do Telegram exige que `<`, `>` e `&` que não sejam tag ou
// entidade virem `&lt;`, `&gt;` e `&amp;`. Duas entradas quebram essa
// regra sozinhas e nenhuma delas é rara:
//
//   1. título de marketplace com "&" ("Shampoo & Condicionador")
//   2. o link da Shopee e o da Amazon, que desde a migration 49 vão
//      dentro de href="..." e separam parâmetros com "&"
//
// O que NÃO pode acontecer é o oposto: escapar o corpo do modelo, que
// tem HTML de propósito. Os dois lados estão testados aqui.
// =============================================================

console.log("\nescape de HTML para o Telegram\n");

// O corpo real depois da migration 49, com a âncora que o dono edita.
const MODELO_HTML = {
  corpo: [
    "#publi · {loja}",
    "",
    "🔥 <b>{produto}</b>",
    "",
    "De <s>{preco_antes}</s> por {preco} (−{desconto}%)",
    "{lastro}",
    "",
    "{vendedor}",
    "{nota}",
    "",
    '🛒 <a href="{link}">Compre aqui</a>',
  ].join("\n"),
  lastroCom: "Menor preço em {janela} dias.",
  lastroSem: "Menor preço que observamos desde {desde}.",
  lastroQueda: "⚡ Caiu nas últimas horas: vimos o preço mudar.",
  lastroDeclarado: "",
  notaPrefixo: "💬",
};

const LINK_SHOPEE =
  "https://s.shopee.com.br/an_redir?origin_link=https%3A%2F%2Fshopee.com.br%2Fp%2F1" +
  "&affiliate_id=18378371108&sub_id=a1b2c3d4----";

const comEntradaSuja = montaMensagem(MODELO_HTML, {
  produto: "Kit Shampoo & Condicionador Cães <Filhotes> 2x500ml",
  precoCentavos: 3990,
  precoAntesCentavos: 7990,
  descontoPct: 50,
  loja: "Shopee",
  vendedor: "Casa & Cia",
  janelaDias: 30,
  observadoDesde: "2026-07-20",
  podeAfirmarMinimo: false,
  gatilho: "declarado",
  notaDoCurador: "rende 2x mais que o <comum>",
  link: LINK_SHOPEE,
});

/*
  A conferência é feita sobre o texto SEM as tags que o modelo pôs.
  Procurar "<" no texto inteiro acusaria o próprio `<b>`, que é legítimo
  e tem que continuar lá.
*/
const semTagsDoModelo = comEntradaSuja.replace(
  /<\/?(a|b|i|u|s|code|pre|blockquote)\b[^>]*>/g,
  "",
);

confere(
  "o `&` do título vira entidade",
  comEntradaSuja.includes("Shampoo &amp; Condicionador"),
);
confere(
  "o `<` do título vira entidade",
  comEntradaSuja.includes("&lt;Filhotes&gt;"),
);
confere("o `&` do vendedor vira entidade", comEntradaSuja.includes("Casa &amp; Cia"));
confere("o `<` da nota do curador vira entidade", comEntradaSuja.includes("&lt;comum&gt;"));
confere(
  "não sobra `<` cru fora das tags do modelo",
  !/</.test(semTagsDoModelo),
);
/*
  O LINK É ESCAPADO, e o que este teste protege é o inverso do óbvio:
  que ele continue ÍNTEGRO depois de escapado.

  O `&` separa os parâmetros do link da Shopee e do da Amazon, e é ele
  que carrega `affiliate_id` e `sub_id`. Se o escape corrompesse a URL,
  o post sairia bonito e não pagaria nada.

  Medido com o bot de verdade em 04/08: mandei as duas formas para um
  canal e li o campo `url` da entidade `text_link` que a API devolve. As
  duas chegaram idênticas à original — o Telegram decodifica `&amp;`
  dentro do atributo. Por isso dá para escapar sem risco.
*/
const href = comEntradaSuja.match(/href="([^"]*)"/)?.[1] ?? "";
confere("o href existe", href.length > 0);
confere("o `&` do link virou entidade", href.includes("&amp;affiliate_id="));
confere(
  "e a URL continua íntegra ao ser decodificada",
  href.replace(/&amp;/g, "&") === LINK_SHOPEE,
);
confere("nenhum `&` solto sobrou no href", !/&(?!(amp|lt|gt|quot);)/.test(href));

// O outro lado da regra: o modelo é do dono e o HTML dele fica.
confere("a tag <b> do modelo sobrevive", comEntradaSuja.includes("<b>"));
confere("a tag <s> do modelo sobrevive", comEntradaSuja.includes("<s>"));
confere(
  "a âncora do modelo sobrevive inteira",
  /<a href="[^"]+">Compre aqui<\/a>/.test(comEntradaSuja),
);

// Mercado Livre é o caminho que roda hoje, e não pode mudar de forma.
const comLinkDoML = montaMensagem(MODELO_HTML, {
  produto: "Tapete Higiênico 80x60",
  precoCentavos: 8990,
  precoAntesCentavos: 14990,
  descontoPct: 40,
  loja: "Mercado Livre",
  vendedor: "PetShop Oficial",
  janelaDias: 30,
  observadoDesde: "2026-06-14",
  podeAfirmarMinimo: true,
  link: "https://meli.la/1QPWrnS",
});

confere(
  "link do ML atravessa sem mudar (não tem `&` para escapar)",
  comLinkDoML.includes('href="https://meli.la/1QPWrnS"'),
);

// E o post de cupom, que lê texto de canal alheio.
const cupomSujo = montaMensagemDeCupom(MODELO_CUPOM, {
  codigo: "FULL<31>08",
  loja: "Casa & Cia",
  percentual: 25,
  minimoCentavos: 5000,
  tetoCentavos: 2000,
  onde: "Casa & Construção",
  validade: "2026-08-01",
});

confere("cupom: código escapado", cupomSujo.includes("FULL&lt;31&gt;08"));
confere("cupom: loja escapada", cupomSujo.includes("Casa &amp; Cia"));
confere(
  "cupom: nenhum `&` solto",
  !/&(?!(amp|lt|gt|quot);)/.test(cupomSujo),
);

// =============================================================
// O VENDEDOR DESCRITO, e nao so nomeado (migration 64)
//
// O formato saiu de post real de concorrente, lido em 04/08:
//   Loja: BAGATELLE (+10.000 vendas, mercadolider)
// =============================================================

confere(
  "so o nome, quando nao ha mais nada",
  descreveVendedor({ vendedor: "BAGATELLE" }) === "BAGATELLE",
);
confere(
  "nome com vendas",
  descreveVendedor({ vendedor: "BAGATELLE", vendasDoVendedor: 10400 }) ===
    "BAGATELLE (+10.000 vendas)",
);
confere(
  "nome com vendas e selo",
  descreveVendedor({ vendedor: "BAGATELLE", vendasDoVendedor: 10400, seloDoVendedor: "platinum" }) ===
    "BAGATELLE (+10.000 vendas, MercadoLíder Platinum)",
);
confere(
  "loja oficial substitui o nome",
  descreveVendedor({ vendedor: "QUEROZ", lojaOficial: true, vendasDoVendedor: 1200 }) ===
    "Loja oficial (+1.000 vendas)",
);

// O ARREDONDAMENTO NUNCA SOBE. Numero verificavel arredondado para cima
// e mentira pequena, e mentira pequena custa mais que numero feio.
confere("9.900 vira +5.000, e nao +10.000", descreveVendedor({ vendedor: "X", vendasDoVendedor: 9900 }) === "X (+5.000 vendas)");
confere("10.000 cravado vira +10.000", descreveVendedor({ vendedor: "X", vendasDoVendedor: 10000 }) === "X (+10.000 vendas)");
confere("120.000 vira +100.000", descreveVendedor({ vendedor: "X", vendasDoVendedor: 120000 }) === "X (+100.000 vendas)");
confere("101 vira +100", descreveVendedor({ vendedor: "X", vendasDoVendedor: 101 }) === "X (+100 vendas)");

// Vendedor com pouca venda nao ganha linha: "+12 vendas" nao ajuda
// ninguem, e chama atencao para o que a comporta ja deixou passar.
confere("99 vendas nao viram linha", descreveVendedor({ vendedor: "X", vendasDoVendedor: 99 }) === "X");
confere("zero venda nao vira linha", descreveVendedor({ vendedor: "X", vendasDoVendedor: 0 }) === "X");
confere("venda nula nao vira linha", descreveVendedor({ vendedor: "X", vendasDoVendedor: null }) === "X");

confere("silver e MercadoLider sem sobrenome", descreveVendedor({ vendedor: "X", seloDoVendedor: "silver" }) === "X (MercadoLíder)");
confere("selo desconhecido e ignorado", descreveVendedor({ vendedor: "X", seloDoVendedor: "bronze" }) === "X");
confere("sem nome e sem nada devolve vazio", descreveVendedor({ vendedor: "" }) === "");
confere(
  "sem nome mas com vendas, o que sobra vale",
  descreveVendedor({ vendedor: "", vendasDoVendedor: 5200 }) === "+5.000 vendas",
);
confere(
  "o nome do vendedor vai escapado",
  descreveVendedor({ vendedor: "Cabo <2m> & Cia" }) === "Cabo &lt;2m&gt; &amp; Cia",
);

// =============================================================
// O CUPOM COLADO NO POST DA OFERTA (migration 64)
// =============================================================

{
  const modeloComCupom = { ...modelo, corpo: "{produto}\n\n{cupom}\n\n{link}", linhaCupom: "🎟 Cupom: <b>{codigo}</b>" };
  const com = montaMensagem(modeloComCupom, { ...dados, podeAfirmarMinimo: false, cupom: { codigo: "AMODESCONTO" } });
  confere("o codigo do cupom entra na mensagem", com.includes("🎟 Cupom: <b>AMODESCONTO</b>"));

  const sem = montaMensagem(modeloComCupom, { ...dados, podeAfirmarMinimo: false, cupom: null });
  confere("sem cupom, a linha some inteira", !sem.includes("Cupom"));
  confere("  e nao deixa buraco", !/\n{3,}/.test(sem));

  const bravo = montaMensagem(modeloComCupom, { ...dados, podeAfirmarMinimo: false, cupom: { codigo: "A<b>X" } });
  confere("o codigo vai escapado", bravo.includes("A&lt;b&gt;X"));
}

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
