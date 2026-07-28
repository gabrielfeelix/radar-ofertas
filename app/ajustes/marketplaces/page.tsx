import { alternaMarketplace, salvaComissao, salvaConfiguracaoDaLoja } from "@/app/acoes/marketplaces";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { CampoDeAfiliado } from "@/app/componentes/CampoDeAfiliado";
import { Cartao, RotuloDeSecao } from "@/app/componentes/Cartao";
import { Chip } from "@/app/componentes/Chip";
import { Identidade } from "@/app/componentes/Identidade";
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
 *
 * AS LOJAS FICAM LADO A LADO, e isso é a tela inteira. A pergunta que
 * se faz aqui é comparativa — "qual delas ainda não está configurada",
 * "esta paga menos que aquela em eletrônicos". Empilhadas em cartões de
 * largura total, responder isso exigia rolar e lembrar.
 */

export const dynamic = "force-dynamic";

type LojaNaTela = Omit<MarketplaceLinha, "afiliado_id"> & { temAfiliado: boolean };

export default async function Marketplaces() {
  const dados = await buscaDados();

  if (!dados) {
    return (
      <Pagina trilha="Ajustes" titulo="Marketplaces" medida="estreita">
        <Cartao espaco="lg" className="border-atencao-borda bg-atencao-fundo">
          O banco não respondeu. Rode <code className="font-mono">pnpm db:sobe</code>.
        </Cartao>
      </Pagina>
    );
  }

  const { lojas, nichos, comissoes } = dados;
  const semCredencial = lojas.filter((l) => l.ativo && !l.temAfiliado).length;
  const semComissao = lojas.filter(
    (l) => l.ativo && l.comissao_padrao_pct === null && !comissoes.some((c) => c.marketplace_id === l.id && c.vigente_ate === null),
  ).length;

  return (
    <Pagina
      trilha="Ajustes"
      titulo="Marketplaces"
      subtitulo="Com quais lojas o sistema trabalha, quanto cada nicho paga e por quanto tempo o preço de cada loja pode ser guardado. É a tela de menor uso e maior consequência: enquanto ela estiver incompleta, o coletor roda e não coleta."
      kpis={[
        { rotulo: "Lojas ativas", valor: `${lojas.filter((l) => l.ativo).length}`, nota: `${lojas.length} cadastradas` },
        {
          rotulo: "Sem credencial",
          valor: `${semCredencial}`,
          nota: semCredencial > 0 ? "não coletam" : "todas configuradas",
          cor: semCredencial > 0 ? "text-perigo" : "text-sucesso",
        },
        {
          rotulo: "Sem comissão",
          valor: `${semComissao}`,
          nota: semComissao > 0 ? "reprovam tudo" : "todas configuradas",
          cor: semComissao > 0 ? "text-atencao" : "text-sucesso",
        },
      ]}
    >
      {/*
        As duas explicações longas ficavam repetidas dentro de cada
        cartão — três vezes o mesmo parágrafo, empurrando os campos para
        baixo. Regra que vale para a loja toda se diz uma vez, aqui.
      */}
      <Cartao espaco="md" tom="apagado" className="text-sm text-texto-fraco">
        <p className="max-w-[85ch]">
          <strong className="font-semibold text-texto-medio">
            O identificador de afiliado entra e não sai.
          </strong>{" "}
          A tela nunca mostra o valor — para conferir se está certo, o caminho é o relatório da
          loja. Se ele vazar, outra pessoa usa os nossos links.
        </p>
        <p className="mt-2 max-w-[85ch]">
          <strong className="font-semibold text-texto-medio">Trocar comissão não edita.</strong>{" "}
          Encerra o percentual de hoje e cria outro, porque venda antiga foi calculada pelo valor
          daquela época e reescrever o passado faz a conferência do relatório não bater.
        </p>
        <p className="mt-2 max-w-[85ch]">
          <strong className="font-semibold text-texto-medio">Vazio é diferente de zero.</strong>{" "}
          Loja sem percentual reprova toda oferta — por comissão não configurada, não por curadoria
          rigorosa. Zero seria uma resposta, e não temos nenhuma.
        </p>
      </Cartao>

      <section className="grid gap-4 lg:grid-cols-3">
        {lojas.map((loja) => (
          <CartaoDaLoja
            key={loja.id}
            loja={loja}
            nichos={nichos}
            comissoes={comissoes.filter((c) => c.marketplace_id === loja.id)}
          />
        ))}
      </section>
    </Pagina>
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
    <Cartao tom={loja.ativo ? "normal" : "apagado"} className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Identidade nome={loja.nome} forma="caixa" tamanho="md" />
        <div className="min-w-0 flex-1">
          {/* O nome da loja é o título do cartão. Antes era um chip
              colorido ao lado de outro chip com o slug do banco — dois
              rótulos para uma coisa só, e um deles interno. */}
          <h2 className="truncate text-md font-bold tracking-titulo">{loja.nome}</h2>
          <p className="text-sm text-texto-fraco">
            {loja.base_de_historico
              ? "forma série de preço"
              : `retenção de ${loja.cache_preco_max_horas ?? "?"}h — não forma série`}
          </p>
        </div>
        {!loja.ativo && <Chip tom="neutro">desativada</Chip>}
      </header>

      <div className="border-t border-borda-sutil pt-4">
        <RotuloDeSecao>credencial de afiliado</RotuloDeSecao>
        <div className="mt-3">
          <CampoDeAfiliado marketplaceId={loja.id} configurado={loja.temAfiliado} />
        </div>
      </div>

      <div className="border-t border-borda-sutil pt-4">
        <RotuloDeSecao>coleta e comissão</RotuloDeSecao>

        <form action={salvaConfiguracaoDaLoja} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="marketplace_id" value={loja.id} />

          <label className="flex-1">
            <span className="mb-2 block text-sm font-semibold">Comissão padrão</span>
            <span className="flex items-center gap-1 rounded-md border border-borda-forte bg-superficie px-3 py-2">
              <input
                name="comissao_padrao"
                type="text"
                inputMode="decimal"
                defaultValue={loja.comissao_padrao_pct ?? ""}
                // O texto de reserva era mais largo que o campo e saía
                // cortado — "não configurad %". O aviso âmbar abaixo já
                // diz o que o vazio significa, e diz melhor.
                placeholder="—"
                className="w-full bg-transparent text-base tabular-nums outline-none"
              />
              <span className="text-sm text-texto-fraco">%</span>
            </span>
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-sm font-semibold">Retenção</span>
            <span className="flex items-center gap-1 rounded-md border border-borda-forte bg-superficie px-3 py-2">
              <input
                name="cache_horas"
                type="number"
                min={1}
                defaultValue={loja.cache_preco_max_horas ?? ""}
                placeholder="—"
                className="w-full bg-transparent text-base tabular-nums outline-none"
              />
              <span className="text-sm text-texto-fraco">h</span>
            </span>
          </label>

          <Botao type="submit" variante="secundaria" tamanho="sm">
            Salvar
          </Botao>
        </form>

        {semComissao && (
          // Uma linha, não um parágrafo. Com três lojas sem comissão o
          // texto longo aparecia três vezes idêntico e virava parede —
          // o porquê inteiro está dito uma vez, no topo da tela.
          <p className="mt-3 rounded-md border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao">
            Sem percentual, <strong>toda oferta desta loja é reprovada</strong>.
          </p>
        )}
      </div>

      <div className="border-t border-borda-sutil pt-4">
        <RotuloDeSecao>comissão por nicho</RotuloDeSecao>

        <ul className="mt-3 flex flex-col gap-2">
          {nichos.map((nicho) => {
            const vigente = vigentes.find((c) => c.nicho_id === nicho.id);

            return (
              <li key={nicho.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{nicho.nome}</span>
                  <span className="block text-xs text-texto-fraco">
                    {vigente ? `desde ${formataDia(vigente.vigente_desde)}` : "usa a padrão"}
                  </span>
                </span>

                <form action={salvaComissao} className="flex flex-none items-center gap-1">
                  <input type="hidden" name="marketplace_id" value={loja.id} />
                  <input type="hidden" name="nicho_id" value={nicho.id} />
                  <span className="flex w-20 items-center gap-1 rounded-md border border-borda-forte bg-superficie px-2 py-1.5">
                    <input
                      name="percentual"
                      type="text"
                      inputMode="decimal"
                      defaultValue={vigente?.percentual ?? ""}
                      placeholder={
                        loja.comissao_padrao_pct !== null ? `${loja.comissao_padrao_pct}` : "—"
                      }
                      className="w-full bg-transparent text-right text-base tabular-nums outline-none"
                    />
                    <span className="text-sm text-texto-fraco">%</span>
                  </span>
                  <Botao type="submit" variante="fantasma" tamanho="sm">
                    {vigente ? "trocar" : "definir"}
                  </Botao>
                </form>
              </li>
            );
          })}
        </ul>

        {encerradas.length > 0 && (
          <details className="mt-3">
            <summary className="list-none text-sm font-bold text-marca-texto">
              histórico de percentuais ({encerradas.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-texto-fraco">
              {encerradas.map((comissao) => (
                <li key={comissao.id}>
                  {nichos.find((n) => n.id === comissao.nicho_id)?.nome ?? "nicho removido"} ·{" "}
                  <strong className="font-semibold tabular-nums">{comissao.percentual}%</strong> de{" "}
                  {formataDia(comissao.vigente_desde)} a {formataDia(comissao.vigente_ate!)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <form action={alternaMarketplace} className="mt-auto border-t border-borda-sutil pt-4">
        <input type="hidden" name="marketplace_id" value={loja.id} />
        <input type="hidden" name="ativo" value={loja.ativo ? "false" : "true"} />
        <Botao type="submit" variante="secundaria" tamanho="sm" largura="cheia">
          {loja.ativo ? "desativar loja" : "ativar loja"}
        </Botao>
      </form>
    </Cartao>
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
