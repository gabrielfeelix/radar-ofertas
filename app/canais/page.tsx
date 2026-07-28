import Link from "next/link";

import { alternaCanal } from "@/app/acoes/canais";
import { AvisoSimulacao } from "@/app/componentes/AvisoSimulacao";
import { Botao } from "@/app/componentes/Botao";
import { CabecalhoDaPagina, Kpis } from "@/app/componentes/CabecalhoDaPagina";
import { FormularioCanal } from "@/app/componentes/FormularioCanal";
import {
  canais,
  nomeDoNicho,
  parteDoDono,
  vagasDeHoje,
  type CanalSimulado,
} from "@/lib/simulacao/loja";

/**
 * Canais — para onde as ofertas vão.
 *
 * A tela existe para uma pergunta operacional que nenhuma outra
 * responde: **quanta capacidade a operação tem hoje**. É o teto de
 * cada canal somado que vira o "18 vagas hoje" da aprovação, e é por
 * isso que esta tela vem antes das filas.
 *
 * Ela mostra a divisão de receita em duas parcelas separadas, nunca
 * um número só: a mesma pessoa pode trazer a audiência e operar, e
 * achatar isso num percentual só impede o arranjo em que uma traz e
 * outra publica.
 */

export const dynamic = "force-dynamic";

export default async function Canais() {
  const lista = canais();
  const ativos = lista.filter((c) => c.ativo);
  const capacidade = ativos.reduce((total, c) => total + c.tetoDiario, 0);

  return (
    <>
      <CabecalhoDaPagina
        trilha="Distribuição"
        titulo="Canais"
        subtitulo="Para onde as ofertas vão. O nicho de cada canal é o que roteia — oferta de pet chega ao canal de pet sem ninguém decidir na hora."
      />

      <Kpis
        itens={[
          {
            rotulo: "Canais ativos",
            valor: `${ativos.length}`,
            nota: `${lista.length} no total`,
          },
          {
            rotulo: "Capacidade por dia",
            valor: `${capacidade}`,
            nota: `${capacidade * 7} por semana`,
          },
          {
            rotulo: "Vagas restantes hoje",
            valor: `${vagasDeHoje()}`,
            nota: "o que ainda cabe",
          },
        ]}
      />

      <main className="flex w-full max-w-5xl flex-col gap-6 px-6 pt-5 pb-10">
      <AvisoSimulacao detalhe="Estes canais não existem. Nada é publicado neles, e a audiência é inventada." />

      <section className="flex flex-col gap-4">
        {lista.map((canal) => (
          <CartaoDeCanal key={canal.id} canal={canal} />
        ))}
      </section>

      <section className="rounded-lg border border-borda bg-superficie p-5">
        <h2 className="mb-1 text-lg font-bold tracking-titulo">Novo canal</h2>
        <p className="mb-5 text-base text-texto-fraco">
          Todo canal aponta para um parceiro desde a primeira linha — e no começo esse parceiro é
          você mesmo.
        </p>
        <FormularioCanal />
      </section>
      </main>
    </>
  );
}

function CartaoDeCanal({ canal }: { canal: CanalSimulado }) {
  const vagas = Math.max(0, canal.tetoDiario - canal.publicadasHoje);
  const dono = parteDoDono(canal);

  return (
    <article
      className={`rounded-lg border p-5 ${
        canal.ativo ? "border-borda bg-superficie" : "border-borda bg-superficie-alt"
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-sm px-2 py-1 text-xs font-bold text-white ${
                canal.plataforma === "telegram" ? "bg-telegram" : "bg-whatsapp"
              }`}
            >
              {canal.plataforma === "telegram" ? "Telegram" : "WhatsApp"}
            </span>
            {!canal.ativo && (
              <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-medio">
                desligado
              </span>
            )}
          </div>

          <h2 className="mt-2 text-md font-bold tracking-titulo">
            <Link href={`/canais/${canal.id}`} className="underline decoration-borda-forte underline-offset-2">
              {canal.nome}
            </Link>
          </h2>

          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-texto-fraco">
            {canal.nichos.map((nicho) => (
              <span
                key={nicho}
                className="rounded-pilula border border-borda bg-superficie-alt px-3 py-1 text-xs font-semibold text-texto-medio"
              >
                {nomeDoNicho(nicho)}
              </span>
            ))}
            <span>· {canal.audiencia.toLocaleString("pt-BR")} pessoas</span>
            <span>· opera {canal.operador}</span>
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-2xl font-extrabold tabular-nums tracking-titulo">
            {canal.ativo ? vagas : "—"}
          </p>
          <p className="text-xs text-texto-fraco">
            {canal.ativo ? `vagas de ${canal.tetoDiario} hoje` : "não recebe publicação"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-borda-sutil pt-4 text-sm">
        {/*
          As duas parcelas aparecem separadas até aqui, na listagem.
          Somá-las num número só é o começo do erro que só aparece no
          primeiro repasse.
        */}
        <span className="text-texto-medio">
          audiência <strong className="font-mono">{canal.splitAudienciaPct}%</strong> · operação{" "}
          <strong className="font-mono">{canal.splitOperacaoPct}%</strong> · você{" "}
          <strong className="font-mono">{dono}%</strong>
        </span>

        <span className="text-texto-fraco">
          {canal.ultimaPublicacaoEm
            ? `última publicação ${formataDia(canal.ultimaPublicacaoEm)}`
            : "nunca publicou"}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href={`/canais/${canal.id}`}
            className="rounded-md px-3 py-2 text-sm font-semibold text-marca-texto"
          >
            editar
          </Link>
          <form action={alternaCanal}>
            <input type="hidden" name="canal_id" value={canal.id} />
            <input type="hidden" name="ativo" value={canal.ativo ? "false" : "true"} />
            <Botao type="submit" variante="secundaria" tamanho="sm">
              {canal.ativo ? "desligar" : "ligar"}
            </Botao>
          </form>
        </div>
      </div>
    </article>
  );
}

function formataDia(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
