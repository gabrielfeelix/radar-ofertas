"use server";

import { revalidatePath } from "next/cache";

import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Ações da tela de marketplaces.
 *
 * A regra que atravessa este arquivo: **o identificador de afiliado é
 * dinheiro.** Ele entra por aqui e nunca sai — nenhuma ação devolve o
 * valor, e a tela nunca o exibe. Se vazar, outra pessoa usa os nossos
 * links e recebe a comissão.
 */

export type ResultadoLoja = { ok: true; token: string } | { ok: false; mensagem: string };

export async function alternaMarketplace(form: FormData): Promise<void> {
  const id = String(form.get("marketplace_id") ?? "");
  const ativo = String(form.get("ativo") ?? "") === "true";

  if (id === "") return;

  await supabaseServidor().from("marketplace").update({ ativo }).eq("id", id);

  revalidatePath("/ajustes/marketplaces");
  revalidatePath("/atencao");
}

/**
 * Grava o identificador de afiliado.
 *
 * Campo de escrita apenas: a tela mostra "configurado" ou "faltando",
 * nunca o valor. Guardar no banco, e não no `.env`, é o que permite
 * uma loja nova entrar sem novo deploy — e o que faz a tela de atenção
 * saber que ela está sem credencial.
 */
export async function defineAfiliado(
  _anterior: ResultadoLoja | null,
  form: FormData,
): Promise<ResultadoLoja> {
  const id = String(form.get("marketplace_id") ?? "");
  const valor = String(form.get("afiliado_id") ?? "").trim();

  if (id === "") return { ok: false, mensagem: "Loja não informada." };
  if (valor.length < 3) {
    return { ok: false, mensagem: "Identificador curto demais — confira antes de salvar." };
  }

  const { error } = await supabaseServidor()
    .from("marketplace")
    .update({ afiliado_id: valor })
    .eq("id", id);

  if (error) return { ok: false, mensagem: `Não consegui salvar: ${error.message}` };

  revalidatePath("/ajustes/marketplaces");
  revalidatePath("/atencao");
  revalidatePath("/arranque");
  return { ok: true, token: crypto.randomUUID() };
}

/**
 * Configurações de coleta da loja.
 *
 * O limite de retenção de preço é **por loja**, não regra fixa no
 * código: é o que faz a Amazon ser tratada diferente sem espalhar
 * exceção pelo sistema todo.
 */
export async function salvaConfiguracaoDaLoja(form: FormData): Promise<void> {
  const id = String(form.get("marketplace_id") ?? "");
  if (id === "") return;

  const horas = Number(String(form.get("cache_horas") ?? "").trim());
  const comissao = String(form.get("comissao_padrao") ?? "").trim().replace(",", ".");

  const mudancas: { cache_preco_max_horas?: number; comissao_padrao_pct: number | null } = {
    comissao_padrao_pct: null,
  };

  if (Number.isFinite(horas) && horas > 0) mudancas.cache_preco_max_horas = Math.round(horas);

  // Vazio significa "não configurada", que é diferente de zero: zero
  // reprovaria toda oferta da loja por comissão baixa, e nulo faz o
  // motor dizer "comissão não configurada", que é o diagnóstico certo.
  const percentual = Number(comissao);
  mudancas.comissao_padrao_pct =
    comissao === "" || !Number.isFinite(percentual) ? null : percentual;

  await supabaseServidor().from("marketplace").update(mudancas).eq("id", id);

  revalidatePath("/ajustes/marketplaces");
  revalidatePath("/atencao");
}

/**
 * Novo percentual de comissão para um nicho nesta loja.
 *
 * Não altera a linha vigente: encerra ela hoje e cria outra. Comissão
 * de venda antiga foi calculada pelo percentual daquela época, e
 * reescrever o passado faria a conferência do relatório da loja não
 * bater — sem que ninguém entendesse por quê.
 */
export async function salvaComissao(form: FormData): Promise<void> {
  const marketplaceId = String(form.get("marketplace_id") ?? "");
  const nichoId = String(form.get("nicho_id") ?? "");
  const bruto = String(form.get("percentual") ?? "").trim().replace(",", ".");

  if (marketplaceId === "" || nichoId === "") return;

  const percentual = Number(bruto);
  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) return;

  const db = supabaseServidor();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: loja } = await db
    .from("marketplace")
    .select("operacao_id")
    .eq("id", marketplaceId)
    .maybeSingle();

  if (!loja) return;

  await db
    .from("comissao_categoria")
    .update({ vigente_ate: hoje })
    .eq("marketplace_id", marketplaceId)
    .eq("nicho_id", nichoId)
    .is("vigente_ate", null);

  await db.from("comissao_categoria").insert({
    operacao_id: loja.operacao_id,
    marketplace_id: marketplaceId,
    nicho_id: nichoId,
    percentual,
    vigente_desde: hoje,
  });

  revalidatePath("/ajustes/marketplaces");
  revalidatePath("/atencao");
}
