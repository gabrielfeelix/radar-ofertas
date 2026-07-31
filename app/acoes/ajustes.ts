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
 * A faixa aceitável de cada limiar, e a unidade em que ela é dita.
 *
 * Existe porque "número maior ou igual a zero" deixava passar os dois
 * extremos que quebram a curadoria em silêncio: **desconto mínimo 0%**
 * carimba tudo — a curadoria vira repasse de oferta alheia, que é
 * exatamente o que este projeto não é — e **desconto mínimo 90%**
 * reprova tudo, e semanas depois alguém conclui que "o radar não acha
 * nada". Nenhum dos dois dá erro; os dois só aparecem no resultado.
 *
 * Os limites são generosos de propósito. Isto não é opinião sobre o
 * valor certo — é o cercado que separa calibragem de engano de digitação.
 */
const FAIXAS: Record<string, { min: number; max: number; unidade: string }> = {
  dias_minimos_de_serie: { min: 3, max: 60, unidade: "dias" },
  dias_para_afirmar: { min: 7, max: 90, unidade: "dias" },
  janela_referencia_dias: { min: 7, max: 180, unidade: "dias" },
  janela_minimo_dias: { min: 14, max: 365, unidade: "dias" },
  desconto_minimo_pct: { min: 5, max: 80, unidade: "%" },
  comissao_minima_centavos: { min: 1, max: 100_000, unidade: "centavos" },
  avaliacao_minima: { min: 0, max: 5, unidade: "de 0 a 5" },
  avaliacao_qtd_minima: { min: 0, max: 1_000, unidade: "avaliações" },
  reputacao_minima: { min: 0, max: 1, unidade: "de 0 a 1" },
  dias_recompra_mesmo_anuncio: { min: 1, max: 365, unidade: "dias" },
  recorrencia_maxima_pct: { min: 5, max: 95, unidade: "%" },
  tolerancia_alta_pct: { min: 0, max: 50, unidade: "%" },
  horas_validade_oferta: { min: 1, max: 720, unidade: "horas" },
  dias_resolucao_diaria: { min: 7, max: 365, unidade: "dias" },
  teto_adiamentos: { min: 0, max: 20, unidade: "vezes" },
};

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

  const faixa = FAIXAS[chave];
  if (faixa && (valor < faixa.min || valor > faixa.max)) {
    return {
      ok: false,
      mensagem: `${valor} está fora da faixa deste limiar: de ${faixa.min} a ${faixa.max} ${faixa.unidade}. Fora dela a curadoria para de decidir — ou aprova tudo, ou não aprova nada, e nos dois casos sem dar erro.`,
    };
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
