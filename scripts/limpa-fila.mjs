/**
 * Cancela as publicações pendentes que não pertencem mais ao canal.
 *
 * POR QUE ELE EXISTE: a publicação é criada quando a oferta é aprovada
 * e só sai depois, no ritmo do canal. Entre uma coisa e outra pode
 * passar hora — e se o roteamento mudar nesse meio-tempo, a fila
 * continua carregando a decisão velha.
 *
 * Foi o que aconteceu em 01/08. A auditoria do dono mostrou carabina de
 * pressão no Radar Fitness e álbum da Copa no Radar Geek; o mapeamento
 * foi corrigido e o catálogo reclassificado, mas **as 336 publicações
 * já enfileiradas continuavam apontando para os canais errados**.
 * Corrigir o mapa não desfaz a fila.
 *
 * Ele confere as duas comportas que o publicador aplica, na mesma
 * ordem: o canal precisa declarar o nicho do produto, e o produto
 * precisa passar no filtro de atributo do canal.
 *
 * CANCELA, NÃO APAGA. `cancelada` é estado previsto e deixa rastro: dá
 * para responder depois "por que esta oferta nunca saiu". Apagar
 * deixaria a oferta `aprovada` sem publicação nenhuma, que é o desfecho
 * que a migration 16 chama de "some em silêncio".
 *
 * USO
 *
 *   node --env-file=.env.producao scripts/limpa-fila.mjs --seco
 *   node --env-file=.env.producao scripts/limpa-fila.mjs
 */

import { createClient } from "@supabase/supabase-js";

import { canalAceitaAtributos } from "../lib/canal-aceita.ts";

const SECO = process.argv.includes("--seco");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

async function main() {
  const { data: canais } = await db
    .from("canal")
    .select("id, nome, canal_nicho ( nicho_id ), canal_atributo ( atributo, valores, modo, exige_atributo, nicho_id )");

  const porId = new Map((canais ?? []).map((c) => [c.id, c]));

  // Paginado: o PostgREST devolve no máximo mil linhas, e a fila passou
  // disso na primeira noite dos sete canais.
  const pendentes = [];
  for (let de = 0; ; de += 1000) {
    const { data: pagina } = await db
      .from("publicacao")
      .select(
        "id, canal_id, oferta:oferta_id ( anuncio:anuncio_id ( produto:produto_id ( titulo_canonico, nicho_id, atributos ) ) )",
      )
      .eq("estado", "pendente")
      .range(de, de + 999);
    if (!pagina || pagina.length === 0) break;
    pendentes.push(...pagina);
    if (pagina.length < 1000) break;
  }

  console.log(`${pendentes.length} publicações na fila\n`);

  const porCanal = {};
  const cancelar = [];

  for (const p of pendentes) {
    const canal = porId.get(p.canal_id);
    const produto = p.oferta?.anuncio?.produto;
    if (!canal || !produto) continue;

    const aceitaNicho = (canal.canal_nicho ?? []).some((cn) => cn.nicho_id === produto.nicho_id);
    const aceitaAtributo = canalAceitaAtributos(
      (canal.canal_atributo ?? []).map((f) => ({
        ...f,
        exigeAtributo: f.exige_atributo,
        nichoId: f.nicho_id,
      })),
      produto.atributos,
      produto.nicho_id,
    );

    if (aceitaNicho && aceitaAtributo) continue;

    const motivo = !produto.nicho_id
      ? "produto ficou sem nicho"
      : !aceitaNicho
        ? "nicho não é mais do canal"
        : "não passa no filtro de atributo";

    cancelar.push({ id: p.id, canal: canal.nome, motivo, titulo: produto.titulo_canonico ?? "" });
    porCanal[canal.nome] = (porCanal[canal.nome] ?? 0) + 1;
  }

  for (const c of cancelar.slice(0, 30)) {
    console.log(`  ✗ ${c.canal.padEnd(22)} ${c.motivo.padEnd(30)} ${c.titulo.slice(0, 40)}`);
  }
  if (cancelar.length > 30) console.log(`  … e mais ${cancelar.length - 30}`);

  if (!SECO && cancelar.length > 0) {
    // Em lotes: `in` com milhares de uuids estoura o tamanho da URL.
    for (let i = 0; i < cancelar.length; i += 100) {
      const ids = cancelar.slice(i, i + 100).map((c) => c.id);
      await db
        .from("publicacao")
        .update({ estado: "cancelada", cancelada_em: new Date().toISOString() })
        .in("id", ids);
    }
  }

  console.log(`\n${cancelar.length} canceladas${SECO ? "  (SECO, nada gravado)" : ""}`);
  if (Object.keys(porCanal).length > 0) console.log(JSON.stringify(porCanal, null, 1));
}

await main();
