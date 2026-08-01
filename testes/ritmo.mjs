/**
 * Teste do ritmo de publicação.
 *
 * Existe porque errar aqui não dá erro: o canal simplesmente despeja
 * trinta posts de uma vez, ou fica mudo o dia inteiro. Nos dois casos
 * o sistema acha que está funcionando.
 */
import {
  RITMO_PADRAO, faixaDaHora, intervaloEmMinutos, podePublicarAgora, cabemAteMeiaNoite,
} from "../lib/ritmo.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\nas faixas do dia\n");
confere("03h é madrugada", faixaDaHora(3) === "madrugada");
confere("08h é pico", faixaDaHora(8) === "pico");
confere("12h é pico", faixaDaHora(12) === "pico");
confere("20h é pico", faixaDaHora(20) === "pico");
confere("15h é normal", faixaDaHora(15) === "normal");
confere("23h é normal, não madrugada", faixaDaHora(23) === "normal");

console.log("\nos intervalos\n");
confere("pico é o mais curto", intervaloEmMinutos("pico", RITMO_PADRAO) === 10);
confere("madrugada é o mais longo", intervaloEmMinutos("madrugada", RITMO_PADRAO) === 90);
confere("normal fica no meio", intervaloEmMinutos("normal", RITMO_PADRAO) === 30);

const intenso = { ...RITMO_PADRAO, modoIntenso: true };
confere("modo intenso divide por três", intervaloEmMinutos("pico", intenso) === 3);
confere("e nunca desce de um minuto", intervaloEmMinutos("pico", { ...intenso, intervaloPicoMin: 1 }) >= 1);

console.log("\nquando pode publicar\n");
// 20h em São Paulo é 23h UTC
const vinteHoras = new Date("2026-08-01T23:00:00Z");
confere("canal que nunca publicou pode agora", podePublicarAgora(vinteHoras, null, RITMO_PADRAO).pode);
confere(
  "publicou há 5 min em pico: espera",
  !podePublicarAgora(vinteHoras, new Date(vinteHoras.getTime() - 5 * 60_000), RITMO_PADRAO).pode,
);
confere(
  "publicou há 11 min em pico: pode",
  podePublicarAgora(vinteHoras, new Date(vinteHoras.getTime() - 11 * 60_000), RITMO_PADRAO).pode,
);

const recusa = podePublicarAgora(vinteHoras, new Date(vinteHoras.getTime() - 5 * 60_000), RITMO_PADRAO);
confere("a recusa diz o motivo, e não só 'não'", !recusa.pode && recusa.motivo.includes("pico"));
confere("e diz quanto falta", !recusa.pode && recusa.faltamMinutos === 5);

// 03h em São Paulo é 06h UTC
const tresDaManha = new Date("2026-08-01T06:00:00Z");
confere(
  "publicou há 30 min de madrugada: ainda espera",
  !podePublicarAgora(tresDaManha, new Date(tresDaManha.getTime() - 30 * 60_000), RITMO_PADRAO).pode,
);

console.log("\nquantos cabem\n");
const cabem = cabemAteMeiaNoite(new Date("2026-08-01T11:00:00Z"), RITMO_PADRAO);
confere(`o dia inteiro cabe num número plausível (${cabem})`, cabem > 20 && cabem < 90);
confere(
  "modo intenso cabe mais",
  cabemAteMeiaNoite(new Date("2026-08-01T11:00:00Z"), intenso) > cabem,
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
