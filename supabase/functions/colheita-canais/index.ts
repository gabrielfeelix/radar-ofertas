import { createClient } from "jsr:@supabase/supabase-js@2";

import { leLinkDeProduto } from "../../../lib/marketplaces.ts";
import {
  extraiPrecoAlegado,
  leCanalPublico,
  limpaTitulo,
  pareceLinkDeProduto,
  resolveLink,
  type PostDoCanal,
} from "../_compartilhado/telegram-web.ts";

/**
 * Colheita de canais de terceiros (D-012).
 *
 * Lê canais públicos, acha links de produto, descobre qual anúncio
 * é cada um e cadastra no catálogo o que ainda não conhecemos.
 *
 * Nada do que é colhido vira oferta aqui. A candidata entra no
 * radar e passa a acumular série; se está barata mesmo, quem
 * decide é `avalia_anuncios`, pelas mesmas duas comportas de
 * qualquer outro anúncio.
 *
 * O leitor de link vem de `lib/marketplaces.ts` — o MESMO que o
 * painel usa. Duas implementações da mesma regra divergiriam, e
 * aí o link colado à mão e o link colhido virariam anúncios
 * diferentes para o mesmo produto, partindo a série em duas.
 */

/** Canais por execução. Baixo de propósito: melhor demorar que incomodar. */
const CANAIS_POR_VEZ = 5;

/** Links resolvidos ao mesmo tempo. Cada um é uma requisição a uma loja. */
const RESOLUCOES_SIMULTANEAS = 3;

/** Teto de links por canal, para uma mensagem cheia de links não dominar a execução. */
const LINKS_POR_CANAL = 60;

Deno.serve(async (req: Request) => {
  const segredoEsperado = Deno.env.get("COLETA_SEGREDO");
  if (!segredoEsperado) {
    return responde(500, { erro: "COLETA_SEGREDO não está configurado na função." });
  }
  if (req.headers.get("x-coleta-segredo") !== segredoEsperado) {
    return responde(401, { erro: "Segredo ausente ou incorreto." });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: fontes, error: erroFontes } = await db
    .from("fonte_descoberta")
    .select("id, identificador, nome, tipo_leitura, ultimo_post_id")
    .eq("ativo", true)
    .eq("tipo_leitura", "web_publica")
    .order("ultima_leitura_em", { ascending: true, nullsFirst: true })
    .limit(CANAIS_POR_VEZ);

  if (erroFontes) {
    return responde(500, { erro: `Não consegui montar a fila: ${erroFontes.message}` });
  }

  const resumo = {
    canais_lidos: 0,
    posts_vistos: 0,
    links_candidatos: 0,
    anuncios_novos: 0,
    ja_conhecidos: 0,
    descartados: 0,
    falhas: [] as string[],
    por_canal: [] as Array<Record<string, unknown>>,
  };

  for (const fonte of fontes ?? []) {
    let posts: PostDoCanal[];

    try {
      posts = await leCanalPublico(fonte.identificador);
    } catch (erro) {
      resumo.falhas.push(`@${fonte.identificador}: ${(erro as Error).message}`);
      await marcaLeitura(db, fonte.id, fonte.ultimo_post_id);
      continue;
    }

    resumo.canais_lidos++;

    // Só o que ainda não foi visto. Sem isto, cada passada
    // reprocessaria a página inteira e gastaria requisição à toa.
    const novos = posts.filter((p) => p.id > (fonte.ultimo_post_id ?? 0));
    resumo.posts_vistos += novos.length;

    const candidatos: Array<{ post: PostDoCanal; url: string }> = [];
    for (const post of novos) {
      for (const url of post.links) {
        if (pareceLinkDeProduto(url)) candidatos.push({ post, url });
      }
    }

    const recortados = candidatos.slice(0, LINKS_POR_CANAL);
    if (recortados.length < candidatos.length) {
      resumo.falhas.push(
        `@${fonte.identificador}: ${candidatos.length - recortados.length} links ficaram para a próxima passada.`,
      );
    }
    resumo.links_candidatos += recortados.length;

    const antes = { ...resumo };

    await emLotes(recortados, RESOLUCOES_SIMULTANEAS, async ({ post, url }) => {
      let resolvida: string;
      try {
        resolvida = await resolveLink(url);
      } catch (erro) {
        await db.from("mencao").insert({
          fonte_id: fonte.id,
          post_externo_id: post.id,
          url_bruta: url,
          resultado: "erro",
          detalhe: (erro as Error).message.slice(0, 300),
          publicada_em: post.publicadaEm,
          processada_em: new Date().toISOString(),
        });
        resumo.descartados++;
        return;
      }

      const leitura = leLinkDeProduto(resolvida);

      if (!leitura.ok) {
        await db.from("mencao").insert({
          fonte_id: fonte.id,
          post_externo_id: post.id,
          url_bruta: url,
          url_resolvida: resolvida,
          resultado: leitura.erro.motivo === "loja_desconhecida"
            ? "loja_desconhecida"
            : "nao_reconhecido",
          detalhe: leitura.erro.mensagem.slice(0, 300),
          publicada_em: post.publicadaEm,
          processada_em: new Date().toISOString(),
        });
        resumo.descartados++;
        return;
      }

      const { data: resultado, error } = await db.rpc("registra_mencao", {
        p_fonte_id: fonte.id,
        p_post_externo_id: post.id,
        p_url_bruta: url,
        p_url_resolvida: leitura.link.urlLimpa,
        p_marketplace_slug: leitura.link.marketplaceSlug,
        p_sku: leitura.link.sku,
        // Primeira linha da mensagem costuma ser o nome do produto.
        // É título fraco e provisório: o bom vem da fonte oficial
        // na primeira coleta de preço.
        p_titulo: primeiraLinha(post.texto),
        p_preco_centavos: extraiPrecoAlegado(post.texto),
        p_publicada_em: post.publicadaEm,
      });

      if (error) {
        resumo.falhas.push(`${leitura.link.sku}: ${error.message}`);
        resumo.descartados++;
        return;
      }

      if (resultado === "anuncio_novo") resumo.anuncios_novos++;
      else if (resultado === "anuncio_existente") resumo.ja_conhecidos++;
      else resumo.descartados++;
    });

    const ultimoPost = posts.reduce((maior, p) => Math.max(maior, p.id), fonte.ultimo_post_id ?? 0);
    await marcaLeitura(db, fonte.id, ultimoPost);

    resumo.por_canal.push({
      canal: fonte.identificador,
      posts_novos: novos.length,
      links: recortados.length,
      anuncios_novos: resumo.anuncios_novos - antes.anuncios_novos,
      ja_conhecidos: resumo.ja_conhecidos - antes.ja_conhecidos,
    });
  }

  return responde(200, resumo);
});

async function marcaLeitura(
  db: ReturnType<typeof createClient>,
  fonteId: string,
  ultimoPostId: number | null,
) {
  await db
    .from("fonte_descoberta")
    .update({ ultima_leitura_em: new Date().toISOString(), ultimo_post_id: ultimoPostId })
    .eq("id", fonteId);
}

function primeiraLinha(texto: string): string {
  const linha = texto
    .split("\n")
    .map((l) => limpaTitulo(l))
    .find((l) => l.length >= 8);
  return (linha ?? limpaTitulo(texto)).slice(0, 120);
}

/** Roda a tarefa sobre a lista com no máximo `limite` em paralelo. */
async function emLotes<T>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<void>,
): Promise<void> {
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const indice = proximo++;
      try {
        await tarefa(itens[indice]);
      } catch {
        // Falha de um link não derruba a colheita inteira.
      }
    }
  });
  await Promise.all(trabalhadores);
}

function responde(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
