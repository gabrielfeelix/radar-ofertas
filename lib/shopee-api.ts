/**
 * A Open API de afiliado da Shopee.
 *
 * Aprovada em 03/08 e com a credencial em mãos em 04/08. Ela resolve
 * três coisas que até aqui eram contorno:
 *
 * **1. O link curto.** Até agora o link da Shopee era montado por nós
 * (`an_redir`, D-057) e carregava a URL do produto codificada dentro de
 * si — três linhas de texto no post. Tão feio que a migration 49 o
 * escondeu atrás de uma âncora "Compre aqui". Com a API ele vira
 * `s.shopee.com.br/AAG6Zk4mf0`, e a âncora deixa de ser necessária.
 *
 * **2. Preço ao vivo.** `productOfferV2(itemId:)` devolve preço,
 * desconto, vendas, nota e comissão do item agora — não o do feed de
 * ontem à noite.
 *
 * **3. A comissão por item.** `commissionRate` vem na resposta, e até
 * aqui era estimativa nossa por categoria.
 *
 * O QUE ELA **NÃO** TEM: cupom. O schema foi lido por introspecção em
 * 04/08 e não existe consulta de cupom — `shopeeOfferV2` são campanhas
 * de comissão por categoria ("New BAU Comm - Health", 3%), que é outra
 * coisa. Cupom continua vindo da colheita dos canais (D-039).
 *
 * O QUE ELA TEM E AINDA NÃO USAMOS: `conversionReport` e
 * `validatedReport`, que são o relatório de comissão com `orderId` e
 * `checkoutId`. É por ali que a prova da Fase 0 fecha do lado da
 * Shopee, e é trabalho separado.
 *
 * ASSINATURA, e ela é o único lugar onde dá para errar em silêncio:
 *
 *   Authorization: SHA256 Credential={appId}, Timestamp={ts}, Signature={sig}
 *   sig = sha256(appId + timestamp + payloadExato + appSecret)
 *
 * O `payloadExato` é o corpo JSON **como ele é enviado**, byte a byte.
 * Serializar duas vezes, ou reordenar chave, quebra a assinatura e a
 * resposta é `Invalid Signature` — que não distingue credencial errada
 * de payload remontado. Por isso o corpo é serializado uma vez e a
 * mesma string vai para o hash e para o `fetch`.
 */

const ENDERECO = "https://open-api.affiliate.shopee.com.br/graphql";

/** A janela que a Shopee aceita para o timestamp é de poucos minutos. */
const TEMPO_LIMITE_MS = 20_000;

export type CredencialShopee = {
  appId?: string;
  appSecret?: string;
};

async function assina(payload: string, cred: Required<CredencialShopee>): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const cru = `${cred.appId}${ts}${payload}${cred.appSecret}`;
  const bytes = new TextEncoder().encode(cru);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `SHA256 Credential=${cred.appId}, Timestamp=${ts}, Signature=${hex}`;
}

export type RespostaDaShopee<T> =
  | { ok: true; dados: T }
  | { ok: false; motivo: string };

/**
 * Uma chamada ao GraphQL, com a assinatura certa.
 *
 * Nunca lança: quem chama está publicando, e exceção no meio da fila
 * derruba a rodada inteira. Erro vira motivo escrito, que é o que
 * aparece no log e manda alguém olhar.
 */
export async function consultaShopee<T = unknown>(
  query: string,
  cred: CredencialShopee,
): Promise<RespostaDaShopee<T>> {
  if (!cred.appId || !cred.appSecret) {
    return { ok: false, motivo: "faltam SHOPEE_APP_ID e SHOPEE_APP_SECRET" };
  }

  // Serializado UMA vez: a mesma string assina e viaja.
  const payload = JSON.stringify({ query });

  let resposta: Response;
  try {
    resposta = await fetch(ENDERECO, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await assina(payload, { appId: cred.appId, appSecret: cred.appSecret }),
      },
      body: payload,
      // `fetch` do Node não tem timeout, e a lição já custou 40 minutos
      // de rotina pendurada uma vez (01/08).
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (erro) {
    return { ok: false, motivo: `não alcancei a Shopee: ${(erro as Error).message}` };
  }

  const bruto = await resposta.text();
  let corpo: { data?: T; errors?: { message?: string }[] } | null = null;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return { ok: false, motivo: `resposta não é JSON (HTTP ${resposta.status})` };
  }

  // O GraphQL responde 200 com `errors` dentro, então status não basta.
  if (corpo?.errors?.length) {
    return { ok: false, motivo: corpo.errors.map((e) => e.message ?? "erro").join("; ") };
  }
  if (!corpo?.data) {
    return { ok: false, motivo: `sem dados (HTTP ${resposta.status})` };
  }

  return { ok: true, dados: corpo.data };
}

/**
 * O `sub_id` da Shopee tem CINCO campos, e usamos o primeiro.
 *
 * A pista veio de um link de canal concorrente, que chegava com
 * `utm_content=gurubot----`: quatro campos vazios e o primeiro
 * preenchido. Conferido com a nossa conta em 04/08 — o link curto
 * resolve para `utm_content=radarteste----`.
 *
 * O hífen é o separador, então ele não pode entrar no subid. O
 * `gera_subid()` do banco já produz alfanumérico minúsculo, mas a
 * limpeza fica aqui de qualquer forma: subid com hífen não daria erro
 * nenhum, só espalharia a publicação por campos que ninguém lê.
 */
function camposDeSubid(subid: string): string[] {
  return [subid.replace(/-/g, ""), "", "", "", ""];
}

/**
 * O link curto de um produto, com o subid dentro.
 *
 * Devolve `null` quando a API não responde, e **isso é de propósito**:
 * quem chama cai para o `an_redir` montado à mão, que é feio mas paga
 * comissão igual. Canal mudo por causa de API de terceiro fora do ar
 * seria trocar um problema de estética por um de receita.
 */
export async function geraLinkCurtoDaShopee(
  urlDoProduto: string,
  subid: string,
  cred: CredencialShopee,
): Promise<{ curto: string } | { curto: null; motivo: string }> {
  const subs = camposDeSubid(subid).map((s) => JSON.stringify(s)).join(",");
  const query =
    `mutation{generateShortLink(input:{originUrl:${JSON.stringify(urlDoProduto)},` +
    `subIds:[${subs}]}){shortLink}}`;

  const r = await consultaShopee<{ generateShortLink?: { shortLink?: string } }>(query, cred);
  if (!r.ok) return { curto: null, motivo: r.motivo };

  const curto = r.dados.generateShortLink?.shortLink;
  if (!curto) return { curto: null, motivo: "a Shopee não devolveu link" };

  return { curto };
}

export type ItemDaShopee = {
  itemId: number;
  productName: string;
  /** Em reais, como string. A conversão para centavos é de quem usa. */
  price: string;
  priceDiscountRate: number;
  sales: number;
  ratingStar: string;
  /** Fração, não porcento: `0.21` são 21%. */
  commissionRate: string;
  offerLink: string;
  imageUrl?: string;
  shopName?: string;
};

/**
 * O estado de AGORA de um item.
 *
 * É o que faltava para a Shopee: até aqui o preço vinha do feed de
 * produto, que a loja atualiza uma vez por dia no fim da tarde. Entre
 * uma atualização e outra o sistema publicava sobre dado de até doze
 * horas — e desconto some sem avisar.
 *
 * Passa só `itemId`. Mandar `shopId` junto devolve lista vazia, testado
 * em 04/08; o `shopId` serve para listar a loja inteira, não para
 * filtrar um item.
 */
export async function itemDaShopee(
  itemId: number | string,
  cred: CredencialShopee,
): Promise<ItemDaShopee | null> {
  const query =
    `{productOfferV2(itemId:${Number(itemId)}){nodes{itemId productName price ` +
    `priceDiscountRate sales ratingStar commissionRate offerLink imageUrl shopName}}}`;

  const r = await consultaShopee<{ productOfferV2?: { nodes?: ItemDaShopee[] } }>(query, cred);
  if (!r.ok) return null;

  return r.dados.productOfferV2?.nodes?.[0] ?? null;
}
