/**
 * Teste da intercalação por variedade.
 *
 * Roda com `pnpm testa`. Função pura, sem banco e sem rede.
 *
 * Por que este arquivo existe: falta de variedade é uma das cinco
 * causas de morte de um grupo de ofertas, e o nosso desenho piora isso
 * sem querer — a fila é ordenada por nota, e ofertas parecidas pontuam
 * parecido. Quebrar esta função não dá erro em lugar nenhum: só faz o
 * grupo receber oito variações da mesma coisa em sequência.
 *
 * O que a função NÃO pode fazer também é testado, e importa tanto
 * quanto: ela reordena, nunca descarta.
 */

import { intercalaPorVariedade, repeticoesSeguidas } from "../lib/variedade.ts";

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

const item = (id, grupo, precoCentavos) => ({ id, grupo, precoCentavos });

console.log("\nintercalação\n");

// O caso que motivou a função: quatro de pet seguidos, na mesma faixa.
const monotona = [
  item("a", "pet", 3000),
  item("b", "pet", 3500),
  item("c", "pet", 4000),
  item("d", "eletronico", 3200),
  item("e", "casa", 3400),
];
const variada = intercalaPorVariedade(monotona);

confere("não perde nenhum item", variada.length === monotona.length);
confere(
  "não inventa item",
  variada.every((x) => monotona.some((y) => y.id === x.id)),
);
confere(
  "nenhum item aparece duas vezes",
  new Set(variada.map((x) => x.id)).size === variada.length,
);
confere(
  "reduz a repetição em sequência",
  repeticoesSeguidas(variada) < repeticoesSeguidas(monotona),
);

console.log("\npreserva a ordem por nota dentro do mesmo tipo\n");

// a, b, c chegaram nesta ordem (melhor nota primeiro). A intercalação
// pode afastá-los, mas não pode inverter a ordem entre eles.
const posicao = (id) => variada.findIndex((x) => x.id === id);
confere("a melhor de pet continua saindo antes da segunda", posicao("a") < posicao("b"));
confere("e a segunda antes da terceira", posicao("b") < posicao("c"));

console.log("\nfaixa de preço também conta\n");

// Mesmo nicho, faixas diferentes: não são "parecidas".
const faixasDiferentes = [
  item("barato1", "pet", 2000),
  item("caro1", "pet", 80000),
  item("barato2", "pet", 2500),
];
confere(
  "preços muito diferentes não contam como repetição",
  repeticoesSeguidas(faixasDiferentes) === 0,
);

// Nichos diferentes, mesma faixa: contam como parecidas, porque
// competem pelo mesmo bolso no mesmo momento.
confere(
  "nichos diferentes na mesma faixa contam como parecidos",
  repeticoesSeguidas([item("x", "pet", 3000), item("y", "pet", 3200)]) === 1,
);

console.log("\ncasos de borda\n");

confere("lista vazia não quebra", intercalaPorVariedade([]).length === 0);
confere("um item só volta igual", intercalaPorVariedade([item("a", "pet", 100)]).length === 1);
confere(
  "dois itens voltam na ordem original",
  intercalaPorVariedade([item("a", "pet", 100), item("b", "pet", 200)])
    .map((x) => x.id)
    .join() === "a,b",
);

// Tudo igual: não há o que intercalar, e forçar seria mentir sobre o
// que existe. Preserva a ordem e conta a repetição para a tela avisar.
const tudoIgual = [
  item("a", "pet", 3000),
  item("b", "pet", 3100),
  item("c", "pet", 3200),
];
confere(
  "fila toda do mesmo tipo mantém a ordem",
  intercalaPorVariedade(tudoIgual).map((x) => x.id).join() === "a,b,c",
);
confere("e a repetição é reportada para a tela avisar", repeticoesSeguidas(tudoIgual) === 2);

confere(
  "nicho nulo não quebra",
  intercalaPorVariedade([item("a", null, 100), item("b", "pet", 100)]).length === 2,
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
