/**
 * Teste da curva de aquecimento do chip.
 *
 * Errar aqui não levanta erro: o número só cai algumas semanas depois,
 * e aí não dá para saber se foi a rampa ou outra coisa. Por isso o
 * teste cobre cada degrau, e não uma amostra.
 */
import { diaDoAquecimento, tetoDoDia, porHoraDoDia } from "../lib/aquecimento.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\no dia do aquecimento\n");

// 12:00 UTC = 09:00 em São Paulo, bem longe da virada do dia.
const meioDia = (d) => new Date(`${d}T12:00:00Z`);

confere("o dia de início é o dia 1", diaDoAquecimento("2026-08-10", meioDia("2026-08-10")) === 1);
confere("o dia seguinte é o dia 2", diaDoAquecimento("2026-08-10", meioDia("2026-08-11")) === 2);
confere("duas semanas depois é o dia 15", diaDoAquecimento("2026-08-10", meioDia("2026-08-24")) === 15);
confere("data no futuro não chega a 1", diaDoAquecimento("2026-08-20", meioDia("2026-08-10")) <= 0);

/*
  A VIRADA DO DIA É NO FUSO DE SÃO PAULO, não no UTC (regra 3.9).

  02h UTC do dia 11 ainda é 23h do dia 10 em São Paulo. Contando por
  UTC, o chip ganharia o degrau seguinte da rampa três horas antes da
  hora, e bem no meio do pico da noite.
*/
confere(
  "02h UTC do dia 11 ainda é o dia 1",
  diaDoAquecimento("2026-08-10", new Date("2026-08-11T02:00:00Z")) === 1,
);
confere(
  "04h UTC do dia 11 já é o dia 2",
  diaDoAquecimento("2026-08-10", new Date("2026-08-11T04:00:00Z")) === 2,
);

console.log("\na curva, que é decisão do dono\n");

// A curva começa em 5 por hora desde 13/08, a pedido do dono. O degrau
// de 3 deixou de existir: o que era o dia 6 passou a ser o dia 1.
confere("dia 1: 5 por hora x 24 = 120", tetoDoDia(1, 150) === 120);
confere("dia 2 continua em 120", tetoDoDia(2, 150) === 120);
confere("dia 10 é o último de 5 por hora", tetoDoDia(10, 150) === 120);
confere("dia 11 sobe para 10 por hora, e o teto do chip corta em 150", tetoDoDia(11, 150) === 150);
confere("a janela do canal multiplica: 5 por hora em 9 horas são 45", tetoDoDia(1, 150, 9) === 45);
// A janela real do Radar Delas no WhatsApp é das 9h às 21h.
confere("as 13 horas do Radar Delas cabem em 65 posts", tetoDoDia(1, 150, 13) === 65);
confere("nenhum dia da rampa fica abaixo de 5 por hora", porHoraDoDia(1) === 5);
confere("dia 15 libera o teto cheio", tetoDoDia(15, 150) === 150);
confere("e depois continua o teto cheio", tetoDoDia(400, 150) === 150);

// A curva nunca desce no meio: subir e depois cair seria um bug que
// ninguém veria, porque o volume menor não parece defeito.
let desceu = false;
for (let d = 2; d <= 15; d++) {
  if (tetoDoDia(d, 150) < tetoDoDia(d - 1, 150)) desceu = true;
}
confere("a curva nunca desce do dia 1 ao 15", !desceu);

/*
  Dia 0 ou negativo é data de início no futuro, que só acontece por erro
  de digitação no cadastro. Zero é o que impede o erro de virar disparo.
*/
console.log("\nas bordas\n");

confere("dia 0 não publica nada", tetoDoDia(0, 150) === 0);
confere("dia negativo não publica nada", tetoDoDia(-5, 150) === 0);

// O teto do chip manda mesmo quando a curva pediria mais: um bot
// cadastrado com teto de 12 não manda 30 no dia 5.
confere("teto cheio baixo limita a curva", tetoDoDia(5, 12) === 12);
confere("e limita também no primeiro degrau", tetoDoDia(1, 6) === 6);

/*
  A rampa continua sendo rampa: subir o primeiro degrau para 5 não pode
  ter apagado a subida até o ritmo de operação. Se um dia alguém achatar
  a curva inteira num valor só, isto avisa.
*/
confere("a curva ainda sobe do dia 1 ao dia 15", tetoDoDia(15, 500) > tetoDoDia(1, 500));

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
