/**
 * Faixa de operação simulada.
 *
 * Fica visível o tempo todo, e não some depois de "entendi". Um
 * testador que esquece que o dado é simulado tira conclusão sobre
 * volume, preço e capacidade a partir de número inventado — e é
 * exatamente esse tipo de conclusão que fica no relatório e ninguém
 * revisa depois.
 */
export function AvisoSimulacao({ detalhe }: { detalhe?: string }) {
  return (
    <p className="rounded-md border border-atencao-borda bg-atencao-fundo px-4 py-3 text-sm text-atencao">
      <strong className="font-bold">Operação simulada.</strong>{" "}
      {detalhe ??
        "Ofertas, canais e preços são de mentira, para testar o fluxo antes de existir coleta real. Nada aqui foi publicado em lugar nenhum."}
    </p>
  );
}
