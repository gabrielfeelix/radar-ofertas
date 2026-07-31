import "server-only";

import { readFileSync } from "node:fs";

import { canais } from "@/lib/distribuicao";
import { publicacoesDaFila } from "@/lib/publicacoes";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { SaudeOperacaoLinha } from "@/lib/supabase/tipos";

/**
 * Precisa de atenção — o que está quebrado e você não viu.
 *
 * Esta tela existe porque **as falhas deste sistema são silenciosas**.
 * A coleta para e nada acontece: nenhum erro na tela, nenhuma oferta a
 * menos hoje, só um buraco na série histórica que aparece semanas
 * depois, quando já não dá para consertar. O preço da terça passada
 * não existe mais em lugar nenhum.
 *
 * A REGRA QUE MANDA AQUI: só aparece o que exige ação humana. Aviso
 * que não pede ação nenhuma treina o dono a ignorar a área inteira — e
 * aí o aviso que importa passa junto. Por isso nada de "tudo certo,
 * 340 anúncios coletados": isso é a tela de anúncios.
 *
 * A montagem mora aqui, e não na tela, por dois motivos. Primeiro,
 * cada alerta precisa dizer o TAMANHO do problema e o IMPACTO dele, e
 * isso é regra de negócio. Segundo, quando o backend substituir a
 * simulação, muda este arquivo e a tela não sabe.
 */

export type Severidade = "critico" | "atencao" | "informativo";

export type Alerta = {
  id: string;
  severidade: Severidade;
  /** De onde vem: coleta, curadoria, canais, configuração. */
  area: string;
  /** O número que dimensiona o problema. */
  metrica: string;
  metricaRotulo: string;
  titulo: string;
  detalhe: string;
  /** O que acontece se ninguém fizer nada. É o que separa alerta de ruído. */
  impacto: string;
  /** Para onde ir. Ausente quando a ação é fora do sistema. */
  acao?: { rotulo: string; href: string };
  /** Quando a ação depende do dono e não de código. */
  dependeDeVoce?: boolean;
};

export type QuadroDeAtencao = {
  alertas: Alerta[];
  /** Nulo quando o banco não respondeu — e aí isso é o próprio alerta. */
  verificadoEm: Date | null;
  bancoRespondeu: boolean;
};

/** Dias sem coleta a partir dos quais um anúncio é considerado parado. */
const DIAS_PARA_ANUNCIO_PARADO = 2;

/** Horas sem rotina a partir das quais a coleta é considerada atrasada. */
const HORAS_DE_TOLERANCIA_DA_ROTINA = 26;

/** Dias sem publicar a partir dos quais um canal é considerado esquecido. */
const DIAS_SEM_PUBLICAR = 5;

/**
 * O GitHub desativa workflow agendado após 60 dias sem commit no
 * repositório. É a armadilha mais silenciosa de todas: a coleta
 * simplesmente para, sem erro em lugar nenhum.
 */
const DIAS_ATE_O_AGENDADOR_DORMIR = 60;
const DIAS_PARA_AVISAR_DO_AGENDADOR = 45;

export async function montaQuadroDeAtencao(): Promise<QuadroDeAtencao> {
  const alertas: Alerta[] = [];
  const agora = new Date();

  const saude = await leSaude();

  if (saude === null) {
    return {
      alertas: [
        {
          id: "banco-fora",
          severidade: "critico",
          area: "infraestrutura",
          metrica: "—",
          metricaRotulo: "sem resposta",
          titulo: "O banco não respondeu",
          detalhe:
            "Sem banco não há coleta, não há série e não há fila. Se o painel está rodando na sua máquina, o Docker do Supabase provavelmente não subiu: rode pnpm db:sobe.",
          impacto: "Cada dia sem coleta é um buraco permanente na série de preço.",
        },
      ],
      verificadoEm: null,
      bancoRespondeu: false,
    };
  }

  // --- Coleta ---------------------------------------------------
  const rotina = descreveRotina(saude.ultima_coleta, saude.ultima_coleta_ok, agora);
  if (rotina) alertas.push(rotina);

  if (saude.anuncios_parados > 0) {
    alertas.push({
      id: "anuncios-parados",
      severidade: "critico",
      area: "coleta",
      metrica: `${saude.anuncios_parados}`,
      metricaRotulo: saude.anuncios_parados === 1 ? "anúncio" : "anúncios",
      titulo: `Sem coleta há mais de ${DIAS_PARA_ANUNCIO_PARADO} dias`,
      detalhe:
        "Anúncio que parou de coletar continua no catálogo parecendo saudável, mas a série dele congela. Quando voltar a coletar, o buraco no meio fica lá para sempre.",
      impacto: "A série desses anúncios não serve mais de referência de desconto.",
      acao: { rotulo: "Ver os anúncios", href: "/" },
    });
  }

  // --- Configuração que bloqueia tudo ---------------------------
  if (saude.lojas_sem_credencial > 0) {
    alertas.push({
      id: "lojas-sem-credencial",
      severidade: "critico",
      area: "configuração",
      metrica: `${saude.lojas_sem_credencial}`,
      metricaRotulo: saude.lojas_sem_credencial === 1 ? "loja" : "lojas",
      titulo: "Sem credencial de afiliado",
      detalhe:
        "O coletor roda, pula essas lojas e informa. Nenhum preço entra, então nenhum anúncio delas vira oferta — e o catálogo cresce sem virar nada.",
      impacto: "É o bloqueio do dia 1: sem credencial não existe série nem link de afiliado.",
      dependeDeVoce: true,
    });
  }

  if (saude.lojas_sem_comissao > 0) {
    alertas.push({
      id: "lojas-sem-comissao",
      severidade: "atencao",
      area: "configuração",
      metrica: `${saude.lojas_sem_comissao}`,
      metricaRotulo: saude.lojas_sem_comissao === 1 ? "loja" : "lojas",
      titulo: "Sem percentual de comissão",
      detalhe:
        "Sem o percentual, a comissão estimada é nula e toda oferta da loja é reprovada por comissão não configurada. É bloqueio de configuração disfarçado de curadoria rigorosa.",
      impacto: "Você cadastraria anúncios por semanas sem entender por que nada vira oferta.",
      dependeDeVoce: true,
    });
  }

  // --- Catálogo -------------------------------------------------
  if (saude.produtos_sem_nicho > 0) {
    alertas.push({
      id: "produtos-sem-nicho",
      severidade: "atencao",
      area: "catálogo",
      metrica: `${saude.produtos_sem_nicho}`,
      metricaRotulo: saude.produtos_sem_nicho === 1 ? "produto" : "produtos",
      titulo: "Sem nicho, e por isso sem canal",
      detalhe:
        "Nicho é o que roteia oferta para canal. Produto sem nicho nunca chega a canal nenhum e some do fluxo em silêncio — ele não dá erro, ele só não acontece.",
      impacto: "Esses produtos podem virar oferta e nunca serão publicados.",
      acao: { rotulo: "Ver o catálogo", href: "/" },
    });
  }

  if (saude.mencoes_com_problema > 0) {
    alertas.push({
      id: "mencoes-com-problema",
      severidade: "atencao",
      area: "colheita",
      metrica: `${saude.mencoes_com_problema}`,
      metricaRotulo: "menções",
      titulo: "Link avistado que não virou anúncio",
      detalhe:
        "Formato de link que o leitor ainda não entende, ou loja que não está cadastrada. Cada um desses é um produto que existe e não entrou no radar.",
      impacto: "O catálogo cresce mais devagar do que deveria, sem nenhum erro aparecer.",
      acao: { rotulo: "Ver as menções", href: "/colheita/mencoes" },
    });
  }

  // --- Canais (operação simulada, por enquanto) -----------------
  alertas.push(...(await alertasDosCanais(agora)));

  // --- A armadilha do agendador ---------------------------------
  const agendador = alertaDoAgendador(agora);
  if (agendador) alertas.push(agendador);

  const ordem: Record<Severidade, number> = { critico: 0, atencao: 1, informativo: 2 };
  alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

  return { alertas, verificadoEm: agora, bancoRespondeu: true };
}

/**
 * O estado da rotina diária.
 *
 * "Nunca rodou" e "rodou e falhou" são problemas diferentes, e
 * ausência de alerta só tranquiliza se der para distinguir os dois de
 * "está tudo em dia".
 */
function descreveRotina(
  ultima: string | null,
  deuCerto: boolean | null,
  agora: Date,
): Alerta | null {
  if (ultima === null) {
    return {
      id: "rotina-nunca-rodou",
      severidade: "atencao",
      area: "coleta",
      metrica: "0",
      metricaRotulo: "execuções",
      titulo: "A rotina diária nunca rodou",
      detalhe:
        "Nenhuma execução registrada. Enquanto o agendamento não estiver de pé, nada coleta sozinho — e a série só começa a existir quando a coleta começa.",
      impacto: "Sem série não existe oferta: é a corrente inteira parada no primeiro elo.",
      dependeDeVoce: true,
    };
  }

  const horas = (agora.getTime() - new Date(ultima).getTime()) / 3_600_000;

  if (deuCerto === false) {
    return {
      id: "rotina-falhou",
      severidade: "critico",
      area: "coleta",
      metrica: descreveHoras(horas),
      metricaRotulo: "atrás",
      titulo: "A última rotina falhou",
      detalhe:
        "A coleta terminou com erro. O dia de hoje não tem ponto de preço, e ponto de preço não se recupera depois: o preço de hoje não existe mais amanhã.",
      impacto: "Um buraco permanente na série de todos os anúncios ativos.",
    };
  }

  if (horas > HORAS_DE_TOLERANCIA_DA_ROTINA) {
    return {
      id: "rotina-atrasada",
      severidade: "critico",
      area: "coleta",
      metrica: descreveHoras(horas),
      metricaRotulo: "sem rodar",
      titulo: "A rotina diária está atrasada",
      detalhe:
        "Passou da janela de um dia e nada rodou. Falha de agendador não avisa: ela se manifesta como um dia que simplesmente não tem preço.",
      impacto: "Mais um dia sem coleta é mais um buraco que não fecha.",
    };
  }

  return null;
}

/**
 * Canais que pararam de publicar, e publicação auto-declarada sem
 * sinal de vida.
 *
 * A auto-declarada é o único sinal de supervisão sobre operador
 * remoto que o sistema tem: se ela nunca recebe clique, ou o envio não
 * aconteceu, ou o canal está morto. Não é prova de nada — é o sinal
 * certo, no lugar certo.
 */
async function alertasDosCanais(agora: Date): Promise<Alerta[]> {
  const alertas: Alerta[] = [];

  const esquecidos = (await canais()).filter((canal) => {
    if (!canal.ativo || !canal.ultimaPublicacaoEm) return false;
    const dias = (agora.getTime() - new Date(canal.ultimaPublicacaoEm).getTime()) / 86_400_000;
    return dias >= DIAS_SEM_PUBLICAR;
  });

  if (esquecidos.length > 0) {
    alertas.push({
      id: "canais-parados",
      severidade: "atencao",
      area: "canais",
      metrica: `${esquecidos.length}`,
      metricaRotulo: esquecidos.length === 1 ? "canal" : "canais",
      titulo: `Sem publicar há ${DIAS_SEM_PUBLICAR} dias ou mais`,
      detalhe: `${esquecidos.map((c) => c.nome).join(", ")}. Canal ativo que não recebe nada há dias é audiência esfriando — e o parceiro percebe antes de você.`,
      impacto: "Grupo parado perde membro, e membro perdido não volta com uma oferta boa.",
      acao: { rotulo: "Ver os canais", href: "/canais" },
    });
  }

  const autoDeclaradas = (await publicacoesDaFila()).filter((p) => p.origem === "auto_declarada");
  if (autoDeclaradas.length > 0) {
    alertas.push({
      id: "auto-declaradas",
      severidade: "informativo",
      area: "canais",
      metrica: `${autoDeclaradas.length}`,
      metricaRotulo: autoDeclaradas.length === 1 ? "publicação" : "publicações",
      titulo: "Marcadas como enviadas por fora do fluxo",
      detalhe:
        "Alguém declarou que publicou sem passar pelo botão. Pode ser verdade — mas se nenhuma delas receber clique nas próximas 24 horas, ou o envio não aconteceu, ou o canal não está lendo.",
      impacto: "Publicação sem clique não gera comissão, e ninguém fica sabendo.",
      acao: { rotulo: "Ver a fila", href: "/publicar" },
    });
  }

  return alertas;
}

/**
 * A armadilha do GitHub Actions: workflow agendado é desativado após
 * 60 dias sem commit no repositório.
 *
 * Ninguém avisa, e o sintoma é a coleta parar de rodar sem erro. O
 * contador vem da data do último commit, lida do próprio `.git`.
 */
function alertaDoAgendador(agora: Date): Alerta | null {
  const ultimoCommit = leDataDoUltimoCommit();
  if (ultimoCommit === null) return null;

  const dias = Math.floor((agora.getTime() - ultimoCommit.getTime()) / 86_400_000);
  const faltam = DIAS_ATE_O_AGENDADOR_DORMIR - dias;

  if (dias < DIAS_PARA_AVISAR_DO_AGENDADOR) return null;

  return {
    id: "agendador-dormindo",
    severidade: faltam <= 7 ? "critico" : "atencao",
    area: "infraestrutura",
    metrica: `${Math.max(0, faltam)}`,
    metricaRotulo: "dias",
    titulo:
      faltam <= 0
        ? "O agendador já pode ter sido desativado"
        : "O agendador vai dormir por inatividade",
    detalhe:
      "O GitHub desativa workflow agendado depois de 60 dias sem commit no repositório. Um commit qualquer zera o contador.",
    impacto: "A coleta para de rodar sem dar erro em lugar nenhum.",
    dependeDeVoce: true,
  };
}

/** Data do último commit, lida de `.git/logs/HEAD`. */
function leDataDoUltimoCommit(): Date | null {
  try {
    const registro = readFileSync(".git/logs/HEAD", "utf8").trimEnd();
    const ultimaLinha = registro.slice(registro.lastIndexOf("\n") + 1);
    // Formato: <antes> <depois> <autor> <epoch> <fuso>\t<mensagem>
    const marca = ultimaLinha.split("\t")[0].trim().split(" ").at(-2);
    const epoch = Number(marca);
    return Number.isFinite(epoch) ? new Date(epoch * 1000) : null;
  } catch {
    return null;
  }
}

async function leSaude(): Promise<SaudeOperacaoLinha | null> {
  try {
    const { data, error } = await supabaseServidor()
      .from("saude_operacao")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as SaudeOperacaoLinha;
  } catch {
    return null;
  }
}

function descreveHoras(horas: number): string {
  if (horas < 48) return `${Math.floor(horas)}h`;
  return `${Math.floor(horas / 24)}d`;
}
