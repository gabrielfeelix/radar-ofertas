"use client";

import { usePathname } from "next/navigation";

/**
 * A busca da barra superior.
 *
 * Ela some em `/produtos`, e isso é o conserto de um defeito que só
 * apareceu na captura de tela: a tela de catálogo mostrava **dois
 * campos de busca idênticos ao mesmo tempo** — este, na barra de cima,
 * e o da própria tela, ao lado dos filtros de nicho. Os dois levam ao
 * mesmo lugar e escrevem o mesmo `q` no endereço, então a pergunta que
 * a pessoa faz ao ver os dois — "qual deles filtra o que estou vendo?"
 * — não tinha resposta boa.
 *
 * Quem fica é o da tela, porque ele vive ao lado dos filtros que
 * combinam com ele. Este continua existindo em todas as outras telas,
 * onde é atalho para o catálogo e não concorre com nada.
 *
 * É componente de cliente só por causa do `usePathname`. Nada mais
 * aqui precisa de JavaScript: a busca continua sendo um formulário que
 * vira endereço, e endereço se guarda nos favoritos.
 */
export function BuscaGlobal() {
  const caminho = usePathname();

  if (caminho === "/produtos") return null;

  return (
    <form
      action="/produtos"
      className="flex max-w-96 flex-1 items-center gap-3 rounded-md border border-borda bg-fundo px-4 py-3"
    >
      <span className="size-3 flex-none rounded-circulo border-2 border-texto-apagado" aria-hidden />
      <input
        type="search"
        name="q"
        placeholder="Buscar no catálogo"
        aria-label="Buscar no catálogo"
        className="min-w-0 flex-1 bg-transparent text-base text-texto outline-none placeholder:text-texto-fraco"
      />
    </form>
  );
}
