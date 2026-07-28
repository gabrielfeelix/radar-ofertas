import Link from "next/link";

import { removeExcecao } from "@/app/acoes/ajustes";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { CampoDeLimiar } from "@/app/componentes/CampoDeLimiar";
import { formataLimiar, montaQuadroDaCuradoria, type Limiar } from "@/lib/curadoria";
import type { NichoLinha } from "@/lib/supabase/tipos";

/**
 * Rigor da curadoria — o único lugar dos limiares.
 *
 * Eles eram editáveis em dois lugares no desenho original, e nenhum
 * mostrava o que o outro tinha feito. Aqui é um só.
 *
 * A REGRA DA TELA: **a taxa aparece ao lado do controle que a altera.**
 * Aprovação perto de zero com catálogo grande é parâmetro apertado
 * demais; aprovação alta demais é curadoria virando carimbo. Sem o
 * número ao lado, o ajuste é chute — e afrouxar no chute até o motor
 * não filtrar mais nada é o modo de morte silencioso deste produto.
 *
 * E a advertência que precisa estar dita: **alterar limiar não
 * reprocessa oferta já decidida.** Vale da próxima detecção em diante.
 */

export const dynamic = "force-dynamic";

const SUFIXO: Record<Limiar["formato"], string | undefined> = {
  pct: "%",
  dias: "dias",
  centavos: "centavos",
  numero: undefined,
  fracao: "de 0 a 1",
};

export default async function Curadoria() {
  const quadro = await montaQuadroDaCuradoria();

  if (!quadro) {
    return (
      <div className="flex max-w-2xl flex-col gap-5 p-6">
        <h1 className="text-xl font-bold tracking-titulo">Falta configurar</h1>
        <p className="rounded-lg border border-atencao-borda bg-atencao-fundo p-5 text-base">
          O banco não respondeu. Rode <code className="font-mono">pnpm db:sobe</code>.
        </p>
      </div>
    );
  }

  const { limiares, nichos, totalReprovado, aprovadas, motorRodou, dias } = quadro;
  const avaliadas = totalReprovado + aprovadas;
  const taxa = avaliadas > 0 ? Math.round((aprovadas / avaliadas) * 100) : 0;

  return (
    <>
      <Pagina
        trilha="Ajustes"
        titulo="Rigor da curadoria"
        subtitulo="Os limiares vivem em dado, e não em código, para poderem ser ajustados sem publicar versão nova. O efeito recente de cada um fica ao lado do controle."
        kpis={[
        {
          rotulo: `Aprovadas em ${dias} dias`,
          valor: motorRodou ? `${aprovadas}` : "—",
          nota: motorRodou ? "viraram oferta" : "o motor ainda não rodou",
        },
        {
          rotulo: "Reprovadas",
          valor: motorRodou ? `${totalReprovado}` : "—",
          nota: motorRodou ? "barradas por alguma comporta" : "sem contagem ainda",
        },
        {
          rotulo: "Taxa de aprovação",
          valor: motorRodou ? `${taxa}%` : "—",
          nota: motorRodou
            ? taxa === 0
              ? "nada passa: limiar apertado demais?"
              : taxa > 40
                ? "alta: a curadoria está virando carimbo?"
                : "dentro do esperado"
            : "sem execução, não existe taxa",
          cor: motorRodou && (taxa === 0 || taxa > 40) ? "text-atencao" : undefined,
        },
      ]}
        medida="media"
      >
        {!motorRodou && (
          <p className="rounded-md border border-info-borda bg-info-fundo px-4 py-3 text-base text-info">
            O motor ainda não rodou nenhuma vez, então não existe taxa para observar. Ajustar
            limiar agora é ajustar no escuro — e zero de zero não é curadoria rígida, é ausência de
            dado.
          </p>
        )}

        <p className="rounded-md border border-atencao-borda bg-atencao-fundo px-4 py-3 text-base text-atencao">
          Alterar um limiar <strong>não reprocessa oferta já decidida</strong>. Vale da próxima
          detecção em diante.
        </p>

        <ul className="flex flex-col gap-3">
          {limiares.map((limiar) => (
            <li key={limiar.chave}>
              <CartaoDoLimiar limiar={limiar} nichos={nichos} dias={dias} />
            </li>
          ))}
        </ul>

        <p className="text-sm text-texto-fraco">
          Os nichos e as exceções deles ficam em{" "}
          <Link href="/ajustes/nichos" className="font-semibold text-marca-texto">
            Ajustes → Nichos
          </Link>
          .
        </p>
      </Pagina>
    </>
  );
}

function CartaoDoLimiar({
  limiar,
  nichos,
  dias,
}: {
  limiar: Limiar;
  nichos: NichoLinha[];
  dias: number;
}) {
  const semExcecao = nichos.filter((n) => !limiar.excecoes.some((e) => e.nichoId === n.id));

  return (
    <article className="rounded-lg border border-borda bg-superficie p-5">
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-md font-bold tracking-titulo">{limiar.rotulo}</h2>
          <p className="mt-1 max-w-[70ch] text-base leading-longo text-texto-fraco">
            {limiar.explicacao}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <CampoDeLimiar
            chave={limiar.chave}
            valor={limiar.valorGlobal}
            sufixo={SUFIXO[limiar.formato]}
          />
          {/*
            O efeito ao lado do controle. É este número que separa
            "apertado demais" de "está funcionando", e sem ele o ajuste
            vira chute.
          */}
          {limiar.comporta && (
            <p
              className={`text-sm ${limiar.reprovouRecente > 0 ? "text-atencao" : "text-texto-fraco"}`}
            >
              barrou {limiar.reprovouRecente} em {dias} dias
            </p>
          )}
        </div>
      </div>

      {(limiar.excecoes.length > 0 || limiar.porNicho) && (
        <div className="mt-4 border-t border-borda-sutil pt-4">
          <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
            exceções por nicho
          </p>

          {limiar.excecoes.length === 0 ? (
            <p className="mt-2 text-sm text-texto-fraco">
              Nenhuma. Todos os nichos seguem o valor global — e mudam junto quando ele mudar.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {limiar.excecoes.map((excecao) => (
                <li key={excecao.nichoId} className="flex flex-wrap items-center gap-3">
                  <span className="w-32 text-base font-semibold">{excecao.nicho}</span>
                  <CampoDeLimiar
                    chave={limiar.chave}
                    valor={excecao.valor}
                    nichoId={excecao.nichoId}
                    sufixo={SUFIXO[limiar.formato]}
                  />
                  <span className="text-sm text-texto-fraco">
                    global: {limiar.valorGlobal != null
                      ? formataLimiar(limiar.valorGlobal, limiar.formato)
                      : "—"}
                  </span>
                  <form action={removeExcecao} className="ml-auto">
                    <input type="hidden" name="chave" value={limiar.chave} />
                    <input type="hidden" name="nicho_id" value={excecao.nichoId} />
                    <Botao type="submit" variante="fantasma" tamanho="sm">
                      voltar ao global
                    </Botao>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {/*
            Criar exceção é escolher o nicho e digitar: 20% de desconto
            em ração é oferta excelente, 20% em eletrônico é
            terça-feira comum. Um limiar único ou reprova tudo de um
            lado ou carimba tudo do outro.
          */}
          {limiar.porNicho && semExcecao.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer list-none text-sm font-bold text-marca-texto">
                + exceção para um nicho
              </summary>
              <ul className="mt-3 flex flex-col gap-2">
                {semExcecao.map((nicho) => (
                  <li key={nicho.id} className="flex flex-wrap items-center gap-3">
                    <span className="w-32 text-base text-texto-medio">{nicho.nome}</span>
                    <CampoDeLimiar
                      chave={limiar.chave}
                      valor={limiar.valorGlobal}
                      nichoId={nicho.id}
                      sufixo={SUFIXO[limiar.formato]}
                      rotuloDoBotao="criar exceção"
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
