/**
 * Teste do ritmo de publicação.
 *
 * Existe porque errar aqui não dá erro: o canal simplesmente despeja
 * trinta posts de uma vez, ou fica mudo o dia inteiro. Nos dois casos
 * o sistema acha que está funcionando.
 */
import {
  RITMO_PADRAO, faixaDaHora, intervaloEmMinutos, podePublicarAgora, cabemAteMeiaNoite,
  diaEmSaoPaulo, inicioDoDiaEmSaoPaulo, intervaloDoWhatsAppEmMinutos, podeChipFalarAgora,
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

/*
  A FOLGA SORTEADA.

  Existe para o canal não publicar em horário exato, que é carimbo de
  robô. `sorteio` é injetado aqui para o acaso ficar fixo: teste que
  depende de `Math.random` falha uma vez a cada tanto, e teste
  intermitente ensina a ignorar falha vermelha.
*/
const comFolga = { ...RITMO_PADRAO, intervaloPicoMin: 5, jitterMin: 2 };

confere(
  "sorteio no piso encurta o máximo: 5 vira 3",
  intervaloEmMinutos("pico", comFolga, () => 0.99) === 3,
);
confere(
  "sorteio no teto não encurta nada: 5 continua 5",
  intervaloEmMinutos("pico", comFolga, () => 0) === 5,
);
confere(
  "e o meio cai entre os dois",
  intervaloEmMinutos("pico", comFolga, () => 0.5) === 4,
);

// A folga NUNCA alonga: o intervalo configurado é o teto de frequência
// combinado com o parceiro, não uma média para variar em volta.
let alongou = false;
for (let i = 0; i <= 100; i++) {
  if (intervaloEmMinutos("pico", comFolga, () => i / 100) > 5) alongou = true;
}
confere("a folga só encurta, nunca alonga", !alongou);

// Folga maior que o próprio intervalo viraria "publique sempre".
confere(
  "folga não engole o intervalo inteiro",
  intervaloEmMinutos("pico", { ...comFolga, intervaloPicoMin: 2, jitterMin: 90 }, () => 0.99) >= 1,
);

confere(
  "sem folga configurada, o intervalo é o de sempre",
  intervaloEmMinutos("pico", { ...RITMO_PADRAO, jitterMin: 0 }, () => 0.99) === 10,
);

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

/*
  O RITMO DO WHATSAPP.

  A regra do dono não tem folga nas pontas: *"aleatório entre 4 à 10 min
  cada promo, NAO PODEMOS SER MENOS OU MAIS QUE ISSO"*. Errar aqui não
  levanta erro — o número só cai algumas semanas depois, e aí não dá
  para saber se foi o ritmo ou outra coisa. Por isso o teste varre a
  janela inteira em vez de conferir um caso.
*/
console.log("\no ritmo do whatsapp, de 4 a 10\n");

const sorteados = new Set();
let foraDaJanela = null;
for (let i = 0; i < 5_000; i++) {
  const m = intervaloDoWhatsAppEmMinutos(`canal-${i}|${i * 97}`);
  sorteados.add(m);
  if (m < 4 || m > 10) foraDaJanela = m;
}

confere("nunca sai da janela em 5.000 sorteios", foraDaJanela === null);
confere("e usa os sete valores, de 4 a 10", sorteados.size === 7);

/*
  A ESTABILIDADE, que é o que faz a regra valer de verdade.

  O publicador chama `podePublicarAgora` a cada volta do laço enquanto
  dorme. Se o sorteio mudasse a cada chamada, o intervalo real viraria o
  MAIOR dos sorteios da espera, e passaria de 10 min sem ninguém ver.
*/
confere(
  "a mesma semente sorteia o mesmo número",
  intervaloDoWhatsAppEmMinutos("beauty|123") === intervaloDoWhatsAppEmMinutos("beauty|123"),
);

let mudouComOPost = false;
for (let i = 0; i < 200; i++) {
  if (intervaloDoWhatsAppEmMinutos(`beauty|${i}`) !== intervaloDoWhatsAppEmMinutos("beauty|0")) {
    mudouComOPost = true;
  }
}
confere("e muda quando o último post muda", mudouComOPost);

/*
  A JANELA VALE EM QUALQUER HORA DO DIA.

  É a diferença para o Telegram, que espera 90 min de madrugada. Quem
  impede o grupo de tocar às 3 da manhã é o `horarios_permitidos` do
  canal, não o intervalo.
*/
const doisMinAtras = (t) => new Date(t.getTime() - 2 * 60_000);
const onzeMinAtras = (t) => new Date(t.getTime() - 11 * 60_000);
const zap = { canalId: "beauty" };

let esperouMenosDeQuatro = false;
let esperouMaisDeDez = false;
for (const hora of ["2026-08-01T06:00:00Z", "2026-08-01T11:00:00Z", "2026-08-01T23:00:00Z"]) {
  const t = new Date(hora);
  if (podePublicarAgora(t, doisMinAtras(t), RITMO_PADRAO, zap).pode) esperouMenosDeQuatro = true;
  if (!podePublicarAgora(t, onzeMinAtras(t), RITMO_PADRAO, zap).pode) esperouMaisDeDez = true;
}
confere("com 2 min desde o último post, nunca libera", !esperouMenosDeQuatro);
confere("com 11 min desde o último post, sempre libera", !esperouMaisDeDez);

confere(
  "o primeiro post do canal não espera nada",
  podePublicarAgora(new Date("2026-08-01T11:00:00Z"), null, RITMO_PADRAO, zap).pode,
);

// E o Telegram não muda: sem o quarto argumento, a faixa do dia manda.
confere(
  "telegram continua com a faixa do dia: 30 min no normal",
  !podePublicarAgora(vinteHoras, new Date(vinteHoras.getTime() - 11 * 60_000), {
    ...RITMO_PADRAO,
    intervaloPicoMin: 30,
  }).pode,
);

/*
  O INTERVALO POR CHIP.

  O caso é oito grupos no mesmo número, que foi a pergunta do dono em
  10/08. Cada canal tem o próprio relógio, e sem esta trava os oito
  saem em sequência, com segundos entre eles. Do lado do WhatsApp, é um
  número mandando oito mensagens em 50 segundos para oito grupos: o
  padrão de disparo em massa, com cada canal individualmente em ordem.
*/
console.log("\no intervalo por chip\n");

const agoraChip = new Date("2026-08-01T14:00:00Z");
const atras = (min) => new Date(agoraChip.getTime() - min * 60_000);

confere("chip que nunca falou pode falar", podeChipFalarAgora(agoraChip, null, "bot-1").pode);
confere("chip que falou há 2 min espera", !podeChipFalarAgora(agoraChip, atras(2), "bot-1").pode);
confere("chip que falou há 11 min pode", podeChipFalarAgora(agoraChip, atras(11), "bot-1").pode);

// A janela do chip é a mesma do canal: nunca abaixo de 4, nunca acima
// de 10. Varre a janela inteira em vez de conferir um caso.
let chipLiberouCedo = false;
let chipSegurouDemais = false;
for (let i = 0; i < 500; i++) {
  const bot = `bot-${i}`;
  if (podeChipFalarAgora(agoraChip, atras(3), bot).pode) chipLiberouCedo = true;
  if (!podeChipFalarAgora(agoraChip, atras(11), bot).pode) chipSegurouDemais = true;
}
confere("com 3 min desde o último envio, nenhum chip libera", !chipLiberouCedo);
confere("com 11 min desde o último envio, todo chip libera", !chipSegurouDemais);

/*
  Chips diferentes têm relógios independentes, e isso é intencional: o
  teto é do NÚMERO, não da operação. Dois chips publicando ao mesmo
  tempo é o que se compra ao comprar o segundo chip.
*/
confere(
  "um chip esperando não segura o outro",
  !podeChipFalarAgora(agoraChip, atras(2), "bot-1").pode &&
    podeChipFalarAgora(agoraChip, null, "bot-2").pode,
);

// Estável entre chamadas, pelo mesmo motivo do sorteio por canal: o
// laço do publicador pergunta de novo a cada volta enquanto dorme.
confere(
  "o sorteio do chip não muda entre chamadas",
  podeChipFalarAgora(agoraChip, atras(5), "bot-1").faltamMinutos ===
    podeChipFalarAgora(agoraChip, atras(5), "bot-1").faltamMinutos,
);

// E a semente do chip não colide com a do canal: mesmo id, sorteios
// independentes. Sem o prefixo, um bot e um canal de mesmo id teriam
// sempre o mesmo número, que é acaso de mentira.
let colidiuSempre = true;
for (let i = 0; i < 200; i++) {
  const id = `id-${i}`;
  const doCanal = podePublicarAgora(agoraChip, atras(5), RITMO_PADRAO, { canalId: id });
  const doChip = podeChipFalarAgora(agoraChip, atras(5), id);
  if (doCanal.faltamMinutos !== doChip.faltamMinutos) colidiuSempre = false;
}
confere("o sorteio do chip é independente do sorteio do canal", !colidiuSempre);

console.log("\nquantos cabem\n");
const cabem = cabemAteMeiaNoite(new Date("2026-08-01T11:00:00Z"), RITMO_PADRAO);
confere(`o dia inteiro cabe num número plausível (${cabem})`, cabem > 20 && cabem < 90);
confere(
  "modo intenso cabe mais",
  cabemAteMeiaNoite(new Date("2026-08-01T11:00:00Z"), intenso) > cabem,
);

/*
  O DIA DE SÃO PAULO, que é o recorte do teto diário do canal.

  O caso que importa é o das 23h UTC: já é dia seguinte em Londres e
  ainda são 20h em São Paulo, dentro do pico da noite. Se o teto usasse
  o dia UTC, ele zeraria ali e o canal ganharia uma cota inteira no
  meio do pico.
*/
console.log("\no dia em São Paulo\n");
confere(
  "23h UTC do dia 1 ainda é dia 1 em São Paulo",
  diaEmSaoPaulo(new Date("2026-08-01T23:00:00Z")) === "2026-08-01",
);
confere(
  "02h UTC do dia 2 ainda é dia 1 em São Paulo",
  diaEmSaoPaulo(new Date("2026-08-02T02:00:00Z")) === "2026-08-01",
);
confere(
  "03h UTC do dia 2 já é dia 2 em São Paulo",
  diaEmSaoPaulo(new Date("2026-08-02T03:00:00Z")) === "2026-08-02",
);
confere(
  "o começo do dia é 03h UTC",
  inicioDoDiaEmSaoPaulo(new Date("2026-08-01T23:00:00Z")).toISOString() === "2026-08-01T03:00:00.000Z",
);
confere(
  "e ele nunca está no futuro",
  inicioDoDiaEmSaoPaulo(new Date("2026-08-01T23:00:00Z")).getTime() <=
    new Date("2026-08-01T23:00:00Z").getTime(),
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
