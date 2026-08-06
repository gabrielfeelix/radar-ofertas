/**
 * Teste do reconhecimento de marca de perfume.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede.
 *
 * POR QUE ELE EXISTE. Este módulo decide a ORDEM da fila do canal de
 * perfume, e ordem errada é o pedido do dono virando o contrário do que
 * ele pediu: colônia de personagem infantil na frente de um Azzaro.
 *
 * TODOS OS TÍTULOS SÃO REAIS, lidos do catálogo de produção em 06/08.
 */

import { marcaDePerfume, pesoDaMarca } from "../lib/marca-de-perfume.ts";

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

console.log("\nmarca de perfume\n");

// -------------------------------------------------------------
// As tres faixas que o dono pediu
// -------------------------------------------------------------

confere(
  "internacional conhecida",
  marcaDePerfume("Perfume Masculino Eau de Toilette Azzaro - Azzaro Pour Homme 100 ml").faixa ===
    "conhecida",
);
confere(
  "arabe pela casa",
  marcaDePerfume("Perfume Armaf Club De Nuit Intense 105mL EDT").faixa === "arabe",
);
confere(
  "arabe pela expressao",
  marcaDePerfume("Perfume Árabe Mawwal Jinan Masculino 100ml").faixa === "arabe",
);
confere(
  "brasileira boa",
  marcaDePerfume("Deo Parfum Natura Essencial Sentir Masculino 100 mL").faixa === "brasileira",
);
confere(
  "boticario tambem",
  marcaDePerfume("Perfume Boticário Malbec 100 Ml").faixa === "brasileira",
);

// -------------------------------------------------------------
// O que o dono chamou de duvidoso
// -------------------------------------------------------------

confere(
  "revenda porta a porta fica em desconhecida",
  marcaDePerfume("Deo Colônia Masculino Exclusive Code 15ml - Amakha Paris").faixa ===
    "desconhecida",
);
confere(
  "e e marcada como revenda, para o log dizer por que",
  marcaDePerfume("Deo Colônia Masculino Exclusive Code 15ml - Amakha Paris").revenda === true,
);
confere(
  "hinode idem",
  marcaDePerfume("Perfume Grace Midnight Feminino Frasco Antigo Hinode 100ml").faixa ===
    "desconhecida",
);

/*
  O CRUZAMENTO QUE EXISTE DE VERDADE NO CATALOGO. "Kit Perfumaria Arabe
  Amakha Paris" casa com arabe E com revenda, e nao pode roubar a vaga
  de um Mawwal.
*/
confere(
  "revenda derruba a faixa, mesmo casando com arabe",
  marcaDePerfume("Kit Perfumaria Árabe Amakha Paris | 3 Perfumes 15ml").faixa === "desconhecida",
);

// -------------------------------------------------------------
// O erro que a amostra pegou: Jequiti nao e perfumaria
// -------------------------------------------------------------

confere(
  "colonia de personagem infantil nao e marca conhecida",
  marcaDePerfume("Colônia Turma Da Mônica Cebolinha Jequiti 25mL").faixa === "desconhecida",
);

// -------------------------------------------------------------
// Body splash continua entrando, so nao na frente
// -------------------------------------------------------------

confere(
  "body splash sem marca fica em desconhecida",
  marcaDePerfume("BODY SPLASH MASCULINO ENIGMA 200ML - PRIMACIAL").faixa === "desconhecida",
);
confere(
  "e body splash de marca boa continua valendo",
  marcaDePerfume("Kit Feminino 2 Body Splash Egeo Vanila 200ml").faixa === "brasileira",
);

// -------------------------------------------------------------
// O peso, que e o que ordena a fila
// -------------------------------------------------------------

confere("marca boa pesa 1", pesoDaMarca("Perfume Armaf Club De Nuit") === 1);
confere("marca desconhecida pesa 0", pesoDaMarca("Deo Colônia Man 15ml - Amakha Paris") === 0);
confere("titulo vazio pesa 0", pesoDaMarca("") === 0);
confere("titulo nulo pesa 0", pesoDaMarca(null) === 0);
confere(
  "titulo sem marca nenhuma pesa 0",
  pesoDaMarca("Ez Silver Essence - Eau De Parfum 100ml Exclusivo") === 0,
);

// -------------------------------------------------------------
// Bordas
// -------------------------------------------------------------

confere("a caixa nao importa", marcaDePerfume("PERFUME AZZARO POUR HOMME").faixa === "conhecida");
confere(
  "marca no meio do titulo conta",
  marcaDePerfume("Kit 2 Perfumes Importados Joop! Homme e Azzaro").faixa === "conhecida",
);
confere("titulo nulo nao quebra", marcaDePerfume(null).faixa === "desconhecida");

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
