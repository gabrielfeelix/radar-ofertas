/**
 * Teste do encurtador de título.
 *
 * O CASO QUE JUSTIFICA O ARQUIVO é "FPS 70" saindo de um produto que é
 * FPS 90. É informação falsa sobre o que a pessoa compra, escrita por um
 * modelo de linguagem que ninguém leu antes de publicar, e é a mesma
 * doença dos "sessenta pacotinhos" que escaparam do gancho em 11/08.
 *
 * A regra do teste é a da produção: na dúvida, nulo. Título comprido é
 * o que já temos hoje e não quebra nada.
 */
import { validaTituloCurto } from "../lib/titulo-curto.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

const SALLVE = "Protetor Solar Em Bastão Com Cor 6 15g Sallve FPS 90 Antimanchas";
const PAYOT = "Base matte Payot Boca Rosa Beauty 30ml tom 3 Francisca cobertura alta";

console.log("\no que tem que passar\n");

confere(
  "título curto e fiel passa inteiro",
  validaTituloCurto("Protetor Solar em Bastão Sallve FPS 90, 15g", SALLVE)
    === "Protetor Solar em Bastão Sallve FPS 90, 15g",
);
confere(
  "travessão vira vírgula, não reprova",
  validaTituloCurto("Base Payot — tom 3", PAYOT) === "Base Payot, tom 3",
);
confere(
  "aspas em volta são retiradas",
  validaTituloCurto('"Base Boca Rosa by Payot, tom 3"', PAYOT) === "Base Boca Rosa by Payot, tom 3",
);
confere(
  "rótulo do modelo é retirado",
  validaTituloCurto("Título: Base Boca Rosa by Payot", PAYOT) === "Base Boca Rosa by Payot",
);
confere(
  "título sem número nenhum passa",
  validaTituloCurto("Protetor Solar em Bastão Sallve", SALLVE) === "Protetor Solar em Bastão Sallve",
);
confere(
  "exatamente no teto passa",
  validaTituloCurto("a".repeat(55), SALLVE) === "a".repeat(55),
);

console.log("\no que tem que ser recusado\n");

confere(
  "FPS inventado é recusado",
  validaTituloCurto("Protetor Solar Sallve FPS 70, 15g", SALLVE) === null,
);
confere(
  "unidade trocada é recusada",
  validaTituloCurto("Protetor Solar Sallve FPS 90, 15ml", SALLVE) === null,
);
confere(
  "quantidade inventada é recusada",
  validaTituloCurto("Kit 3 Protetores Sallve FPS 90", SALLVE) === null,
);
confere(
  "um caractere acima do teto é recusado",
  validaTituloCurto("a".repeat(56), SALLVE) === null,
);
confere(
  "vazio é nulo",
  validaTituloCurto("", SALLVE) === null,
);
confere(
  "nulo é nulo",
  validaTituloCurto(null, SALLVE) === null,
);
confere(
  "sem original não valida nada",
  validaTituloCurto("Protetor Sallve", "") === null,
);
confere(
  "marcação HTML é recusada",
  validaTituloCurto("<b>Base Payot</b>", PAYOT) === null,
);
confere(
  "link é recusado",
  validaTituloCurto("Base Payot https://x.com", PAYOT) === null,
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) process.exit(1);
