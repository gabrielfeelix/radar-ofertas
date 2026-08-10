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
  // Atribui à loja de propósito: o "de" é alegação dela, não medição
  // nossa, e assumi-lo seria a regra 3.4 violada.
  lastroDeclarado: "A loja marcou de {antes} por {agora}.",
  linhaFrete: "🚚 Frete grátis",
  lastroSem: "Menor preço que observamos desde {desde}.",
};

const CAMPOS =
  "corpo, lastro_com, lastro_sem, lastro_queda, lastro_declarado, linha_frete, nota_prefixo";

type ModeloLido = Pick<
  ModeloMensagemLinha,
  "corpo" | "lastro_com" | "lastro_sem" | "lastro_queda" | "lastro_declarado" | "linha_frete" | "nota_prefixo"
>;

/** Uma linha do banco vira o formato que `montaMensagem` espera. */
function montaModelo(linha: ModeloLido): ModeloDeMensagem {
  return {
    corpo: linha.corpo,
    lastroCom: linha.lastro_com,
    lastroSem: linha.lastro_sem,
    lastroQueda: linha.lastro_queda,
    lastroDeclarado: linha.lastro_declarado,
    linhaFrete: linha.linha_frete,
    notaPrefixo: linha.nota_prefixo,
  };
}

/**
 * O modelo de um canal, caindo no global quando ele não tem o seu.
 *
 * POR QUE POR CANAL. O registro muda com o público: o Radar Delas é um
 * grupo de mulheres falando de beleza, e o Radar Geek não é. O mesmo
 * texto nos dois soa deslocado num deles, e é sempre o mesmo defeito
 * que faz canal de oferta parecer robô.
 *
 * A coluna `canal_id` já existia na tabela desde o começo; só a leitura
 * é que ignorava ela.
 */
export async function modeloDoCanal(canalId: string | null): Promise<ModeloDeMensagem> {
  if (!canalId) return modeloGlobal();

  try {
    const { data } = await supabaseServidor()
      .from("modelo_mensagem")
      .select(CAMPOS)
      .eq("canal_id", canalId)
      .eq("ativo", true)
      .maybeSingle();

    // Sem modelo próprio, o global. Canal novo não nasce mudo nem
    // esperando alguém lembrar de cadastrar texto.
    return data ? montaModelo(data as ModeloLido) : modeloGlobal();
  } catch {
    return modeloGlobal();
  }
}

export async function modeloGlobal(): Promise<ModeloDeMensagem> {
  try {
    const { data } = await supabaseServidor()
      .from("modelo_mensagem")
      .select(CAMPOS)
      .is("canal_id", null)
      .maybeSingle();

    return data ? montaModelo(data as ModeloLido) : RESERVA;
  } catch {
    return RESERVA;
  }
}
