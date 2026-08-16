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
  validaGancho("essa gaveta finalmente ficou DECENTE depois que ele chegou") === "essa gaveta finalmente ficou DECENTE depois que ele chegou",
);

console.log("\no registro: caixa alta na linha inteira é consertada, não recusada\n");

confere(
  "linha inteira em caixa alta vira minúscula",
  validaGancho("CABELO SECO ANTES DO CAFÉ ESFRIAR") === "cabelo seco antes do café esfriar",
);
confere(
  "acento sobrevive ao conserto de caixa",
  validaGancho("ORGANIZA ESSE ARMÁRIO DE UMA VEZ POR TODAS") === "organiza esse armário de uma vez por todas",
);
confere(
  "uma minúscula já basta para a linha ficar como está",
  validaGancho("o cabelo fica sequinho em MINUTOS e sem frizz nenhum") === "o cabelo fica sequinho em MINUTOS e sem frizz nenhum",
);
confere(
  "emoji não tem caixa e não conta como grito",
  validaGancho("o xixi fora do lugar acabou 🐶") === "o xixi fora do lugar acabou 🐶",
);

console.log("\no que já virou carimbo ou soa velho\n");

confere('"chega de" na abertura reprova, é o carimbo medido', validaGancho("CHEGA DE SOFRER COM SECADOR FRACO") === null);
confere('"amiga" reprova, é vocativo de canal de promoção', validaGancho("achei isso pra você, amiga, e vim correndo contar aqui") === null);
confere('"meninas" reprova', validaGancho("meninas, esse aqui salva o dia") === null);
confere('"corre" reprova, é urgência que não medimos', validaGancho("corre que eu achei isso e não vai durar muito") === null);
confere('"socorro" reprova', validaGancho("socorro que coisa linda, não consigo parar de olhar isso") === null);
/*
  `amei` PASSOU A PASSAR em 15/08, e o teste inverteu de propósito.

  Ele entrou na blocklist em 11/08 como superlativo de anúncio. Em
  15/08 o dono aprovou cinco descrições escritas à mão, e uma delas
  era *"esse blush eu amei"*: a lista estava barrando justamente o
  registro que ele quer. `arrasou`, `top` e `imperdível` continuam
  barrados, porque são de locutor e não de pessoa.
*/
confere('"amei" agora passa, é como o dono fala', validaGancho("esse blush eu amei, esfuma com o dedo") !== null);
confere('"imperdível" reprova', validaGancho("achado imperdível do dia pra quem tava esperando esse aqui") === null);
confere('"vai agradecer" reprova, é frase de embalagem', validaGancho("seu cabelo vai agradecer demais quando você começar a usar") === null);
confere('"você precisa" reprova', validaGancho("você precisa disso na sua vida") === null);
confere(
  '"chega de" no meio da frase passa, o vício é a abertura',
  validaGancho("guardei tudo e chega de bagunça") === "guardei tudo e chega de bagunça",
);

console.log("\nnojeira e comentário sobre o corpo de quem lê\n");

confere(
  "o caso real de 11/08: craca reprova",
  validaGancho("tira a craca do fone sem drama") === null,
);
confere(
  "o outro caso real: melecada reprova",
  validaGancho("passou no teste do travesseiro sem acordar melecada") === null,
);
confere(
  '"preenchimento" reprova, é o BOCA DE RICA de 10/08',
  validaGancho("boca de rica sem precisar de preenchimento") === null,
);
confere('"catarro" reprova', validaGancho("limpa o catarro do umidificador sem você precisar encostar a mão") === null);
confere('"sebo" reprova', validaGancho("controla o sebo desde a primeira semana") === null);
confere('"encardido" reprova', validaGancho("tira o encardido do uniforme escolar sem esfregar por horas") === null);
confere('"celulite" reprova', validaGancho("celulite que some no espelho depois de algumas semanas usando") === null);
confere('"barriga" reprova', validaGancho("segura a barriga na foto sem marcar nada por baixo") === null);
confere('"rugas" reprova', validaGancho("menos rugas em uma semana só de passar antes de dormir") === null);
confere('"espinha" reprova', validaGancho("seca a espinha antes do encontro") === null);
confere(
  "o mesmo produto dito pelo resultado passa",
  validaGancho("pele descansada logo de manhã sem precisar de corretivo nenhum") === "pele descansada logo de manhã sem precisar de corretivo nenhum",
);
confere(
  '"gordura" passa, porque produto de limpeza tira gordura de fogão',
  validaGancho("a gordura do fogão saiu sem esfregar") === "a gordura do fogão saiu sem esfregar",
);

console.log("\na regra 3.4: nada de promessa de preço\n");

confere("dígito reprova, porque número sobre preço ninguém conferiu", validaGancho("LEVA 3 POR NADA e ainda sobra pro mês seguinte") === null);
confere("R$ reprova", validaGancho("SAI POR R$ DEZ e vale muito mais que isso") === null);
confere('"metade do preço" reprova mesmo sem número', validaGancho("SAI PELA METADE DO PREÇO nessa semana que passou") === null);
confere('"desconto" reprova', validaGancho("DESCONTO ABSURDO NESSE BATOM que todo mundo tava querendo") === null);
confere('"promoção" reprova', validaGancho("PROMOÇÃO QUE NINGUÉM ESPERAVA nesse produto aqui do canal") === null);
confere('"barato" reprova', validaGancho("TÁ BARATO DEMAIS ESSE GLOSS e eu não acredito nisso") === null);
confere('"off" reprova', validaGancho("BATOM COM OFF ABSURDO e vale demais o que custa") === null);
confere('"grátis" reprova', validaGancho("PARECE ATÉ GRÁTIS ESSE CREME e vale demais o que custa") === null);

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
  validaGancho("o presente de novembro resolvido e vale demais o que custa") === "o presente de novembro resolvido e vale demais o que custa",
);

console.log("\na regra 3.11: nada de travessão\n");

confere(
  "travessão vira vírgula, e a linha é aproveitada",
  validaGancho("o cacho segura — juro e vale demais o que custa") === "o cacho segura, juro e vale demais o que custa",
);
confere(
  "traço curto (en dash) também vira vírgula",
  validaGancho("acorda pronta – sem esforço e vale demais o que custa") === "acorda pronta, sem esforço e vale demais o que custa",
);
confere("nenhum travessão sobrevive à limpeza", !/[—–]/.test(validaGancho("a — b — c e vale demais o que custa") ?? ""));

console.log("\nlimpeza do que o modelo costuma devolver junto\n");

confere("aspas em volta saem", validaGancho('"organiza esse armário de uma vez"') === "organiza esse armário de uma vez");
confere("rótulo na frente sai", validaGancho("Gancho: acorda pronta todo dia e vale demais o que custa") === "acorda pronta todo dia e vale demais o que custa");
confere("ponto final sai", validaGancho("salva esse cabelo e resolve o frizz.") === "salva esse cabelo e resolve o frizz");
confere("quebra de linha vira espaço", validaGancho("salva esse\ncabelo e vale demais o que custa") === "salva esse cabelo e vale demais o que custa");
confere("espaço sobrando é normalizado", validaGancho("  salva   esse  cabelo   e vale demais o que custa") === "salva esse cabelo e vale demais o que custa");

console.log("\no que tem que ser recusado\n");

confere("vazio", validaGancho("") === null);
confere("nulo", validaGancho(null) === null);
confere("indefinido", validaGancho(undefined) === null);
/*
  O PISO SUBIU DE DUAS PARA SEIS PALAVRAS em 16/08, quando isto virou
  descrição. `olheiras sumiram sem precisar de corretivo` tinha seis e
  o dono achou pequeno demais; abaixo disso não é descrição nenhuma.
*/
confere("uma palavra só é etiqueta, não descrição", validaGancho("LINDO") === null);
confere("cinco palavras ainda é pouco para descrição", validaGancho("esse blush é muito bom") === null);
confere("seis palavras é o piso e passa", validaGancho("esse blush é muito bom mesmo") !== null);
/*
  O TETO SUBIU DE 60 PARA 140 em 15/08.

  Enquanto isto era uma linha de impacto acima do produto, 60 era o
  certo. Virou a descrição de uma ou duas frases abaixo do título, e
  uma frase de oitenta caracteres passou a ser o normal, não o excesso.
*/
confere(
  "duas frases cabem no teto novo",
  validaGancho("esfuma com o dedo e não marca poro, e ainda fica natural") !== null,
);
/*
  E ESTA CONTINUA REPROVANDO, o que é uma tensão viva e não um descuido.

  *"já comprei dois tons"* estava na descrição do blush que o dono
  aprovou em 15/08, e `NUMERO_POR_EXTENSO` a recusa por causa do "dois".
  A regra existe porque um "sessenta pacotinhos" inventado escapou em
  11/08, e ela não sabe distinguir número sobre a COMPRA de número sobre
  o PRODUTO. Fica recusando: o custo é uma frase boa a menos, e afrouxar
  custaria a única defesa que temos contra quantidade inventada.
*/
confere(
  "número por extenso continua reprovando, mesmo em frase boa",
  validaGancho("esfuma com o dedo e já comprei dois tons") === null,
);
confere(
  "acima de 140 continua reprovando, aí vira parágrafo",
  validaGancho("a".repeat(60) + " " + "b".repeat(90)) === null,
);
confere("hashtag reprova, colidiria com o #publi da regra 3.10", validaGancho("achado do dia #beleza e vale demais o que custa") === null);
confere("HTML reprova, quebraria o parse_mode do Telegram", validaGancho("olha <b>isso</b> e vale demais o que custa") === null);
confere("link reprova", validaGancho("olha isso https://x.com agora e vale demais o que custa") === null);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
