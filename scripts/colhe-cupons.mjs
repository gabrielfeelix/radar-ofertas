/**
 * Colhe cupons do Mercado Livre do texto dos canais públicos.
 *
 * POR QUE ESTE SCRIPT EXISTE, e não é duplicação: a extração de cupom
 * também vive em `colheita-canais`, que é Edge Function. Só que a
 * colheita **não é disparada por nenhum workflow** — ela roda à mão. Um
 * cupom que só entra quando alguém lembra de rodar a colheita não
 * serve, porque o cupom do ML vale um dia.
 *
 * Então a ingestão de cupom entra no agendador horário, junto da coleta
 * e da publicação, que é onde o resto do laço automático já vive.
 *
 * A REGRA MORA NUM LUGAR SÓ: `extraiCupons` e `validadeDoCupom` estão
 * em `_compartilhado/telegram-web.ts` e são as mesmas que a Edge
 * Function usa. Aqui só há o laço e a gravação.
 *
 * É BARATO: uma página por canal, que é o que cabe num cupom de
 * validade diária. Escavar histórico não faz sentido para cupom.
 *
 * SÓ MERCADO LIVRE, e a exclusão da Shopee é contratual: o termo do
 * programa de afiliados dela trata repassar cupom de terceiro como
 * violação, com rescisão imediata e retenção de comissão já ganha.
 */

import { createClient } from "@supabase/supabase-js";

import {
  extraiCupons,
  leCanalPublico,
  validadeDoCupom,
} from "../supabase/functions/_compartilhado/telegram-web.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CHAVE;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });
const SECO = process.argv.includes("--seco");

async function main() {
  const { data: mkt } = await db
    .from("marketplace")
    .select("id")
    .eq("slug", "mercado_livre")
    .maybeSingle();

  if (!mkt) {
    console.error("Marketplace mercado_livre não encontrado.");
    process.exit(1);
  }

  /*
    O ESCOPO DO CUPOM, e é o que impede o erro da mangueira de jardim.

    Na primeira madrugada automática saíram três posts no canal de pet
    e dois eram de outro nicho. O cupom reabriria essa porta:
    `MODAEBELEZA0108` num canal de pet é a mesma coisa com outra roupa.

    A regra é a da D-036: **desconhecido separa, não é ignorado.**
    Prefixo sem linha em `cupom_prefixo` entra no banco com `geral =
    false` e `nicho_id` nulo, e nessa combinação o post nunca sai.
    Mapear um prefixo novo é trabalho de trinta segundos numa tabela,
    não de publicar versão (D-023).
  */
  const { data: prefixos } = await db
    .from("cupom_prefixo")
    .select("prefixo, nicho_id, geral");

  const escopoDe = new Map((prefixos ?? []).map((p) => [p.prefixo, p]));

  const { data: fontes } = await db
    .from("fonte_descoberta")
    .select("id, operacao_id, identificador")
    .eq("ativo", true)
    .eq("plataforma", "telegram")
    .eq("tipo_leitura", "web_publica");

  console.log(`${(fontes ?? []).length} canais\n`);

  const agora = new Date();
  const vistos = new Map();
  let lidos = 0;

  for (const fonte of fontes ?? []) {
    try {
      const posts = await leCanalPublico(fonte.identificador, { paginas: 1 });
      lidos++;

      for (const post of posts) {
        for (const c of extraiCupons(post.texto)) {
          // O mesmo cupom aparece em vários canais no mesmo dia — foi
          // assim que a pesquisa o encontrou. Guarda o primeiro e
          // registra em quantos canais apareceu, que é o sinal mais
          // barato de que o cupom é real e não erro de digitação.
          const antes = vistos.get(c.codigo);
          if (antes) antes.canais.add(fonte.identificador);
          else vistos.set(c.codigo, { ...c, operacaoId: fonte.operacao_id, canais: new Set([fonte.identificador]) });
        }
      }
    } catch (e) {
      console.log(`  ✗ @${fonte.identificador}: ${e.message}`);
    }
  }

  console.log(`${lidos} canais lidos · ${vistos.size} cupons distintos\n`);

  let gravados = 0;
  let vencidos = 0;

  for (const c of vistos.values()) {
    const ate = validadeDoCupom(c.dia, c.mes, agora);
    if (!ate) {
      vencidos++;
      continue;
    }

    // O prefixo é o código sem o `DDMM` do fim.
    const prefixo = c.codigo.slice(0, -4);
    const escopo = escopoDe.get(prefixo);

    const emQuantos = c.canais.size;
    const marca = escopo?.geral
      ? "geral"
      : escopo?.nicho_id
        ? "de nicho"
        : "SEM MAPA (não publica)";
    const linha =
      `${c.codigo.padEnd(22)} ${String(c.percentual).padStart(2)}%  ` +
      `min ${(c.minimoCentavos / 100).toFixed(2).padStart(7)}  ` +
      `teto ${c.tetoCentavos != null ? (c.tetoCentavos / 100).toFixed(2).padStart(6) : "     —"}  ` +
      `vence ${String(c.dia).padStart(2, "0")}/${String(c.mes).padStart(2, "0")}  ` +
      `em ${emQuantos} ${emQuantos > 1 ? "canais" : "canal"}  ${marca}`;

    if (SECO) {
      console.log(`  · ${linha}`);
      continue;
    }

    const { error } = await db.from("cupom").upsert(
      {
        operacao_id: c.operacaoId,
        marketplace_id: mkt.id,
        codigo: c.codigo,
        descricao: `${c.percentual}% colhido de ${emQuantos} ${emQuantos > 1 ? "canais" : "canal"}`,
        tipo: "percentual",
        valor: c.percentual,
        valor_minimo_centavos: c.minimoCentavos,
        teto_desconto_centavos: c.tetoCentavos,
        vigente_ate: ate.toISOString(),
        nicho_id: escopo?.nicho_id ?? null,
        geral: escopo?.geral ?? false,
      },
      { onConflict: "operacao_id,marketplace_id,codigo", ignoreDuplicates: true },
    );

    if (error) console.log(`  ✗ ${c.codigo}: ${error.message}`);
    else {
      gravados++;
      console.log(`  ✓ ${linha}`);
    }
  }

  console.log(
    `\n${SECO ? "(seco) " : ""}${gravados} gravados · ${vencidos} descartados por já terem vencido`,
  );
}

await main();
