"use server";

import { revalidatePath } from "next/cache";

import {
  afirmaMinimoSemLastro,
  identificacaoEstaEscondida,
  temIdentificacaoPublicitaria,
} from "@/lib/mensagem";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Salvar o modelo da mensagem.
 *
 * A validação que importa é uma só, e ela é dura: **o texto usado sem
 * lastro não pode afirmar mínimo histórico** (regra 3.4). Não é aviso,
 * é recusa — a mensagem chega em milhares de pessoas com o nome do
 * canal em cima, e mentir sobre preço é o erro que mata os
 * concorrentes deste projeto.
 *
 * A checagem mora aqui, no servidor, e não só na tela: validação de
 * navegador é conveniência, nunca garantia.
 */

export type ResultadoModelo =
  | { ok: true; token: string }
  | { ok: false; campo: "corpo" | "lastro_sem" | "geral"; mensagem: string };

export async function salvaModelo(
  _anterior: ResultadoModelo | null,
  form: FormData,
): Promise<ResultadoModelo> {
  const id = String(form.get("modelo_id") ?? "").trim();
  const corpo = String(form.get("corpo") ?? "").trim();
  const lastroCom = String(form.get("lastro_com") ?? "").trim();
  const lastroSem = String(form.get("lastro_sem") ?? "").trim();

  if (id === "") return { ok: false, campo: "geral", mensagem: "Modelo não identificado." };

  if (corpo === "") {
    return { ok: false, campo: "corpo", mensagem: "A mensagem não pode ficar vazia." };
  }

  if (!corpo.includes("{link}")) {
    return {
      ok: false,
      campo: "corpo",
      mensagem:
        "Falta {link}. Sem ele a mensagem sai sem o link com subid, e a venda não volta para canal nenhum.",
    };
  }

  if (!corpo.includes("{lastro}")) {
    return {
      ok: false,
      campo: "corpo",
      mensagem:
        "Falta {lastro}. É ele que troca de redação conforme a série — sem ele, a honestidade sobre o preço some do texto.",
    };
  }

  // Regra 3.10. Link de afiliado gera comissão, e conteúdo remunerado
  // é publicidade — CONAR, CDC e a própria Shopee. Recusa, não aviso:
  // a Shopee pode pedir suspensão do conteúdo de quem não cumpre.
  if (!temIdentificacaoPublicitaria(corpo)) {
    return {
      ok: false,
      campo: "corpo",
      mensagem:
        "Falta a identificação de publicidade. Link de afiliado gera comissão, e isso é publicidade — use #publi, #publicidade, #parceriapaga ou #conteúdopago.",
    };
  }

  if (identificacaoEstaEscondida(corpo)) {
    return {
      ok: false,
      campo: "corpo",
      mensagem:
        "A identificação existe, mas está longe demais do começo. Ela precisa aparecer de imediato, nas primeiras linhas — no rodapé, depois do link, não conta.",
    };
  }

  if (afirmaMinimoSemLastro(lastroSem)) {
    return {
      ok: false,
      campo: "lastro_sem",
      mensagem:
        "Este texto afirma mínimo histórico, e ele é usado justamente quando ainda não há série para afirmar isso. Use a redação com a data em que começamos a observar.",
    };
  }

  const { error } = await supabaseServidor()
    .from("modelo_mensagem")
    .update({ corpo, lastro_com: lastroCom, lastro_sem: lastroSem })
    .eq("id", id);

  if (error) {
    return { ok: false, campo: "geral", mensagem: `Não consegui salvar: ${error.message}` };
  }

  revalidatePath("/ajustes/modelos");
  revalidatePath("/publicar");
  return { ok: true, token: crypto.randomUUID() };
}
