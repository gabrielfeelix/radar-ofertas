/**
 * Cria uma conta de acesso ao painel.
 *
 * Existe porque **não há cadastro público** (D-022, `docs/telas.md`):
 * conta nasce de convite do dono. A tela de convite é da Fase 3 — até
 * lá, este script é o convite, rodado por quem tem a chave de serviço.
 *
 * Faz as duas metades, que são separadas de propósito no banco:
 *
 *   1. a identidade, em `auth.users` — e-mail e senha
 *   2. o acesso, em `public.usuario` — operação, papéis, parceiro
 *
 * Identidade sem linha em `usuario` não entra no painel. É o que faz
 * "sem convite não há entrada" continuar verdade mesmo que alguém
 * crie uma conta pela API de autenticação por fora.
 *
 * USO
 *
 *   pnpm usuario:cria "voce@exemplo.com" "Seu Nome" dono
 *   pnpm usuario:cria "amigo@exemplo.com" "Bruno" operador,parceiro
 *
 * A senha não é argumento: ela é sorteada e impressa uma vez, para
 * não ficar no histórico do terminal. Troque depois pelo painel do
 * Supabase, ou peça à pessoa que troque.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const [email, nome, papeisBrutos = "dono"] = process.argv.slice(2);

if (!email || !nome) {
  console.error("Uso: pnpm usuario:cria <email> <nome> [papeis]");
  console.error('Exemplo: pnpm usuario:cria "voce@exemplo.com" "Seu Nome" dono');
  process.exit(1);
}

const PAPEIS_VALIDOS = ["dono", "operador", "parceiro"];
const papeis = papeisBrutos.split(",").map((p) => p.trim()).filter(Boolean);

const invalido = papeis.find((p) => !PAPEIS_VALIDOS.includes(p));
if (invalido) {
  console.error(`Papel desconhecido: "${invalido}". Use ${PAPEIS_VALIDOS.join(", ")}.`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

// 22 bytes em base64url dão ~29 caracteres. Longa o bastante para não
// ser adivinhada, curta o bastante para ser colada sem quebrar linha.
const senha = randomBytes(22).toString("base64url");

const { data: criada, error: erroAuth } = await db.auth.admin.createUser({
  email,
  password: senha,
  // Sem servidor de e-mail configurado, exigir confirmação deixaria a
  // conta criada e inutilizável. Quem cria é o dono, na própria
  // máquina, então o e-mail já está confirmado por construção.
  email_confirm: true,
});

if (erroAuth) {
  console.error(`Não deu para criar a identidade: ${erroAuth.message}`);
  process.exit(1);
}

// A operação: usa a que já existe. Operação é o recorte de tenant
// (D-021), e no começo há uma só.
const { data: operacoes, error: erroOperacao } = await db
  .from("operacao")
  .select("id, nome")
  .limit(2);

if (erroOperacao || !operacoes?.length) {
  console.error("Nenhuma operação no banco. Rode as migrations primeiro: pnpm db:reset.");
  process.exit(1);
}

if (operacoes.length > 1) {
  console.error("Há mais de uma operação. Este script ainda não sabe escolher — passe a mão.");
  process.exit(1);
}

const { error: erroUsuario } = await db.from("usuario").insert({
  id: criada.user.id,
  operacao_id: operacoes[0].id,
  nome,
  email,
  papeis,
});

if (erroUsuario) {
  // Sem a linha de acesso, a identidade é órfã e não entra em lugar
  // nenhum. Melhor desfazer do que deixar meia conta no banco.
  await db.auth.admin.deleteUser(criada.user.id);
  console.error(`Não deu para criar o acesso: ${erroUsuario.message}`);
  process.exit(1);
}

console.log("");
console.log(`Conta criada para ${nome} <${email}>`);
console.log(`Papéis: ${papeis.join(", ")}`);
console.log(`Operação: ${operacoes[0].nome}`);
console.log("");
console.log(`Senha (aparece uma vez só): ${senha}`);
console.log("");
