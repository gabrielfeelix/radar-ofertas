/**
 * Descobre canais de oferta no Telegram — por vizinhança, não por busca.
 *
 * A PERGUNTA QUE ISTO RESPONDE: como o sistema acha fonte nova no dia
 * a dia, sem alguém caçar `@handle` no Google?
 *
 * Adivinhar nome não escala e diretório de canal lista nome sem
 * handle, o que é inútil para automação. O que funciona é uma
 * propriedade do próprio meio: **canal de oferta cita outro canal de
 * oferta o tempo todo**. Então o rastreador parte das fontes que já
 * existem, lê a página pública de cada uma, extrai as menções, e
 * repete. Em 31/07 isso levou de 10 sementes a 24 canais legíveis em
 * dois saltos.
 *
 * A LEITURA É A PÁGINA PÚBLICA, `t.me/s/<canal>` — a mesma que
 * qualquer pessoa abre no navegador. Não precisa de conta, não
 * precisa entrar no canal, não precisa de número. Grupo e canal
 * privado NÃO são alcançáveis assim, e é de propósito.
 *
 * O FILTRO QUE IMPORTA É `links`, NÃO `posts`. Canal com 20 posts e
 * zero link de loja não rende nada: ele posta imagem, ou usa
 * `shp.ee`, que devolve 404 para requisição de servidor. O
 * rastreamento traz lixo junto — canais de poesia citados de
 * passagem — e é este filtro que os derruba sozinho.
 *
 * USO
 *
 *   node --env-file=.env.producao scripts/descobre-fontes.mjs
 *   node --env-file=.env.producao scripts/descobre-fontes.mjs --cadastra
 *
 * Sem `--cadastra` ele só lista. Com, grava como fonte **desativada**:
 * fonte nasce desligada porque cadastrar sozinho é sugestão, e ligar
 * é decisão de quem opera.
 */

import { createClient } from "@supabase/supabase-js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

/** Sementes usadas quando ainda não há fonte no banco. */
const SEMENTES = ["petpromocoes", "promocoespet", "promobit", "promotop", "chinasuperofertas"];

/** Saltos de vizinhança. Dois já satura: o terceiro repete o que veio. */
const SALTOS = 2;

/** Abaixo disto o canal não rende o suficiente para virar fonte. */
const MINIMO_DE_LINKS = Number(process.env.FONTE_MINIMO_LINKS ?? 2);

const LOJA =
  /mercadolivre\.com|shopee\.com|amzn\.to|amazon\.com\.br|magazinevoce|magazineluiza|shp\.ee/gi;

/** Caminhos do t.me que não são canal. */
const NAO_E_CANAL = new Set([
  "s", "joinchat", "share", "addstickers", "addtheme", "proxy", "socks",
  "telegram", "durov", "iv", "c", "boost", "login",
]);

const cadastra = process.argv.includes("--cadastra");

async function paginaDoCanal(canal) {
  try {
    const r = await fetch(`https://t.me/s/${canal}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

function analisa(html) {
  const meta = (nome) =>
    (html.match(new RegExp(`<meta property="og:${nome}" content="([^"]*)"`)) || [])[1] ?? "";

  const vizinhos = new Set();
  for (const m of html.matchAll(/(?:t\.me\/|>@)([a-zA-Z][a-zA-Z0-9_]{4,31})\b/g)) {
    const h = m[1].toLowerCase();
    if (!NAO_E_CANAL.has(h)) vizinhos.add(h);
  }

  return {
    posts: (html.match(/tgme_widget_message_text/g) || []).length,
    links: (html.match(LOJA) || []).length,
    nome: descodifica(meta("title")),
    descricao: descodifica(meta("description")).slice(0, 400),
    vizinhos: [...vizinhos],
  };
}

/** O t.me devolve as entidades HTML escapadas. */
function descodifica(t) {
  return t
    .replace(/&#33;/g, "!")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = url && chave ? createClient(url, chave, { auth: { persistSession: false } }) : null;

  // As sementes saem do banco quando há fonte cadastrada: assim cada
  // rodada parte de onde a anterior chegou, e o alcance cresce.
  let fila = SEMENTES;
  if (db) {
    const { data } = await db.from("fonte_descoberta").select("identificador");
    if (data && data.length > 0) fila = data.map((f) => f.identificador);
  }

  const vistos = new Map();

  for (let salto = 0; salto < SALTOS; salto++) {
    const lote = fila.filter((c) => !vistos.has(c)).slice(0, 120);
    if (lote.length === 0) break;

    const paginas = await Promise.all(lote.map(async (c) => [c, await paginaDoCanal(c)]));
    const proxima = new Set();

    for (const [canal, html] of paginas) {
      if (!html) {
        vistos.set(canal, null);
        continue;
      }
      const info = analisa(html);
      vistos.set(canal, info);
      if (info.posts > 0) for (const v of info.vizinhos) proxima.add(v);
    }

    console.error(`salto ${salto + 1}: ${lote.length} lidos, ${proxima.size} vizinhos`);
    fila = [...proxima];
  }

  const legiveis = [...vistos.entries()]
    .filter(([, i]) => i && i.posts > 0)
    .sort((a, b) => b[1].links - a[1].links);

  const rendem = legiveis.filter(([, i]) => i.links >= MINIMO_DE_LINKS);

  console.log(
    `\n${vistos.size} testados · ${legiveis.length} legíveis · ${rendem.length} com ${MINIMO_DE_LINKS}+ links de loja\n`,
  );
  for (const [canal, i] of legiveis) {
    const marca = i.links >= MINIMO_DE_LINKS ? "✓" : "·";
    console.log(`${marca} ${String(i.links).padStart(3)} links  ${canal.padEnd(26)} ${i.nome.slice(0, 40)}`);
  }

  if (!cadastra) {
    console.log(`\nUse --cadastra para gravar os ${rendem.length} que rendem, desativados.`);
    return;
  }
  if (!db) {
    console.error("\nFalta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY para cadastrar.");
    process.exit(1);
  }

  const { data: operacao } = await db.from("operacao").select("id").limit(1).single();
  let novas = 0;

  for (const [canal, i] of rendem) {
    const { data: existe } = await db
      .from("fonte_descoberta")
      .select("id")
      .eq("identificador", canal)
      .maybeSingle();

    const campos = {
      nome: i.nome,
      descricao: i.descricao,
      links_vistos: i.links,
      descoberta_em: new Date().toISOString(),
    };

    if (existe) {
      await db.from("fonte_descoberta").update(campos).eq("id", existe.id);
      continue;
    }

    const { error } = await db.from("fonte_descoberta").insert({
      operacao_id: operacao.id,
      plataforma: "telegram",
      identificador: canal,
      tipo_leitura: "web_publica",
      // Nasce DESLIGADA. Cadastrar sozinho é sugestão; ligar é
      // decisão de quem opera, e é o que a tela de Fontes existe para
      // fazer.
      ativo: false,
      ...campos,
    });
    if (!error) novas++;
  }

  console.log(`\n${novas} fontes novas cadastradas, todas desativadas — ligue em /colheita/fontes.`);
}

await main();
