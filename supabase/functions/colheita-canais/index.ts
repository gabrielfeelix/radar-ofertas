import { createClient } from "jsr:@supabase/supabase-js@2";

import { leLinkDeProduto } from "../../../lib/marketplaces.ts";
import {
  extraiCupons,
  extraiPrecoAlegado,
  leCanalPublico,
  limpaTitulo,
  pareceLinkDeProduto,
  resolveLink,
  validadeDoCupom,
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

/**
 * Páginas de ~20 posts que a ATUALIZAÇÃO pode voltar.
 *
 * Uma só bastava quando o canal publicava devagar. Canal de oferta
 * grande publica vinte posts por hora, e entre duas execuções da
 * rotina cabe mais de uma página: com teto 1, tudo que passasse disso
 * era perdido em silêncio, e a perda não aparecia em lugar nenhum.
 */
const PAGINAS_ATUALIZANDO = 4;

/**
 * Páginas que a ESCAVAÇÃO desce por passada, por canal.
 *
 * Escavar é trabalho de fundo e não tem pressa: o histórico já
 * aconteceu e não vai a lugar nenhum. Descer devagar em toda passada
 * chega mais fundo, ao longo do dia, do que uma varredura grande que
 * estoura o tempo da função.
 */
const PAGINAS_ESCAVANDO = 6;

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
    // A operação vem junto: as menções descartadas são inseridas
    // direto na tabela, e `mencao.operacao_id` é NOT NULL. Só o
    // caminho feliz passa por `registra_mencao`, que resolve a
    // operação sozinha por ser security definer.
    .select(
      "id, operacao_id, identificador, nome, tipo_leitura, ultimo_post_id, primeiro_post_id, escavacao_concluida",
    )
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
    escavados: 0,
    ja_conhecidos: 0,
    descartados: 0,
    cupons_novos: 0,
    falhas: [] as string[],
    por_canal: [] as Array<Record<string, unknown>>,
  };

  // O cupom colhido é só do Mercado Livre, e a exclusão da Shopee é
  // contratual: o termo do programa de afiliados dela trata repassar
  // cupom de terceiro como violação, com rescisão imediata.
  const { data: mktML } = await db
    .from("marketplace")
    .select("id")
    .eq("slug", "mercado_livre")
    .maybeSingle();
  const mercadoLivreId: string | null = mktML?.id ?? null;

  for (const fonte of fontes ?? []) {
    let posts: PostDoCanal[];

    /*
      DUAS LEITURAS POR CANAL, e elas respondem perguntas diferentes.

      A primeira ATUALIZA: desce do topo até alcançar o que já
      conhecemos. É o que traz a oferta de agora.

      A segunda ESCAVA: continua de onde a passada anterior parou,
      indo para trás. É o que constrói o histórico, e foi o pedido do
      dono: "foi postado na semana passada com o valor de oitocentos
      reais, e agora até por setecentos".

      Separadas de propósito. Juntas, um canal com muito atraso
      consumiria o orçamento inteiro atualizando e nunca escavaria, ou
      o contrário: o histórico chegaria e a oferta de hoje se perderia.
    */
    try {
      posts = await leCanalPublico(fonte.identificador, {
        paginas: PAGINAS_ATUALIZANDO,
        ateOPost: fonte.ultimo_post_id,
      });
    } catch (erro) {
      resumo.falhas.push(`@${fonte.identificador}: ${(erro as Error).message}`);
      await marcaLeitura(db, fonte.id, fonte.ultimo_post_id);
      continue;
    }

    let fundoNovo: number | null = fonte.primeiro_post_id ?? null;
    let acabou = fonte.escavacao_concluida ?? false;

    if (!acabou) {
      try {
        const antigos = await leCanalPublico(fonte.identificador, {
          paginas: PAGINAS_ESCAVANDO,
          antesDe: fonte.primeiro_post_id ?? null,
        });

        const menor = antigos.length > 0 ? Math.min(...antigos.map((p) => p.id)) : null;

        // Não desceu nada: ou o canal acabou, ou a preview dele para
        // aqui. Nos dois casos insistir é gastar requisição por nada.
        if (menor === null || (fonte.primeiro_post_id != null && menor >= fonte.primeiro_post_id)) {
          acabou = true;
        } else {
          fundoNovo = menor;
        }

        posts = [...antigos, ...posts];
      } catch {
        // Escavação é trabalho de fundo: falhar nela não pode custar a
        // atualização, que é a parte que traz a oferta de hoje.
      }
    }

    resumo.canais_lidos++;

    /*
      O que ainda não foi visto, e agora são DOIS lados.

      A versão anterior era `p.id > ultimo_post_id`, e ela sozinha
      jogaria fora exatamente o que a escavação acabou de trazer: post
      antigo tem id MENOR que o último lido, então cairia no filtro e a
      escavação inteira viraria requisição gasta à toa.

      O que já foi processado é a faixa entre as duas bordas. Fora
      dela, dos dois lados, é novidade.
      Sem borda de baixo ainda, só a de cima manda.
    */
    const bordaDeCima = fonte.ultimo_post_id ?? 0;
    const bordaDeBaixo = fonte.primeiro_post_id ?? null;

    const novos = posts.filter(
      (p) => p.id > bordaDeCima || (bordaDeBaixo != null && p.id < bordaDeBaixo),
    );

    resumo.posts_vistos += novos.length;
    resumo.escavados += novos.filter((p) => p.id < bordaDeCima).length;

    /*
      O CUPOM SAI DO TEXTO, NÃO DO LINK.

      Até aqui a colheita lia os posts, tirava os links e jogava o texto
      fora. E o texto é onde mora a única coisa que o Mercado Livre não
      publica em lugar nenhum consultável: o cupom do dia.

      A pesquisa de 01/08 (`docs/pesquisa/cupons-de-onde-vem.md`) varreu
      15 rotas plausíveis da API e todas deram 404 — não é falta de
      permissão, é ausência: o único endpoint de cupom documentado do ML
      é o do VENDEDOR gerenciando a própria campanha. O cupom é público,
      mas distribuído por banner e push dentro do app.

      Ele chega aqui de graça, porque os canais que a colheita já lê
      publicam todos eles, e o formato `<CATEGORIA><DDMM>` traz a
      própria validade dentro do código.

      Isto substitui digitação: `app/acoes/cupons.ts` dizia *"cupom é
      digitado à mão porque nenhum marketplace expõe cupom por API"*.
      Continua verdade sobre API, e deixou de ser o único caminho.
    */
    for (const post of novos) {
      resumo.cupons_novos += await guardaCupons(db, post.texto, fonte.operacao_id, mercadoLivreId);
    }

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
        await registraDescarte(db, resumo, {
          operacao_id: fonte.operacao_id,
          fonte_id: fonte.id,
          post_externo_id: post.id,
          url_bruta: url,
          resultado: "erro",
          detalhe: (erro as Error).message.slice(0, 300),
          publicada_em: post.publicadaEm,
          processada_em: new Date().toISOString(),
        });
        return;
      }

      const leitura = leLinkDeProduto(resolvida);

      if (!leitura.ok) {
        await registraDescarte(db, resumo, {
          operacao_id: fonte.operacao_id,
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
    await marcaLeitura(db, fonte.id, ultimoPost, {
      primeiro_post_id: fundoNovo,
      escavacao_concluida: acabou,
    });

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

/**
 * Guarda os cupons achados no texto de um post. Devolve quantos são novos.
 *
 * A VALIDADE SAI DO PRÓPRIO CÓDIGO, e é o que torna isto seguro. O
 * comentário da tabela `cupom` avisa: *"cupom sem prazo é o que fica
 * publicado depois de morrer"*. Como o formato do ML é
 * `<CATEGORIA><DDMM>`, o dia de expiração vem escrito no código, e o
 * cupom sai de `cupons_vivos` sozinho na virada — sem ninguém marcar
 * nada à mão.
 *
 * O ano não está no código, então é o corrente. A exceção é a virada:
 * um `CUPOM0101` lido em 31 de dezembro é de janeiro do ano que vem, e
 * sem esse ajuste ele nasceria vencido há doze meses.
 *
 * Conflito não é erro: o mesmo cupom aparece em vários canais no mesmo
 * dia, e é exatamente assim que a pesquisa o encontrou. O primeiro que
 * chega grava, os outros são ignorados em silêncio.
 */
async function guardaCupons(
  db: ReturnType<typeof createClient>,
  texto: string,
  operacaoId: string,
  marketplaceId: string | null,
): Promise<number> {
  if (!marketplaceId) return 0;

  const achados = extraiCupons(texto);
  if (achados.length === 0) return 0;

  const agora = new Date();
  let novos = 0;

  for (const c of achados) {
    const vigenteAte = validadeDoCupom(c.dia, c.mes, agora);
    if (!vigenteAte) continue;

    const { data, error } = await db.from("cupom").upsert(
      {
        operacao_id: operacaoId,
        marketplace_id: marketplaceId,
        codigo: c.codigo,
        descricao: `${c.percentual}% colhido de canal`,
        tipo: "percentual",
        valor: c.percentual,
        valor_minimo_centavos: c.minimoCentavos,
        teto_desconto_centavos: c.tetoCentavos,
        vigente_ate: vigenteAte.toISOString(),
      },
      { onConflict: "operacao_id,marketplace_id,codigo", ignoreDuplicates: true },
    )
      // `select` depois de `ignoreDuplicates` devolve só o que entrou:
      // sem ele o resumo contava como novo o cupom que já existia.
      .select("id");

    if (!error && (data ?? []).length > 0) novos += 1;
  }

  return novos;
}

/**
 * Grava a menção que não virou anúncio.
 *
 * O `error` é conferido, e essa conferência é o motivo desta função
 * existir. Antes, as duas inserções ignoravam a resposta do banco —
 * e como `operacao_id` faltava, TODO descarte era recusado em
 * silêncio: a colheita somava 29 descartes no resumo e gravava
 * zero. O resultado seria a tela de menções vazia justamente quando
 * mais tivesse o que mostrar, e a conclusão errada de que o leitor
 * de link está ótimo.
 */
async function registraDescarte(
  db: ReturnType<typeof createClient>,
  resumo: { descartados: number; falhas: string[] },
  linha: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from("mencao").insert(linha);

  if (error) {
    // Conflito no índice único é link repetido no mesmo post — não
    // é falha, é a colheita fazendo o trabalho dela.
    if (error.code !== "23505") {
      resumo.falhas.push(`menção descartada não gravou: ${error.message}`);
    }
  }

  resumo.descartados++;
}

async function marcaLeitura(
  db: ReturnType<typeof createClient>,
  fonteId: string,
  ultimoPostId: number | null,
  escavacao?: { primeiro_post_id: number | null; escavacao_concluida: boolean },
) {
  await db
    .from("fonte_descoberta")
    .update({
      ultima_leitura_em: new Date().toISOString(),
      ultimo_post_id: ultimoPostId,
      // As duas bordas são gravadas juntas porque são lidas juntas na
      // passada seguinte: `ultimo_post_id` diz até onde já subimos e
      // `primeiro_post_id` diz de onde continuar descendo.
      ...(escavacao ?? {}),
    })
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
