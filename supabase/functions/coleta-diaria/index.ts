import { createClient } from "jsr:@supabase/supabase-js@2";

import { montaFontes } from "../_compartilhado/fontes/indice.ts";
import type { AnuncioParaColeta, MotivoFalha } from "../_compartilhado/tipos.ts";

/**
 * Coleta diária de preço.
 *
 * Chamada uma vez por dia pelo pg_cron. Pega os anúncios que
 * estão há mais tempo sem coleta, pergunta o preço à fonte de
 * cada loja e grava.
 *
 * Roda inteira hoje, mesmo sem nenhuma credencial: as lojas sem
 * fonte configurada são puladas e aparecem no resumo. Quando a
 * credencial do Mercado Livre chegar, esta função começa a
 * coletar de verdade sem precisar de nenhuma alteração aqui.
 *
 * Só coleta marketplaces com `base_de_historico = true`. A Amazon
 * fica de fora porque a política dela limita a retenção de preço
 * a 24 horas (D-003) — o ponto coletado seria apagado no dia
 * seguinte pelo expurgo.
 */

/** Quantos anúncios por execução. Segura o tempo total e o limite de requisição da loja. */
const TAMANHO_DO_LOTE = 200;

/** Requisições simultâneas. Baixo de propósito: melhor demorar que ser bloqueado. */
const SIMULTANEAS = 4;

Deno.serve(async (req: Request) => {
  // Só o pg_cron chama isto. O segredo evita que a URL da função,
  // que é pública, seja usada por qualquer um para gastar a cota
  // de requisição das lojas.
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

  const fontes = montaFontes(Deno.env.toObject());

  // Fila: ativos, de loja que forma histórico, há mais tempo sem
  // coleta. `nulls first` põe o anúncio recém-cadastrado na frente.
  const { data: anuncios, error: erroFila } = await db
    .from("anuncio")
    .select("id, sku_externo, url_original, marketplace:marketplace_id!inner(slug, base_de_historico)")
    .eq("ativo", true)
    .eq("marketplace.base_de_historico", true)
    .order("ultima_coleta_em", { ascending: true, nullsFirst: true })
    .limit(TAMANHO_DO_LOTE);

  if (erroFila) {
    return responde(500, { erro: `Não consegui montar a fila: ${erroFila.message}` });
  }

  const resumo = {
    consultados: anuncios?.length ?? 0,
    gravados: 0,
    pulados_sem_fonte: 0,
    falhas: {} as Record<MotivoFalha, number>,
    exemplos_de_falha: [] as string[],
    expurgados: 0,
  };

  await emLotes(anuncios ?? [], SIMULTANEAS, async (linha) => {
    const slug = (linha.marketplace as unknown as { slug: string }).slug;
    const fonte = fontes.get(slug as never);

    if (!fonte || !fonte.configurada()) {
      resumo.pulados_sem_fonte++;
      return;
    }

    const anuncio: AnuncioParaColeta = {
      id: linha.id,
      skuExterno: linha.sku_externo,
      urlOriginal: linha.url_original,
    };

    const leitura = await fonte.lePreco(anuncio);

    if (!leitura.ok) {
      resumo.falhas[leitura.motivo] = (resumo.falhas[leitura.motivo] ?? 0) + 1;
      if (resumo.exemplos_de_falha.length < 5) {
        resumo.exemplos_de_falha.push(`${anuncio.skuExterno}: ${leitura.detalhe}`);
      }
      // Marca a tentativa mesmo tendo falhado, senão o mesmo
      // anúncio problemático fica eternamente no topo da fila e
      // impede os outros de serem coletados.
      await db
        .from("anuncio")
        .update({ ultima_coleta_em: new Date().toISOString() })
        .eq("id", anuncio.id);
      return;
    }

    const { error } = await db.rpc("registra_preco", {
      p_anuncio_id: anuncio.id,
      p_preco_centavos: leitura.precoCentavos,
      p_disponivel: leitura.disponivel,
    });

    if (error) {
      resumo.falhas.temporario = (resumo.falhas.temporario ?? 0) + 1;
      if (resumo.exemplos_de_falha.length < 5) {
        resumo.exemplos_de_falha.push(`${anuncio.skuExterno}: ao gravar, ${error.message}`);
      }
      return;
    }

    resumo.gravados++;
  });

  // Limpa o que passou do teto de retenção de cada loja.
  const { data: expurgados } = await db.rpc("expurga_precos_expirados");
  resumo.expurgados = typeof expurgados === "number" ? expurgados : 0;

  return responde(200, resumo);
});

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
        // Falha de um anúncio não pode derrubar a coleta inteira.
        // O motivo já foi contabilizado quando dava; aqui é rede
        // caindo no meio, e o próximo dia tenta de novo.
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
