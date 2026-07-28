import "server-only";

import { supabaseDaSessao } from "@/lib/supabase/sessao";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Quem está usando o painel.
 *
 * Duas perguntas, em dois lugares diferentes, e juntá-las seria erro:
 *
 * 1. **Quem provou a identidade** — pergunta ao Supabase Auth, pela
 *    sessão. Usa `getUser()` e nunca `getSession()`: o segundo lê o
 *    cookie e acredita nele, o primeiro confere o token com o
 *    servidor. Num componente de servidor, cookie é dado de entrada
 *    do usuário, e dado de entrada não se confia.
 * 2. **O que essa pessoa é aqui dentro** — papéis, operação, parceiro
 *    ligado. Isso mora na tabela `usuario`, e não no token.
 *
 * Conta de autenticação sem linha em `usuario` **não entra**. É o que
 * faz "não existe cadastro público" continuar verdade mesmo se alguém
 * criar uma conta pela API de autenticação: sem convite, sem linha,
 * sem painel.
 */

export type Papel = "dono" | "operador" | "parceiro";

export type UsuarioDaSessao = {
  id: string;
  nome: string;
  email: string;
  papeis: Papel[];
  operacaoId: string;
  parceiroId: string | null;
};

export async function usuarioAtual(): Promise<UsuarioDaSessao | null> {
  const auth = await supabaseDaSessao();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return null;

  // A leitura da linha usa a service role de propósito: a policy de
  // `usuario` chama `operacao_atual()`, que consulta `usuario` — é o
  // ovo e a galinha do primeiro acesso. Ler a própria linha por uma
  // chave que ignora RLS, filtrando pelo id que o Auth acabou de
  // confirmar, é seguro e é o único caminho que não gira em falso.
  const db = supabaseServidor();
  const { data: linha } = await db
    .from("usuario")
    .select("id, nome, email, papeis, operacao_id, parceiro_id, ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!linha || !linha.ativo) return null;

  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    papeis: (linha.papeis ?? []) as Papel[],
    operacaoId: linha.operacao_id,
    parceiroId: linha.parceiro_id,
  };
}

/**
 * Para onde uma pessoa vai depois de entrar.
 *
 * A casa é a do papel, e não uma tela só para todos: o operador que
 * cai na fila de aprovação aterrissa numa tela cheia de decisão que
 * não é dele.
 *
 * **Parceiro puro ainda não tem casa**, e isso está dito em vez de
 * disfarçado. As telas dele são da Fase 3 (`docs/telas.md`); mandá-lo
 * para o painel do dono, que hoje lê o banco com a service role,
 * mostraria a ele a operação inteira — inclusive o que os outros
 * parceiros ganham. Melhor uma porta que diz "ainda não" do que uma
 * que abre no lugar errado.
 */
export function casaDoPapel(papeis: Papel[]): string | null {
  if (papeis.includes("dono")) return "/aprovar";
  if (papeis.includes("operador")) return "/publicar";
  return null;
}
