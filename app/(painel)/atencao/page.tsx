import Link from "next/link";

import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { montaQuadroDeAtencao, type Alerta, type Severidade } from "@/lib/atencao";

/**
 * Precisa de atenção.
 *
 * A tela agrega, não lista. "5 anúncios sem coleta há 3 dias" é um
 * alerta; cinco linhas dizendo a mesma coisa são cinco chances de
 * ignorar a área inteira.
 *
 * Nada é resolvido aqui — ela aponta. Resolver mora na tela do
 * assunto, e um botão de conserto rápido nesta tela seria a porta
 * para consertar sem olhar o contexto.
 *
 * Três coisas que todo alerta carrega, e que separam alerta de ruído:
 * o TAMANHO (quantos), o que ACONTECE se ninguém agir, e para ONDE ir.
 * Quando não há para onde ir, é porque a ação é sua e é fora do
 * sistema — e isso também está dito.
 */

export const dynamic = "force-dynamic";

const SEVERIDADES: Array<{ chave: Severidade; rotulo: string }> = [
  { chave: "critico", rotulo: "crítico" },
  { chave: "atencao", rotulo: "atenção" },
  { chave: "informativo", rotulo: "informativo" },
];

const CORES: Record<Severidade, { texto: string; fundo: string; borda: string }> = {
  critico: { texto: "text-perigo", fundo: "bg-perigo-fundo", borda: "border-perigo-borda" },
  atencao: { texto: "text-atencao", fundo: "bg-atencao-fundo", borda: "border-atencao-borda" },
  informativo: { texto: "text-info", fundo: "bg-info-fundo", borda: "border-info-borda" },
};

export default async function PrecisaDeAtencao({
  searchParams,
}: {
  searchParams: Promise<{ sev?: string }>;
}) {
  const { sev } = await searchParams;
  const filtro = SEVERIDADES.some((s) => s.chave === sev) ? (sev as Severidade) : null;

  const { alertas, verificadoEm, bancoRespondeu } = await montaQuadroDeAtencao();
  const visiveis = filtro ? alertas.filter((a) => a.severidade === filtro) : alertas;

  const criticos = alertas.filter((a) => a.severidade === "critico").length;

  return (
    <>
      <Pagina
        trilha="Hoje"
        titulo="Precisa de atenção"
        subtitulo={
          criticos > 0
            ? "As falhas deste sistema são silenciosas: a coleta para e nada acontece na tela. Só aparece aqui o que exige ação humana."
            : "Só aparece aqui o que exige ação humana. Aviso que não pede ação treina a ignorar a área inteira."
        }
        medida="media"
      >
        {alertas.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Filtro
              href="/atencao"
              rotulo="tudo"
              quantidade={alertas.length}
              ativo={filtro === null}
            />
            {SEVERIDADES.map((severidade) => {
              const quantidade = alertas.filter((a) => a.severidade === severidade.chave).length;
              if (quantidade === 0) return null;

              return (
                <Filtro
                  key={severidade.chave}
                  href={`/atencao?sev=${severidade.chave}`}
                  rotulo={severidade.rotulo}
                  quantidade={quantidade}
                  ativo={filtro === severidade.chave}
                  cor={CORES[severidade.chave]}
                />
              );
            })}
          </div>
        )}

        {visiveis.length === 0 ? (
          <TudoEmDia verificadoEm={verificadoEm} bancoRespondeu={bancoRespondeu} filtrado={!!filtro} />
        ) : (
          <ul className="flex flex-col gap-3">
            {visiveis.map((alerta) => (
              <li key={alerta.id}>
                <CartaoDeAlerta alerta={alerta} />
              </li>
            ))}
          </ul>
        )}

        <p className="max-w-[80ch] text-sm text-texto-fraco">
          Nada é resolvido aqui: esta tela aponta. Os números de coleta, catálogo e configuração
          vêm do banco; os de canais vêm da operação simulada, até o backend entrar.
        </p>
      </Pagina>
    </>
  );
}

function CartaoDeAlerta({ alerta }: { alerta: Alerta }) {
  const cor = CORES[alerta.severidade];

  return (
    <article className="flex items-stretch overflow-hidden rounded-lg border border-borda bg-superficie">
      {/*
        O número à esquerda é o tamanho do problema. Ele fica maior que
        o título de propósito: "3 lojas" e "40 lojas" pedem reações
        diferentes, e é o número que decide qual é qual.
      */}
      <div
        className={`flex w-28 flex-none flex-col items-center justify-center gap-1 border-r px-4 py-5 ${cor.fundo} ${cor.borda}`}
      >
        <span className={`text-2xl font-extrabold tabular-nums tracking-titulo ${cor.texto}`}>
          {alerta.metrica}
        </span>
        <span className={`text-xs font-semibold ${cor.texto}`}>{alerta.metricaRotulo}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 px-5 py-4">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-sm px-2 py-1 text-xs font-bold uppercase tracking-eyebrow ${cor.fundo} ${cor.texto}`}
          >
            {alerta.severidade === "critico"
              ? "crítico"
              : alerta.severidade === "atencao"
                ? "atenção"
                : "informativo"}
          </span>
          <span className="text-xs font-semibold text-texto-fraco">{alerta.area}</span>
        </p>

        <h2 className="text-md font-bold tracking-titulo">{alerta.titulo}</h2>
        <p className="max-w-[78ch] text-base leading-longo text-texto-fraco">{alerta.detalhe}</p>

        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className={`size-2 rounded-circulo ${cor.texto.replace("text-", "bg-")}`} aria-hidden />
          <span className={cor.texto}>{alerta.impacto}</span>
        </p>
      </div>

      <div className="flex flex-none items-center px-5 py-4">
        {alerta.acao ? (
          <Link
            href={alerta.acao.href}
            className="rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base font-bold whitespace-nowrap text-texto hover:bg-fundo"
          >
            {alerta.acao.rotulo} →
          </Link>
        ) : (
          /*
            Sem botão quando a ação é fora do sistema. Botão que leva a
            lugar nenhum é pior que a ausência dele: ensina que o botão
            desta tela não resolve.
          */
          <span className="max-w-32 text-sm text-texto-fraco">
            {alerta.dependeDeVoce ? "depende de você, fora do sistema" : "sem ação no sistema"}
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Tudo em dia.
 *
 * Com a hora da verificação, sempre. Ausência de alerta só tranquiliza
 * se for possível distinguir "nada quebrado" de "a verificação não
 * rodou" — e essa distinção é o motivo desta tela existir.
 */
function TudoEmDia({
  verificadoEm,
  bancoRespondeu,
  filtrado,
}: {
  verificadoEm: Date | null;
  bancoRespondeu: boolean;
  filtrado: boolean;
}) {
  if (filtrado) {
    return (
      <p className="rounded-lg border border-dashed border-borda-forte p-8 text-center text-base text-texto-fraco">
        Nada com essa severidade.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-borda bg-superficie p-10 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-circulo border-2 border-sucesso-borda bg-sucesso-fundo text-xl text-sucesso"
        aria-hidden
      >
        ✓
      </span>
      <p className="text-lg font-extrabold tracking-titulo">Está tudo em dia.</p>
      <p className="max-w-md text-base leading-longo text-texto-fraco">
        {bancoRespondeu && verificadoEm
          ? `Verificado às ${verificadoEm.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            })}. Coleta, catálogo, canais e configuração conferidos.`
          : "Sem verificação: o banco não respondeu."}
      </p>
    </div>
  );
}

function Filtro({
  href,
  rotulo,
  quantidade,
  ativo,
  cor,
}: {
  href: string;
  rotulo: string;
  quantidade: number;
  ativo: boolean;
  cor?: { texto: string; fundo: string; borda: string };
}) {
  const ativoClasses = cor
    ? `${cor.borda} ${cor.fundo} ${cor.texto}`
    : "border-marca-borda bg-marca-fundo text-marca-texto";

  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`flex items-center gap-2 rounded-md border px-4 py-2 text-base font-semibold ${
        ativo ? ativoClasses : "border-borda bg-superficie text-texto-medio hover:bg-superficie-alt"
      }`}
    >
      {rotulo}
      <span className="rounded-sm bg-white/60 px-2 text-xs font-bold tabular-nums">
        {quantidade}
      </span>
    </Link>
  );
}
