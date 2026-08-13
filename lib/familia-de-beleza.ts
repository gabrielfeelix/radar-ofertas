/**
 * A família do produto de beleza, para a fila revezar de verdade.
 *
 * POR QUE ISTO EXISTE. Em 13/08 o dono olhou o grupo do WhatsApp e
 * descreveu o que via:
 *
 *   *"tem muita coisa cara, não estão enviando coisas legais tipo
 *   máscara facial coreana, produtos coreanos... não tem muita coisa
 *   legal, só secador, produto caro. É BOM QUE TENHA CARO E TEM QUE TER
 *   SIM, mas tem que revezar: às vezes um gloss, às vezes hidratante,
 *   protetor, coisa que mulher gosta e COMPRA VÁRIAS VEZES."*
 *
 * E as últimas sessenta publicações do canal dão razão a ele:
 *
 *   08-13 13:12  R$ 231  Secador De Cabelos Taiff Black Íon 2000w
 *   08-13 12:49  R$ 691  Kit Wella Professionals Invigo Nutri-Enrich
 *   08-13 12:24  R$ 229  Escova Secadora Alisadora Volumizadora Philco
 *   08-12 23:54  R$ 399  Secador Philco psc3500 4 Em 1
 *   08-12 23:02  R$ 379  Secador Philco psc3500 4 Em 1     (o MESMO)
 *
 * A INTERCALAÇÃO JÁ EXISTIA E NÃO ESTAVA FAZENDO NADA, e este arquivo é
 * a razão. `lib/variedade.ts` reveza por `grupo`, e quem chamava passava
 * `produto.nicho_id`. Num canal de nicho único — e o Radar Delas é
 * inteirinho `beleza` — esse grupo é CONSTANTE. A assinatura virava só
 * a faixa de preço, e três secadores de R$ 229, R$ 231 e R$ 399 caem em
 * duas faixas: nada a revezar, sai tudo em fila.
 *
 * O eixo certo dentro de um canal de nicho único não é o nicho, é o que
 * a pessoa entende por "outra coisa": secador não é sérum, gloss não é
 * shampoo. É isso que este arquivo devolve.
 *
 * ISTO NÃO É CURADORIA E NÃO PODE VIRAR, pela mesma regra que
 * `lib/variedade.ts` já carrega: a família só decide a ORDEM. Nada é
 * descartado, nada muda de nota, e o conjunto publicado no fim do dia é
 * exatamente o mesmo. Secador continua saindo — o dono foi explícito
 * ("é bom que tenha caro e tem que ter sim") —, só para de sair três
 * seguidos.
 *
 * POR ISSO A LISTA AQUI É GENEROSA, e é a diferença exata para
 * `lib/eletronico-em-beleza.ts`, que é literal e covarde de propósito.
 * Lá o falso positivo APAGA uma oferta em silêncio, e o custo é alto.
 * Aqui o falso positivo só troca a posição de um post na fila: chutar
 * "maquiagem" para um produto de skincare custa uma alternância errada,
 * e nunca um post perdido. Errar barato permite ser abrangente.
 */

function normaliza(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * As famílias, e a ORDEM DELAS É A REGRA.
 *
 * Cada título casa com a primeira família cuja lista bater, então o mais
 * específico vem primeiro. As armadilhas que ditaram esta ordem:
 *
 *   "mascara"   sozinha é de cílios, facial ou capilar — três famílias
 *               diferentes. Só a expressão inteira decide, nunca a
 *               palavra.
 *   "escova"    é secadora (aparelho), de cabelo (acessório) ou de
 *               dente. `escova secadora` vem antes de `escova`.
 *   "sabonete"  é de rosto ou de banho, e o rosto vem antes.
 *   "oleo"      é capilar, corporal ou essencial. `oleo capilar` antes
 *               de `oleo corporal`, e nenhum dos dois é `oleo` puro.
 *
 * A APARELHAGEM DE CABELO É A PRIMEIRA de todas, e não por acaso: ela é
 * a família que estava monopolizando o grupo, e é a que mais tem outro
 * nome no título ("escova rotativa", "modelador", "prancha"). Separá-la
 * cedo é o que faz o revezamento aparecer.
 */
const FAMILIAS: Array<{ familia: string; termos: string[]; exceto?: string[] }> = [
  {
    // O aparelho caro, que é o que estava saindo em sequência.
    familia: "cabelo-eletro",
    termos: [
      "secador",
      "escova secadora",
      "escova alisadora",
      "escova rotativa",
      "escova modeladora",
      "chapinha",
      "prancha",
      "alisador",
      "modelador de cachos",
      "modelador de cacho",
      "modelador de cabelo",
      "modelador automatico",
      "babyliss",
      "difusor",
      "ondulador",
      "touca termica",
    ],
    /*
      ROUPA MODELADORA NÃO É APARELHO DE CABELO, e foi o que "modelador"
      solto trouxe quando `prancha` e `alisador` foram encurtados em
      13/08: "Cinta Modeladora Abdominal" e "Bermuda Modeladora Trifil"
      estavam os dois na fila do canal. `exceto` desarma a família
      inteira, que é o certo — nenhuma das duas é cabelo de forma
      nenhuma, e a busca deve seguir adiante.
    */
    exceto: ["cinta modelador", "bermuda modelador", "calcinha modelador", "body modelador"],
  },
  {
    familia: "depilacao",
    termos: [
      "depilad",
      "depilat",
      "depilac",
      "depilar",
      "epilador",
      "cera quente",
      "lamina de barbear",
      "navalha",
      "gilete",
      "barbeador",
      "aparador de pelo",
    ],
  },
  {
    familia: "cilios-sobrancelha",
    termos: [
      "cilios",
      "cilios posticos",
      "extensao de cilios",
      "henna",
      "sobrancelha",
      "pinca",
      "curvex",
      "micropigmentacao",
    ],
    /*
      MÁSCARA DE CÍLIOS É MAQUIAGEM, e é o caso que obrigou `exceto` a
      existir. "cílios" está aqui porque cílios postiço e extensão são
      outra prateleira e outro momento de compra; mas rímel é
      maquiagem de todo dia, e ele carrega a palavra "cílios" no nome.
      Sem esta linha, todo rímel do canal era classificado como
      alongamento de cílios.
    */
    exceto: ["mascara de cilios", "mascara para cilios", "rimel"],
  },
  {
    familia: "unha",
    termos: [
      "esmalte",
      "unha",
      "unhas",
      "manicure",
      "pedicur",
      "cuticula",
      "alicate",
      "gel builder",
      "gel construtor",
      "nails",
      "lixa de unha",
      "acrigel",
    ],
  },
  {
    /*
      K-BEAUTY TEM FAMÍLIA PRÓPRIA, e não é preciosismo.

      Ela morava dentro de `skincare` desde a manhã de 13/08, e ali ela
      NUNCA GANHA VEZ: skincare é a segunda maior família do canal, e o
      revezamento entrega uma vaga por rodada à família inteira. Um
      COSRX entrando num balde de 145 sérruns brasileiros sai uma vez a
      cada tanto, por sorteio.

      Com família própria ele passa a ter a PRÓPRIA vaga no rodízio, que
      é o mesmo mecanismo que tirou o secador da monocultura. O dono
      pediu isso em 13/08 pensando no grupo, não no código: *"esses
      produtinhos coreanos... se for alguma coisa meio uau, é legal a
      gente destacar que é coreano"*.

      A lista sai da pesquisa do mesmo dia, e as marcas são as que a
      imprensa de beleza brasileira lista como as que chegaram aqui:
      COSRX, Beauty of Joseon, SKIN1004, Medicube, Anua, Round Lab,
      Abib, Innisfree, mais as de maquiagem TIRTIR, 3CE e CLIO. Os
      ingredientes entram junto porque é assim que o vendedor sem marca
      anuncia: "sérum de mucina de caracol" vende sem dizer a marca.

      Vem ANTES de skincare porque quase todo produto daqui também é
      skincare, e a família mais específica tem que decidir primeiro.
    */
    familia: "k-beauty",
    termos: [
      "coreano",
      "coreana",
      "k-beauty",
      "kbeauty",
      "cosrx",
      "some by mi",
      "beauty of joseon",
      "anua",
      "skin1004",
      "mediheal",
      "medicube",
      "laneige",
      "innisfree",
      "missha",
      "torriden",
      "round lab",
      "isntree",
      "purito",
      "tocobo",
      "numbuzin",
      "abib",
      "tirtir",
      "3ce",
      "etude house",
      // O ingrediente, que é como o anúncio sem marca escreve.
      "mucina de caracol",
      "snail mucin",
      "centella asiatica",
      "cica creme",
      "sheet mask",
      "mascara de tecido",
      "essencia facial",
      "glass skin",
    ],
  },
  {
    // Skincare vem antes de maquiagem porque "base" e "po" são palavras
    // curtas de maquiagem que aparecem dentro de frase de skincare.
    familia: "skincare",
    termos: [
      "serum",
      "hidratante facial",
      "locao facial",
      "creme facial",
      "protetor solar",
      "filtro solar",
      "acido hialuronico",
      "acido salicilico",
      "acido glicolico",
      "niacinamida",
      "vitamina c",
      "retinol",
      "agua micelar",
      "sabonete facial",
      "gel de limpeza",
      "esfoliante facial",
      "mascara facial",
      "mascara de argila",
      "tonico facial",
      "hidratante para o rosto",
      "antirrugas",
      "antienvelhecimento",
      "skincare",
      "area dos olhos",
      "creme para olheiras",
      "cerave",
      "principia",
      "sallve",
      "creamy",
      "cicaplast",
      // O coreano saiu daqui em 13/08 à noite e virou família própria,
      // logo acima. O porquê está lá.
    ],
    /*
      SÉRUM CAPILAR NÃO É SKINCARE, e este `exceto` conserta um erro que
      estava inflando a conta de skincare do canal. Skincare é lida
      ANTES de `cabelo-quimica` de propósito (a nota logo acima explica
      por quê), e "serum" é termo dela. Só que "L'Oréal Elseve Collagen
      Lifter Leave-in Sérum Capilar" e "Braé Divine Sérum Reparador
      Capilar 60ml" são cabelo, e os dois estavam contados como
      skincare na fila de 13/08.

      A palavra que decide é sempre a mesma: título de beleza que diz
      "capilar", "cabelo" ou "fios" está falando de cabelo, seja qual
      for o resto do nome.
    */
    exceto: ["capilar", "cabelo", "para os fios", "dos fios"],
  },
  {
    familia: "maquiagem",
    termos: [
      "batom",
      "gloss",
      "base liquida",
      "base matte",
      "corretivo",
      "po compacto",
      "po solto",
      "blush",
      "iluminador",
      "delineador",
      "sombra",
      "paleta",
      "primer",
      "mascara de cilios",
      "rimel",
      "contorno",
      "cushion",
      "bronzer",
      "lapis de olho",
      "lapis olho",
      "lapis para olhos",
      "lapis labial",
      "esfumador",
      "sace lady",
      "quem disse",
      "boca rosa",
      "bruna tavares",
      "kiko milano",
      "maquiagem",
      "ruby rose",
      "sace lady",
      "oceane",
      "payot",
      "mari maria",
    ],
  },
  {
    // O consumível de cabelo, que é o que a persona recompra.
    familia: "cabelo-quimica",
    termos: [
      "shampoo",
      "condicionador",
      "condicinador",
      /*
        "CAPILAR" É O TERMO QUE FALTAVA, e sozinho ele resolveu boa
        parte do balde sem-família de 13/08: "Tônico Capilar",
        "Densidade Acidificante Capilar", "Óleos Capilar Quartzo Shine",
        "Perfume Capilar". A lista tinha `oleo capilar` no singular e o
        título do anúncio dizia "Óleos Capilar" — casar por expressão
        exata falha em plural, e a palavra que nunca falha é esta.
      */
      "capilar",
      "mascara de tratamento",
      "mascara de nutricao",
      "mascara de hidratacao",
      "mascara de reconstrucao",
      "mascara acidificante",
      "mascara antifrizz",
      "mascara matizadora",
      "mascara para cabelo",
      "leave in",
      "leave-in",
      "finalizador",
      "creme para pentear",
      "creme de pentear",
      "ativador de cachos",
      "gelatina",
      "geleia seladora",
      "desembaracante",
      "hair spray",
      "spray liso",
      "antifrizz",
      "anti frizz",
      "progressiva",
      "matizador",
      "tonalizante",
      "coloracao",
      "tintura",
      "reconstrutor",
      "cronograma capilar",
      "antiqueda",
      "low poo",
      "no poo",
      "perfume capilar",
      "protetor termico",
      /*
        A MARCA DE SALÃO, que é o que sobrava sem classificação.

        Depois das correções acima, o balde sem-família da fila do Radar
        Delas ainda tinha 230 itens, e a varredura deles em 13/08 achou
        um padrão só: são todos de cabelo, e todos escritos do jeito que
        o salão escreve. "Máscara Invigo Color Brilliance 500ml",
        "Infusão 2.0 Acidificante Condicionante", "OSIS Mess Up 100ml",
        "Kit Redken Extreme Duo", "Rapunzel Lola Cosmetics". Não há
        substantivo genérico que os alcance: o que eles têm em comum é a
        MARCA.

        Isto é o oposto do que a lista de `lib/marca-de-beleza.ts` faz, e
        de propósito. Lá a marca decide a ORDEM e cabelo ficou de fora
        para não reforçar quem já domina. Aqui ela decide só a FAMÍLIA, e
        reconhecer o cabelo como cabelo é o que impede que ele reveze
        consigo mesmo disfarçado de "sem-família" — que é exatamente o
        defeito que sobrou depois do commit da manhã.

        `mascara` solta pode vir por último aqui porque as três outras
        máscaras já foram decididas antes: a de cílios em `maquiagem`, a
        facial e a de argila em `skincare`.
      */
      "wella",
      "cadiveu",
      "widi care",
      "brae",
      "alfaparf",
      "professionnel",
      "kerastase",
      "keune",
      "truss",
      "joico",
      "redken",
      "schwarzkopf",
      "bio extratus",
      "salon line",
      "felps",
      "lola cosmetics",
      "amend",
      "haskell",
      "acquaflora",
      "k.pro",
      "belkit",
      "phytomanga",
      "elseve",
      "inoar",
      "forever liss",
      "novex",
      "skala",
      "seda",
      "pantene",
      "tresemme",
      "igora",
      "nutrindo os fios",
      "mascara",
    ],
  },
  {
    familia: "perfumaria",
    termos: [
      "perfume",
      "body splash",
      "colonia",
      "eau de parfum",
      "eau de toilette",
      "deo colonia",
      "desodorante",
    ],
  },
  {
    familia: "corpo-banho",
    termos: [
      "hidratante corporal",
      "locao corporal",
      "oleo corporal",
      "creme para maos",
      "creme para as maos",
      "creme para os pes",
      "sabonete",
      "esfoliante corporal",
      "manteiga corporal",
      "creme corporal",
      "ureia",
      "redutor de medidas",
      "celulite",
      "estrias",
      "talco",
      "banho",
      "hidratante",
      "locao",
    ],
  },
  {
    // Por último porque é o que sobra: pincel, espelho, necessaire.
    familia: "acessorio",
    termos: [
      "pincel",
      "esponja",
      "espelho",
      "necessaire",
      "maleta",
      "pente",
      // Sem "de cabelo": o título real é "Escova Profissional de Cabelo
      // ENLACE" e "Escova Flex de Fitagem", e nenhum dos dois contém a
      // expressão inteira. A escova ELÉTRICA já foi capturada lá em
      // cima, em `cabelo-eletro`, que é lida primeiro.
      "escova",
      "touca",
      "faixa de cabelo",
      "bobs",
      "modelador de bob",
      "organizador de maquiagem",
    ],
  },
];

/**
 * A qual família de beleza este título pertence, ou `null`.
 *
 * `null` não é erro: é título que nenhuma lista reconheceu, e quem
 * chama trata todos os `null` como uma família só ("sem-familia"). O
 * pior que acontece é o produto desconhecido revezar com outro produto
 * desconhecido, que é o comportamento de antes.
 */
export function familiaDeBeleza(titulo: string | null | undefined): string | null {
  if (!titulo) return null;
  const t = normaliza(titulo);

  for (const { familia, termos, exceto } of FAMILIAS) {
    // `exceto` desarma a família inteira, e não só o termo que casou:
    // um rímel não é cílios postiço nem de longe, então a família
    // toda está errada para ele e a busca deve seguir adiante.
    if (exceto?.some((termo) => t.includes(termo))) continue;
    if (termos.some((termo) => t.includes(termo))) return familia;
  }
  return null;
}

/**
 * O eixo de revezamento de uma publicação, seja qual for o nicho.
 *
 * Canal de nicho único (beleza) reveza por família; canal que mistura
 * nichos continua revezando por nicho, que é o que sempre funcionou lá.
 * Passar os dois juntos é o que faz a mesma função servir aos nove
 * canais sem `if` de canal espalhado pelo publicador.
 *
 * O nicho entra na chave mesmo quando há família porque família é texto
 * livre do título: "sabonete" existe em beleza e em pet, e sem o nicho
 * na chave um shampoo de cachorro revezaria com um shampoo de gente
 * como se fossem a mesma coisa.
 */
export function eixoDeVariedade(
  nichoId: string | null | undefined,
  titulo: string | null | undefined,
): string {
  const nicho = nichoId ?? "sem-nicho";
  const familia = familiaDeBeleza(titulo);
  return familia ? `${nicho}|${familia}` : nicho;
}
