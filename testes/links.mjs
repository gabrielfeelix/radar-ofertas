/**
 * Teste do leitor de link de produto.
 *
 * Roda com `pnpm testa`. Não precisa de banco, de Docker nem de
 * rede — é função pura sobre texto de URL.
 *
 * Por que este arquivo existe: o leitor de link é o que decide se
 * dois links diferentes são o mesmo anúncio. Errar aqui não dá
 * erro em lugar nenhum — cria dois anúncios para o mesmo produto e
 * parte a série de preço em duas, silenciosamente, que é o pior
 * jeito de quebrar.
 *
 * Os casos vieram da colheita real de canal, não da imaginação.
 */

import { leLinkDeProduto } from "../lib/marketplaces.ts";

const casos = [
  // --- Shopee ---------------------------------------------------
  // Formato de vitrine do vendedor. É o que os encurtadores da
  // Shopee mais entregam; sem ele, quase todo link de Shopee da
  // colheita era descartado.
  {
    nome: "shopee: vitrine do vendedor",
    url: "https://shopee.com.br/opaanlp/1252008226/23893643533?__mobile=1",
    loja: "shopee",
    sku: "1252008226.23893643533",
  },
  {
    nome: "shopee: vitrine com barra final",
    url: "https://shopee.com.br/loja-x/412968566/58254964166/",
    loja: "shopee",
    sku: "412968566.58254964166",
  },
  {
    nome: "shopee: formato -i.",
    url: "https://shopee.com.br/Racao-Premium-i.123456.789012",
    loja: "shopee",
    sku: "123456.789012",
  },
  {
    nome: "shopee: formato /product/",
    url: "https://shopee.com.br/product/123456/789012",
    loja: "shopee",
    sku: "123456.789012",
  },
  {
    nome: "shopee: página de cupom não é produto",
    url: "https://shopee.com.br/m/cupom-de-desconto?mmp_pid=an_1",
    loja: null,
  },

  // --- Mercado Livre --------------------------------------------
  {
    nome: "ml: página de produto",
    url: "https://produto.mercadolivre.com.br/MLB-3456789012-tapete-higienico-_JM",
    loja: "mercado_livre",
    sku: "MLB3456789012",
  },
  {
    nome: "ml: página de catálogo",
    url: "https://www.mercadolivre.com.br/tapete/p/MLB12345678",
    loja: "mercado_livre",
    sku: "MLB12345678",
  },
  {
    nome: "ml: perfil social não é produto",
    url: "https://www.mercadolivre.com.br/social/nerdofertas?matt_word=x",
    loja: null,
  },
  {
    nome: "ml: mesmo item com e sem hífen é o mesmo sku",
    url: "https://www.mercadolivre.com.br/item/MLB3456789012",
    loja: "mercado_livre",
    sku: "MLB3456789012",
  },

  // --- Amazon ----------------------------------------------------
  {
    nome: "amazon: /dp/",
    url: "https://www.amazon.com.br/Racao-Premium/dp/B0ABCDEFGH/ref=sr_1_3",
    loja: "amazon",
    sku: "B0ABCDEFGH",
  },
  {
    nome: "amazon: /gp/product/",
    url: "https://www.amazon.com.br/gp/product/B0ABCDEFGH",
    loja: "amazon",
    sku: "B0ABCDEFGH",
  },

  // --- Recusas esperadas -----------------------------------------
  {
    nome: "encurtador precisa ser resolvido antes",
    url: "https://amzn.to/3xYzAbC",
    loja: null,
    motivo: "link_curto",
  },
  {
    nome: "loja que não trabalhamos",
    url: "https://www.magazineluiza.com.br/produto/p/123",
    loja: null,
    motivo: "loja_desconhecida",
  },
  {
    nome: "texto que não é endereço",
    url: "compre agora!",
    loja: null,
    motivo: "url_invalida",
  },
];

let falhas = 0;

for (const caso of casos) {
  const r = leLinkDeProduto(caso.url);
  const loja = r.ok ? r.link.marketplaceSlug : null;
  const sku = r.ok ? r.link.sku : null;
  const motivo = r.ok ? null : r.erro.motivo;

  const passou =
    loja === caso.loja &&
    (caso.sku === undefined || sku === caso.sku) &&
    (caso.motivo === undefined || motivo === caso.motivo);

  if (!passou) falhas++;

  const visto = r.ok ? `${loja} ${sku}` : `recusado (${motivo})`;
  console.log(`${passou ? "  ok  " : " FALHA"} ${caso.nome.padEnd(42)} ${visto}`);
}

console.log(
  falhas === 0
    ? `\n${casos.length} casos, todos passaram.`
    : `\n${falhas} de ${casos.length} falharam.`,
);

process.exit(falhas === 0 ? 0 : 1);
