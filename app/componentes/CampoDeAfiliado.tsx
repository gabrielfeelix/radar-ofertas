"use client";

import { useActionState } from "react";
import { classeDeCampoLiteral } from "@/app/componentes/Campo";

import { defineAfiliado, type ResultadoLoja } from "@/app/acoes/marketplaces";
import { Botao } from "@/app/componentes/Botao";

/**
 * Campo do identificador de afiliado — só escrita.
 *
 * O valor entra e nunca sai: o servidor não devolve, a tela não
 * preenche, e o campo é `type="password"` para não ficar exposto na
 * tela de quem está com alguém do lado. Se este identificador vazar,
 * outra pessoa usa os nossos links e recebe a comissão.
 *
 * Para conferir se está certo, o caminho é o relatório da loja — não
 * a tela. Mostrar o valor "só para conferir" é exatamente como um
 * segredo escapa, e o ganho seria pequeno.
 */
export function CampoDeAfiliado({
  marketplaceId,
  configurado,
}: {
  marketplaceId: string;
  configurado: boolean;
}) {
  const [resultado, acao, salvando] = useActionState<ResultadoLoja | null, FormData>(
    defineAfiliado,
    null,
  );

  return (
    <form action={acao} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="marketplace_id" value={marketplaceId} />

      <span
        className={`rounded-sm px-2 py-1 text-xs font-bold ${
          configurado ? "bg-sucesso-fundo text-sucesso" : "bg-perigo-fundo text-perigo"
        }`}
      >
        {configurado ? "credencial configurada" : "sem credencial"}
      </span>

      <input
        name="afiliado_id"
        type="password"
        autoComplete="off"
        placeholder={configurado ? "trocar o identificador" : "colar o identificador"}
        className={`${classeDeCampoLiteral} w-56`}
      />

      <Botao type="submit" variante="secundaria" tamanho="sm" disabled={salvando}>
        {salvando ? "salvando…" : configurado ? "trocar" : "salvar"}
      </Botao>

      {resultado?.ok === true && <span className="text-sm text-sucesso">salvo</span>}
      {resultado?.ok === false && <span className="text-sm text-perigo">{resultado.mensagem}</span>}
    </form>
  );
}
