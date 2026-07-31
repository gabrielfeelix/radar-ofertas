import "server-only";

import { canaisElegiveis, type Canal } from "@/lib/distribuicao";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { ParametroLinha } from "@/lib/supabase/tipos";

/**
 * A fila de aprovação, lida do banco.
 *
 * Substitui a parte de oferta de `lib/simulacao/loja.ts`. É o passo 1
 * de `docs/tirar-a-simulacao.md`, e o mais delicado dos quatro: **é
 * aqui que aprovar deixa de mexer num objeto em memória e passa a
 * gravar `publicacao`, com subid, no banco** (regra 3.6).
 *
 * REGRA DE OURO, herdada da simulação e mais importante agora: este
 * arquivo **só serve dado**. Nenhuma decisão de curadoria mora aqui.
 * A nota, os motivos e o veredito vêm prontos de `avalia_anuncios`, no
 * banco, que é a única implementação da regra (seção 5 do `AGENTS.md`).
 *
 * O que mudou de forma em relação à simulação, e por quê: a oferta
 * chega **completa**. Ela já traz o nome e as cores da loja, o nome do
 * nicho, a série de preço e os canais elegíveis. A simulação obrigava a
 * tela a chamar seis funções auxiliares por linha renderizada; contra o
 * banco isso seria seis consultas por linha, numa fila de trinta.
 */

export type StatusOferta = "nova" | "aprovada" | "rejeitada" | "adiada";

export type ParcelasDaNota = {
  /** 0 a 50 */
  desconto: number;
  /** 0 a 30 */
  comissao: number;
  /** 0 a 20 */
  vendedor: number;
};

export type ComportaAvaliada = {
  nome: string;
  passou: boolean;
  observado: string;
  limiar: string;
};

/** Identidade visual da loja. Vem do banco: cor de terceiro é dado, não token. */
export type LojaDaOferta = {
  slug: string;
  nome: string;
  corTexto: string | null;
  corFundo: string | null;
};

export type Oferta = {
  id: string;
  produto: string;
  /** Slug do nicho. É o que roteia para canal. */
  nicho: string;
  nichoNome: string;
  loja: LojaDaOferta;
  vendedor: string;
  url: string;
  precoAtualCentavos: number;
  /** Mediana da NOSSA série. Nunca o "preço de" do marketplace. */
  precoReferenciaCentavos: number;
  referenciaJanelaDias: number;
  descontoPct: number;
  diasDeSerie: number;
  /** Falso enquanto a série não chega ao limiar (regra 3.4). */
  podeAfirmarMinimo: boolean;
  observadoDesde: string;
  comissaoEstimadaCentavos: number;
  nota: number;
  parcelas: ParcelasDaNota;
  comportas: ComportaAvaliada[];
  /** Última vez que este anúncio foi publicado, em qualquer canal. */
  publicadaAntesEm: string | null;
  status: StatusOferta;
  motivoRejeicao: string | null;
  /** Preço observado por dia, do mais antigo ao mais novo. */
  serie: number[];
  /** Canais ativos que aceitam o nicho. Vazio = aprovar não teria efeito. */
  canais: Canal[];
  /**
   * Para onde ela foi, depois de aprovada.
   *
   * Não é campo de `oferta`: é a contagem das `publicacao` que a
   * aprovação gerou. Guardar a escolha nos dois lugares deixaria os
   * dois discordando na primeira vez que uma publicação fosse
   * cancelada.
   */
  canaisEscolhidos: string[];
};

/**
 * Motivos de rejeição. Lista fechada de propósito: rejeição com motivo
 * digitado vira texto livre que ninguém agrega depois, e o ponto de
 * exigir motivo é justamente poder calibrar o motor.
 */
export const MOTIVOS_DE_REJEICAO = [
  "Desconto não é real",
  "Produto ruim, ainda que barato",
  "Vendedor duvidoso",
  "Comissão não paga o post",
  "Já publiquei parecido",
  "Não combina com os canais",
] as const;

/** Quantos pontos da série o painel desenha. */
const PONTOS_DA_SERIE = 30;

/** Meia-noite de hoje em São Paulo, em UTC (regra 3.9). */
function inicioDoDiaLocal(): string {
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `${dia}T03:00:00.000Z`;
}

type LinhaDeOferta = {
  id: string;
  anuncio_id: string;
  preco_atual_centavos: number;
  preco_referencia_centavos: number;
  referencia_janela_dias: number;
  dias_de_serie: number;
  desconto_pct: number;
  comissao_estimada_centavos: number;
  pode_afirmar_minimo: boolean;
  nota: number;
  nota_desconto: number;
  nota_comissao: number;
  nota_vendedor: number;
  status: string;
  motivo_rejeicao: string | null;
  detectada_em: string;
  anuncio: {
    id: string;
    url_original: string;
    vendedor: string | null;
    avaliacao: number | null;
    reputacao_vendedor: number | null;
    marketplace: { slug: string; nome: string; cor_texto: string | null; cor_fundo: string | null } | null;
    produto: { titulo_canonico: string; nicho: { slug: string; nome: string } | null } | null;
  } | null;
};

const SELECAO = `
  id, anuncio_id, preco_atual_centavos, preco_referencia_centavos,
  referencia_janela_dias, dias_de_serie, desconto_pct,
  comissao_estimada_centavos, pode_afirmar_minimo,
  nota, nota_desconto, nota_comissao, nota_vendedor,
  status, motivo_rejeicao, detectada_em,
  anuncio:anuncio_id (
    id, url_original, vendedor, avaliacao, reputacao_vendedor,
    marketplace:marketplace_id ( slug, nome, cor_texto, cor_fundo ),
    produto:produto_id ( titulo_canonico, nicho:nicho_id ( slug, nome ) )
  )
`;

/**
 * Os limiares que a tela de detalhe mostra ao lado do observado.
 *
 * **Isto não reavalia nada.** A oferta só existe porque `avalia_anuncios`
 * já aprovou as comportas — o que este mapa faz é dizer *contra qual
 * número* cada uma passou, para a pessoa entender a decisão do motor em
 * vez de receber um "aprovado" sem lastro. O valor por nicho vence o
 * global, como na D-023.
 */
async function limiaresPorNicho(): Promise<Map<string, Map<string, number>>> {
  const db = supabaseServidor();

  const [{ data: parametros }, { data: nichos }] = await Promise.all([
    db.from("parametro").select("*"),
    db.from("nicho").select("id, slug"),
  ]);

  const slugPorId = new Map((nichos ?? []).map((n) => [n.id, n.slug]));
  const global = new Map<string, number>();
  const porNicho = new Map<string, Map<string, number>>();

  for (const linha of (parametros ?? []) as ParametroLinha[]) {
    if (linha.nicho_id === null) {
      global.set(linha.chave, Number(linha.valor));
      continue;
    }
    const slug = slugPorId.get(linha.nicho_id);
    if (!slug) continue;
    if (!porNicho.has(slug)) porNicho.set(slug, new Map());
    porNicho.get(slug)!.set(linha.chave, Number(linha.valor));
  }

  // O global entra como base de cada nicho, e a exceção sobrescreve.
  const resultado = new Map<string, Map<string, number>>();
  resultado.set("", global);
  for (const [slug, excecoes] of porNicho) {
    resultado.set(slug, new Map([...global, ...excecoes]));
  }
  return resultado;
}

function limiar(mapa: Map<string, Map<string, number>>, nicho: string, chave: string): number | null {
  const doNicho = mapa.get(nicho)?.get(chave);
  if (doNicho !== undefined) return doNicho;
  const global = mapa.get("")?.get(chave);
  return global ?? null;
}

function reais(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

function montaComportas(
  linha: LinhaDeOferta,
  nicho: string,
  limiares: Map<string, Map<string, number>>,
  publicadaAntesEm: string | null,
): ComportaAvaliada[] {
  const descontoMin = limiar(limiares, nicho, "desconto_minimo_pct");
  const serieMin = limiar(limiares, nicho, "dias_minimos_de_serie");
  const comissaoMin = limiar(limiares, nicho, "comissao_minima_centavos");
  const janelaMin = limiar(limiares, nicho, "janela_minimo_dias");
  const recompra = limiar(limiares, nicho, "dias_recompra_mesmo_anuncio");
  const avaliacaoMin = limiar(limiares, nicho, "avaliacao_minima");
  const reputacaoMin = limiar(limiares, nicho, "reputacao_minima");

  const comportas: ComportaAvaliada[] = [
    {
      nome: "desconto mínimo",
      passou: true,
      observado: `${Math.round(Number(linha.desconto_pct))}%`,
      limiar: descontoMin === null ? "não configurado" : `${descontoMin}%`,
    },
    {
      nome: "série mínima para avaliar",
      passou: true,
      observado: `${linha.dias_de_serie} dias`,
      limiar: serieMin === null ? "não configurado" : `${serieMin} dias`,
    },
    {
      nome: "comissão mínima",
      passou: true,
      observado: reais(linha.comissao_estimada_centavos),
      limiar: comissaoMin === null ? "não configurado" : reais(comissaoMin),
    },
    {
      nome: "menor preço da janela",
      passou: true,
      observado: `menor em ${linha.referencia_janela_dias} dias`,
      limiar: janelaMin === null ? "precisa ser o menor" : `menor em ${janelaMin} dias`,
    },
  ];

  // Só entram quando a loja informou o sinal. Comporta desenhada com
  // "sem dado" ensina que o motor conferiu algo que ele não conferiu.
  if (linha.anuncio?.avaliacao != null && avaliacaoMin !== null) {
    comportas.push({
      nome: "nota do produto",
      passou: true,
      observado: Number(linha.anuncio.avaliacao).toFixed(1).replace(".", ","),
      limiar: avaliacaoMin.toFixed(1).replace(".", ","),
    });
  }

  if (linha.anuncio?.reputacao_vendedor != null && reputacaoMin !== null) {
    comportas.push({
      nome: "reputação do vendedor",
      passou: true,
      observado: Number(linha.anuncio.reputacao_vendedor).toFixed(2).replace(".", ","),
      limiar: reputacaoMin.toFixed(2).replace(".", ","),
    });
  }

  comportas.push({
    nome: "fadiga do produto",
    passou: publicadaAntesEm === null,
    observado: publicadaAntesEm ? `publicado em ${publicadaAntesEm}` : "nunca publicado",
    limiar: recompra === null ? "não configurado" : `não repetir em ${recompra} dias`,
  });

  return comportas;
}

/**
 * Monta as ofertas de uma lista de linhas, resolvendo em lote tudo que
 * a tela precisa. Em lote, e não por linha, porque a fila tem trinta
 * itens e cada consulta a mais vira trinta.
 */
async function montaOfertas(linhas: LinhaDeOferta[]): Promise<Oferta[]> {
  if (linhas.length === 0) return [];

  const db = supabaseServidor();
  const anuncioIds = [...new Set(linhas.map((l) => l.anuncio_id))];

  const [limiares, series, publicacoesAnteriores, publicacoesDestas] = await Promise.all([
    limiaresPorNicho(),
    db
      .from("preco_ponto")
      .select("anuncio_id, preco_centavos, dia_local")
      .in("anuncio_id", anuncioIds)
      .order("dia_local"),
    // Quando este anúncio saiu por último, em qualquer canal. É a
    // fadiga: repetição é o que faz membro silenciar o grupo.
    db
      .from("publicacao")
      .select("enviada_em, oferta:oferta_id ( anuncio_id )")
      .eq("estado", "enviada")
      .order("enviada_em", { ascending: false }),
    // Para onde cada uma destas ofertas já foi. Só as vivas: uma
    // publicação cancelada não é canal escolhido.
    db
      .from("publicacao")
      .select("oferta_id, canal_id")
      .in(
        "oferta_id",
        linhas.map((l) => l.id),
      )
      .neq("estado", "cancelada"),
  ]);

  const serieDoAnuncio = new Map<string, number[]>();
  for (const ponto of (series.data ?? []) as {
    anuncio_id: string;
    preco_centavos: number;
  }[]) {
    const atual = serieDoAnuncio.get(ponto.anuncio_id) ?? [];
    atual.push(ponto.preco_centavos);
    serieDoAnuncio.set(ponto.anuncio_id, atual);
  }

  const ultimaPublicacao = new Map<string, string>();
  for (const p of (publicacoesAnteriores.data ?? []) as unknown as {
    enviada_em: string | null;
    oferta: { anuncio_id: string } | null;
  }[]) {
    const anuncioId = p.oferta?.anuncio_id;
    if (!anuncioId || !p.enviada_em) continue;
    if (!ultimaPublicacao.has(anuncioId)) {
      ultimaPublicacao.set(anuncioId, p.enviada_em.slice(0, 10));
    }
  }

  const escolhidosDaOferta = new Map<string, string[]>();
  for (const p of publicacoesDestas.data ?? []) {
    const atual = escolhidosDaOferta.get(p.oferta_id) ?? [];
    atual.push(p.canal_id);
    escolhidosDaOferta.set(p.oferta_id, atual);
  }

  // Os canais elegíveis, uma consulta por nicho distinto e não por
  // oferta: a fila inteira costuma caber em três ou quatro nichos.
  const nichos = [
    ...new Set(linhas.map((l) => l.anuncio?.produto?.nicho?.slug).filter((s): s is string => !!s)),
  ];
  const canaisDoNicho = new Map<string, Canal[]>();
  await Promise.all(
    nichos.map(async (slug) => canaisDoNicho.set(slug, await canaisElegiveis(slug))),
  );

  return linhas.map((linha): Oferta => {
    const anuncio = linha.anuncio;
    const nicho = anuncio?.produto?.nicho?.slug ?? "";
    const publicadaAntesEm = ultimaPublicacao.get(linha.anuncio_id) ?? null;
    const serieCompleta = serieDoAnuncio.get(linha.anuncio_id) ?? [];

    return {
      id: linha.id,
      produto: anuncio?.produto?.titulo_canonico ?? "produto sem título",
      nicho,
      nichoNome: anuncio?.produto?.nicho?.nome ?? "sem nicho",
      loja: {
        slug: anuncio?.marketplace?.slug ?? "",
        nome: anuncio?.marketplace?.nome ?? "loja desconhecida",
        corTexto: anuncio?.marketplace?.cor_texto ?? null,
        corFundo: anuncio?.marketplace?.cor_fundo ?? null,
      },
      vendedor: anuncio?.vendedor ?? "vendedor não informado",
      url: anuncio?.url_original ?? "",
      precoAtualCentavos: linha.preco_atual_centavos,
      precoReferenciaCentavos: linha.preco_referencia_centavos,
      referenciaJanelaDias: linha.referencia_janela_dias,
      descontoPct: Math.round(Number(linha.desconto_pct)),
      diasDeSerie: linha.dias_de_serie,
      podeAfirmarMinimo: linha.pode_afirmar_minimo,
      observadoDesde: linha.detectada_em.slice(0, 10),
      comissaoEstimadaCentavos: linha.comissao_estimada_centavos,
      nota: Math.round(Number(linha.nota)),
      parcelas: {
        desconto: Math.round(Number(linha.nota_desconto)),
        comissao: Math.round(Number(linha.nota_comissao)),
        vendedor: Math.round(Number(linha.nota_vendedor)),
      },
      comportas: montaComportas(linha, nicho, limiares, publicadaAntesEm),
      publicadaAntesEm,
      status: (linha.status === "expirada" ? "rejeitada" : linha.status) as StatusOferta,
      motivoRejeicao: linha.motivo_rejeicao,
      // Os últimos pontos, e a queda de agora fechando a série. É o
      // contraste que a tela precisa comunicar.
      serie: serieCompleta.slice(-PONTOS_DA_SERIE),
      canais: canaisDoNicho.get(nicho) ?? [],
      canaisEscolhidos: escolhidosDaOferta.get(linha.id) ?? [],
    };
  });
}

/** As que esperam decisão, melhor nota primeiro. */
export async function ofertasDaFila(): Promise<Oferta[]> {
  const db = supabaseServidor();
  const { data } = await db
    .from("oferta")
    .select(SELECAO)
    .eq("status", "nova")
    .order("nota", { ascending: false })
    .order("detectada_em", { ascending: false });

  return montaOfertas((data ?? []) as unknown as LinhaDeOferta[]);
}

/**
 * As decididas de hoje, para a seção "Decididas hoje".
 *
 * Só as de hoje, e não todas: a simulação vivia numa sessão e "todas"
 * era um punhado. Contra o banco, "todas" cresce para sempre e a tela
 * de trabalho do dia viraria o arquivo morto da operação.
 */
export async function ofertasDecididasHoje(): Promise<Oferta[]> {
  const db = supabaseServidor();
  const { data } = await db
    .from("oferta")
    .select(SELECAO)
    .neq("status", "nova")
    .gte("decidida_em", inicioDoDiaLocal())
    .order("decidida_em", { ascending: false });

  return montaOfertas((data ?? []) as unknown as LinhaDeOferta[]);
}

export async function buscaOferta(id: string): Promise<Oferta | undefined> {
  const db = supabaseServidor();
  const { data } = await db.from("oferta").select(SELECAO).eq("id", id).maybeSingle();
  if (!data) return undefined;

  const [oferta] = await montaOfertas([data as unknown as LinhaDeOferta]);
  return oferta;
}

/**
 * Quantas publicações a fila inteira geraria se tudo fosse aprovado.
 *
 * É o número que muda comportamento: sem ele o dono aprova de graça e
 * descobre o custo depois, em pé, no telefone.
 */
export async function publicacoesSeAprovarTudo(): Promise<number> {
  const fila = await ofertasDaFila();
  return fila.reduce((total, o) => total + o.canais.length, 0);
}

/**
 * Grava a decisão — e, quando é aprovação, **cria as publicações**.
 *
 * É aqui que a regra 3.6 acontece pela primeira vez de verdade: uma
 * publicação por canal elegível, cada uma com subid próprio, gerado
 * pelo banco e único por constraint. O subid não é gerado aqui de
 * propósito: `gera_subid()` mora na migration 16, junto do `unique`
 * que o protege, e duas implementações do mesmo identificador é como
 * se atribui venda ao canal errado em silêncio.
 */
export async function decideOferta(
  id: string,
  decisao: { status: StatusOferta; motivo?: string; canais?: string[]; decididaPor?: string },
): Promise<void> {
  const db = supabaseServidor();

  const { data: oferta } = await db
    .from("oferta")
    .select("id, operacao_id, preco_atual_centavos")
    .eq("id", id)
    .maybeSingle();
  if (!oferta) return;

  await db
    .from("oferta")
    .update({
      status: decisao.status,
      motivo_rejeicao: decisao.motivo ?? null,
      decidida_em: new Date().toISOString(),
      decidida_por: decisao.decididaPor ?? null,
    })
    .eq("id", id);

  if (decisao.status !== "aprovada") return;

  const canais = decisao.canais ?? [];
  if (canais.length === 0) return;

  // `upsert` com `ignoreDuplicates` e não `insert`: a constraint
  // `publicacao_oferta_canal_unico` existe para a mesma oferta não ir
  // duas vezes ao mesmo canal, e aprovar de novo depois de desfazer
  // não pode explodir na cara de quem só clicou duas vezes.
  await db.from("publicacao").upsert(
    canais.map((canalId) => ({
      operacao_id: oferta.operacao_id,
      oferta_id: oferta.id,
      canal_id: canalId,
      preco_na_fila_centavos: oferta.preco_atual_centavos,
    })),
    { onConflict: "oferta_id,canal_id", ignoreDuplicates: true },
  );
}

/**
 * Desfaz a decisão e **apaga as publicações que ela gerou** — mas só as
 * que ainda não saíram.
 *
 * Apagar publicação já enviada seria apagar história: a mensagem foi ao
 * grupo, o subid está circulando, e um dia ele volta no relatório de
 * comissão. Sem esta ressalva, desfazer uma aprovação faria a venda
 * chegar sem dono.
 */
export async function desfazDecisao(id: string): Promise<void> {
  const db = supabaseServidor();

  await db.from("publicacao").delete().eq("oferta_id", id).in("estado", ["pendente", "bloqueada"]);

  await db
    .from("oferta")
    .update({ status: "nova", motivo_rejeicao: null, decidida_em: null, decidida_por: null })
    .eq("id", id);
}

/**
 * O funil que a tela mostra quando a fila está vazia.
 *
 * "Nenhuma oferta hoje" é inútil: o que impede a conclusão errada de
 * que o sistema quebrou é ver **onde o funil parou**. Com catálogo
 * vazio os três números são zero, e isso também é uma resposta — a de
 * que falta colher, não que falta afrouxar limiar.
 */
export async function funilDeHoje(): Promise<Array<{ n: number; rotulo: string }>> {
  const db = supabaseServidor();
  const serieMinima = limiar(await limiaresPorNicho(), "", "dias_minimos_de_serie") ?? 7;

  const [monitorados, comSerie, naFila] = await Promise.all([
    db.from("anuncio").select("id", { count: "exact", head: true }).eq("ativo", true),
    db
      .from("anuncio_serie")
      .select("anuncio_id", { count: "exact", head: true })
      .gte("dias_de_serie", serieMinima),
    db.from("oferta").select("id", { count: "exact", head: true }).eq("status", "nova"),
  ]);

  return [
    { n: monitorados.count ?? 0, rotulo: "anúncios monitorados" },
    { n: comSerie.count ?? 0, rotulo: "com série suficiente para avaliar" },
    { n: naFila.count ?? 0, rotulo: "abaixo do limiar hoje" },
  ];
}
