import "server-only";

import { paraWhatsApp } from "@/lib/texto-whatsapp";

/**
 * Publicação em grupo de WhatsApp.
 *
 * **A regra 3.2 mudou em 06/08.** Ela proibia isto desde o começo do
 * projeto, e a D-053 tinha reafirmado a proibição em 03/08 — por
 * CONTA, não por princípio: ~R$30/mês de chip mais VPS no Brasil não
 * se pagavam num grupo sem audiência. O dono aceitou a conta e o
 * risco: *"n ligo de derrubar conta do numero, vou ir comprando
 * varios"*. A decisão está na D-071.
 *
 * O QUE ISTO É, SEM EUFEMISMO: não existe API oficial para publicar em
 * grupo de WhatsApp. A Groups API tem teto de 8 participantes, Canal
 * não tem API de publicação, e broadcast é mensagem individual com
 * opt-in. O caminho é um cliente não oficial — aqui, a **Evolution
 * API**, que é uma camada REST sobre o Baileys, rodando na VPS. O
 * WhatsApp detecta cliente não oficial pelo protocolo, não só pelo
 * comportamento. **Este número vai cair um dia.** O sistema é escrito
 * para que isso custe um chip, não a operação.
 *
 * AS TRÊS DEFESAS, e nenhuma é opcional:
 *
 *   1. **Um chip por instância** (`canal.whatsapp_instancia`), com teto
 *      de envios por dia contado por chip e não por canal. Sete canais
 *      num número só dariam ~210 envios/dia, acima do teto de número
 *      maduro (menos de 200/dia, menos de 30/hora).
 *   2. **Ritmo com folga sorteada**, que já existe em `lib/ritmo.ts`.
 *      Intervalo fixo é assinatura de robô documentada.
 *   3. **O número do bot nunca é o único admin do grupo.** Isto é
 *      regra de operação, não de código, e é o que separa perder um
 *      chip de perder a audiência: quando a conta cai, o WhatsApp passa
 *      o admin para outro membro, e o grupo sobrevive — a menos que a
 *      conta banida fosse a única lá dentro.
 *
 * E nunca o número pessoal nem o de trabalho: banimento permanente é
 * perda de identidade, não de ferramenta.
 *
 * O resto segue o `lib/telegram.ts`: o que foi para o grupo é o que
 * fica gravado em `publicacao.mensagem`, e falha nunca é silenciosa.
 */

export type ResultadoDoEnvio =
  | { ok: true; messageId: string }
  | { ok: false; motivo: string; configuracao?: boolean };

type Credenciais = { base: string; chave: string };

function credenciais(): Credenciais | { faltando: string } {
  const base = (process.env.WHATSAPP_API_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.WHATSAPP_API_KEY ?? "";

  if (!base) return { faltando: "falta WHATSAPP_API_URL — o endereço da Evolution API na VPS" };
  if (!chave) return { faltando: "falta WHATSAPP_API_KEY" };
  return { base, chave };
}

/**
 * Manda a mensagem para o grupo, com a foto quando existe.
 *
 * `grupoJid` é o identificador do grupo (`...@g.us`), e `instancia` é
 * qual chip fala — as duas coisas vêm do canal.
 *
 * **O que vai é o LINK da imagem, e a Evolution baixa** — o sistema
 * nunca guarda o arquivo (regra 3.3). Sem foto, cai para texto puro
 * em vez de não publicar.
 */
export async function publicaNoWhatsApp(
  instancia: string,
  grupoJid: string,
  texto: string,
  fotoUrl: string | null = null,
): Promise<ResultadoDoEnvio> {
  const cred = credenciais();
  if ("faltando" in cred) return { ok: false, configuracao: true, motivo: cred.faltando };

  if (!instancia) {
    return { ok: false, configuracao: true, motivo: "o canal não tem instância de WhatsApp cadastrada" };
  }
  if (!grupoJid) {
    return { ok: false, configuracao: true, motivo: "o canal não tem o grupo de WhatsApp cadastrado" };
  }

  const corpo = paraWhatsApp(texto);

  const rota = fotoUrl
    ? `${cred.base}/message/sendMedia/${encodeURIComponent(instancia)}`
    : `${cred.base}/message/sendText/${encodeURIComponent(instancia)}`;

  const carga = fotoUrl
    ? { number: grupoJid, mediatype: "image", media: fotoUrl, caption: corpo }
    : { number: grupoJid, text: corpo, linkPreview: false };

  try {
    const r = await fetch(rota, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cred.chave },
      body: JSON.stringify(carga),
      signal: AbortSignal.timeout(30000),
    });

    const d = await r.json().catch(() => null);

    if (!r.ok) {
      const motivo = String(d?.response?.message ?? d?.message ?? `HTTP ${r.status}`);

      // Foto que a loja recusa servir não pode custar a publicação:
      // cai para texto, que ainda vende. Mesma regra do Telegram.
      if (fotoUrl && /media|download|url|buffer/i.test(motivo)) {
        return publicaNoWhatsApp(instancia, grupoJid, texto, null);
      }
      return { ok: false, motivo: traduz(motivo) };
    }

    return { ok: true, messageId: String(d?.key?.id ?? "") };
  } catch (erro) {
    return { ok: false, motivo: `não alcancei a Evolution API: ${(erro as Error).message}` };
  }
}

/**
 * Os erros que vão acontecer de verdade, em português.
 *
 * O primeiro da lista é o que interessa: instância desconectada é como
 * o banimento aparece. Ela não vem escrita "você foi banido" — vem
 * como a instância caindo e não voltando no QR Code.
 */
function traduz(mensagem: string): string {
  const m = mensagem.toLowerCase();

  if (m.includes("not found") && m.includes("instance")) {
    return "instância não existe na Evolution API — confira o nome cadastrado no canal";
  }
  if (m.includes("connecting") || m.includes("close") || m.includes("disconnect")) {
    return "a instância está desconectada. Se ela não volta pelo QR Code, o número provavelmente caiu — troque o chip e confira se o bot não era o único admin do grupo";
  }
  if (m.includes("unauthorized") || m.includes("forbidden")) {
    return "WHATSAPP_API_KEY recusada pela Evolution API";
  }
  if (m.includes("not-authorized") || m.includes("not a participant")) {
    return "o número não está no grupo — foi removido, ou o JID está errado";
  }
  if (m.includes("rate") || m.includes("too many")) {
    return "a Evolution pediu para desacelerar; a publicação volta para a fila";
  }

  return mensagem;
}

/**
 * A instância está de pé?
 *
 * Serve à tela de atenção, não ao envio. Num sistema em que o número
 * cai por projeto, "está conectada?" é a pergunta operacional do dia,
 * e ela precisa ter resposta sem abrir o painel da Evolution.
 */
export async function instanciaEstaViva(
  instancia: string,
): Promise<{ ok: boolean; estado?: string; motivo?: string }> {
  const cred = credenciais();
  if ("faltando" in cred) return { ok: false, motivo: cred.faltando };

  try {
    const r = await fetch(
      `${cred.base}/instance/connectionState/${encodeURIComponent(instancia)}`,
      { headers: { apikey: cred.chave }, signal: AbortSignal.timeout(10000) },
    );
    const d = await r.json().catch(() => null);
    const estado = String(d?.instance?.state ?? d?.state ?? "");

    return estado === "open"
      ? { ok: true, estado }
      : { ok: false, estado, motivo: traduz(estado || `HTTP ${r.status}`) };
  } catch (erro) {
    return { ok: false, motivo: (erro as Error).message };
  }
}
