/**
 * Teste das faixas de lastro.
 *
 * POR QUE ELE IMPORTA: é onde a regra 3.4 vira número. A fronteira dos
 * 30 dias é a única coisa que separa "menor valor histórico" de uma
 * afirmação sem lastro, e afirmação de preço sem lastro é o erro que
 * mata canal de oferta.
 *
 * As fronteiras são testadas dos dois lados de propósito: 29 e 30, 13 e
 * 14. Erro de `>=` contra `>` numa dessas passa despercebido em revisão
 * e só aparece no grupo.
 */
import { faixaDoLastro } from "../lib/lastro.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\nas fronteiras, dos dois lados\n");

confere("30 dias afirma histórico", faixaDoLastro(30, null) === "historico");
confere("29 dias NÃO afirma histórico", faixaDoLastro(29, null) === "mes");
confere("14 dias é mês", faixaDoLastro(14, null) === "mes");
confere("13 dias é semana", faixaDoLastro(13, null) === "semana");
confere("7 dias é semana", faixaDoLastro(7, null) === "semana");
confere("6 dias é dias", faixaDoLastro(6, null) === "dias");
confere("2 dias é dias", faixaDoLastro(2, null) === "dias");
confere("1 dia é ontem", faixaDoLastro(1, null) === "ontem");
confere("0 dia é hoje", faixaDoLastro(0, null) === "hoje");

console.log("\na queda vence a idade da série\n");

confere("queda vence série longa", faixaDoLastro(30, 25) === "queda");
confere("queda vence série curta", faixaDoLastro(1, 12) === "queda");
confere("queda de 0% não conta como queda", faixaDoLastro(5, 0) === "dias");
confere("queda negativa não conta", faixaDoLastro(5, -3) === "dias");

console.log("\nausência de dado nunca afirma nada\n");

confere("série nula não afirma", faixaDoLastro(null, null) === "nenhuma");
confere("série indefinida não afirma", faixaDoLastro(undefined, null) === "nenhuma");
confere("dia negativo não quebra", faixaDoLastro(-1, null) === "nenhuma");
confere("série nula com queda ainda usa a queda", faixaDoLastro(null, 20) === "queda");

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) process.exit(1);
