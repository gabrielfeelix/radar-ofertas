"use client";

import { useActionState, useEffect } from "react";
import { AcoesDoFormulario, classeDeCampo } from "@/app/componentes/Campo";

import { criaNicho, type ResultadoNicho } from "@/app/acoes/ajustes";
import { Botao } from "@/app/componentes/Botao";
import { useFechaModal } from "@/app/componentes/Modal";

/**
 * Criar nicho.
 *
 * O slug sai do nome, e não é campo: é identificador interno, e pedir
 * ao dono que escolha um convida a divergência entre "pet" e "Pet " no
 * mesmo sistema.
 */
export function FormularioNicho() {
  const [resultado, acao, salvando] = useActionState<ResultadoNicho | null, FormData>(
    criaNicho,
    null,
  );

  const fechaModal = useFechaModal();

  // Deu certo: fecha o modal. A confirmação é o nicho aparecendo na
  // lista atrás — mais forte que uma linha verde num painel que some.
  useEffect(() => {
    if (resultado?.ok) fechaModal();
  }, [resultado, fechaModal]);

  return (
    <form action={acao} className="flex flex-col gap-4" key={resultado?.ok ? resultado.token : "novo"}>
      <label className="flex flex-col gap-2">
        <span className="text-base font-semibold">Nome do nicho</span>
        <input
          name="nome"
          type="text"
          required
          minLength={2}
          maxLength={40}
          placeholder="Bebê, ferramenta, papelaria…"
          className={classeDeCampo}
        />
      </label>

      <AcoesDoFormulario>
        <Botao type="submit" variante="primaria" disabled={salvando}>
          {salvando ? "Criando…" : "Criar nicho"}
        </Botao>
      </AcoesDoFormulario>

      {resultado?.ok === false && (
        <p className="w-full text-base text-perigo">{resultado.mensagem}</p>
      )}
    </form>
  );
}
