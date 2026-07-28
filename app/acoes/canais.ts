"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  alternaCanalAtivo,
  atualizaCanal,
  criaCanal,
  type DadosDoCanal,
  type Plataforma,
} from "@/lib/simulacao/loja";

/**
 * Ações da tela de canais.
 *
 * A validação do split mora aqui, e não na tela: soma acima de 100
 * significaria prometer mais do que a comissão inteira, e um número
 * desses só aparece meses depois, no primeiro repasse, quando já foi
 * combinado com alguém.
 */

export type ResultadoCanal =
  | { ok: true; canalId: string; token: string }
  | { ok: false; campo: "nome" | "nichos" | "split" | "teto"; mensagem: string };

export async function salvaCanal(
  _anterior: ResultadoCanal | null,
  form: FormData,
): Promise<ResultadoCanal> {
  const id = String(form.get("canal_id") ?? "").trim();
  const nome = String(form.get("nome") ?? "").trim();
  const nichos = form.getAll("nicho").map(String).filter((n) => n !== "");
  const tetoDiario = Number(form.get("teto_diario") ?? 0);
  const audiencia = Number(form.get("audiencia") ?? 0);
  const splitAudienciaPct = Number(form.get("split_audiencia") ?? 0);
  const splitOperacaoPct = Number(form.get("split_operacao") ?? 0);

  if (nome.length < 2) {
    return { ok: false, campo: "nome", mensagem: "Dê um nome ao canal." };
  }

  // Canal sem nicho não recebe oferta nenhuma e fica no painel
  // parecendo que funciona. É o mesmo erro do produto sem nicho, do
  // outro lado do roteamento.
  if (nichos.length === 0) {
    return {
      ok: false,
      campo: "nichos",
      mensagem: "Escolha pelo menos um nicho, senão nenhuma oferta chega aqui.",
    };
  }

  if (!Number.isInteger(tetoDiario) || tetoDiario < 1 || tetoDiario > 50) {
    return {
      ok: false,
      campo: "teto",
      mensagem: "O teto diário precisa ser um número de 1 a 50.",
    };
  }

  if (splitAudienciaPct < 0 || splitOperacaoPct < 0) {
    return { ok: false, campo: "split", mensagem: "Percentual negativo não existe." };
  }

  if (splitAudienciaPct + splitOperacaoPct > 100) {
    return {
      ok: false,
      campo: "split",
      mensagem: `As duas parcelas somam ${splitAudienciaPct + splitOperacaoPct}%. Não sobra nada para a operação, e o que passa de 100% é dinheiro que não existe.`,
    };
  }

  const dados: DadosDoCanal = {
    nome,
    plataforma: String(form.get("plataforma") ?? "whatsapp") as Plataforma,
    nichos,
    tetoDiario,
    audiencia: Number.isFinite(audiencia) ? Math.max(0, audiencia) : 0,
    parceiro: String(form.get("parceiro") ?? "").trim() || "você",
    operador: String(form.get("operador") ?? "").trim() || "você",
    splitAudienciaPct,
    splitOperacaoPct,
    horarios: String(form.get("horarios") ?? "").trim(),
  };

  if (id === "") {
    const novoId = criaCanal(dados);
    revalidatePath("/canais");
    revalidatePath("/aprovar");
    return { ok: true, canalId: novoId, token: crypto.randomUUID() };
  }

  atualizaCanal(id, dados);
  revalidatePath("/canais");
  revalidatePath(`/canais/${id}`);
  revalidatePath("/aprovar");
  return { ok: true, canalId: id, token: crypto.randomUUID() };
}

/**
 * Ligar e desligar.
 *
 * Desligar tem efeito imediato na elegibilidade e **não apaga nada**:
 * o histórico do canal continua existindo, porque é ele que sustenta
 * a prestação de contas ao parceiro depois.
 */
export async function alternaCanal(form: FormData): Promise<void> {
  const id = String(form.get("canal_id") ?? "");
  if (id === "") return;

  alternaCanalAtivo(id, String(form.get("ativo") ?? "") === "true");

  revalidatePath("/canais");
  revalidatePath(`/canais/${id}`);
  revalidatePath("/aprovar");
}

export async function abreCanal(form: FormData): Promise<void> {
  redirect(`/canais/${String(form.get("canal_id") ?? "")}`);
}
