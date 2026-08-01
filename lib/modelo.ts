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
    // A identificação vem antes do produto, e não no rodapé: a regra
    // 3.10 pede que ela apareça sem a pessoa precisar rolar.
    "#publi · {loja}",
    "",
    "🔥 {produto}",
    "",
    "De {preco_antes} por {preco} (−{desconto}%)",
    "{lastro}",
    "",
    "{vendedor}",
    "👉 {link}",
  ].join("\n"),
  lastroCom: "Menor preço em {janela} dias.",
  lastroQueda: "Caiu de {antes} para {agora} hoje.",
  lastroSem: "Menor preço que observamos desde {desde}.",
};

export async function modeloGlobal(): Promise<ModeloDeMensagem> {
  try {
    const { data } = await supabaseServidor()
      .from("modelo_mensagem")
      .select("corpo, lastro_com, lastro_sem, lastro_queda, nota_prefixo")
      .is("canal_id", null)
      .maybeSingle();

    const linha = data as Pick<ModeloMensagemLinha, "corpo" | "lastro_com" | "lastro_sem" | "lastro_queda" | "nota_prefixo"> | null;
    if (!linha) return RESERVA;

    return {
      corpo: linha.corpo,
      lastroCom: linha.lastro_com,
      lastroSem: linha.lastro_sem,
      lastroQueda: linha.lastro_queda,
      notaPrefixo: linha.nota_prefixo,
    };
  } catch {
    return RESERVA;
  }
}
