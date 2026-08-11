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

import { escopoDoCupom } from "../lib/escopo-do-cupom.ts";
import { escopoPeloTexto } from "../lib/escopo-pelo-texto.ts";
import {
  extraiCupons,
  fimDoDiaEmSaoPaulo,
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

  // A busca é por PREFIXO, e o mais longo ganha. Igualdade exata só
  // funcionava enquanto todo cupom trazia `DDMM` no fim; sem data, o
  // "prefixo" é o código inteiro e nada casava (`lib/escopo-do-cupom.ts`).
  const listaDeEscopos = prefixos ?? [];

  /*
    O nicho por slug, para o escopo lido do texto virar `nicho_id`.

    `lib/escopo-pelo-texto.ts` devolve slug e não id de propósito: ele é
    regra pura, testável sem banco, e não deve saber o uuid de nada.
    A tradução mora aqui, que é quem já fala com o banco.
  */
  const { data: nichos } = await db.from("nicho").select("id, slug");
  const nichoPorSlug = new Map((nichos ?? []).map((n) => [n.slug, n.id]));

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
          /*
            O NOME DO CANAL NÃO É CUPOM.

            `@CupomDoGnu` assina os posts dele com o próprio nome, e o
            caminho do rótulo leu `CUPOMDOGNU` como código na primeira
            rodada. É específico de quem lê, então mora aqui e não no
            extrator, que não sabe de onde o texto veio.
          */
          if (c.codigo.toUpperCase() === fonte.identificador.toUpperCase()) continue;
          // O mesmo cupom aparece em vários canais no mesmo dia — foi
          // assim que a pesquisa o encontrou. Guarda o primeiro e
          // registra em quantos canais apareceu, que é o sinal mais
          // barato de que o cupom é real e não erro de digitação.
          const antes = vistos.get(c.codigo);
          if (!antes) {
            vistos.set(c.codigo, {
              ...c,
              operacaoId: fonte.operacao_id,
              canais: new Set([fonte.identificador]),
            });
            continue;
          }

          antes.canais.add(fonte.identificador);

          /*
            QUANDO OS CANAIS DISCORDAM, VALE O QUE PROMETE MENOS.

            Medido em 01/08 no mesmo cupom, no mesmo dia:

              @CupomDoGnu   MODAEBELEZA0108  20%  mínimo R$ 59  teto R$ 20
              @promotop     MODAEBELEZA0108  20%  mínimo R$ 49  teto R$ 30

            Um dos dois está errado, e não temos como saber qual: nós
            lemos o cupom do texto de terceiro, não do Mercado Livre.

            Errar para o lado generoso custa a confiança do grupo: quem
            chega no carrinho com R$ 50 esperando desconto e descobre
            que o mínimo é R$ 59 não volta. Errar para o lado apertado
            custa uma surpresa boa.

            Então: maior mínimo, menor teto, menor percentual. É a regra
            3.4 aplicada ao cupom — na dúvida, prometa menos.
          */
          antes.percentual = Math.min(antes.percentual, c.percentual);
          antes.minimoCentavos = Math.max(antes.minimoCentavos, c.minimoCentavos);
          if (c.tetoCentavos != null) {
            antes.tetoCentavos =
              antes.tetoCentavos == null ? c.tetoCentavos : Math.min(antes.tetoCentavos, c.tetoCentavos);
          }
        }
      }
    } catch (e) {
      console.log(`  ✗ @${fonte.identificador}: ${e.message}`);
    }
  }

  console.log(`${lidos} canais lidos · ${vistos.size} cupons distintos\n`);

  let gravados = 0;
  let destravados = 0;
  let vencidos = 0;

  for (const c of vistos.values()) {
    /*
      O PRAZO DE QUEM NÃO TRAZ DATA NO CÓDIGO.

      O cupom achado pelo rótulo (`FASHIONML`, `PIPOCA`) não diz até
      quando vale, e o comentário da tabela `cupom` já avisava qual é o
      desfecho ruim: *"cupom sem prazo é o que fica publicado depois de
      morrer"*. Publicar código morto queima mais confiança do que não
      publicar cupom nenhum.

      Então o prazo é o mais curto que faz sentido: **o fim do dia em
      São Paulo** (regra 3.9). Se o cupom durar mais que isso, a
      colheita da hora seguinte o traz de volta com prazo novo, e o
      custo de errar para menos é um cupom bom que sai de cartaz cedo.
      Errar para mais é prometer desconto que não existe.
    */
    const ate =
      c.dia != null && c.mes != null
        ? validadeDoCupom(c.dia, c.mes, agora)
        : fimDoDiaEmSaoPaulo(agora);

    if (!ate) {
      vencidos++;
      continue;
    }

    // O prefixo é o código sem o `DDMM` do fim. Sem data, o código
    // inteiro é o prefixo, e é assim que ele é mapeado em
    // `cupom_prefixo`.
    const porPrefixo = escopoDoCupom(c.codigo, listaDeEscopos);

    /*
      O TEXTO ENTRA ONDE O PREFIXO NÃO ALCANÇA.

      Medido em 11/08: 67 dos 76 cupons colhidos estavam parados por
      não casarem com nenhum dos dez prefixos cadastrados, e o último
      post de cupom tinha saído em 01/08. O Mercado Livre inventa nome
      novo toda semana (`DROGARIA`, `PAYDAY`, `TOMACUPOM`), então
      cadastrar prefixo é enxugar gelo.

      O escopo estava escrito no post o tempo todo, em português:
      *"10% OFF no site"* vale em qualquer canal, *"seleção de
      produtos"* não vale em nenhum. Ver `lib/escopo-pelo-texto.ts`.

      O PREFIXO CONTINUA GANHANDO, e a ordem importa: ele é curadoria
      nossa, conferida uma vez e reaproveitada; o texto é leitura de
      frase de terceiro. Onde os dois falam, vale o nosso.
    */
    const porTexto = porPrefixo ? null : escopoPeloTexto(c.contexto);
    const escopo = porPrefixo ?? (porTexto
      ? { geral: porTexto.geral, nicho_id: porTexto.nichoSlug ? (nichoPorSlug.get(porTexto.nichoSlug) ?? null) : null }
      : null);

    // Categoria nomeada que não existe como nicho nosso não vira geral
    // por acidente: sem `nicho_id` o cupom volta a ser inerte.
    const escopoValido = escopo && (escopo.geral || escopo.nicho_id) ? escopo : null;

    const emQuantos = c.canais.size;
    const marca = escopoValido?.geral
      ? `geral${porTexto ? " (pelo texto)" : ""}`
      : escopoValido?.nicho_id
        ? `de nicho${porTexto ? " (pelo texto)" : ""}`
        : "SEM MAPA (não publica)";
    const linha =
      `${c.codigo.padEnd(22)} ${String(c.percentual).padStart(2)}%  ` +
      `min ${(c.minimoCentavos / 100).toFixed(2).padStart(7)}  ` +
      `teto ${c.tetoCentavos != null ? (c.tetoCentavos / 100).toFixed(2).padStart(6) : "     —"}  ` +
      `vence ${
        c.dia != null
          ? `${String(c.dia).padStart(2, "0")}/${String(c.mes).padStart(2, "0")}`
          : "hoje "
      }  ` +
      `em ${emQuantos} ${emQuantos > 1 ? "canais" : "canal"}  ${marca}`;

    if (SECO) {
      console.log(`  · ${linha}`);
      continue;
    }

    const { data, error } = await db.from("cupom").upsert(
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
        nicho_id: escopoValido?.nicho_id ?? null,
        geral: escopoValido?.geral ?? false,
      },
      { onConflict: "operacao_id,marketplace_id,codigo", ignoreDuplicates: true },
    )
      // `select` depois de `ignoreDuplicates` devolve SÓ o que entrou.
      // Sem isto o contador dizia "2 gravados" para dois cupons que já
      // estavam no banco, e log que mente é pior que log que falta.
      .select("id");

    if (error) console.log(`  ✗ ${c.codigo}: ${error.message}`);
    else if ((data ?? []).length > 0) {
      gravados++;
      console.log(`  ✓ ${linha}`);
    } else if (escopoValido) {
      /*
        O CUPOM QUE JÁ ESTAVA E NASCEU INERTE.

        `ignoreDuplicates` protege o valor do cupom de ser sobrescrito
        por uma leitura pior de outro canal, e isso continua certo. Mas
        ele também congelava o ESCOPO: um cupom gravado antes desta
        regra, ou gravado pela colheita da Edge Function (que não lê
        escopo nenhum), ficava `geral = false` com nicho nulo para
        sempre — e essa combinação nunca publica.

        Era o estado de 67 dos 76 cupons do banco em 11/08.

        Então o escopo, e SÓ ele, é preenchido depois. O `is null` e o
        `eq false` no filtro são o que impede isto de virar
        sobrescrita: quem já tem escopo não é tocado, inclusive o que
        foi decidido à mão.
      */
      const { data: destravado } = await db
        .from("cupom")
        .update({ nicho_id: escopoValido.nicho_id ?? null, geral: escopoValido.geral ?? false })
        .eq("operacao_id", c.operacaoId)
        .eq("marketplace_id", mkt.id)
        .eq("codigo", c.codigo)
        .eq("geral", false)
        .is("nicho_id", null)
        .select("id");

      if ((destravado ?? []).length > 0) {
        destravados++;
        console.log(`  ↑ ${linha} (estava inerte, ganhou escopo)`);
      } else {
        console.log(`  = ${linha} (já estava)`);
      }
    } else {
      console.log(`  = ${linha} (já estava)`);
    }
  }

  console.log(
    `\n${SECO ? "(seco) " : ""}${gravados} gravados · ${destravados} destravados · ${vencidos} descartados por já terem vencido`,
  );
}

await main();
