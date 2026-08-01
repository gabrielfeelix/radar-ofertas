import "server-only";

/**
 * Publicação no Telegram, pela Bot API oficial.
 *
 * **Esta é a única superfície que o sistema publica sozinho**, e isso
 * é regra dura: a 3.2 do `AGENTS.md` proíbe automatizar o WhatsApp em
 * qualquer forma — nada de biblioteca não oficial, QR Code ou
 * WhatsApp Web simulado —, porque isso derruba o número, que é o ativo
 * do parceiro. O Telegram tem API oficial para postar, e por isso
 * pode.
 *
 * O QUE VAI PARA O CANAL É O QUE FICA GRAVADO. A mensagem enviada é
 * guardada em `publicacao.mensagem` como saiu, e não remontada depois:
 * o modelo muda, e o que foi ao grupo é o que precisa ser auditável —
 * inclusive para provar a identificação publicitária da regra 3.10.
 *
 * FALHA NUNCA É SILENCIOSA. Erro de envio devolve o motivo para quem
 * chamou, que devolve a publicação para pendente. Bot que falha calado
 * é pior que bot nenhum: a fila esvazia na tela e o canal fica mudo.
 */

const API = "https://api.telegram.org";

export type ResultadoDoEnvio =
  | { ok: true; messageId: number }
  | { ok: false; motivo: string; configuracao?: boolean };

/**
 * Limite da legenda de foto no Telegram. Texto solto aceita 4096, mas
 * foto com legenda para em 1024 — e a diferença não dá erro bonito:
 * a API recusa a mensagem inteira.
 */
const LIMITE_DA_LEGENDA = 1024;

/**
 * Manda a mensagem COM a foto do produto.
 *
 * Foto não é enfeite: todo canal de oferta que funciona publica com
 * imagem, e post sem foto passa despercebido na rolagem. Foi o que o
 * dono apontou comparando com os concorrentes.
 *
 * **O que vai é o LINK da imagem, e o Telegram baixa** — o sistema
 * nunca guarda o arquivo (regra 3.3). Quando não há foto, cai para
 * texto puro em vez de não publicar.
 *
 * Legenda que passa de 1024 caracteres derruba a mensagem inteira na
 * API. Nesse caso vai a foto com o começo e o texto completo logo
 * abaixo, em vez de perder o post.
 */
export async function publicaComFoto(
  chatId: string,
  texto: string,
  fotoUrl: string | null,
): Promise<ResultadoDoEnvio> {
  if (!fotoUrl) return publicaNoTelegram(chatId, texto);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, configuracao: true, motivo: "falta TELEGRAM_BOT_TOKEN" };
  }

  const cabe = texto.length <= LIMITE_DA_LEGENDA;

  try {
    const r = await fetch(`${API}/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: fotoUrl,
        caption: cabe ? texto : texto.slice(0, LIMITE_DA_LEGENDA - 1),
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(25000),
    });

    const d = await r.json().catch(() => null);

    // Foto que a loja recusa servir não pode custar a publicação: cai
    // para texto, que ainda vende.
    if (!r.ok || !d?.ok) {
      const motivo = String(d?.description ?? "");
      if (/photo|wrong file identifier|failed to get http url/i.test(motivo)) {
        return publicaNoTelegram(chatId, texto);
      }
      return { ok: false, motivo: traduz(motivo || `HTTP ${r.status}`) };
    }

    if (!cabe) await publicaNoTelegram(chatId, texto);
    return { ok: true, messageId: d.result.message_id };
  } catch (erro) {
    return { ok: false, motivo: `não alcancei o Telegram: ${(erro as Error).message}` };
  }
}

/**
 * Manda a mensagem para o canal.
 *
 * `chatId` aceita `@nomedocanal` para canal público, ou o id numérico
 * (`-100...`) para privado.
 */
export async function publicaNoTelegram(
  chatId: string,
  texto: string,
): Promise<ResultadoDoEnvio> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return {
      ok: false,
      configuracao: true,
      motivo: "falta TELEGRAM_BOT_TOKEN — crie o bot no @BotFather",
    };
  }
  if (!chatId) {
    return {
      ok: false,
      configuracao: true,
      motivo: "o canal não tem identificador do Telegram cadastrado",
    };
  }

  try {
    const r = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: "HTML",
        // A prévia do link ocupa metade da tela do celular e empurra a
        // oferta seguinte para fora. Num canal que publica dezenas por
        // dia, é a diferença entre rolar e desistir.
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(20000),
    });

    const d = await r.json().catch(() => null);

    if (!r.ok || !d?.ok) {
      const descricao = d?.description ?? `HTTP ${r.status}`;
      return { ok: false, motivo: traduz(descricao) };
    }

    return { ok: true, messageId: d.result.message_id };
  } catch (erro) {
    return { ok: false, motivo: `não alcancei o Telegram: ${(erro as Error).message}` };
  }
}

/**
 * Os erros que vão acontecer de verdade, em português.
 *
 * Não é enfeite: o operador que vê "Bad Request: chat not found" abre
 * um chamado. Quem vê "o bot não é administrador do canal" resolve em
 * trinta segundos, que é o tempo que a correção leva.
 */
function traduz(descricao: string): string {
  const d = descricao.toLowerCase();

  if (d.includes("chat not found")) {
    return "canal não encontrado — confira o identificador, e lembre que o bot precisa ser administrador dele";
  }
  if (d.includes("not enough rights") || d.includes("need administrator")) {
    return "o bot não tem permissão de publicar — adicione como administrador do canal, com “Publicar mensagens” ligado";
  }
  if (d.includes("bot was blocked") || d.includes("bot was kicked")) {
    return "o bot foi removido do canal";
  }
  if (d.includes("unauthorized")) {
    return "token do bot inválido — foi revogado no @BotFather?";
  }
  if (d.includes("too many requests") || d.includes("retry after")) {
    return "o Telegram pediu para desacelerar; a publicação volta para a fila";
  }
  if (d.includes("message is too long")) {
    return "a mensagem passou do limite do Telegram — encurte o modelo";
  }

  return descricao;
}

/** Confere se o bot está de pé. Serve à tela de atenção, não ao envio. */
export async function botEstaVivo(): Promise<{ ok: boolean; usuario?: string; motivo?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, motivo: "sem TELEGRAM_BOT_TOKEN" };

  try {
    const r = await fetch(`${API}/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    return d?.ok
      ? { ok: true, usuario: d.result.username }
      : { ok: false, motivo: d?.description ?? "não respondeu" };
  } catch (erro) {
    return { ok: false, motivo: (erro as Error).message };
  }
}
