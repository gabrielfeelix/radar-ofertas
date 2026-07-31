"use server";

import { revalidatePath } from "next/cache";

import {
  buscaPublicacao,
  cancelaPublicacao,
  desfazCancelamento,
  desfazEnvio,
  devolveParaAprovacao,
  marcaEnviada,
  publicacoesDaFila,
  vagasDoCanal,
} from "@/lib/publicacoes";
import { usuarioAtual } from "@/lib/sessao";

/**
 * Ações da fila de publicação.
 *
 * A regra 3.2 do AGENTS.md atravessa este arquivo inteiro: **nada
 * aqui envia no WhatsApp**. O sistema monta o texto e abre o
 * aplicativo; um humano aperta enviar. O que estas ações fazem é
 * registrar que o envio aconteceu.
 *
 * No Telegram é diferente — a API oficial permite postar sozinho, e
 * é o que a ação de lote vai fazer quando existir bot de verdade. Hoje
 * ela também só registra: publicar de verdade é Fase 2.
 *
 * Desde 31/07 o registro é no banco, em `publicacao`.
 */

/** Registra o envio feito pelo fluxo — o operador passou pelo botão. */
export async function registraEnvio(form: FormData): Promise<void> {
  const id = String(form.get("publicacao_id") ?? "");
  if (id === "") return;

  const publicacao = await buscaPublicacao(id);
  if (!publicacao) return;

  // Preço morto queima o canal na mesma proporção que preço falso.
  // Se mudou entre a fila e o envio, a ação recusa — a tela já
  // avisa, e isto é a garantia de que avisar não é só decoração.
  if (publicacao.precoAgoraCentavos !== publicacao.precoNaFilaCentavos) return;

  // Teto é limite real, não sugestão.
  if ((await vagasDoCanal(publicacao.canal.id)) <= 0) return;

  const usuario = await usuarioAtual();
  await marcaEnviada(id, "fluxo", undefined, usuario?.id);
  revalidatePath("/publicar");
  revalidatePath("/canais");
}

/**
 * Publica no Telegram em lote.
 *
 * Um bloco "12 no Telegram — publicar todas" é um toque, e tira 12
 * itens do caminho do polegar. Não fere a regra do WhatsApp: ela
 * restringe só o WhatsApp, e o Telegram tem API oficial para isso.
 */
export async function publicaLoteTelegram(form: FormData): Promise<void> {
  const canalAlvo = String(form.get("canal_id") ?? "");
  const usuario = await usuarioAtual();

  // O teto é recontado a cada item, e não lido uma vez antes do laço:
  // cada envio consome uma vaga, e um teto lido de véspera deixaria o
  // botão que existe para poupar toque ser justamente o que estoura o
  // combinado com o parceiro.
  for (const publicacao of await publicacoesDaFila()) {
    if (publicacao.canal.plataforma !== "telegram") continue;
    if (canalAlvo !== "" && publicacao.canal.id !== canalAlvo) continue;
    if (publicacao.enviadaEm || publicacao.cancelada) continue;
    if (publicacao.precoAgoraCentavos !== publicacao.precoNaFilaCentavos) continue;
    if ((await vagasDoCanal(publicacao.canal.id)) <= 0) continue;

    await marcaEnviada(publicacao.id, "fluxo", undefined, usuario?.id);
  }

  revalidatePath("/publicar");
  revalidatePath("/canais");
}

/**
 * "Já enviei" — envio que aconteceu fora do fluxo.
 *
 * Fica no menu secundário de propósito. Sendo o atalho mais barato
 * da tela, ele silencia o único sinal de supervisão sobre operador
 * remoto: a origem fica gravada separada, e publicação auto-declarada
 * sem nenhum clique em 24 horas vira item em "Precisa de atenção".
 * Não é prova, é o sinal certo no lugar certo.
 */
export async function registraEnvioAutoDeclarado(form: FormData): Promise<void> {
  const id = String(form.get("publicacao_id") ?? "");
  if (id === "") return;

  const usuario = await usuarioAtual();
  await marcaEnviada(id, "auto_declarada", undefined, usuario?.id);
  revalidatePath("/publicar");
  revalidatePath("/canais");
}

export async function desfazEnvioDaPublicacao(form: FormData): Promise<void> {
  await desfazEnvio(String(form.get("publicacao_id") ?? ""));
  revalidatePath("/publicar");
  revalidatePath("/canais");
}

export async function cancelaEnvio(form: FormData): Promise<void> {
  await cancelaPublicacao(String(form.get("publicacao_id") ?? ""));
  revalidatePath("/publicar");
}

/** Cancelar também tem volta: é decisão interna, nada saiu daqui. */
export async function desfazCancelamentoDaPublicacao(form: FormData): Promise<void> {
  await desfazCancelamento(String(form.get("publicacao_id") ?? ""));
  revalidatePath("/publicar");
}

/**
 * Devolve para a aprovação a publicação travada por preço.
 *
 * A tela dizia que o item "voltou para a fila de aprovação" e nada
 * voltava — ele ficava travado para sempre, e o operador não tem como
 * resolver, porque não é dele a decisão de curadoria. Agora volta de
 * verdade, e volta com o preço de agora, que é sobre o que a decisão
 * nova precisa acontecer.
 */
export async function devolveOfertaParaAprovacao(form: FormData): Promise<void> {
  const ofertaId = String(form.get("oferta_id") ?? "");
  if (ofertaId === "") return;

  await devolveParaAprovacao(ofertaId);

  revalidatePath("/publicar");
  revalidatePath("/aprovar");
}
