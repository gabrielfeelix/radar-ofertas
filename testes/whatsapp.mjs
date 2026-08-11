/**
 * Teste da tradução da mensagem para o WhatsApp.
 *
 * Existe porque errar aqui NÃO dá erro: a mensagem sai, chega bonita no
 * grupo, e o link não paga. O caso que importa é o `&amp;` no meio do
 * link de afiliado — o `escapaHtml` põe, e se ninguém tirar, o clique
 * abre o produto sem o subid (D-034, regra 3.6).
 *
 * O segundo caso é grosseiro e barato de pegar: tag de HTML chegando
 * literal ao grupo. O WhatsApp não entende `parse_mode`, e post com
 * `<b>` à vista parece golpe.
 */
import { paraWhatsApp, saiComCardDeLink } from "../lib/texto-whatsapp.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\no link, que é o que paga\n");

const linkEscapado =
  "https://s.shopee.com.br/an_redir?origin_link=x&amp;affiliate_id=18378371108&amp;sub_id=radarpet01";

confere(
  "o &amp; volta a ser & — sem isso o clique não carrega o subid",
  paraWhatsApp(linkEscapado) ===
    "https://s.shopee.com.br/an_redir?origin_link=x&affiliate_id=18378371108&sub_id=radarpet01",
);

confere(
  "a âncora vira a URL nua, e não o texto do rótulo",
  paraWhatsApp('<a href="https://meli.la/1QPWrnS">Ver oferta</a>') === "https://meli.la/1QPWrnS",
);

confere(
  "âncora com quebra de linha dentro também é traduzida",
  paraWhatsApp('<a href="https://meli.la/x">ver\noferta</a>') === "https://meli.la/x",
);

console.log("\nas marcações\n");

confere("negrito vira asterisco", paraWhatsApp("<b>R$ 89,90</b>") === "*R$ 89,90*");
confere("riscado vira til", paraWhatsApp("<s>R$ 149,90</s>") === "~R$ 149,90~");
confere("itálico vira sublinhado", paraWhatsApp("<i>menor preço</i>") === "_menor preço_");
confere("<br> vira quebra de linha", paraWhatsApp("um<br>dois") === "um\ndois");

confere(
  "tag desconhecida não chega literal ao grupo",
  paraWhatsApp("<span class='x'>oi</span>") === "oi",
);

console.log("\nas entidades escapadas\n");

confere("&lt; e &gt; voltam", paraWhatsApp("&lt;oi&gt;") === "<oi>");
confere("&quot; volta", paraWhatsApp("&quot;top&quot;") === '"top"');
confere(
  "&amp;lt; desfaz na ordem certa e sobra &lt;, não <",
  paraWhatsApp("&amp;lt;") === "&lt;",
);

console.log("\na mensagem inteira\n");

const mensagem =
  "🔥 <b>Perfume Bleu de Chanel 100ml</b>\n" +
  "De <s>R$ 749,00</s> por <b>R$ 489,00</b> (35% OFF)\n" +
  "#publi\n" +
  '<a href="https://s.shopee.com.br/x?a=1&amp;sub_id=radarpet01">Pegar oferta</a>';

const saida = paraWhatsApp(mensagem);

confere("não sobra nenhuma tag", !/<[^>]+>/.test(saida));
confere("não sobra nenhuma entidade escapada", !/&(amp|lt|gt|quot|#39);/.test(saida));
confere("o subid continua no texto", saida.includes("sub_id=radarpet01"));
confere("a identificação de publicidade sobrevive (regra 3.10)", saida.includes("#publi"));

/* =============================================================
   CARD DE LINK OU FOTO ANEXADA (migration 63)

   Errar aqui também não dá erro: a mensagem sai nos dois casos. Errar
   para MAIS (card onde a loja não tem `og:`) publica post sem imagem
   nenhuma, e errar para MENOS enche a galeria de quem lê. Os dois só
   aparecem lendo o grupo, dias depois.
   ============================================================= */
console.log("\ncard de link ou foto anexada\n");

confere(
  "Mercado Livre sai com card: o meli.la traz og:image e og:title (medido em 10/08)",
  saiComCardDeLink("mercado_livre", true) === true,
);
confere(
  "Shopee continua com foto anexada: o s.shopee.com.br não traz og: nenhum",
  saiComCardDeLink("shopee", true) === false,
);
confere(
  "Amazon continua com foto anexada: a página não traz og:image",
  saiComCardDeLink("amazon", true) === false,
);
confere(
  "loja desconhecida não vira card, porque o card sem og: é post sem imagem",
  saiComCardDeLink("loja_que_nao_existe", true) === false,
);
confere(
  "slug nulo não quebra e não vira card",
  saiComCardDeLink(null, true) === false && saiComCardDeLink(undefined, true) === false,
);
confere(
  "o parâmetro em 0 devolve TODAS as lojas para a foto anexada",
  saiComCardDeLink("mercado_livre", false) === false,
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
