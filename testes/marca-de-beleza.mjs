/**
 * Teste do reconhecimento de marca de beleza.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede.
 *
 * POR QUE ELE EXISTE. Este módulo decide a ORDEM da fila do Radar
 * Delas, e a ordem errada é o que produziu o pedido do dono em 13/08:
 * *"10 SECADORES E 0 WEPINK... só tem bomba"*. A lista de marca que o
 * publicador usava era de perfume, e reconhecia três dos 348 produtos
 * de maquiagem e skincare que estavam na fila naquele momento.
 *
 * TODOS OS TÍTULOS SÃO REAIS, lidos da fila de produção em 13/08.
 */

import { marcaDeBeleza, pesoDaMarcaDeBeleza } from "../lib/marca-de-beleza.ts";

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

console.log("\nmarca de beleza\n");

// -------------------------------------------------------------
// As três faixas
// -------------------------------------------------------------

confere(
  "maquiagem nacional de varejo",
  marcaDeBeleza("Iluminador Compacto Ruby Rose Mood Fine Light Hbm703").faixa ===
    "maquiagem-conhecida",
);
confere(
  "maquiagem de influenciadora",
  marcaDeBeleza("Base matte Payot Boca Rosa Beauty 30ml tom 3 Francisca").faixa ===
    "maquiagem-conhecida",
);
confere(
  "a marca que o dono citou pelo nome",
  marcaDeBeleza("Kit WePink By Virginia Hidratante Facial").faixa === "maquiagem-conhecida",
);
confere(
  "dermocosmético",
  marcaDeBeleza("Protetor Solar Fps80 Anthelios Cor 1.0 40g La Roche-posay").faixa ===
    "skincare-conhecida",
);
confere(
  "skincare nacional",
  marcaDeBeleza("Principia, Sérum Facial Retinol, 30ml Todo Tipo De Pele Noite").faixa ===
    "skincare-conhecida",
);
confere(
  "coreana pela marca",
  marcaDeBeleza("COSRX Advanced Snail 96 Mucin Power Essence 100ml").faixa === "coreana",
);
confere(
  "coreana pelo termo, que é como o vendedor sem marca anuncia",
  marcaDeBeleza("Kit Skincare Coreano Máscara Facial Hidratante 10 unidades").faixa === "coreana",
);

// -------------------------------------------------------------
// A vírgula do meio do nome, que quebra casamento por texto simples
// -------------------------------------------------------------

confere(
  "'Quem disse, Berenice?' casa com a vírgula no meio",
  marcaDeBeleza("Quem disse, Berenice? Batom Líquido Damascoli 4ml").faixa ===
    "maquiagem-conhecida",
);
confere(
  "e sem a vírgula também",
  marcaDeBeleza("Quem Disse Berenice Toda Fresh Blush Jelly Rosa Pink 5g").faixa ===
    "maquiagem-conhecida",
);
confere(
  "Océane com acento",
  marcaDeBeleza("Océane Purple Blush Stick Berry Kiss - Blush em Bastão 14g").faixa ===
    "maquiagem-conhecida",
);
confere(
  "e Oceane sem acento, que é como metade do catálogo escreve",
  marcaDeBeleza("Esponja De Maquiagem Flat Blend - By Oceane Cor Roxa").faixa ===
    "maquiagem-conhecida",
);
confere(
  "Cerave junto e separado",
  marcaDeBeleza("Loção Hidratante Para Pele Seca A Extra Seca 340ml Cerave").faixa ===
    "skincare-conhecida" &&
    marcaDeBeleza("Loção facial hidratante Cera Ve X 52 ml").faixa === "skincare-conhecida",
);

// -------------------------------------------------------------
// O que NÃO é marca conhecida, e continua sendo publicado
// -------------------------------------------------------------

confere(
  "a genérica chinesa não é reconhecida",
  marcaDeBeleza("SACE LADY Base Líquida Cushion FPS 30 + Batom Mágico").faixa === "desconhecida",
);
confere(
  "nem a sem marca nenhuma",
  marcaDeBeleza("Batom Líquido, Longa Duração, Acabamento Vinil Espelhado").faixa ===
    "desconhecida",
);
confere(
  "e isso não exclui ninguém: é peso zero, não veto",
  pesoDaMarcaDeBeleza("SACE LADY Base Líquida Cushion FPS 30") === 0,
);

// -------------------------------------------------------------
// Cabelo está FORA de propósito. Ver o cabeçalho do módulo.
// -------------------------------------------------------------

confere(
  "marca de salão não ganha prioridade, e isso é decisão e não esquecimento",
  pesoDaMarcaDeBeleza("Kit Wella Professionals Invigo Nutri-Enrich Salon Care") === 0,
);
confere(
  "nem a de cacho, que é a que mais aparece na fila",
  pesoDaMarcaDeBeleza("Kit Widi Care Juba Hidro-Nutritiva Quadruple (4 Produtos)") === 0,
);

// -------------------------------------------------------------
// As bordas
// -------------------------------------------------------------

confere("título nulo não quebra", marcaDeBeleza(null).faixa === "desconhecida");
confere("título vazio não quebra", marcaDeBeleza("").faixa === "desconhecida");
confere("o peso de nulo é zero", pesoDaMarcaDeBeleza(null) === 0);
confere(
  "a marca que casou volta no resultado, para o log poder dizer por quê",
  marcaDeBeleza("Vichy Minéral 89 - Hidratante Facial Fortalecedor 40ml").marca?.toLowerCase() ===
    "vichy",
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
