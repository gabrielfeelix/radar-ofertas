/**
 * Teste do casamento de prefixo de cupom.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede.
 *
 * POR QUE ELE EXISTE. Esta função decide em qual canal um cupom pode
 * aparecer, e errar tem custo assimétrico: escopo largo demais publica
 * código que falha no carrinho, e quem chega no checkout esperando
 * desconto e não recebe não volta. Escopo estreito demais só perde uma
 * publicação.
 *
 * Os prefixos abaixo são os que estão em produção em 04/08.
 */

import { escopoDoCupom } from "../lib/escopo-do-cupom.ts";

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

const EM_PRODUCAO = [
  { prefixo: "FULL", nicho_id: null, geral: true },
  { prefixo: "LOJASOFICIAIS", nicho_id: null, geral: true },
  { prefixo: "TODOSITE", nicho_id: null, geral: true },
  { prefixo: "MODAEBELEZA", nicho_id: "n-moda", geral: false },
  { prefixo: "DECORELETRO", nicho_id: "n-casa", geral: false },
  { prefixo: "LIVROSJOGOS", nicho_id: "n-games", geral: false },
  { prefixo: "TVSECELULARES", nicho_id: "n-eletronico", geral: false },
  { prefixo: "TUDOPRACASA", nicho_id: "n-casa", geral: false },
];

console.log("\nescopo do cupom\n");

// -------------------------------------------------------------
// O que já funcionava, e não pode regredir
// -------------------------------------------------------------

confere(
  "cupom datado continua casando",
  escopoDoCupom("LOJASOFICIAIS0108", EM_PRODUCAO)?.prefixo === "LOJASOFICIAIS",
);
confere(
  "e o de nicho também",
  escopoDoCupom("MODAEBELEZA0108", EM_PRODUCAO)?.nicho_id === "n-moda",
);

// -------------------------------------------------------------
// O que este arquivo veio consertar: cupom sem data no código
// -------------------------------------------------------------

confere(
  "cupom sem data casa pelo prefixo",
  escopoDoCupom("LIVROSJOGOSRELAMPAGO", EM_PRODUCAO)?.nicho_id === "n-games",
);
confere(
  "e o do site inteiro também",
  escopoDoCupom("TODOSITERESGATE", EM_PRODUCAO)?.geral === true,
);

// -------------------------------------------------------------
// O MAIS LONGO GANHA, que é a regra que evita escopo errado
// -------------------------------------------------------------

{
  const comOsDois = [...EM_PRODUCAO, { prefixo: "MODA", nicho_id: "n-moda-geral", geral: false }];
  confere(
    "entre MODA e MODAEBELEZA, ganha o mais específico",
    escopoDoCupom("MODAEBELEZA0108", comOsDois)?.prefixo === "MODAEBELEZA",
  );
  confere(
    "e o código que só casa com o curto pega o curto",
    escopoDoCupom("MODARELAMPAGO", comOsDois)?.prefixo === "MODA",
  );
}

// -------------------------------------------------------------
// O desconhecido separa, não é ignorado (D-036)
// -------------------------------------------------------------

confere("código que não casa com nada devolve nulo", escopoDoCupom("AMODESCONTO", EM_PRODUCAO) === null);
confere("código vazio devolve nulo", escopoDoCupom("", EM_PRODUCAO) === null);
confere("código nulo devolve nulo", escopoDoCupom(null, EM_PRODUCAO) === null);
confere("lista vazia devolve nulo", escopoDoCupom("FULL3107", []) === null);

// -------------------------------------------------------------
// Bordas
// -------------------------------------------------------------

confere("a caixa não importa no código", escopoDoCupom("full3107", EM_PRODUCAO)?.prefixo === "FULL");
confere(
  "a caixa não importa no prefixo",
  escopoDoCupom("FULL3107", [{ prefixo: "full", nicho_id: null, geral: true }])?.prefixo === "full",
);
confere(
  "prefixo vazio não casa com tudo",
  escopoDoCupom("QUALQUER", [{ prefixo: "", nicho_id: null, geral: true }]) === null,
);
confere(
  "o prefixo casa no COMEÇO, e não no meio",
  escopoDoCupom("XXFULLYY", EM_PRODUCAO) === null,
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
