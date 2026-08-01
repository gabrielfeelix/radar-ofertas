import "server-only";

import { supabaseServidor } from "@/lib/supabase/servidor";
import { leHorarios } from "@/lib/horarios";

/**
 * Os canais de distribuição, lidos do banco.
 *
 * Foi o primeiro dos três módulos a substituir a operação simulada que
 * vivia em memória do servidor, em 31/07 — decisão do dono: *"quero ver
 * só o que for de verdade"*. Os outros dois são `lib/ofertas.ts` e
 * `lib/publicacoes.ts`, e com eles a simulação deixou de existir.
 *
 * A forma dos dados é a mesma que as telas já consumiam. Isso é
 * exatamente o que a D-026 prometia quando aceitou a simulação: a tela
 * chama uma função, e um dia ela lê memória, no outro lê banco, sem a
 * tela precisar saber.
 *
 * O nome do arquivo é `distribuicao` porque `canais.ts` já existe e é
 * outra coisa — o leitor de identificador de canal do Telegram, usado
 * pela colheita.
 */

export type Plataforma = "whatsapp" | "telegram";

export type Canal = {
  id: string;
  nome: string;
  plataforma: Plataforma;
  /** Slugs dos nichos que este canal aceita. É o que roteia a oferta. */
  nichos: string[];
  /**
   * O recorte fino dentro do nicho (migration 37).
   *
   * Só a leitura, de propósito: quem edita é o `scripts/cria-canais.mjs`,
   * e a tela mostra porque sem isso o Radar Perfumes (masc) recebendo
   * metade das ofertas de perfume parece defeito. Um filtro invisível é
   * indistinguível de um bug.
   */
  filtros: { atributo: string; valores: string[]; modo: "inclui" | "exclui" }[];
  tetoDiario: number;
  /**
   * Calculado, **nunca guardado**. Guardado ele mente: publicava-se
   * seis no canal e as vagas restantes continuavam as mesmas, o que
   * faz a capacidade — o número que muda o comportamento de quem
   * aprova — apontar para o lugar errado logo depois do trabalho
   * começar.
   */
  publicadasHoje: number;
  audiencia: number;
  parceiro: string;
  operador: string;
  splitAudienciaPct: number;
  splitOperacaoPct: number;
  /** Como a pessoa escreveu, no fuso de São Paulo (regra 3.9). */
  horarios: string;
  /** `@canal` ou o id numérico. É para onde o bot publica. */
  telegramChatId: string | null;
  ativo: boolean;
  ultimaPublicacaoEm: string | null;
};

/** O que sobra para o dono depois das duas parcelas do parceiro. */
export function parteDoDono(canal: Canal): number {
  return 100 - canal.splitAudienciaPct - canal.splitOperacaoPct;
}

/**
 * Meia-noite de hoje em São Paulo, em UTC.
 *
 * Contar publicação "de hoje" por UTC puro erraria a conta todo dia
 * entre 21h e meia-noite — que é justamente uma das três janelas de
 * pico, quando mais se publica.
 */
function inicioDoDiaLocal(): string {
  const agora = new Date();
  const dia = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  // São Paulo é UTC-3 o ano inteiro desde o fim do horário de verão.
  return `${dia}T03:00:00.000Z`;
}

type LinhaDeCanal = {
  id: string;
  nome: string;
  plataforma: string;
  posts_por_dia_max: number;
  membros_estimados: number | null;
  split_audiencia_pct: number;
  split_operacao_pct: number;
  horarios_permitidos: number[] | null;
  ativo: boolean;
  telegram_chat_id: string | null;
  ultima_publicacao_em: string | null;
  parceiro: { nome: string } | null;
  canal_nicho: { nicho: { slug: string } | null }[] | null;
  canal_atributo: { atributo: string; valores: string[]; modo: string }[] | null;
};

const SELECAO = `
  id, nome, plataforma, posts_por_dia_max, membros_estimados,
  split_audiencia_pct, split_operacao_pct, horarios_permitidos,
  ativo, telegram_chat_id, ultima_publicacao_em,
  parceiro:parceiro_id ( nome ),
  canal_nicho ( nicho:nicho_id ( slug ) ),
  canal_atributo ( atributo, valores, modo )
`;

function montaCanal(linha: LinhaDeCanal, publicadasHoje: number): Canal {
  return {
    id: linha.id,
    nome: linha.nome,
    plataforma: linha.plataforma === "telegram" ? "telegram" : "whatsapp",
    nichos: (linha.canal_nicho ?? []).map((c) => c.nicho?.slug).filter((s): s is string => !!s),
    filtros: (linha.canal_atributo ?? []).map((f) => ({
      atributo: f.atributo,
      valores: f.valores,
      modo: f.modo === "exclui" ? ("exclui" as const) : ("inclui" as const),
    })),
    tetoDiario: linha.posts_por_dia_max,
    publicadasHoje,
    audiencia: linha.membros_estimados ?? 0,
    parceiro: linha.parceiro?.nome ?? "você",
    operador: linha.parceiro?.nome ?? "você",
    splitAudienciaPct: Number(linha.split_audiencia_pct),
    splitOperacaoPct: Number(linha.split_operacao_pct),
    // O banco guarda hora inteira (`integer[]`) e a tela conversa em
    // "07:30, 12:30". A volta perde o minuto — dívida anotada, e o
    // conserto é a coluna virar `text` numa migration futura.
    horarios: (linha.horarios_permitidos ?? [])
      .map((h) => `${String(h).padStart(2, "0")}:00`)
      .join(", "),
    telegramChatId: linha.telegram_chat_id,
    ativo: linha.ativo,
    ultimaPublicacaoEm: linha.ultima_publicacao_em,
  };
}

export async function canais(): Promise<Canal[]> {
  const db = supabaseServidor();

  const { data: linhas } = await db.from("canal").select(SELECAO).order("criado_em");
  if (!linhas) return [];

  // Uma consulta só para o contador do dia, não uma por canal.
  const { data: publicadas } = await db
    .from("publicacao")
    .select("canal_id")
    .eq("estado", "enviada")
    .gte("enviada_em", inicioDoDiaLocal());

  const porCanal = new Map<string, number>();
  for (const p of publicadas ?? []) {
    porCanal.set(p.canal_id, (porCanal.get(p.canal_id) ?? 0) + 1);
  }

  return (linhas as unknown as LinhaDeCanal[]).map((l) => montaCanal(l, porCanal.get(l.id) ?? 0));
}

export async function buscaCanal(id: string): Promise<Canal | undefined> {
  const todos = await canais();
  return todos.find((c) => c.id === id);
}

/** Vagas que ainda cabem hoje, somando os canais ativos. */
export async function vagasDeHoje(): Promise<number> {
  const lista = await canais();
  return lista
    .filter((c) => c.ativo)
    .reduce((total, c) => total + Math.max(0, c.tetoDiario - c.publicadasHoje), 0);
}

export function vagasDoCanal(canal: Canal): number {
  return Math.max(0, canal.tetoDiario - canal.publicadasHoje);
}

/** Os canais ativos que aceitam este nicho. É o que roteia a oferta. */
export async function canaisElegiveis(nichoSlug: string): Promise<Canal[]> {
  const lista = await canais();
  return lista.filter((c) => c.ativo && c.nichos.includes(nichoSlug));
}

export type DadosDoCanal = {
  nome: string;
  plataforma: Plataforma;
  /**
   * `@canal` ou o id numérico, e **obrigatório no Telegram** — o banco
   * recusa a linha sem ele. Era o buraco que impedia criar canal de
   * Telegram pela tela: a ação nunca mandava o campo, e o erro chegava
   * como "não consegui salvar no banco", sem dizer o que faltava.
   */
  telegramChatId?: string | null;
  nichos: string[];
  tetoDiario: number;
  audiencia: number;
  splitAudienciaPct: number;
  splitOperacaoPct: number;
  horarios: string;
};

function horasDoTexto(texto: string): number[] {
  return leHorarios(texto).map((h) => Number(h.slice(0, 2)));
}

/** Grava canal novo e devolve o id. Os nichos entram na tabela de ligação. */
export async function criaCanal(dados: DadosDoCanal): Promise<string | null> {
  const db = supabaseServidor();

  const { data: operacao } = await db.from("nicho").select("operacao_id").limit(1).maybeSingle();
  if (!operacao) return null;

  const { data: canal, error } = await db
    .from("canal")
    .insert({
      operacao_id: operacao.operacao_id,
      nome: dados.nome,
      plataforma: dados.plataforma,
      telegram_chat_id: dados.telegramChatId || null,
      posts_por_dia_max: dados.tetoDiario,
      membros_estimados: dados.audiencia,
      split_audiencia_pct: dados.splitAudienciaPct,
      split_operacao_pct: dados.splitOperacaoPct,
      horarios_permitidos: horasDoTexto(dados.horarios),
    })
    .select("id")
    .single();

  if (error || !canal) return null;

  await ligaNichos(canal.id, dados.nichos);
  return canal.id;
}

export async function atualizaCanal(id: string, dados: DadosDoCanal): Promise<void> {
  const db = supabaseServidor();

  await db
    .from("canal")
    .update({
      nome: dados.nome,
      plataforma: dados.plataforma,
      telegram_chat_id: dados.telegramChatId || null,
      posts_por_dia_max: dados.tetoDiario,
      membros_estimados: dados.audiencia,
      split_audiencia_pct: dados.splitAudienciaPct,
      split_operacao_pct: dados.splitOperacaoPct,
      horarios_permitidos: horasDoTexto(dados.horarios),
    })
    .eq("id", id);

  await ligaNichos(id, dados.nichos);
}

/**
 * Desligar **não apaga nada**: o histórico do canal continua, porque é
 * ele que sustenta a prestação de contas ao parceiro depois.
 */
export async function alternaCanalAtivo(id: string, ativo: boolean): Promise<void> {
  const db = supabaseServidor();
  await db.from("canal").update({ ativo }).eq("id", id);
}

async function ligaNichos(canalId: string, slugs: string[]): Promise<void> {
  const db = supabaseServidor();

  const { data: nichos } = await db.from("nicho").select("id, slug").in("slug", slugs);
  await db.from("canal_nicho").delete().eq("canal_id", canalId);

  if (nichos && nichos.length > 0) {
    await db.from("canal_nicho").insert(nichos.map((n) => ({ canal_id: canalId, nicho_id: n.id })));
  }
}

/** Os nichos que existem, para o formulário oferecer. */
export async function nichosDisponiveis(): Promise<{ slug: string; nome: string }[]> {
  const db = supabaseServidor();
  const { data } = await db.from("nicho").select("slug, nome").eq("ativo", true).order("nome");
  return data ?? [];
}
