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
  temTravessao,
  identificacaoEstaEscondida,
  montaMensagem,
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

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
