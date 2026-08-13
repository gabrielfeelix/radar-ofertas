/**
 * O produto é eletrônico se disfarçando de beleza?
 *
 * POR QUE ISTO EXISTE. Em 11/08 o Radar Delas, que é um grupo de
 * mulheres sobre beleza e autocuidado, publicou isto:
 *
 *   Limpador De fone AirPods Higienizador          R$ 24,83
 *
 * A curadoria não errou, e é isso que torna o caso interessante. O
 * caminho inteiro está certo:
 *
 *   Shopee diz         Beauty > Beauty Tools
 *   nicho_dominio diz  SHOPEE-100663 -> beleza
 *   canal aceita       Radar Delas cobre beleza
 *
 * **Quem classifica limpador de AirPods como ferramenta de beleza é a
 * Shopee**, e o nosso mapeamento obedece porque obedecer é o certo na
 * imensa maioria dos casos: `Beauty Tools` também é pincel, esponja,
 * pinça e espelho, que são exatamente o produto-alvo do canal. Cortar a
 * categoria inteira derrubaria o bom junto com o ruim, e foi por isso
 * que a saída escolhida foi o título e não o domínio.
 *
 * O MECANISMO É O MESMO DO `USO` (migration 55) E DO `GENDER`
 * (migration 37): o atributo sai do título, e o canal decide se quer ou
 * não por `canal_atributo`. Nenhuma tabela nova, e a decisão fica sendo
 * dado — o Radar Tech não exclui `TIPO`, então marcar um fone de
 * verdade não custa nada a ele.
 *
 * A MARCAÇÃO É GLOBAL E A EXCLUSÃO É DO CANAL, e a assimetria é de
 * propósito. Um fone marcado como eletrônico no catálogo inteiro não
 * atrapalha ninguém: só o Beauty e o Delas excluem. Se um dia existir
 * canal que queira gadget de beleza, é só não excluir.
 *
 * A LISTA É LITERAL E COVARDE, pela mesma razão de sempre: falso
 * positivo aqui apaga oferta boa em silêncio, e ninguém descobre.
 * `usb` sozinho ficou de fora porque escova alisadora recarregável diz
 * "USB" no título e é produto-alvo do canal.
 */

/** O valor que vai para `produto.atributos.TIPO`. */
export const TIPO_ELETRONICO = "eletronico";

/**
 * O segundo valor: máquina de cortar pelo.
 *
 * POR QUE ELE PRECISOU EXISTIR, e a pergunta do dono em 11/08 é a
 * definição: *"aparador, gilete, etc não entram no grupo de BELEZA né
 * amigão, ele pode até não ser masculino, mas por que um aparador entra
 * no grupo de beleza?"*
 *
 * O que fez o `Aparador De Pelos Supergroom-10 Mondial` chegar lá não
 * foi defeito nenhum: o Mercado Livre o classifica em `Cuidados
 * pessoais` e o nosso nicho `beleza` herda essa árvore. Pela taxonomia
 * está certo. Pelo grupo, não: quem entrou num canal de skincare,
 * cabelo e maquiagem não entrou para ver máquina de barbear.
 *
 * ISTO NÃO É O FILTRO DE GÊNERO, e a diferença importa. `GENDER`
 * resolve o aparador que se declara masculino, e só pega quem declara —
 * em beleza a maioria não declara nada. Aqui o corte é pelo QUE A COISA
 * É, e vale mesmo quando o anúncio é omisso ou diz "sem gênero".
 *
 * O QUE FICA DE FORA, de propósito: depilador, epilador, cera, pinça e
 * lâmina feminina. Depilação é rotina de beleza da persona do canal
 * (`docs/personas-dos-canais.md`), e o `Aparelho Para Depilar Gillette
 * Venus` que já saiu é post bom. A linha é máquina de cortar cabelo e
 * barba, não remoção de pelo.
 */
export const TIPO_BARBEARIA = "barbearia";

function normaliza(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/*
  Aparelho e acessório de informática. Nada disto é beleza em nenhuma
  leitura, e a presença de qualquer um no título já decide.

  Os dois primeiros são os títulos reais que motivaram o arquivo:

    Limpador De fone AirPods Higienizador
    Kit Limpeza Celular Teclado Pc Notebook ... Fone De Ouvido Tablet
*/
const ELETRONICO = [
  "fone",
  "fones",
  "airpods",
  "air pods",
  "headset",
  "headphone",
  "earbud",
  // `celular` NÃO entra aqui. Ver `CELULAR_DE_TELEFONE` logo abaixo.
  "smartphone",
  "iphone",
  "tablet",
  "notebook",
  "laptop",
  "teclado",
  "mouse",
  "monitor",
  "computador",
  "impressora",
  "roteador",
  "pendrive",
  "ssd",
  "hd externo",
  "cabo usb",
  "carregador",
  "power bank",
  "caixa de som",
  "smartwatch",
  "controle remoto",
  "videogame",
  "playstation",
  "xbox",
  "nintendo",
  "drone",
];

/*
  `CELULAR` TEM DOIS SIGNIFICADOS, E EM COSMÉTICO É CÉLULA.

  MEDIDO NA PRÓPRIA MIGRATION 66, minutos depois de aplicá-la: de sete
  produtos marcados, QUATRO eram falso positivo, e todos pelo mesmo
  motivo:

    NIVEA Creme para Mãos Q10 Plus ... Renovação Celular
    Acquaflora Nutrição Celular  Shampoo 300ml
    Acquaflora Nutrição Celular  Condicionador 300ml
    Kit Acquaflora Nutrição Celular Duo

  Nenhum deles tem telefone nenhum. "Nutrição celular" e "renovação
  celular" são copy de cosmético, e o canal de beleza é justamente onde
  essa expressão mais aparece. Marcar esses quatro tirava do Radar Delas
  três produtos que são exatamente o que ele existe para publicar.

  É a mesma armadilha do "litro" que a migration 56 desfez em 741
  linhas: a palavra não é o sinal, a palavra DENTRO DE UM CONTEXTO é.
  Litro num shampoo quer dizer salão e numa panela quer dizer panela;
  celular num creme quer dizer célula e num suporte quer dizer telefone.

  A lista de resgate é literal e cresce com o que aparecer. Errar para o
  lado de deixar passar custa um post de suporte de celular; errar para
  o outro lado apaga a linha de tratamento inteira de uma marca.
*/
const CELULAR_DE_TELEFONE =
  /(?<!\b(?:nutricao|renovacao|regeneracao|reparacao|recuperacao|revitalizacao|oxigenacao|hidratacao|protecao|comunicacao|multiplicacao|divisao|energia|nivel|matriz|atividade|memoria|defesa|acao|estimulo)\s{1,3})\bcelular\b/;

/*
  MÁQUINA DE CORTAR PELO. Ver `TIPO_BARBEARIA` no topo.

  Vem ANTES do resgate de beleza e antes da lista de eletrônico, porque
  é a decisão mais específica das três: `barbeador` e `aparador de
  pelos` estavam justamente no resgate, salvos do filtro de eletrônico,
  e é por ali que eles entravam no canal.

  `gilete` entra pelo nome da marca virada substantivo, que é como o
  título do anúncio escreve. `lamina de barbear` cobre a recarga.
*/
const BARBEARIA_FORTE = [
  "barbear",
  "barbeador",
  "maquina de cortar cabelo",
  "cortador de cabelo",
  "maquina de acabamento",
  "gilete",
  "multigroomer",
  "barba e cabelo",
  "aparador de barba",
  /*
    O QUE FALTAVA, e o que faltou custou um post. Em 13/08, às 10:32, o
    grupo de mulheres recebeu:

      Navalha Profissional Retrátil P/ Desfiar Cabo Inox P/ Barba

    Ele passou por uma distância de duas letras. `barbear` estava na
    lista; `barba` não. "P/ Barba" não casa com "barbear", então a
    decisão caiu para `BARBEARIA_FRACA`, onde `navalha` mora — e ali o
    veredito era barbearia de qualquer jeito. (A causa de o post ter
    saído mesmo assim está em `scripts/publica-automatico.mjs`, na
    reconferência da saída: o produto ESTAVA marcado, e a fila é que
    era velha. Mas a lista também estava frouxa, e as duas coisas
    precisavam de conserto.)

    Palavras do dono: *"ISSO NÃO PODE ACONTECER JAMAIS, revise pra não
    ir NENHUM produto masc, máquina de barbear, máquina de cortar
    cabelo, barbeador, pós-barba, nada disso"*.

    Pós-barba e after shave entram aqui e não em `BARBEARIA_FRACA` de
    propósito: não existe pós-barba de mulher, e não há depilação que os
    desarme.
  */
  "pos barba",
  "pos-barba",
  "posbarba",
  "after shave",
  "aftershave",
  "shaving",
  "shave gel",
  "espuma de barbear",
  "creme de barbear",
  "oleo para barba",
  "balm de barba",
  "escova de barba",
  "pente de barba",
  "kit barba",
  "modelador de barba",
];

/*
  `BARBA` SOZINHA, com fronteira de palavra.

  Ela precisa de regex e não de `includes` porque `barba` mora dentro de
  palavras que não têm nada com isso: `barbante`, `barbatana`,
  `ruibarbo`, e o nome próprio `Bárbara`, que normalizado vira
  `barbara`. Marca de cosmético chamada Bárbara existe, e derrubá-la
  seria o falso positivo que apaga oferta boa em silêncio — exatamente o
  que o resto deste arquivo passa o tempo todo evitando.

  Com a fronteira, "P/ Barba", "para barba" e "barbas" casam, e
  "barbante" não.
*/
const BARBA_SOZINHA = /\bbarbas?\b/;

/*
  O SINAL FRACO, e é ele que a depilação desarma.

  MEDIDO NA PRÓPRIA MIGRATION 71, logo depois de aplicá-la: dos 96
  produtos marcados, seis eram de mulher e entraram por aqui —

    Caneta Depiladora Elétrica Feminina Sobrancelha Facial ... Aparador
    De Pelos Rosto Buço                                    (três cores)
    Depiladora 3 em 1 Recarregável, Aparador de Pelos, Design Íntimo
    KIT 36 Lâminas Sobrancelha e Rosto Navalha Depilação
    KIT 2 NAVALHA + 1 TESOURA PENTE, Kit para aparar sobrancelhas

  "Aparador de pelos" e "navalha" são as duas palavras que a barbearia
  masculina e a depilação feminina usam igual. Sozinhas elas não podem
  decidir, e por isso vivem aqui embaixo, depois do resgate.

  O caso que prova que os dois níveis são necessários: *"Maquina De
  Cortar Cabelo Barbear ... Aparador De Pelos Acabamento Depilador
  Intimo Masculino"* tem `depilador` no título e continua sendo
  barbearia, porque `cortar cabelo` e `barbear` estão no nível de cima.
*/
const BARBEARIA_FRACA = [
  "aparador de pelo",
  "aparador de pelos",
  "aparador cortador",
  "maquina de corte",
  "cortador de pelo",
  "cortador de pelos",
  "lamina de barbear",
  "navalha",
  "trimmer",
  "pelos do nariz",
  "aparador nasal",
];

/*
  DEPILAÇÃO É BELEZA, e desarma o sinal fraco acima.

  A persona do canal (`docs/personas-dos-canais.md`) tira sobrancelha,
  buço e pelo do corpo, e isso é rotina de autocuidado, não barbearia.
  O `Aparelho Para Depilar Gillette Venus` que já saiu é post bom.
*/
const DEPILACAO = [
  "depilad",
  "depilar",
  "depilac",
  "depilat",
  "sobrancelha",
  "epilador",
  "buco",
  "design intimo",
  "venus",
];

/*
  Palavras que devolvem o produto para a beleza mesmo tendo casado
  acima.

  `escova` é a armadilha: "escova de dente elétrica" não é beleza, mas
  "escova secadora", "escova alisadora" e "escova de cabelo" são o
  coração do canal, e nenhuma delas casa com a lista acima. O que
  precisa de resgate é o caso em que a palavra eletrônica aparece
  descrevendo o PRÓPRIO produto de beleza:

    Secador Com Difusor e Cabo USB
    Espelho De Maquiagem Com Suporte Para Celular

  O segundo é justamente o que `docs/personas-dos-canais.md` listou
  como "não é beleza", então ele NÃO é resgatado. O primeiro é, e é por
  isso que a lista de resgate é de produto e não de acessório.
*/
const AINDA_E_BELEZA = [
  "secador",
  "chapinha",
  "prancha de cabelo",
  "modelador de cachos",
  "babyliss",
  "depilador",
  "barbeador",
  "aparador de pelos",
  "escova secadora",
  "escova alisadora",
  "escova rotativa",
];

/**
 * O título indica eletrônico, e não produto de beleza?
 *
 * Devolve `false` no caso duvidoso, que é a mesma covardia deliberada
 * de `ehSuprimentoProfissional`: a regra existe para tirar o que é
 * claramente de outro mundo, não para adivinhar.
 */
export function ehEletronicoEmBeleza(titulo: string | null | undefined): boolean {
  return tipoForaDaBeleza(titulo) === TIPO_ELETRONICO;
}

/**
 * O produto é de um mundo que não é o do canal de beleza? Qual deles?
 *
 * Devolve `null` no caso duvidoso, que é a mesma covardia deliberada de
 * `ehSuprimentoProfissional`: a regra existe para tirar o que é
 * claramente de outro mundo, não para adivinhar.
 *
 * A ORDEM É A REGRA. Barbearia primeiro, porque `barbeador` e `aparador
 * de pelos` moram no resgate de beleza — eles são aparelho de cuidado
 * pessoal de verdade, e era por essa porta que entravam no canal.
 */
export function tipoForaDaBeleza(titulo: string | null | undefined): string | null {
  if (!titulo) return null;
  const t = normaliza(titulo);

  // Barbear e cortar cabelo decidem sozinhos, e nada os desarma.
  if (BARBEARIA_FORTE.some((m) => t.includes(m))) return TIPO_BARBEARIA;
  if (BARBA_SOZINHA.test(t)) return TIPO_BARBEARIA;
  // Depilação desarma o sinal fraco, que a barbearia e ela dividem.
  if (DEPILACAO.some((m) => t.includes(m))) return null;
  if (BARBEARIA_FRACA.some((m) => t.includes(m))) return TIPO_BARBEARIA;

  if (AINDA_E_BELEZA.some((m) => t.includes(m))) return null;
  if (ELETRONICO.some((m) => new RegExp(`\\b${m}\\b`).test(t))) return TIPO_ELETRONICO;
  return CELULAR_DE_TELEFONE.test(t) ? TIPO_ELETRONICO : null;
}

/**
 * Os atributos com `TIPO` preenchido, ou `null` quando não há o que
 * acrescentar.
 *
 * Não sobrescreve um `TIPO` que já exista: se alguém marcou à mão, a
 * mão ganha. É a mesma regra de `atributosComUso`.
 */
export function atributosComTipo(
  titulo: string | null | undefined,
  atuais: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (atuais && typeof atuais.TIPO === "string" && atuais.TIPO.trim() !== "") return null;
  const tipo = tipoForaDaBeleza(titulo);
  if (!tipo) return null;
  return { ...(atuais ?? {}), TIPO: tipo };
}
