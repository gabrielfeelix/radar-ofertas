"use server";

import { revalidatePath } from "next/cache";

import { buscaOferta, decideOferta, desfazDecisao } from "@/lib/ofertas";
import { usuarioAtual } from "@/lib/sessao";

/**
 * Ações da fila de aprovação.
 *
 * Desde 31/07 elas escrevem no banco: gravam a decisão em `oferta` e,
 * quando é aprovação, criam uma `publicacao` por canal elegível, cada
 * uma com subid próprio. Antes disso mexiam num objeto em memória.
 *
 * **A assinatura não mudou, e a tela não soube.** Era exatamente o que
 * a D-026 prometia quando aceitou a simulação — a tela chama uma ação,
 * e de onde vem o dado é problema da ação.
 */

export async function aprovaOferta(form: FormData): Promise<void> {
  const id = String(form.get("oferta_id") ?? "");
  const oferta = await buscaOferta(id);
  if (!oferta) return;

  // Aprovar é UM ato: a oferta vira publicação em todo canal
  // elegível de uma vez. Aprovar canal por canal não sobrevive a dez
  // canais — é aritmética, não preferência.
  const escolhidos = form
    .getAll("canal_id")
    .map(String)
    .filter((v) => v !== "");
  const elegiveis = oferta.canais.map((c) => c.id);
  const usuario = await usuarioAtual();

  await decideOferta(id, {
    status: "aprovada",
    canais: escolhidos.length > 0 ? escolhidos : elegiveis,
    decididaPor: usuario?.id,
  });

  revalidatePath("/aprovar");
  // A aprovação é o que enche a fila de envio e consome o teto do
  // canal. As duas telas mentiriam até alguém recarregar à mão.
  revalidatePath("/publicar");
  revalidatePath("/canais");
}

export async function rejeitaOferta(form: FormData): Promise<void> {
  const id = String(form.get("oferta_id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();

  // Rejeição sem motivo é proibida: sem o motivo gravado não há como
  // calibrar o motor depois, e o dono vira o próprio gargalo sem
  // saber por quê. O banco também recusa (`oferta_rejeicao_tem_motivo`).
  if (motivo === "") return;

  const usuario = await usuarioAtual();
  await decideOferta(id, { status: "rejeitada", motivo, decididaPor: usuario?.id });
  revalidatePath("/aprovar");
}

export async function adiaOferta(form: FormData): Promise<void> {
  const id = String(form.get("oferta_id") ?? "");
  const usuario = await usuarioAtual();
  await decideOferta(id, { status: "adiada", decididaPor: usuario?.id });
  revalidatePath("/aprovar");
}

/**
 * Desfazer existe porque aprovar é ato interno e reversível — nada
 * saiu para canal nenhum ainda. Publicar, que é externo e
 * irreversível, é que ganha confirmação. O protótipo tinha essa
 * relação invertida.
 *
 * Contra o banco ele ganhou uma ressalva que a simulação não tinha:
 * some com as publicações **pendentes**, nunca com as já enviadas.
 */
export async function desfazDecisaoDaOferta(form: FormData): Promise<void> {
  await desfazDecisao(String(form.get("oferta_id") ?? ""));
  revalidatePath("/aprovar");
  revalidatePath("/publicar");
  revalidatePath("/canais");
}
