/**
 * Teste da leitura de gênero pelo título.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede.
 *
 * OS TÍTULOS SÃO REAIS, tirados do catálogo da Shopee em produção. O
 * caso que dá o tom é o "KIT 6 BODY SPLASH FEMININO INVERSE + AURA +
 * LAVINE": ele existe, está no banco, e é o tipo de coisa que uma regra
 * frouxa mandaria para o canal errado.
 *
 * O que este arquivo protege é o `null`. Acertar o masculino é fácil; o
 * que custa caro é chutar quando o título não dá certeza.
 */

import { generoPeloTitulo, atributosComGenero } from "../lib/genero-pelo-titulo.ts";

let passou = 0, falhou = 0;
const confere = (nome, cond) => {
  if (cond) { passou++; console.log(`✓ ${nome}`); }
  else { falhou++; console.error(`✗ ${nome}`); }
};

console.log("\ngênero pelo título\n");

// --- Títulos reais do catálogo, lado masculino
for (const t of [
  "Perfume Spray Masculino Odyssey SPECTRA Armaf Original - 200ml",
  "Perfume 100 ml Masculino ATRAÇÃO Men Perfume Masculino com fixação",
  "Maison Alhambra 30ml Perfume arabe Masculino",
  "Kit Perfume Masculino Luan Pereira Dia E Noite 3500",
]) confere(`masculino: "${t.slice(0, 42)}"`, generoPeloTitulo(t) === "Masculino");

// --- Títulos reais, lado feminino
for (const t of [
  "KIT 6 BODY SPLASH FEMININO INVERSE + AURA + LAVINE EXCLUSIVO",
  "Al Absar Saher Roses Eau de Parfum - Perfume Feminino",
  "Kit Feminino 2 Body Splash Egeo Vanila com gliter 200ml",
]) confere(`feminino: "${t.slice(0, 42)}"`, generoPeloTitulo(t) === "Feminino");

// --- Importado e árabe, que é boa parte do catálogo da Shopee
confere("pour homme", generoPeloTitulo("Lattafa Asad Eau de Parfum Pour Homme 100ml") === "Masculino");
confere("for men", generoPeloTitulo("Armaf Club de Nuit Intense For Men") === "Masculino");
confere("pour femme", generoPeloTitulo("Lattafa Yara Pour Femme") === "Feminino");
confere("for her", generoPeloTitulo("Rasasi Hawas For Her 100ml") === "Feminino");

/*
  ------------------------------------------------------------------
  O QUE ESTE ARQUIVO EXISTE PARA PROTEGER: o null.

  A `onde-paramos` registra um perfume feminino que saiu no canal
  masculino e não pôde ser tirado. Cada caso abaixo é uma forma de isso
  acontecer de novo.
  ------------------------------------------------------------------
*/
console.log("\ncasos em que NÃO se pode chutar\n");

confere("diz os dois: kit masculino e feminino",
  generoPeloTitulo("Kit Perfume Masculino e Feminino Importado 2 unidades") === null);
confere("diz os dois, ordem inversa",
  generoPeloTitulo("Body Splash Feminino + Perfume Masculino Combo") === null);
confere("unissex é explícito, e vale",
  generoPeloTitulo("Perfume Unissex Amadeirado 100ml") === null);
confere("unisex sem acento também",
  generoPeloTitulo("Eau de Parfum Unisex Oud") === null);
confere("infantil não é de nenhum dos dois canais",
  generoPeloTitulo("Perfume Infantil Turma da Monica 100ml") === null);
confere("título que não diz nada",
  generoPeloTitulo("Maison Alhambra Jean Lowe Ombre 100ml") === null);
confere("título vazio", generoPeloTitulo("") === null);
confere("título nulo", generoPeloTitulo(null) === null);
confere("título ausente", generoPeloTitulo(undefined) === null);

console.log("\nacento e caixa não mudam a resposta\n");
confere("MAIÚSCULO", generoPeloTitulo("PERFUME MASCULINO IMPORTADO") === "Masculino");
confere("acentuado", generoPeloTitulo("perfume masculíno") === "Masculino");
confere("misturado", generoPeloTitulo("PeRfUmE FeMiNiNo") === "Feminino");

console.log("\nnão sobrescreve o que veio da API\n");
confere("GENDER do Mercado Livre é preservado",
  atributosComGenero("Perfume Masculino", { GENDER: "Feminino" }) === null);
confere("GENDER vazio conta como ausente",
  atributosComGenero("Perfume Masculino", { GENDER: "" })?.GENDER === "Masculino");
confere("preenche quando não há atributo nenhum",
  atributosComGenero("Perfume Masculino", null)?.GENDER === "Masculino");
confere("mantém os outros atributos",
  atributosComGenero("Perfume Masculino", { BRAND: "Natura" })?.BRAND === "Natura");
confere("título ambíguo não gera atributo",
  atributosComGenero("Kit Masculino e Feminino", null) === null);

/*
  APARELHO DE BARBA e MASCULINO, acrescentado em 10/08: cinco
  barbeadores sairam para o grupo de mulheres antes desta regra.
*/
console.log("\naparelho de barba e produto de homem\n");
confere("barbeador e masculino", generoPeloTitulo("Barbeador Kemei KM-TX1 prateado") === "Masculino");
confere("oneblade e masculino", generoPeloTitulo("Barbeador e Aparador Eletrico Philips OneBlade 2 Pentes") === "Masculino");
confere("aparador de pelos e masculino", generoPeloTitulo("Aparador de Pelos Super Groom 06 Mondial 6W") === "Masculino");
confere("multigroom para barba e masculino", generoPeloTitulo("Barbeador Eletrico 5 em 1 Inova Multigroom, para Barba e Corpo") === "Masculino");

// A metade que protege: depiladora FEMININA nao pode virar masculina.
confere(
  "depiladora feminina continua feminina",
  generoPeloTitulo("Caneta Depiladora Eletrica Feminina Sobrancelha Facial") === "Feminino",
);
confere("batom nao vira masculino", generoPeloTitulo("Batom Matte Vegano Dailus Tom Nude") === null);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
