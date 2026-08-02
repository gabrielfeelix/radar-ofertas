/**
 * Monta o link de afiliado — o que carrega a comissão e o rastreio.
 *
 * COMO ESTE FORMATO FOI DESCOBERTO, porque não está documentado em
 * lugar nenhum: o dono trouxe links de afiliado que circulam em canais
 * de oferta do Telegram, e o padrão apareceu na comparação.
 *
 *   .../social/esser?matt_word=km20241129214032&matt_tool=20204402&ref=...
 *
 * Três coisas saíram daí:
 *
 * **`matt_word` é gerado por máquina.** `km` + `20241129214032` é um
 * timestamp — 29/11/2024 21:40:32. Ninguém cadastra isso à mão no
 * painel, um por link. É a evidência de que o campo **não exige
 * etiqueta pré-cadastrada**, e é o que permite pôr o subid da
 * publicação ali, em vez de uma etiqueta por canal.
 *
 * **`matt_tool` é por conta**, não global: o dele é 20204402, o nosso
 * é outro. Por isso vem de configuração.
 *
 * **O `ref` só existe no formato `/social/`**, e é um blob cifrado que
 * codifica o produto — não é gerável do nosso lado. Mas ele não é
 * necessário: a URL normal do produto aceita os mesmos parâmetros, e
 * foi o que o link final do exemplo mostrou (`matt_tool_id` colado
 * numa URL comum de produto).
 *
 * ⚠️ **ISTO AINDA NÃO FOI PROVADO POR UMA VENDA.** A URL é válida — o
 * ML a aceita e preserva os parâmetros —, mas se a comissão e o subid
 * voltam no relatório só se descobre com uma compra real. É
 * exatamente a prova da Fase 0, e ela precisa ser feita por outra
 * pessoa: autocompra é violação de termo nos três programas.
 *
 * Até essa prova existir, trate o retorno daqui como hipótese testável,
 * não como fato.
 */

/** Identificador da ferramenta de afiliado, por loja. Vem do painel. */
const FERRAMENTA: Record<string, string | undefined> = {
  mercado_livre: process.env.ML_MATT_TOOL,
  amazon: process.env.AFILIADO_AMAZON,
};

/**
 * A AMAZON É O CASO FÁCIL, e isso é contraintuitivo depois do trabalho
 * que o Mercado Livre deu.
 *
 * O formato saiu de links reais que circulam em canais de oferta, que o
 * dono trouxe em 02/08:
 *
 *   .../dp/B01I54ITP0?linkCode=sl2&tag=milena0fd-20
 *       &linkId=7e640a...&ref_=as_li_ss_tl
 *       &ascsubtag=srctok-116b638fd68bb173
 *       &btn_type=ss&btn_ref=srctok-116b638fd68bb173
 *
 * O que cada pedaço é, e o que a gente precisa:
 *
 * **`tag` é a comissão.** É o ID de Associado, e sozinho ele já paga.
 * Diferente do ML, que descarta o `matt_word` que a gente manda e exige
 * passar pelo gerador com sessão logada, aqui **a URL montada à mão
 * vale**: é o formato que o próprio SiteStripe produz.
 *
 * **`ascsubtag` é o subid** (regra 3.6), e era a pergunta em aberto
 * desde a D-035. Ele é o campo de rastreio granular do Associates e
 * aparece no relatório de comissão. Não precisa de cadastro prévio, ao
 * contrário da etiqueta do ML.
 *
 * **`linkCode` e `ref_`** identificam a origem como SiteStripe. Não são
 * necessários para a comissão, mas custam nada e deixam o link igual ao
 * que a Amazon gera.
 *
 * **`linkId`, `btn_type` e `btn_ref` ficam de fora.** O `linkId` é um
 * id que o SiteStripe cria por link e nós não temos como gerar. Os dois
 * `btn_*` e o prefixo `srctok-` do exemplo não são da Amazon: são da
 * plataforma Button, que o autor daquele link usa como intermediária.
 * Copiá-los seria atribuir a venda a um terceiro.
 *
 * **O encurtador `link.amazon` também fica de fora**, e o dono viu por
 * quê sem querer: um dos links curtos que ele mandou levou a um headset
 * em vez do perfume. O encurtador aponta para o que estava na tela na
 * hora de gerar, e quem controla o destino é a Amazon, não nós. Link
 * longo é feio e é auditável.
 */
function linkDaAmazon(url: URL, subid: string, tag: string): string {
  url.searchParams.set("tag", tag);
  url.searchParams.set("linkCode", "ll1");
  url.searchParams.set("ref_", "as_li_ss_tl");
  // O subid da publicação, que é o que liga a venda ao canal.
  url.searchParams.set("ascsubtag", subid);
  return url.toString();
}

export type LinkDeAfiliado = {
  url: string;
  /** Falso quando falta configuração — a tela precisa avisar, não publicar mudo. */
  rastreado: boolean;
  motivo?: string;
};

/**
 * Devolve a URL a publicar.
 *
 * Nunca lança e nunca devolve vazio: publicação sem link é pior que
 * publicação sem rastreio, porque a primeira não vende nada. Quando
 * falta configuração, devolve a URL crua e diz por quê — aí a tela
 * mostra o aviso e quem decide, decide.
 */
export function montaLinkDeAfiliado(
  urlDoAnuncio: string,
  subid: string,
  marketplaceSlug: string,
): LinkDeAfiliado {
  if (!urlDoAnuncio) {
    return { url: "", rastreado: false, motivo: "o anúncio não tem URL" };
  }

  const ferramenta = FERRAMENTA[marketplaceSlug];
  if (!ferramenta) {
    return {
      url: urlDoAnuncio,
      rastreado: false,
      motivo:
        marketplaceSlug === "mercado_livre"
          ? "falta ML_MATT_TOOL — sai sem comissão"
          : marketplaceSlug === "amazon"
            ? "falta AFILIADO_AMAZON — sai sem comissão"
            : `${marketplaceSlug} ainda não tem link de afiliado configurado`,
    };
  }

  let url: URL;
  try {
    url = new URL(urlDoAnuncio);
  } catch {
    return { url: urlDoAnuncio, rastreado: false, motivo: "a URL do anúncio é inválida" };
  }

  if (marketplaceSlug === "amazon") {
    return { url: linkDaAmazon(url, subid, ferramenta), rastreado: true };
  }

  // O subid vai como está: o `gera_subid()` do banco já produz
  // alfanumérico minúsculo de 8 caracteres, dentro dos 30 que o
  // Mercado Livre aceita na etiqueta.
  url.searchParams.set("matt_word", subid);
  url.searchParams.set("matt_tool", ferramenta);

  return { url: url.toString(), rastreado: true };
}
