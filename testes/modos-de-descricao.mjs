/**
 * Teste dos cinquenta modos de descrição.
 *
 * O TESTE QUE JUSTIFICA O ARQUIVO é o primeiro bloco: **todo exemplo que
 * mandamos para a IA tem que sobreviver à nossa própria validação**.
 *
 * Parece óbvio e não é. Um exemplo que a validação recusaria ensina o
 * modelo a escrever exatamente aquilo que vamos jogar fora, e o efeito
 * não aparece em lugar nenhum: o post simplesmente sai sem descrição, de
 * vez em quando, sem erro e sem log. Foi assim que dois exemplos com
 * âncora de relógio ficaram no prompt desde 10/08.
 *
 * O segundo bloco cuida do sorteio: com peso, a família `pessoal` não
 * pode passar de um quarto dos posts. É a ressalva do dono em 15/08,
 * *"vai parecer que é mentira, se a gente já usou tudo"*, virada em
 * número.
 */
import { MODOS, PESO_DAS_FAMILIAS, TODOS_OS_EXEMPLOS, sorteiaModo } from "../lib/modos-de-descricao.ts";
import { validaGancho } from "../lib/gancho.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\ntodo exemplo nosso passa pela nossa própria validação\n");

for (const modo of MODOS) {
  for (const ex of modo.exemplos) {
    // A cópia literal é recusada de propósito, então testamos o exemplo
    // com uma palavra a mais, que é o que a IA devolveria de verdade.
    const comoAIaDevolveria = `${ex} viu`;
    confere(`[${modo.id}] "${ex}"`, validaGancho(comoAIaDevolveria) !== null);
  }
}

console.log("\na forma dos modos\n");

confere("são cinquenta modos", MODOS.length === 50);
confere("todo id é único", new Set(MODOS.map((m) => m.id)).size === MODOS.length);
confere("todo modo tem exatamente dois exemplos", MODOS.every((m) => m.exemplos.length === 2));
confere("nenhum exemplo se repete entre modos", new Set(TODOS_OS_EXEMPLOS).size === TODOS_OS_EXEMPLOS.length);
confere("os pesos somam cem", Object.values(PESO_DAS_FAMILIAS).reduce((a, b) => a + b, 0) === 100);
confere(
  "toda família dos pesos tem pelo menos um modo",
  Object.keys(PESO_DAS_FAMILIAS).every((f) => MODOS.some((m) => m.familia === f)),
);

console.log("\nnenhum exemplo carrega o tique que estamos combatendo\n");

const RELOGIO = /\b(caf[ée]|almo[çc]o|jantar|manh[ãa]|madrugada|alarme|dia inteiro|o dia todo|semana toda|\d+\s*h(oras?)?)\b/i;
confere(
  "nenhum exemplo ancora em relógio",
  TODOS_OS_EXEMPLOS.every((e) => !RELOGIO.test(e)),
);
confere(
  "nenhum exemplo fecha no cômodo da casa",
  TODOS_OS_EXEMPLOS.every((e) => !/\b(n[ao] sala|pela casa|em qualquer canto)\s*$/i.test(e)),
);

console.log("\no sorteio respeita o peso da família\n");

/*
  Sorteio determinístico, e o gerador PRECISA ter estado.

  A primeira versão deste teste devolvia o mesmo número nas duas
  chamadas que `sorteiaModo` faz (a da família e a do modo dentro dela),
  e com isso o sorteio só alcançava um punhado de modos. O defeito era
  do teste, não do código, mas ele teria escondido o defeito real se
  existisse.
*/
const mil = [];
let semente = 1;
const proximo = () => {
  semente = (semente * 1103515245 + 12345) % 2147483648;
  return semente / 2147483648;
};
for (let i = 0; i < 1000; i++) mil.push(sorteiaModo(proximo));
const pessoal = mil.filter((m) => m.familia === "pessoal").length;
confere(
  `família pessoal fica em torno de 25% (deu ${(pessoal / 10).toFixed(0)}%)`,
  pessoal >= 180 && pessoal <= 320,
);
confere(
  "o sorteio alcança mais de vinte modos diferentes",
  new Set(mil.map((m) => m.id)).size > 20,
);
confere("o sorteio nunca devolve indefinido", mil.every(Boolean));


console.log("\no título trava os modos que pedem fato não garantido\n");

const idsDe = (titulo) => {
  let s2 = 7;
  const r = () => { s2 = (s2 * 1103515245 + 12345) % 2147483648; return s2 / 2147483648; };
  return new Set(Array.from({ length: 400 }, () => sorteiaModo(r, titulo).id));
};

const semPista = idsDe("Corretivo Líquido Matte Alta Cobertura Payot Tom 2.5");
confere("corretivo sem pista não sorteia 'o-ativo'", !semPista.has("o-ativo"));
confere("corretivo sem pista não sorteia 'sensivel'", !semPista.has("sensivel"));
confere("corretivo sem pista não sorteia 'cheiro'", !semPista.has("cheiro"));
confere("corretivo ainda tem muitos modos disponíveis", semPista.size > 25);

const comAtivo = idsDe("Sérum Facial com Niacinamida 30ml Pele Oleosa");
confere("título com niacinamida libera 'o-ativo'", comAtivo.has("o-ativo"));

const comKit = idsDe("Kit Skincare com 3 Produtos e Espátula");
confere("título de kit libera 'o-que-vem-junto'", comKit.has("o-que-vem-junto"));

const semNada = idsDe("Produto");
confere("título vazio de pistas nunca devolve indefinido", semNada.size > 0);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) process.exit(1);
