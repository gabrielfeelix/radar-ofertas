"use server";

import { revalidatePath } from "next/cache";

import {
  cancelaPublicacao,
  desfazEnvio,
  marcaEnviada,
  publicacoesDaFila,
} from "@/lib/simulacao/loja";

/**
 * Ações da fila de publicação.
 *
 * A regra 3.2 do AGENTS.md atravessa este arquivo inteiro: **nada
 * aqui envia no WhatsApp**. O sistema monta o texto e abre o
 * aplicativo; um humano aperta enviar. O que estas ações fazem é
 * registrar que o envio aconteceu.
 *
 * No Telegram é diferente — a API oficial permite postar sozinho, e
 * é o que a ação de lote vai fazer quando existir bot de verdade.
 */

/** Registra o envio feito pelo fluxo — o operador passou pelo botão. */
export async function registraEnvio(form: FormData): Promise<void> {
  const id = String(form.get("publicacao_id") ?? "");
  if (id === "") return;

  const publicacao = publicacoesDaFila().find((p) => p.id === id);
  if (!publicacao) return;

  // Preço morto queima o canal na mesma proporção que preço falso.
  // Se mudou entre a fila e o envio, a ação recusa — a tela já
  // avisa, e isto é a garantia de que avisar não é só decoração.
  if (publicacao.precoAgoraCentavos !== publicacao.precoNaFilaCentavos) return;

  marcaEnviada(id, "fluxo");
  revalidatePath("/publicar");
}

/**
 * Publica no Telegram em lote.
 *
 * Um bloco "12 no Telegram — publicar todas" é um toque, e tira 12
 * itens do caminho do polegar. Não fere a regra do WhatsApp: ela
 * restringe só o WhatsApp, e o Telegram tem API oficial para isso.
 */
export async function publicaLoteTelegram(): Promise<void> {
  for (const publicacao of publicacoesDaFila()) {
    if (publicacao.canal.plataforma !== "telegram") continue;
    if (publicacao.enviadaEm || publicacao.cancelada) continue;
    if (publicacao.precoAgoraCentavos !== publicacao.precoNaFilaCentavos) continue;

    marcaEnviada(publicacao.id, "fluxo");
  }

  revalidatePath("/publicar");
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

  marcaEnviada(id, "auto_declarada");
  revalidatePath("/publicar");
}

export async function desfazEnvioDaPublicacao(form: FormData): Promise<void> {
  desfazEnvio(String(form.get("publicacao_id") ?? ""));
  revalidatePath("/publicar");
}

export async function cancelaEnvio(form: FormData): Promise<void> {
  cancelaPublicacao(String(form.get("publicacao_id") ?? ""));
  revalidatePath("/publicar");
}
