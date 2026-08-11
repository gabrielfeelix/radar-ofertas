/**
 * Onde o cupom vale, lido do TEXTO em que ele foi colhido.
 *
 * POR QUE ISTO PRECISOU EXISTIR. Até 11/08 o escopo saía só do prefixo
 * do código, contra a tabela `cupom_prefixo`. Isso funcionava enquanto o
 * Mercado Livre nomeava campanha (`MODAEBELEZA0108`, `TUDOPRACASA0108`)
 * e alguém cadastrava o prefixo à mão.
 *
 * Medido em 11/08: **67 de 76 cupons colhidos nunca podiam ser
 * publicados**, porque `geral = false` com `nicho_id` nulo é a
 * combinação que nenhum canal aceita. Só existiam dez prefixos
 * cadastrados, e o ML inventa nome novo toda semana: `DROGARIA`,
 * `PAYDAY`, `TOMACUPOM`, `BORA`, `KORUJAO`. Cadastrar prefixo é enxugar
 * gelo, e o último post de cupom tinha saído em 01/08.
 *
 * O ESCOPO ESTAVA NA TELA O TEMPO TODO. Os canais escrevem onde o cupom
 * vale, em português, na mesma linha do desconto:
 *
 *     MELIPREFERIDO (Cupom Meli)
 *     10% OFF no site em compras a partir de R$149, limitado a R$200
 *
 *     Seleção de produtos:
 *     MAISOFERTAS
 *     18% OFF em compras a partir de R$29, limitado a R$500
 *
 * O primeiro diz "no site": vale em qualquer canal nosso. O segundo diz
 * "seleção de produtos": vale numa lista que nós não temos, e por isso
 * **continua não publicando**.
 *
 * A ORDEM DAS REGRAS É A REGRA. Restrição ganha de abrangência, sempre.
 * Um texto que diga "no site" e "produtos selecionados" ao mesmo tempo
 * é texto ambíguo, e ambíguo não publica — é a D-036 outra vez: o
 * desconhecido separa, não é ignorado.
 *
 * ISTO NÃO SUBSTITUI `cupom_prefixo`, ENTRA DEPOIS DELE. O prefixo é
 * curadoria nossa e continua ganhando; o texto é o que cobre o cupom
 * cujo nome ninguém previu. Quem chama aplica nessa ordem.
 *
 * E O QUE ISTO NÃO FAZ: não inventa escopo. Sem frase reconhecível, o
 * cupom continua nascendo inerte, exatamente como hoje.
 */

export type EscopoLido = {
  geral: boolean;
  nichoSlug: string | null;
  /** Por que decidimos assim. Vai para o log e para `cupom.descricao`. */
  motivo: string;
};

function normaliza(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/*
  "VALE NUMA LISTA QUE NÓS NÃO TEMOS."

  Esta lista vem primeiro e cala todas as outras. É a redação que o
  Mercado Livre usa para o cupom que só pega em alguns anúncios, e é
  exatamente o cupom que falha no carrinho de quem comprou fora da
  lista — o erro que queima o grupo.
*/
const SELECAO = [
  /produtos? selecionados?/,
  /selecao de produtos?/,
  /itens? selecionados?/,
  /lojas? selecionadas?/,
  /participantes?\b/,
  /categorias? selecionadas?/,
  /*
    Colhido ao vivo em 11/08, do `@CupomDoGnu`, no cupom TOMACUPOM:

      📉 20% OFF
      🛒 Nas compras acima de R$ 19
      ⚠️ Desconto limitado a R$ 150
      📝 Válido para itens da lista indicada

    "Lista indicada" é a mesma coisa que "produtos selecionados" com
    outra redação, e sem esta linha o cupom seria elegível a qualquer
    canal se o texto trouxesse "no site" em algum lugar da janela.
  */
  /lista indicada/,
  /itens da lista/,
  /produtos? participantes?/,
];

/*
  "VALE NO SITE TODO."

  Redações colhidas dos canais reais. `no site` é a mais comum e a mais
  curta, e por isso exige a palavra `site` inteira: "no sitema" não
  existe, mas a fronteira de palavra custa nada.
*/
const SITE_TODO = [
  /\bno site\b/,
  /\bsite todo\b/,
  /\btodo o site\b/,
  /\bsite inteiro\b/,
  /\bem todo site\b/,
  /\btodo site\b/,
  /\bsite completo\b/,
  /\bqualquer produto\b/,
  /\bqualquer compra\b/,
  /\btoda a loja\b/,
  /\bloja toda\b/,
];

/*
  A CATEGORIA, quando o texto a nomeia.

  Cada entrada aponta para um `nicho.slug` que existe no banco. A lista
  é curta e literal: se o texto disser "em Moda", vira moda; se disser
  algo que não está aqui, o cupom continua inerte. Adivinhar categoria
  é o mesmo erro que adivinhar prefixo, só que mais caro, porque o
  cupom sai no canal errado em vez de não sair.

  `beleza` cobre também perfume porque o ML os junta em campanha
  ("Moda e Beleza"), e o canal de perfume é filho do mesmo nicho de
  origem. Publicar um cupom de beleza no canal de perfume é o caso
  bom; o contrário não acontece, porque `perfume` é mais específico e
  vem antes na varredura.
*/
const CATEGORIAS: Array<{ padrao: RegExp; slug: string }> = [
  { padrao: /\bperfumaria\b|\bperfumes?\b/, slug: "perfume" },
  { padrao: /\bbeleza\b|\bcuidado pessoal\b|\bcosmetico/, slug: "beleza" },
  { padrao: /\bmoda\b|\bvestuario\b|\bcalcados?\b|\bacessorios de moda\b/, slug: "moda" },
  { padrao: /\bcasa\b|\bcozinha\b|\bmoveis\b|\bdecoracao\b|\bcama, mesa\b/, slug: "casa" },
  { padrao: /\beletronicos?\b|\bcelulares?\b|\binformatica\b|\baudio e video\b|\btvs?\b/, slug: "eletronico" },
  { padrao: /\bbrinquedos?\b|\bhobbies\b/, slug: "brinquedo" },
  { padrao: /\bbebes?\b|\bfraldas?\b/, slug: "bebe" },
  { padrao: /\bpet shop\b|\bpets?\b|\banimais\b/, slug: "pet" },
  { padrao: /\bgames?\b|\bvideogames?\b|\bconsoles?\b/, slug: "games" },
  { padrao: /\besportes?\b|\bfitness\b|\bacademia\b/, slug: "esporte" },
  { padrao: /\bsuplementos?\b/, slug: "suplemento" },
  { padrao: /\bsaude\b|\bfarmacia\b|\bdrogaria\b/, slug: "saude" },
  { padrao: /\bferramentas?\b|\bconstrucao\b/, slug: "ferramenta" },
  { padrao: /\bautomotivo\b|\bacessorios automotivos\b|\bcarros?\b/, slug: "automotivo" },
  { padrao: /\bmercado\b|\bsupermercado\b|\bbebidas\b/, slug: "mercado" },
  { padrao: /\bpapelaria\b|\bescritorio\b/, slug: "papelaria" },
  { padrao: /\blivros?\b|\bgeek\b|\bcultura pop\b/, slug: "geek" },
];

/**
 * Lê o escopo do bloco de texto onde o cupom foi achado.
 *
 * Devolve `null` quando o texto não diz nada reconhecível, e nulo aqui
 * significa o que sempre significou: o cupom nasce inerte e não vai
 * para canal nenhum.
 */
export function escopoPeloTexto(contexto: string | null | undefined): EscopoLido | null {
  if (!contexto) return null;
  const t = normaliza(contexto);

  // Restrição ganha de abrangência, sempre. Ver o cabeçalho.
  if (SELECAO.some((r) => r.test(t))) return null;

  if (SITE_TODO.some((r) => r.test(t))) {
    return { geral: true, nichoSlug: null, motivo: "o texto diz que vale no site todo" };
  }

  /*
    DUAS CATEGORIAS NO MESMO TEXTO É AMBIGUIDADE, e ambiguidade não
    publica. "20% em Moda e Casa" com um cupom só não diz qual das
    duas o código pega, e escolher uma é chutar no canal de alguém.
  */
  const casadas = CATEGORIAS.filter((c) => c.padrao.test(t));
  if (casadas.length === 1) {
    return { geral: false, nichoSlug: casadas[0].slug, motivo: `o texto nomeia a categoria ${casadas[0].slug}` };
  }

  return null;
}
