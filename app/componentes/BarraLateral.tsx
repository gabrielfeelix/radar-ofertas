"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra lateral, como no protótipo: 236px fixos, grupos com rótulo
 * em maiúsculas, item com ponto de cor, e contagem à direita.
 *
 * A contagem é o que faz a barra ser útil em vez de decorativa —
 * "Aprovar 12" responde, sem clique, a pergunta com que o dono abre
 * o sistema. Item sem número não recebe medalha vazia: número que
 * não existe não vira zero, some.
 *
 * Só entra aqui tela que existe. Item que leva a tela vazia ensina o
 * operador a ignorar o menu inteiro.
 */

export type ItemDaBarra = {
  href: string;
  rotulo: string;
  contagem?: number;
  /** Cor do ponto. Serve para separar áreas de relance. */
  ponto: string;
};

export type GrupoDaBarra = {
  titulo: string;
  itens: ItemDaBarra[];
};

export type ResumoDaBarra = {
  rotulo: string;
  valor: string;
  cor?: string;
};

export function BarraLateral({
  grupos,
  resumo,
}: {
  grupos: GrupoDaBarra[];
  resumo: ResumoDaBarra[];
}) {
  const caminho = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-59 flex-none flex-col gap-6 overflow-y-auto border-r border-borda bg-superficie py-5 lg:flex">
      <div className="flex items-center gap-3 px-5">
        <span
          className="flex size-8 flex-none items-center justify-center rounded-md bg-linear-150 from-[#FF9147] to-marca"
          aria-hidden
        >
          <span className="size-3 rounded-circulo border-2 border-white" />
        </span>
        <span className="text-md font-extrabold tracking-titulo">Radar</span>
        <span className="ml-auto rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-fraco">
          fase 1
        </span>
      </div>

      <nav className="flex flex-col gap-6">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="flex flex-col gap-1">
            <p className="px-5 pb-2 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
              {grupo.titulo}
            </p>
            {grupo.itens.map((item) => {
              const ativo =
                item.href === "/" ? caminho === "/" : caminho.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`mx-3 flex items-center gap-3 rounded-md px-4 py-3 text-base ${
                    ativo
                      ? "bg-marca font-bold text-white"
                      : "font-semibold text-texto-medio hover:bg-fundo"
                  }`}
                >
                  <span
                    className="size-2 flex-none rounded-xs"
                    style={{ background: ativo ? "rgba(255,255,255,.85)" : item.ponto }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                  {item.contagem !== undefined && (
                    <span
                      className={`rounded-sm px-2 text-xs font-bold tabular-nums ${
                        ativo ? "bg-white/25 text-white" : "bg-preenchimento text-texto-fraco"
                      }`}
                    >
                      {item.contagem}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {resumo.length > 0 && (
        <div className="mt-auto flex flex-col gap-2 px-5">
          <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
            Colheita de hoje
          </p>
          {resumo.map((linha) => (
            <p key={linha.rotulo} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-texto-fraco">{linha.rotulo}</span>
              <span className={`font-bold tabular-nums ${linha.cor ?? "text-texto"}`}>
                {linha.valor}
              </span>
            </p>
          ))}
        </div>
      )}
    </aside>
  );
}

/**
 * A mesma navegação, em barra horizontal, para telas estreitas.
 *
 * Existe porque a fila de publicação é usada em pé, com uma mão, no
 * telefone — esconder a navegação atrás de um menu sanduíche ali
 * cobra um toque de quem tem dez minutos.
 */
export function BarraInferior({ grupos }: { grupos: GrupoDaBarra[] }) {
  const caminho = usePathname();
  const itens = grupos.flatMap((g) => g.itens);

  return (
    <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-borda bg-superficie px-3 py-2 lg:hidden">
      {itens.map((item) => {
        const ativo = item.href === "/" ? caminho === "/" : caminho.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-3 text-base font-semibold ${
              ativo ? "bg-marca text-white" : "text-texto-medio"
            }`}
          >
            {item.rotulo}
            {item.contagem !== undefined && (
              <span
                className={`rounded-sm px-2 text-xs font-bold tabular-nums ${
                  ativo ? "bg-white/25" : "bg-preenchimento text-texto-fraco"
                }`}
              >
                {item.contagem}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
