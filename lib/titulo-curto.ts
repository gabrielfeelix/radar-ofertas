/**
 * O TÍTULO CURTO, e por que a validação é sobre número.
 *
 * MEDIDO EM 15/08, sobre 1.000 produtos do catálogo de produção: a
 * mediana tem 62 caracteres, o p90 tem 101, e o maior tem 200. Metade
 * do catálogo estoura uma linha e meia no celular, e o título é a
 * primeira coisa que a pessoa lê no post. Caso real, com 200:
 *
 *   Fone De Ouvido In ear Soundcore P20i Bluetooth 5.3 Grave Potente
 *   Drivers 10mm 30h Bateria Carregamento Rápido Personalização De Som
 *   Via App Ipx5 2 Mics Ia Para Chamadas Claras Case Compacto Cor Branco
 *
 * O QUE NÃO PODE ACONTECER É A IA INVENTAR ESPECIFICAÇÃO. Em 11/08 o
 * gancho transformou 36 pacotes em *"sessenta pacotinhos"*: nenhum
 * dígito, nenhuma palavra de preço, e a validação inteira deixou passar.
 * Aqui o risco é maior, porque FPS, ml e tom são o que ESCOLHE a versão
 * do produto. Um FPS errado no título não é deselegância, é informação
 * falsa sobre o que a pessoa está comprando, e a pessoa descobre quando
 * a caixa chega.
 *
 * A REGRA, e ela é grosseira de propósito: todo número que aparece no
 * curto tem que aparecer no original, com a mesma unidade colada. Não é
 * checagem de sentido, é de fato. Falso positivo custa um post com o
 * título comprido, que é exatamente o que já temos hoje; falso negativo
 * custa a confiança de quem confere, e quem confere uma vez e vê que
 * está errado não confia em mais nenhum número da mensagem, inclusive
 * nos que vieram do banco e estão certos.
 */

/** Acima disso, encurta. Abaixo, o original passa direto. */
export const TETO_TITULO = 55;

/**
 * `90`, `15g`, `30ml`, `4,5`, `1kg`.
 *
 * A unidade entra na captura porque `15g` virar `15ml` é justamente o
 * erro que interessa pegar, e sem a unidade os dois seriam o mesmo `15`.
 */
const NUMEROS = /\d+(?:[.,]\d+)?(?:ml|g|kg|mg|l|cm|mm|un|w|v)?/gi;

/**
 * Só cola a unidade ao número que a precede, e não mexe no resto.
 *
 * A primeira versão apagava TODO espaço, e isso inventava número: em
 * "FPS 90, 15g" o espaço sumia, sobrava "90,15g", e o regex lia um
 * decimal de noventa vírgula quinze. O título correto era recusado por
 * um número que ninguém escreveu. Colar só `15 g` em `15g` resolve o
 * caso real (a unidade separada do número) sem criar esse.
 */
const normaliza = (t: string) =>
  t.toLowerCase().replace(/(\d)\s+(ml|g|kg|mg|l|cm|mm|un|w|v)\b/g, "$1$2");

/**
 * Limpa e aprova o que o modelo devolveu, ou devolve nulo.
 *
 * Nulo é o desfecho seguro: quem chama usa o título original, e o post
 * sai. Separada da chamada de rede de propósito, que é o mesmo desenho
 * de `lib/gancho.ts`: é a parte com regra, é onde a regressão dói, e é
 * a única que dá para testar sem gastar cota.
 */
export function validaTituloCurto(
  bruto: string | null | undefined,
  original: string,
): string | null {
  if (!bruto || !original) return null;

  const t = String(bruto)
    .replace(/^\s*(t[íi]tulo|resposta)\s*:\s*/i, "")
    .replace(/[\r\n]+/g, " ")
    // Regra 3.11: conserto, não recusa. É pontuação, e não muda o que a
    // frase afirma sobre o produto.
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "");

  if (!t) return null;
  if (t.length > TETO_TITULO) return null;
  // Marcação e link não têm o que fazer num título.
  if (/[<>{}]|https?:\/\//i.test(t)) return null;

  const doOriginal: string[] = normaliza(original).match(NUMEROS) ?? [];
  const doCurto: string[] = normaliza(t).match(NUMEROS) ?? [];
  for (const n of doCurto) {
    if (!doOriginal.includes(n)) return null;
  }

  return t;
}

export const INSTRUCAO_TITULO = `Encurte o título de um produto para um post de promoção num grupo de WhatsApp. Máximo de ${TETO_TITULO} caracteres.

PRECISA SOBREVIVER, porque é o que decide qual versão a pessoa compra:
- a marca
- o que a coisa é
- FPS, ml, g, tamanho, quantidade, tom ou cor de maquiagem
- a linha pela qual o produto é conhecido (Boca Rosa Beauty, Creamy Cheeks, Snail 96)

PODE SAIR:
- adjetivo de vendedor: potente, premium, original, promoção, top de linha, profissional
- lista de compatibilidade: para iPhone Xiaomi Motorola LG
- ficha técnica que não escolhe a versão: drivers 10mm, bluetooth 5.3, bivolt
- a marca escrita duas vezes
- cor no fim, quando a cor não é o produto. Em maquiagem o tom FICA.

NUNCA
- Não invente número nenhum. Se o original diz FPS 90, é FPS 90.
- Não mude unidade. 15g não vira 15ml.
- Não use travessão. Use vírgula.
- Não escreva tudo em maiúscula nem tudo em minúscula: use maiúscula como em nome próprio.
- Não acrescente palavra que o original não garante.

EXEMPLOS
Original: Base matte Payot Boca Rosa Beauty 30ml tom 3 Francisca cobertura alta
Curto: Base Boca Rosa Beauty by Payot, tom 3 Francisca

Original: Protetor Solar Em Bastão Com Cor 6 15g Sallve FPS 90
Curto: Protetor Solar em Bastão Sallve FPS 90, 15g

Original: Blush Cremoso Ruby Rose Linha Rosa - Creamy Cheeks Tom Da Maquiagem Rosy Dawn
Curto: Blush Cremoso Ruby Rose Creamy Cheeks, Rosy Dawn

Responda SÓ com o título, nada mais.`;
