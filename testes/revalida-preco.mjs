/**
 * Teste da revalidação de preço na hora de publicar.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede.
 *
 * POR QUE ELE EXISTE. Esta função decide, no último instante antes do
 * post sair, se a oferta ainda é oferta. Errar para um lado publica
 * preço que não existe (regra 3.4); errar para o outro mata oferta boa
 * em silêncio, que é o defeito que a F-01 acabou de consertar.
 *
 * Os números abaixo são de casos REAIS da fila de produção medidos em
 * 04/08, e não de exemplo inventado: R$ 236,90 → R$ 119,90 foi o maior
 * mergulho da amostra, e R$ 1135,26 → R$ 1154,99 foi a maior subida.
 */

import { revalidaPreco } from "../lib/revalida-preco.ts";

let passou = 0;
let falhou = 0;

function confere(nome, condicao) {
  if (condicao) {
    passou += 1;
    console.log(`✓ ${nome}`);
  } else {
    falhou += 1;
    console.error(`✗ ${nome}`);
  }
}

/** Os parâmetros de produção, lidos em 04/08. */
const BASE = {
  referenciaCentavos: 20000,
  gatilho: "declarado",
  podeAfirmarMinimo: false,
  toleranciaAltaPct: 3,
  descontoTetoPct: 70,
};

console.log("\nrevalidação de preço\n");

// -------------------------------------------------------------
// O caso comum: 94% da amostra. Nada muda, nada é tocado.
// -------------------------------------------------------------

confere(
  "preço igual segue como está",
  revalidaPreco({ ...BASE, precoPublicadoCentavos: 15000, precoVivoCentavos: 15000 }).acao ===
    "segue",
);

// -------------------------------------------------------------
// Caiu — o ganho principal, e é aqui que o item se paga
// -------------------------------------------------------------

{
  // O caso real: leitor de código de barras, R$ 236,90 no feed, R$ 119,90 agora.
  const v = revalidaPreco({
    ...BASE,
    referenciaCentavos: 33000,
    precoPublicadoCentavos: 23690,
    precoVivoCentavos: 11990,
  });
  confere("preço que caiu vira publicação com o preço novo", v.acao === "publica");
  confere("e o preço publicado é o de agora", v.acao === "publica" && v.precoCentavos === 11990);
  confere(
    "e o desconto é recalculado contra a mesma referência",
    // 1 - 119,90/330,00 = 63,7% → 64
    v.acao === "publica" && v.descontoPct === 64,
  );
}

confere(
  "queda não tira o direito de afirmar mínimo",
  revalidaPreco({
    ...BASE,
    gatilho: "serie",
    podeAfirmarMinimo: true,
    precoPublicadoCentavos: 10000,
    precoVivoCentavos: 9000,
  }).podeAfirmarMinimo === true,
);

// -------------------------------------------------------------
// Subiu pouco — publica com o preço certo, sem afirmar mínimo
// -------------------------------------------------------------

{
  // O caso real: fonte Montech, R$ 1135,26 no feed, R$ 1154,99 agora. +1,7%.
  const v = revalidaPreco({
    ...BASE,
    referenciaCentavos: 160000,
    precoPublicadoCentavos: 113526,
    precoVivoCentavos: 115499,
  });
  confere("subida dentro da tolerância continua publicando", v.acao === "publica");
  confere("com o preço de agora", v.acao === "publica" && v.precoCentavos === 115499);
}

confere(
  "preço que subiu não pode afirmar mínimo, mesmo que a série permitisse",
  revalidaPreco({
    ...BASE,
    gatilho: "serie",
    podeAfirmarMinimo: true,
    precoPublicadoCentavos: 10000,
    precoVivoCentavos: 10200,
  }).podeAfirmarMinimo === false,
);

// -------------------------------------------------------------
// Subiu demais — a mesma conta de `expira_ofertas`
// -------------------------------------------------------------

confere(
  "3% cravado ainda passa, porque a regra é `maior que`",
  revalidaPreco({ ...BASE, precoPublicadoCentavos: 10000, precoVivoCentavos: 10300 }).acao ===
    "publica",
);
confere(
  "um centavo acima da tolerância descarta",
  revalidaPreco({ ...BASE, precoPublicadoCentavos: 10000, precoVivoCentavos: 10301 }).acao ===
    "descarta",
);

{
  const v = revalidaPreco({ ...BASE, precoPublicadoCentavos: 10000, precoVivoCentavos: 13000 });
  confere("subida grande descarta", v.acao === "descarta");
  confere(
    "e o motivo diz os dois preços, para dar para auditar depois",
    v.acao === "descarta" && v.motivo === "preco_subiu_antes_de_publicar(de_100.00_para_130.00)",
  );
}

confere(
  "a tolerância vem do parâmetro, não é cravada",
  revalidaPreco({
    ...BASE,
    toleranciaAltaPct: 10,
    precoPublicadoCentavos: 10000,
    precoVivoCentavos: 10800,
  }).acao === "publica",
);

// -------------------------------------------------------------
// O desconto que deixou de existir
// -------------------------------------------------------------

confere(
  "preço que alcançou a referência não é mais oferta",
  revalidaPreco({
    ...BASE,
    referenciaCentavos: 10100,
    precoPublicadoCentavos: 10000,
    precoVivoCentavos: 10100,
  }).acao === "descarta",
);

confere(
  "referência nula descarta em vez de publicar desconto inventado",
  revalidaPreco({
    ...BASE,
    referenciaCentavos: null,
    precoPublicadoCentavos: 10000,
    precoVivoCentavos: 9900,
  }).acao === "descarta",
);

// -------------------------------------------------------------
// O teto do desconto declarado — regra 3.4, e só onde ela cabe
// -------------------------------------------------------------

confere(
  "desconto declarado acima do teto descarta",
  revalidaPreco({
    ...BASE,
    gatilho: "declarado",
    referenciaCentavos: 50000,
    precoPublicadoCentavos: 20000,
    precoVivoCentavos: 10000,
  }).acao === "descarta",
);

confere(
  "o mesmo desconto contra a NOSSA série é notícia, e passa",
  revalidaPreco({
    ...BASE,
    gatilho: "serie",
    referenciaCentavos: 50000,
    precoPublicadoCentavos: 20000,
    precoVivoCentavos: 10000,
  }).acao === "publica",
);

confere(
  "e o de queda também passa",
  revalidaPreco({
    ...BASE,
    gatilho: "queda",
    referenciaCentavos: 50000,
    precoPublicadoCentavos: 20000,
    precoVivoCentavos: 10000,
  }).acao === "publica",
);

confere(
  "o teto vem do parâmetro",
  revalidaPreco({
    ...BASE,
    gatilho: "declarado",
    descontoTetoPct: 90,
    referenciaCentavos: 50000,
    precoPublicadoCentavos: 20000,
    precoVivoCentavos: 10000,
  }).acao === "publica",
);

// -------------------------------------------------------------
// Dado que a loja não soube dizer — não é motivo para matar oferta
// -------------------------------------------------------------

confere(
  "preço vivo zero segue com o que tinha",
  revalidaPreco({ ...BASE, precoPublicadoCentavos: 10000, precoVivoCentavos: 0 }).acao === "segue",
);
confere(
  "preço vivo negativo segue com o que tinha",
  revalidaPreco({ ...BASE, precoPublicadoCentavos: 10000, precoVivoCentavos: -1 }).acao === "segue",
);
confere(
  "preço vivo não numérico segue com o que tinha",
  revalidaPreco({ ...BASE, precoPublicadoCentavos: 10000, precoVivoCentavos: NaN }).acao ===
    "segue",
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
