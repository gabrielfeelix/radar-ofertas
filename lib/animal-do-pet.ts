/**
 * Para qual bicho é um produto de pet, lido do título (D-074).
 *
 * POR QUE PELO TÍTULO: o grupo do Breno quer "cachorro e gato, o
 * padrão", sem cavalo, pássaro ou aquário. O nicho `pet` junta tudo, e
 * a Shopee — a única loja do grupo dele — não manda atributo de espécie
 * nenhum. O título é o que existe, como no `TIPO` do canal de beleza.
 *
 * AS TRÊS RESPOSTAS, e o nulo é a que mais importa:
 *
 *   * `cao` / `gato` — o título fala do bicho. Vale mesmo que cite
 *     outro junto ("cães, gatos e coelhos"): serve para o grupo.
 *   * `outro` — o título fala SÓ de outro bicho. É o que o filtro
 *     `ANIMAL exclui outro` do canal barra.
 *   * `null` — o título não fala de bicho nenhum ("Cama Pet Suspensa").
 *     Passa. É a regra da migration 36: reprovar o desconhecido cala o
 *     canal por causa do cadastro de um terceiro.
 */

export type AnimalDoPet = "cao" | "gato" | "outro" | null;

function normaliza(texto: string): string {
  return ` ${texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")} `;
}

// Palavras inteiras, com espaço dos dois lados depois de normalizar:
// "cao" solto não pega "tubarao" nem "racao".
const CAO = [" cao ", " caes ", " cachorro", " cachorra", " dog ", " dogs ", " canino", " canina", " filhote", " pet dog "];
const GATO = [" gato", " gata ", " gatas ", " cat ", " cats ", " felino", " felina", " arranhador", " areia sanitaria", " caixa de areia"];
const OUTRO = [
  " cavalo", " equino", " equina", " egua", " potro", " sela ", " ferradura",
  " passaro", " passarinho", " ave ", " aves ", " calopsita", " periquito", " papagaio", " canario", " alpiste", " gaiola",
  " peixe", " aquario", " betta", " aquatico",
  " hamster", " roedor", " coelho", " porquinho da india", " chinchila", " furao",
  " tartaruga", " jabuti", " reptil", " cobra ", " iguana",
  " galinha", " frango vivo", " bovino", " suino", " ovino", " gado ",
];

export function animalDoPet(titulo: string | null | undefined): AnimalDoPet {
  if (!titulo) return null;
  const t = normaliza(titulo);
  const tem = (lista: string[]) => lista.some((p) => t.includes(p));

  if (tem(CAO)) return "cao";
  if (tem(GATO)) return "gato";
  if (tem(OUTRO)) return "outro";
  return null;
}
