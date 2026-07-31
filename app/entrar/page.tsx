import type { Metadata } from "next";

import { FormularioLogin } from "@/app/componentes/FormularioLogin";

/**
 * Entrar.
 *
 * A tela mais simples do sistema, e a que mais precisa não ter nada
 * além do necessário: sem barra lateral, sem contagem, sem descrição
 * do produto. Painel interno não se vende na porta — e cada elemento
 * a mais aqui é informação sobre o sistema entregue a quem ainda não
 * provou quem é.
 *
 * **Não existe "criar conta".** Conta nasce de convite do dono. Uma
 * porta aberta de cadastro num sistema que controla divisão de
 * dinheiro é o buraco mais óbvio que se pode deixar.
 */

export const metadata: Metadata = {
  title: "Entrar · Radar de Ofertas",
  robots: { index: false, follow: false },
};

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ de?: string }>;
}) {
  const { de } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 flex-none items-center justify-center rounded-md bg-linear-[150deg,#ff9147,var(--color-marca)]"
            aria-hidden
          >
            <span className="size-3 rounded-circulo border-[2.5px] border-white" />
          </span>
          <span className="text-lg font-extrabold tracking-titulo">Radar</span>
        </div>

        <div className="rounded-lg border border-borda-sutil bg-superficie shadow-repouso p-6 shadow-modal">
          <h1 className="text-lg font-extrabold tracking-titulo">Entrar</h1>
          <p className="mt-1 mb-5 text-base text-texto-fraco">
            Este painel é interno. A conta é criada por convite.
          </p>

          <FormularioLogin de={de} />
        </div>
      </div>
    </main>
  );
}
