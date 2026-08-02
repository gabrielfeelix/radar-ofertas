/**
 * Teste do link de afiliado — o campo que carrega a comissão.
 *
 * Existe porque errar aqui não dá erro em lugar nenhum: o link sai
 * perfeito, a pessoa compra, e a comissão vai para o lugar errado ou
 * para lugar nenhum. Só se descobre no extrato, semanas depois.
 */

process.env.ML_MATT_TOOL = "66367903";
// Valor de teste, não o real: o teste não pode depender do `.env`.
process.env.AFILIADO_AMAZON = "radar4yu-20";
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

/*
  AMAZON (02/08). Formato tirado de links reais que circulam em canais
  de oferta. `tag` paga a comissão; `ascsubtag` é o subid, e era a
  pergunta em aberto desde a D-035.
*/
const AZ = "https://www.amazon.com.br/dp/B0CWB2H5JX";
const az = montaLinkDeAfiliado(AZ, "k3m9pq2x", "amazon");

confere("amazon: rastreado", az.rastreado);
confere("amazon: leva a tag de associado", az.url.includes("tag=radar4yu-20"));
confere("amazon: o subid vai em ascsubtag", az.url.includes("ascsubtag=k3m9pq2x"));
confere("amazon: marca a origem como SiteStripe", az.url.includes("linkCode=ll1"));
confere("amazon: preserva o ASIN", az.url.includes("/dp/B0CWB2H5JX"));

/*
  O que NÃO pode entrar. `btn_type`, `btn_ref` e o prefixo `srctok-` do
  link de exemplo são da plataforma Button, que o autor daquele link usa
  como intermediária — copiá-los atribuiria a venda a um terceiro.
*/
confere("amazon: não copia os parâmetros da Button", !/btn_type|btn_ref|srctok/.test(az.url));

// URL que já vem com tag de OUTRO afiliado precisa ser sobrescrita, ou
// a comissão vai para quem publicou antes.
const daOutraPessoa = montaLinkDeAfiliado(`${AZ}?tag=milena0fd-20`, "k3m9pq2x", "amazon");
confere("amazon: sobrescreve a tag de outro afiliado", daOutraPessoa.url.includes("tag=radar4yu-20"));
confere("amazon: e não deixa a antiga", !daOutraPessoa.url.includes("milena0fd-20"));

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
