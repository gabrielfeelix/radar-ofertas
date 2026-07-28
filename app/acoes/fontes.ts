"use server";

import { revalidatePath } from "next/cache";

import { leIdentificadorDeCanal } from "@/lib/canais";
import { MISTO } from "@/lib/colheita";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Ações da tela de fontes de colheita.
 *
 * NICHO DA FONTE: OBRIGATÓRIO ESCOLHER, MAS "MISTO" É UMA ESCOLHA.
 *
 * A primeira versão exigia um nicho de verdade, com um argumento
 * correto: todo produto colhido herda o nicho da fonte, e produto sem
 * nicho não chega a canal nenhum — seriam milhares de linhas de
 * triagem manual, e a colheita existe justamente para não depender de
 * trabalho por item.
 *
 * O argumento vale para canal de **um assunto só**. Ele se inverte
 * para canal genérico de ofertas, que é a maioria dos que valem a
 * leitura. Forçar um nicho ali não produz catálogo roteável: produz
 * catálogo **roteado errado**. Foi o que aconteceu — três fontes
 * cadastradas como "pet", e placa de vídeo entrando no catálogo com o
 * nicho de ração.
 *
 * E a diferença entre os dois erros é grande:
 *
 *   sem nicho     falha visível — o produto para na triagem e ninguém
 *                 publica nada errado
 *   nicho errado  falha silenciosa — a oferta é roteada, aprovada e
 *                 publicada no canal errado, e o grupo de pet recebe
 *                 uma placa de vídeo
 *
 * Então "misto" passa a ser opção explícita, e o custo dela fica
 * escrito na tela: os produtos caem em Sem classificação e a triagem
 * é trabalho por item. O que não se aceita é o campo **em branco por
 * distração** — por isso a escolha continua obrigatória.
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

  // `misto` é escolha; vazio é distração. Os dois chegam aqui como
  // strings diferentes de propósito.
  const nichoBruto = String(form.get("nicho_id") ?? "").trim();
  if (nichoBruto === "") {
    return {
      ok: false,
      campo: "nicho",
      mensagem: "Escolha o nicho, ou marque como misto. É ele que os produtos daqui vão herdar.",
    };
  }
  const nichoId = nichoBruto === MISTO ? null : nichoBruto;

  const nome = String(form.get("nome") ?? "").trim();

  const db = supabaseServidor();

  // A operação sai do nicho quando há um; sendo misto, sai da única
  // operação que existe. Quando houver mais de uma, ela virá da
  // sessão — e aí este trecho sai junto.
  let operacaoId: string;

  if (nichoId === null) {
    const { data: operacao } = await db.from("operacao").select("id").limit(1).maybeSingle();
    if (!operacao) {
      return { ok: false, campo: "geral", mensagem: "Nenhuma operação no banco." };
    }
    operacaoId = operacao.id;
  } else {
    const { data: nicho } = await db
      .from("nicho")
      .select("operacao_id")
      .eq("id", nichoId)
      .maybeSingle();

    if (!nicho) {
      return { ok: false, campo: "nicho", mensagem: "Esse nicho não existe mais." };
    }
    operacaoId = nicho.operacao_id;
  }

  // O mesmo canal colado de novo não é erro do dono — é o índice
  // único fazendo o trabalho dele. Responder "já está aqui" evita
  // que ele fique tentando variações do endereço.
  const { data: existente } = await db
    .from("fonte_descoberta")
    .select("id")
    .eq("operacao_id", operacaoId)
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
      operacao_id: operacaoId,
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
  const nichoBruto = String(form.get("nicho_id") ?? "");

  if (fonteId === "" || nichoBruto === "") return;

  // Trocar vale daqui para frente: produto já colhido guarda o nicho
  // que herdou na hora. Marcar como misto não desfaz o que entrou
  // errado — isso é trabalho da triagem, em Sem classificação.
  await supabaseServidor()
    .from("fonte_descoberta")
    .update({ nicho_id: nichoBruto === MISTO ? null : nichoBruto })
    .eq("id", fonteId);

  revalidatePath("/colheita/fontes");
}
