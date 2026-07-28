"use server";

import { revalidatePath } from "next/cache";

import { canaisElegiveis, buscaOferta, decideOferta, desfazDecisao } from "@/lib/simulacao/loja";

/**
 * Ações da fila de aprovação.
 *
 * Enquanto a operação é simulada, elas mexem na memória do servidor.
 * Quando o motor tiver série real, o corpo destas funções passa a
 * escrever em `oferta` e a gerar `publicacao` por canal elegível — a
 * assinatura e a tela não mudam. É por isso que a tela nunca fala
 * com a simulação direto.
 */

export async function aprovaOferta(form: FormData): Promise<void> {
  const id = String(form.get("oferta_id") ?? "");
  const oferta = buscaOferta(id);
  if (!oferta) return;

  // Aprovar é UM ato: a oferta vira publicação em todo canal
  // elegível de uma vez. Aprovar canal por canal não sobrevive a dez
  // canais — é aritmética, não preferência.
  const escolhidos = form.getAll("canal_id").map(String).filter((v) => v !== "");
  const elegiveis = canaisElegiveis(oferta.nicho).map((c) => c.id);

  decideOferta(id, {
    status: "aprovada",
    canais: escolhidos.length > 0 ? escolhidos : elegiveis,
  });

  revalidatePath("/aprovar");
}

export async function rejeitaOferta(form: FormData): Promise<void> {
  const id = String(form.get("oferta_id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();

  // Rejeição sem motivo é proibida: sem o motivo gravado não há como
  // calibrar o motor depois, e o dono vira o próprio gargalo sem
  // saber por quê.
  if (motivo === "") return;

  decideOferta(id, { status: "rejeitada", motivo });
  revalidatePath("/aprovar");
}

export async function adiaOferta(form: FormData): Promise<void> {
  const id = String(form.get("oferta_id") ?? "");
  decideOferta(id, { status: "adiada" });
  revalidatePath("/aprovar");
}

/**
 * Desfazer existe porque aprovar é ato interno e reversível — nada
 * saiu para canal nenhum ainda. Publicar, que é externo e
 * irreversível, é que ganha confirmação. O protótipo tinha essa
 * relação invertida.
 */
export async function desfazDecisaoDaOferta(form: FormData): Promise<void> {
  desfazDecisao(String(form.get("oferta_id") ?? ""));
  revalidatePath("/aprovar");
}
