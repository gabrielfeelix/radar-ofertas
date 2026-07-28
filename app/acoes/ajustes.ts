"use server";

import { revalidatePath } from "next/cache";

import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Ações dos ajustes de curadoria e de nicho.
 *
 * O que atravessa este arquivo inteiro: **alterar limiar não
 * reprocessa oferta já decidida.** Vale da próxima detecção em diante.
 * Reprocessar o passado mudaria a história de decisões que já foram
 * publicadas, e é justamente o histórico que permite calibrar depois.
 */

export type ResultadoAjuste =
  | { ok: true; token: string }
  | { ok: false; mensagem: string };

/**
 * Salva um limiar, global ou de um nicho.
 *
 * `nicho_id` nulo é o valor global; com nicho, é o que sobrescreve
 * para aquele nicho. Vinte por cento de desconto em ração é oferta
 * excelente; vinte por cento em eletrônico é terça-feira comum — um
 * limiar único ou reprova tudo de um lado ou carimba tudo do outro
 * (D-023).
 */
export async function salvaLimiar(
  _anterior: ResultadoAjuste | null,
  form: FormData,
): Promise<ResultadoAjuste> {
  const chave = String(form.get("chave") ?? "").trim();
  const nichoId = String(form.get("nicho_id") ?? "").trim();
  const bruto = String(form.get("valor") ?? "").trim().replace(",", ".");

  if (chave === "") return { ok: false, mensagem: "Limiar sem chave." };

  const valor = Number(bruto);
  if (!Number.isFinite(valor) || valor < 0) {
    return { ok: false, mensagem: "Valor precisa ser um número igual ou maior que zero." };
  }

  const db = supabaseServidor();

  const { data: operacao } = await db.from("nicho").select("operacao_id").limit(1).maybeSingle();
  if (!operacao) return { ok: false, mensagem: "Operação não encontrada." };

  const { error } = await db.from("parametro").upsert(
    {
      operacao_id: operacao.operacao_id,
      chave,
      nicho_id: nichoId === "" ? null : nichoId,
      valor,
    },
    { onConflict: "operacao_id,chave,nicho_id" },
  );

  if (error) return { ok: false, mensagem: `Não consegui salvar: ${error.message}` };

  revalidatePath("/ajustes/curadoria");
  revalidatePath("/ajustes/nichos");
  return { ok: true, token: crypto.randomUUID() };
}

/**
 * Apaga a exceção de um nicho, devolvendo-o ao valor global.
 *
 * Apagar a exceção é diferente de igualá-la ao global: o nicho volta a
 * **acompanhar** o global, e muda junto quando o global mudar.
 */
export async function removeExcecao(form: FormData): Promise<void> {
  const chave = String(form.get("chave") ?? "");
  const nichoId = String(form.get("nicho_id") ?? "");

  if (chave === "" || nichoId === "") return;

  await supabaseServidor().from("parametro").delete().eq("chave", chave).eq("nicho_id", nichoId);

  revalidatePath("/ajustes/curadoria");
  revalidatePath("/ajustes/nichos");
}

export type ResultadoNicho =
  | { ok: true; token: string }
  | { ok: false; mensagem: string };

export async function criaNicho(
  _anterior: ResultadoNicho | null,
  form: FormData,
): Promise<ResultadoNicho> {
  const nome = String(form.get("nome") ?? "").trim();
  if (nome.length < 2) return { ok: false, mensagem: "Escreva o nome do nicho." };

  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const db = supabaseServidor();
  const { data: operacao } = await db.from("nicho").select("operacao_id").limit(1).maybeSingle();
  if (!operacao) return { ok: false, mensagem: "Operação não encontrada." };

  const { error } = await db
    .from("nicho")
    .insert({ operacao_id: operacao.operacao_id, nome, slug });

  if (error) {
    return {
      ok: false,
      mensagem: error.code === "23505" ? "Já existe um nicho com esse nome." : error.message,
    };
  }

  revalidatePath("/ajustes/nichos");
  revalidatePath("/produtos");
  return { ok: true, token: crypto.randomUUID() };
}

export async function renomeiaNicho(form: FormData): Promise<void> {
  const id = String(form.get("nicho_id") ?? "");
  const nome = String(form.get("nome") ?? "").trim();

  if (id === "" || nome.length < 2) return;

  await supabaseServidor().from("nicho").update({ nome }).eq("id", id);

  revalidatePath("/ajustes/nichos");
  revalidatePath("/produtos");
}

/**
 * Liga e desliga um nicho.
 *
 * **Nunca apaga.** Nicho com produto vinculado que fosse apagado
 * levaria junto o roteamento de todo o histórico — e os limiares dele,
 * por cascata. Desativar tira das listas e mantém a história.
 */
export async function alternaNichoAtivo(form: FormData): Promise<void> {
  const id = String(form.get("nicho_id") ?? "");
  const ativo = String(form.get("ativo") ?? "") === "true";

  if (id === "") return;

  await supabaseServidor().from("nicho").update({ ativo }).eq("id", id);

  revalidatePath("/ajustes/nichos");
  revalidatePath("/produtos");
}
