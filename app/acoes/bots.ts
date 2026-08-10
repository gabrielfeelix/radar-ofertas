"use server";

import { revalidatePath } from "next/cache";

import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Ações da tela de bots.
 *
 * A validação de WhatsApp repete a constraint do banco de propósito: a
 * constraint impede o dado errado de entrar, e isto aqui diz à pessoa
 * o que faltou, em português, no campo certo. Erro do Postgres na tela
 * é erro que ninguém sabe consertar.
 */

export type ResultadoBot =
  | { ok: true }
  | {
      ok: false;
      campo: "nome" | "identificador" | "instancia" | "aquecimento" | "teto";
      mensagem: string;
    };

export async function salvaBot(
  _anterior: ResultadoBot | null,
  form: FormData,
): Promise<ResultadoBot> {
  const id = String(form.get("bot_id") ?? "").trim();
  const nome = String(form.get("nome") ?? "").trim();
  const plataforma = String(form.get("plataforma") ?? "whatsapp");
  const identificador = String(form.get("identificador") ?? "").trim();
  const instancia = String(form.get("instancia") ?? "").trim();
  const aquecimentoInicio = String(form.get("aquecimento_inicio") ?? "").trim();
  const enviosDiaMax = Number(form.get("envios_dia_max") ?? 150);
  const variavelDoSegredo = String(form.get("variavel_do_segredo") ?? "").trim();
  const observacao = String(form.get("observacao") ?? "").trim();

  const ehWhats = plataforma === "whatsapp";

  if (nome.length < 2) {
    return { ok: false, campo: "nome", mensagem: "Dê um nome ao bot." };
  }
  if (identificador.length < 3) {
    return {
      ok: false,
      campo: "identificador",
      mensagem: ehWhats ? "O número do chip." : "O @ do bot.",
    };
  }
  if (ehWhats && instancia === "") {
    return {
      ok: false,
      campo: "instancia",
      mensagem: "O nome da instância na Evolution. Sem ele o publicador não alcança o chip.",
    };
  }
  if (ehWhats && aquecimentoInicio === "") {
    return {
      ok: false,
      campo: "aquecimento",
      mensagem: "O primeiro dia do chip. É ele que define a rampa dos 14 dias.",
    };
  }
  if (!Number.isFinite(enviosDiaMax) || enviosDiaMax < 1) {
    return { ok: false, campo: "teto", mensagem: "O teto por dia precisa ser pelo menos 1." };
  }

  /*
    Teto acima de 200 é acima do que a D-053 mediu para número maduro.
    Não é impedimento — o dono decide o risco do chip dele — mas o
    formulário não vai fingir que 500 é um número comum.
  */
  if (ehWhats && enviosDiaMax > 200) {
    return {
      ok: false,
      campo: "teto",
      mensagem:
        "Acima de 200 envios/dia é acima do teto de número maduro que a pesquisa mediu. Se for mesmo o que você quer, use 200 e suba depois pelo banco.",
    };
  }

  const db = supabaseServidor();
  const { data: operacao } = await db.from("operacao").select("id").limit(1).single();

  if (!operacao) {
    return { ok: false, campo: "nome", mensagem: "Não encontrei a operação." };
  }

  const dados = {
    operacao_id: operacao.id,
    nome,
    plataforma,
    identificador,
    instancia: ehWhats ? instancia : null,
    aquecimento_inicio: ehWhats ? aquecimentoInicio : null,
    envios_dia_max: enviosDiaMax,
    /*
      O NOME da variável, nunca o valor. Ver o comentário da migration:
      o segredo fora do banco é o que faz uma policy errada, numa
      migration futura, não custar a conta do WhatsApp.
    */
    variavel_do_segredo:
      variavelDoSegredo || (ehWhats ? "WHATSAPP_API_KEY" : "TELEGRAM_BOT_TOKEN"),
    observacao: observacao || null,
  };

  const { error } = id
    ? await db.from("bot").update(dados).eq("id", id)
    : await db.from("bot").insert(dados);

  if (error) {
    return { ok: false, campo: "nome", mensagem: error.message };
  }

  revalidatePath("/bots");
  revalidatePath("/canais");
  return { ok: true };
}

export async function alternaBot(form: FormData): Promise<void> {
  const id = String(form.get("bot_id") ?? "");
  const ativo = String(form.get("ativo") ?? "") === "1";

  const db = supabaseServidor();
  await db.from("bot").update({ ativo: !ativo }).eq("id", id);

  revalidatePath("/bots");
  revalidatePath("/canais");
}

/**
 * O QR Code para reconectar um chip.
 *
 * É a única operação da Evolution que esta tela faz, e existe porque é
 * a única urgente: a sessão cai às 22h de sábado e ninguém quer abrir
 * terminal na VPS. Criar e apagar instância continuam no Manager.
 *
 * Devolve o `base64` que a Evolution manda, que já vem como `data:` e
 * entra direto num `<img>`.
 */
export async function buscaQrCode(
  instancia: string,
): Promise<{ ok: true; imagem: string } | { ok: false; motivo: string }> {
  const base = (process.env.WHATSAPP_API_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.WHATSAPP_API_KEY ?? "";

  if (!base || !chave) {
    return { ok: false, motivo: "falta WHATSAPP_API_URL ou WHATSAPP_API_KEY no ambiente" };
  }
  if (!instancia) {
    return { ok: false, motivo: "este bot não tem instância cadastrada" };
  }

  try {
    const r = await fetch(`${base}/instance/connect/${encodeURIComponent(instancia)}`, {
      headers: { apikey: chave },
      signal: AbortSignal.timeout(15000),
    });

    const d = await r.json().catch(() => null);
    const base64 = String(d?.base64 ?? "");

    if (!base64) {
      return { ok: false, motivo: String(d?.message ?? `HTTP ${r.status}`) };
    }

    // A Evolution às vezes manda o data: já montado, às vezes só o
    // conteúdo. Normalizar aqui evita um `<img>` mudo na tela.
    return {
      ok: true,
      imagem: base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`,
    };
  } catch (erro) {
    return { ok: false, motivo: `não alcancei a Evolution API: ${(erro as Error).message}` };
  }
}
