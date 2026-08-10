/**
 * Remarca `USO` e `GENDER` no catálogo com as regras de hoje.
 *
 * POR QUE UM SCRIPT E NÃO UMA MIGRATION. As regras vivem em
 * `lib/uso-do-produto.ts` e `lib/genero-pelo-titulo.ts`, com teste. Em
 * SQL elas teriam que ser reescritas, e aí passariam a existir duas
 * versões da mesma regra — que divergem em silêncio e só aparecem no
 * post errado. Este script importa as funções de verdade.
 *
 * QUANDO ELE PRECISOU EXISTIR, em 10/08: os filtros novos marcam o
 * produto no momento da coleta, e o catálogo já tinha 5 mil produtos
 * marcados pelas regras velhas. O ensaio do roteamento para o Radar
 * Delas mostrou barbeador Philips e máquina Kemei entrando na fila de
 * um grupo de mulheres, porque o `GENDER` deles nunca foi preenchido.
 *
 * O QUE ELE NÃO FAZ, de propósito:
 *
 *   Não sobrescreve atributo já preenchido. Se alguém marcou à mão, a
 *   mão ganha — é a mesma regra de `atributosComUso`.
 *
 *   Não apaga marcação. Ele só acrescenta o que as regras reconhecem
 *   agora. Desfazer marcação errada tem migration própria, e é decisão
 *   com nome (a 66 e a 68 já fizeram isso).
 *
 * O RECORTE É POR NICHO, e o padrão é `beleza,perfume`. Rodar no
 * catálogo inteiro mexeria em 1.778 produtos para resolver um problema
 * que é de dois nichos, e traria junto os falsos positivos da regra de
 * quantidade: "3x o.B. Sempre Livre 16UN" vira `USO=profissional`
 * porque "16 un" casa com a regra de atacado. Num grupo de beleza isso
 * não importa, porque absorvente não é do nicho; no catálogo inteiro,
 * importa.
 *
 * Rode com `--aplica` para escrever. Sem isso, ele só conta e mostra.
 * Use `--nichos=todos` para não recortar.
 */
import { createClient } from "@supabase/supabase-js";

import { atributosComGenero } from "../lib/genero-pelo-titulo.ts";
import { atributosComUso } from "../lib/uso-do-produto.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chave) {
  console.error("falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const aplica = process.argv.includes("--aplica");

const argNichos = process.argv.find((a) => a.startsWith("--nichos="));
const nichosAlvo =
  argNichos?.slice("--nichos=".length) === "todos"
    ? null
    : new Set((argNichos?.slice("--nichos=".length) ?? "beleza,perfume").split(","));
const db = createClient(url, chave, { auth: { persistSession: false } });

/*
  O volume só conta como sinal de salão em beleza e perfume. É a mesma
  ressalva da migration 56: shampoo de 1,5L é tamanho de salão, panela
  de 4,2L é panela.
*/
const VOLUME_CONTA = new Set(["beleza", "perfume"]);

const PAGINA = 1000;
let de = 0;
let lidos = 0;
const mudancas = [];

for (;;) {
  const { data, error } = await db
    .from("produto")
    .select("id, titulo_canonico, atributos, nicho:nicho_id ( slug )")
    .order("criado_em")
    .range(de, de + PAGINA - 1);

  if (error) {
    console.error("erro lendo produto:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;

  for (const p of data) {
    lidos++;
    const nicho = p.nicho?.slug ?? null;
    if (nichosAlvo && !nichosAlvo.has(nicho ?? "")) continue;
    const titulo = p.titulo_canonico ?? "";

    let atributos = p.atributos ?? {};
    let mudou = false;

    const comUso = atributosComUso(titulo, atributos, VOLUME_CONTA.has(nicho ?? ""));
    if (comUso) {
      atributos = comUso;
      mudou = true;
    }

    const comGenero = atributosComGenero(titulo, atributos);
    if (comGenero) {
      atributos = comGenero;
      mudou = true;
    }

    if (mudou) mudancas.push({ id: p.id, titulo, nicho, atributos });
  }

  de += PAGINA;
  if (data.length < PAGINA) break;
}

console.log(
  `${lidos} produtos lidos (recorte: ${nichosAlvo ? [...nichosAlvo].join(", ") : "todos"}), ` +
    `${mudancas.length} ganhariam atributo novo\n`,
);

const porMotivo = { USO: 0, GENDER: 0 };
for (const m of mudancas) {
  if (m.atributos.USO) porMotivo.USO++;
  if (m.atributos.GENDER) porMotivo.GENDER++;
}
console.log(`  USO preenchido:    ${porMotivo.USO}`);
console.log(`  GENDER preenchido: ${porMotivo.GENDER}\n`);

console.log("amostra:");
for (const m of mudancas.slice(0, 15)) {
  console.log(`  ${JSON.stringify(m.atributos).padEnd(34)} ${m.titulo.slice(0, 52)}`);
}

if (!aplica) {
  console.log("\nEnsaio. Rode com --aplica para escrever.");
  process.exit(0);
}

let escritos = 0;
for (const m of mudancas) {
  const { error } = await db.from("produto").update({ atributos: m.atributos }).eq("id", m.id);
  if (error) {
    console.error(`  ✗ ${m.id}: ${error.message}`);
    continue;
  }
  escritos++;
  if (escritos % 200 === 0) console.log(`  ... ${escritos}`);
}

console.log(`\n${escritos} produtos remarcados.`);
