/**
 * Botão — uma forma, quatro variantes, três tamanhos.
 *
 * Existe porque o protótipo tinha nove formas para dez botões, e a
 * primeira versão destas telas repetiu o erro de outro jeito: laranja
 * para aprovar, vermelho cheio para rejeitar, verde cheio para
 * WhatsApp. Cor cheia é peso visual, e peso visual é hierarquia — três
 * botões cheios lado a lado dizem "as três coisas são igualmente
 * importantes", que é o contrário do que a tela quer dizer.
 *
 * A regra que o protótipo usa, e que fica valendo:
 *
 * - **primária** — laranja da marca, com sombra. Uma por bloco.
 * - **secundária** — branca com borda. Todo o resto.
 * - **fantasma** — sem caixa. Ação de baixa consequência.
 * - **perigo** — branca com borda vermelha e texto vermelho. Nunca
 *   preenchida: vermelho cheio ao lado de laranja cheio faz o olho
 *   escolher errado com pressa.
 *
 * A exceção é `plataforma`, o botão de publicar: ele usa o verde do
 * WhatsApp ou o azul do Telegram, porque a cor é a informação — diz
 * para qual aplicativo o toque vai levar. Cor de terceiro não entra
 * no sistema, vem como dado (docs/design.md).
 */

type Variante = "primaria" | "secundaria" | "fantasma" | "perigo";
type Tamanho = "sm" | "md" | "lg";

const VARIANTE: Record<Variante, string> = {
  primaria: "bg-marca text-white shadow-marca hover:bg-marca-hover",
  secundaria:
    "bg-superficie border border-borda-forte text-texto-medio hover:bg-fundo hover:text-texto",
  fantasma: "text-texto-fraco hover:bg-superficie-alt hover:text-texto",
  perigo: "bg-superficie border border-perigo-borda text-perigo hover:bg-perigo-fundo",
};

const TAMANHO: Record<Tamanho, string> = {
  // O `sm` só existe no desktop: em tela de toque, o mínimo é 44px de
  // altura, garantido pelo globals.css.
  sm: "px-4 py-2 text-sm font-semibold",
  md: "px-5 py-3 text-base font-bold",
  lg: "px-5 py-4 text-md font-bold",
};

export function Botao({
  variante = "secundaria",
  tamanho = "md",
  largura,
  className = "",
  ...props
}: {
  variante?: Variante;
  tamanho?: Tamanho;
  /** `cheia` ocupa a linha inteira — usado no celular, onde o alvo é o polegar. */
  largura?: "cheia";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md whitespace-nowrap disabled:opacity-40 ${
        VARIANTE[variante]
      } ${TAMANHO[tamanho]} ${largura === "cheia" ? "w-full" : ""} ${className}`}
    />
  );
}

/**
 * Botão de publicar, na cor da plataforma.
 *
 * Único lugar do sistema com cor cheia que não é a da marca, e é
 * deliberado: o operador de manhã não lê o rótulo, reconhece o verde.
 */
export function BotaoDePlataforma({
  plataforma,
  className = "",
  ...props
}: {
  plataforma: "whatsapp" | "telegram";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex w-full items-center justify-center gap-3 rounded-md px-5 py-4 text-md font-bold text-white disabled:opacity-40 sm:w-auto ${
        plataforma === "whatsapp" ? "bg-whatsapp" : "bg-telegram"
      } ${className}`}
    />
  );
}
