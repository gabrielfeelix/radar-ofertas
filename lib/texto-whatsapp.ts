/**
 * A tradução da mensagem do Telegram para o WhatsApp.
 *
 * Mora sozinha, fora de `lib/whatsapp.ts`, por um motivo prático: aquele
 * arquivo é `server-only` e este precisa ser importável pelo teste e
 * pelo `scripts/publica-automatico.mjs`, que rodam em node puro. Era a
 * única parte com lógica de verdade lá dentro; o resto é chamada de
 * rede.
 *
 * **O QUE ESTÁ EM JOGO É A COMISSÃO**, e não a estética. A mensagem é
 * montada em HTML para o Telegram (`parse_mode: "HTML"`), e o
 * `escapaHtml` de `lib/mensagem.ts` troca `&` por `&amp;` no caminho.
 * O link de afiliado tem `&` no meio:
 *
 *     ...&affiliate_id=18378371108&sub_id=radarpet01
 *
 * Mandado ao WhatsApp com o `&amp;` de pé, ele abre o produto sem o
 * subid, e sem subid não há atribuição nem divisão de receita (D-034,
 * regra 3.6). Publica, parece que funcionou, e entrega a audiência de
 * graça — que é exatamente a falha que a D-034 já custou uma vez.
 *
 * O resto é o WhatsApp não entender HTML: sem a conversão, o grupo
 * recebe `<b>R$ 89,90</b>` com as tags à vista, e post com tag à vista
 * parece golpe.
 */
export function paraWhatsApp(html: string): string {
  return (
    html
      /*
        O link perde o texto âncora de propósito: o WhatsApp não tem
        link com rótulo. Descartar a URL e ficar com o texto deixaria a
        mensagem sem a única parte que paga. URL nua o WhatsApp
        transforma em link sozinho.
      */
      .replace(/<a\s+href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi, "$1")
      .replace(/<\/?(b|strong)>/gi, "*")
      .replace(/<\/?(i|em)>/gi, "_")
      .replace(/<\/?(s|del|strike)>/gi, "~")
      .replace(/<br\s*\/?>/gi, "\n")
      // Qualquer tag que o modelo ganhe amanhã sai daqui em vez de
      // chegar literal ao grupo.
      .replace(/<[^>]+>/g, "")
      // A volta do `escapaHtml`. O `&amp;` vem por último de propósito:
      // desfeito antes dos outros, um `&amp;lt;` viraria `<` em vez de
      // `&lt;`.
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
  );
}

/* =============================================================
   FOTO ANEXADA OU CARD DE PREVIEW: a decisão, num lugar só.
   ============================================================= */

/**
 * As lojas cujo link sozinho já produz um card com foto do produto.
 *
 * **Por que isto é uma lista e não um sim para todo mundo:** o card do
 * WhatsApp é montado a partir das meta tags `og:` do destino, e as três
 * lojas se comportam de formas diferentes. Medido em 10/08, seguindo os
 * nossos próprios links de afiliado até o fim:
 *
 *   Mercado Livre  `meli.la/...`           →  `og:image` com a foto do
 *                                             produto e `og:title` com o
 *                                             nome. Card completo, de graça.
 *   Shopee         `s.shopee.com.br/...`   →  redireciona para o item e a
 *                                             página **não traz `og:`**.
 *   Amazon         `amazon.com.br/dp/...`  →  responde 200 com 1 MB de
 *                                             HTML e **sem `og:image`**.
 *
 * Ligar o card para as três calaria a foto de duas, e a Shopee é a maior
 * parte da fila do Radar Delas hoje: seria trocar galeria cheia por post
 * sem imagem, que é pior para a conversão.
 *
 * **Isto tem prazo de validade, e o prazo é a Fase 2.** Com o
 * redirecionador próprio no ar, o `og:` passa a ser NOSSO em qualquer
 * loja, e o card vale para todas: é o que os concorrentes já fazem com
 * domínio de encurtador (`amzn.divulgador.link`, visto em 10/08). Quando
 * isso acontecer, esta lista some e o `sendMedia` sai de cena.
 */
const LOJAS_COM_CARD_PROPRIO = new Set(["mercado_livre"]);

/**
 * A mensagem sai como texto com card, ou como foto anexada?
 *
 * **O que está em jogo é a galeria de quem lê.** `sendMedia` é mensagem
 * de mídia de verdade: o WhatsApp baixa sozinho e, no Android, o arquivo
 * aparece na galeria junto das fotos de família. A trinta posts por dia
 * isso é da ordem de 90 MB por mês no celular dela, e é motivo de sair
 * do grupo tão real quanto volume de mensagem
 * (`docs/pesquisa/sintese.md` §5). O card de preview não é mídia: não
 * baixa, não ocupa, não polui.
 *
 * Devolve `false` quando não há certeza de que o card vem com foto,
 * porque post sem imagem nenhuma é o pior dos três desfechos.
 *
 * @param lojaSlug  `marketplace.slug` do anúncio que vai sair.
 * @param ligado    O parâmetro `whatsapp_link_preview`. Existe para
 *                  desligar isto em produção sem publicar versão, caso o
 *                  card não apareça como esperado no chip de verdade.
 */
export function saiComCardDeLink(lojaSlug: string | null | undefined, ligado: boolean): boolean {
  if (!ligado) return false;
  return LOJAS_COM_CARD_PROPRIO.has(String(lojaSlug ?? ""));
}
