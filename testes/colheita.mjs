/**
 * Teste da leitura paginada de canal público.
 *
 * Existe porque errar aqui não dá erro visível: a colheita continua
 * respondendo "ok", só que lendo uma página em vez de oito, ou o
 * contrário, pedindo a mesma página até o teto e gastando requisição
 * contra o Telegram para nada. Nos dois casos o resumo da execução
 * parece saudável.
 *
 * A rede é dublada: o que está sob teste é a decisão de quando parar
 * de voltar, não o HTML do Telegram.
 */
import { extraiCupons, leCanalPublico } from "../supabase/functions/_compartilhado/telegram-web.ts";

let passou = 0;
let falhou = 0;
const confere = (n, ok) => {
  if (ok) {
    passou++;
    console.log(`✓ ${n}`);
  } else {
    falhou++;
    console.log(`✗ ${n}`);
  }
};

/** Uma página de HTML no formato mínimo que `extraiPosts` reconhece. */
function pagina(ids) {
  return ids
    .map(
      (id) =>
        `<div data-post="canal/${id}"><time datetime="2026-07-30T10:00:00+00:00"></time>` +
        `<div class="tgme_widget_message_text">post ${id}</div></div>`,
    )
    .join("");
}

/**
 * Um canal falso com `total` posts, servindo 20 por página, do mais
 * novo para o mais antigo, como o Telegram faz.
 */
function dublaTelegram(total, aoPedir) {
  const pedidos = [];
  globalThis.fetch = async (endereco) => {
    pedidos.push(String(endereco));
    aoPedir?.(String(endereco));

    const antes = Number(new URL(String(endereco)).searchParams.get("before")) || total + 1;
    const ids = [];
    for (let id = antes - 1; id > 0 && ids.length < 20; id--) ids.push(id);

    return { ok: true, text: async () => pagina(ids) };
  };
  return pedidos;
}

const fetchOriginal = globalThis.fetch;

console.log("\nquantas páginas ela volta\n");

let pedidos = dublaTelegram(500);
let posts = await leCanalPublico("canal", { paginas: 1 });
confere("uma página traz 20 posts", posts.length === 20);
confere("e faz uma requisição só", pedidos.length === 1);

pedidos = dublaTelegram(500);
posts = await leCanalPublico("canal", { paginas: 6 });
confere("seis páginas trazem 120", posts.length === 120);
confere("e fazem seis requisições", pedidos.length === 6);
confere(
  "a segunda requisição usa ?before=",
  pedidos[1].includes("before=481"),
);

console.log("\nquando ela para sozinha\n");

pedidos = dublaTelegram(500);
posts = await leCanalPublico("canal", { paginas: 10, ateOPost: 470 });
confere("para ao alcançar o que já conhecemos", pedidos.length === 2);
confere("e não passa muito do alvo", Math.min(...posts.map((p) => p.id)) <= 470);

// O canal curto é a armadilha: sem a guarda, ele devolveria a mesma
// página até o teto e cada passada gastaria dez requisições por nada.
pedidos = dublaTelegram(25);
posts = await leCanalPublico("canal", { paginas: 10 });
confere("canal curto não gasta o teto de páginas", pedidos.length <= 3);
confere("e traz os 25 posts que existem", posts.length === 25);

console.log("\nescavando a partir de uma borda\n");

pedidos = dublaTelegram(500);
posts = await leCanalPublico("canal", { paginas: 3, antesDe: 100 });
confere("começa abaixo da borda, não do topo", Math.max(...posts.map((p) => p.id)) < 100);
confere("desce três páginas", posts.length === 60);
confere("a primeira requisição já leva o before", pedidos[0].includes("before=100"));

console.log("\no que ela devolve\n");

pedidos = dublaTelegram(500);
posts = await leCanalPublico("canal", { paginas: 3 });
const ids = posts.map((p) => p.id);
confere("vem ordenado do mais antigo para o mais novo", ids.every((v, i) => i === 0 || v > ids[i - 1]));
confere("sem post repetido", new Set(ids).size === ids.length);

console.log("\nquando a rede falha\n");

globalThis.fetch = async () => ({ ok: false, status: 429, text: async () => "" });
let estourou = false;
try {
  await leCanalPublico("canal", { paginas: 3 });
} catch {
  estourou = true;
}
confere("falhar na primeira página é erro, e não silêncio", estourou);

// Falhar no meio é outra coisa: o que já veio vale, e perder a passada
// inteira por causa da quarta página seria pior que ficar com três.
let chamada = 0;
globalThis.fetch = async (endereco) => {
  chamada++;
  if (chamada > 2) return { ok: false, status: 500, text: async () => "" };
  const antes = Number(new URL(String(endereco)).searchParams.get("before")) || 501;
  const ids = [];
  for (let id = antes - 1; id > 0 && ids.length < 20; id--) ids.push(id);
  return { ok: true, text: async () => pagina(ids) };
};
posts = await leCanalPublico("canal", { paginas: 6 });
confere("falhar no meio devolve o que já veio", posts.length === 40);

console.log("\nquando o canal servido não é o pedido\n");

// Das oito fontes cadastradas, duas caíam nisto: t.me/s/promobit
// devolve ofertasdecomputador. A página responde 200 com posts
// perfeitos, então sem esta checagem a colheita lê o mesmo canal duas
// vezes e ninguém percebe.
globalThis.fetch = async () => ({
  ok: true,
  text: async () =>
    `<div data-post="outrocanal/10"><time datetime="2026-07-30T10:00:00+00:00"></time>` +
    `<div class="tgme_widget_message_text">post</div></div>`,
});

let trocou = false;
let mensagem = "";
try {
  await leCanalPublico("canalpedido", { paginas: 1 });
} catch (e) {
  trocou = true;
  mensagem = e.message;
}
confere("canal servido diferente do pedido é erro", trocou);
confere("e o erro diz qual canal veio no lugar", mensagem.includes("outrocanal"));

globalThis.fetch = fetchOriginal;

/*
  EXTRAÇÃO DE CUPOM.

  Os textos abaixo são reproduções do que a pesquisa de 01/08 leu ao
  vivo em `t.me/s/sddescontos`, `t.me/s/canaldeofertasecupons` e
  `t.me/s/shopeepromocoesecuponsbr`. O que está sob teste é a âncora de
  data: ela é o que separa cupom de qualquer outra palavra em maiúscula
  numa mensagem de canal, que é onde este tipo de extração costuma
  produzir lixo.
*/
console.log("\nextração de cupom\n");

const doCanal = `🔥 CUPOM MERCADO LIVRE 🔥
LOJASOFICIAIS0108
15% OFF em Lojas Oficiais
Compra mínima de R$ 29
Desconto de até R$ 20
Válido só hoje!`;

const achados = extraiCupons(doCanal);
confere("acha o cupom no texto do canal", achados.length === 1);
confere("lê o código inteiro", achados[0]?.codigo === "LOJASOFICIAIS0108");
confere("lê o percentual", achados[0]?.percentual === 15);
confere("lê a compra mínima em centavos", achados[0]?.minimoCentavos === 2900);
confere("lê o teto do desconto", achados[0]?.tetoCentavos === 2000);
confere("lê o dia e o mês do próprio código", achados[0]?.dia === 1 && achados[0]?.mes === 8);

const varios = extraiCupons(
  `FULL3107 - 25% OFF, até R$ 30\nDECORELETRO3107 - 30% OFF, até R$ 20\nLIVROSJOGOS3107 - 20% OFF, até R$ 30`,
);
confere("acha os três da mesma mensagem", varios.length === 3);
confere(
  "e não confunde os valores entre eles",
  varios.find((c) => c.codigo === "DECORELETRO3107")?.percentual === 30 &&
    varios.find((c) => c.codigo === "FULL3107")?.percentual === 25,
);
confere("31/07 é lido como dia 31, mês 7", varios[0]?.dia === 31 && varios[0]?.mes === 7);

// O que NÃO pode virar cupom. Cada linha destas apareceria numa
// mensagem de canal comum, e sem a âncora de data viraria lixo no banco.
confere("PROMOÇÃO não é cupom", extraiCupons("PROMOÇÃO imperdível 50% OFF").length === 0);
confere("FRETE GRATIS não é cupom", extraiCupons("FRETE GRATIS 10% a mais").length === 0);
/*
  ESTE CASO MUDOU DE RESPOSTA EM 04/08, e a mudança é deliberada.

  Ele afirmava que código sem data não passa, porque a única âncora era
  o sufixo `DDMM`. Só que a colheita passou a devolver zero cupons por
  dias seguidos: o cupom datado é de campanha do ML e só existe em dia
  de campanha, enquanto o que os concorrentes publicam todo dia
  (`FASHIONML`, `PIPOCA`) não tem data nenhuma.

  Agora o rótulo é a segunda âncora, e "Use o cupom DESCONTAO" é
  exatamente o que ela existe para capturar. O prazo, que era o que a
  data dava de graça, passou a ser o fim do dia em São Paulo.
*/
confere(
  "código sem data passa quando vem depois do rótulo",
  extraiCupons("Use o cupom DESCONTAO e ganhe 20% OFF").length === 1,
);
confere(
  "e sem rótulo continua não passando",
  extraiCupons("Aproveite DESCONTAO e ganhe 20% OFF").length === 0,
);
confere(
  "quatro dígitos que não são data não passam",
  extraiCupons("SAMSUNG9999 com 10% OFF").length === 0,
);
confere(
  "mês 13 não existe",
  extraiCupons("CUPOM0112 15% OFF").length === 1 && extraiCupons("CUPOM3113 15% OFF").length === 0,
);
confere("dia 32 não existe", extraiCupons("CUPOM3208 15% OFF").length === 0);
confere("sem percentual não vira cupom", extraiCupons("LOJASOFICIAIS0108 só hoje").length === 0);
confere(
  "modelo de produto não vira cupom",
  extraiCupons("Notebook DELL I15 3000 por R$ 2.999 com 10% OFF").length === 0,
);

// A Shopee usa leetspeak e fica de fora por contrato. O filtro de data
// já a exclui sozinho, e este caso existe para provar isso.
confere(
  "código da Shopee não é capturado",
  extraiCupons("Cupom D1AD0SP41S 20% OFF na Shopee").length === 0 &&
    extraiCupons("Cupom 3XCLU51V020 15% OFF").length === 0,
);

confere("texto sem cupom nenhum devolve lista vazia", extraiCupons("só uma oferta boa").length === 0);

/*
  O TEXTO LITERAL DE UM CANAL, copiado de `t.me/s/canaldeofertasecupons`
  em 01/08/2026. Está aqui porque a primeira versão do extrator passava
  nos casos inventados acima e devolvia teto nulo neste: o canal escreve
  "(Limite de R$ 20)", e o regex só cobria "limitado a". Caso inventado
  não pega esse tipo de erro.
*/
const real = `🚨 CUPONS 😱 | #MERCADOLIVRE:

🛒 ATIVE RÁPIDO AQUI:
🔗 https://mercadolivre.com/sec/1BVEbve

🎟 CÓDIGO: LOJASOFICIAIS0108
👉 15% OFF (Limite de R$ 20) em ✦ Lojas Oficiais

🎟 CÓDIGO: MODAEBELEZA0108
👉 20% OFF (Limite de R$ 30) em ✦ Moda e Bem-Estar

⚠️ CORRE QUE É LIMITADO! Cupom com poucas unidades`;

const doReal = extraiCupons(real);
confere("no texto real acha os dois cupons", doReal.length === 2);
confere(
  "e separa os percentuais certos",
  doReal.find((c) => c.codigo === "LOJASOFICIAIS0108")?.percentual === 15 &&
    doReal.find((c) => c.codigo === "MODAEBELEZA0108")?.percentual === 20,
);
confere(
  "lê o teto escrito como 'Limite de R$'",
  doReal.find((c) => c.codigo === "LOJASOFICIAIS0108")?.tetoCentavos === 2000 &&
    doReal.find((c) => c.codigo === "MODAEBELEZA0108")?.tetoCentavos === 3000,
);
confere(
  "sem mínimo declarado o mínimo é zero, não um chute",
  doReal.every((c) => c.minimoCentavos === 0),
);
confere("e o link do canal não vira cupom", !doReal.some((c) => c.codigo.includes("1BVEbve")));


/*
  OS TRES JEITOS QUE OS CANAIS ESCREVEM, todos copiados ao vivo em
  01/08. Existem juntos porque qualquer regra de direcao fixa acerta um
  e erra outro, e o erro publica desconto que nao existe.
*/
console.log("\nos tres formatos de canal\n");

// @promotop: valores ANTES do codigo, dois cupons na mesma mensagem.
// Foi este que pegou o defeito: o MODAEBELEZA recebia os 15% do
// LOJASOFICIAIS, porque eles ficam logo depois do codigo dele.
const promotop = extraiCupons(`🔥 Novos Cupons Mercado Livre!

▪️ 20% OFF em compras acima de R$49, Limitado a R$30
🎯 Usem o cupom: MODAEBELEZA0108

▪️ 15% OFF em compras acima de R$29, Limitado a R$20
🎯 Usem o cupom: LOJASOFICIAIS0108

🛒 https://mercadolivre.com/sec/2P5pupn`);

const moda = promotop.find((c) => c.codigo === "MODAEBELEZA0108");
const lojas = promotop.find((c) => c.codigo === "LOJASOFICIAIS0108");
confere("valores antes do codigo: acha os dois", promotop.length === 2);
confere("e NAO troca o percentual entre eles", moda?.percentual === 20 && lojas?.percentual === 15);
confere("nem o minimo", moda?.minimoCentavos === 4900 && lojas?.minimoCentavos === 2900);
confere("nem o teto", moda?.tetoCentavos === 3000 && lojas?.tetoCentavos === 2000);

// @CupomDoGnu: valores antes, com linha em branco separando do codigo.
const gnu = extraiCupons(`MERCADO LIVRE com cupom ativo para compras!

📉 15% OFF
🛒 Nas compras acima de R$ 79
⚠️ Desconto limitado a R$ 20

🎟 Cupom: LOJASOFICIAIS0108
👉 Acesse o link para ir para a loja:
🔗 CupomDoGnu.com.br/c/rj0oVrrIav`);

confere("linha em branco entre valores e codigo: acha", gnu.length === 1);
confere("  percentual", gnu[0]?.percentual === 15);
confere("  minimo tres linhas acima", gnu[0]?.minimoCentavos === 7900);
confere("  teto", gnu[0]?.tetoCentavos === 2000);
confere("  e o link do canal nao vira cupom", !gnu.some((c) => /rj0oVrr/i.test(c.codigo)));

// =============================================================
// CUPOM SEM DATA NO CODIGO, achado pelo rotulo
//
// Medido em 04/08: os quinze canais devolveram ZERO cupons, porque o
// caminho antigo so enxerga o cupom de campanha do ML, que traz DDMM.
// O que o Esser Moda publica todo dia nao tem data nenhuma.
// =============================================================

// Literal do canal @ModaEsser, lido em 04/08.
const esser = extraiCupons(`LACOSTE Camisa Polo Original

De R$ 499,00 por R$ 249,90 (50% OFF)

CUPOM: FASHIONML`);

confere("cupom sem data e achado pelo rotulo", esser.length === 1);
confere("  com o codigo certo", esser[0]?.codigo === "FASHIONML");
confere("  sem dia e sem mes", esser[0]?.dia === null && esser[0]?.mes === null);
confere("  marcado como achado por rotulo", esser[0]?.origem === "rotulo");
confere("  e com o percentual da linha de cima", esser[0]?.percentual === 50);

// O caminho antigo continua sendo o preferido, e diz de onde veio.
confere("cupom com data continua marcado como `data`", gnu[0]?.origem === "data");
confere("  e continua trazendo dia e mes", gnu[0]?.dia === 1 && gnu[0]?.mes === 8);

// -------------------------------------------------------------
// O que NAO pode virar cupom
// -------------------------------------------------------------

confere(
  "palavra em caixa alta sem rotulo nao vira cupom",
  extraiCupons(`OFERTA IMPERDIVEL AGORA
30% OFF no LIQUIDIFICADOR PHILCO`).length === 0,
);

confere(
  "vocabulario de oferta nao vira cupom nem com rotulo",
  extraiCupons(`Cupom: DESCONTO
15% OFF`).length === 0,
);

confere(
  "rotulo em outra linha nao conta",
  extraiCupons(`Use o cupom:
FASHIONML
20% OFF`).length === 0,
);

confere(
  "sem percentual por perto nao vira cupom",
  extraiCupons(`Camisa Polo Lacoste
CUPOM: FASHIONML
Frete gratis`).length === 0,
);

confere(
  "codigo curto demais nao vira cupom",
  extraiCupons(`Cupom: ABC
15% OFF`).length === 0,
);

confere(
  "codigo com menos de tres letras nao vira cupom",
  extraiCupons(`Cupom: A1234567
15% OFF`).length === 0,
);

// -------------------------------------------------------------
// Os dois caminhos na mesma mensagem
// -------------------------------------------------------------

const misto = extraiCupons(`Cupons de hoje

20% OFF acima de R$ 99
Cupom: PIPOCA

15% OFF acima de R$ 79
CODIGO: LOJASOFICIAIS0408`);

confere("os dois caminhos convivem", misto.length === 2);
{
  const pipoca = misto.find((c) => c.codigo === "PIPOCA");
  const lojas = misto.find((c) => c.codigo === "LOJASOFICIAIS0408");
  confere("  o sem data pega o percentual do bloco dele", pipoca?.percentual === 20);
  confere("  e o com data pega o dele", lojas?.percentual === 15);
  confere("  sem trocar o minimo entre os dois", pipoca?.minimoCentavos === 9900 && lojas?.minimoCentavos === 7900);
  confere("  e o com data mantem o prazo", lojas?.dia === 4 && lojas?.mes === 8);
}

confere(
  "o mesmo codigo nao entra duas vezes pelos dois caminhos",
  extraiCupons(`15% OFF
Cupom: LOJASOFICIAIS0408`).length === 1,
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
