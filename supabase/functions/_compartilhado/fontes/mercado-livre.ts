import type {
  AnuncioParaColeta,
  FonteDePreco,
  ResultadoLeitura,
} from "../tipos.ts";

/**
 * Mercado Livre — via API oficial de itens.
 *
 * Esta é a via documentada e permitida: a mesma API que o
 * programa de afiliados e os integradores usam. Não é leitura de
 * página.
 *
 * O que falta para funcionar: um token de acesso. O Mercado Livre
 * exige OAuth mesmo para consultar item público, e o token dura
 * poucas horas — por isso existe o refresh aqui embaixo.
 *
 * Como obter (uma vez só):
 *   1. Criar aplicação em developers.mercadolivre.com.br
 *   2. Guardar Client ID e Client Secret
 *   3. Autorizar uma vez pelo navegador e trocar o code por um
 *      refresh token
 *   4. Colocar os três no .env e nos secrets da Edge Function
 *
 * ATENÇÃO: o formato exato da resposta ainda não foi conferido
 * contra a API de verdade, porque não há credencial. Os campos
 * abaixo seguem a documentação. Na primeira coleta real, confira
 * o retorno antes de confiar nele.
 */

const BASE = "https://api.mercadolibre.com";

type Ambiente = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

/** Token em memória. A Edge Function vive pouco, mas evita pedir a cada anúncio. */
let tokenEmCache: { valor: string; expiraEm: number } | null = null;

export function criaFonteMercadoLivre(env: Ambiente): FonteDePreco {
  return {
    slug: "mercado_livre",

    configurada() {
      return Boolean(env.clientId && env.clientSecret && env.refreshToken);
    },

    oQueFalta() {
      const faltando = [
        !env.clientId && "ML_CLIENT_ID",
        !env.clientSecret && "ML_CLIENT_SECRET",
        !env.refreshToken && "ML_REFRESH_TOKEN",
      ].filter(Boolean);
      return faltando.length === 0
        ? ""
        : `Faltam as credenciais ${faltando.join(", ")}. Crie a aplicação em developers.mercadolivre.com.br.`;
    },

    async lePreco(anuncio: AnuncioParaColeta): Promise<ResultadoLeitura> {
      if (!this.configurada()) {
        return { ok: false, motivo: "nao_configurada", detalhe: this.oQueFalta() };
      }

      let token: string;
      try {
        token = await pegaToken(env);
      } catch (erro) {
        return {
          ok: false,
          motivo: "temporario",
          detalhe: `Não consegui renovar o token: ${(erro as Error).message}`,
        };
      }

      let resposta: Response;
      try {
        resposta = await fetch(`${BASE}/items/${anuncio.skuExterno}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (erro) {
        return { ok: false, motivo: "temporario", detalhe: (erro as Error).message };
      }

      if (resposta.status === 404) {
        return { ok: false, motivo: "nao_encontrado", detalhe: "O anúncio não existe mais." };
      }
      if (resposta.status === 401 || resposta.status === 403) {
        return {
          ok: false,
          motivo: "bloqueado",
          detalhe: `A API recusou o acesso (${resposta.status}). O token pode ter perdido o escopo.`,
        };
      }
      if (resposta.status === 429) {
        return { ok: false, motivo: "temporario", detalhe: "Limite de requisições atingido." };
      }
      if (!resposta.ok) {
        return { ok: false, motivo: "temporario", detalhe: `HTTP ${resposta.status}` };
      }

      const item = (await resposta.json()) as {
        price?: number;
        status?: string;
        available_quantity?: number;
        title?: string;
        seller_id?: number;
      };

      if (typeof item.price !== "number" || !Number.isFinite(item.price)) {
        return {
          ok: false,
          motivo: "temporario",
          detalhe: "A resposta veio sem preço. Confira se o formato da API mudou.",
        };
      }

      const disponivel = item.status === "active" && (item.available_quantity ?? 0) > 0;

      return {
        ok: true,
        // A API devolve reais como número decimal. Aqui vira centavo
        // inteiro imediatamente, e nunca mais volta a ser float (D-005).
        precoCentavos: Math.round(item.price * 100),
        disponivel,
        titulo: item.title,
        vendedor: item.seller_id ? String(item.seller_id) : undefined,
      };
    },
  };
}

/** Troca o refresh token por um access token, reaproveitando enquanto vale. */
async function pegaToken(env: Ambiente): Promise<string> {
  const agora = Date.now();
  if (tokenEmCache && tokenEmCache.expiraEm > agora + 60_000) {
    return tokenEmCache.valor;
  }

  const corpo = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.clientId!,
    client_secret: env.clientSecret!,
    refresh_token: env.refreshToken!,
  });

  const resposta = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
  });

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status} ao renovar o token`);
  }

  const dados = (await resposta.json()) as { access_token?: string; expires_in?: number };
  if (!dados.access_token) throw new Error("A resposta veio sem access_token");

  tokenEmCache = {
    valor: dados.access_token,
    expiraEm: agora + (dados.expires_in ?? 3600) * 1000,
  };

  return tokenEmCache.valor;
}
