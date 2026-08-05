/**
 * Cria um link de convite POR ORIGEM em cada canal do Telegram.
 *
 * POR QUE ISTO EXISTE, e é a coisa mais barata do projeto: o Telegram
 * conta quantas pessoas entraram por CADA link de convite, e mostra o
 * número no painel de administrador do canal. Um link por origem é,
 * portanto, atribuição de divulgação de graça — sem redirecionador, sem
 * domínio, sem pixel, sem Fase 2.
 *
 * Sem isso, o dono cola cartaz no ponto de ônibus, divulga no
 * Instagram, compra um post pago, e no fim do mês tem um número só:
 * "entraram 80 pessoas". Com isso ele tem: cartaz 12, Instagram 9, post
 * pago 59. É a diferença entre repetir o que funcionou e repetir tudo.
 *
 * O NÚMERO NÃO VEM POR AQUI, e é bom saber antes de procurar: o Bot API
 * não devolve quantos entraram por um link. Quem mostra é o aplicativo,
 * em Administrar canal → Links de convite. Este script só CRIA os links
 * com nome; a contagem você lê no celular.
 *
 * IDEMPOTÊNCIA, e é o motivo do arquivo local. O `createChatInviteLink`
 * cria um link NOVO a cada chamada, e o Bot API não tem método para
 * listar os que já existem. Rodar duas vezes sem memória criaria links
 * duplicados com o mesmo nome, e aí a contagem se divide em dois e não
 * quer dizer nada. Por isso o que foi criado fica em
 * `.links-de-convite.json`, na raiz, fora do Git.
 *
 *   >>> NÃO APAGUE ESSE ARQUIVO. <<<
 *
 * Se ele se perder, os links continuam valendo (estão no Telegram), mas
 * este script não sabe mais disso e criaria tudo de novo. Nesse caso,
 * confira a lista no aplicativo antes de rodar.
 *
 * O DIA EM QUE ISTO DEVE VIRAR TABELA: quando a Fase 2 trouxer o
 * redirecionador e o clique, a origem passa a ter que casar com venda, e
 * aí ela precisa viver no banco, ao lado de `canal`. Hoje seria tabela
 * nova só para guardar texto que o Telegram já guarda, e o AGENTS §8
 * manda perguntar antes de criar tabela. Ficou de fora de propósito.
 *
 * USO
 *
 *   node --env-file=.env --env-file=.env.producao scripts/cria-links-de-convite.mjs --seco
 *   node --env-file=.env --env-file=.env.producao scripts/cria-links-de-convite.mjs
 *
 *   # só um canal, que é o caso do post pago
 *   node --env-file=.env --env-file=.env.producao scripts/cria-links-de-convite.mjs --canal="Radar Beauty"
 *
 * A ORDEM DOS DOIS `--env-file` IMPORTA, e errar dá "Nenhum canal
 * ativo" sem explicar nada. O `.env` tem o `TELEGRAM_BOT_TOKEN` e
 * aponta para o banco LOCAL, que está vazio; o `.env.producao` tem o
 * banco da nuvem e não tem o token. O último arquivo vence, então
 * `.env.producao` precisa vir por último para o banco certo ganhar,
 * e o token sobrevive porque ele não é redefinido lá.
 *
 * O BOT PRECISA SER ADMINISTRADOR COM "CONVIDAR USUÁRIOS" no canal. Ele
 * já é administrador para publicar, mas essa permissão específica pode
 * estar desligada: o erro é `not enough rights to manage chat invite
 * link`, e o conserto é uma chave no aplicativo, não código.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SECO = process.argv.includes("--seco");
const SO_ESTE = process.argv
  .find((a) => a.startsWith("--canal="))
  ?.slice("--canal=".length);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

const MEMORIA = ".links-de-convite.json";

/**
 * As origens de divulgação.
 *
 * O nome é o que aparece no painel do Telegram, então ele é escrito
 * para ser lido por gente às pressas, não por código. Máximo de 32
 * caracteres, que é o limite do `createChatInviteLink`.
 *
 * `cartaz-*` é separado por lugar de propósito: saber que o cartaz
 * trouxe 12 pessoas é bom, saber que 11 delas vieram do terminal e 1 do
 * centro é o que decide onde colar os próximos vinte.
 *
 * ACRESCENTE, NÃO RENOMEIE. Renomear uma origem que já tem gente dentro
 * não move a contagem: o Telegram continua contando no link antigo, e o
 * nome novo nasce zerado. Origem que morreu, deixe morrer na lista.
 */
const ORIGENS = [
  "lp",            // a página que recebe o QR e a bio do Instagram
  "instagram",     // link direto, quando houver story com link
  "cartaz-terminal",
  "cartaz-centro",
  "amigos",        // o que o dono manda no WhatsApp, um a um
  "post-pago-1",   // o primeiro post comprado em canal de terceiro
];

async function telegram(metodo, corpo) {
  const resposta = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await resposta.json();
  if (!json.ok) {
    throw new Error(`${metodo}: ${json.description ?? "erro sem descrição"}`);
  }
  return json.result;
}

function leMemoria() {
  if (!existsSync(MEMORIA)) return {};
  try {
    return JSON.parse(readFileSync(MEMORIA, "utf8"));
  } catch {
    console.error(
      `${MEMORIA} existe e não é JSON válido. Pare e conserte à mão:\n` +
        "rodar assim criaria links duplicados e a contagem perderia o sentido.",
    );
    process.exit(1);
  }
}

const { data: canais, error } = await db
  .from("canal")
  .select("nome, telegram_chat_id, ativo")
  .eq("ativo", true)
  .order("nome");

if (error) {
  console.error("Não deu para ler os canais:", error.message);
  process.exit(1);
}

const alvos = SO_ESTE ? canais.filter((c) => c.nome === SO_ESTE) : canais;

if (alvos.length === 0) {
  console.error(
    SO_ESTE
      ? `Nenhum canal ativo chamado "${SO_ESTE}". Os que existem: ${canais.map((c) => c.nome).join(", ")}`
      : "Nenhum canal ativo.",
  );
  process.exit(1);
}

const memoria = leMemoria();
let criados = 0;
let jaExistiam = 0;
const falhas = [];

for (const canal of alvos) {
  memoria[canal.nome] ??= {};

  for (const origem of ORIGENS) {
    if (memoria[canal.nome][origem]) {
      jaExistiam++;
      continue;
    }

    if (SECO) {
      console.log(`[seco] criaria  ${canal.nome.padEnd(22)} ${origem}`);
      criados++;
      continue;
    }

    try {
      const link = await telegram("createChatInviteLink", {
        chat_id: canal.telegram_chat_id,
        name: origem,
        // Sem `creates_join_request`: aprovação manual mata a conversão
        // de tráfego pago, que é justamente o que estamos medindo.
      });
      memoria[canal.nome][origem] = link.invite_link;
      criados++;
      console.log(`✓ ${canal.nome.padEnd(22)} ${origem.padEnd(18)} ${link.invite_link}`);
    } catch (e) {
      falhas.push(`${canal.nome} · ${origem}: ${e.message}`);
      console.error(`✗ ${canal.nome.padEnd(22)} ${origem.padEnd(18)} ${e.message}`);
    }
  }
}

if (!SECO && criados > 0) {
  writeFileSync(MEMORIA, JSON.stringify(memoria, null, 2) + "\n");
}

console.log(
  `\n${SECO ? "[seco] " : ""}${criados} criados · ${jaExistiam} já existiam · ${falhas.length} falharam`,
);

if (falhas.length > 0) {
  console.log(
    "\nSe o erro fala em `not enough rights`, o bot é administrador do canal\n" +
      "mas está sem a permissão de convidar. Liga no aplicativo, em\n" +
      "Administrar canal → Administradores → o bot → Convidar usuários.",
  );
}

if (!SECO && criados > 0) {
  console.log(`\nOs links ficaram em ${MEMORIA} (fora do Git).`);
  console.log(
    "Quantos entraram por cada um você lê no celular, em\n" +
      "Administrar canal → Links de convite. O Bot API não devolve esse número.",
  );
}
