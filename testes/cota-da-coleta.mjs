/**
 * Teste da divisão da cota diária da coleta.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede.
 *
 * POR QUE ELE EXISTE. Esta função decide o que entra no catálogo, e
 * catálogo é o que os canais têm para publicar. Errar aqui não aparece
 * como erro: aparece como canal mudo três dias depois, que foi
 * exatamente o que aconteceu com o perfume e o pet.
 */

import { escolheCota } from "../lib/cota-da-coleta.ts";

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

/** Gera `n` candidatos de um nicho, com desconto decrescente. */
function candidatos(nicho, n, { temReputacao = true, descontoBase = 60, prefixo = "" } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    sku: `${prefixo}${nicho}.${i}`,
    nicho,
    desconto: descontoBase - i * 0.01,
    temReputacao,
  }));
}

const COM_CANAL = new Set(["pet", "beleza", "perfume"]);
const REGRAS = { teto: 10, nichosComCanal: COM_CANAL, exigeReputacao: true };

console.log("\ncota da coleta\n");

// -------------------------------------------------------------
// O defeito que este arquivo existe para consertar
// -------------------------------------------------------------

{
  /*
    O caso real, em miniatura: `casa` tem desconto maior e volume maior,
    e pela regra antiga levaria a cota inteira. Perfume tem 3 itens e
    ficava com zero.
  */
  const lista = [
    ...candidatos("casa", 50, { descontoBase: 70 }),
    ...candidatos("pet", 20, { descontoBase: 40 }),
    ...candidatos("perfume", 3, { descontoBase: 30 }),
  ];
  const r = escolheCota(lista, REGRAS);

  confere("a cota inteira é usada", r.escolhidos.length === 10);
  confere("casa não leva nada enquanto há nicho com canal", (r.porNicho.casa ?? 0) === 0);
  confere("perfume leva os três que tem", r.porNicho.perfume === 3);
  confere("pet leva o resto", r.porNicho.pet === 7);
}

// -------------------------------------------------------------
// O rodízio: um de cada vez, e nicho pequeno não é atropelado
// -------------------------------------------------------------

{
  const lista = [
    ...candidatos("pet", 100),
    ...candidatos("beleza", 100),
    ...candidatos("perfume", 100),
  ];
  const r = escolheCota(lista, REGRAS);
  // A sobra da divisão fica com o primeiro da ordem alfabética
  // (`beleza`), e é o único lugar onde a ordem importa.
  confere(
    "três nichos com muita oferta dividem a cota por igual",
    r.porNicho.beleza === 4 && r.porNicho.perfume === 3 && r.porNicho.pet === 3,
  );
}

{
  // Dentro do nicho, o maior desconto continua ganhando.
  const lista = [
    { sku: "pet.a", nicho: "pet", desconto: 30, temReputacao: true },
    { sku: "pet.b", nicho: "pet", desconto: 65, temReputacao: true },
    { sku: "pet.c", nicho: "pet", desconto: 50, temReputacao: true },
  ];
  const r = escolheCota(lista, { ...REGRAS, teto: 2 });
  confere(
    "dentro do nicho, o maior desconto vem primeiro",
    r.escolhidos[0].sku === "pet.b" && r.escolhidos[1].sku === "pet.c",
  );
}

// -------------------------------------------------------------
// Nicho sem canal entra na sobra, e não antes dela
// -------------------------------------------------------------

{
  const lista = [...candidatos("pet", 3), ...candidatos("casa", 50)];
  const r = escolheCota(lista, REGRAS);
  confere("pet leva tudo que tem", r.porNicho.pet === 3);
  confere("a sobra da cota vai para casa", r.porNicho.casa === 7);
  confere("e a cota fecha", r.escolhidos.length === 10);
}

{
  // A sobra também é rodízio: casa não come a vaga de moda.
  const lista = [...candidatos("casa", 50), ...candidatos("moda", 50)];
  const r = escolheCota(lista, REGRAS);
  confere("a sobra é dividida entre os nichos sem canal", r.porNicho.casa === 5 && r.porNicho.moda === 5);
}

{
  const lista = candidatos("casa", 50);
  const r = escolheCota(lista, REGRAS);
  confere(
    "sem nenhum nicho com canal, a cota inteira vai para quem tem",
    r.escolhidos.length === 10 && r.porNicho.casa === 10,
  );
}

// -------------------------------------------------------------
// Reputação: quem não tem não entra, e o parâmetro manda
// -------------------------------------------------------------

{
  const lista = [
    ...candidatos("pet", 5, { temReputacao: false }),
    ...candidatos("beleza", 4),
  ];
  const r = escolheCota(lista, REGRAS);
  confere("candidato sem reputação não entra", (r.porNicho.pet ?? 0) === 0);
  confere("e é contado no descarte", r.descartados.sem_reputacao === 5);
  confere("quem tem reputação entra", r.porNicho.beleza === 4);
}

{
  const lista = candidatos("pet", 5, { temReputacao: false });
  const r = escolheCota(lista, { ...REGRAS, exigeReputacao: false });
  confere(
    "com a comporta desligada, sem reputação volta a entrar",
    r.escolhidos.length === 5 && r.descartados.sem_reputacao === 0,
  );
}

// -------------------------------------------------------------
// O mesmo item nos dois feeds
// -------------------------------------------------------------

{
  const lista = [
    { sku: "1.1", nicho: "pet", desconto: 50, temReputacao: false },
    { sku: "1.1", nicho: "pet", desconto: 50, temReputacao: true },
  ];
  const r = escolheCota(lista, REGRAS);
  confere("o duplicado entra uma vez só", r.escolhidos.length === 1);
  confere("e vence a cópia que tem reputação", r.escolhidos[0].temReputacao === true);
  confere("o descarte é contado como duplicado", r.descartados.duplicado_entre_feeds === 1);
}

{
  // A ordem inversa dá o mesmo resultado: quem tem reputação fica.
  const lista = [
    { sku: "1.1", nicho: "pet", desconto: 50, temReputacao: true },
    { sku: "1.1", nicho: "pet", desconto: 50, temReputacao: false },
  ];
  const r = escolheCota(lista, REGRAS);
  confere("e a ordem dos feeds não muda isso", r.escolhidos.length === 1 && r.escolhidos[0].temReputacao === true);
}

// -------------------------------------------------------------
// Bordas
// -------------------------------------------------------------

confere("lista vazia devolve vazio", escolheCota([], REGRAS).escolhidos.length === 0);

confere(
  "teto zero não escolhe ninguém",
  escolheCota(candidatos("pet", 5), { ...REGRAS, teto: 0 }).escolhidos.length === 0,
);

{
  const lista = candidatos("pet", 3);
  const r = escolheCota(lista, { ...REGRAS, teto: 100 });
  confere("cota maior que a oferta leva tudo, sem repetir", r.escolhidos.length === 3);
  confere("e nada fica marcado como sem vaga", r.descartados.sem_vaga_com_canal === 0);
}

{
  const lista = [...candidatos("pet", 30), ...candidatos("casa", 30)];
  const r = escolheCota(lista, { ...REGRAS, teto: 10 });
  confere(
    "o que sobrou é contado, para o log dizer o tamanho da fila",
    r.descartados.sem_vaga_com_canal === 20 && r.descartados.sem_vaga_sem_canal === 30,
  );
}

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
