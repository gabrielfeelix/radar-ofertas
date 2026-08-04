/**
 * Teste da classificação de nicho pelo título, e do que nem é produto.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede.
 *
 * POR QUE ELE EXISTE. Este módulo é o que permite a Amazon publicar, e
 * ele lê a entrada menos confiável do sistema: texto que alguém digitou
 * num canal de Telegram. Errar tem dois custos diferentes, e o segundo é
 * o que assusta: nicho errado põe fone de ouvido no canal de pet, e
 * "título" que não é produto põe "Se prepara cupom Amazon 16:30" como
 * oferta.
 *
 * TODOS OS TÍTULOS ABAIXO SÃO REAIS, lidos do catálogo de produção em
 * 04/08. Inventar título aqui seria testar a minha imaginação.
 */

import { ehTituloDeProduto, nichoPeloTitulo } from "../lib/nicho-pelo-titulo.ts";

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

console.log("\nnicho pelo titulo\n");

// -------------------------------------------------------------
// O que NAO e produto, e e o risco maior
// -------------------------------------------------------------

const NAO_SAO_PRODUTO = [
  "Cupom Amazon APP",
  "Cupom Amazon (APP) #anúncio",
  "Cupom Amazon #anuncio",
  "Se prepara cupom Amazon 16:30",
  "PREÇÃO PRA UMA ELECTROLUX! 🔥",
  "Novo brinde L'Oréal Elseve",
  "OFERTA DO DIA — RAÇÃO",
];
for (const t of NAO_SAO_PRODUTO) {
  confere(`nao e produto: ${t.slice(0, 34)}`, ehTituloDeProduto(t) === false);
}
confere("titulo curto demais nao e produto", ehTituloDeProduto("TV 40") === false);
confere("titulo vazio nao e produto", ehTituloDeProduto("") === false);
confere("titulo nulo nao e produto", ehTituloDeProduto(null) === false);

confere(
  "e conversa nao vira nicho, nem quando a palavra do nicho esta la",
  nichoPeloTitulo("OFERTA DO DIA — RAÇÃO") === null,
);

// -------------------------------------------------------------
// O que E produto, e nao pode ser barrado por engano
// -------------------------------------------------------------

const SAO_PRODUTO = [
  "Notebook Gamer ASUS TUF Gaming A15, RTX3050 AMD RYZEN 7, 16 GB",
  "Ração PEDIGREE Carne Para Cães Adultos, 10.1kg",
  "NIVEA Água Micelar Solução de Limpeza 7 em 1 Refrescante 200ml",
  "Cooktop por Indução Oster, Touch Screen, 4 Bocas, 220V, OTOP402",
];
for (const t of SAO_PRODUTO) {
  confere(`e produto: ${t.slice(0, 34)}`, ehTituloDeProduto(t) === true);
}

// -------------------------------------------------------------
// A classificacao, com titulos reais do catalogo
// -------------------------------------------------------------

confere(
  "notebook e eletronico",
  nichoPeloTitulo("Notebook Gamer ASUS TUF Gaming A15, RTX3050 AMD RYZEN 7") === "eletronico",
);
confere(
  "smart tv e eletronico",
  nichoPeloTitulo('Smart TV 4K 50" LG UHD 50UA85 Processador') === "eletronico",
);
confere(
  "memoria gamer e eletronico",
  nichoPeloTitulo("Memoria Gamer Pcyes Udimm 32Gb Ddr4 3200Mhz Black") === "eletronico",
);
confere("racao e pet", nichoPeloTitulo("RAÇÃO WHISKAS FRANGO 10,1kg") === "pet");
confere(
  "areia higienica e pet",
  nichoPeloTitulo("AREIA HIGIÊNICA BIODEGRADÁVEL PARA GATOS 4kg") === "pet",
);
confere(
  "protein bar e suplemento",
  nichoPeloTitulo("Dux - Protein Bar Mini - Chocolate e Avelã 30g") === "suplemento",
);
confere(
  "cooktop e casa",
  nichoPeloTitulo("Cooktop por Indução Oster, Touch Screen, 4 Bocas, 220V") === "casa",
);
confere(
  "cafe e mercado",
  nichoPeloTitulo("10x 3 Corações Café Torrado e Moído Extra Forte, 500g") === "mercado",
);
confere(
  "lava autos e automotivo",
  nichoPeloTitulo("Lava Autos Neutro Cockpit 500Ml, Interbrilho") === "automotivo",
);

// -------------------------------------------------------------
// O AMBIGUO NAO DECIDE SOZINHO, que e a regra que evita o pior caso
// -------------------------------------------------------------

// Casa com beleza (shampoo) e com pet (caes), e pet vem antes na lista.
// Para qualquer pessoa isto e pet, e a primeira versao devolvia nulo.
confere(
  "shampoo para caes e pet, e nao beleza",
  nichoPeloTitulo("Kit Shampoo e Condicionador para Cães e Gatos 500ml") === "pet",
);
confere(
  "e o que nao casa com nenhum tambem",
  nichoPeloTitulo("Banqueta Plástica Dobrável, Branca, Altura 450 Mm, Vonder") === null,
);

// -------------------------------------------------------------
// A ordem das regras: o especifico ganha do generico
// -------------------------------------------------------------

confere(
  "racao nao vira mercado por causa de 'leite'",
  nichoPeloTitulo("Ração Golden para Gatos Filhotes sabor Leite 1kg") === "pet",
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
