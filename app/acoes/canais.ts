"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  alternaCanalAtivo,
  atualizaCanal,
  criaCanal,
  type DadosDoCanal,
  type Plataforma,
} from "@/lib/distribuicao";
import { HORARIOS_SUGERIDOS, leHorarios } from "@/lib/horarios";

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
  | {
      ok: false;
      campo: "nome" | "nichos" | "split" | "teto" | "horarios" | "telegram";
      mensagem: string;
    };

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
  const plataforma = String(form.get("plataforma") ?? "whatsapp") as Plataforma;
  // O `@` é opcional para quem digita e obrigatório para o Telegram.
  const chatBruto = String(form.get("telegram_chat_id") ?? "").trim();
  const telegramChatId =
    chatBruto === "" || chatBruto.startsWith("@") || chatBruto.startsWith("-")
      ? chatBruto
      : `@${chatBruto}`;

  // O grupo do WhatsApp e o chip que fala por ele (D-071). O JID vem
  // do painel da Evolution; não tem formato para adivinhar, então vai
  // como a pessoa colou, só sem espaço.
  const whatsappGrupoId = String(form.get("whatsapp_grupo_id") ?? "").trim();
  // Qual bot publica aqui. Vazio é permitido: canal sem bot fica
  // parado, e o publicador diz isso no log da rodada.
  const botId = String(form.get("bot_id") ?? "").trim();

  if (nome.length < 2) {
    return { ok: false, campo: "nome", mensagem: "Dê um nome ao canal." };
  }

  // O banco recusa canal de Telegram sem identificador, e recusar aqui
  // é melhor: o erro do banco chega como "não consegui salvar", que
  // não diz o que fazer.
  if (plataforma === "telegram" && telegramChatId === "") {
    return {
      ok: false,
      campo: "telegram",
      mensagem:
        "Diga qual é o canal no Telegram (@radarpet). É para onde o bot publica — sem ele não há como enviar.",
    };
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

  // O campo de horário é texto livre de propósito — "07:30, 12:30 e
  // 20:00" é como uma pessoa escreve, e `leHorarios` extrai o que
  // reconhece. O buraco estava no que ela NÃO reconhece: "9h", "25:00"
  // ou um dedo escorregado devolvem lista vazia, e o canal salvava
  // quieto sem horário nenhum — que é um canal que nunca publica,
  // parecendo configurado. Falha silenciosa, do tipo que a tela
  // "Precisa de atenção" existe para combater.
  const horariosBrutos = String(form.get("horarios") ?? "").trim();
  if (leHorarios(horariosBrutos).length === 0) {
    return {
      ok: false,
      campo: "horarios",
      mensagem:
        horariosBrutos === ""
          ? `Sem horário, o canal não publica. Escreva como preferir, por exemplo "${HORARIOS_SUGERIDOS}".`
          : `Não reconheci nenhum horário em "${horariosBrutos}". Use horas de 00:00 a 23:59, separadas por vírgula ou "e" — por exemplo "${HORARIOS_SUGERIDOS}".`,
    };
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
    plataforma,
    telegramChatId,
    whatsappGrupoId,
    botId,
    nichos,
    tetoDiario,
    audiencia: Number.isFinite(audiencia) ? Math.max(0, audiencia) : 0,
    // Parceiro e operador saem do formulário como texto livre, e o
    // banco os quer como referência a `parceiro` e `usuario`. Enquanto
    // não existe cadastro de parceiro, o canal nasce sem vínculo e a
    // tela mostra "você" — que é a verdade hoje.
    splitAudienciaPct,
    splitOperacaoPct,
    horarios: horariosBrutos,
  };

  if (id === "") {
    const novoId = await criaCanal(dados);
    if (!novoId) {
      return {
        ok: false,
        campo: "nome",
        mensagem:
          "Não consegui salvar o canal no banco. Se a plataforma é Telegram, confira o identificador do canal.",
      };
    }
    revalidatePath("/canais");
    revalidatePath("/aprovar");
    return { ok: true, canalId: novoId, token: crypto.randomUUID() };
  }

  await atualizaCanal(id, dados);
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

  await alternaCanalAtivo(id, String(form.get("ativo") ?? "") === "true");

  revalidatePath("/canais");
  revalidatePath(`/canais/${id}`);
  revalidatePath("/aprovar");
}

export async function abreCanal(form: FormData): Promise<void> {
  redirect(`/canais/${String(form.get("canal_id") ?? "")}`);
}
