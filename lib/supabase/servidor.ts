import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Banco } from "./tipos";

/**
 * Cliente do Supabase para uso NO SERVIDOR, com a service role.
 *
 * O `import "server-only"` no topo não é decoração: se algum dia
 * um componente de navegador importar este arquivo por engano, o
 * build quebra com erro claro em vez de mandar a chave mestra
 * para dentro do JavaScript da página.
 *
 * A service role ignora Row Level Security. Na Fase 1 isso é o
 * desenho: não existe login ainda, o painel roda só na máquina do
 * dono, e as tabelas estão com RLS ligado e sem policy — ou seja,
 * fechadas para a chave anônima. Quando a Fase 3 trouxer login e
 * papéis, o painel passa a usar a chave do usuário e as policies
 * assumem o controle.
 */

let cliente: SupabaseClient<Banco> | null = null;

function exigeVariavel(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === "" || valor.startsWith("cole_aqui")) {
    throw new Error(
      `Falta a variável de ambiente ${nome}. ` +
        `Copie o .env.example para .env e preencha com os valores do painel do Supabase ` +
        `(Project Settings > API).`,
    );
  }
  return valor;
}

export function supabaseServidor(): SupabaseClient<Banco> {
  if (cliente) return cliente;

  cliente = createClient<Banco>(
    exigeVariavel("NEXT_PUBLIC_SUPABASE_URL"),
    exigeVariavel("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        // Chave de serviço não tem sessão nem refresh. Desligar
        // evita que a biblioteca tente persistir algo.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  return cliente;
}
