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

console.log("\no eixo manda, e a faixa de preço é preferência\n");

/*
  ESTE BLOCO MUDOU DE CONTRATO EM 13/08, e o caso que o obrigou está no
  comentário de `intercalaPorVariedade`. Ele afirmava que "mesmo eixo,
  faixas de preço diferentes" NÃO conta como repetição — e isso era
  verdade enquanto o eixo era o nicho, que já variava sozinho.

  Quando o eixo virou a família de beleza, essa mesma afirmação
  produziu **19 skincare nos 40 primeiros posts** da simulação do Radar
  Delas: sérum de R$ 40 e sérum de R$ 250 eram "diferentes", então nada
  os impedia de sair colados. Trocava a monocultura de secador por uma
  de sérum.

  O contrato agora: quem não pode repetir é o EIXO. A faixa de preço
  continua servindo, mas como desempate na escolha, e não como licença
  para repetir a família.
*/
const mesmoEixoFaixasDiferentes = [
  item("barato1", "pet", 2000),
  item("caro1", "pet", 80000),
  item("barato2", "pet", 2500),
];
confere(
  "mesmo eixo em faixas diferentes AINDA é repetição",
  repeticoesSeguidas(mesmoEixoFaixasDiferentes) === 2,
);

confere(
  "mesmo eixo e mesma faixa também é repetição",
  repeticoesSeguidas([item("x", "pet", 3000), item("y", "pet", 3200)]) === 1,
);

confere(
  "eixos diferentes nunca são repetição, mesmo na mesma faixa",
  repeticoesSeguidas([item("x", "pet", 3000), item("y", "casa", 3200)]) === 0,
);

// Havendo escolha, a faixa de preço decide entre dois eixos diferentes:
// depois de um item de R$ 30, sai o de R$ 800 antes do outro de R$ 35.
const comEscolha = intercalaPorVariedade([
  item("primeiro", "pet", 3000),
  item("mesma-faixa", "casa", 3500),
  item("outra-faixa", "eletronico", 80000),
]);
confere(
  "entre dois eixos novos, prefere o de outra faixa de preço",
  comEscolha[1].id === "outra-faixa",
);

// E a família não se repete quando há material para alternar: é o caso
// do Radar Delas, com skincare em três faixas e uma maquiagem no meio.
const belezaFaixas = intercalaPorVariedade([
  item("serum-caro", "beleza|skincare", 25000),
  item("serum-barato", "beleza|skincare", 4000),
  item("protetor", "beleza|skincare", 8000),
  item("gloss", "beleza|maquiagem", 3300),
]);
confere(
  "skincare em três faixas não sai tudo colado quando há um gloss",
  belezaFaixas[1].grupo === "beleza|maquiagem",
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
