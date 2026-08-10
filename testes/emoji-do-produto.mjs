/**
 * Teste do emoji da oferta.
 *
 * Os títulos aqui são REAIS, copiados do catálogo de produção em 10/08.
 * Emoji inventado de cabeça é como se erra: eu teria posto batom no
 * canal de beleza, e o catálogo mostrou que a maioria é cabelo.
 */
import { emojiDoProduto, tabelaDeEmojis } from "../lib/emoji-do-produto.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };
const eh = (titulo, esperado, nicho = null) =>
  confere(`${esperado}  ${titulo.slice(0, 46)}`, emojiDoProduto(titulo, nicho) === esperado);

console.log("\ncabelo, que é a maioria do canal de beleza\n");
eh("Soft Hair Mascara Pos Quimica Soft Novo 280Ml", "💇");
eh("Wella Professionals Invigo Sun - Leave-in 150ml", "💇");
eh("Kit Truss Uso Obrigatorio - Shampoo 300ml (2 Unidades)", "💇");
eh("Joico K-PAK Clarifying Smart Release - Shampoo Antirresíduo 300ml", "💇");
eh("Kit Braé Essential Shampoo e Máscara (2 produtos)", "💇");
eh("Oil Glow Óleo Perfumado Oleo Capilar Finalizador 30g", "💇");
eh("Morina Modelador de Cachos de reto Automático Profissional 25mm", "💇");
eh("Marco Boni Escova De Madeira Raquete Almofadada Wood Line", "💇");

console.log("\nskincare\n");
eh("NIVEA Água Micelar Solução de Limpeza 7 em 1 Refrescante 200ml", "🧴");
eh("3x Neutrogena Hidratante Facial Hydro Boost Water Gel Refil, 50g", "🧴");
eh("Kit 4 Sérum Facial Rosa Mosqueta 30ml Hidratação Renovação", "🧴");
eh("Kit Creamy Skincare Glicointense Peel e Lotion FPS 60 (2 produtos)", "🧴");

console.log("\nmaquiagem\n");
eh("Eudora SOUL Turbo Batom Líquido Marrom Turbinado Semi Mate 5ml", "💄");
eh("Océane Purple Blush Stick Berry Kiss - Blush em Bastão 14g", "💄");
eh("SACE LADY Base Líquida Cushion FPS 30 + Batom Mágico Hidratante", "💄");

console.log("\ncorpo e banho\n");
eh("NIVEA Sabonete Líquido Íntimo Suave 250ml, Limpeza Delicada", "🛁");
eh("Gillette Desodorante Antitranspirante em Gel Cool Wave 45 g", "🛁");
eh("Creme Depilatório Depeelig Racco Masculino e Feminino 150ml", "🛁");

console.log("\nunhas e pés\n");
eh("Pedicuro Lixa Eletrica Para Os Pés Profissional + 12 Lixas", "💅");

console.log("\nperfumaria\n");
eh("Perfume Malbec Desodorante Colônia 100ml", "🌸");

/*
  A ORDEM DAS REGRAS É DECISÃO, e estes são os casos que a provam.

  "Base Líquida Cushion FPS 30" tem `fps` (skincare) e `base líquida`
  (maquiagem). Maquiagem vem antes de propósito: quem lê vê um produto
  de maquiagem, não um protetor solar.

  "Máscara" sozinha é ambígua e nunca aparece solta em regra nenhuma.
*/
console.log("\na ordem das regras\n");
confere(
  "base com FPS é maquiagem, não protetor solar",
  emojiDoProduto("SACE LADY Base Líquida Cushion FPS 30") === "💄",
);
confere(
  "máscara capilar é cabelo",
  emojiDoProduto("Braé Máscara Capilar Revival 200g") === "💇",
);
confere(
  "máscara de cílios é maquiagem",
  emojiDoProduto("Máscara de Cílios Volume Extra Preta") === "💄",
);

console.log("\nos três degraus\n");
confere("título manda quando reconhece", emojiDoProduto("Shampoo Anticaspa 200ml", "pet") === "💇");
confere("sem título reconhecido, vale o nicho", emojiDoProduto("Produto Genérico XYZ 500", "pet") === "🐾");
confere("sem nicho, cai no genérico", emojiDoProduto("Produto Genérico XYZ 500", null) === "🛍️");
confere("título vazio e nicho válido", emojiDoProduto("", "brinquedo") === "🧸");
confere("nada de nada não quebra", emojiDoProduto(null, null) === "🛍️");
confere("nicho desconhecido cai no genérico", emojiDoProduto("coisa", "nicho-que-nao-existe") === "🛍️");

/*
  Todo nicho que o canal usa hoje precisa ter emoji. Sem isto, um nicho
  novo entra em produção com o saco de compras genérico e ninguém nota
  até alguém reclamar do grupo.
*/
console.log("\ncobertura dos nichos que existem\n");
const NICHOS_DE_HOJE = [
  "beleza", "perfume", "bebe", "brinquedo", "pet", "eletronico",
  "games", "geek", "suplemento", "fitness", "esporte", "casa", "automotivo",
];
let semEmoji = [];
for (const n of NICHOS_DE_HOJE) {
  if (emojiDoProduto("xxxxx", n) === "🛍️") semEmoji.push(n);
}
confere(`todos os ${NICHOS_DE_HOJE.length} nichos têm emoji próprio`, semEmoji.length === 0);
if (semEmoji.length) console.log("   sem emoji:", semEmoji.join(", "));

confere("a tabela para a tela não vem vazia", tabelaDeEmojis().length > 10);

/*
  A ARMADILHA DO `\b` COM ACENTO.

  `/\b[áa]gua micelar/` nao casa com "Água Micelar": `\b` e fronteira
  ASCII, e "Á" nao e caractere de palavra para ele. Estes casos existem
  para o dia em que alguem "simplificar" as bordas de volta para `\b`.
*/
console.log("\nacento no comeco da palavra\n");
eh("Água Micelar Nivea 200ml para limpeza de pele", "🧴");
eh("Óleo Capilar Reparador de Pontas 60ml", "💇");
eh("Sérum Ácido Hialurônico Concentrado 30ml", "🧴");
eh("Óleo Corporal Hidratante Amêndoas 200ml", "🛁");

console.log("\nperfume vem antes de banho\n");
eh("Perfume Malbec Desodorante Colônia 100ml", "🌸");
confere(
  "e desodorante de verdade continua sendo banho",
  emojiDoProduto("Gillette Desodorante Antitranspirante em Gel Cool Wave 45 g") === "🛁",
);

/*
  LACUNAS VISTAS NA FILA REAL de 10/08, renderizando o modelo do Delas
  com item de verdade: os tres primeiros sairam com o generico.
*/
console.log("\nlacunas achadas renderizando a fila\n");
eh("Creme Para Pentear Hipoalergico 300ml", "💇");
eh("Óleo Removedor Cera Pós Depilação Corporal 100ml Depilflax", "🛁");

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
