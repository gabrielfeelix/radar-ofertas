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

/*
  ACENTO, E ELE DERRUBOU A CORRECAO DA MIGRATION 57 SEM NINGUEM VER.

  O regex de la foi escrito sem acento e o catalogo tem acento. Em SQL,
  `~*` e insensivel a MAIUSCULA e nao a acento, entao
  `kit *[1-9][0-9] *(pcs|pecas|pincei)` nunca casou com "Kit 13 Pcs" de
  verdade, que no banco e "Kit 13 Pcs" com c-cedilha. A migration 57
  jamais consertou o titulo que ela propria nomeia.

  Aqui `normaliza` derruba o acento antes, entao os dois casam. Estes
  testes existem para essa diferenca nao voltar calada.
*/
console.log("\nacento\n");
confere("kit de pinceis com acento nao barra",
  !ehSuprimentoProfissional("Kit 13 Pçs Pincéis de Maquiagem Com Bolsa de Veludo"));
confere("o mesmo sem acento tambem nao barra",
  !ehSuprimentoProfissional("Kit 13 Pcs Pinceis de Maquiagem Com Bolsa de Veludo"));

/*
  CONJUNTO DE PECAS DIFERENTES, e a contradicao que existia entre duas
  regras vizinhas: `kit NN` excluia `pecas` com todo cuidado, e a linha
  seguinte marcava qualquer `NN pecas` de novo. A segunda ganhava.

  Medido em 04/08 a noite: nove kits de pincel estavam marcados como
  profissional no catalogo de producao.
*/
console.log("\nconjunto de pecas diferentes\n");
confere("kit 32 pecas de pinceis nao barra",
  !ehSuprimentoProfissional("Kit 32 Peças Conjunto De Pincéis De Maquiagem Para Pó Sombra"));
confere("kit de pincel com 13 unidades nao barra",
  !ehSuprimentoProfissional("Kit Pincel De Maquiagem Com 13 Unidades Sombra Blush"));
confere("kit 15 pinceis de unha nao barra",
  !ehSuprimentoProfissional("Kit 15 Pincéis Decoração De Unhas + 5 Boleadores"));
confere("paleta com kit de pinceis nao barra",
  !ehSuprimentoProfissional("Paleta LABRANCHE Face 46 Cores + Kit 8 Pincéis"));
confere("mas dez caixas de cilios continua barrando",
  ehSuprimentoProfissional("New Show KIT 10 Caixas Cilios Posticos 6D MINK"));
confere("e doze sprays iguais continua barrando",
  ehSuprimentoProfissional("Kit 12 Spray Liso Obrigatorio 200ml Belkit"));
confere("insumo de clinica ganha do conjunto de pecas",
  ehSuprimentoProfissional("Kit Limpeza Extensão de Cílios Com Pump Espumador Pincel"));

/*
  VOLUME SO CONTA EM BELEZA, e isto vivia SO no SQL da migration 56.
  Esta funcao, que e a regra viva dos coletores, continuou marcando
  chaleira de 2,7 L como insumo de salao. Nao gerou post errado porque
  o unico canal que exclui `USO` e o Beauty e panela nao e do nicho
  dele, mas ligar a marcacao no coletor do ML sem isto desfaria as 741
  correcoes daquela migration.
*/
console.log("\nvolume depende do nicho\n");
confere("um litro e meio de shampoo barra quando o volume conta",
  ehSuprimentoProfissional("Kit Absolut Repair Shampoo e Condicionador 1,5L", true));
confere("chaleira de 2,7 L NAO barra quando o volume nao conta",
  !ehSuprimentoProfissional("Chaleira Bule Aluminio C/ Apito Roma Vanilla Brinox 2,7 L", false));
confere("e a mesma chaleira barraria se o volume contasse, que e o defeito antigo",
  ehSuprimentoProfissional("Chaleira Bule Aluminio C/ Apito Roma Vanilla Brinox 2,7 L", true));
confere("agulha barra mesmo com o volume desligado",
  ehSuprimentoProfissional("Agulha Lebel 32g 4mm Caixa Com 100 Unidades", false));
confere("o argumento chega por atributosComUso",
  atributosComUso("Panela De Pressao Inducao Ecoglide 4,2l", null, false) === null);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
