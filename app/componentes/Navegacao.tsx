"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra de navegação.
 *
 * Só entra aqui a tela que existe. O menu completo está desenhado
 * em docs/plano.md, mas item que leva a tela vazia ensina o
 * operador a ignorar o menu.
 */

const ITENS = [
  { href: "/aprovar", rotulo: "Aprovar" },
  { href: "/publicar", rotulo: "Publicar" },
  { href: "/", rotulo: "Painel" },
  { href: "/colheita/fontes", rotulo: "Fontes" },
  { href: "/colheita/mencoes", rotulo: "Menções" },
];

export function Navegacao() {
  const caminho = usePathname();

  return (
    <nav className="border-b border-borda bg-superficie">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-5 px-6">
        <span className="py-4 text-sm font-bold tracking-titulo">Radar</span>
        <ul className="flex items-center gap-1">
          {ITENS.map((item) => {
            const ativo =
              item.href === "/" ? caminho === "/" : caminho.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`inline-block rounded-md px-4 py-3 text-base font-semibold ${
                    ativo
                      ? "bg-marca-fundo text-marca-texto"
                      : "text-texto-medio hover:bg-superficie-alt"
                  }`}
                >
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
