import "server-only";

import { contasDasLinhas, type ContasDoParceiro } from "@/lib/conta-do-canal";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Parceiros — quem traz a audiência e, desde a D-074, pode receber a
 * comissão na PRÓPRIA conta de afiliado.
 *
 * A conta fica aqui, no parceiro, e não no canal: o mesmo parceiro pode
 * ter dois grupos, e o ID é dele. Quem decide de quem é cada link é
 * `donoDoLink`, em `lib/conta-do-canal.ts`.
 */

export type Parceiro = {
  id: string;
  nome: string;
  contato: string | null;
  contas: ContasDoParceiro;
  canais: string[];
};

type Linha = {
  id: string;
  nome: string;
  contato: string | null;
  parceiro_afiliado: { afiliado_id: string; marketplace: { slug: string } | null }[] | null;
  canal: { nome: string }[] | null;
};

export async function parceiros(): Promise<Parceiro[]> {
  const db = supabaseServidor();
  const { data } = await db
    .from("parceiro")
    .select(
      "id, nome, contato, parceiro_afiliado ( afiliado_id, marketplace:marketplace_id ( slug ) ), canal ( nome )",
    )
    .eq("ativo", true)
    .order("nome");

  return ((data ?? []) as unknown as Linha[]).map((p) => ({
    id: p.id,
    nome: p.nome,
    contato: p.contato,
    contas: contasDasLinhas(p.parceiro_afiliado),
    canais: (p.canal ?? []).map((c) => c.nome),
  }));
}

export async function parceirosParaEscolha(): Promise<{ id: string; nome: string }[]> {
  const lista = await parceiros();
  return lista.map((p) => ({ id: p.id, nome: p.nome }));
}
