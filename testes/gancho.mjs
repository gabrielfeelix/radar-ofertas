/**
 * Teste da validação do gancho escrito por IA.
 *
 * POR QUE ISTO EXISTE, e por que é o teste mais importante deste
 * recurso: o gancho é o único pedaço da mensagem que **ninguém deste
 * projeto leu antes de publicar**. Todo o resto é dado do banco ou texto
 * do dono; esta linha vem de um modelo de linguagem, e vai direto ao
 * grupo.
 *
 * Modelo de linguagem inventa número com naturalidade e adora travessão.
 * As duas coisas são regra dura aqui: a 3.4 proíbe afirmação de preço
 * sem lastro, e a 3.11 proíbe travessão no que o público lê. Pedir por
 * favor no prompt não é garantia; o que garante é recusar na saída.
 *
 * Desde 11/08 há um terceiro grupo, e ele é de registro e não de regra:
 * caixa alta em toda linha e as construções que já viraram carimbo
 * (`CHEGA DE`, `AMIGAS, CORRE`) fazem o canal soar como os outros
 * oitenta. Caixa alta é consertada; carimbo é recusado.
 *
 * A regra do teste é a mesma da produção: **na dúvida, nulo**. Post sem
 * gancho é um post bom; post com preço inventado queima o canal.
 */
import { validaGancho } from "../lib/gancho.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\no que tem que passar\n");

confere(
  "gancho bom passa inteiro",
  validaGancho("esse segura o cacho na chuva") === "esse segura o cacho na chuva",
);
confere(
  "emoji composto sobrevive",
  validaGancho("o cabelo de segundo dia resolvido 👱‍♀️") === "o cabelo de segundo dia resolvido 👱‍♀️",
);
confere(
  "vírgula no meio é permitida, é o que substitui o travessão",
  validaGancho("tô usando faz um mês, vim contar") === "tô usando faz um mês, vim contar",
);
confere(
  "o soco em maiúscula sobrevive, porque tem minúscula em volta",
  validaGancho("essa gaveta ficou DECENTE") === "essa gaveta ficou DECENTE",
);

console.log("\no registro: caixa alta na linha inteira é consertada, não recusada\n");

confere(
  "linha inteira em caixa alta vira minúscula",
  validaGancho("CABELO SECO ANTES DO CAFÉ ESFRIAR") === "cabelo seco antes do café esfriar",
);
confere(
  "acento sobrevive ao conserto de caixa",
  validaGancho("ORGANIZA ESSE ARMÁRIO") === "organiza esse armário",
);
confere(
  "uma minúscula já basta para a linha ficar como está",
  validaGancho("cabelo seco em MINUTOS") === "cabelo seco em MINUTOS",
);
confere(
  "emoji não tem caixa e não conta como grito",
  validaGancho("o xixi fora do lugar acabou 🐶") === "o xixi fora do lugar acabou 🐶",
);

console.log("\no que já virou carimbo ou soa velho\n");

confere('"chega de" na abertura reprova, é o carimbo medido', validaGancho("CHEGA DE SOFRER COM SECADOR FRACO") === null);
confere('"amiga" reprova, é vocativo de canal de promoção', validaGancho("achei isso pra você, amiga") === null);
confere('"meninas" reprova', validaGancho("meninas, esse aqui salva o dia") === null);
confere('"corre" reprova, é urgência que não medimos', validaGancho("corre que eu achei isso") === null);
confere('"socorro" reprova', validaGancho("socorro que coisa linda") === null);
confere('"amei" reprova', validaGancho("amei demais esse gloss") === null);
confere('"imperdível" reprova', validaGancho("achado imperdível do dia") === null);
confere('"vai agradecer" reprova, é frase de embalagem', validaGancho("seu cabelo vai agradecer") === null);
confere('"você precisa" reprova', validaGancho("você precisa disso na sua vida") === null);
confere(
  '"chega de" no meio da frase passa, o vício é a abertura',
  validaGancho("guardei tudo e chega de bagunça") === "guardei tudo e chega de bagunça",
);

console.log("\na regra 3.4: nada de promessa de preço\n");

confere("dígito reprova, porque número sobre preço ninguém conferiu", validaGancho("LEVA 3 POR NADA") === null);
confere("R$ reprova", validaGancho("SAI POR R$ DEZ") === null);
confere('"metade do preço" reprova mesmo sem número', validaGancho("SAI PELA METADE DO PREÇO") === null);
confere('"desconto" reprova', validaGancho("DESCONTO ABSURDO NESSE BATOM") === null);
confere('"promoção" reprova', validaGancho("PROMOÇÃO QUE NINGUÉM ESPERAVA") === null);
confere('"barato" reprova', validaGancho("TÁ BARATO DEMAIS ESSE GLOSS") === null);
confere('"off" reprova', validaGancho("BATOM COM OFF ABSURDO") === null);
confere('"grátis" reprova', validaGancho("PARECE ATÉ GRÁTIS ESSE CREME") === null);

console.log("\nnúmero por extenso, o furo que a recusa de dígito deixava\n");

confere(
  "o caso real de 11/08: 36 pacotes viraram sessenta",
  validaGancho("sessenta pacotinhos pra abrir num sábado à noite") === null,
);
confere('"duas" reprova', validaGancho("duas peças pra resolver a bagunça") === null);
confere('"três" reprova', validaGancho("três meses de paz na estante") === null);
confere('"dez" reprova', validaGancho("dez minutos e o armário fecha") === null);
confere('"mil" reprova', validaGancho("mil usos que você não imaginava") === null);
confere('"dúzia" reprova', validaGancho("uma dúzia de motivos pra levar") === null);
confere(
  '"um" passa, porque é artigo antes de ser número',
  validaGancho("um cabo a menos na mesa") === "um cabo a menos na mesa",
);
confere(
  '"meia hora" passa, não é quantidade de produto',
  validaGancho("a sala limpa por meia hora inteira") === "a sala limpa por meia hora inteira",
);
confere(
  "ordinal passa, é cena e não conta",
  validaGancho("o cabelo de segundo dia resolvido") === "o cabelo de segundo dia resolvido",
);
confere(
  '"novembro" não é "nove", a fronteira de palavra segura isso',
  validaGancho("o presente de novembro resolvido") === "o presente de novembro resolvido",
);

console.log("\na regra 3.11: nada de travessão\n");

confere(
  "travessão vira vírgula, e a linha é aproveitada",
  validaGancho("o cacho segura — juro") === "o cacho segura, juro",
);
confere(
  "traço curto (en dash) também vira vírgula",
  validaGancho("acorda pronta – sem esforço") === "acorda pronta, sem esforço",
);
confere("nenhum travessão sobrevive à limpeza", !/[—–]/.test(validaGancho("a — b — c") ?? ""));

console.log("\nlimpeza do que o modelo costuma devolver junto\n");

confere("aspas em volta saem", validaGancho('"organiza esse armário"') === "organiza esse armário");
confere("rótulo na frente sai", validaGancho("Gancho: acorda pronta todo dia") === "acorda pronta todo dia");
confere("ponto final sai", validaGancho("salva esse cabelo.") === "salva esse cabelo");
confere("quebra de linha vira espaço", validaGancho("salva esse\ncabelo") === "salva esse cabelo");
confere("espaço sobrando é normalizado", validaGancho("  salva   esse  cabelo  ") === "salva esse cabelo");

console.log("\no que tem que ser recusado\n");

confere("vazio", validaGancho("") === null);
confere("nulo", validaGancho(null) === null);
confere("indefinido", validaGancho(undefined) === null);
confere("uma palavra só é etiqueta, não gancho", validaGancho("LINDO") === null);
confere(
  "texto comprido demais reprova, gancho de duas linhas não é gancho",
  validaGancho("esse produto aqui é realmente muito bom para quem quer cuidar da pele todo dia") === null,
);
confere("hashtag reprova, colidiria com o #publi da regra 3.10", validaGancho("achado do dia #beleza") === null);
confere("HTML reprova, quebraria o parse_mode do Telegram", validaGancho("olha <b>isso</b>") === null);
confere("link reprova", validaGancho("olha isso https://x.com agora") === null);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
