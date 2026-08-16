import "server-only";

import { montaLinkDeAfiliado, type LinkDeAfiliado } from "@/lib/afiliado";
import { buscaCanal, canais, type Canal } from "@/lib/distribuicao";
import type { DadosDaMensagem } from "@/lib/mensagem";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * A fila de envio, lida do banco.
 *
 * Substitui a parte de publicação de `lib/simulacao/loja.ts` — passo 2
 * de `docs/tirar-a-simulacao.md`. O que era um `Map` na memória do
 * servidor agora é a tabela `publicacao` da migration 16, com o subid
 * gerado e protegido por `unique` lá dentro.
 *
 * DUAS REGRAS ATRAVESSAM ESTE ARQUIVO, e nenhuma pode se perder na
 * tradução:
 *
 * **A origem não soma.** `fluxo` é quem passou pelo botão;
 * `auto_declarada` é quem disse "já enviei por fora". Somados no mesmo
 * contador, o único sinal de supervisão que existe sobre operador
 * remoto deixa de ser sinal.
 *
 * **Preço que mudou bloqueia.** Publicação cujo preço de agora difere
 * do `preco_na_fila_centavos` vira `bloqueada` e volta para a
 * aprovação. O operador não aprova nem rejeita: a decisão de curadoria
 * não é dele, e deixá-lo com um item travado e só "cancelar" como saída
 * seria dar a ele um veto disfarçado.
 */

export type OrigemDoEnvio = "fluxo" | "auto_declarada";

export type Publicacao = {
  id: string;
  ofertaId: string;
  canal: Canal;
  produto: string;
  /** O nicho da oferta. A fila usa para não publicar oito iguais seguidas. */
  nicho: string;
  url: string;
  /**
   * O que a mensagem precisa saber, e não a mensagem pronta.
   *
   * Quem monta o texto é o modelo que o dono edita em Ajustes, e ele
   * mora no banco. Se a fila montasse a frase aqui, editar o modelo não
   * mudaria nada — que é justamente o que a tela de modelos existe para
   * permitir.
   */
  dadosDaMensagem: Omit<DadosDaMensagem, "link">;
  /** Preço no momento em que entrou na fila. */
  precoNaFilaCentavos: number;
  /** Preço agora, do último ponto da série. Diferente = a oferta mudou embaixo. */
  precoAgoraCentavos: number;
  subid: string;
  /**
   * O link a publicar, já com o subid dentro.
   *
   * Vem montado daqui e não da tela porque é o campo que carrega a
   * comissão: uma tela que o remontasse por conta própria seria a
   * segunda implementação da coisa que paga o projeto.
   */
  link: LinkDeAfiliado;
  /**
   * LINK da foto, nunca o arquivo (regra 3.3).
   *
   * Vem nulo quando o link passou de 24 horas — é o prazo que a
   * política de associados dá para guardar link de imagem, e o
   * expurgo do banco roda uma vez por dia. Entre um expurgo e outro,
   * quem garante o prazo é esta conta.
   */
  imagemUrl: string | null;
  /**
   * `marketplace.slug` do anúncio, que decide COMO a mensagem sai no
   * WhatsApp: card de link ou foto anexada (`saiComCardDeLink`).
   *
   * Está aqui e não só dentro de `dadosDaMensagem` porque aquilo é o
   * que a mensagem DIZ, e isto é como ela é ENTREGUE.
   */
  marketplaceSlug: string;
  enviadaEm: string | null;
  origem: OrigemDoEnvio | null;
  cancelada: boolean;
};

/**
 * O link da foto, se ainda estiver dentro do prazo.
 *
 * A política de associados permite guardar **link** de imagem por no
 * máximo 24 horas — nunca o arquivo (regra 3.3). O expurgo do banco
 * roda uma vez por dia, e entre uma passada e outra existe uma janela
 * em que a linha ainda tem o link vencido. Publicar dali seria usar
 * conteúdo além do prazo, então a conta é refeita na hora de publicar.
 *
 * Sem foto a publicação continua saindo, em texto. Perder a imagem
 * custa alcance; publicar fora do prazo custa a conta de afiliado.
 */
/**
 * O prazo é da loja, não do sistema: `marketplace.cache_preco_max_horas`
 * vale 24 na Amazon e é nulo no Mercado Livre e na Shopee. Nulo é "não
 * expira" — o mesmo que `expurga_imagens_expiradas` faz no banco.
 */
function fotoAindaValida(
  url?: string | null,
  obtidaEm?: string | null,
  maxHoras?: number | null,
): string | null {
  if (!url || !obtidaEm) return null;
  if (maxHoras == null) return url;
  const horas = (Date.now() - new Date(obtidaEm).getTime()) / 3_600_000;
  return horas <= maxHoras ? url : null;
}

/** Meia-noite de hoje em São Paulo, em UTC (regra 3.9). */
function inicioDoDiaLocal(): string {
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `${dia}T03:00:00.000Z`;
}

export type ContagemDoCanal = {
  /** Esperando envio agora. */
  pendentes: number;
  /** Já enviadas hoje. É o que consome o teto diário. */
  enviadasHoje: number;
};

export async function publicacoesDoCanal(canalId: string): Promise<ContagemDoCanal> {
  const db = supabaseServidor();

  const [pendentes, enviadas] = await Promise.all([
    db
      .from("publicacao")
      .select("id", { count: "exact", head: true })
      .eq("canal_id", canalId)
      .eq("estado", "pendente"),
    db
      .from("publicacao")
      .select("id", { count: "exact", head: true })
      .eq("canal_id", canalId)
      .eq("estado", "enviada")
      .gte("enviada_em", inicioDoDiaLocal()),
  ]);

  return {
    pendentes: pendentes.count ?? 0,
    enviadasHoje: enviadas.count ?? 0,
  };
}

type LinhaDePublicacao = {
  id: string;
  oferta_id: string;
  canal_id: string;
  subid: string;
  preco_na_fila_centavos: number;
  estado: string;
  origem: string;
  enviada_em: string | null;
  link_afiliado: string | null;
  oferta: {
    id: string;
    anuncio_id: string;
    preco_atual_centavos: number;
    preco_referencia_centavos: number;
    referencia_janela_dias: number;
    /** A idade da nossa série. Escolhe a linha de lastro (15/08). */
    dias_de_serie: number | null;
    desconto_pct: number;
    pode_afirmar_minimo: boolean;
    detectada_em: string;
    anuncio: {
      url_original: string;
      vendedor: string | null;
      imagem_url: string | null;
      imagem_obtida_em: string | null;
      /** A estrela da loja e quantos votaram. Viram `{estrelas}` (16/08). */
      avaliacao: number | null;
      avaliacao_qtd: number | null;
      marketplace: { nome: string; slug: string; cache_preco_max_horas: number | null } | null;
      produto: {
        titulo_canonico: string;
        nota_curador: string | null;
        nicho: { slug: string } | null;
      } | null;
    } | null;
  } | null;
};

const SELECAO = `
  id, oferta_id, canal_id, subid, preco_na_fila_centavos, estado, origem, enviada_em,
  link_afiliado,
  oferta:oferta_id (
    id, anuncio_id, preco_atual_centavos, preco_referencia_centavos,
    referencia_janela_dias, dias_de_serie, desconto_pct, pode_afirmar_minimo, detectada_em,
    anuncio:anuncio_id (
      url_original, vendedor, imagem_url, imagem_obtida_em, avaliacao, avaliacao_qtd,
      marketplace:marketplace_id ( nome, slug, cache_preco_max_horas ),
      produto:produto_id ( titulo_canonico, nota_curador, nicho:nicho_id ( slug ) )
    )
  )
`;

/**
 * O link que vai para o canal.
 *
 * ISTO ERA UM BURACO QUE CUSTAVA COMISSÃO, e não dava erro nenhum.
 *
 * A tela montava o link à mão, com `montaLinkDeAfiliado`, colando
 * `?matt_word=<subid>&matt_tool=...` na URL do produto. A D-034 provou
 * que **isso não atribui comissão**: passando o nosso link pelo gerador
 * oficial, ele descarta o `matt_word` e cria um `ref=` cifrado, e é
 * dentro do `ref` que a atribuição mora.
 *
 * O laço automático já fazia certo desde a D-034: gera pelo painel e
 * guarda em `publicacao.link_afiliado`. A tela continuou remontando, e
 * o resultado é o que o dono viu ao publicar pela tela: o link abre o
 * produto direto, sem passar pela página do afiliado.
 *
 * O link certo passa. Conferido em 01/08:
 *
 *   meli.la/1QPWrnS  →  301  →  mercadolivre.com.br/social/fega6031503
 *                                ?matt_word=radarpet&ref=BCVd2UBeH...
 *
 * SEM LINK GERADO, A TELA AVISA EM VEZ DE PUBLICAR. Devolver a URL crua
 * "para não deixar sem link" é o pior dos mundos: publica, parece que
 * funcionou, e entrega a audiência de graça. Fica `rastreado: false`
 * com o motivo, que é o que a tela já sabe mostrar.
 */
function linkAPublicar(
  linha: LinhaDePublicacao,
  urlDoAnuncio: string,
  marketplaceSlug: string,
): LinkDeAfiliado {
  if (linha.link_afiliado) {
    return { url: linha.link_afiliado, rastreado: true };
  }

  // Marketplace sem gerador ainda cai no caminho antigo, e lá o próprio
  // `montaLinkDeAfiliado` já devolve `rastreado: false` com o motivo.
  if (marketplaceSlug !== "mercado_livre") {
    return montaLinkDeAfiliado(urlDoAnuncio, linha.subid, marketplaceSlug);
  }

  return {
    url: urlDoAnuncio,
    rastreado: false,
    motivo:
      "o link de afiliado ainda não foi gerado — publicar assim não paga comissão (D-034)",
  };
}

/**
 * A fila de hoje: o que ainda não saiu, mais o que saiu hoje.
 *
 * Publicação enviada ontem não volta para a tela. Ela é histórico, e
 * histórico na fila de trabalho é ruído que cresce todo dia.
 */
export async function publicacoesDaFila(): Promise<Publicacao[]> {
  const db = supabaseServidor();

  const { data } = await db
    .from("publicacao")
    .select(SELECAO)
    .or(`estado.neq.enviada,enviada_em.gte.${inicioDoDiaLocal()}`)
    .order("criado_em");

  const linhas = (data ?? []) as unknown as LinhaDePublicacao[];
  if (linhas.length === 0) return [];

  const listaDeCanais = await canais();
  const canalPorId = new Map(listaDeCanais.map((c) => [c.id, c]));

  // O preço de agora vem do último ponto da série, e não do que a
  // oferta guardou: é exatamente a diferença entre os dois que o
  // bloqueio existe para pegar.
  const anuncioIds = [
    ...new Set(linhas.map((l) => l.oferta?.anuncio_id).filter((id): id is string => !!id)),
  ];
  const { data: pontos } = await db
    .from("preco_ponto")
    .select("anuncio_id, preco_centavos, coletado_em")
    .in("anuncio_id", anuncioIds)
    .order("coletado_em", { ascending: false });

  const precoAgora = new Map<string, number>();
  for (const p of pontos ?? []) {
    if (!precoAgora.has(p.anuncio_id)) precoAgora.set(p.anuncio_id, p.preco_centavos);
  }

  const publicacoes: Publicacao[] = [];

  for (const linha of linhas) {
    const canal = canalPorId.get(linha.canal_id);
    const oferta = linha.oferta;
    if (!canal || !oferta) continue;

    const anuncio = oferta.anuncio;

    publicacoes.push({
      id: linha.id,
      ofertaId: linha.oferta_id,
      canal,
      produto: anuncio?.produto?.titulo_canonico ?? "produto sem título",
      nicho: anuncio?.produto?.nicho?.slug ?? "",
      url: anuncio?.url_original ?? "",
      dadosDaMensagem: {
        produto: anuncio?.produto?.titulo_canonico ?? "produto sem título",
        precoCentavos: oferta.preco_atual_centavos,
        precoAntesCentavos: oferta.preco_referencia_centavos,
        descontoPct: Math.round(Number(oferta.desconto_pct)),
        loja: anuncio?.marketplace?.nome ?? "loja",
        vendedor: anuncio?.vendedor ?? "",
        janelaDias: oferta.referencia_janela_dias,
        diasDeSerie: oferta.dias_de_serie,
        avaliacao: anuncio?.avaliacao ?? null,
        avaliacaoQtd: anuncio?.avaliacao_qtd ?? null,
        observadoDesde: oferta.detectada_em.slice(0, 10),
        podeAfirmarMinimo: oferta.pode_afirmar_minimo,
        notaDoCurador: anuncio?.produto?.nota_curador ?? null,
        // Decide o {emoji} quando o título não bastar.
        nichoSlug: anuncio?.produto?.nicho?.slug ?? null,
      },
      precoNaFilaCentavos: linha.preco_na_fila_centavos,
      precoAgoraCentavos: precoAgora.get(oferta.anuncio_id) ?? oferta.preco_atual_centavos,
      subid: linha.subid,
      link: linkAPublicar(linha, anuncio?.url_original ?? "", anuncio?.marketplace?.slug ?? ""),
      imagemUrl: fotoAindaValida(
        anuncio?.imagem_url,
        anuncio?.imagem_obtida_em,
        anuncio?.marketplace?.cache_preco_max_horas,
      ),
      marketplaceSlug: anuncio?.marketplace?.slug ?? "",
      enviadaEm: linha.estado === "enviada" ? linha.enviada_em : null,
      origem: linha.estado === "enviada" ? (linha.origem as OrigemDoEnvio) : null,
      cancelada: linha.estado === "cancelada",
    });
  }

  return publicacoes;
}

export async function buscaPublicacao(id: string): Promise<Publicacao | undefined> {
  const fila = await publicacoesDaFila();
  return fila.find((p) => p.id === id);
}

/** Vagas que sobram neste canal agora. Teto é limite real, não sugestão. */
export async function vagasDoCanal(canalId: string): Promise<number> {
  const canal = await buscaCanal(canalId);
  if (!canal || !canal.ativo) return 0;
  return Math.max(0, canal.tetoDiario - canal.publicadasHoje);
}

/**
 * Registra que a publicação saiu.
 *
 * A `mensagem` é gravada como saiu, e não remontada depois: o modelo
 * muda, e o que foi ao grupo é o que precisa ser auditável — inclusive
 * para provar a identificação publicitária da regra 3.10.
 */
/**
 * Em qual coluna o id do post vai, conforme a plataforma do canal.
 *
 * Devolve objeto vazio quando não há id — que é o caso honesto do "já
 * enviei por fora": não existe id para dar.
 */
async function colunaDoMessageId(
  publicacaoId: string,
  messageId?: number | string | null,
): Promise<Record<string, number | string>> {
  if (messageId == null || messageId === "") return {};

  const db = supabaseServidor();
  const { data } = await db
    .from("publicacao")
    .select("canal:canal_id ( plataforma )")
    .eq("id", publicacaoId)
    .maybeSingle();

  const plataforma = (data as { canal?: { plataforma?: string } } | null)?.canal?.plataforma;

  return plataforma === "whatsapp"
    ? { whatsapp_message_id: String(messageId) }
    : { telegram_message_id: Number(messageId) };
}

export async function marcaEnviada(
  id: string,
  origem: OrigemDoEnvio,
  mensagem?: string,
  enviadaPor?: string,
  /**
   * O id que o Telegram devolve, quando o envio passou por aqui.
   *
   * É o que permite apagar ou editar o post depois (migration 44). O
   * laço automático já guardava; a tela recebia o número em
   * `ResultadoDoEnvio.messageId` e jogava fora, então post saído pelo
   * botão não tinha como ser removido. Foi descoberto do jeito caro:
   * um perfume feminino no canal masculino, sem como tirar.
   *
   * Fica opcional porque "já enviei por fora" não tem id nenhum para
   * dar, e isso é verdade, não omissão.
   */
  /**
   * O id do post na plataforma. Número no Telegram, texto no WhatsApp
   * (D-071) — e por isso ele **não escolhe a coluna sozinho**: quem
   * decide é a plataforma do canal, lida aqui dentro. Deixar quem chama
   * escolher já foi tentado no laço automático e é onde o id acaba na
   * coluna errada quando alguém acrescenta uma terceira plataforma.
   */
  messageId?: number | string | null,
): Promise<void> {
  const db = supabaseServidor();

  /*
    O ERRO É CONFERIDO, e a falta disso custou caro em 01/08.

    A constraint `publicacao_enviada_tem_link` é `not valid`, e isso
    **não quer dizer desligada**: ela não revalida linha antiga, mas
    vale para todo UPDATE. Publicação sem `link_afiliado` marcada como
    `enviada` pelo fluxo é recusada pelo banco.

    Sem conferir o erro, a sequência era esta, e ela é silenciosa do
    começo ao fim:

      1. a tela manda a mensagem ao Telegram, e ela CHEGA no grupo
      2. o UPDATE é recusado pela constraint
      3. ninguém olha o erro, a linha continua `pendente`
      4. a tela mostra "não enviada", o dono clica de novo
      5. o grupo recebe a mesma oferta duas, três vezes

    Nove publicações foram ao canal desse jeito. O canal viu; o sistema
    não. Lançar aqui faz a tela mostrar o erro em vez de fingir que
    nada aconteceu.
  */
  const { error } = await db
    .from("publicacao")
    .update({
      estado: "enviada",
      origem,
      enviada_em: new Date().toISOString(),
      enviada_por: enviadaPor ?? null,
      ...(mensagem ? { mensagem } : {}),
      ...(await colunaDoMessageId(id, messageId)),
      cancelada_em: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      `A mensagem foi enviada ao canal mas NÃO consegui registrar: ${error.message}. ` +
        "Não clique em enviar de novo, senão o grupo recebe repetido.",
    );
  }

  // O canal passa a contar a partir daqui: é o que alimenta "última
  // publicação" na tela de canais e o alerta de canal parado.
  const { data: publicacao } = await db
    .from("publicacao")
    .select("canal_id")
    .eq("id", id)
    .maybeSingle();

  if (publicacao) {
    await db
      .from("canal")
      .update({ ultima_publicacao_em: new Date().toISOString() })
      .eq("id", publicacao.canal_id);
  }
}

/**
 * Desfazer no envio, em vez de confirmação antes.
 *
 * Diálogo de confirmação custa um toque em 100% dos casos para proteger
 * 2%. O desfazer custa zero no caminho feliz.
 */
export async function desfazEnvio(id: string): Promise<void> {
  const db = supabaseServidor();
  await db
    .from("publicacao")
    .update({ estado: "pendente", enviada_em: null, enviada_por: null, origem: "fluxo" })
    .eq("id", id);
}

export async function cancelaPublicacao(id: string): Promise<void> {
  const db = supabaseServidor();
  await db
    .from("publicacao")
    .update({ estado: "cancelada", cancelada_em: new Date().toISOString() })
    .eq("id", id);
}

/** Cancelar também tem volta: é decisão interna, nada saiu daqui. */
export async function desfazCancelamento(id: string): Promise<void> {
  const db = supabaseServidor();
  await db.from("publicacao").update({ estado: "pendente", cancelada_em: null }).eq("id", id);
}

/**
 * Devolve para a aprovação a oferta cuja publicação travou por preço.
 *
 * As publicações pendentes dela somem — mas as já enviadas ficam, e
 * isso não é detalhe: a mensagem foi ao grupo e o subid está
 * circulando. Apagá-la faria a venda voltar do marketplace sem dono.
 *
 * A oferta volta para `nova` com o **preço de agora**, que é sobre o
 * que a decisão nova precisa acontecer.
 */
export async function devolveParaAprovacao(ofertaId: string): Promise<void> {
  const db = supabaseServidor();

  const { data: oferta } = await db
    .from("oferta")
    .select("id, anuncio_id, preco_referencia_centavos")
    .eq("id", ofertaId)
    .maybeSingle();
  if (!oferta) return;

  const { data: ponto } = await db
    .from("preco_ponto")
    .select("preco_centavos")
    .eq("anuncio_id", oferta.anuncio_id)
    .order("coletado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  await db
    .from("publicacao")
    .delete()
    .eq("oferta_id", ofertaId)
    .in("estado", ["pendente", "bloqueada"]);

  const precoAgora = ponto?.preco_centavos;
  const referencia = oferta.preco_referencia_centavos;

  await db
    .from("oferta")
    .update({
      status: "nova",
      motivo_rejeicao: null,
      decidida_em: null,
      decidida_por: null,
      ...(precoAgora
        ? {
            preco_atual_centavos: precoAgora,
            desconto_pct: Math.round(((referencia - precoAgora) / referencia) * 100),
          }
        : {}),
    })
    .eq("id", ofertaId);
}
