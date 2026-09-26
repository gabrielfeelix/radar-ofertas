"use server";

import { revalidatePath } from "next/cache";

import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Cadastro de parceiro e da conta de afiliado dele (D-074).
 *
 * O ID da Shopee é conferido pelo formato, e não é zelo: é um número
 * de uns 11 dígitos, e um dígito a menos não dá erro em lugar nenhum. O
 * link sai, a pessoa compra, e a comissão vai para uma conta que não
 * existe. Só se descobre no extrato.
 */

export type ResultadoParceiro =
  | { ok: true }
  | { ok: false; campo: "nome" | "shopee" | "amazon"; mensagem: string };

export async function salvaParceiro(
  _anterior: ResultadoParceiro | null,
  form: FormData,
): Promise<ResultadoParceiro> {
  const id = String(form.get("parceiro_id") ?? "").trim();
  const nome = String(form.get("nome") ?? "").trim();
  const contato = String(form.get("contato") ?? "").trim();
  const shopee = String(form.get("afiliado_shopee") ?? "").replace(/\s/g, "");
  const amazon = String(form.get("afiliado_amazon") ?? "").trim();

  if (nome.length < 2) {
    return { ok: false, campo: "nome", mensagem: "O nome do parceiro." };
  }
  if (shopee && !/^\d{8,15}$/.test(shopee)) {
    return {
      ok: false,
      campo: "shopee",
      mensagem:
        "O ID de afiliado da Shopee é só número, com uns 11 dígitos (ex.: 18373711182). Ele aparece no canto do painel de afiliado.",
    };
  }
  if (amazon && !/^[a-z0-9-]+-2\d$/i.test(amazon)) {
    return {
      ok: false,
      campo: "amazon",
      mensagem: "A tag de associado da Amazon termina em -20 ou -21 (ex.: nome0a-20).",
    };
  }

  const db = supabaseServidor();
  const { data: operacao } = await db.from("nicho").select("operacao_id").limit(1).maybeSingle();
  if (!operacao) return { ok: false, campo: "nome", mensagem: "Não achei a operação no banco." };

  let parceiroId = id;
  if (id) {
    const { error } = await db
      .from("parceiro")
      .update({ nome, contato: contato || null })
      .eq("id", id);
    if (error) return { ok: false, campo: "nome", mensagem: "Não consegui salvar no banco." };
  } else {
    const { data, error } = await db
      .from("parceiro")
      .insert({ operacao_id: operacao.operacao_id, nome, contato: contato || null, tipo: "amigo" })
      .select("id")
      .single();
    if (error || !data) return { ok: false, campo: "nome", mensagem: "Não consegui salvar no banco." };
    parceiroId = data.id;
  }

  const { data: lojas } = await db
    .from("marketplace")
    .select("id, slug")
    .in("slug", ["shopee", "amazon"]);

  for (const [slug, valor] of [
    ["shopee", shopee],
    ["amazon", amazon],
  ] as const) {
    const loja = (lojas ?? []).find((l) => l.slug === slug);
    if (!loja) continue;

    // Campo vazio APAGA a conta daquela loja: o grupo dele para de
    // receber oferta dela, em vez de passar a sair com o ID do dono.
    if (!valor) {
      await db
        .from("parceiro_afiliado")
        .delete()
        .eq("parceiro_id", parceiroId)
        .eq("marketplace_id", loja.id);
      continue;
    }
    const { error } = await db.from("parceiro_afiliado").upsert(
      {
        operacao_id: operacao.operacao_id,
        parceiro_id: parceiroId,
        marketplace_id: loja.id,
        afiliado_id: valor,
      },
      { onConflict: "parceiro_id,marketplace_id" },
    );
    if (error) {
      return {
        ok: false,
        campo: slug,
        mensagem: `Não consegui gravar a conta da ${slug}: ${error.message}`,
      };
    }
  }

  revalidatePath("/parceiros");
  revalidatePath("/canais");
  return { ok: true };
}
