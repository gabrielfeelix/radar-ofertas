/**
 * Chip — a única etiqueta pequena do sistema.
 *
 * Nasceu de um defeito de acúmulo. Cada tela inventou a sua: retângulo
 * verde cheio para WhatsApp, pílula com borda para nicho, chip vermelho
 * para "sem credencial", chip cinza para o slug da loja. Em Marketplaces
 * chegaram a aparecer três seguidos dizendo quase a mesma coisa — o nome
 * da loja, o identificador dela no banco, e o estado da retenção. Vinte
 * etiquetas coloridas na mesma tela não informam nada: viram textura.
 *
 * A regra que fica valendo, e que é mais restritiva do que parece:
 *
 * - **identidade** — o que a coisa é (a loja, a plataforma). Aceita cor
 *   de terceiro vinda do banco. No máximo uma por linha.
 * - **estado** — em que situação ela está (ativa, desligada, sem série).
 *   Cor do sistema, nunca cheia. No máximo uma por linha.
 * - **alerta** — o que exige ação (sem credencial, sem lastro). É a
 *   única que pode gritar, e por isso é a única que não deve aparecer
 *   quando está tudo bem.
 *
 * Nicho deixou de ser chip. Nicho é roteamento, aparece em toda linha e
 * nunca muda de valor — etiqueta que aparece sempre não distingue nada,
 * e três delas lado a lado empurravam o título do produto para fora.
 * Virou texto, junto do resto da descrição.
 */

type Tom = "neutro" | "sucesso" | "atencao" | "perigo" | "info";

const TOM: Record<Tom, string> = {
  neutro: "bg-preenchimento text-texto-medio",
  sucesso: "bg-sucesso-fundo text-sucesso",
  atencao: "bg-atencao-fundo text-atencao",
  perigo: "bg-perigo-fundo text-perigo",
  info: "bg-info-fundo text-info",
};

export function Chip({
  children,
  tom = "neutro",
  corTexto,
  corFundo,
  className = "",
}: {
  children: React.ReactNode;
  tom?: Tom;
  /** Cor vinda do banco. Só para `identidade` — ver `EtiquetaDeLoja`. */
  corTexto?: string | null;
  corFundo?: string | null;
  className?: string;
}) {
  const proprio = corTexto != null || corFundo != null;

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-bold whitespace-nowrap ${
        proprio ? "" : TOM[tom]
      } ${className}`}
      style={
        proprio
          ? {
              color: corTexto ?? "var(--color-texto-medio)",
              background: corFundo ?? "var(--color-preenchimento)",
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

/**
 * Etiqueta da loja, na cor da loja.
 *
 * As cores vêm do banco (`marketplace.cor_texto` e `cor_fundo`), e não
 * do design system, porque **cor de terceiro pertence a outra pessoa**:
 * se a Shopee mudar de laranja, muda uma linha no banco e não um token
 * nosso (docs/design.md).
 *
 * É o único chip de identidade com cor própria, e por isso o único que
 * pode aparecer numa lista de trinta itens sem virar textura: numa lista
 * dessas é a cor que diz "isto é Shopee" antes de qualquer leitura.
 */
export function EtiquetaDeLoja({
  nome,
  corTexto,
  corFundo,
}: {
  nome: string;
  corTexto?: string | null;
  corFundo?: string | null;
}) {
  // Sem cor no banco, cai no chip neutro: loja nova não fica invisível
  // só porque ninguém escolheu a cor dela ainda.
  return (
    <Chip corTexto={corTexto ?? undefined} corFundo={corFundo ?? undefined}>
      {nome}
    </Chip>
  );
}

/**
 * A etiqueta de plataforma — WhatsApp ou Telegram.
 *
 * Em **tinta**, não em cor cheia. O verde do WhatsApp e o azul do
 * Telegram são marcas de terceiros, e entravam saturados ao lado do
 * laranja da nossa: três marcas competindo na mesma linha, e a que
 * perdia era a que devia guiar a tela.
 *
 * A cor não some — ela vira o ponto de 6px. É o suficiente para
 * reconhecer a plataforma de relance, que é o trabalho da etiqueta, e
 * pouco o bastante para não disputar com a ação da linha.
 *
 * Onde a cor CHEIA continua certa: o botão de publicar. Lá ela não é
 * enfeite nem identificação — é a resposta a "para qual aplicativo
 * este toque vai me levar" (`BotaoDePlataforma`).
 */
export function ChipDePlataforma({ plataforma }: { plataforma: string }) {
  const telegram = plataforma === "telegram";

  return (
    <span
      className="inline-flex items-center gap-2 rounded-sm px-2 py-0.5 text-xs font-bold whitespace-nowrap"
      style={{
        color: telegram ? "var(--color-telegram-texto)" : "var(--color-whatsapp-texto)",
        background: telegram ? "var(--color-telegram-fundo)" : "var(--color-whatsapp-fundo)",
      }}
    >
      <span
        aria-hidden
        className="size-2 flex-none rounded-circulo"
        style={{ background: telegram ? "var(--color-telegram)" : "var(--color-whatsapp)" }}
      />
      {telegram ? "Telegram" : "WhatsApp"}
    </span>
  );
}
