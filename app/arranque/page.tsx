import Link from "next/link";

import { CabecalhoDaPagina } from "@/app/componentes/CabecalhoDaPagina";
import { montaTrilhaDeArranque, type EstadoDoPasso, type PassoDoArranque } from "@/lib/arranque";

/**
 * Trilha de arranque.
 *
 * Responde a pergunta que um sistema vazio não responde sozinho: **por
 * onde eu começo?** Sem ela, sistema recém-instalado e sistema com
 * defeito comunicam a mesma coisa — telas em branco.
 *
 * A tela mostra a trilha inteira, mas **destaca um passo só**. Ver os
 * oito ajuda a entender a ordem; poder agir nos oito convidaria a
 * fazer o sétimo antes do segundo, e o sétimo depende do segundo.
 *
 * E ela diz **quem resolve cada passo**: você, o sistema, ou o tempo.
 * "Acumular 14 dias de série" não é tarefa de ninguém — é tempo
 * passando, e tratar isso como pendência faz o dono procurar o que
 * consertar quando não há nada para consertar.
 */

export const dynamic = "force-dynamic";

const APARENCIA: Record<
  EstadoDoPasso,
  { marca: string; borda: string; rotulo: string; cor: string }
> = {
  pronto: {
    marca: "bg-sucesso text-white",
    borda: "border-borda",
    rotulo: "pronto",
    cor: "text-sucesso",
  },
  agora: {
    marca: "bg-marca text-white",
    borda: "border-marca-borda",
    rotulo: "é o próximo",
    cor: "text-marca-texto",
  },
  esperando: {
    marca: "bg-info-fundo text-info border border-info-borda",
    borda: "border-info-borda",
    rotulo: "só o tempo resolve",
    cor: "text-info",
  },
  depois: {
    marca: "bg-preenchimento text-texto-fraco",
    borda: "border-borda",
    rotulo: "depois",
    cor: "text-texto-fraco",
  },
};

export default async function Arranque() {
  const { passos, completa } = await montaTrilhaDeArranque();
  const feitos = passos.filter((p) => p.estado === "pronto").length;
  const aberto = passos.find((p) => p.estado === "agora" || p.estado === "esperando");

  return (
    <>
      <CabecalhoDaPagina
        trilha="Hoje"
        titulo="Trilha de arranque"
        subtitulo="A ordem em que a operação sai do zero. Cada passo destrava o seguinte — e esta tela some quando todos estiverem prontos."
      />

      <div className="flex w-full max-w-3xl flex-col gap-5 px-6 pt-5 pb-10">
        <section className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-md font-extrabold tracking-titulo">
              {completa ? "Operação completa" : `${feitos} de ${passos.length} prontos`}
            </p>
            {aberto && (
              <p className="text-sm text-texto-fraco">
                agora: <strong className="font-semibold text-texto">{aberto.titulo}</strong>
              </p>
            )}
          </div>
          <span className="h-2 rounded-xs bg-preenchimento" aria-hidden>
            <span
              className="block h-2 rounded-xs bg-marca"
              style={{ width: `${Math.round((feitos / passos.length) * 100)}%` }}
            />
          </span>
        </section>

        {/*
          O passo aberto vem repetido no topo, em destaque. Numa trilha
          de oito, o que importa é o próximo — e o próximo estar na
          quinta linha faz o olho passar por quatro coisas que não
          pedem nada.
        */}
        {aberto && <PassoEmDestaque passo={aberto} />}

        <ol className="flex flex-col gap-2">
          {passos.map((passo, indice) => (
            <li key={passo.id}>
              <LinhaDoPasso passo={passo} numero={indice + 1} />
            </li>
          ))}
        </ol>

        <p className="max-w-[75ch] text-sm leading-longo text-texto-fraco">
          O ritmo é o previsto em <code className="font-mono">docs/roadmap.md</code>: poucas ofertas
          na primeira semana, algo entre dez e quinze na terceira, trinta a partir da sexta. Fila
          vazia no começo é o normal, não defeito.
        </p>
      </div>
    </>
  );
}

function PassoEmDestaque({ passo }: { passo: PassoDoArranque }) {
  const visual = APARENCIA[passo.estado];

  return (
    <section className={`rounded-lg border-2 bg-superficie p-5 ${visual.borda}`}>
      <p className={`text-xs font-bold uppercase tracking-eyebrow ${visual.cor}`}>
        {visual.rotulo} · resolve {passo.quem}
      </p>
      <h2 className="mt-2 text-lg font-extrabold tracking-titulo">{passo.titulo}</h2>
      <p className="mt-2 text-base text-texto-medio">{passo.situacao}</p>
      <p className="mt-2 max-w-[70ch] text-base leading-longo text-texto-fraco">{passo.porque}</p>

      {passo.acao && (
        <Link
          href={passo.acao.href}
          className="mt-4 inline-block rounded-md bg-marca px-5 py-4 text-md font-bold text-white shadow-marca hover:bg-marca-hover"
        >
          {passo.acao.rotulo}
        </Link>
      )}

      {passo.quem === "você" && !passo.acao && (
        <p className="mt-4 rounded-md border border-atencao-borda bg-atencao-fundo px-4 py-3 text-sm text-atencao">
          Este passo acontece fora do sistema. Nada aqui destrava sozinho.
        </p>
      )}
    </section>
  );
}

function LinhaDoPasso({ passo, numero }: { passo: PassoDoArranque; numero: number }) {
  const visual = APARENCIA[passo.estado];

  return (
    <div
      className={`flex items-start gap-4 rounded-md border bg-superficie px-4 py-3 ${
        passo.estado === "depois" ? "opacity-60" : ""
      } ${visual.borda}`}
    >
      <span
        className={`flex size-7 flex-none items-center justify-center rounded-circulo font-mono text-sm font-bold ${visual.marca}`}
        aria-hidden
      >
        {passo.estado === "pronto" ? "✓" : numero}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-bold tracking-titulo">{passo.titulo}</span>
          <span className={`text-xs font-semibold ${visual.cor}`}>{visual.rotulo}</span>
        </p>
        <p className="text-sm text-texto-fraco">{passo.situacao}</p>
      </div>

      <span className="flex-none text-xs text-texto-fraco">{passo.quem}</span>
    </div>
  );
}
