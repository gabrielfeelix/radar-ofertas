/**
 * Campo de formulário — uma forma, e uma só.
 *
 * Cada formulário tinha inventado o seu. Havia `px-4 py-3` num,
 * `px-4 py-2` noutro, `px-3 py-2` num terceiro; borda do sistema em
 * uns e `border-neutral-300 bg-white` — paleta crua do Tailwind, fora
 * do design system inteiro — no formulário de cadastrar por link, que
 * é anterior aos tokens e nunca foi revisitado.
 *
 * Numa página larga isso passa despercebido. Dentro de um modal, com
 * seis campos juntos num quadro pequeno, cada divergência de 4px vira
 * um degrau visível.
 *
 * DUAS FORMAS, e a diferença é semântica, não estética:
 *
 * - `classeDeCampo` — o padrão. Nome, número, seleção, data.
 * - `classeDeCampoLiteral` — monoespaçado, para o que é **texto
 *   literal**: endereço de canal, link colado, identificador de
 *   afiliado. É a mesma regra da tipografia (`docs/design.md`): mono
 *   diz "isto é uma string exata", não "isto é um número".
 */

const BASE =
  "w-full rounded-md border border-borda-forte bg-superficie px-3 py-2.5 text-base placeholder:text-texto-apagado disabled:bg-preenchimento disabled:text-texto-fraco";

export const classeDeCampo = `${BASE} tabular-nums`;

export const classeDeCampoLiteral = `${BASE} font-mono`;

/**
 * Rótulo, dica e erro de um campo.
 *
 * A dica fica **abaixo** do campo, e não acima: acima ela se lê como
 * parte do rótulo e some quando a pessoa começa a digitar; abaixo ela
 * continua no campo de visão enquanto o campo está em foco.
 */
export function Campo({
  rotulo,
  dica,
  erro,
  children,
  className = "",
}: {
  rotulo: string;
  dica?: React.ReactNode;
  erro?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="text-base font-semibold">{rotulo}</span>
      {children}
      {/* O erro substitui a dica: os dois juntos empilham duas linhas
          de texto pequeno embaixo do campo, e a que importa é a que
          diz o que fazer agora. */}
      {erro ? (
        <span className="text-sm font-semibold text-perigo">{erro}</span>
      ) : (
        dica && <span className="text-sm leading-padrao text-texto-fraco">{dica}</span>
      )}
    </label>
  );
}

/**
 * A barra de ação no pé de um formulário.
 *
 * Sem ela, o botão de enviar ficava solto no fluxo, encostado à
 * esquerda logo abaixo do último campo — e num modal isso deixava o
 * ato principal parecendo mais um campo. A divisória fecha o
 * formulário, e a ação vai para a direita, onde a leitura termina.
 */
export function AcoesDoFormulario({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-3 border-t border-borda-sutil pt-4">
      {children}
    </div>
  );
}
