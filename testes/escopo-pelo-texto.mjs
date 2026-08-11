/**
 * Teste do escopo lido do texto do post.
 *
 * O QUE ESTÁ EM JOGO. Este é o único lugar do sistema que decide, sem
 * curadoria humana, que um cupom pode ir para um canal. Errar para o
 * lado generoso publica cupom que falha no carrinho de quem comprou
 * fora da lista, e é isso que queima o grupo.
 *
 * A regra é a mesma da 3.4 e da D-036: **na dúvida, inerte.**
 *
 * Os textos abaixo são reais, dos posts que o dono mandou em 11/08 e
 * dos canais que a colheita já lê.
 */
import { escopoPeloTexto } from "../lib/escopo-pelo-texto.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\nvale no site todo\n");

confere(
  "o MELIPREFERIDO real, do post de 11/08",
  escopoPeloTexto("10% OFF no site em compras a partir de R$149, limitado a R$200.")?.geral === true,
);
confere("site todo", escopoPeloTexto("20% OFF no site todo")?.geral === true);
confere("todo o site", escopoPeloTexto("15% em todo o site, mínimo R$ 50")?.geral === true);
confere("qualquer produto", escopoPeloTexto("10% OFF em qualquer produto")?.geral === true);
confere("geral não carrega nicho", escopoPeloTexto("10% OFF no site")?.nichoSlug === null);

console.log("\nseleção de produtos: restrição ganha, e não publica\n");

confere(
  "o MAISOFERTAS real, do mesmo post",
  escopoPeloTexto("Seleção de produtos:\n18% OFF em compras a partir de R$29, limitado a R$500.") === null,
);
confere("produtos selecionados", escopoPeloTexto("20% OFF em produtos selecionados") === null);
confere("itens selecionados", escopoPeloTexto("15% em itens selecionados") === null);
confere("lojas selecionadas", escopoPeloTexto("10% em lojas selecionadas") === null);
confere(
  "restrição ganha de abrangência mesmo com as duas frases juntas",
  escopoPeloTexto("10% OFF no site em produtos selecionados") === null,
);
confere(
  "o TOMACUPOM real do @CupomDoGnu: lista indicada é restrição",
  escopoPeloTexto("20% OFF\nNas compras acima de R$ 19\nVálido para itens da lista indicada") === null,
);

console.log("\na categoria, quando o texto a nomeia\n");

confere("moda", escopoPeloTexto("20% OFF em Moda, mínimo R$ 99")?.nichoSlug === "moda");
confere("casa", escopoPeloTexto("30% OFF em Itens para Casa e Cozinha")?.nichoSlug === "casa");
confere("eletrônico", escopoPeloTexto("R$20 OFF em Eletrônicos")?.nichoSlug === "eletronico");
confere("pet", escopoPeloTexto("15% OFF em Pet Shop")?.nichoSlug === "pet");
confere("beleza", escopoPeloTexto("25% OFF em Beleza e cuidado pessoal")?.nichoSlug === "beleza");
confere("categoria nunca vem como geral", escopoPeloTexto("20% OFF em Moda")?.geral === false);
confere(
  "acento não atrapalha",
  escopoPeloTexto("20% OFF em Eletrônicos, Áudio e Vídeo")?.nichoSlug === "eletronico",
);

console.log("\nambiguidade não publica\n");

confere(
  "duas categorias no mesmo texto é inerte",
  escopoPeloTexto("20% OFF em Moda e Casa") === null,
);
confere("texto sem escopo nenhum", escopoPeloTexto("20% OFF, mínimo R$ 99, limitado a R$ 30") === null);
confere("vazio", escopoPeloTexto("") === null);
confere("nulo", escopoPeloTexto(null) === null);
confere("indefinido", escopoPeloTexto(undefined) === null);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
