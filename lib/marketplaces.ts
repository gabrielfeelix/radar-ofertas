/**
 * Leitura de link de produto: descobre de qual loja o link é e
 * qual o identificador do anúncio dentro dela.
 *
 * Isto é só análise de texto da URL — nenhuma requisição sai
 * daqui. Buscar título e preço na página é outra coisa, depende
 * dos termos de cada site, e por isso não mora neste arquivo.
 *
 * O `sku` devolvido aqui é o que vai para `anuncio.sku_externo`
 * e forma, junto com o marketplace, a chave que impede o mesmo
 * anúncio de ser cadastrado duas vezes e partir a série de
 * preço em duas.
 */

export type MarketplaceSlug = "mercado_livre" | "shopee" | "amazon";

export type LinkLido = {
  marketplaceSlug: MarketplaceSlug;
  /** Identificador do anúncio na loja. Vai para anuncio.sku_externo. */
  sku: string;
  /** URL limpa, sem rastreadores de campanha. É o que fica salvo. */
  urlLimpa: string;
};

/** Motivo pelo qual um link não pôde ser lido. Serve de mensagem ao operador. */
export type LinkRecusado = {
  motivo: "url_invalida" | "loja_desconhecida" | "link_curto" | "sku_nao_encontrado";
  mensagem: string;
};

export type ResultadoLeitura =
  | { ok: true; link: LinkLido }
  | { ok: false; erro: LinkRecusado };

/**
 * Parâmetros de campanha e rastreio que os apps grudam no link.
 * Removidos antes de salvar: eles mudam a cada compartilhamento
 * e fariam o mesmo anúncio parecer diferente.
 */
const PARAMETROS_DESCARTAVEIS = [
  /^utm_/i,
  /^pd_rd_/i,
  /^pf_rd_/i,
  /^psc$/i,
  /^ref_?$/i,
  /^tag$/i,
  /^linkCode$/i,
  /^matt_/i,
  /^tracking_id$/i,
  /^quantity$/i,
  /^sp_atk$/i,
  /^xptdk$/i,
  /^is_from_login$/i,
  /^searchQuery$/i,
  /^position$/i,
  /^deal_id$/i,
];

/** Encurtadores dos apps. Precisam ser abertos no navegador antes. */
const ENCURTADORES: Record<string, string> = {
  "amzn.to": "Amazon",
  "a.co": "Amazon",
  "mercadolivre.com": "Mercado Livre",
  "mercadolibre.com": "Mercado Livre",
  "s.shopee.com.br": "Shopee",
  "shp.ee": "Shopee",
};

export function leLinkDeProduto(entrada: string): ResultadoLeitura {
  let url: URL;
  try {
    url = new URL(entrada.trim());
  } catch {
    return {
      ok: false,
      erro: {
        motivo: "url_invalida",
        mensagem: "Isso não parece um endereço. Cole o link inteiro, começando com https://",
      },
    };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  // Encurtador: o identificador do anúncio não está na URL, está
  // do outro lado do redirecionamento. Peça o link cheio em vez
  // de adivinhar.
  const lojaCurta =
    ENCURTADORES[host] ??
    (host.startsWith("mercadolivre.com") && url.pathname.startsWith("/sec/")
      ? "Mercado Livre"
      : undefined);
  if (lojaCurta) {
    return {
      ok: false,
      erro: {
        motivo: "link_curto",
        mensagem: `Esse é um link curto da ${lojaCurta}. Abra ele no navegador e copie o endereço que aparecer na barra.`,
      },
    };
  }

  if (host.endsWith("mercadolivre.com.br")) return leMercadoLivre(url);
  if (host.endsWith("shopee.com.br")) return leShopee(url);
  if (host.endsWith("amazon.com.br")) return leAmazon(url);

  return {
    ok: false,
    erro: {
      motivo: "loja_desconhecida",
      mensagem: `Ainda não sei ler links de ${host}. Por enquanto: Mercado Livre, Shopee e Amazon.`,
    },
  };
}

/** Remove parâmetros de campanha, mantendo os que identificam o item. */
function limpaUrl(url: URL, manter: string[] = []): string {
  const limpa = new URL(url.toString());
  limpa.hash = "";
  for (const chave of [...limpa.searchParams.keys()]) {
    if (manter.includes(chave)) continue;
    if (PARAMETROS_DESCARTAVEIS.some((p) => p.test(chave))) limpa.searchParams.delete(chave);
  }
  return limpa.toString();
}

/**
 * Mercado Livre. Formatos que aparecem na prática:
 *   produto.mercadolivre.com.br/MLB-1234567890-nome-do-item-_JM
 *   www.mercadolivre.com.br/nome-do-item/p/MLB12345678
 *   www.mercadolivre.com.br/item/MLB1234567890
 *
 * O identificador é sempre MLB + dígitos. Salvo sem o hífen, que
 * aparece em um formato e não no outro — é o mesmo anúncio.
 */
function leMercadoLivre(url: URL): ResultadoLeitura {
  const alvo = decodeURIComponent(url.pathname);
  const achado = alvo.match(/\bMLB-?(\d{6,})\b/i);

  if (!achado) {
    return {
      ok: false,
      erro: {
        motivo: "sku_nao_encontrado",
        mensagem:
          "Não achei o código MLB nesse link. Confira se é a página do produto, e não uma busca ou uma listagem.",
      },
    };
  }

  return {
    ok: true,
    link: {
      marketplaceSlug: "mercado_livre",
      sku: `MLB${achado[1]}`,
      urlLimpa: limpaUrl(url),
    },
  };
}

/**
 * Shopee. Formatos:
 *   shopee.com.br/Nome-do-item-i.123456789.987654321
 *   shopee.com.br/product/123456789/987654321
 *
 * Aqui o anúncio é identificado por DOIS números: a loja e o
 * item. Guardamos os dois juntos, porque o id do item sozinho
 * não é único entre lojas.
 */
function leShopee(url: URL): ResultadoLeitura {
  const alvo = decodeURIComponent(url.pathname);

  const formatoI = alvo.match(/-i\.(\d+)\.(\d+)/);
  if (formatoI) {
    return {
      ok: true,
      link: {
        marketplaceSlug: "shopee",
        sku: `${formatoI[1]}.${formatoI[2]}`,
        urlLimpa: limpaUrl(url),
      },
    };
  }

  const formatoProduct = alvo.match(/\/product\/(\d+)\/(\d+)/);
  if (formatoProduct) {
    return {
      ok: true,
      link: {
        marketplaceSlug: "shopee",
        sku: `${formatoProduct[1]}.${formatoProduct[2]}`,
        urlLimpa: limpaUrl(url),
      },
    };
  }

  // Vitrine do vendedor: /nome-do-vendedor/123456/789012
  //
  // Este formato apareceu na colheita real de canais — é o que os
  // encurtadores da Shopee entregam com mais frequência. Sem ele, a
  // maior parte dos links de Shopee era descartada.
  //
  // A ordem (loja, item) segue o formato documentado /product/, que
  // usa a mesma sequência. NÃO foi possível confirmar contra uma
  // página real: a Shopee recusa requisição sem navegador. Confirmar
  // quando a credencial da API de afiliado chegar — ela devolve
  // shopid e itemid separados. Se estiver invertido, o mesmo produto
  // vira dois anúncios e parte a série de preço em duas.
  const formatoVitrine = alvo.match(/^\/[^/]+\/(\d{4,})\/(\d{4,})\/?$/);
  if (formatoVitrine) {
    return {
      ok: true,
      link: {
        marketplaceSlug: "shopee",
        sku: `${formatoVitrine[1]}.${formatoVitrine[2]}`,
        urlLimpa: limpaUrl(url),
      },
    };
  }

  return {
    ok: false,
    erro: {
      motivo: "sku_nao_encontrado",
      mensagem:
        "Não achei o código do item nesse link da Shopee. A página do produto termina com algo como -i.123456.789012",
    },
  };
}

/**
 * Amazon. O identificador é o ASIN: 10 caracteres, letras
 * maiúsculas e dígitos, quase sempre começando com B.
 *
 *   amazon.com.br/dp/B0ABCDEFGH
 *   amazon.com.br/Nome-Do-Item/dp/B0ABCDEFGH/ref=...
 *   amazon.com.br/gp/product/B0ABCDEFGH
 */
function leAmazon(url: URL): ResultadoLeitura {
  const alvo = decodeURIComponent(url.pathname);
  const achado =
    alvo.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
    alvo.match(/\/([A-Z0-9]{10})(?:\/ref=|$)/);

  if (!achado) {
    return {
      ok: false,
      erro: {
        motivo: "sku_nao_encontrado",
        mensagem:
          "Não achei o ASIN nesse link da Amazon. A página do produto tem /dp/ seguido de 10 caracteres.",
      },
    };
  }

  return {
    ok: true,
    link: {
      marketplaceSlug: "amazon",
      sku: achado[1].toUpperCase(),
      // A Amazon não precisa de nenhum parâmetro para abrir o item.
      urlLimpa: `https://www.amazon.com.br/dp/${achado[1].toUpperCase()}`,
    },
  };
}
