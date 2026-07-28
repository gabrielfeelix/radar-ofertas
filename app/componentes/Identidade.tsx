/**
 * Identidade — o rosto de uma entidade: canal, parceiro, loja, produto.
 *
 * Existe por um defeito que a revisão visual de 28/07 achou: o protótipo
 * tem doze espaços de imagem (foto de produto, logo de canal, logo de
 * parceiro, logo de marketplace) e o painel não tinha nenhum. Sem rosto,
 * uma lista de canais e uma lista de produtos viram a mesma parede de
 * texto, e o olho perde o lugar a cada rolagem.
 *
 * A parte que importa é a **reserva**: quase nada tem imagem hoje, e não
 * vai ter enquanto a credencial de marketplace não chegar. Então a
 * ausência precisa ser desenhada, não improvisada. Antes era uma caixa
 * cinza com a palavra "foto" escrita dentro — texto de rascunho vazando
 * para a tela. Agora é a inicial do nome sobre uma cor derivada do
 * próprio nome: sempre a mesma cor para o mesmo canal, o que dá ao item
 * uma marca reconhecível de relance mesmo sem ninguém ter enviado logo
 * nenhum.
 *
 * A cor é derivada, nunca sorteada: o painel roda no servidor e precisa
 * pintar igual em toda renderização.
 */

/**
 * Tons calmos, de propósito.
 *
 * Esta paleta não está em `globals.css` porque não é token de sistema:
 * é um gerador de cor de terceiro, do mesmo tipo da cor de marketplace,
 * e não deve virar cor que uma tela possa escolher à mão. Nenhum tom
 * puxa para o laranja da marca — identidade de entidade competindo com
 * a cor da ação é o começo do arco-íris.
 */
const PALETA = [
  { fundo: "#e8eefb", texto: "#2f5aa8" },
  { fundo: "#e9f4ec", texto: "#2f7a4f" },
  { fundo: "#f6ebf7", texto: "#7a4a86" },
  { fundo: "#fdeeea", texto: "#a8492f" },
  { fundo: "#fbf2e3", texto: "#8a6520" },
  { fundo: "#e6f2f4", texto: "#2c6b75" },
  { fundo: "#f2eee9", texto: "#6b5a48" },
  { fundo: "#edeef5", texto: "#4a5070" },
] as const;

const TAMANHO = {
  sm: "size-7 text-xs",
  md: "size-10 text-base",
  lg: "size-16 text-lg",
  /**
   * Sem tamanho próprio — quem chama define pelo `className`.
   * Existe para o painel de detalhe, onde a imagem ocupa a largura do
   * painel e não um quadrado. Misturar `size-*` com `h-*`/`w-*` na
   * mesma classe deixa o resultado na mão da ordem do CSS gerado.
   */
  livre: "",
} as const;

const FORMA = {
  /** Pessoa ou canal — o que tem dono e voz. */
  circulo: "rounded-pilula",
  /** Coisa — produto, loja, anúncio. */
  caixa: "rounded-md",
} as const;

export function Identidade({
  nome,
  imagem,
  forma = "caixa",
  tamanho = "md",
  className = "",
}: {
  nome: string;
  /** Quando a coleta trouxer foto ou logo. Hoje é sempre ausente. */
  imagem?: string | null;
  forma?: keyof typeof FORMA;
  tamanho?: keyof typeof TAMANHO;
  className?: string;
}) {
  const base = `flex flex-none items-center justify-center overflow-hidden ${FORMA[forma]} ${TAMANHO[tamanho]} ${className}`;

  if (imagem) {
    // A foto vem de domínio de marketplace, que muda por loja e por
    // campanha. Declarar cada host em `remotePatterns` do next/image é
    // manutenção que quebra em silêncio — a imagem simplesmente some.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imagem} alt="" aria-hidden className={`${base} object-cover`} />
    );
  }

  const cor = PALETA[indiceDaCor(nome)];

  return (
    <span
      className={`${base} font-extrabold tracking-titulo select-none`}
      style={{ background: cor.fundo, color: cor.texto }}
      aria-hidden
    >
      {iniciais(nome)}
    </span>
  );
}

/**
 * Até duas iniciais.
 *
 * Nome de canal real vem com emoji ("🔥 Ofertas do Bruno"), e emoji não
 * é inicial: pular direto para as letras dá "OB", que é o que a pessoa
 * reconhece. Só quando não sobra letra nenhuma o emoji vira o rosto —
 * melhor um emoji do que um quadrado vazio.
 */
function iniciais(nome: string): string {
  const palavras = nome
    .split(/[\s\-_/]+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (palavras.length === 0) return [...nome.trim()][0] ?? "?";
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

/**
 * Índice estável a partir do nome.
 *
 * Multiplicação por 31 com resto é a soma de hash mais boba que existe,
 * e é exatamente o que se quer aqui: precisa espalhar razoavelmente e
 * dar sempre o mesmo resultado, no servidor e no navegador.
 */
function indiceDaCor(semente: string): number {
  let soma = 0;
  for (let i = 0; i < semente.length; i += 1) {
    soma = (soma * 31 + semente.charCodeAt(i)) % 1_000_003;
  }
  return soma % PALETA.length;
}
