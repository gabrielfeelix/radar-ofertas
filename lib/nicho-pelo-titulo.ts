/**
 * O nicho de um produto lido pelo título, e o que nem é produto.
 *
 * POR QUE ISTO EXISTE, E POR QUE SÓ PARA A AMAZON. O nicho normalmente
 * vem do `domain_id` do marketplace (D-023), e essa é a fonte boa: ela é
 * do próprio catálogo da loja, não da nossa leitura. A Amazon não tem
 * domínio nenhum aqui, porque os anúncios dela **não vêm de coleta, vêm
 * da colheita de canais de terceiros** — alguém publicou o link e nós
 * guardamos.
 *
 * Medido em 04/08: dos 98 anúncios da Amazon no catálogo, **zero** têm
 * nicho. Sem nicho não há canal, e sem canal nada publica. Esse é o
 * bloqueio real da Amazon, e não o preço.
 *
 * O CAMINHO FÁCIL É O ERRADO, e ele já foi consertado uma vez. Usar o
 * nicho do canal que achou o produto é literalmente o defeito que a
 * otimização de 01/08 corrigiu: *"o nicho vem do `domain_id` do
 * marketplace, não de quem achou o produto"*. Canal de pet publica
 * ração e publica fone de ouvido.
 *
 * A METADE QUE IMPORTA MAIS É A PRIMEIRA. Olhando os títulos reais da
 * Amazon no catálogo, boa parte **não é produto**:
 *
 *   "Cupom Amazon #anuncio"
 *   "Se prepara cupom Amazon 16:30"
 *   "Novo brinde L'Oréal Elseve"
 *   "PREÇÃO PRA UMA ELECTROLUX! 🔥"
 *   "OFERTA DO DIA — RAÇÃO"
 *
 * É conversa de canal que virou linha de catálogo. Publicar "Se prepara
 * cupom Amazon 16:30" como oferta é o tipo de erro que ninguém desculpa,
 * e nenhuma classificação de nicho o pegaria: o título parece pet, o
 * título parece beleza. Por isso `ehTituloDeProduto` vem antes.
 *
 * A REGRA É COVARDE DE PROPÓSITO, igual à de gênero: devolve nulo quando
 * não tem certeza, e nulo continua significando "não publica". Errar
 * para menos custa um post; errar para mais põe fone de ouvido no canal
 * de pet.
 */

/**
 * Isto é um produto, ou é conversa do canal?
 *
 * Lista preta, e não branca, pela lição da D-036: quando o universo é
 * grande e desconhecido, o desconhecido tem que separar. Aqui a lista
 * preta é do que se reconhece como conversa, e ela nasceu dos títulos
 * reais do catálogo, não de imaginação.
 */
export function ehTituloDeProduto(titulo: string | null | undefined): boolean {
  const t = (titulo ?? "").trim();
  if (t.length < 12) return false;

  const minusculo = t.toLowerCase();

  /*
    Anúncio de cupom não é produto. O cupom tem caminho próprio
    (`cupom_vivo`, D-039) e entra na mensagem como linha, não como item.
  */
  if (/\bcupom(s|ns)?\b/.test(minusculo)) return false;

  // Chamada de canal, não item. "Se prepara", "corre", "oferta do dia".
  if (/\b(se prepara|prepare[- ]se|corre|corram|bora|aproveit\w+)\b/.test(minusculo)) return false;
  if (/\boferta do dia\b|\bpre[çc][ãa]o\b|\bbaixou\b|\bvoltou\b/.test(minusculo)) return false;
  if (/\bnovo brinde\b|\bbrinde\b/.test(minusculo)) return false;

  // Hora solta no fim é aviso de campanha ("cupom Amazon 16:30").
  if (/\b\d{1,2}[:h]\d{2}\b/.test(minusculo)) return false;

  /*
    Título de produto tem substantivo e número de modelo, medida ou
    marca. Duas palavras em caixa alta com exclamação é grito de canal.
  */
  if (/!/.test(t) && t === t.toUpperCase()) return false;

  return true;
}

/**
 * As palavras que decidem o nicho, do mais específico para o mais geral.
 *
 * A ORDEM IMPORTA e é o que evita o erro clássico: "cadeira gamer" é
 * eletrônico e não casa, "ração" é pet e não mercado. Quem casa primeiro
 * ganha, então o específico vem antes.
 *
 * Cada linha saiu de título REAL do catálogo da Amazon lido em 04/08. Não
 * há palavra aqui que eu não tenha visto num item de verdade — é a lição
 * do Beauty, onde uma regra escrita de cabeça marcou "Lip Gloss Seringa"
 * como insumo de clínica.
 */
const REGRAS: { nicho: string; padrao: RegExp }[] = [
  {
    nicho: "pet",
    padrao:
      /\b(ra[çc][ãa]o|petisco|areia higi[êe]nica|comedouro|bebedouro|arranhador|coleira|antipulgas|whiskas|pedigree|golden|c[ãa]es?|gatos?|felino|canino)\b/i,
  },
  /*
    BEBÊ VEM ANTES DE BELEZA, e isto foi um defeito medido em 05/08.
    Produto de bebê é descrito com as palavras da beleza — "Loção
    Hidratante Para Uso Diário Johnson's Baby" casa com `hidratante`, e
    "Sabonete Líquido Glicerina Camomila Johnson's Baby" casa com
    sabonete. Com `beleza` na frente, loção de bebê ia para o canal de
    Beleza em vez do Kids, e os dois canais existem. É o mesmo desenho
    de `pet` na frente de `beleza`, pelo mesmo motivo.

    E "johnson" SOZINHO seria errado, o que só apareceu conferindo o
    catálogo inteiro antes de escrever a regra: "Cotonetes Flexíveis
    Johnson & Johnson" e "Fio Dental Reach Essencial Johnson's" são da
    marca e não são de bebê. É o "Baby" que decide, e por isso ele está
    no padrão. É a lição do Beauty, onde uma regra escrita de cabeça
    marcou "Lip Gloss Seringa" como insumo de clínica.
  */
  {
    nicho: "bebe",
    padrao:
      /\b(fralda|mamadeira|carrinho de beb[êe]|johnson'?[’']?s?\s*®?\s*baby|chupeta|body beb[êe]|len[çc]os umedecidos|rec[ée]m[- ]nascidos?)\b/i,
  },
  {
    nicho: "suplemento",
    padrao:
      /\b(whey|creatina|protein bar|barra de prote[íi]na|glutamina|bcaa|colageno|col[áa]geno|multivitam|[ôo]mega 3|termog[êe]nico|hipercal[óo]rico)\b/i,
  },
  {
    nicho: "beleza",
    padrao:
      /\b(shampoo|condicionador|m[áa]scara capilar|s[ée]rum|hidratante|delineador|batom|maquiagem|perfume|desodorante|creme facial|[óo]leo de coco|elseve|l'?or[ée]al|maybelline|nivea|eudora|soft hair|beautycolor|escova de (madeira|cabelo))\b/i,
  },
  {
    nicho: "eletronico",
    padrao:
      /\b(notebook|smart ?tv|monitor|placa de v[íi]deo|placa m[ãa]e|mem[óo]ria (gamer|ram)|ssd|processador|water cooler|headphone|fone de ouvido|caixa de som|celular|smartphone|tablet|teclado|mouse|webcam|roteador|impressora|cadeira (gamer|ergon[ôo]mica)|multim[íi]dia|gtx|rtx|ddr4|ddr5|gopro|c[âa]mera de a[çc][ãa]o)\b/i,
  },
  {
    nicho: "casa",
    padrao:
      /\b(cooktop|fog[ãa]o|geladeira|micro-?ondas|ar condicionado|ventilador|liquidificador|batedeira|air ?fryer|fritadeira|forno el[ée]trico|panela|bule|t[ée]rmico|aspirador|lava e seca|m[áa]quina de lavar|sof[áa]|colch[ãa]o|edredom|toalha)\b/i,
  },
  {
    nicho: "mercado",
    padrao:
      /\b(caf[ée] (torrado|em p[óo])|nescau|achocolatado|leite|arroz|feij[ãa]o|a[çc][úu]car|biscoito|bebida l[áa]ctea|azeite)\b/i,
  },
  {
    nicho: "automotivo",
    padrao: /\b(lava autos|pneu|[óo]leo de motor|palheta|som automotivo|cheirinho de carro)\b/i,
  },
  {
    nicho: "bebe",
    padrao: /\b(fralda|mamadeira|carrinho de beb[êe]|johnson'?s baby|chupeta|body beb[êe])\b/i,
  },
];

/**
 * O nicho que o título indica, ou nulo.
 *
 * **QUEM CASA PRIMEIRO GANHA, e a ordem da lista é a decisão.** Ela vem
 * do mais específico para o mais geral, e isso resolve os cruzamentos
 * que existem de verdade no catálogo:
 *
 *   "Ração Golden para Gatos sabor Leite"   pet, não mercado
 *   "Kit Shampoo e Condicionador para Cães"  pet, não beleza
 *
 * A primeira versão disto exigia casamento ÚNICO e devolvia nulo quando
 * duas regras casavam. Parecia mais seguro e era pior: os dois títulos
 * acima são inequívocos para qualquer pessoa, e os dois caíam fora.
 * Segurança que descarta o caso fácil não é segurança, é desistência.
 *
 * O que continua devolvendo nulo é o que não casa com nada, e é o
 * bastante: nulo significa não publicar.
 */
export function nichoPeloTitulo(titulo: string | null | undefined): string | null {
  const t = (titulo ?? "").trim();
  if (!t || !ehTituloDeProduto(t)) return null;

  return REGRAS.find((r) => r.padrao.test(t))?.nicho ?? null;
}
