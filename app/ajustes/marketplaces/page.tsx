import { alternaMarketplace, salvaComissao, salvaConfiguracaoDaLoja } from "@/app/acoes/marketplaces";
import { Botao } from "@/app/componentes/Botao";
import { CabecalhoDaPagina } from "@/app/componentes/CabecalhoDaPagina";
import { CampoDeAfiliado } from "@/app/componentes/CampoDeAfiliado";
import { EtiquetaDeLoja } from "@/app/componentes/EtiquetaDeLoja";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type {
  ComissaoCategoriaLinha,
  MarketplaceLinha,
  NichoLinha,
} from "@/lib/supabase/tipos";

/**
 * Marketplaces — com quais lojas o sistema trabalha.
 *
 * É a tela de menor uso e maior consequência do sistema: quase nunca
 * se mexe nela, e enquanto ela estiver incompleta **nada funciona**.
 * Sem credencial o coletor não coleta; sem percentual de comissão toda
 * oferta da loja é reprovada por comissão não configurada.
 *
 * TRÊS REGRAS QUE A TELA OBEDECE:
 *
 * 1. **O identificador de afiliado é dinheiro.** Entra e nunca sai —
 *    a tela mostra "configurada" ou "sem credencial", jamais o valor.
 *
 * 2. **Percentual de comissão nunca fica em código.** Ele muda a cada
 *    campanha sazonal, e a comissão calculada é sempre estimativa.
 *    Trocar o percentual encerra o anterior e cria outro: comissão de
 *    venda antiga foi calculada pelo valor daquela época.
 *
 * 3. **A retenção de preço é por loja.** É o que faz a Amazon ser
 *    tratada diferente sem espalhar exceção pelo sistema todo.
 */

export const dynamic = "force-dynamic";

type LojaNaTela = Omit<MarketplaceLinha, "afiliado_id"> & { temAfiliado: boolean };

export default async function Marketplaces() {
  const dados = await buscaDados();

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

  const { lojas, nichos, comissoes } = dados;

  return (
    <>
      <CabecalhoDaPagina
        trilha="Ajustes"
        titulo="Marketplaces"
        subtitulo="Com quais lojas o sistema trabalha, quanto cada nicho paga e por quanto tempo o preço de cada loja pode ser guardado. É a tela de menor uso e maior consequência: enquanto ela estiver incompleta, o coletor roda e não coleta."
      />

      <div className="flex w-full max-w-4xl flex-col gap-5 px-6 pt-5 pb-10">
        {lojas.map((loja) => (
          <CartaoDaLoja
            key={loja.id}
            loja={loja}
            nichos={nichos}
            comissoes={comissoes.filter((c) => c.marketplace_id === loja.id)}
          />
        ))}
      </div>
    </>
  );
}

function CartaoDaLoja({
  loja,
  nichos,
  comissoes,
}: {
  loja: LojaNaTela;
  nichos: NichoLinha[];
  comissoes: ComissaoCategoriaLinha[];
}) {
  const vigentes = comissoes.filter((c) => c.vigente_ate === null);
  const encerradas = comissoes.filter((c) => c.vigente_ate !== null);
  const semComissao = loja.comissao_padrao_pct === null && vigentes.length === 0;

  return (
    <article
      className={`rounded-lg border p-5 ${loja.ativo ? "border-borda bg-superficie" : "border-borda bg-superficie-alt"}`}
    >
      <header className="flex flex-wrap items-center gap-3">
        <EtiquetaDeLoja nome={loja.nome} corTexto={loja.cor_texto} corFundo={loja.cor_fundo} />
        <span className="font-mono text-xs text-texto-fraco">{loja.slug}</span>

        {/*
          "Forma série" não é ajuste: é consequência da política da
          loja. A Amazon permite guardar preço por 24 horas, então essa
          linha nunca acumula histórico — e deixar isso editável seria
          oferecer ao dono um botão para violar a política dela.
        */}
        {loja.base_de_historico ? (
          <span className="rounded-sm bg-sucesso-fundo px-2 py-1 text-xs font-semibold text-sucesso">
            forma série
          </span>
        ) : (
          <span
            className="rounded-sm bg-info-fundo px-2 py-1 text-xs font-semibold text-info"
            title="A política desta loja limita a retenção de preço. Ela entra como oferta pontual."
          >
            não forma série
          </span>
        )}

        {!loja.ativo && (
          <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-medio">
            desativada
          </span>
        )}

        <form action={alternaMarketplace} className="ml-auto">
          <input type="hidden" name="marketplace_id" value={loja.id} />
          <input type="hidden" name="ativo" value={loja.ativo ? "false" : "true"} />
          <Botao type="submit" variante="secundaria" tamanho="sm">
            {loja.ativo ? "desativar" : "ativar"}
          </Botao>
        </form>
      </header>

      <section className="mt-4 border-t border-borda-sutil pt-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
          credencial de afiliado
        </p>
        <CampoDeAfiliado marketplaceId={loja.id} configurado={loja.temAfiliado} />
        <p className="mt-2 max-w-[70ch] text-sm text-texto-fraco">
          O identificador entra e não sai: a tela nunca mostra o valor. Para conferir se está
          certo, o caminho é o relatório da loja — se ele vazar, outra pessoa usa os nossos links.
        </p>
      </section>

      <section className="mt-4 border-t border-borda-sutil pt-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
          coleta e comissão
        </p>

        <form action={salvaConfiguracaoDaLoja} className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="marketplace_id" value={loja.id} />

          <label>
            <span className="mb-2 block text-sm font-semibold">Comissão padrão</span>
            <span className="flex items-center gap-2 rounded-md border border-borda-forte bg-superficie px-3 py-2">
              <input
                name="comissao_padrao"
                type="text"
                inputMode="decimal"
                defaultValue={loja.comissao_padrao_pct ?? ""}
                placeholder="não configurada"
                className="w-28 bg-transparent font-mono text-base tabular-nums outline-none"
              />
              <span className="text-sm text-texto-fraco">%</span>
            </span>
          </label>

          <label>
            <span className="mb-2 block text-sm font-semibold">Retenção de preço</span>
            <span className="flex items-center gap-2 rounded-md border border-borda-forte bg-superficie px-3 py-2">
              <input
                name="cache_horas"
                type="number"
                min={1}
                defaultValue={loja.cache_preco_max_horas ?? ""}
                className="w-20 bg-transparent font-mono text-base tabular-nums outline-none"
              />
              <span className="text-sm text-texto-fraco">horas</span>
            </span>
          </label>

          <Botao type="submit" variante="secundaria">
            Salvar
          </Botao>
        </form>

        {semComissao && (
          <p className="mt-3 rounded-md border border-atencao-borda bg-atencao-fundo px-4 py-3 text-sm text-atencao">
            Sem percentual, a comissão estimada é nula e <strong>toda oferta desta loja é
            reprovada</strong> — por comissão não configurada, não por curadoria rigorosa. Vazio é
            diferente de zero de propósito: zero seria uma resposta, e não temos nenhuma.
          </p>
        )}
      </section>

      <section className="mt-4 border-t border-borda-sutil pt-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-eyebrow text-texto-fraco">
          comissão por nicho
        </p>
        <p className="mb-3 max-w-[70ch] text-sm text-texto-fraco">
          Sobrescreve a padrão. Trocar não edita o valor atual: encerra ele hoje e cria outro,
          porque venda antiga foi calculada pelo percentual daquela época.
        </p>

        <ul className="flex flex-col gap-2">
          {nichos.map((nicho) => {
            const vigente = vigentes.find((c) => c.nicho_id === nicho.id);

            return (
              <li key={nicho.id} className="flex flex-wrap items-center gap-3">
                <span className="w-32 text-base font-semibold">{nicho.nome}</span>

                <form action={salvaComissao} className="flex items-center gap-2">
                  <input type="hidden" name="marketplace_id" value={loja.id} />
                  <input type="hidden" name="nicho_id" value={nicho.id} />
                  <span className="flex items-center gap-2 rounded-md border border-borda-forte bg-superficie px-3 py-2">
                    <input
                      name="percentual"
                      type="text"
                      inputMode="decimal"
                      defaultValue={vigente?.percentual ?? ""}
                      placeholder={
                        loja.comissao_padrao_pct !== null ? `${loja.comissao_padrao_pct}` : "—"
                      }
                      className="w-20 bg-transparent text-right font-mono text-base tabular-nums outline-none"
                    />
                    <span className="text-sm text-texto-fraco">%</span>
                  </span>
                  <Botao type="submit" variante="fantasma" tamanho="sm">
                    {vigente ? "trocar" : "definir"}
                  </Botao>
                </form>

                {vigente ? (
                  <span className="text-sm text-texto-fraco">
                    desde {formataDia(vigente.vigente_desde)}
                  </span>
                ) : (
                  <span className="text-sm text-texto-fraco">
                    usa a padrão da loja
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {encerradas.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer list-none text-sm font-bold text-marca-texto">
              histórico de percentuais ({encerradas.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-texto-fraco">
              {encerradas.map((comissao) => (
                <li key={comissao.id}>
                  {nichos.find((n) => n.id === comissao.nicho_id)?.nome ?? "nicho removido"} ·{" "}
                  <strong className="font-mono">{comissao.percentual}%</strong> de{" "}
                  {formataDia(comissao.vigente_desde)} a {formataDia(comissao.vigente_ate!)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </article>
  );
}

async function buscaDados(): Promise<{
  lojas: LojaNaTela[];
  nichos: NichoLinha[];
  comissoes: ComissaoCategoriaLinha[];
} | null> {
  try {
    const db = supabaseServidor();

    const [lojas, nichos, comissoes] = await Promise.all([
      db.from("marketplace").select("*").order("nome"),
      db.from("nicho").select("*").eq("ativo", true).order("nome"),
      db.from("comissao_categoria").select("*").order("vigente_desde", { ascending: false }),
    ]);

    if (lojas.error) return null;

    // O identificador vira booleano AQUI, antes de qualquer coisa
    // chegar à tela. O valor não atravessa a fronteira do servidor —
    // nem para um atributo escondido, nem para um `title`.
    const semSegredo = ((lojas.data ?? []) as MarketplaceLinha[]).map(
      ({ afiliado_id, ...resto }): LojaNaTela => ({
        ...resto,
        temAfiliado: Boolean(afiliado_id),
      }),
    );

    return {
      lojas: semSegredo,
      nichos: (nichos.data ?? []) as NichoLinha[],
      comissoes: (comissoes.data ?? []) as ComissaoCategoriaLinha[],
    };
  } catch {
    return null;
  }
}

function formataDia(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
