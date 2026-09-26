/**
 * Teste da conta de afiliado do parceiro (D-074) e do filtro de bicho.
 *
 * O caso que não pode quebrar é o primeiro: os canais do dono, que não
 * têm parceiro, precisam sair com o MESMO link de antes. O segundo é o
 * inverso: o grupo do parceiro nunca pode sair com o ID do dono.
 */

process.env.AFILIADO_SHOPEE = "18378371108";
process.env.AFILIADO_AMAZON = "radar4yu-20";
const { montaLinkDeAfiliado } = await import("../lib/afiliado.ts");
const { donoDoLink, contasDasLinhas } = await import("../lib/conta-do-canal.ts");
const { animalDoPet } = await import("../lib/animal-do-pet.ts");

let passou = 0;
let falhou = 0;
const confere = (nome, ok) => {
  if (ok) { passou++; console.log(`✓ ${nome}`); }
  else { falhou++; console.log(`✗ ${nome}`); }
};

const SHOPEE = "https://shopee.com.br/produto-i.123.456";
const DONO = "18378371108";
const BRENO = "18373711182";

console.log("\nos canais do dono não mudam\n");

confere("canal sem parceiro é do dono", donoDoLink(null, "shopee").de === "dono");
confere("parceiro sem conta nenhuma é do dono", donoDoLink({}, "mercado_livre").de === "dono");

const antes = montaLinkDeAfiliado(SHOPEE, "k3m9pq2x", "shopee");
const depois = montaLinkDeAfiliado(SHOPEE, "k3m9pq2x", "shopee", undefined);
confere("o link do dono sai idêntico sem o parâmetro novo", antes.url === depois.url);
confere("e com o ID do dono", new URL(antes.url).searchParams.get("affiliate_id") === DONO);

console.log("\no grupo do parceiro sai com o ID dele\n");

const contas = contasDasLinhas([{ afiliado_id: ` ${BRENO} `, marketplace: { slug: "shopee" } }]);
const shopee = donoDoLink(contas, "shopee");
confere("shopee com conta do parceiro é dele", shopee.de === "parceiro" && shopee.afiliadoId === BRENO);

const doBreno = montaLinkDeAfiliado(SHOPEE, "k3m9pq2x", "shopee", shopee.afiliadoId);
confere("o affiliate_id é o do parceiro", new URL(doBreno.url).searchParams.get("affiliate_id") === BRENO);
confere("o ID do dono não aparece em lugar nenhum", !doBreno.url.includes(DONO));
confere("o subid continua indo", doBreno.url.includes("k3m9pq2x"));

console.log("\nloja sem conta do parceiro não sai, nunca cai para o dono\n");

const ml = donoDoLink(contas, "mercado_livre");
confere("mercado livre sem conta do parceiro: ninguém", ml.de === "ninguem" && Boolean(ml.motivo));
const amazon = donoDoLink(contas, "amazon");
confere("amazon sem conta do parceiro: ninguém", amazon.de === "ninguem");

const mlComId = donoDoLink({ shopee: BRENO, mercado_livre: "algo" }, "mercado_livre");
confere("mercado livre com ID mas sem sessão: ninguém", mlComId.de === "ninguem");

confere(
  "linha sem loja ou com ID vazio é ignorada",
  Object.keys(contasDasLinhas([{ afiliado_id: " ", marketplace: { slug: "shopee" } }, { afiliado_id: "1", marketplace: null }])).length === 0,
);

console.log("\no bicho do produto de pet\n");

const casos = [
  ["Ração Golden Cães Adultos Frango 15kg", "cao"],
  ["Ração Gato Castrado Carne E Frango 10,1kg", "gato"],
  ["Arranhador Torre Para Gatos 3 Andares", "gato"],
  ["Brinquedo Pet Roer Osso Mordedor Pet Escova", null],
  ["Cama Pet Suspensa Sofá Poltrona", null],
  ["Sela Australiana Para Cavalo Couro", "outro"],
  ["Ração Para Calopsita Alpiste 1kg", "outro"],
  ["Aquário 40 Litros Com Filtro", "outro"],
  ["Shampoo Para Cães, Gatos e Coelhos", "cao"],
  ["Ração Úmida Sachê Whiskas", null],
  ["Tubarão de pelúcia", null],
  ["Orelha Suína Desidratada Petisco Natural", null],
  ["Petisco Bovino Palito 500g", null],
];
for (const [titulo, esperado] of casos) {
  confere(`${titulo} → ${esperado}`, animalDoPet(titulo) === esperado);
}

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
