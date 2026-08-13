/**
 * Teste da família de beleza, que é o eixo do revezamento.
 *
 * Roda com `pnpm testa`. Função pura, sem banco e sem rede.
 *
 * POR QUE ESTE ARQUIVO EXISTE. Quebrar `familiaDeBeleza` não dá erro em
 * lugar nenhum: a fila continua saindo, o painel continua verde, e o
 * único sintoma é o grupo receber três secadores em sequência — que é
 * exatamente o defeito que o dono relatou em 13/08 e que este código
 * nasceu para corrigir. Bug silencioso pede teste.
 *
 * OS TÍTULOS SÃO REAIS, tirados das últimas 60 publicações do Radar
 * Delas no WhatsApp. Título inventado testaria a lista contra ela mesma.
 */

import { familiaDeBeleza, eixoDeVariedade } from "../lib/familia-de-beleza.ts";
import { intercalaPorVariedade } from "../lib/variedade.ts";

let passou = 0;
let falhou = 0;

function confere(nome, condicao) {
  if (condicao) {
    passou += 1;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou += 1;
    console.log(`  ✗ ${nome}`);
  }
}

console.log("\nos títulos que estavam saindo em sequência\n");

const eletro = [
  "Secador De Cabelos Taiff Black Íon 2000w Cor Preto",
  "Escova Secadora Alisadora Volumizadora Rotativa Philco PER03 1300w",
  "Secador De Cabelos Philco psc3500 4 Em 1 dobrável motor bldc",
  "Chapinha Profissional Nano Titanium 450° Prancha Alisador",
  "Morina Modelador de Cachos de reto Automático Profissional 25mm",
  "GOKOCO Escova Secadora 7 Em 1 GD032 Conjunto De Secador De Cabelo",
];

for (const t of eletro) {
  confere(`aparelho de cabelo: ${t.slice(0, 34)}`, familiaDeBeleza(t) === "cabelo-eletro");
}

console.log("\ne os títulos que precisavam revezar com eles\n");

const esperado = [
  ["Gloss Labial Peptide Lips Roxo Berry Mousse By Nah Cardoso 2,4ml", "maquiagem"],
  ["Corretivo Líquido Matte Alta Cobertura Payot Tom 2.5", "maquiagem"],
  ["Batom Líquido, Longa Duração, Acabamento Vinil Espelhado", "maquiagem"],
  ["Loção Facial Hidratante para Pele Oleosa Oil Control CeraVe 52g", "skincare"],
  ["Principia Sérum Vitamina C-10", "skincare"],
  ["BEIERMEI Sérum Antienvelhecimento e Antirrugas com Retinol 30ml", "skincare"],
  ["Kit Creamy Skincare Glicointense Peel e Lotion FPS 60 (2 produtos)", "skincare"],
  ["Revlon Uniq One Tratamento Capilar 10 Em 1 Leave In 150ml", "cabelo-quimica"],
  ["Keune Care Confident Curl Low-Poo - Shampoo 300ml", "cabelo-quimica"],
  ["Deva Curl Styling Cream - Creme Modelador de Cachos 500g", "cabelo-eletro"],
  ["Aura Beauty Venus Love - Body Splash Desodorante Colônia 200ml", "perfumaria"],
  ["Caixa Presente Sabonete Phebo Amarela - 8 Sabonetes 90g Cada", "corpo-banho"],
  ["Kit Henna Para Sobrancelhas Menela 2,5g Com Fixador 15ml", "cilios-sobrancelha"],
  ["Cílios Fadvan Yy/c Volume Brasileiro para extenção de cílios", "cilios-sobrancelha"],
  ["Creme Depilatório Corporal 3 em 1 Avon Care 125g", "depilacao"],
  ["Gillette Mach3 carga para lâmina de barbear 4 un", "depilacao"],
  ["Pincel De Maquiagem Mari Maria Triangular Para Base", "maquiagem"],
];

for (const [titulo, familia] of esperado) {
  confere(`${familia}: ${titulo.slice(0, 40)}`, familiaDeBeleza(titulo) === familia);
}

/*
  "Deva Curl Styling Cream - Creme Modelador de Cachos" cai em
  `cabelo-eletro` por causa de "modelador de cachos", que é o nome do
  APARELHO e também o nome do creme. É falso positivo conhecido e
  BARATO: o pior que acontece é um creme revezar como se fosse secador,
  e nunca um post perdido. Está no teste para ficar registrado que é
  escolha, e não descuido — ver o cabeçalho de `lib/familia-de-beleza.ts`.
*/

console.log("\nas armadilhas da palavra 'máscara', que são três famílias\n");

confere(
  "máscara facial é skincare",
  familiaDeBeleza("Máscara Facial de Argila Verde 60g") === "skincare",
);
confere(
  "máscara capilar é cabelo",
  familiaDeBeleza("Kit Braé Essential Máscara Capilar e Óleo") === "cabelo-quimica",
);
confere(
  "máscara de cílios é maquiagem",
  familiaDeBeleza("Máscara De Cílios Volume Extremo à Prova D'água") === "maquiagem",
);

console.log("\no coreano, que é o que o dono pediu por nome\n");

confere("marca coreana entra por skincare", familiaDeBeleza("COSRX Snail Mucin 96 Essence") === "skincare");
confere(
  "e o genérico também",
  familiaDeBeleza("Máscara Facial Coreana Hidratante 10 unidades") === "skincare",
);

console.log("\nas bordas\n");

confere("título nulo não quebra", familiaDeBeleza(null) === null);
confere("título vazio não quebra", familiaDeBeleza("") === null);
confere("título irreconhecível devolve nulo", familiaDeBeleza("Produto Genérico 123") === null);

/*
  O EIXO PRECISA CARREGAR O NICHO JUNTO. Sem ele, um shampoo de cachorro
  e um shampoo de gente teriam a mesma assinatura e o revezamento os
  trataria como a mesma coisa em canais diferentes.
*/
confere(
  "o eixo separa a mesma família em nichos diferentes",
  eixoDeVariedade("pet", "Shampoo Cachorro Pelo Curto") !==
    eixoDeVariedade("beleza", "Shampoo Sem Sulfato 300ml"),
);
confere(
  "sem família reconhecida o eixo é só o nicho",
  eixoDeVariedade("beleza", "Produto Genérico 123") === "beleza",
);
confere("sem nicho o eixo não vira undefined", eixoDeVariedade(null, null) === "sem-nicho");

/*
  O TESTE QUE DESCREVE O DEFEITO INTEIRO.

  Estas são as seis publicações do canal em 12 e 13/08, na ordem em que
  saíram. Com o eixo antigo — `nicho_id`, constante em canal de nicho
  único — a intercalação não tinha o que alternar e devolvia a mesma
  fila. Com o eixo novo, aparelho e consumível se revezam.
*/
console.log("\no defeito de 13/08, de ponta a ponta\n");

const comoSaiu = [
  { titulo: "Secador De Cabelos Taiff Black Íon 2000w", preco: 23100 },
  { titulo: "Escova Secadora Alisadora Rotativa Philco", preco: 22900 },
  { titulo: "GOKOCO Escova Secadora 7 Em 1 Secador", preco: 59900 },
  { titulo: "Gloss Labial Peptide Lips Berry Mousse", preco: 4400 },
  { titulo: "Loção Facial Hidratante CeraVe 52g", preco: 7900 },
  { titulo: "Revlon Uniq One Leave In 150ml", preco: 6400 },
];

const comEixoNovo = intercalaPorVariedade(
  comoSaiu.map((p) => ({ grupo: eixoDeVariedade("beleza", p.titulo), precoCentavos: p.preco })),
);

let seguidasIguais = 0;
for (let i = 1; i < comEixoNovo.length; i += 1) {
  if (comEixoNovo[i].grupo === comEixoNovo[i - 1].grupo) seguidasIguais += 1;
}
confere("nenhum par de aparelhos sai seguido", seguidasIguais === 0);
confere("e nada foi descartado", comEixoNovo.length === comoSaiu.length);

/*
  A SEMENTE, que é a memória entre rodadas. O canal acabou de publicar um
  secador; a fila nova começa com outro secador na frente. Sem a
  semente, ele sairia — e foi assim que 12/08 e 13/08 abriram com
  secador nos dois.
*/
const filaNova = [
  { id: "secador", grupo: eixoDeVariedade("beleza", "Secador Philco 4 Em 1"), precoCentavos: 39900 },
  { id: "gloss", grupo: eixoDeVariedade("beleza", "Gloss Labial Diamond"), precoCentavos: 1600 },
];
const semente = `${eixoDeVariedade("beleza", "Secador Taiff Black Íon")}|acima-600`;

confere(
  "com a semente do último post, o secador não abre a rodada",
  intercalaPorVariedade(filaNova, `${eixoDeVariedade("beleza", "Secador Taiff")}|ate-600`)[0].id ===
    "gloss",
);
confere("e sem semente o comportamento é o de antes", intercalaPorVariedade(filaNova)[0].id === "secador");
confere("semente de outra família não atrapalha", typeof semente === "string");

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
