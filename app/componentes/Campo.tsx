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
 * Campo com unidade grudada — `%`, `dias`, `horas`, `centavos`.
 *
 * A unidade fica **dentro** da moldura, e não como texto ao lado: um
 * "20" sozinho num formulário de curadoria pode ser vinte por cento ou
 * vinte dias, e a resposta estava só no rótulo, longe do olho de quem
 * digita. Marketplaces já fazia isso à mão; a divisão da comissão não
 * fazia, e era onde mais importava — split é o campo cujo erro só
 * aparece meses depois, no primeiro repasse.
 */
export function CampoComUnidade({
  unidade,
  children,
  className = "",
}: {
  unidade: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`flex items-center gap-1 rounded-md border border-borda-forte bg-superficie px-3 py-2.5 focus-within:border-marca focus-within:shadow-[0_0_0_3px_var(--color-marca-fundo)] ${className}`}
    >
      {children}
      <span className="flex-none text-sm text-texto-fraco">{unidade}</span>
    </span>
  );
}

/** O input de dentro de `CampoComUnidade`: sem moldura própria. */
export const classeDeCampoNu =
  "w-full min-w-0 bg-transparent text-base tabular-nums outline-none placeholder:text-texto-apagado";

/**
 * Um valor calculado, exibido ao lado dos campos que o produzem.
 *
 * Não é campo, e precisa não parecer um. "Fica com você" era um `<p>`
 * dentro de uma caixa branca arredondada do mesmo tamanho dos campos
 * vizinhos — quem olha tenta digitar nele. Sem moldura, com o número
 * grande, ele se lê como resultado.
 */
export function ValorCalculado({
  rotulo,
  children,
  alerta = false,
}: {
  rotulo: string;
  children: React.ReactNode;
  alerta?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-base font-semibold text-texto-fraco">{rotulo}</span>
      <p
        className={`px-1 py-1 text-2xl font-extrabold tabular-nums tracking-titulo ${
          alerta ? "text-perigo" : "text-texto"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

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
