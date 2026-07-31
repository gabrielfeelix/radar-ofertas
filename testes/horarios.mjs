/**
 * Teste dos horários de pico.
 *
 * Roda com `pnpm testa`. Função pura sobre texto, sem banco e sem rede.
 *
 * Por que existe: o campo de horário é texto livre, e o leitor precisa
 * aceitar como uma pessoa escreve — "07:30, 12:30 e 20:00" — sem
 * obrigar ninguém a decorar formato. Se ele errar, o aviso de "fora do
 * pico" ou some (e o dono publica no vazio) ou aparece sem motivo (e o
 * dono aprende a ignorar aviso, que é pior).
 */

import { estaEmPico, foraDePico, leHorarios, PICOS } from "../lib/horarios.ts";

let passou = 0;
let falhou = 0;
const confere = (nome, cond) => {
  if (cond) { passou += 1; console.log(`✓ ${nome}`); }
  else { falhou += 1; console.error(`✗ ${nome}`); }
};

console.log("\nleitura do texto livre\n");

confere(
  "vírgula e 'e' juntos",
  leHorarios("07:30, 12:30 e 20:00").join() === "07:30,12:30,20:00",
);
confere("só um horário", leHorarios("20:00").join() === "20:00");
confere("com hora de um dígito", leHorarios("7:30 e 9:00").join() === "07:30,09:00");
confere("ponto e vírgula", leHorarios("08:00; 21:00").join() === "08:00,21:00");
confere("texto sem horário nenhum", leHorarios("de manhã e à noite").length === 0);
confere("campo vazio", leHorarios("").length === 0);
confere("ignora hora inexistente", leHorarios("25:00 e 20:00").join() === "20:00");
confere("ignora minuto inexistente", leHorarios("20:75 e 20:00").join() === "20:00");

console.log("\nos três picos\n");

// Os picos vindos da pesquisa: 07–09, 12–13, 19–22.
for (const dentro of ["07:00", "07:30", "09:00", "12:00", "12:59", "19:00", "20:00", "22:00"]) {
  confere(`${dentro} está em pico`, estaEmPico(dentro));
}

for (const fora of ["06:59", "09:01", "11:00", "13:30", "15:00", "18:00", "22:30", "23:59"]) {
  confere(`${fora} está fora`, !estaEmPico(fora));
}

console.log("\no erro que motivou tudo isto\n");

// O formulário sugeria "09:00 e 18:00". As 18h estão fora dos três
// picos, e era o exemplo que virava padrão de quem não tinha opinião.
confere("18:00 é sinalizado", foraDePico("09:00 e 18:00").join() === "18:00");
confere("e 09:00 não é", !foraDePico("09:00 e 18:00").includes("09:00"));
confere("a sugestão nova não tem nada fora", foraDePico("07:30, 12:30 e 20:00").length === 0);

console.log("\ncoerência dos picos\n");

confere("são três", PICOS.length === 3);
confere(
  "cada pico começa antes de terminar",
  PICOS.every((p) => p.inicio < p.fim),
);
confere(
  "não se sobrepõem",
  PICOS.every((p, i) => i === 0 || PICOS[i - 1].fim < p.inicio),
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
