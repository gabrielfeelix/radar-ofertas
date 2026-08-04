/**
 * O preço de agora contra o preço da fila, na hora de publicar.
 *
 * POR QUE ISTO EXISTE. O catálogo da Shopee vem do feed de produto
 * (D-058), que a loja publica uma vez por dia. A publicação entra na
 * fila quando a oferta é detectada e sai quando o ritmo do canal
 * permite. Medido em 04/08 na fila de produção: a mediana esperava
 * **19,9 horas**. Nesse intervalo o preço muda embaixo, e o post sai
 * falando de um preço que não existe mais.
 *
 * O QUE A MEDIÇÃO DISSE, e ela é o motivo de este módulo ser pequeno.
 * Amostra aleatória de 120 pendentes da Shopee, preço do banco contra
 * `productOfferV2` de agora:
 *
 *   igual 113 (94%) · subiu 0 · caiu 7
 *   caiu mais de 5%: 4   ·  mais de 20%: 2   (maior: R$ 236,90 → R$ 119,90)
 *
 * Numa primeira amostra de 40, não aleatória, apareceram duas subidas:
 * 1,7% e 2,9%. Ou seja: **o preço que sobe é raro e pequeno; o que cai
 * é raro e grande.** O ganho principal não é evitar mentira, é publicar
 * o preço bom quando ele já melhorou.
 *
 * A REGRA DE VIDA E MORTE NÃO É NOVA, e de propósito. `expira_ofertas`
 * (migration `oferta_e_motor`) já mata a oferta cujo preço subiu mais
 * que `tolerancia_alta_pct` acima do preço dela. Aqui é a mesma regra,
 * com o mesmo parâmetro, aplicada um passo depois: onde o banco olha a
 * nossa série, isto olha a loja agora.
 *
 * Inventar um segundo limiar aqui seria ter duas respostas para "quando
 * a oferta morreu", e a documentação deste projeto está cheia de
 * defeitos que nasceram assim.
 *
 * MORA EM `lib/` E NÃO NO SCRIPT porque `pnpm verifica` não olha
 * `scripts/` — nem tipo, nem lint. É a mesma razão de
 * `lib/falha-de-link.ts` existir.
 */

export type GatilhoDaOferta = "serie" | "queda" | "declarado";

export type EntradaDaRevalidacao = {
  /** O preço que a mensagem levaria se ninguém revalidasse nada. */
  precoPublicadoCentavos: number;
  /** O "de" da mensagem. Desde a D-062 ele é sempre do vendedor. */
  referenciaCentavos: number | null;
  gatilho: GatilhoDaOferta;
  /** Regra 3.4: a série tem idade para afirmar mínimo? */
  podeAfirmarMinimo: boolean;
  /** O preço de agora, lido na loja. */
  precoVivoCentavos: number;
  /** `tolerancia_alta_pct`. Quanto o preço pode subir antes de a oferta morrer. */
  toleranciaAltaPct: number;
  /** `desconto_declarado_teto_pct`. Acima disso a alegação da loja não é crível. */
  descontoTetoPct: number;
};

export type Veredito =
  /** O preço é o mesmo. Segue como estava, sem tocar em nada. */
  | { acao: "segue" }
  /** Mudou e ainda é oferta: publica com estes números. */
  | {
      acao: "publica";
      precoCentavos: number;
      descontoPct: number;
      podeAfirmarMinimo: boolean;
    }
  /** Não é mais oferta. O motivo vai para `oferta.motivo_rejeicao`. */
  | { acao: "descarta"; motivo: string };

/** Centavos, sempre (regra 3.5). */
function reais(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function revalidaPreco(e: EntradaDaRevalidacao): Veredito {
  const vivo = e.precoVivoCentavos;

  if (!Number.isFinite(vivo) || vivo <= 0) {
    // Preço que a loja não sabe informar não é motivo para matar oferta:
    // é dado faltando. Quem chama publica com o que tinha.
    return { acao: "segue" };
  }

  if (vivo === e.precoPublicadoCentavos) return { acao: "segue" };

  /*
    SUBIU DEMAIS: a mesma conta de `expira_ofertas`, com o mesmo
    parâmetro. A oferta morreu entre a detecção e a vez dela na fila.
  */
  const teto = e.precoPublicadoCentavos * (1 + e.toleranciaAltaPct / 100);
  if (vivo > teto) {
    return {
      acao: "descarta",
      motivo: `preco_subiu_antes_de_publicar(de_${reais(e.precoPublicadoCentavos)}_para_${reais(vivo)})`,
    };
  }

  /*
    O DESCONTO É RECALCULADO CONTRA A MESMA REFERÊNCIA.

    Trocar o preço e manter o desconto antigo publicaria dois números
    que não fecham um com o outro, e o leitor faz essa conta de cabeça.
  */
  const ref = e.referenciaCentavos;
  if (ref == null || ref <= vivo) {
    return {
      acao: "descarta",
      motivo: `sem_desconto_apos_revalidacao(preco_${reais(vivo)}_de_${ref == null ? "nulo" : reais(ref)})`,
    };
  }

  const desconto = Math.round((1 - vivo / ref) * 100);

  /*
    O TETO DO DESCONTO DECLARADO, e só onde ele significa alguma coisa.

    Em oferta `declarado` a referência é a alegação da LOJA, e o
    `original_price` inflado é problema conhecido (regra 3.4). Se o
    preço caiu a ponto de a alegação virar "-78%", o provável não é a
    promoção do século: é o "de" ser mentira. Em `serie` e `queda` a
    referência é medição nossa, e desconto grande ali é notícia
    verdadeira.
  */
  if (e.gatilho === "declarado" && desconto > e.descontoTetoPct) {
    return {
      acao: "descarta",
      motivo: `desconto_incrivel_apos_revalidacao(${desconto}pct)`,
    };
  }

  /*
    SUBIU POUCO E CONTINUA OFERTA: publica o preço de verdade, mas
    não pode mais dizer que é o menor que observamos. A nossa série
    nunca viu este preço, e afirmar mínimo sobre ele seria a regra 3.4
    quebrada por um detalhe de sincronismo.
  */
  const subiu = vivo > e.precoPublicadoCentavos;

  return {
    acao: "publica",
    precoCentavos: vivo,
    descontoPct: desconto,
    podeAfirmarMinimo: subiu ? false : e.podeAfirmarMinimo,
  };
}
