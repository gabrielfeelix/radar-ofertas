import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Banco } from "./tipos";

/**
 * Cliente do Supabase que carrega a SESSÃO de quem está usando.
 *
 * É o oposto de `servidor.ts`, e a diferença importa:
 *
 * - `supabaseServidor()` usa a **service role**, ignora RLS por
 *   desenho, e é como o painel lê o catálogo hoje.
 * - `supabaseDaSessao()` usa a **chave anônima** mais o cookie de
 *   sessão. Quem pergunta é a pessoa, e as policies valem.
 *
 * Por enquanto este cliente serve só para autenticar — entrar, sair,
 * saber quem é. A troca das leituras de dado, de service role para
 * a chave da pessoa, é o passo seguinte e está anotado em
 * `docs/decisoes.md`. Fazer os dois de uma vez juntaria "a porta não
 * abre" com "a consulta não devolve linha" no mesmo depurar.
 */
export async function supabaseDaSessao(): Promise<SupabaseClient<Banco>> {
  const caixa = await cookies();

  return createServerClient<Banco>(
    exigeVariavel("NEXT_PUBLIC_SUPABASE_URL"),
    exigeVariavel("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => caixa.getAll(),
        setAll: (novos) => {
          try {
            for (const { name, value, options } of novos) {
              caixa.set(name, value, options);
            }
          } catch {
            // Componente de servidor não pode escrever cookie. Não é
            // erro: quem renova a sessão é o middleware, e ele roda
            // antes. O `catch` vazio é deliberado e só vale aqui.
          }
        },
      },
    },
  );
}

function exigeVariavel(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === "" || valor.startsWith("cole_aqui")) {
    throw new Error(
      `Falta a variável de ambiente ${nome}. Copie o .env.example para .env ` +
        `e preencha com os valores do painel do Supabase (Project Settings > API).`,
    );
  }
  return valor;
}
