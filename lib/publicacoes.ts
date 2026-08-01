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
  enviadaEm: string | null;
  origem: OrigemDoEnvio | null;
  cancelada: boolean;
};

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
  oferta: {
    id: string;
    anuncio_id: string;
    preco_atual_centavos: number;
    preco_referencia_centavos: number;
    referencia_janela_dias: number;
    desconto_pct: number;
    pode_afirmar_minimo: boolean;
    detectada_em: string;
    anuncio: {
      url_original: string;
      vendedor: string | null;
      marketplace: { nome: string; slug: string } | null;
      produto: { titulo_canonico: string; nicho: { slug: string } | null } | null;
    } | null;
  } | null;
};

const SELECAO = `
  id, oferta_id, canal_id, subid, preco_na_fila_centavos, estado, origem, enviada_em,
  oferta:oferta_id (
    id, anuncio_id, preco_atual_centavos, preco_referencia_centavos,
    referencia_janela_dias, desconto_pct, pode_afirmar_minimo, detectada_em,
    anuncio:anuncio_id (
      url_original, vendedor,
      marketplace:marketplace_id ( nome, slug ),
      produto:produto_id ( titulo_canonico, nicho:nicho_id ( slug ) )
    )
  )
`;

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
        observadoDesde: oferta.detectada_em.slice(0, 10),
        podeAfirmarMinimo: oferta.pode_afirmar_minimo,
      },
      precoNaFilaCentavos: linha.preco_na_fila_centavos,
      precoAgoraCentavos: precoAgora.get(oferta.anuncio_id) ?? oferta.preco_atual_centavos,
      subid: linha.subid,
      link: montaLinkDeAfiliado(
        anuncio?.url_original ?? "",
        linha.subid,
        anuncio?.marketplace?.slug ?? "",
      ),
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
export async function marcaEnviada(
  id: string,
  origem: OrigemDoEnvio,
  mensagem?: string,
  enviadaPor?: string,
): Promise<void> {
  const db = supabaseServidor();

  await db
    .from("publicacao")
    .update({
      estado: "enviada",
      origem,
      enviada_em: new Date().toISOString(),
      enviada_por: enviadaPor ?? null,
      ...(mensagem ? { mensagem } : {}),
      cancelada_em: null,
    })
    .eq("id", id);

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
