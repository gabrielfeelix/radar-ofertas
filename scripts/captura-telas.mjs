/**
 * Tira foto das telas do painel.
 *
 * Existe por um buraco que custou caro duas vezes: `pnpm verifica` roda
 * tipo, lint e teste, e **não vê layout**. Os dois defeitos da rodada de
 * 28/07 — 97 botões sem `cursor: pointer` e uma constante exportada de
 * arquivo `"use server"` — passaram por tudo e só apareceram quando
 * alguém abriu o navegador. Sem isto, "abra e clique" depende de haver
 * um humano disponível na hora certa.
 *
 * USO
 *
 *   pnpm dev            # em outro terminal, o painel precisa estar de pé
 *   pnpm telas          # todas as telas
 *   pnpm telas aprovar publicar
 *
 * As imagens saem em `.telas/`, que está no `.gitignore` — captura é
 * material de conferência, não versão.
 *
 * Ele mesmo faz o login, com a conta do `.env`. Sem conta, o middleware
 * devolveria a tela de entrada em todas as fotos.
 */

import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
import { mkdirSync } from "node:fs";

const TELAS = [
  "aprovar",
  "publicar",
  "atencao",
  "arranque",
  "produtos",
  "produtos/sem-nicho",
  "colheita/fontes",
  "colheita/mencoes",
  "canais",
  "ajustes/curadoria",
  "ajustes/nichos",
  "ajustes/marketplaces",
  "ajustes/modelos",
];

const BASE = process.env.PAINEL_URL ?? "http://localhost:3000";
const PASTA = ".telas";

const email = process.env.CONTA_DE_CAPTURA_EMAIL;
const senha = process.env.CONTA_DE_CAPTURA_SENHA;

if (!email || !senha) {
  console.error(
    "Falta CONTA_DE_CAPTURA_EMAIL ou CONTA_DE_CAPTURA_SENHA no .env.\n" +
      "É uma conta local de teste; crie com: pnpm usuario:cria \"voce@local.test\" \"Seu Nome\" dono",
  );
  process.exit(1);
}

// Entra pela mesma biblioteca que o painel usa, para o cookie sair no
// formato que o middleware espera. Reimplementar o formato aqui seria
// uma segunda verdade, que envelhece sem avisar.
const cookiesDaSessao = [];
const auth = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: { getAll: () => [], setAll: (novos) => cookiesDaSessao.push(...novos) },
  },
);

const { error } = await auth.auth.signInWithPassword({ email, password: senha });
if (error) {
  console.error(`Não consegui entrar como ${email}: ${error.message}`);
  process.exit(1);
}

const pedidas = process.argv.slice(2);
const telas = pedidas.length > 0 ? pedidas : TELAS;

mkdirSync(PASTA, { recursive: true });

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  // Dobra a resolução: texto de 13px em captura 1× fica ilegível para
  // quem revisa depois, e revisão de layout que não se enxerga não é
  // revisão.
  deviceScaleFactor: 2,
});

await contexto.addCookies(
  cookiesDaSessao.map((c) => ({
    name: c.name,
    value: c.value,
    domain: new URL(BASE).hostname,
    path: "/",
  })),
);

const pagina = await contexto.newPage();
const quebradas = [];

// Erro de execução no navegador não aparece na foto: a tela quebrada
// sai bonita e vazia. Escutar o console é o que transforma a captura
// em conferência de verdade.
pagina.on("pageerror", (erro) => quebradas.push(`${pagina.url()}: ${erro.message}`));

for (const tela of telas) {
  const nome = tela.replace(/\//g, "-");
  const resposta = await pagina.goto(`${BASE}/${tela}`, { waitUntil: "networkidle" });
  await pagina.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: true });
  console.log(`${String(resposta?.status() ?? "?").padEnd(4)} /${tela} → ${PASTA}/${nome}.png`);
}

await navegador.close();

if (quebradas.length > 0) {
  console.error(`\n${quebradas.length} tela(s) com erro de execução:`);
  for (const q of quebradas) console.error(`  ${q}`);
  process.exit(1);
}
