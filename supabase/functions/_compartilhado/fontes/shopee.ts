import type {
  AnuncioParaColeta,
  FonteDePreco,
  ResultadoLeitura,
} from "../tipos.ts";

/**
 * Shopee — via API de afiliados.
 *
 * Aqui a implementação PARA de propósito. O motivo:
 *
 * A API de afiliados da Shopee é GraphQL e exige uma assinatura
 * calculada a cada requisição, combinando app id, timestamp,
 * corpo e segredo. Escrever isso sem uma credencial para testar
 * é escrever código que parece certo e falha na primeira chamada
 * real — e pior, falha de um jeito silencioso, porque assinatura
 * errada devolve o mesmo erro genérico que credencial errada.
 *
 * O que fazer quando a conta de afiliado sair:
 *   1. Pegar App ID e App Secret no painel de afiliado
 *   2. Conferir na documentação o formato exato da assinatura e a
 *      query que devolve preço por item
 *   3. Implementar `lePreco` aqui, e só aqui — nada mais no
 *      sistema precisa mudar
 *
 * Enquanto isso o coletor simplesmente pula a Shopee, sem erro e
 * sem log poluído. O resto do sistema roda normalmente com o
 * Mercado Livre.
 */

type Ambiente = {
  appId?: string;
  appSecret?: string;
};

export function criaFonteShopee(env: Ambiente): FonteDePreco {
  return {
    slug: "shopee",

    configurada() {
      // Continua falso mesmo com credencial: a leitura ainda não
      // foi escrita. Trocar para a checagem real junto com a
      // implementação de lePreco.
      return false;
    },

    oQueFalta() {
      if (!env.appId || !env.appSecret) {
        return "Faltam SHOPEE_APP_ID e SHOPEE_APP_SECRET, do painel de afiliado da Shopee.";
      }
      return "Credencial presente, mas a leitura da API da Shopee ainda não foi implementada.";
    },

    lePreco(_anuncio: AnuncioParaColeta): Promise<ResultadoLeitura> {
      return Promise.resolve({
        ok: false,
        motivo: "nao_configurada",
        detalhe: this.oQueFalta(),
      });
    },
  };
}
