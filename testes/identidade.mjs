/**
 * Teste da chave de identidade do produto.
 *
 * Errar aqui não dá erro em lugar nenhum, e erra para os dois lados:
 * fundir de menos deixa o canal publicar R$ 130 quando existe R$ 119,90
 * do mesmo saco (foi o que aconteceu em 01/08); fundir demais faz o
 * canal anunciar o preço de um item mostrando a foto de outro, que é
 * bem pior.
 *
 * Os casos abaixo são reais, tirados da API em 01/08.
 */
import { atributosDe, chaveDeIdentidade, normaliza, quantidadesDoTitulo } from "../lib/identidade.ts";

let passou = 0;
let falhou = 0;
const confere = (n, ok) => {
  if (ok) {
    passou++;
    console.log(`✓ ${n}`);
  } else {
    falhou++;
    console.log(`✗ ${n}`);
  }
};

console.log("\nnormalização\n");
confere("acento some", normaliza("Ração") === "racao");
// O separador decimal some junto com o resto da pontuação, e tudo
// bem: o que precisa ser verdade é que as duas grafias caiam no MESMO
// texto, não que sobre um ponto.
confere("vírgula e ponto dão no mesmo texto", normaliza("10,1 kg") === "10-1-kg");
confere("10.1 e 10,1 dão no mesmo", normaliza("10.1 kg") === normaliza("10,1 Kg"));
confere("zero à direita não separa", normaliza("10.10 kg") === normaliza("10.1 kg"));
confere("vazio é vazio", normaliza(null) === "" && normaliza(undefined) === "");

console.log("\nos dois catálogos da mesma ração (caso real de 01/08)\n");

// MLB24441152 — o que o canal publicou, a R$ 130,00
const publicado = {
  BRAND: "Special Cat",
  LINE: "Premium",
  UNIT_WEIGHT: "10.1 kg",
  FLAVOR: "Mix",
};

// MLB36519405 — o mesmo saco, a R$ 119,90
const maisBarato = {
  BRAND: "Special Cat",
  LINE: "Premium",
  UNIT_WEIGHT: "10,1 Kg",
  FLAVOR: "Mix",
};

const kPub = chaveDeIdentidade(publicado, "MLB-CAT_AND_DOG_FOODS");
const kBar = chaveDeIdentidade(maisBarato, "MLB-CAT_AND_DOG_FOODS");

confere("os dois têm identidade", Boolean(kPub) && Boolean(kBar));
confere("e é a MESMA identidade", kPub === kBar);

console.log("\no que NÃO pode fundir\n");

const filhote = { BRAND: "Special Cat", LINE: "Premium", UNIT_WEIGHT: "10.1 kg", FLAVOR: "Frango" };
confere(
  "sabor diferente é outro produto",
  chaveDeIdentidade(filhote, "MLB-CAT_AND_DOG_FOODS") !== kPub,
);

const outroPeso = { BRAND: "Special Cat", LINE: "Premium", UNIT_WEIGHT: "20 kg", FLAVOR: "Mix" };
confere(
  "peso diferente é outro produto",
  chaveDeIdentidade(outroPeso, "MLB-CAT_AND_DOG_FOODS") !== kPub,
);

// A mesma marca vende coisas de categorias diferentes com os mesmos
// qualificadores. Sem o domínio na chave, petisco e ração se fundiriam.
const petisco = { BRAND: "Special Cat", LINE: "Premium", UNIT_WEIGHT: "10.1 kg", FLAVOR: "Mix" };
confere(
  "domínio diferente separa",
  chaveDeIdentidade(petisco, "MLB-PET_TREATS") !== kPub,
);

console.log("\no celular que a primeira versão fundiu errado\n");

/*
  Caso real, e foi o que pegou a primeira versão da chave no flagrante.
  Marca, linha, modelo e peso sao IDENTICOS nos tres. So memoria, RAM e
  cor separam, e a diferenca de preco entre o de 128GB e o de 256GB e
  de quase mil reais. Sem estes atributos, o canal anunciaria o caro
  pelo preco do barato.
*/
const a17_128_preto = { BRAND: "Samsung", LINE: "Galaxy A17 5G", MODEL: "A17", WEIGHT: "192 g", INTERNAL_MEMORY: "128 GB", RAM: "4 GB", COLOR: "Preto" };
const a17_128_cinza = { BRAND: "Samsung", LINE: "Galaxy A17 5G", MODEL: "A17", WEIGHT: "192 g", INTERNAL_MEMORY: "128 GB", RAM: "4 GB", COLOR: "Cinza" };
const a17_256_azul  = { BRAND: "Samsung", LINE: "Galaxy A17 5G", MODEL: "A17", WEIGHT: "192 g", INTERNAL_MEMORY: "256 GB", RAM: "8 GB", COLOR: "Azul" };

const k128p = chaveDeIdentidade(a17_128_preto, "MLB-CELLPHONES");
const k128c = chaveDeIdentidade(a17_128_cinza, "MLB-CELLPHONES");
const k256a = chaveDeIdentidade(a17_256_azul, "MLB-CELLPHONES");

confere("128GB e 256GB NAO sao o mesmo produto", k128p !== k256a);
confere("cor diferente separa, e o custo disso e aceito", k128p !== k128c);

// A RAM sozinha tem que separar. Isolada de propósito: no caso real
// ela vem junto da memória, e um teste que muda as duas ao mesmo tempo
// passaria mesmo se a RAM fosse ignorada.
const soARam = { ...a17_128_preto, RAM: "8 GB" };
confere(
  "so a RAM diferente ja e outro produto",
  chaveDeIdentidade(soARam, "MLB-CELLPHONES") !== k128p,
);

console.log("\na trava das quantidades, que a lista branca nao pegava\n");

/*
  Estes quatro sairam da primeira varredura de irmaos rodada contra o
  catalogo real, e TODOS estavam errados. Em cada um, o atributo que
  diferenciava nao estava cadastrado ou tinha um id fora da lista.
  A licao e que lista branca so enxerga o que alguem lembrou de por
  nela; o titulo carrega a quantidade porque e o que o comprador
  procura.
*/
const paresQueNaoSaoIguais = [
  ["Cabo Hdmi 5m Metros Preto Premium 4k", "Cabo Hdmi 20m Metros Preto Premium 4k"],
  ["Omo Lavagem Perfeita sabao em po caixa 800gr", "Sabao em Po Omo Lavagem Perfeita 4kg"],
  ["Papel Higienico Folha Tripla 20 Metros Neve Com 4 Rolos", "Papel Higienico Supreme Folha Tripla 24 Rolos Neve"],
  ["Vittak Kit 50 Cabides Adulto Veludo", "Vittak Kit 30 Cabides Veludo De Roupa"],
];
for (const [a, b] of paresQueNaoSaoIguais) {
  confere(
    `separa: ${a.slice(0, 28)} | ${b.slice(0, 28)}`,
    quantidadesDoTitulo(a) !== quantidadesDoTitulo(b),
  );
}

confere(
  "e os dois titulos da MESMA racao continuam batendo",
  quantidadesDoTitulo("Alimento Special Cat Mix Adultos 10,1kg Racao Gato") ===
    quantidadesDoTitulo("Special Cat Mix Premium Racao Para Gato Adulto 10,1kg"),
);
confere("titulo sem numero nao inventa quantidade", quantidadesDoTitulo("Arranhador Gato Rampa") === "");

console.log("\nquando não dá para afirmar identidade\n");

confere("sem atributo nenhum, nulo", chaveDeIdentidade({}, "MLB-X") === null);
confere("só a marca não basta", chaveDeIdentidade({ BRAND: "Special Cat" }, "MLB-X") === null);
confere(
  "qualificador sem marca não basta",
  chaveDeIdentidade({ UNIT_WEIGHT: "10.1 kg", FLAVOR: "Mix" }, "MLB-X") === null,
);

console.log("\no GTIN vence tudo\n");

const comGtin = { GTIN: "7896029081234", BRAND: "Outra Marca", FLAVOR: "Outro" };
const mesmoGtin = { GTIN: "7896029081234", BRAND: "Marca Diferente", UNIT_WEIGHT: "1 kg" };
confere(
  "mesmo código de barras, mesma identidade",
  chaveDeIdentidade(comGtin, "MLB-A") === chaveDeIdentidade(mesmoGtin, "MLB-B"),
);
confere("e ela ignora até o domínio", chaveDeIdentidade(comGtin, "MLB-A").startsWith("gtin:"));
// GTIN curto demais é lixo de cadastro, não código de barras.
confere("GTIN curto não conta", chaveDeIdentidade({ GTIN: "123", BRAND: "X" }, "MLB-A") === null);

console.log("\nleitura dos atributos como o ML devolve\n");
const cru = {
  attributes: [
    { id: "BRAND", value_name: "Special Cat" },
    { id: "FLAVOR", value_name: null },
    { id: "UNIT_WEIGHT", value_name: "10.1 kg" },
  ],
};
const lidos = atributosDe(cru);
confere("lê a lista para objeto", lidos.BRAND === "Special Cat");
confere("valor nulo continua nulo", lidos.FLAVOR === null);
confere("produto sem atributos não quebra", Object.keys(atributosDe({})).length === 0);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
