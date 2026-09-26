import "server-only";

import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Os grupos em que cada chip está, lidos ao vivo da Evolution (D-074).
 *
 * Antes o JID do grupo era copiado à mão do painel da Evolution, na
 * VPS. Para o grupo de um parceiro isso é um passo que o dono não sabe
 * fazer sem terminal. Agora o formulário do canal lista os grupos do
 * chip e ele escolhe pelo nome.
 *
 * Falha é lista vazia, e o campo continua aceitando o JID colado: a
 * VPS fora do ar não pode impedir de salvar um canal.
 */

export type GrupoDoChip = { jid: string; nome: string; botId: string };

export async function gruposDosChips(): Promise<GrupoDoChip[]> {
  const base = (process.env.WHATSAPP_API_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.WHATSAPP_API_KEY ?? "";
  if (!base || !chave) return [];

  const db = supabaseServidor();
  const { data: bots } = await db
    .from("bot")
    .select("id, instancia")
    .eq("plataforma", "whatsapp")
    .eq("ativo", true)
    .not("instancia", "is", null);

  const listas = await Promise.all(
    (bots ?? []).map(async (b) => {
      try {
        const r = await fetch(
          `${base}/group/fetchAllGroups/${encodeURIComponent(b.instancia)}?getParticipants=false`,
          { headers: { apikey: chave }, signal: AbortSignal.timeout(10000), cache: "no-store" },
        );
        const d = await r.json().catch(() => null);
        if (!Array.isArray(d)) return [];
        return d
          .filter((g) => typeof g?.id === "string" && g.id.endsWith("@g.us"))
          .map((g) => ({ jid: g.id as string, nome: String(g.subject ?? g.id), botId: b.id }));
      } catch {
        return [];
      }
    }),
  );

  return listas.flat().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
