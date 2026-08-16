/**
 * OS CINQUENTA MODOS DE ESCREVER A DESCRIÇÃO.
 *
 * POR QUE ESTE ARQUIVO EXISTE, e a medição está em
 * `docs/superpowers/specs/2026-08-15-novo-formato-de-post-design.md`.
 *
 * Em 15/08 rodamos o gerador em dez produtos de beleza de produção. As
 * dez saíram no MESMO modo, a "cena real", e duas eram cópia literal
 * dos exemplos que o próprio prompt dava: pedimos
 * `batom que sobrevive ao almoço` e recebemos, palavra por palavra,
 * `batom que sobrevive ao almoço`.
 *
 * A causa não é o modelo ser ruim, é a instrução. Ela oferecia seis
 * modos e dizia *"1. A CENA REAL, e é o modo mais usado"*. Um modelo de
 * linguagem lê isso e faz o que foi mandado: usa o mais usado, sempre.
 * A lista de `recentes` não corrigia, porque ela manda não repetir a
 * ABERTURA, e o modelo obedecia trocando as palavras e mantendo a
 * forma.
 *
 * A CORREÇÃO É TIRAR A ESCOLHA DO MODELO. O modo é sorteado aqui, no
 * código, e o prompt recebe UM SÓ, com os exemplos daquele e de mais
 * nenhum. O modelo não escolhe entre cinquenta, ele executa um. É a
 * mesma lição que a 3.4 e a 3.11 ensinaram neste projeto: o que vira
 * código é regra, o que fica no prompt é pedido.
 *
 * SÃO CINQUENTA PORQUE OITO NÃO É VARIEDADE. Palavras do dono em 15/08:
 * *"um ser humano se fosse digitar não ia variar entre 8 possibilidades"*.
 *
 * A FAMÍLIA `pessoal` TEM PESO MENOR, e isso responde a uma ressalva
 * dele que estava certa: *"não sei se é legal a gente toda vez estar
 * falando que a gente já usou, vai parecer que é mentira se a gente já
 * usou tudo"*. Um post em cada quatro afirma uso; nos outros a
 * descrição fala do produto, de quem gosta dele, ou convida o grupo.
 */

export type FamiliaDeModo = "pessoal" | "produto" | "publico" | "mundo" | "cena" | "forma";

export type ModoDeDescricao = {
  /** Identificador estável, usado em log e em teste. */
  id: string;
  familia: FamiliaDeModo;
  /** O que o modelo tem que fazer, em uma frase. */
  instrucao: string;
  /**
   * O modo só entra no sorteio se o título casar com isto.
   *
   * NASCEU DE UM DEFEITO QUE ESTE ARQUIVO CRIOU, medido em 15/08 na
   * primeira rodada com os cinquenta modos. Três descrições afirmaram
   * fato que o título não continha:
   *
   *   "tem fórmula hipoalergênica"        num corretivo Payot
   *   "dermato sempre indica esse tipo"   num shampoo a seco
   *   "a carga rende por várias semanas"  num barbeador
   *
   * A variedade melhorou e trouxe junto um risco maior que o tique de
   * relógio: relógio é chato, fato inventado é mentira. O modo
   * `o-ativo` pede o ativo principal, e se o título não nomeia nenhum,
   * o modelo inventa um. A instrução já dizia "só afirme característica
   * que o título garanta", e não bastou, que é a mesma lição de sempre.
   *
   * Sem `exigeNoTitulo` o modo vale para qualquer produto.
   */
  exigeNoTitulo?: RegExp;
  /**
   * Dois exemplos, e nunca mais que isso.
   *
   * Exemplo demais faz o modelo copiar em vez de entender, e foi
   * exatamente o que a medição de 15/08 pegou. Dois dão a forma sem
   * virar gabarito, e `validaGancho` recusa a cópia literal.
   */
  exemplos: [string, string];
};

/**
 * Quanto cada família aparece, em partes.
 *
 * Somam 100 para a conta ser lida sem calculadora. `pessoal` em 25 é o
 * teto que o dono pediu.
 */
export const PESO_DAS_FAMILIAS: Record<FamiliaDeModo, number> = {
  pessoal: 25,
  produto: 25,
  publico: 15,
  mundo: 15,
  cena: 10,
  forma: 10,
};

export const MODOS: ModoDeDescricao[] = [
  // Família A: quem fala usou. É a que tem teto.
  { id: "uso-recente", familia: "pessoal",
    instrucao: "Conte que usou o produto há pouco tempo e gostou.",
    exemplos: [
      "usei esses dias e já não consigo montar o rosto sem ele, virou o primeiro que eu pego",
      "tô usando esse e não troco por nada, ele faz o que promete sem drama",
    ] },
  { id: "uso-prolongado", familia: "pessoal",
    instrucao: "Conte que usa o produto há bastante tempo, sem dizer quanto em número.",
    exemplos: [
      "tô no terceiro pote desse e nem penso em testar outro, já é parte da rotina",
      "esse mora na minha pia faz tempo e nunca me deixou na mão",
    ] },
  { id: "recompra", familia: "pessoal",
    instrucao: "Diga que já comprou o produto de novo depois que acabou.",
    exemplos: [
      "esse eu já repus mais de uma vez, e recompra é o único elogio que não mente",
      "acabou e comprei outro no mesmo dia, nem cheguei a ficar sem",
    ] },
  { id: "comprei-pra-alguem", familia: "pessoal",
    instrucao: "Conte que comprou para outra pessoa da família e ela aprovou.",
    exemplos: [
      "comprei pra minha mãe achando que ela ia enjoar e ela não devolveu mais, virou dela",
      "dei de presente sem muita fé e virou o favorito dela, agora pede sempre",
    ] },
  { id: "tomaram-de-mim", familia: "pessoal",
    instrucao: "Conte, com humor leve, que alguém da casa adotou o seu.",
    exemplos: [
      "deixei na pia por descuido e minha filha adotou, agora é briga toda vez 😅",
      "escondi o meu no armário e mesmo assim sumiu, alguém aqui em casa gostou",
    ] },
  { id: "indicacao-de-quem-entende", familia: "pessoal",
    instrucao: "Diga que uma profissional indicou o produto para você.",
    exemplos: [
      "minha cabeleireira que mandou comprar, e ela nunca indicou nada que não prestasse",
      "foi a dermato que indicou esse, então não é indicação de internet",
    ] },
  { id: "descoberta-acidental", familia: "pessoal",
    instrucao: "Conte que achou o produto sem estar procurando por ele.",
    exemplos: [
      "entrei pra comprar outra coisa, saí com esse no carrinho e não me arrependi",
      "achei sem procurar, testei sem esperar nada e vim contar porque valeu",
    ] },
  { id: "demorei-demais", familia: "pessoal",
    instrucao: "Diga que demorou a comprar e se arrependeu da demora.",
    exemplos: [
      "passei tempo demais sem esse e não sei explicar por quê, devia ter comprado antes",
      "demorei pra ceder ao hype e agora fico pensando no tempo que perdi",
    ] },
  { id: "cetico-convertido", familia: "pessoal",
    instrucao: "Conte que achava que era exagero e mudou de ideia.",
    exemplos: [
      "comprei achando que era exagero da internet, e não era, me calei bonito",
      "não acreditava em nada disso até testar, agora sou a chata que indica",
    ] },
  { id: "voltei-pra-ele", familia: "pessoal",
    instrucao: "Diga que testou outros e voltou para este.",
    exemplos: [
      "testei outros mais caros e voltei pra esse, que resolve igual sem frescura",
      "rodei o mercado inteiro atrás de substituto e parei de procurar quando voltei nele",
    ] },

  // Família B: o que o produto é. Não afirma uso.
  { id: "textura", familia: "produto",
    instrucao: "Descreva a textura do produto, sem dizer que você usou.",
    exemplos: [
      "a textura some na pele e não fica aquela camada pegajosa por cima",
      "é bem leve, quase líquido, então espalha fácil e não pesa no rosto",
    ] },
  { id: "cheiro", familia: "produto",
    exigeNoTitulo: /perfum|fragr[âa]nc|arom|cheiro|floral|amadeirad|baunilha|chocolate|c[íi]tric|sem perfume/i,
    instrucao: "Descreva o cheiro, só se o título garantir qual é.",
    exemplos: [
      "o cheiro é de chocolate com pimenta e é discreto, não enjoa depois de aplicar",
      "tem cheiro suave que não briga com perfume nenhum, some rapidinho",
    ] },
  { id: "formato", familia: "produto",
    instrucao: "Descreva o formato ou a embalagem e o que isso permite fazer.",
    exemplos: [
      "o bastão é fino, então dá pra desenhar antes de esfumar sem borrar tudo",
      "a ponta é chanfrada e encaixa no canto do olho, que é onde sempre erro",
    ] },
  { id: "rendimento", familia: "produto",
    instrucao: "Fale de quanto o produto rende, sem citar número.",
    exemplos: [
      "uma bisnaga dessas dura muito mais do que aparenta, precisa de bem pouquinho",
      "rende demais pro tamanho, uso quase nada por vez e continua cheio",
    ] },
  { id: "como-aplica", familia: "produto",
    instrucao: "Explique como se aplica, em poucas palavras.",
    exemplos: [
      "esfuma com o dedo mesmo, nem precisa de pincel nem de esponja pra ficar bom",
      "é só borrifar e pronto, não precisa enxaguar nem esperar secar",
    ] },
  { id: "o-que-vem-junto", familia: "produto",
    exigeNoTitulo: /kit|com \d|acompanha|\+ ?\d|aplicador|esp[áa]tula|pincel|refil|brinde/i,
    instrucao: "Diga o que acompanha o produto, só se o título garantir.",
    exemplos: [
      "vem com espátula, então não precisa enfiar a mão no pote toda vez",
      "acompanha o aplicador certinho, que é o que costuma faltar nesses",
    ] },
  { id: "acabamento", familia: "produto",
    instrucao: "Descreva o resultado visual que o produto deixa.",
    exemplos: [
      "seca fosco de verdade, sem aquele brilho estranho que fica parecendo oleosidade",
      "fica tão natural que ninguém percebe que tem alguma coisa no rosto",
    ] },
  { id: "o-ativo", familia: "produto",
    exigeNoTitulo: /niacinamida|hialur[ôo]nic|vitamina c|retinol|[áa]cido|colágeno|colagen|argan|r[íi]cino|ceramida|pdrn|mucin|centella|salic[íi]lic|ur[ée]ia|pantenol/i,
    instrucao: "Destaque o ativo principal, só se o título o nomear.",
    exemplos: [
      "é niacinamida de verdade na fórmula, não é só o nome bonito no rótulo",
      "leva ácido hialurônico, que é o que hidrata de fato e não só promete",
    ] },
  { id: "faz-duas-coisas", familia: "produto",
    exigeNoTitulo: /\b\d ?em ?\d\b|com cor|multifuncional|2em1|3em1|primer|kit/i,
    instrucao: "Aponte que o produto resolve duas coisas de uma vez.",
    exemplos: [
      "substitui o primer e o protetor de uma vez, então é um passo a menos",
      "serve de blush e de batom, dá pra sair de casa levando só ele",
    ] },
  { id: "o-que-nao-faz", familia: "produto",
    instrucao: "Diga o defeito comum da categoria que este produto não tem.",
    exemplos: [
      "não marca poro e não craquela depois, que é onde quase todos falham",
      "esse não resseca o canto da boca, dá pra reaplicar sem medo",
    ] },

  // Família C: para quem serve.
  { id: "tipo-de-pele", familia: "publico",
    instrucao: "Diga para qual tipo de pele o produto funciona.",
    exemplos: [
      "quem tem pele oleosa vai gostar desse, ele segura sem deixar aquela sensação de máscara",
      "pele mista aguenta bem, não reseca a bochecha nem deixa a testa brilhando",
    ] },
  { id: "tipo-de-cabelo", familia: "publico",
    instrucao: "Diga para qual tipo de cabelo o produto funciona.",
    exemplos: [
      "cacheada aqui, e esse não pesou nem desmanchou a definição no dia seguinte",
      "cabelo fino aguenta sem murchar, que é a queixa de sempre nesse tipo",
    ] },
  { id: "iniciante", familia: "publico",
    instrucao: "Aponte o produto para quem está começando na categoria.",
    exemplos: [
      "se você tá começando no skincare e se perde na prateleira, é por aqui que começa",
      "esse é bom pra quem nunca usou, não tem erro na aplicação",
    ] },
  { id: "sensivel", familia: "publico",
    exigeNoTitulo: /sens[íi]vel|hipoalerg|sem perfume|neutro|dermatologicamente|vegano|infantil|beb[êe]/i,
    instrucao: "Diga que serve para quem tem pele ou couro sensível, se o título garantir.",
    exemplos: [
      "é sem perfume, então pele sensível aguenta bem sem aquela ardência chata",
      "hipoalergênico de verdade, dá pra arriscar mesmo com pele reativa",
    ] },
  { id: "quem-tem-pressa", familia: "publico",
    instrucao: "Aponte para quem não tem paciência com rotina longa.",
    exemplos: [
      "pra quem não tem paciência de rotina longa, esse resolve sozinho e acabou",
      "resolve rápido, sem etapa nenhuma antes nem depois, e já dá pra sair",
    ] },
  { id: "ja-tentou-tudo", familia: "publico",
    instrucao: "Fale com quem já testou de tudo e não achou.",
    exemplos: [
      "se nenhum funcionou até agora, tenta esse antes de desistir da categoria",
      "pra quem já jogou dinheiro fora tentando resolver isso, esse aqui cumpre",
    ] },
  { id: "pele-madura", familia: "publico",
    instrucao: "Diga que funciona bem em pele madura, sem falar de idade nem de defeito.",
    exemplos: [
      "funciona bem em pele madura, assenta sem craquelar e sem marcar a textura",
      "assenta bonito em pele mais seca, não repuxa nem descasca durante o uso",
    ] },
  { id: "o-homem-da-casa", familia: "publico",
    instrucao: "Conte, com humor, que o produto serve para todo mundo da casa.",
    exemplos: [
      "comprei achando que era pra mim e ele confiscou, agora compro em dobro 😂",
      "acabou virando da casa toda, cada um pega quando quer e some",
    ] },

  // Família D: o que o mundo diz.
  { id: "viral", familia: "mundo",
    instrucao: "Diga que o produto está em toda parte agora.",
    exemplos: [
      "esse é o que tá em todo vídeo agora, e dessa vez o hype tem fundamento",
      "não tem quem não tenha visto esse rolando, virou assunto de todo canto",
    ] },
  { id: "esgotado", familia: "mundo",
    instrucao: "Diga que o produto costuma faltar. Nunca invente urgência sobre o nosso estoque.",
    exemplos: [
      "vive esgotado nas lojas grandes, some da prateleira assim que repõem",
      "some rápido toda vez que aparece, então quem acha costuma levar logo",
    ] },
  { id: "fila-de-espera", familia: "mundo",
    instrucao: "Diga que existe procura grande pelo produto.",
    exemplos: [
      "tem gente esperando repor nas farmácias, a procura por esse não cai nunca",
      "a procura por esse é constante, e não é marketing, é gente pedindo",
    ] },
  { id: "todo-mundo-pergunta", familia: "mundo",
    instrucao: "Diga que as pessoas perguntam qual é o produto quando veem o resultado.",
    exemplos: [
      "todo mundo pergunta qual é o da foto quando vê o resultado de perto",
      "não teve semana que alguém não perguntasse o que eu tava usando",
    ] },
  { id: "o-dupe", familia: "mundo",
    instrucao: "Compare com o importado ou o caro, sem citar preço nem porcentagem.",
    exemplos: [
      "faz o que o importado faz, e quem testou lado a lado não viu diferença",
      "é o parente humilde do famoso e entrega quase tudo que o outro entrega",
    ] },
  { id: "o-que-a-profissional-usa", familia: "mundo",
    instrucao: "Diga que profissionais da área usam este produto.",
    exemplos: [
      "é o que as maquiadoras usam no set, e elas não usam nada por acaso",
      "salão bom trabalha com esse, e isso diz mais que qualquer propaganda",
    ] },
  { id: "queridinho-antigo", familia: "mundo",
    instrucao: "Diga que é um produto antigo que continua funcionando.",
    exemplos: [
      "esse é dos antigos e continua entregando, nunca precisou de reformulação",
      "existe faz tempo, nunca saiu de moda, e é sempre o que sobra na nécessaire",
    ] },
  { id: "indicacao-de-dermato", familia: "mundo",
    exigeNoTitulo: /dermat|facial|pele|skincare|s[ée]rum|protetor solar|acne|hidratante/i,
    instrucao: "Diga que dermatologistas costumam indicar o produto.",
    exemplos: [
      "dermato vive indicando esse, e é dos poucos que aparece em quase toda receita",
      "é dos nomes que sempre saem no consultório, não é achado de internet",
    ] },

  // Família E: a cena, e nenhuma delas marca hora.
  { id: "cabe-na-bolsa", familia: "cena",
    instrucao: "Diga que o produto é fácil de carregar. Não fale de hora nem de duração.",
    exemplos: [
      "cabe no bolso da bolsa e resolve fora de casa sem ocupar espaço nenhum",
      "é pequeno o suficiente pra andar junto e forte o suficiente pra valer a pena",
    ] },
  { id: "viagem", familia: "cena",
    instrucao: "Ligue o produto a viagem. Não fale de hora nem de duração.",
    exemplos: [
      "dá pra levar na mala sem medo de vazar, a tampa fecha firme mesmo",
      "esse é o que eu levo quando viajo, porque resolve várias coisas sozinho",
    ] },
  { id: "calor", familia: "cena",
    instrucao: "Diga como o produto se comporta no calor. Não fale de hora nem de duração.",
    exemplos: [
      "no calor ele não escorre, que é exatamente onde os outros me decepcionaram",
      "aguenta o sol sem virar aquela melequinha que escorre no rosto",
    ] },
  { id: "umidade", familia: "cena",
    instrucao: "Diga como o produto se comporta na chuva ou na umidade. Não fale de hora.",
    exemplos: [
      "segurou o cacho até na garoa, e umidade costuma desmanchar tudo aqui",
      "umidade não desmancha esse, ele mantém o desenho mesmo com o tempo fechado",
    ] },
  { id: "academia", familia: "cena",
    instrucao: "Ligue o produto ao treino. Não fale de hora nem de duração.",
    exemplos: [
      "aguenta o treino sem virar borrão, dá pra sair da academia sem retocar",
      "esse vai comigo pra academia e volta do mesmo jeito que foi",
    ] },
  { id: "retoque", familia: "cena",
    instrucao: "Diga que dá para retocar por cima. Não fale de hora nem de duração.",
    exemplos: [
      "dá pra retocar por cima sem tirar o resto da make, não embola nada",
      "passa por cima do que já tá no rosto e não borra nem craquela",
    ] },
  { id: "problema-resolvido", familia: "cena",
    instrucao: "Nomeie um incômodo que o produto encerra. Não fale de hora nem de duração.",
    exemplos: [
      "acabou a história de dormir de touca pra não perder o cabelo no dia seguinte",
      "resolveu o nó que eu brigava toda vez, agora desembaraça sem arrancar nada",
    ] },

  // Família F: a forma da frase.
  { id: "pergunta-ao-grupo", familia: "forma",
    instrucao: "Faça uma pergunta curta ao grupo sobre o produto.",
    exemplos: [
      "alguém aqui já testou esse? tô namorando faz um tempo e não decidi ainda",
      "quem usa me conta se vale mesmo, porque a fama dele é boa demais",
    ] },
  { id: "veredito-seco", familia: "forma",
    instrucao: "Dê um veredito curtíssimo, sem justificar.",
    exemplos: [
      "esse segura mesmo, e é tudo que eu queria saber antes de comprar",
      "cumpre o que promete e para por aí, o que já é bastante coisa",
    ] },
  { id: "aviso-curto", familia: "forma",
    instrucao: "Avise algo prático sobre o produto, como quem dá um toque.",
    exemplos: [
      "esse acaba mais rápido do que parece, então o aviso fica dado",
      "pega o tom mais claro que o seu, porque ele escurece depois de assentar",
    ] },
  { id: "confissao", familia: "forma",
    instrucao: "Confesse algo pequeno e humano sobre a compra.",
    exemplos: [
      "confesso que comprei pela embalagem e acabei ficando pelo que ele faz",
      "comprei por impulso num dia ruim e foi a melhor compra desse tipo",
    ] },
  { id: "exagero-honesto", familia: "forma",
    instrucao: "Exagere a CENA, nunca o produto. Nada de superlativo de propaganda.",
    exemplos: [
      "guardei os outros que eu tinha e fiquei só com ele, resolveu sozinho",
      "esse aposentou boa parte da minha nécessaire e eu nem senti falta",
    ] },
  { id: "contraste", familia: "forma",
    instrucao: "Contraste a expectativa com o que aconteceu.",
    exemplos: [
      "achei que ia ser mais um parado na gaveta, e não foi, uso direto",
      "esperava pouco e levei susto, é bem melhor do que a embalagem sugere",
    ] },
  { id: "o-soco", familia: "forma",
    instrucao: "Escreva em minúscula com UMA palavra só em maiúscula, no ponto que importa.",
    exemplos: [
      "esse é o BOM mesmo, e olha que eu já testei quase tudo dessa prateleira",
      "a diferença é REAL, dá pra ver no espelho sem precisar procurar",
    ] },
];

/**
 * Sorteia um modo respeitando o peso da família.
 *
 * `aleatorio` entra por parâmetro para o teste ser determinístico. Em
 * produção quem chama passa `Math.random`.
 */
export function sorteiaModo(
  aleatorio: () => number = Math.random,
  titulo = "",
): ModoDeDescricao {
  /*
    O TÍTULO FILTRA O SORTEIO antes do peso, e não depois.

    Sortear primeiro e descartar depois daria posts sem descrição em
    silêncio, sempre nos mesmos produtos. Filtrando antes, todo produto
    tem sorteio cheio dentro do que ele consegue sustentar.
  */
  const possiveis = MODOS.filter((m) => !m.exigeNoTitulo || m.exigeNoTitulo.test(titulo));
  const total = Object.values(PESO_DAS_FAMILIAS).reduce((a, b) => a + b, 0);
  let ponto = aleatorio() * total;

  let escolhida: FamiliaDeModo = "produto";
  for (const [familia, peso] of Object.entries(PESO_DAS_FAMILIAS) as [FamiliaDeModo, number][]) {
    if (ponto < peso) { escolhida = familia; break; }
    ponto -= peso;
  }

  const daFamilia = possiveis.filter((m) => m.familia === escolhida);
  // Família que ficou vazia por causa do título cai no conjunto todo,
  // em vez de devolver sempre o mesmo modo de reserva.
  const alvo = daFamilia.length ? daFamilia : possiveis;
  return alvo[Math.floor(aleatorio() * alvo.length)] ?? MODOS[0];
}

/**
 * Todos os exemplos, para a validação recusar cópia literal.
 *
 * Foi o defeito mais gritante da medição de 15/08 e não havia nada
 * olhando para ele.
 */
export const TODOS_OS_EXEMPLOS: string[] = MODOS.flatMap((m) => m.exemplos);
