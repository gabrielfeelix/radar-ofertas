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
  /**
   * `avisos` existe desde 15/08, quando o `#publi` deixou de bloquear.
   *
   * Salvar e avisar é diferente de salvar em silêncio: a regra 3.10
   * continua sendo o que este projeto recomenda, e quem salvar sem ela
   * precisa ver que fez isso.
   */
  | { ok: true; token: string; avisos?: string[] }
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

  /*
    A EXIGÊNCIA DE #publi DEIXOU DE BLOQUEAR EM 15/08, e virou aviso.

    A regra 3.10 continua no `AGENTS.md` e continua sendo o que este
    projeto recomenda. O que mudou é quem decide: o dono contestou a
    BASE dela, e o argumento não é frívolo. *"Nenhum grupo faz, veremos
    depois pesquisando se realmente é obrigatório; você tá enviesado
    porque a doc tá dizendo, mas ninguém sabe se a doc tá certa."*

    Ele tem razão em pelo menos um ponto: a regra foi escrita por
    agentes a partir de `docs/pesquisa-operacao.md`, sem verificação em
    fonte primária. A pesquisa (CONAR, CDC art. 36, termos de afiliado
    de Shopee e Amazon, com citação) ficou como tarefa aberta, e até
    ela sair quem decide é ele.

    O aviso fica porque a informação continua valendo, e porque o dia
    em que isto voltar a ser bloqueio, o texto já está escrito.
  */
  const avisos: string[] = [];

  if (!temIdentificacaoPublicitaria(corpo)) {
    avisos.push(
      "O modelo não identifica que é publicidade. Link de afiliado gera comissão, e a regra 3.10 pede #publi, #publicidade, #parceriapaga ou #conteúdopago.",
    );
  } else if (identificacaoEstaEscondida(corpo)) {
    avisos.push(
      "A identificação existe, mas está longe do começo. A regra 3.10 pede que ela apareça nas primeiras linhas, não no rodapé.",
    );
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
  return { ok: true, token: crypto.randomUUID(), avisos: avisos.length ? avisos : undefined };
}
