"use server";

import { revalidatePath } from "next/cache";

import { leIdentificadorDeCanal } from "@/lib/canais";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Ações da tela de fontes de colheita.
 *
 * Uma decisão que vale explicar: **nicho é obrigatório para
 * cadastrar canal**, mesmo o banco aceitando nulo.
 *
 * O nulo existe no schema porque canal antigo pode perder o nicho
 * (o `on delete set null` do nicho). Mas cadastrar canal sem nicho
 * é escolher, na entrada, produzir catálogo não roteável: todo
 * produto colhido herda o nicho da fonte, e produto sem nicho não
 * chega a canal nenhum. Seriam milhares de linhas na triagem
 * manual, e a colheita foi feita justamente para não depender de
 * trabalho manual por item.
 */

export type ResultadoFonte =
  | { ok: true; fonteId: string; identificador: string; token: string }
  | { ok: false; campo: "canal" | "nicho" | "geral"; mensagem: string };

export async function cadastraFonte(
  _anterior: ResultadoFonte | null,
  form: FormData,
): Promise<ResultadoFonte> {
  const leitura = leIdentificadorDeCanal(String(form.get("canal") ?? ""));
  if (!leitura.ok) {
    return { ok: false, campo: "canal", mensagem: leitura.mensagem };
  }

  const nichoId = String(form.get("nicho_id") ?? "").trim();
  if (nichoId === "") {
    return {
      ok: false,
      campo: "nicho",
      mensagem: "Escolha o nicho. É ele que os produtos colhidos daqui vão herdar.",
    };
  }

  const nome = String(form.get("nome") ?? "").trim();

  const db = supabaseServidor();

  const { data: nicho } = await db
    .from("nicho")
    .select("operacao_id")
    .eq("id", nichoId)
    .maybeSingle();

  if (!nicho) {
    return { ok: false, campo: "nicho", mensagem: "Esse nicho não existe mais." };
  }

  // O mesmo canal colado de novo não é erro do dono — é o índice
  // único fazendo o trabalho dele. Responder "já está aqui" evita
  // que ele fique tentando variações do endereço.
  const { data: existente } = await db
    .from("fonte_descoberta")
    .select("id")
    .eq("operacao_id", nicho.operacao_id)
    .eq("plataforma", "telegram")
    .eq("identificador", leitura.identificador)
    .maybeSingle();

  if (existente) {
    return {
      ok: false,
      campo: "canal",
      mensagem: `O canal @${leitura.identificador} já está cadastrado.`,
    };
  }

  const { data: fonte, error } = await db
    .from("fonte_descoberta")
    .insert({
      operacao_id: nicho.operacao_id,
      plataforma: "telegram",
      identificador: leitura.identificador,
      nome: nome === "" ? null : nome,
      // Só web pública. A leitura por conta de usuário alcança grupo
      // fechado, mas depende de uma string de sessão que ainda não
      // existe — e ela nunca entra no Git (D-012).
      tipo_leitura: "web_publica",
      nicho_id: nichoId,
    })
    .select("id")
    .single();

  if (error || !fonte) {
    return {
      ok: false,
      campo: "geral",
      mensagem: `Não consegui salvar o canal: ${error?.message ?? "erro desconhecido"}`,
    };
  }

  revalidatePath("/colheita/fontes");
  return {
    ok: true,
    fonteId: fonte.id,
    identificador: leitura.identificador,
    token: crypto.randomUUID(),
  };
}

/**
 * Liga e desliga a leitura de um canal.
 *
 * Desligar não apaga: as menções já colhidas continuam contando no
 * rendimento, que é justamente o registro de por que ele foi
 * desligado. Apagar canal ruim apagaria a prova de que era ruim.
 */
export async function alternaFonteAtiva(form: FormData): Promise<void> {
  const fonteId = String(form.get("fonte_id") ?? "");
  const ativo = String(form.get("ativo") ?? "") === "true";

  if (fonteId === "") return;

  await supabaseServidor().from("fonte_descoberta").update({ ativo }).eq("id", fonteId);

  revalidatePath("/colheita/fontes");
}

/**
 * Troca o nicho da fonte.
 *
 * Vale só daqui para frente: produto já colhido guarda o nicho que
 * herdou na hora. Reescrever o passado mudaria o roteamento de
 * produto que já pode estar em oferta.
 */
export async function defineNichoDaFonte(form: FormData): Promise<void> {
  const fonteId = String(form.get("fonte_id") ?? "");
  const nichoId = String(form.get("nicho_id") ?? "");

  if (fonteId === "" || nichoId === "") return;

  await supabaseServidor()
    .from("fonte_descoberta")
    .update({ nicho_id: nichoId })
    .eq("id", fonteId);

  revalidatePath("/colheita/fontes");
}
