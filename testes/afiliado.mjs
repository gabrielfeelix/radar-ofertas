/**
 * Teste do link de afiliado — o campo que carrega a comissão.
 *
 * Existe porque errar aqui não dá erro em lugar nenhum: o link sai
 * perfeito, a pessoa compra, e a comissão vai para o lugar errado ou
 * para lugar nenhum. Só se descobre no extrato, semanas depois.
 */

process.env.ML_MATT_TOOL = "66367903";
const { montaLinkDeAfiliado } = await import("../lib/afiliado.ts");

let passou = 0;
let falhou = 0;
const confere = (nome, ok) => {
  if (ok) { passou++; console.log(`✓ ${nome}`); }
  else { falhou++; console.log(`✗ ${nome}`); }
};

const PRODUTO = "https://www.mercadolivre.com.br/p/MLB22912462";

console.log("\no caminho feliz\n");

const r = montaLinkDeAfiliado(PRODUTO, "k3m9pq2x", "mercado_livre");
confere("marca como rastreado", r.rastreado);
confere("leva o subid em matt_word", r.url.includes("matt_word=k3m9pq2x"));
confere("leva a ferramenta em matt_tool", r.url.includes("matt_tool=66367903"));
confere("preserva o produto", r.url.includes("/p/MLB22912462"));

console.log("\nquando falta configuração — devolve link, nunca vazio\n");

const semLoja = montaLinkDeAfiliado(PRODUTO, "k3m9pq2x", "shopee");
confere("loja sem afiliado configurado não é rastreada", !semLoja.rastreado);
confere("mas devolve a URL crua, porque link vazio não vende nada", semLoja.url === PRODUTO);
confere("e diz o motivo", Boolean(semLoja.motivo));

const semUrl = montaLinkDeAfiliado("", "k3m9pq2x", "mercado_livre");
confere("anúncio sem URL não é rastreado", !semUrl.rastreado);

const urlTorta = montaLinkDeAfiliado("nao é uma url", "k3m9pq2x", "mercado_livre");
confere("URL inválida não quebra", !urlTorta.rastreado && urlTorta.url === "nao é uma url");

console.log("\nquando o anúncio já tem parâmetros\n");

const comQuery = montaLinkDeAfiliado(`${PRODUTO}?ref=abc`, "k3m9pq2x", "mercado_livre");
confere("preserva o que já estava lá", comQuery.url.includes("ref=abc"));
confere("e acrescenta o matt_word", comQuery.url.includes("matt_word=k3m9pq2x"));

const jaTinhaWord = montaLinkDeAfiliado(`${PRODUTO}?matt_word=doOutro`, "k3m9pq2x", "mercado_livre");
confere(
  "sobrescreve matt_word de outra pessoa — publicar o afiliado alheio é dar a venda de presente",
  jaTinhaWord.url.includes("matt_word=k3m9pq2x") && !jaTinhaWord.url.includes("doOutro"),
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
