"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { casaDoPapel, usuarioAtual, type Papel } from "@/lib/sessao";
import { supabaseDaSessao } from "@/lib/supabase/sessao";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Entrar e sair.
 *
 * A REGRA MAIS IMPORTANTE DESTE ARQUIVO: **o erro de login nunca diz
 * se o e-mail existe.** É sempre "e-mail ou senha incorretos", em
 * todos os casos — senha errada, e-mail que não existe, conta sem
 * convite, conta desativada. Dizer "este e-mail não está cadastrado"
 * transforma a tela de login num verificador de quem é usuário deste
 * sistema, e este sistema controla dinheiro.
 *
 * A única exceção é o parceiro, e ela é deliberada: ele **provou** a
 * identidade, então não há o que vazar. O que falta é tela, e mandá-lo
 * embora com "senha incorreta" faria ele trocar a senha para sempre
 * tentando resolver um problema que não é dele.
 */

export type ResultadoLogin = { ok: false; mensagem: string };

const GENERICO = "E-mail ou senha incorretos.";

export async function entra(
  _anterior: ResultadoLogin | null,
  form: FormData,
): Promise<ResultadoLogin> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  const de = String(form.get("de") ?? "");

  if (!email || !senha) return { ok: false, mensagem: GENERICO };

  const auth = await supabaseDaSessao();
  const { data, error } = await auth.auth.signInWithPassword({ email, password: senha });

  if (error || !data.user) return { ok: false, mensagem: GENERICO };

  // Identidade provada não basta: sem linha em `usuario`, não há
  // convite, e sem convite não há entrada. Vale mesmo que alguém
  // consiga criar uma conta pela API de autenticação por fora.
  const db = supabaseServidor();
  const { data: linha } = await db
    .from("usuario")
    .select("papeis, ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!linha || !linha.ativo) {
    await auth.auth.signOut();
    return { ok: false, mensagem: GENERICO };
  }

  const casa = casaDoPapel((linha.papeis ?? []) as Papel[]);

  if (!casa) {
    await auth.auth.signOut();
    return {
      ok: false,
      mensagem:
        "Sua conta é de parceiro, e o painel do parceiro ainda não existe — é da Fase 3. " +
        "Quem te convidou consegue ver o seu extrato.",
    };
  }

  revalidatePath("/", "layout");
  // `de` só é aceito se for caminho interno: um endereço absoluto
  // vindo do formulário transformaria o login numa ponte para fora.
  redirect(de.startsWith("/") && !de.startsWith("//") ? de : casa);
}

export async function sai(): Promise<void> {
  const auth = await supabaseDaSessao();
  await auth.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/entrar");
}

/** Para onde a raiz manda quem já entrou. */
export async function casaDeQuemEntrou(): Promise<string> {
  const usuario = await usuarioAtual();
  return (usuario && casaDoPapel(usuario.papeis)) ?? "/entrar";
}
