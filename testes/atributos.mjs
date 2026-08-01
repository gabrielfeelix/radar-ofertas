/**
 * Teste do filtro de atributo do canal.
 *
 * Roda com `pnpm testa`. Função pura, sem banco e sem rede.
 *
 * Por que este arquivo existe: quebrar `canalAceitaAtributos` não dá
 * erro em lugar nenhum. Se ela passar a devolver `true` sempre, o
 * Radar Perfumes (masc) publica Floratta e ninguém é avisado; se
 * passar a devolver `false` demais, os dois canais de perfume ficam
 * mudos e o sintoma é indistinguível de "não houve oferta hoje".
 *
 * O caso que mais importa é o do meio: PRODUTO SEM O ATRIBUTO PASSA.
 * Boa parte do catálogo do ML não preenche `GENDER`, e reprovar por
 * ausência calaria o canal por causa do cadastro de um terceiro.
 */

import { canalAceitaAtributos } from "../lib/canal-aceita.ts";

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

const soMasculino = [{ atributo: "GENDER", valores: ["Masculino"], modo: "inclui" }];
const semMasculino = [{ atributo: "GENDER", valores: ["Masculino"], modo: "exclui" }];

console.log("\nfiltro de atributo do canal\n");

// Canal sem filtro é todo canal que existia antes da migration 37.
// Nenhum deles pode mudar de comportamento por a função existir.
confere("canal sem filtro aceita tudo", canalAceitaAtributos(null, { GENDER: "Feminino" }));
confere("lista vazia também", canalAceitaAtributos([], { GENDER: "Feminino" }));

confere("inclui deixa passar quem casa", canalAceitaAtributos(soMasculino, { GENDER: "Masculino" }));
confere("inclui barra quem não casa", !canalAceitaAtributos(soMasculino, { GENDER: "Feminino" }));
confere("exclui barra quem casa", !canalAceitaAtributos(semMasculino, { GENDER: "Masculino" }));
confere("exclui deixa passar o resto", canalAceitaAtributos(semMasculino, { GENDER: "Feminino" }));

// Os dois canais precisam ser complementares, senão perfume some ou
// sai repetido. É a propriedade que o par Beauty/Perfumes depende.
for (const genero of ["Masculino", "Feminino", "Meninos", "Meninas", "Sem gênero"]) {
  const noMasc = canalAceitaAtributos(soMasculino, { GENDER: genero });
  const noBeauty = canalAceitaAtributos(semMasculino, { GENDER: genero });
  confere(`"${genero}" cai em exatamente um dos dois canais`, noMasc !== noBeauty);
}

/*
  O CASO QUE MAIS IMPORTA. Produto sem o atributo passa nos dois modos,
  e é escolha, não descuido: quando o custo de errar é "o canal fica
  mudo", o desconhecido passa. Mesma decisão da migration 36.
*/
confere("produto sem atributos passa", canalAceitaAtributos(soMasculino, null));
confere("produto sem O atributo passa", canalAceitaAtributos(soMasculino, { BRAND: "Natura" }));
confere("atributo vazio conta como ausente", canalAceitaAtributos(soMasculino, { GENDER: "" }));

/*
  Quem cadastra o produto é a loja, e loja escreve como quer. Comparar
  cru faria "masculino" escapar do filtro sem que ninguém percebesse —
  o sintoma seria um perfume errado no canal, uma vez a cada tantas.
*/
confere("caixa não importa", canalAceitaAtributos(soMasculino, { GENDER: "masculino" }));
confere("acento não importa", !canalAceitaAtributos(soMasculino, { GENDER: "Feminíno" }));
confere("espaço em volta não importa", canalAceitaAtributos(soMasculino, { GENDER: " Masculino " }));

// Filtros se somam: todos precisam passar.
const doisFiltros = [
  { atributo: "GENDER", valores: ["Masculino"], modo: "inclui" },
  { atributo: "BRAND", valores: ["Marca Ruim"], modo: "exclui" },
];
confere(
  "dois filtros: passa quem satisfaz os dois",
  canalAceitaAtributos(doisFiltros, { GENDER: "Masculino", BRAND: "Azzaro" }),
);
confere(
  "dois filtros: um sozinho já barra",
  !canalAceitaAtributos(doisFiltros, { GENDER: "Masculino", BRAND: "Marca Ruim" }),
);

// Vários valores no mesmo filtro é "qualquer um serve".
const infantil = [{ atributo: "GENDER", valores: ["Meninos", "Meninas"], modo: "inclui" }];
confere("vários valores: qualquer um serve", canalAceitaAtributos(infantil, { GENDER: "Meninas" }));
confere("vários valores: fora da lista barra", !canalAceitaAtributos(infantil, { GENDER: "Masculino" }));

/*
  `exigeAtributo`: o caso que o par Beauty/Perfumes obrigou (migration 43).

  O primeiro perfume que entrou no catálogo veio com `atributos` nulo, e
  com "sem atributo passa" nos dois lados ele casava com os DOIS canais.
  Quem é RECORTE exige; quem é RESTO não.
*/
const soMascExige = [
  { atributo: "GENDER", valores: ["Masculino"], modo: "inclui", exigeAtributo: true },
];

confere("exige: produto sem atributos é reprovado", !canalAceitaAtributos(soMascExige, null));
confere(
  "exige: produto sem O atributo é reprovado",
  !canalAceitaAtributos(soMascExige, { BRAND: "Azzaro" }),
);
confere(
  "exige: quem declara e casa continua passando",
  canalAceitaAtributos(soMascExige, { GENDER: "Masculino" }),
);
confere(
  "exige: quem declara e não casa continua barrado",
  !canalAceitaAtributos(soMascExige, { GENDER: "Feminino" }),
);

// A propriedade que o par depende: perfume sem GENDER cai SÓ no Beauty.
for (const atributos of [null, { BRAND: "Natura" }, { GENDER: "" }]) {
  const noMasc = canalAceitaAtributos(soMascExige, atributos);
  const noBeauty = canalAceitaAtributos(semMasculino, atributos);
  confere(
    `perfume sem GENDER (${JSON.stringify(atributos)}) cai só no Beauty`,
    !noMasc && noBeauty,
  );
}

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
