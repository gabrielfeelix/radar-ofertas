import "server-only";

import type { ModeloDeMensagem } from "@/lib/mensagem";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { ModeloMensagemLinha } from "@/lib/supabase/tipos";

/**
 * O modelo global, com reserva.
 *
 * A reserva existe porque a fila de publicação não pode ficar sem
 * mensagem quando o banco não responde: o operador está em pé, de
 * manhã, e uma tela vazia com "erro" não diz o que fazer. O texto de
 * reserva é o mesmo que a migration insere, para que os dois não
 * divirjam em silêncio.
 */
const RESERVA: ModeloDeMensagem = {
  corpo: [
    "🔥 {produto}",
    "",
    "De {preco_antes} por {preco} (−{desconto}%)",
    "{lastro}",
    "",
    "{loja} · {vendedor}",
    "👉 {link}",
  ].join("\n"),
  lastroCom: "Menor preço em {janela} dias.",
  lastroSem: "Menor preço que observamos desde {desde}.",
};

export async function modeloGlobal(): Promise<ModeloDeMensagem> {
  try {
    const { data } = await supabaseServidor()
      .from("modelo_mensagem")
      .select("corpo, lastro_com, lastro_sem")
      .is("canal_id", null)
      .maybeSingle();

    const linha = data as Pick<ModeloMensagemLinha, "corpo" | "lastro_com" | "lastro_sem"> | null;
    if (!linha) return RESERVA;

    return { corpo: linha.corpo, lastroCom: linha.lastro_com, lastroSem: linha.lastro_sem };
  } catch {
    return RESERVA;
  }
}
