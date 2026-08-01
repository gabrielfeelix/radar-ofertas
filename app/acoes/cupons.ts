"use server";

import { revalidatePath } from "next/cache";

import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Ações do cadastro de cupom.
 *
 * Cupom é digitado à mão porque **nenhum marketplace expõe cupom por
 * API** — conferido em 31/07/2026: no Mercado Livre os endpoints
 * `coupons`, `deals` e `marketplace/coupons` devolvem 404, e não é
 * permissão, é ausência.
 *
 * O que se automatiza é a **validade**: a data vence e o cupom sai das
 * mensagens sozinho. O que NÃO se automatiza é o esgotamento — cupom
 * que acaba antes da data só se descobre usando, e por isso existe o
 * botão de marcar esgotado, que mata na hora.
 */

function centavos(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(Number(limpo || 0) * 100);
}

export async function criaCupom(form: FormData): Promise<void> {
  const db = supabaseServidor();

  const codigo = String(form.get("codigo") ?? "").trim().toUpperCase();
  const marketplaceId = String(form.get("marketplace_id") ?? "");
  const tipo = String(form.get("tipo") ?? "percentual") === "valor" ? "valor" : "percentual";
  const valorBruto = String(form.get("valor") ?? "").trim();
  const nichoId = String(form.get("nicho_id") ?? "");
  const vigenteAte = String(form.get("vigente_ate") ?? "").trim();

  // Sem código não há cupom, e sem loja não há onde ele valer.
  if (codigo === "" || marketplaceId === "") return;

  const valor = tipo === "percentual" ? Math.round(Number(valorBruto || 0)) : centavos(valorBruto);
  if (valor <= 0) return;

  const { data: operacao } = await db.from("operacao").select("id").limit(1).maybeSingle();
  if (!operacao) return;

  await db.from("cupom").insert({
    operacao_id: operacao.id,
    marketplace_id: marketplaceId,
    nicho_id: nichoId === "" ? null : nichoId,
    codigo,
    descricao: String(form.get("descricao") ?? "").trim() || null,
    tipo,
    valor,
    valor_minimo_centavos: centavos(String(form.get("valor_minimo") ?? "")),
    teto_desconto_centavos: (() => {
      const t = centavos(String(form.get("teto") ?? ""));
      return t > 0 ? t : null;
    })(),
    // O fuso: a pessoa digita a data em São Paulo, e o banco guarda em
    // UTC (regra 3.9). O `-03:00` é explícito para não depender do fuso
    // de quem roda o servidor.
    vigente_ate: vigenteAte === "" ? null : `${vigenteAte}T23:59:59-03:00`,
  });

  revalidatePath("/ajustes/cupons");
  revalidatePath("/publicar");
}

/**
 * Marca o cupom como esgotado.
 *
 * Separado de desativar de propósito: esgotado é **fato observado** — o
 * cupom acabou antes da data que a loja prometeu. Desativado é decisão
 * nossa. Confundir os dois apagaria o único sinal de que a loja promete
 * prazo e não cumpre.
 */
export async function marcaEsgotado(form: FormData): Promise<void> {
  const db = supabaseServidor();
  await db
    .from("cupom")
    .update({ esgotado_em: new Date().toISOString() })
    .eq("id", String(form.get("cupom_id") ?? ""));

  revalidatePath("/ajustes/cupons");
  revalidatePath("/publicar");
}

export async function desfazEsgotado(form: FormData): Promise<void> {
  const db = supabaseServidor();
  await db
    .from("cupom")
    .update({ esgotado_em: null })
    .eq("id", String(form.get("cupom_id") ?? ""));

  revalidatePath("/ajustes/cupons");
}

export async function alternaCupomAtivo(form: FormData): Promise<void> {
  const db = supabaseServidor();
  await db
    .from("cupom")
    .update({ ativo: String(form.get("ativo") ?? "") === "sim" })
    .eq("id", String(form.get("cupom_id") ?? ""));

  revalidatePath("/ajustes/cupons");
  revalidatePath("/publicar");
}
