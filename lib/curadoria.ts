import "server-only";

import { supabaseServidor } from "@/lib/supabase/servidor";
import type { ComportaDiaLinha, NichoLinha, ParametroLinha } from "@/lib/supabase/tipos";

/**
 * Os limiares da curadoria, com o efeito recente de cada um.
 *
 * A REGRA QUE DEFINE ESTA TELA: mostrar a taxa de reprovação **junto do
 * controle que a altera**. Aprovação perto de zero com catálogo grande
 * significa parâmetro apertado demais; aprovação alta demais significa
 * que a curadoria virou carimbo. Sem esse número ao lado, o ajuste é
 * chute — e é assim que se afrouxa o motor até ele não filtrar mais
 * nada, que é o modo de morte silencioso do produto inteiro.
 *
 * O que liga um limiar ao seu efeito é a comporta: o motor grava, por
 * dia, quantos anúncios cada comporta reprovou (`comporta_dia`), e o
 * nome da comporta é a parte antes do parêntese em
 * `serie_curta(5_de_7_dias)`.
 */

export type Limiar = {
  chave: string;
  rotulo: string;
  /** O que o número significa em português. */
  explicacao: string;
  /** Como o valor é lido: 12 vira "12%", 300 vira "R$ 3,00". */
  formato: "pct" | "dias" | "centavos" | "numero" | "fracao";
  /** A comporta que este limiar controla, quando controla alguma. */
  comporta?: string;
  valorGlobal: number | null;
  excecoes: Array<{ nichoId: string; nicho: string; valor: number }>;
  /** Reprovações que esta comporta causou nos últimos dias. */
  reprovouRecente: number;
  /** Aceita exceção por nicho? Nem todo limiar faz sentido por nicho. */
  porNicho: boolean;
};

export type QuadroDaCuradoria = {
  limiares: Limiar[];
  nichos: NichoLinha[];
  /** Reprovações totais no período, por comporta. */
  totalReprovado: number;
  /** Ofertas aprovadas no período. */
  aprovadas: number;
  /** Falso quando o motor nunca rodou — e aí não há taxa nenhuma. */
  motorRodou: boolean;
  dias: number;
};

/** Janela de observação do efeito. Uma semana cobre a variação do fim de semana. */
const DIAS_DE_OBSERVACAO = 7;

/**
 * Os limiares que a tela mostra, na ordem em que importam.
 *
 * Nem todo parâmetro do banco entra aqui: `dias_resolucao_diaria` é
 * retenção de dado, não curadoria, e mostrá-lo junto ensinaria que
 * esta tela é "as configurações", que é como uma tela vira depósito.
 */
const CATALOGO_DE_LIMIARES: Array<
  Pick<Limiar, "chave" | "rotulo" | "explicacao" | "formato" | "comporta" | "porNicho">
> = [
  {
    chave: "desconto_minimo_pct",
    rotulo: "Desconto mínimo",
    explicacao:
      "Queda mínima contra a mediana que nós observamos. Abaixo disso é oscilação normal de preço, não oferta.",
    formato: "pct",
    comporta: "desconto_insuficiente",
    porNicho: true,
  },
  {
    chave: "comissao_minima_centavos",
    rotulo: "Comissão mínima",
    explicacao:
      "Oferta que rende menos que isso não paga o espaço no canal. 60% de desconto num produto de doze reais não paga o post.",
    formato: "centavos",
    comporta: "comissao_baixa",
    porNicho: true,
  },
  {
    chave: "dias_minimos_de_serie",
    rotulo: "Série mínima para avaliar",
    explicacao:
      "Dias de série própria antes de o anúncio poder virar oferta. Sem série não há referência, e sem referência o desconto é o que a loja diz que é.",
    formato: "dias",
    comporta: "serie_curta",
    porNicho: false,
  },
  {
    chave: "dias_para_afirmar",
    rotulo: "Série para afirmar mínimo",
    explicacao:
      "A partir daqui a mensagem pode falar em mínimo histórico. Antes, usa a redação honesta com a data em que começamos a observar. Mexer aqui mexe no que o canal promete.",
    formato: "dias",
    porNicho: false,
  },
  {
    chave: "recorrencia_maxima_pct",
    rotulo: "Recorrência máxima",
    explicacao:
      "Se o anúncio passou mais que esta fração da janela neste preço, não é oferta: é o preço normal com etiqueta de promoção (D-024).",
    formato: "pct",
    comporta: "preco_recorrente",
    porNicho: true,
  },
  {
    chave: "janela_minimo_dias",
    rotulo: "Janela do menor preço",
    explicacao: "Sobre quantos dias vale a comporta “é o menor preço que já vimos”.",
    formato: "dias",
    comporta: "nao_e_o_menor",
    porNicho: false,
  },
  {
    chave: "janela_referencia_dias",
    rotulo: "Janela da referência",
    explicacao: "Sobre quantos dias a mediana de referência é calculada.",
    formato: "dias",
    porNicho: false,
  },
  {
    chave: "avaliacao_minima",
    rotulo: "Nota mínima do produto",
    explicacao:
      "Nota do produto na loja, de 0 a 5, quando informada. Produto barato e ruim queima o canal igual a preço falso.",
    formato: "numero",
    comporta: "produto_mal_avaliado",
    porNicho: true,
  },
  {
    chave: "reputacao_minima",
    rotulo: "Reputação mínima do vendedor",
    explicacao:
      "Reputação do vendedor, de 0 a 1. É sinal diferente da nota do produto: produto bom de vendedor ruim pede decisão diferente.",
    formato: "fracao",
    comporta: "vendedor_fraco",
    porNicho: false,
  },
  {
    chave: "dias_recompra_mesmo_anuncio",
    rotulo: "Intervalo antes de repetir",
    explicacao:
      "Quantos dias antes de o mesmo anúncio poder sair de novo. Repetição é o que faz membro sair do grupo.",
    formato: "dias",
    porNicho: false,
  },
  {
    chave: "horas_validade_oferta",
    rotulo: "Validade da oferta na fila",
    explicacao:
      "Depois disso a oferta expira sozinha. Preço tem prazo: publicar oferta de ontem queima o canal.",
    formato: "numero",
    porNicho: false,
  },
];

export async function montaQuadroDaCuradoria(): Promise<QuadroDaCuradoria | null> {
  try {
    const db = supabaseServidor();
    const desde = new Date(Date.now() - DIAS_DE_OBSERVACAO * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const [parametros, nichos, comportas, ofertas] = await Promise.all([
      db.from("parametro").select("*"),
      db.from("nicho").select("*").order("nome"),
      db.from("comporta_dia").select("*").gte("dia", desde),
      db.from("oferta").select("id", { count: "exact", head: true }).gte("detectada_em", desde),
    ]);

    if (parametros.error) return null;

    const linhas = (parametros.data ?? []) as ParametroLinha[];
    const listaDeNichos = (nichos.data ?? []) as NichoLinha[];
    const contagem = (comportas.data ?? []) as ComportaDiaLinha[];

    const porComporta = new Map<string, number>();
    for (const linha of contagem) {
      porComporta.set(linha.comporta, (porComporta.get(linha.comporta) ?? 0) + linha.reprovados);
    }

    const limiares = CATALOGO_DE_LIMIARES.map((base): Limiar => {
      const doGlobal = linhas.find((l) => l.chave === base.chave && l.nicho_id === null);
      const excecoes = linhas
        .filter((l) => l.chave === base.chave && l.nicho_id !== null)
        .map((l) => ({
          nichoId: l.nicho_id!,
          nicho: listaDeNichos.find((n) => n.id === l.nicho_id)?.nome ?? "nicho removido",
          valor: Number(l.valor),
        }));

      return {
        ...base,
        valorGlobal: doGlobal ? Number(doGlobal.valor) : null,
        excecoes,
        reprovouRecente: base.comporta ? (porComporta.get(base.comporta) ?? 0) : 0,
      };
    });

    const totalReprovado = [...porComporta.values()].reduce((soma, n) => soma + n, 0);

    return {
      limiares,
      nichos: listaDeNichos,
      totalReprovado,
      aprovadas: ofertas.count ?? 0,
      // Sem nenhuma contagem e nenhuma oferta, o motor não rodou — e
      // taxa de aprovação de zero sobre zero não é "curadoria rígida",
      // é ausência de dado. Confundir os dois leva a afrouxar limiar
      // por causa de um número que não existe.
      motorRodou: contagem.length > 0 || (ofertas.count ?? 0) > 0,
      dias: DIAS_DE_OBSERVACAO,
    };
  } catch {
    return null;
  }
}

/** Formata o valor de um limiar do jeito que ele é lido. */
export function formataLimiar(valor: number, formato: Limiar["formato"]): string {
  switch (formato) {
    case "pct":
      return `${valor}%`;
    case "dias":
      return `${valor} ${valor === 1 ? "dia" : "dias"}`;
    case "centavos":
      return `R$ ${(valor / 100).toFixed(2).replace(".", ",")}`;
    case "fracao":
      return valor.toFixed(2).replace(".", ",");
    default:
      return `${valor}`;
  }
}
