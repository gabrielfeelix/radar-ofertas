/**
 * Teste do filtro que tira eletrônico do canal de beleza.
 *
 * O caso que originou o arquivo é o primeiro da lista, e ele saiu no
 * Radar Delas em 11/08. A curadoria não errou: quem chama limpador de
 * AirPods de "Beauty Tools" é a Shopee, e o corte por título é a saída
 * que preserva pincel, esponja e pinça, que são o produto-alvo.
 *
 * A regra do teste é a mesma do `USO`: **na dúvida, deixa passar**.
 * Falso positivo aqui apaga oferta boa em silêncio, e ninguém descobre.
 */
import { ehEletronicoEmBeleza, atributosComTipo, tipoForaDaBeleza, TIPO_ELETRONICO, TIPO_BARBEARIA } from "../lib/eletronico-em-beleza.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\nos títulos reais que motivaram o filtro\n");

confere(
  "limpador de AirPods, o post de 11/08 no Radar Delas",
  ehEletronicoEmBeleza("Limpador De fone AirPods Higienizador") === true,
);
confere(
  "kit de limpeza de celular e teclado",
  ehEletronicoEmBeleza(
    "Kit Limpeza Celular Teclado Pc Notebook Escova Macia Limpa câmera Pincel Limpador Multiuso Fone De Ouvido Tablet",
  ) === true,
);
confere(
  "suporte de celular com espelho, listado em 04/08 como não sendo beleza",
  ehEletronicoEmBeleza("Suporte De Celular Com Espelho De Maquiagem") === true,
);

console.log("\no produto-alvo do canal continua passando\n");

confere("pincel de maquiagem", ehEletronicoEmBeleza("Kit 13 Pçs Pincéis de Maquiagem Com Bolsa") === false);
confere("esponja", ehEletronicoEmBeleza("Esponja De Maquiagem Gota Kit") === false);
confere("pinça", ehEletronicoEmBeleza("Pinça De Sobrancelha Inox Bico Reto") === false);
confere("batom", ehEletronicoEmBeleza("Batom Líquido Matte Longa Duração") === false);
confere("perfume", ehEletronicoEmBeleza("Azzaro Pour Homme Eau De Toilette 100ml") === false);

console.log("\n\"celular\" em cosmético é CÉLULA, e foram 4 falsos positivos em 11/08\n");

confere(
  "Acquaflora Nutrição Celular passa",
  ehEletronicoEmBeleza("Acquaflora Nutrição Celular - Shampoo 300ml") === false,
);
confere(
  "NIVEA Renovação Celular passa",
  ehEletronicoEmBeleza("NIVEA Creme para Mãos Q10 Plus Reparação 75g, Hidratação Antissinais, Renovação Celular") === false,
);
confere("regeneração celular passa", ehEletronicoEmBeleza("Sérum Regeneração Celular Noturno 30ml") === false);
confere("energia celular passa", ehEletronicoEmBeleza("Creme Energia Celular Antioxidante") === false);
confere(
  "suporte de celular continua sendo pego",
  ehEletronicoEmBeleza("Suporte de Celular com Espelho de Maquiagem Ventosa") === true,
);
confere("capa de celular continua sendo pega", ehEletronicoEmBeleza("Capa De Celular Transparente") === true);

console.log("\nmáquina de cortar pelo não é do canal de beleza\n");

confere(
  "o Supergroom real, publicado por engano em 11/08",
  tipoForaDaBeleza("Aparador De Pelos Supergroom-10 Mondial Bivolt Bg-10") === TIPO_BARBEARIA,
);
confere("barbeador elétrico", tipoForaDaBeleza("Barbeador Elétrico Masculino Recarregável") === TIPO_BARBEARIA);
confere("máquina de cortar cabelo", tipoForaDaBeleza("Máquina De Cortar Cabelo Kemei Profissional") === TIPO_BARBEARIA);
confere("gilete", tipoForaDaBeleza("Kit Gilete Mach3 Com 4 Cargas") === TIPO_BARBEARIA);
confere("lâmina de barbear", tipoForaDaBeleza("Lâmina De Barbear Prestobarba Descartável") === TIPO_BARBEARIA);
confere("aparador de pelos do nariz", tipoForaDaBeleza("Aparador Cortador de Pelos 2 em 1 Nariz e Orelha") === TIPO_BARBEARIA);
confere(
  "barbearia ganha do resgate de beleza, que é por onde eles entravam",
  tipoForaDaBeleza("Barbeador Elétrico Com Carregador Usb") === TIPO_BARBEARIA,
);

console.log("\ndepilação continua sendo beleza, e é a persona do canal\n");

confere("depilador feminino", tipoForaDaBeleza("Depilador Elétrico Feminino Recarregável Usb") === null);
confere(
  "a Gillette Venus que já saiu e é post bom",
  tipoForaDaBeleza("Aparelho Para Depilar Suave Sensitive 2 Unid Gillette Venus") === null,
);
confere("cera depilatória", tipoForaDaBeleza("Cera Depilatória Roll On Tutti Depil") === null);
confere("pinça", tipoForaDaBeleza("Pinça De Sobrancelha Inox Bico Reto") === null);

// Os seis falsos positivos reais que a migration 71 marcou por engano,
// achados minutos depois de aplicá-la.
confere(
  "caneta depiladora feminina de sobrancelha, que diz 'aparador de pelos'",
  tipoForaDaBeleza("Caneta Depiladora Elétrica Feminina Sobrancelha Facial Recarregável Usb Portátil Aparador De Pelos Rosto Buço") === null,
);
confere(
  "depiladora de design íntimo",
  tipoForaDaBeleza("Depiladora 3 em 1 Recarregável - Aparador de Pelos, Design Íntimo e Corporal") === null,
);
confere(
  "lâmina de sobrancelha, que diz 'navalha'",
  tipoForaDaBeleza("KIT 36 unidades Lâminas Sobrancelha e Rosto Navalha Depilação") === null,
);
confere(
  "kit de aparar sobrancelha, que diz 'navalha'",
  tipoForaDaBeleza("KIT Tem 2 NAVALHA+1 TESOURA PENTE/Kit para aparar sobrancelhas") === null,
);
confere(
  "e o inverso: 'cortar cabelo' e 'barbear' ganham mesmo com 'depilador' no título",
  tipoForaDaBeleza("Maquina De Cortar Cabelo Barbear Sem Fio Aparador De Pelos Acabamento Depilador Intimo Masculino") === TIPO_BARBEARIA,
);
confere(
  "navalha de barbear continua sendo barbearia",
  tipoForaDaBeleza("Navalhete Navalha Profissional Inox P/ Barbear E Acabamentos") === TIPO_BARBEARIA,
);

console.log("\naparelho de beleza é resgatado, mesmo mencionando eletrônico\n");

confere("secador com cabo USB", ehEletronicoEmBeleza("Secador De Cabelo Profissional Com Cabo Usb") === false);
confere("escova secadora", ehEletronicoEmBeleza("Escova Secadora Rotativa 4 Em 1 Com Carregador") === false);
confere("chapinha", ehEletronicoEmBeleza("Chapinha Prancha Alisadora Bivolt") === false);
confere("depilador elétrico", ehEletronicoEmBeleza("Depilador Elétrico Feminino Recarregável Usb") === false);
confere("barbeador", ehEletronicoEmBeleza("Barbeador Elétrico Masculino Com Carregador") === false);

console.log("\nfronteira de palavra, para não pegar palavra de dentro de outra\n");

confere('"monitorar" não é "monitor"', ehEletronicoEmBeleza("Creme Para Monitorar A Hidratação") === false);
// Buraco conhecido e aceito: `\bfone\b` não casa dentro de "telefone",
// então telefone fixo escapa. Fica assim porque telefone não cai em
// nicho de beleza, e alargar o padrão pegaria "fone" de dentro de
// palavra que não tem nada a ver.
confere('"telefone" escapa, e é o buraco aceito da fronteira de palavra', ehEletronicoEmBeleza("Telefone Sem Fio") === false);
confere("vazio", ehEletronicoEmBeleza("") === false);
confere("nulo", ehEletronicoEmBeleza(null) === false);

console.log("\na marcação do atributo\n");

confere(
  "marca TIPO quando é eletrônico",
  atributosComTipo("Limpador De fone AirPods", null)?.TIPO === TIPO_ELETRONICO,
);
confere(
  "preserva os atributos que já existiam",
  atributosComTipo("Limpador De fone AirPods", { GENDER: "Feminino" })?.GENDER === "Feminino",
);
confere("devolve nulo quando não é eletrônico", atributosComTipo("Batom Matte", null) === null);
confere(
  "não sobrescreve TIPO marcado à mão",
  atributosComTipo("Limpador De fone AirPods", { TIPO: "beleza" }) === null,
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
