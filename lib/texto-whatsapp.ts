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
