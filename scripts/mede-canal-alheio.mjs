/**
 * Mede o ALCANCE de um canal alheio do Telegram, por fora, sem entrar.
 *
 * POR QUE ISTO EXISTE: a decisão D-069 põe R$200 num post pago em canal
 * de terceiro, e o preço de mercado é cobrado por INSCRITO. Inscrito é
 * a métrica errada, e a prova está no próprio repositório
 * (`docs/concorrentes-lidos.md`): o BenchPromos tem 116 mil inscritos e
 * 0,3% de alcance, enquanto o Esser Moda tem 1.800 e 7%. O de 1.800
 * entrega mais gente de verdade por post.
 *
 * Comprar por inscrito, portanto, é comprar às cegas. Este script
 * devolve o número que decide: **views por post dividido por
 * inscritos**.
 *
 * A FONTE É PÚBLICA E NÃO EXIGE NADA. A página `t.me/s/<canal>` mostra
 * os últimos posts com a contagem de visualizações. É a mesma leitura
 * que `scripts/descobre-fontes.mjs` já faz para colher ofertas, sem
 * bot, sem login e sem permissão.
 *
 * DUAS RESSALVAS QUE MUDAM A LEITURA, e ignorá-las faz o número mentir:
 *
 * 1. **View acumula com o tempo.** Post de dez minutos tem menos view
 *    que post de seis horas, e não é porque foi pior. Por isso o script
 *    usa a MEDIANA dos posts mais antigos da página, não a média de
 *    todos, e descarta os mais recentes.
 * 2. **Preview desligado devolve nada.** Canal pode esconder a página
 *    pública (o Esser Perfumaria esconde). Aí não dá para medir por
 *    fora e só entrando como membro.
 *
 * COMO LER O RESULTADO
 *
 *   abaixo de 1%  ·  não pague. Inscrito comprado ou audiência morta
 *   1% a 3%       ·  normal para canal de oferta brasileiro
 *   acima de 5%   ·  é onde o dinheiro rende
 *
 * USO
 *
 *   node scripts/mede-canal-alheio.mjs promoloucas centraldepromos
 *   node scripts/mede-canal-alheio.mjs --arquivo=candidatos.txt
 *
 * Não toca no banco e não precisa de credencial nenhuma.
 */

import { readFileSync } from "node:fs";

const ARQUIVO = process.argv
  .find((a) => a.startsWith("--arquivo="))
  ?.slice("--arquivo=".length);

const handles = ARQUIVO
  ? readFileSync(ARQUIVO, "utf8")
      .split("\n")
      .map((l) => l.trim().replace(/^@/, ""))
      .filter((l) => l && !l.startsWith("#"))
  : process.argv.slice(2).filter((a) => !a.startsWith("--")).map((a) => a.replace(/^@/, ""));

if (handles.length === 0) {
  console.error("Passe um ou mais @canal, ou --arquivo=lista.txt");
  process.exit(1);
}

/** "4.76K" e "1.2M" viram número. O Telegram abrevia acima de mil. */
function numero(texto) {
  if (!texto) return null;
  const limpo = texto.replace(/\s/g, "").replace(",", ".");
  const m = limpo.match(/^([\d.]+)([KM])?/i);
  if (!m) return null;
  const base = parseFloat(m[1]);
  if (Number.isNaN(base)) return null;
  const escala = m[2]?.toUpperCase() === "M" ? 1e6 : m[2]?.toUpperCase() === "K" ? 1e3 : 1;
  return Math.round(base * escala);
}

function mediana(lista) {
  if (lista.length === 0) return null;
  const o = [...lista].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? o[meio] : Math.round((o[meio - 1] + o[meio]) / 2);
}

async function mede(handle) {
  let html;
  try {
    const r = await fetch(`https://t.me/s/${handle}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return { handle, erro: `HTTP ${r.status}` };
    html = await r.text();
  } catch (e) {
    return { handle, erro: e.message };
  }

  const inscritos = numero(
    html.match(/tgme_channel_info_counter"><span class="counter_value">([^<]+)/)?.[1],
  );
  if (inscritos === null) {
    return { handle, erro: "sem página pública (preview desligado ou não existe)" };
  }

  const views = [...html.matchAll(/tgme_widget_message_views">([^<]+)</g)]
    .map((m) => numero(m[1]))
    .filter((n) => n !== null);

  // Os primeiros da página são os mais ANTIGOS, e é neles que a view já
  // amadureceu. Os últimos são de minutos atrás e puxariam o número
  // para baixo sem que o canal seja pior.
  const maduras = views.slice(0, Math.max(1, Math.floor(views.length / 2)));
  const med = mediana(maduras);

  if (med === null) {
    return { handle, erro: `${inscritos} inscritos, mas nenhum post com view legível` };
  }

  // Canal minúsculo faz a porcentagem mentir com confiança: 2 views para
  // 1 inscrito dá 200% de "alcance" e não quer dizer nada. Abaixo de 500
  // inscritos não existe post pago que valha a pena mesmo, então o corte
  // não perde candidato de verdade.
  if (inscritos < 500) {
    return { handle, erro: `só ${inscritos} inscritos, pequeno demais para medir ou comprar` };
  }

  return {
    handle,
    inscritos,
    posts_lidos: views.length,
    views_medianas: med,
    alcance: (med / inscritos) * 100,
  };
}

const resultados = [];
for (const h of handles) {
  resultados.push(await mede(h));
}

const ok = resultados.filter((r) => !r.erro && r.alcance !== null);
const ruins = resultados.filter((r) => r.erro || r.alcance === null);

ok.sort((a, b) => b.alcance - a.alcance);

console.log(
  "\n" +
    "canal".padEnd(24) +
    "inscritos".padStart(10) +
    "views".padStart(8) +
    "alcance".padStart(10) +
    "  veredito",
);
console.log("-".repeat(72));

for (const r of ok) {
  const veredito =
    r.alcance >= 5 ? "vale o dinheiro" : r.alcance >= 1 ? "normal" : "NÃO PAGUE";
  console.log(
    `@${r.handle}`.padEnd(24) +
      String(r.inscritos).padStart(10) +
      String(r.views_medianas).padStart(8) +
      `${r.alcance.toFixed(2)}%`.padStart(10) +
      "  " +
      veredito,
  );
}

for (const r of ruins) {
  console.log(`@${r.handle}`.padEnd(24) + `  ${r.erro}`);
}

console.log(
  "\nAlcance = views medianas ÷ inscritos. Abaixo de 1% é inscrito morto ou comprado.",
);
console.log(
  "Lembre que view acumula: o script já usa os posts mais antigos da página para compensar.",
);
