import "server-only";

import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Publicações, lidas do banco.
 *
 * Começa pequeno de propósito: só o que a tela de canal precisa hoje.
 * A fila de envio inteira migra da simulação em seguida, e cada função
 * entra aqui quando a tela dela for religada — em vez de escrever um
 * módulo completo que ninguém chama, que é como se acumula código
 * morto com cara de pronto.
 */

/** Meia-noite de hoje em São Paulo, em UTC (regra 3.9). */
function inicioDoDiaLocal(): string {
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `${dia}T03:00:00.000Z`;
}

export type ContagemDoCanal = {
  /** Esperando envio agora. */
  pendentes: number;
  /** Já enviadas hoje. É o que consome o teto diário. */
  enviadasHoje: number;
};

export async function publicacoesDoCanal(canalId: string): Promise<ContagemDoCanal> {
  const db = supabaseServidor();

  const [pendentes, enviadas] = await Promise.all([
    db
      .from("publicacao")
      .select("id", { count: "exact", head: true })
      .eq("canal_id", canalId)
      .eq("estado", "pendente"),
    db
      .from("publicacao")
      .select("id", { count: "exact", head: true })
      .eq("canal_id", canalId)
      .eq("estado", "enviada")
      .gte("enviada_em", inicioDoDiaLocal()),
  ]);

  return {
    pendentes: pendentes.count ?? 0,
    enviadasHoje: enviadas.count ?? 0,
  };
}
