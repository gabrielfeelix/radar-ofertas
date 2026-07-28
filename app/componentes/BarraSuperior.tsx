/**
 * Barra superior.
 *
 * Duas honestidades deliberadas em relação ao protótipo:
 *
 * A BUSCA APARECE DESABILITADA. Ela é da Fase 2 (`docs/telas.md`), e
 * um campo de busca que aceita texto e não busca nada é a única coisa
 * pior que não ter busca: a pessoa digita, não acontece nada, e ela
 * conclui que o catálogo está vazio.
 *
 * O ESTADO DA ROTINA É O DE VERDADE. O protótipo mostra "Rotina
 * 06:08" sempre em verde. Aqui, quando não há execução registrada, a
 * faixa diz isso — ausência de alerta só tranquiliza se for possível
 * distinguir "nada quebrado" de "a verificação não rodou".
 */

export type EstadoDaRotina =
  | { situacao: "ok"; quando: string }
  | { situacao: "falhou"; quando: string }
  | { situacao: "sem_registro" }
  | { situacao: "banco_fora" };

export function BarraSuperior({ rotina }: { rotina: EstadoDaRotina }) {
  return (
    <header className="sticky top-0 z-10 hidden items-center gap-5 border-b border-borda bg-superficie px-6 py-3 lg:flex">
      <div className="flex max-w-96 flex-1 items-center gap-3 rounded-md border border-borda bg-fundo px-4 py-3">
        <span className="size-3 flex-none rounded-circulo border-2 border-texto-apagado" aria-hidden />
        <input
          type="search"
          disabled
          placeholder="Buscar produto, anúncio ou canal — chega na Fase 2"
          className="min-w-0 flex-1 bg-transparent text-base text-texto outline-none placeholder:text-texto-fraco"
        />
      </div>

      <div className="ml-auto flex items-center gap-4">
        <FaixaDaRotina rotina={rotina} />

        <div className="flex items-center gap-3 border-l border-borda pl-4">
          <span
            className="flex size-8 items-center justify-center rounded-circulo bg-linear-150 from-[#FFC79A] to-marca text-sm font-bold text-white"
            aria-hidden
          >
            G
          </span>
          <span className="flex flex-col leading-titulo">
            <span className="text-sm font-semibold">Gabriel</span>
            <span className="text-xs text-texto-fraco">dono</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function FaixaDaRotina({ rotina }: { rotina: EstadoDaRotina }) {
  if (rotina.situacao === "ok") {
    return (
      <Faixa cor="border-sucesso-borda bg-sucesso-fundo text-sucesso" ponto="bg-sucesso">
        Rotina {rotina.quando}
      </Faixa>
    );
  }

  if (rotina.situacao === "falhou") {
    return (
      <Faixa cor="border-perigo-borda bg-perigo-fundo text-perigo" ponto="bg-perigo">
        Rotina falhou {rotina.quando}
      </Faixa>
    );
  }

  if (rotina.situacao === "banco_fora") {
    return (
      <Faixa cor="border-atencao-borda bg-atencao-fundo text-atencao" ponto="bg-atencao">
        Banco fora do ar
      </Faixa>
    );
  }

  return (
    <Faixa cor="border-borda bg-fundo text-texto-fraco" ponto="bg-texto-apagado">
      Rotina ainda não rodou
    </Faixa>
  );
}

function Faixa({
  cor,
  ponto,
  children,
}: {
  cor: string;
  ponto: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${cor}`}>
      <span className={`size-2 rounded-circulo ${ponto}`} aria-hidden />
      {children}
    </span>
  );
}
