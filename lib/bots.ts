import "server-only";

import { diaDoAquecimento, tetoDoDia } from "@/lib/aquecimento";
import { inicioDoDiaEmSaoPaulo } from "@/lib/ritmo";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { instanciaEstaViva } from "@/lib/whatsapp";

/**
 * Os bots — quem fala pelos canais.
 *
 * Existe porque o sistema sabia por qual chip publicar e nada sobre o
 * chip: quando começou a aquecer, se está conectado, quanto já falou
 * hoje. As três perguntas aparecem em momentos previsíveis — a rampa
 * dos 14 dias, a queda do número, e o segundo chip.
 *
 * O ESTADO DA CONEXÃO É LIDO AO VIVO E NUNCA GRAVADO. Estado gravado
 * mente: diria "conectado" com o número já banido há seis horas, que é
 * justamente o momento em que esta tela precisa estar certa.
 *
 * E a leitura não derruba a página. Uma VPS fora do ar não pode quebrar
 * a tela que serve para descobrir que a VPS está fora do ar.
 */

export type Plataforma = "whatsapp" | "telegram";

export type Bot = {
  id: string;
  nome: string;
  plataforma: Plataforma;
  identificador: string;
  instancia: string | null;
  /** O NOME da variável de ambiente. Nunca o valor. */
  variavelDoSegredo: string;
  aquecimentoInicio: string | null;
  enviosDiaMax: number;
  ativo: boolean;
  observacao: string | null;
  /** Quantos canais este bot serve. */
  canais: number;
  /** Publicações que saíram por ele hoje, no dia de São Paulo. */
  enviadasHoje: number;
  /** Nulo em bot de Telegram, que não tem rampa. */
  diaDeAquecimento: number | null;
  /** O teto de hoje: a rampa enquanto aquece, o teto cheio depois. */
  tetoDeHoje: number;
  /** Nulo quando não se aplica: Telegram, ou WhatsApp sem instância. */
  conexao: { ok: boolean; estado?: string; motivo?: string } | null;
};

/** O que a tela de canais precisa para montar o seletor de bot. */
export type BotParaEscolha = {
  id: string;
  nome: string;
  plataforma: Plataforma;
  identificador: string;
};

const SELECAO =
  "id, nome, plataforma, identificador, instancia, variavel_do_segredo, aquecimento_inicio, envios_dia_max, ativo, observacao";

/**
 * Todos os bots, com o estado de hoje.
 *
 * A conexão de cada um é consultada em paralelo e com timeout curto —
 * são chamadas de rede à VPS, e em série a tela ficaria lenta na razão
 * do número de chips.
 */
export async function bots(): Promise<Bot[]> {
  const db = supabaseServidor();

  const { data: linhas } = await db.from("bot").select(SELECAO).order("criado_em");
  if (!linhas || linhas.length === 0) return [];

  const { data: canais } = await db.from("canal").select("id, bot_id");
  const { data: enviadas } = await db
    .from("publicacao")
    .select("canal_id")
    .not("enviada_em", "is", null)
    .gte("enviada_em", inicioDoDiaEmSaoPaulo(new Date()).toISOString());

  const botDoCanal = new Map((canais ?? []).map((c) => [c.id, c.bot_id]));

  const enviadasPorBot = new Map<string, number>();
  for (const p of enviadas ?? []) {
    const bot = botDoCanal.get(p.canal_id);
    if (bot) enviadasPorBot.set(bot, (enviadasPorBot.get(bot) ?? 0) + 1);
  }

  const canaisPorBot = new Map<string, number>();
  for (const c of canais ?? []) {
    if (c.bot_id) canaisPorBot.set(c.bot_id, (canaisPorBot.get(c.bot_id) ?? 0) + 1);
  }

  const agora = new Date();

  return Promise.all(
    linhas.map(async (l) => {
      const dia = l.aquecimento_inicio ? diaDoAquecimento(l.aquecimento_inicio, agora) : null;

      return {
        id: l.id,
        nome: l.nome,
        plataforma: (l.plataforma === "telegram" ? "telegram" : "whatsapp") as Plataforma,
        identificador: l.identificador,
        instancia: l.instancia,
        variavelDoSegredo: l.variavel_do_segredo,
        aquecimentoInicio: l.aquecimento_inicio,
        enviosDiaMax: l.envios_dia_max,
        ativo: l.ativo,
        observacao: l.observacao,
        canais: canaisPorBot.get(l.id) ?? 0,
        enviadasHoje: enviadasPorBot.get(l.id) ?? 0,
        diaDeAquecimento: dia,
        tetoDeHoje: dia === null ? l.envios_dia_max : tetoDoDia(dia, l.envios_dia_max),
        conexao:
          l.plataforma === "whatsapp" && l.instancia
            ? await instanciaEstaViva(l.instancia).catch((erro: Error) => ({
                ok: false,
                motivo: erro.message,
              }))
            : null,
      };
    }),
  );
}

/**
 * Os bots que podem ser escolhidos por um canal.
 *
 * Só os ativos: bot desativado no seletor é convite a apontar um canal
 * para um chip que ninguém pretende usar, e o canal ficaria mudo sem
 * que a tela dissesse por quê.
 */
export async function botsParaEscolha(): Promise<BotParaEscolha[]> {
  const db = supabaseServidor();
  const { data } = await db
    .from("bot")
    .select("id, nome, plataforma, identificador")
    .eq("ativo", true)
    .order("nome");

  return (data ?? []).map((b) => ({
    id: b.id,
    nome: b.nome,
    plataforma: (b.plataforma === "telegram" ? "telegram" : "whatsapp") as Plataforma,
    identificador: b.identificador,
  }));
}

/**
 * O nome da instância de um bot, que é o que a Evolution entende.
 *
 * Existe para o caminho de publicação: o canal guarda `bot_id`, e quem
 * publica precisa do nome da instância. Devolve string vazia quando não
 * há bot ou não há instância — e quem chama trata isso como canal sem
 * chip cadastrado, que é o que é.
 */
export async function instanciaDoBot(botId: string | null): Promise<string> {
  if (!botId) return "";

  const db = supabaseServidor();
  const { data } = await db.from("bot").select("instancia, ativo").eq("id", botId).single();

  return data?.ativo ? (data.instancia ?? "") : "";
}
