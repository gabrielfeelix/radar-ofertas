"use client";

import { useActionState } from "react";

import { salvaLimiar, type ResultadoAjuste } from "@/app/acoes/ajustes";

/**
 * O campo que altera um limiar de curadoria.
 *
 * Ele guarda sozinho, sem botão "salvar tudo" no fim da tela: cada
 * limiar é uma decisão separada, e um botão único no rodapé faz o dono
 * mexer em quatro coisas e salvar sem lembrar quais mexeu.
 *
 * O retorno é discreto e imediato — "salvo" ao lado do campo. Alerta
 * verde saltando na tela a cada dígito ensinaria a ignorar alerta.
 */
export function CampoDeLimiar({
  chave,
  valor,
  nichoId,
  sufixo,
  rotuloDoBotao = "salvar",
}: {
  chave: string;
  valor: number | null;
  nichoId?: string;
  /** O que aparece grudado no campo: %, dias, R$. */
  sufixo?: string;
  rotuloDoBotao?: string;
}) {
  const [resultado, acao, salvando] = useActionState<ResultadoAjuste | null, FormData>(
    salvaLimiar,
    null,
  );

  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="chave" value={chave} />
      {nichoId && <input type="hidden" name="nicho_id" value={nichoId} />}

      <span className="flex items-center gap-2 rounded-md border border-borda-forte bg-superficie px-3 py-2">
        <input
          name="valor"
          type="text"
          inputMode="decimal"
          defaultValue={valor ?? ""}
          size={6}
          className="w-16 bg-transparent text-right font-mono text-base tabular-nums outline-none"
        />
        {sufixo && <span className="text-sm text-texto-fraco">{sufixo}</span>}
      </span>

      <button
        type="submit"
        disabled={salvando}
        className="rounded-md border border-borda-forte bg-superficie px-4 py-2 text-sm font-semibold text-texto-medio hover:bg-fundo disabled:opacity-40"
      >
        {salvando ? "salvando…" : rotuloDoBotao}
      </button>

      {resultado?.ok === true && <span className="text-sm text-sucesso">salvo</span>}
      {resultado?.ok === false && <span className="text-sm text-perigo">{resultado.mensagem}</span>}
    </form>
  );
}
