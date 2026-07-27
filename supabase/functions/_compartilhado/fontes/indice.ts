import type { FonteDePreco, MarketplaceSlug } from "../tipos.ts";
import { criaFonteMercadoLivre } from "./mercado-livre.ts";
import { criaFonteShopee } from "./shopee.ts";

/**
 * Reúne as fontes de preço disponíveis.
 *
 * A Amazon não está aqui, e é decisão, não esquecimento: a
 * política de associados limita a retenção de preço a 24 horas
 * (D-003), então ela nunca forma série histórica. Coletar a
 * Amazon diariamente gastaria requisição para produzir dado que
 * o expurgo apaga no dia seguinte.
 *
 * A Amazon volta a fazer sentido na Fase 2, como fonte de oferta
 * pontual — consultada na hora de publicar, não todo dia.
 */
export function montaFontes(env: Record<string, string | undefined>): Map<MarketplaceSlug, FonteDePreco> {
  const fontes: FonteDePreco[] = [
    criaFonteMercadoLivre({
      clientId: env.ML_CLIENT_ID,
      clientSecret: env.ML_CLIENT_SECRET,
      refreshToken: env.ML_REFRESH_TOKEN,
    }),
    criaFonteShopee({
      appId: env.SHOPEE_APP_ID,
      appSecret: env.SHOPEE_APP_SECRET,
    }),
  ];

  return new Map(fontes.map((f) => [f.slug, f]));
}
