/**
 * Etiqueta da loja, na cor da loja.
 *
 * As cores vêm do banco (`marketplace.cor_texto` e `cor_fundo`), e não
 * do design system, porque **cor de terceiro pertence a outra pessoa**:
 * se a Shopee mudar de laranja, muda uma linha no banco e não um token
 * nosso (docs/design.md).
 *
 * Ela existe como componente porque a loja aparece em cinco telas, e
 * numa lista de trinta itens é a etiqueta colorida que diz de relance
 * "isto é Shopee" antes de qualquer leitura. Cinza em todas fazia a
 * lista inteira parecer a mesma coisa.
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
  return (
    <span
      className="rounded-sm px-2 py-1 text-xs font-bold whitespace-nowrap"
      style={{
        // Sem cor no banco, cai no chip neutro: loja nova não fica
        // invisível só porque ninguém escolheu a cor dela ainda.
        color: corTexto ?? "var(--color-texto-medio)",
        background: corFundo ?? "var(--color-preenchimento)",
      }}
    >
      {nome}
    </span>
  );
}
