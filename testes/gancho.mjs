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
 * A regra do teste é a mesma da produção: **na dúvida, nulo**. Post sem
 * gancho é um post bom; post com preço inventado queima o canal.
 */
import { validaGancho } from "../lib/gancho.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\no que tem que passar\n");

confere(
  "gancho bom passa inteiro",
  validaGancho("DURA MAIS QUE MUITO RELACIONAMENTO 💋") === "DURA MAIS QUE MUITO RELACIONAMENTO 💋",
);
confere(
  "emoji composto sobrevive",
  validaGancho("CHEGA DE LOIRO GEMA DE OVO 👱‍♀️") === "CHEGA DE LOIRO GEMA DE OVO 👱‍♀️",
);
confere(
  "vírgula no meio é permitida, é o que substitui o travessão",
  validaGancho("SEU FONE TÁ PEDINDO SOCORRO, AMIGA") === "SEU FONE TÁ PEDINDO SOCORRO, AMIGA",
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

console.log("\na regra 3.11: nada de travessão\n");

confere(
  "travessão vira vírgula, e a linha é aproveitada",
  validaGancho("SEU CABELO AGRADECE — JURO") === "SEU CABELO AGRADECE, JURO",
);
confere(
  "traço curto (en dash) também vira vírgula",
  validaGancho("ACORDA PRONTA – SEM ESFORÇO") === "ACORDA PRONTA, SEM ESFORÇO",
);
confere("nenhum travessão sobrevive à limpeza", !/[—–]/.test(validaGancho("A — B — C") ?? ""));

console.log("\nlimpeza do que o modelo costuma devolver junto\n");

confere("aspas em volta saem", validaGancho('"ORGANIZA ESSE ARMÁRIO"') === "ORGANIZA ESSE ARMÁRIO");
confere("rótulo na frente sai", validaGancho("Gancho: ACORDA PRONTA TODO DIA") === "ACORDA PRONTA TODO DIA");
confere("ponto final sai", validaGancho("SALVA ESSE CABELO.") === "SALVA ESSE CABELO");
confere("quebra de linha vira espaço", validaGancho("SALVA ESSE\nCABELO") === "SALVA ESSE CABELO");
confere("espaço sobrando é normalizado", validaGancho("  SALVA   ESSE  CABELO  ") === "SALVA ESSE CABELO");

console.log("\no que tem que ser recusado\n");

confere("vazio", validaGancho("") === null);
confere("nulo", validaGancho(null) === null);
confere("indefinido", validaGancho(undefined) === null);
confere("uma palavra só é etiqueta, não gancho", validaGancho("LINDO") === null);
confere(
  "texto comprido demais reprova, gancho de duas linhas não é gancho",
  validaGancho("ESSE PRODUTO AQUI É REALMENTE MUITO BOM PARA QUEM QUER CUIDAR DA PELE TODO DIA") === null,
);
confere("hashtag reprova, colidiria com o #publi da regra 3.10", validaGancho("ACHADO DO DIA #beleza") === null);
confere("HTML reprova, quebraria o parse_mode do Telegram", validaGancho("OLHA <b>ISSO</b>") === null);
confere("link reprova", validaGancho("CORRE https://x.com AGORA") === null);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
