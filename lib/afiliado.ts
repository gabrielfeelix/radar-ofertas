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
};

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
          : `${marketplaceSlug} ainda não tem link de afiliado configurado`,
    };
  }

  let url: URL;
  try {
    url = new URL(urlDoAnuncio);
  } catch {
    return { url: urlDoAnuncio, rastreado: false, motivo: "a URL do anúncio é inválida" };
  }

  // O subid vai como está: o `gera_subid()` do banco já produz
  // alfanumérico minúsculo de 8 caracteres, dentro dos 30 que o
  // Mercado Livre aceita na etiqueta.
  url.searchParams.set("matt_word", subid);
  url.searchParams.set("matt_tool", ferramenta);

  return { url: url.toString(), rastreado: true };
}
