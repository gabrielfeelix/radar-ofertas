"use client";

import { useActionState, useEffect, useState } from "react";
import { AcoesDoFormulario,
  Campo, classeDeCampo, classeDeCampoLiteral } from "@/app/componentes/Campo";

import { cadastraFonte, type ResultadoFonte } from "@/app/acoes/fontes";
import { MISTO } from "@/lib/colheita";
import { leIdentificadorDeCanal } from "@/lib/canais";

import type { NichoOpcao } from "./FormularioAnuncio";
import { Botao } from "@/app/componentes/Botao";
import { useFechaModal } from "@/app/componentes/Modal";

/**
 * Cadastro de canal de colheita.
 *
 * Mesma divisão de trabalho do cadastro de anúncio: a leitura do
 * endereço acontece aqui para dar retorno imediato, e de novo no
 * servidor, que é quem decide. Validação de navegador é
 * conveniência, nunca garantia.
 */

export function FormularioFonte({ nichos }: { nichos: NichoOpcao[] }) {
  const [resultado, acao, enviando] = useActionState<ResultadoFonte | null, FormData>(
    cadastraFonte,
    null,
  );

  const fechaModal = useFechaModal();

  // Deu certo: fecha o modal, quando existe um. A confirmação é o item
  // aparecendo na lista atrás — mais forte que uma linha verde dentro
  // de um painel que some em seguida.
  useEffect(() => {
    if (resultado?.ok) fechaModal();
  }, [resultado, fechaModal]);

  return (
    <div className="flex flex-col gap-4">
      <Campos
        key={resultado?.ok ? resultado.token : "inicial"}
        acao={acao}
        enviando={enviando}
        resultado={resultado}
        nichos={nichos}
      />

      {resultado?.ok === true && (
        <p className="text-base text-sucesso">
          Canal @{resultado.identificador} cadastrado. Entra na próxima colheita.
        </p>
      )}
      {resultado?.ok === false && resultado.campo === "geral" && (
        <p className="text-base text-perigo">{resultado.mensagem}</p>
      )}
    </div>
  );
}

function Campos({
  acao,
  enviando,
  resultado,
  nichos,
}: {
  acao: (formData: FormData) => void;
  enviando: boolean;
  resultado: ResultadoFonte | null;
  nichos: NichoOpcao[];
}) {
  const [canal, setCanal] = useState("");

  const leitura = canal.trim() === "" ? null : leIdentificadorDeCanal(canal);

  const erroDe = (campo: "canal" | "nicho") =>
    resultado?.ok === false && resultado.campo === campo ? resultado.mensagem : null;

  return (
    <form action={acao} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <Campo
          rotulo="Canal do Telegram"
          dica="Só canal público. Cole @nome ou o endereço t.me."
          erro={erroDe("canal")}
        >
          <input
            name="canal"
            type="text"
            required
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            placeholder="@ofertas_pet"
            className={classeDeCampoLiteral}
          />
          {leitura?.ok === true && (
            <p className="mt-2 text-base text-sucesso">
              Vai ler <code className="font-mono">t.me/s/{leitura.identificador}</code>
            </p>
          )}
          {leitura?.ok === false && (
            <p className="mt-2 text-base text-atencao">{leitura.mensagem}</p>
          )}
        </Campo>

        {/*
          "Misto" existe, e é escolha — não o campo em branco.
          Canal de um assunto só entrega produto já roteável. Canal
          genérico de ofertas, marcado com um nicho qualquer para o
          formulário deixar salvar, entrega produto roteado ERRADO, que
          é pior: sem nicho o produto para na triagem, com nicho errado
          ele é publicado no canal errado sem ninguém perceber.
        */}
        <Campo
          rotulo="Nicho"
          dica="Todo produto colhido daqui herda este nicho — é o que roteia. Canal genérico de ofertas é misto, e aí os produtos caem em Sem classificação para triagem à mão."
          erro={erroDe("nicho")}
        >
          <select name="nicho_id" required defaultValue="" className={classeDeCampo}>
            <option value="">escolha…</option>
            {nichos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nome}
              </option>
            ))}
            <option value={MISTO}>Misto — triar à mão</option>
          </select>
        </Campo>

        <Campo rotulo="Apelido" dica="Opcional. Como você chama esse canal.">
          <input
            name="nome"
            type="text"
            maxLength={80}
            className={classeDeCampo}
          />
        </Campo>
      </div>

      <AcoesDoFormulario>
        <Botao type="submit" variante="primaria" disabled={enviando || leitura?.ok === false}>
          {enviando ? "Salvando…" : "Adicionar canal"}
        </Botao>
      </AcoesDoFormulario>
    </form>
  );
}

