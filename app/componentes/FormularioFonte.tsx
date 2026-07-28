"use client";

import { useActionState, useState } from "react";

import { cadastraFonte, type ResultadoFonte } from "@/app/acoes/fontes";
import { leIdentificadorDeCanal } from "@/lib/canais";

import type { NichoOpcao } from "./FormularioAnuncio";

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
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 font-mono text-base"
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

        <Campo
          rotulo="Nicho"
          dica="Todo produto colhido daqui herda este nicho. Sem ele, a colheita produz catálogo que não chega a canal nenhum."
          erro={erroDe("nicho")}
        >
          <select
            name="nicho_id"
            required
            defaultValue={nichos.length === 1 ? nichos[0].id : ""}
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base"
          >
            <option value="">escolha…</option>
            {nichos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo rotulo="Apelido" dica="Opcional. Como você chama esse canal.">
          <input
            name="nome"
            type="text"
            maxLength={80}
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base"
          />
        </Campo>
      </div>

      <div>
        <button
          type="submit"
          disabled={enviando || leitura?.ok === false}
          className="rounded-md bg-marca px-5 py-4 text-base font-bold text-white shadow-marca hover:bg-marca-hover disabled:opacity-40"
        >
          {enviando ? "Salvando…" : "Adicionar canal"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  rotulo,
  dica,
  erro,
  children,
}: {
  rotulo: string;
  dica?: string;
  erro?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-base font-semibold">{rotulo}</span>
      {children}
      {erro ? (
        <p className="mt-2 text-base text-perigo">{erro}</p>
      ) : dica ? (
        <p className="mt-2 text-sm text-texto-fraco">{dica}</p>
      ) : null}
    </label>
  );
}
