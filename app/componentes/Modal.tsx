"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Botao } from "./Botao";

/**
 * Como o formulário fecha o modal que o contém.
 *
 * É contexto, e não propriedade, por uma restrição real: as telas são
 * componentes de servidor, e função não atravessa a fronteira para o
 * cliente. `<Modal><FormularioNicho /></Modal>` só funciona porque o
 * formulário pergunta ao contexto, em vez de receber a resposta pronta.
 *
 * Fora de um modal devolve uma função que não faz nada — o mesmo
 * formulário serve à edição, numa página inteira, onde não há o que
 * fechar.
 */
const FechaModal = createContext<() => void>(() => {});

export function useFechaModal() {
  return useContext(FechaModal);
}

/**
 * Modal — onde se cria coisa.
 *
 * Antes, criar canal, nicho, fonte ou produto era um bloco solto no pé
 * da página, e criar exceção de limiar era um `<details>` que abria
 * dentro do cartão. Os dois têm o mesmo defeito, e ele não é de gosto:
 *
 * **Criar é um ato, e ato precisa de foco.** Um formulário permanente
 * no pé da tela compete com a lista o tempo todo — está sempre ali,
 * sempre vazio, ocupando a altura que a lista queria. E acordeão é
 * pior: ao abrir, ele empurra o conteúdo abaixo, então a pessoa termina
 * de preencher num lugar diferente de onde começou.
 *
 * O gatilho vira botão no cabeçalho da página, que é onde se procura a
 * ação da tela, e o formulário aparece por cima, com o resto escurecido.
 *
 * USA `<dialog>` NATIVO, e isso não é preciosismo: ele traz de graça a
 * armadilha de foco, o Escape para fechar, o `aria-modal`, e o fundo
 * inerte ao clique e ao leitor de tela. A versão em `div` de tudo isso
 * é o lugar clássico onde a acessibilidade se perde sem ninguém notar.
 */

export function Modal({
  titulo,
  descricao,
  rotuloDoGatilho,
  varianteDoGatilho = "primaria",
  tamanhoDoGatilho = "md",
  largura = "media",
  children,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  rotuloDoGatilho: string;
  varianteDoGatilho?: "primaria" | "secundaria" | "fantasma";
  tamanhoDoGatilho?: "sm" | "md";
  largura?: "estreita" | "media" | "larga";
  children: React.ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);
  // Estável entre renderizações: o formulário a usa dentro de um
  // `useEffect`, e uma função nova a cada render o dispararia em laço.
  const fechar = useCallback(() => setAberto(false), []);

  // `showModal()` não é atributo: sem chamar o método, o <dialog> abre
  // sem armadilha de foco e sem fundo inerte, que é justamente o que
  // ele existe para dar.
  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (aberto && !el.open) el.showModal();
    if (!aberto && el.open) el.close();
  }, [aberto]);

  const LARGURA = {
    estreita: "max-w-md",
    media: "max-w-xl",
    larga: "max-w-3xl",
  }[largura];

  return (
    <>
      <Botao
        type="button"
        variante={varianteDoGatilho}
        tamanho={tamanhoDoGatilho}
        onClick={() => setAberto(true)}
      >
        {rotuloDoGatilho}
      </Botao>

      <dialog
        ref={dialogo}
        // O Escape do navegador fecha sem passar pelo nosso estado, e
        // sem isto o modal ficaria fechado na tela e aberto no React.
        onClose={() => setAberto(false)}
        // Clique no fundo fecha. O <dialog> entrega o clique do backdrop
        // como clique no próprio elemento — o conteúdo fica num <div>
        // interno justamente para essa distinção existir.
        onClick={(e) => {
          if (e.target === dialogo.current) setAberto(false);
        }}
        // NUNCA ponha `flex` (nem `grid`, nem `block`) nesta tag: o
        // `<dialog>` fechado é escondido pelo `display: none` do
        // navegador, e qualquer classe de display o sobrescreve — o
        // modal passa a ficar visível o tempo todo, por cima da tela.
        // A coluna que rola é o `<div>` de dentro.
        className={`w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-borda bg-superficie p-0 shadow-modal backdrop:bg-[rgba(20,22,26,0.45)] ${LARGURA}`}
      >
        <div className="flex max-h-[calc(100vh-4rem)] flex-col">
        {/* Cabeçalho fica parado; só o miolo rola. */}
        <div className="flex flex-none items-start gap-4 border-b border-borda-sutil px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold tracking-titulo">{titulo}</h2>
            {descricao && (
              <div className="mt-1 text-base text-texto-fraco">{descricao}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            className="flex size-8 flex-none items-center justify-center rounded-md text-lg text-texto-fraco hover:bg-fundo hover:text-texto"
          >
            ×
          </button>
        </div>

        {/*
          O conteúdo só é montado com o modal aberto: assim o formulário
          nasce limpo a cada abertura, em vez de guardar o que foi
          digitado e abandonado na vez anterior.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {aberto && (
            <FechaModal.Provider value={fechar}>{children}</FechaModal.Provider>
          )}
        </div>
        </div>
      </dialog>
    </>
  );
}
