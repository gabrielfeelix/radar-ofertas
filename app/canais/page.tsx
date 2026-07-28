import Link from "next/link";

import { alternaCanal } from "@/app/acoes/canais";
import { AvisoSimulacao } from "@/app/componentes/AvisoSimulacao";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { Cartao } from "@/app/componentes/Cartao";
import { Chip } from "@/app/componentes/Chip";
import { FormularioCanal } from "@/app/componentes/FormularioCanal";
import { Identidade } from "@/app/componentes/Identidade";
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
    <Pagina
      trilha="Distribuição"
      titulo="Canais"
      subtitulo="Para onde as ofertas vão. O nicho de cada canal é o que roteia — oferta de pet chega ao canal de pet sem ninguém decidir na hora."
      kpis={[
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
    >
      <AvisoSimulacao detalhe="Estes canais não existem. Nada é publicado neles, e a audiência é inventada." />

      {/*
        Grade, não empilhamento. Cartão de largura total deixava meia
        tela vazia entre o nome do canal, à esquerda, e as vagas, à
        direita — e obrigava a rolar para comparar dois canais, que é
        justamente o que esta tela existe para fazer.
      */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((canal) => (
          <CartaoDeCanal key={canal.id} canal={canal} />
        ))}
      </section>

      <Cartao espaco="lg" className="mt-2">
        <h2 className="mb-1 text-lg font-bold tracking-titulo">Novo canal</h2>
        <p className="mb-5 text-base text-texto-fraco">
          Todo canal aponta para um parceiro desde a primeira linha — e no começo esse parceiro é
          você mesmo.
        </p>
        <FormularioCanal />
      </Cartao>
    </Pagina>
  );
}

function CartaoDeCanal({ canal }: { canal: CanalSimulado }) {
  const vagas = Math.max(0, canal.tetoDiario - canal.publicadasHoje);
  const dono = parteDoDono(canal);
  const proprio = canal.splitAudienciaPct === 0 && canal.splitOperacaoPct === 0;

  return (
    <Cartao
      tom={canal.ativo ? "normal" : "apagado"}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        {/*
          O logo do canal. Enquanto ninguém enviar imagem, a inicial
          sobre cor derivada do nome já dá ao canal um rosto estável —
          numa grade de seis, é por ele que o olho acha o certo.
        */}
        <Identidade nome={canal.nome} forma="circulo" tamanho="md" />

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-md font-bold tracking-titulo">
            <Link href={`/canais/${canal.id}`} className="hover:text-marca-texto">
              {canal.nome}
            </Link>
          </h2>
          <p className="truncate text-sm text-texto-fraco">
            {canal.nichos.map(nomeDoNicho).join(" · ")}
          </p>
        </div>

        <div className="flex flex-none flex-col items-end gap-1">
          <Chip
            corTexto="#fff"
            corFundo={canal.plataforma === "telegram" ? "var(--color-telegram)" : "var(--color-whatsapp)"}
          >
            {canal.plataforma === "telegram" ? "Telegram" : "WhatsApp"}
          </Chip>
          {!canal.ativo && <Chip tom="neutro">desligado</Chip>}
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-borda-sutil pt-4">
        <div>
          <p className="text-2xl leading-none font-extrabold tabular-nums tracking-titulo">
            {canal.ativo ? vagas : "—"}
          </p>
          <p className="mt-1 text-xs text-texto-fraco">
            {canal.ativo ? `vagas de ${canal.tetoDiario} hoje` : "não recebe publicação"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold tabular-nums">
            {canal.audiencia.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-texto-fraco">pessoas · opera {canal.operador}</p>
        </div>
      </div>

      {/*
        As duas parcelas continuam separadas, como manda o modelo — mas
        como faixa, não como texto. "audiência 30% · operação 10% · você
        60%" escrito em monoespaçado lia-se como saída de depuração, e
        era a informação mais cara da tela.
      */}
      <div>
        <div className="flex h-2 overflow-hidden rounded-pilula bg-preenchimento">
          <Faixa pct={canal.splitAudienciaPct} cor="#7a4fbf" />
          <Faixa pct={canal.splitOperacaoPct} cor="var(--color-info)" />
          <Faixa pct={dono} cor="var(--color-marca)" />
        </div>
        <p className="mt-2 text-xs text-texto-fraco">
          {proprio ? (
            // Canal seu com "audiência 0% · operação 0%" parecia
            // configuração esquecida. É o caso normal no começo.
            <>
              canal próprio — <strong className="font-semibold text-texto-medio">100% seu</strong>
            </>
          ) : (
            <>
              audiência {canal.splitAudienciaPct}% · operação {canal.splitOperacaoPct}% ·{" "}
              <strong className="font-semibold text-texto-medio">você {dono}%</strong>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 border-t border-borda-sutil pt-4">
        <span className="text-xs text-texto-fraco">
          {canal.ultimaPublicacaoEm
            ? `publicou ${formataDia(canal.ultimaPublicacaoEm)}`
            : "nunca publicou"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/canais/${canal.id}`}
            className="rounded-md px-3 py-2 text-sm font-semibold text-marca-texto hover:bg-marca-fundo"
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
    </Cartao>
  );
}

function Faixa({ pct, cor }: { pct: number; cor: string }) {
  if (pct <= 0) return null;
  return <span style={{ width: `${pct}%`, background: cor }} />;
}

function formataDia(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
