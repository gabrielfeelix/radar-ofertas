import Link from "next/link";

import { alternaNichoAtivo, renomeiaNicho } from "@/app/acoes/ajustes";
import { Botao } from "@/app/componentes/Botao";
import { CabecalhoDaPagina } from "@/app/componentes/CabecalhoDaPagina";
import { FormularioNicho } from "@/app/componentes/FormularioNicho";
import { formataLimiar, montaQuadroDaCuradoria } from "@/lib/curadoria";
import { canais } from "@/lib/simulacao/loja";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { NichoLinha, ProdutoLinha } from "@/lib/supabase/tipos";

/**
 * Nichos — o eixo que liga produto a canal.
 *
 * Produto tem **um** nicho; canal aceita **vários**. É isso que faz
 * "oferta de pet vai para os canais de pet" ser uma consulta ao banco,
 * em vez de uma regra escrita à mão em algum lugar do código.
 *
 * A tela mostra os dois lados dessa ligação — quantos produtos de um
 * lado, quantos canais do outro — porque nicho com produto e sem canal
 * é catálogo que nunca sai, e nicho com canal e sem produto é canal
 * que nunca recebe. Os dois falham em silêncio.
 *
 * **Nicho não é apagado, é desativado.** Apagar levaria junto o
 * roteamento do histórico e, por cascata, os limiares dele.
 */

export const dynamic = "force-dynamic";

export default async function Nichos() {
  const [dados, quadro] = await Promise.all([buscaDados(), montaQuadroDaCuradoria()]);

  if (!dados) {
    return (
      <div className="flex max-w-2xl flex-col gap-5 p-6">
        <h1 className="text-xl font-bold tracking-titulo">Falta configurar</h1>
        <p className="rounded-lg border border-atencao-borda bg-atencao-fundo p-5 text-base">
          O banco não respondeu. Rode <code className="font-mono">pnpm db:sobe</code>.
        </p>
      </div>
    );
  }

  const { nichos, produtos } = dados;
  const listaDeCanais = canais();

  const semNicho = produtos.filter((p) => p.nicho_id === null).length;

  return (
    <>
      <CabecalhoDaPagina
        trilha="Ajustes"
        titulo="Nichos"
        subtitulo="O eixo que liga produto a canal. Produto tem um nicho; canal aceita vários — é isso que faz o roteamento ser consulta ao banco, e não regra escrita à mão."
      />

      <div className="flex w-full max-w-4xl flex-col gap-5 px-6 pt-5 pb-10">
        {semNicho > 0 && (
          <p className="rounded-md border border-atencao-borda bg-atencao-fundo px-4 py-3 text-base text-atencao">
            {semNicho} {semNicho === 1 ? "produto está" : "produtos estão"} sem nicho e não{" "}
            {semNicho === 1 ? "chega" : "chegam"} a canal nenhum.{" "}
            <Link href="/produtos?nicho=sem" className="font-semibold underline">
              Ver quais são
            </Link>
            .
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {nichos.map((nicho) => {
            const produtosDoNicho = produtos.filter((p) => p.nicho_id === nicho.id).length;
            const canaisDoNicho = listaDeCanais.filter(
              (c) => c.ativo && c.nichos.includes(nicho.slug),
            );
            const excecoes = (quadro?.limiares ?? [])
              .map((limiar) => {
                const excecao = limiar.excecoes.find((e) => e.nichoId === nicho.id);
                return excecao ? { limiar, excecao } : null;
              })
              .filter((item): item is NonNullable<typeof item> => item !== null);

            return (
              <li key={nicho.id}>
                <article
                  className={`rounded-lg border p-5 ${
                    nicho.ativo ? "border-borda bg-superficie" : "border-borda bg-superficie-alt"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    {/*
                      Renomear é edição direta, sem tela de detalhe: o
                      nicho tem três campos, e uma tela inteira para
                      três campos é navegação que ninguém agradece.
                    */}
                    <form action={renomeiaNicho} className="flex items-center gap-2">
                      <input type="hidden" name="nicho_id" value={nicho.id} />
                      <input
                        name="nome"
                        defaultValue={nicho.nome}
                        className="w-44 rounded-md border border-transparent bg-transparent px-3 py-2 text-md font-bold tracking-titulo hover:border-borda focus:border-borda-forte"
                      />
                      <Botao type="submit" variante="fantasma" tamanho="sm">
                        renomear
                      </Botao>
                    </form>

                    <span className="font-mono text-xs text-texto-fraco">{nicho.slug}</span>

                    {!nicho.ativo && (
                      <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-medio">
                        desativado
                      </span>
                    )}

                    <form action={alternaNichoAtivo} className="ml-auto">
                      <input type="hidden" name="nicho_id" value={nicho.id} />
                      <input type="hidden" name="ativo" value={nicho.ativo ? "false" : "true"} />
                      <Botao type="submit" variante="secundaria" tamanho="sm">
                        {nicho.ativo ? "desativar" : "ativar"}
                      </Botao>
                    </form>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-borda-sutil pt-4">
                    <Ligacao
                      rotulo="produtos"
                      valor={produtosDoNicho}
                      href={`/produtos?nicho=${nicho.id}`}
                    />
                    <Ligacao rotulo="canais que aceitam" valor={canaisDoNicho.length} href="/canais" />

                    {/*
                      Os dois lados juntos porque cada um sozinho falha
                      calado: produto sem canal nunca sai, canal sem
                      produto nunca recebe.
                    */}
                    {produtosDoNicho > 0 && canaisDoNicho.length === 0 && (
                      <span className="text-sm text-atencao">
                        tem produto e nenhum canal aceita — nada daqui vai sair
                      </span>
                    )}
                    {produtosDoNicho === 0 && canaisDoNicho.length > 0 && (
                      <span className="text-sm text-texto-fraco">
                        tem canal e nenhum produto — o canal não recebe nada deste nicho
                      </span>
                    )}
                  </div>

                  {excecoes.length > 0 && (
                    <div className="mt-4 border-t border-borda-sutil pt-4">
                      <p className="text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
                        limiares diferentes do global
                      </p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {excecoes.map(({ limiar, excecao }) => (
                          <li key={limiar.chave} className="flex flex-wrap items-baseline gap-2 text-base">
                            <span className="text-texto-medio">{limiar.rotulo}:</span>
                            <strong className="font-mono">
                              {formataLimiar(excecao.valor, limiar.formato)}
                            </strong>
                            <span className="text-sm text-texto-fraco">
                              global{" "}
                              {limiar.valorGlobal != null
                                ? formataLimiar(limiar.valorGlobal, limiar.formato)
                                : "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm text-texto-fraco">
                        O resto herda do global.{" "}
                        <Link href="/ajustes/curadoria" className="font-semibold text-marca-texto">
                          Ajustar
                        </Link>
                      </p>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>

        <section className="rounded-lg border border-borda bg-superficie p-5">
          <h2 className="mb-1 text-lg font-bold tracking-titulo">Novo nicho</h2>
          <p className="mb-5 max-w-[70ch] text-base text-texto-fraco">
            Nicho novo nasce herdando todos os limiares do global. Só configure exceção quando o
            comportamento daquele assunto for diferente de verdade — vinte por cento em ração é
            oferta excelente, vinte por cento em eletrônico é terça-feira comum.
          </p>
          <FormularioNicho />
        </section>
      </div>
    </>
  );
}

function Ligacao({ rotulo, valor, href }: { rotulo: string; valor: number; href: string }) {
  return (
    <Link href={href} className="flex items-baseline gap-2 hover:text-marca-texto">
      <span className="font-mono text-lg font-extrabold tabular-nums tracking-titulo">{valor}</span>
      <span className="text-sm text-texto-fraco">{rotulo}</span>
    </Link>
  );
}

async function buscaDados(): Promise<{ nichos: NichoLinha[]; produtos: ProdutoLinha[] } | null> {
  try {
    const db = supabaseServidor();

    const [nichos, produtos] = await Promise.all([
      db.from("nicho").select("*").order("nome"),
      db.from("produto").select("*"),
    ]);

    if (nichos.error) return null;

    return {
      nichos: (nichos.data ?? []) as NichoLinha[],
      produtos: (produtos.data ?? []) as ProdutoLinha[],
    };
  } catch {
    return null;
  }
}
