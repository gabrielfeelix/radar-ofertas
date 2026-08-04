/**
 * Teste do filtro de suprimento profissional.
 *
 * Os títulos são REAIS, do que o Radar Beauty publicou. O que este
 * arquivo protege é o `false`: tirar oferta boa em silêncio é pior que
 * deixar passar uma caixa de cânula.
 */
import { ehSuprimentoProfissional, atributosComUso } from "../lib/uso-do-produto.ts";

let passou = 0, falhou = 0;
const confere = (n, c) => { if (c) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.error(`✗ ${n}`); } };

console.log("\nsuprimento profissional e atacado\n");
for (const t of [
  "Kit 2 Caixas Microcânula Sc22g 50mm (cx C/10) Smart Gr",
  "Kit 12 Spray Liso Obrigatório 200ml Belkit",
  "Shampoo Expert Pro Longer 1,5L -  L'Oréal",
  "New Show Espelho de Precisão Inox Para Extensão de Cílios",
  "Shampoo Profissional 5 Litros Atacado",
]) confere(`barra: "${t.slice(0, 44)}"`, ehSuprimentoProfissional(t));

console.log("\ncompra normal de quem cuida de si, e NAO pode ser barrada\n");
for (const t of [
  "Gelatina #todecacho Super Definição Salon Line 1 Kg",
  "Kit Widi Care Quarteto Juba (4 Produtos)",
  "Braé Stages Nutrition - Shampoo 250ml",
  "Kit 3 Spray Secante de Esmalte Poupa Meu Tempo Dailus",
  "Creme Multirreparador Cicaplast Baume B5+ La Roche-Posay",
  "Loção hidratante Cetaphil para pele normal a seca x 1 L",
  "Principia, Sérum Facial Retinol, 30ml",
  "Kit Henna Para Sobrancelhas Menela 2,5g Com Fixador 15ml",
  "Shampoo Nutritive 500ml - Yellow",
  "Caixa Presente Sabonete Phebo Amarela - 8 Sabonetes 90g",
  // Os dois falsos positivos que a producao revelou, e que custaram
  // duas migrations. Sao produto-alvo do canal, o pior lugar para errar.
  "Lip Gloss Seringa Brilho Intenso Duradouro Facil Aplicacao",
  "Kit 13 Pcs Pinceis de Maquiagem Com Bolsa de Veludo",
]) confere(`passa: "${t.slice(0, 44)}"`, !ehSuprimentoProfissional(t));

/*
  O QUE ESTE FILTRO DELIBERADAMENTE NÃO PEGA.

  "New Show Sem Aplicador 600 Adesivos Olho Pálpebra Flácida" é atacado
  de verdade, e mesmo assim fica de fora daqui. Para pegá-lo eu
  precisaria de uma regra do tipo "número de três dígitos seguido de
  palavra" — e ela casaria com "Prancha Lizze Profissional 480 Extreme",
  que é número de modelo. Falso positivo apaga oferta boa em silêncio,
  que é o erro caro.

  Ele pertence ao outro problema do canal, que é editorial e não
  mecânico: produto que não é do nicho, e título que aponta defeito no
  corpo de quem lê. Isso é decisão do dono, não regex.
*/
confere("600 adesivos NAO e pego por este filtro, e esta certo",
  !ehSuprimentoProfissional("New Show Sem Aplicador 600 Adesivos Olho Palpebra Flacida"));

console.log("\nbordas\n");
confere("titulo vazio nao barra", !ehSuprimentoProfissional(""));
confere("titulo nulo nao barra", !ehSuprimentoProfissional(null));
confere("kit pequeno nao barra", !ehSuprimentoProfissional("Kit 4 Esmaltes"));
confere("kit grande de PECAS diferentes nao barra", !ehSuprimentoProfissional("Kit 24 Pcs Pinceis"));
confere("kit grande do MESMO item barra", ehSuprimentoProfissional("Kit 24 Spray Fixador"));
confere("agulha continua barrando", ehSuprimentoProfissional("Cartucho Derma Pen 12 Agulhas"));
confere("500ml nao barra", !ehSuprimentoProfissional("Shampoo 500ml"));
confere("atributo so nasce quando barra", atributosComUso("Shampoo 250ml", null) === null);
confere("atributo nasce quando e profissional", atributosComUso("Kit 12 Spray", null)?.USO === "profissional");
confere("nao sobrescreve o que ja existe", atributosComUso("Kit 12 Spray", { USO: "pessoal" }) === null);
confere("mantem os outros atributos", atributosComUso("Kit 12 Spray", { GENDER: "Feminino" })?.GENDER === "Feminino");

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
