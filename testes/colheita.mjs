/**
 * Teste da leitura paginada de canal público.
 *
 * Existe porque errar aqui não dá erro visível: a colheita continua
 * respondendo "ok", só que lendo uma página em vez de oito, ou o
 * contrário, pedindo a mesma página até o teto e gastando requisição
 * contra o Telegram para nada. Nos dois casos o resumo da execução
 * parece saudável.
 *
 * A rede é dublada: o que está sob teste é a decisão de quando parar
 * de voltar, não o HTML do Telegram.
 */
import { leCanalPublico } from "../supabase/functions/_compartilhado/telegram-web.ts";

let passou = 0;
let falhou = 0;
const confere = (n, ok) => {
  if (ok) {
    passou++;
    console.log(`✓ ${n}`);
  } else {
    falhou++;
    console.log(`✗ ${n}`);
  }
};

/** Uma página de HTML no formato mínimo que `extraiPosts` reconhece. */
function pagina(ids) {
  return ids
    .map(
      (id) =>
        `<div data-post="canal/${id}"><time datetime="2026-07-30T10:00:00+00:00"></time>` +
        `<div class="tgme_widget_message_text">post ${id}</div></div>`,
    )
    .join("");
}

/**
 * Um canal falso com `total` posts, servindo 20 por página, do mais
 * novo para o mais antigo, como o Telegram faz.
 */
function dublaTelegram(total, aoPedir) {
  const pedidos = [];
  globalThis.fetch = async (endereco) => {
    pedidos.push(String(endereco));
    aoPedir?.(String(endereco));

    const antes = Number(new URL(String(endereco)).searchParams.get("before")) || total + 1;
    const ids = [];
    for (let id = antes - 1; id > 0 && ids.length < 20; id--) ids.push(id);

    return { ok: true, text: async () => pagina(ids) };
  };
  return pedidos;
}

const fetchOriginal = globalThis.fetch;

console.log("\nquantas páginas ela volta\n");

let pedidos = dublaTelegram(500);
let posts = await leCanalPublico("canal", { paginas: 1 });
confere("uma página traz 20 posts", posts.length === 20);
confere("e faz uma requisição só", pedidos.length === 1);

pedidos = dublaTelegram(500);
posts = await leCanalPublico("canal", { paginas: 6 });
confere("seis páginas trazem 120", posts.length === 120);
confere("e fazem seis requisições", pedidos.length === 6);
confere(
  "a segunda requisição usa ?before=",
  pedidos[1].includes("before=481"),
);

console.log("\nquando ela para sozinha\n");

pedidos = dublaTelegram(500);
posts = await leCanalPublico("canal", { paginas: 10, ateOPost: 470 });
confere("para ao alcançar o que já conhecemos", pedidos.length === 2);
confere("e não passa muito do alvo", Math.min(...posts.map((p) => p.id)) <= 470);

// O canal curto é a armadilha: sem a guarda, ele devolveria a mesma
// página até o teto e cada passada gastaria dez requisições por nada.
pedidos = dublaTelegram(25);
posts = await leCanalPublico("canal", { paginas: 10 });
confere("canal curto não gasta o teto de páginas", pedidos.length <= 3);
confere("e traz os 25 posts que existem", posts.length === 25);

console.log("\nescavando a partir de uma borda\n");

pedidos = dublaTelegram(500);
posts = await leCanalPublico("canal", { paginas: 3, antesDe: 100 });
confere("começa abaixo da borda, não do topo", Math.max(...posts.map((p) => p.id)) < 100);
confere("desce três páginas", posts.length === 60);
confere("a primeira requisição já leva o before", pedidos[0].includes("before=100"));

console.log("\no que ela devolve\n");

pedidos = dublaTelegram(500);
posts = await leCanalPublico("canal", { paginas: 3 });
const ids = posts.map((p) => p.id);
confere("vem ordenado do mais antigo para o mais novo", ids.every((v, i) => i === 0 || v > ids[i - 1]));
confere("sem post repetido", new Set(ids).size === ids.length);

console.log("\nquando a rede falha\n");

globalThis.fetch = async () => ({ ok: false, status: 429, text: async () => "" });
let estourou = false;
try {
  await leCanalPublico("canal", { paginas: 3 });
} catch {
  estourou = true;
}
confere("falhar na primeira página é erro, e não silêncio", estourou);

// Falhar no meio é outra coisa: o que já veio vale, e perder a passada
// inteira por causa da quarta página seria pior que ficar com três.
let chamada = 0;
globalThis.fetch = async (endereco) => {
  chamada++;
  if (chamada > 2) return { ok: false, status: 500, text: async () => "" };
  const antes = Number(new URL(String(endereco)).searchParams.get("before")) || 501;
  const ids = [];
  for (let id = antes - 1; id > 0 && ids.length < 20; id--) ids.push(id);
  return { ok: true, text: async () => pagina(ids) };
};
posts = await leCanalPublico("canal", { paginas: 6 });
confere("falhar no meio devolve o que já veio", posts.length === 40);

console.log("\nquando o canal servido não é o pedido\n");

// Das oito fontes cadastradas, duas caíam nisto: t.me/s/promobit
// devolve ofertasdecomputador. A página responde 200 com posts
// perfeitos, então sem esta checagem a colheita lê o mesmo canal duas
// vezes e ninguém percebe.
globalThis.fetch = async () => ({
  ok: true,
  text: async () =>
    `<div data-post="outrocanal/10"><time datetime="2026-07-30T10:00:00+00:00"></time>` +
    `<div class="tgme_widget_message_text">post</div></div>`,
});

let trocou = false;
let mensagem = "";
try {
  await leCanalPublico("canalpedido", { paginas: 1 });
} catch (e) {
  trocou = true;
  mensagem = e.message;
}
confere("canal servido diferente do pedido é erro", trocou);
confere("e o erro diz qual canal veio no lugar", mensagem.includes("outrocanal"));

globalThis.fetch = fetchOriginal;

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
