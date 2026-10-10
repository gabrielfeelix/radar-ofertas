/**
 * Pede à Evolution o código de pareamento do chip e manda ao dono no
 * Telegram.
 *
 * POR QUE EXISTE: em 10/10 o `radar01` amanheceu desconectado ("Connection
 * Closed") e os grupos de WhatsApp ficaram mudos desde as 23h11 da
 * véspera. Reconectar pede o QR ou o código de pareamento, e os dois
 * dependem da apikey da Evolution, que só vive nos secrets do GitHub e na
 * VPS. Daí este script, rodado pelo `conecta-whatsapp.yml`.
 *
 * O CÓDIGO NUNCA VAI PARA O LOG. O repositório é público, e o log do
 * Actions também: com o código na mão, qualquer um conectaria um aparelho
 * ao chip. Ele sai só pelo privado do Telegram do dono.
 *
 * No celular do chip: WhatsApp → Aparelhos conectados → Conectar um
 * aparelho → Conectar com número de telefone, e digitar o código. Ele
 * vence em poucos minutos.
 */

const base = (process.env.WHATSAPP_API_URL ?? "").replace(/\/+$/, "");
const chave = process.env.WHATSAPP_API_KEY;
const instancia = process.env.WHATSAPP_INSTANCIA || "radar01";
const numeroDoChip = (process.env.WHATSAPP_NUMERO_DO_CHIP ?? "").replace(/\D/g, "");
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatDoDono = process.env.MONITOR_CELULAR_CHAT_ID;

if (!base || !chave || !numeroDoChip || !botToken || !chatDoDono) {
  console.error(
    "Faltam WHATSAPP_API_URL, WHATSAPP_API_KEY, WHATSAPP_NUMERO_DO_CHIP, " +
      "TELEGRAM_BOT_TOKEN ou MONITOR_CELULAR_CHAT_ID.",
  );
  process.exit(1);
}

async function evolution(caminho) {
  const r = await fetch(`${base}/${caminho}`, {
    headers: { apikey: chave },
    signal: AbortSignal.timeout(30_000),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${caminho.split("?")[0]} → HTTP ${r.status}`);
  return d;
}

async function avisaODono(texto) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatDoDono, text: texto }),
    signal: AbortSignal.timeout(20_000),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(`Telegram recusou: ${d.description}`);
}

async function main() {
  const estado = await evolution(`instance/connectionState/${encodeURIComponent(instancia)}`);
  const situacao = estado?.instance?.state ?? estado?.state ?? "desconhecido";
  console.log(`estado do ${instancia} antes: ${situacao}`);

  if (situacao === "open") {
    await avisaODono(`✅ O WhatsApp ${instancia} já está conectado. Não precisa de código.`);
    console.log("já conectado, nada a fazer");
    return;
  }

  const d = await evolution(
    `instance/connect/${encodeURIComponent(instancia)}?number=${numeroDoChip}`,
  );
  const codigo = d?.pairingCode;
  if (!codigo) {
    // Só as chaves da resposta, nunca os valores: o `code` é o QR.
    throw new Error(`a Evolution não devolveu código de pareamento (chaves: ${Object.keys(d ?? {}).join(", ")})`);
  }

  const formatado = codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo;
  await avisaODono(
    [
      `🔗 Código para conectar o WhatsApp ${instancia}:`,
      "",
      formatado,
      "",
      "No celular do chip: WhatsApp → Aparelhos conectados → Conectar um aparelho →",
      "Conectar com número de telefone. Vence em poucos minutos.",
    ].join("\n"),
  );
  console.log("código enviado ao dono pelo Telegram");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
