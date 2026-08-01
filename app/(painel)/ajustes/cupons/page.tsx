import { alternaCupomAtivo, criaCupom, desfazEsgotado, marcaEsgotado } from "@/app/acoes/cupons";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { Campo } from "@/app/componentes/Campo";
import { Cartao } from "@/app/componentes/Cartao";
import { Chip } from "@/app/componentes/Chip";
import { Modal } from "@/app/componentes/Modal";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Cupons — o segundo motivo de publicar.
 *
 * O primeiro é "caiu de preço". O segundo é "chegou cupom novo, e com
 * ele este produto passa a valer a pena". São gatilhos diferentes e a
 * operação usa os dois.
 *
 * **Por que é digitado à mão:** nenhum marketplace expõe cupom por API.
 * Conferido em 31/07/2026 — no Mercado Livre, `coupons`, `deals` e
 * `marketplace/coupons` devolvem 404, e não é permissão, é ausência.
 *
 * O QUE A TELA AUTOMATIZA É A VALIDADE, e só. Cupom vencido sai das
 * mensagens sozinho. Esgotamento não dá para detectar — cupom que
 * acaba antes do prazo só se descobre usando —, e por isso ele é um
 * botão, não uma regra.
 *
 * "Esgotado" e "desativado" são coisas separadas de propósito:
 * esgotado é fato observado (a loja prometeu prazo e não cumpriu),
 * desativado é decisão nossa. Juntá-los apagaria o único sinal de que
 * a promessa de prazo daquela loja não vale nada.
 */

export const dynamic = "force-dynamic";

type LinhaNaTela = {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo: "percentual" | "valor";
  valor: number;
  valor_minimo_centavos: number;
  teto_desconto_centavos: number | null;
  vigente_ate: string | null;
  esgotado_em: string | null;
  ativo: boolean;
  marketplace: { nome: string; cor_texto: string | null; cor_fundo: string | null } | null;
  nicho: { nome: string } | null;
};

export default async function Cupons() {
  const db = supabaseServidor();

  const [{ data: cupons }, { data: lojas }, { data: nichos }] = await Promise.all([
    db
      .from("cupom")
      .select(
        "id, codigo, descricao, tipo, valor, valor_minimo_centavos, teto_desconto_centavos, vigente_ate, esgotado_em, ativo, marketplace:marketplace_id ( nome, cor_texto, cor_fundo ), nicho:nicho_id ( nome )",
      )
      .order("criado_em", { ascending: false }),
    db.from("marketplace").select("id, nome").eq("ativo", true).order("nome"),
    db.from("nicho").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  /*
    Quem decide o que está vivo é a view `cupons_vivos`, no banco, e
    não esta tela.

    Duas razões, e a segunda é a que importa: "vivo" tem três condições
    que precisam andar juntas, e cada lugar que as reescrevesse acabaria
    discordando dos outros — o mais provável sendo a tela oferecer um
    cupom que a mensagem já não usa. E o relógio: comparar data no
    render é impuro, o lint recusa com razão, e o relógio do servidor
    do painel não é o mesmo que decide a validade na hora do envio.
  */
  const { data: vivosNoBanco } = await db.from("cupons_vivos").select("id, horas_restantes");

  const lista = (cupons ?? []) as unknown as LinhaNaTela[];
  const horasDe = new Map(
    (vivosNoBanco ?? []).map((v) => [v.id as string, v.horas_restantes as number | null]),
  );

  const estadoDe = (c: LinhaNaTela) => {
    if (c.esgotado_em) return "esgotado" as const;
    if (!c.ativo) return "desativado" as const;
    if (horasDe.has(c.id)) return "vivo" as const;
    return "vencido" as const;
  };

  const vivos = lista.filter((c) => estadoDe(c) === "vivo");

  return (
    <Pagina
      trilha="Ajustes"
      titulo="Cupons"
      subtitulo="Nenhuma loja publica cupom por API — estes são digitados à mão. O que o sistema faz sozinho é tirá-los das mensagens quando vencem."
      medida="media"
      acoes={
        <Modal rotuloDoGatilho="Cadastrar cupom" titulo="Cupom novo">
          <FormularioCupom lojas={lojas ?? []} nichos={nichos ?? []} />
        </Modal>
      }
      kpis={[
        { rotulo: "Valendo agora", valor: `${vivos.length}`, nota: "entram nas mensagens" },
        {
          rotulo: "Cadastrados",
          valor: `${lista.length}`,
          nota: `${lista.length - vivos.length} fora de uso`,
        },
      ]}
    >
      {lista.length === 0 ? (
        <Cartao>
          <p className="text-base text-texto-fraco">
            Nenhum cupom cadastrado. Quando a loja soltar um, cadastre aqui com a data de validade —
            o sistema tira das mensagens sozinho quando vencer.
          </p>
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((c) => {
            const estado = estadoDe(c);
            const horas = horasDe.get(c.id) ?? null;

            return (
              <li key={c.id}>
                <Cartao>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-md font-bold tracking-titulo">{c.codigo}</span>

                    <Chip
                      corTexto={c.marketplace?.cor_texto}
                      corFundo={c.marketplace?.cor_fundo}
                    >
                      {c.marketplace?.nome ?? "loja removida"}
                    </Chip>

                    <span className="text-sm font-semibold tabular-nums">
                      {c.tipo === "percentual"
                        ? `−${c.valor}%`
                        : `−R$ ${(c.valor / 100).toFixed(2).replace(".", ",")}`}
                    </span>

                    {c.nicho && <span className="text-xs text-texto-fraco">só {c.nicho.nome}</span>}

                    {estado === "vivo" && (
                      <span className="rounded-sm bg-sucesso-fundo px-2 py-1 text-xs font-semibold text-sucesso">
                        {horas === null
                          ? "sem prazo declarado"
                          : horas < 24
                            ? `vence em ${Math.max(1, Math.round(horas))}h`
                            : `vence em ${Math.round(horas / 24)} dias`}
                      </span>
                    )}
                    {estado === "vencido" && (
                      <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-fraco">
                        vencido
                      </span>
                    )}
                    {estado === "esgotado" && (
                      <span className="rounded-sm bg-perigo-fundo px-2 py-1 text-xs font-semibold text-perigo">
                        esgotado antes do prazo
                      </span>
                    )}
                    {estado === "desativado" && (
                      <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-fraco">
                        desativado
                      </span>
                    )}

                    <span className="flex-1" />

                    {estado === "vivo" && (
                      <form action={marcaEsgotado}>
                        <input type="hidden" name="cupom_id" value={c.id} />
                        <Botao type="submit" variante="fantasma" tamanho="sm">
                          esgotou
                        </Botao>
                      </form>
                    )}
                    {estado === "esgotado" && (
                      <form action={desfazEsgotado}>
                        <input type="hidden" name="cupom_id" value={c.id} />
                        <Botao type="submit" variante="fantasma" tamanho="sm">
                          desfazer
                        </Botao>
                      </form>
                    )}
                    <form action={alternaCupomAtivo}>
                      <input type="hidden" name="cupom_id" value={c.id} />
                      <input type="hidden" name="ativo" value={c.ativo ? "nao" : "sim"} />
                      <Botao type="submit" variante="fantasma" tamanho="sm">
                        {c.ativo ? "desativar" : "reativar"}
                      </Botao>
                    </form>
                  </div>

                  {(c.descricao || c.valor_minimo_centavos > 0 || c.teto_desconto_centavos) && (
                    <p className="mt-2 text-sm text-texto-fraco">
                      {c.descricao}
                      {c.valor_minimo_centavos > 0 &&
                        ` · mínimo de R$ ${(c.valor_minimo_centavos / 100).toFixed(2).replace(".", ",")}`}
                      {c.teto_desconto_centavos &&
                        ` · teto de R$ ${(c.teto_desconto_centavos / 100).toFixed(2).replace(".", ",")}`}
                    </p>
                  )}
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-texto-fraco">
        Cupom sem prazo declarado nunca sai sozinho — é o que fica publicado depois de morrer. Sempre
        que a loja informar a validade, preencha.
      </p>
    </Pagina>
  );
}

function FormularioCupom({
  lojas,
  nichos,
}: {
  lojas: { id: string; nome: string }[];
  nichos: { id: string; nome: string }[];
}) {
  return (
    <form action={criaCupom} className="flex flex-col gap-4">
      <Campo rotulo="Código">
          <input name="codigo" type="text" required placeholder="PRIMEIRACOMPRA" className="rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base" />
        </Campo>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Loja</span>
        <select
          name="marketplace_id"
          required
          className="rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base"
        >
          {lojas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Tipo</span>
          <select
            name="tipo"
            className="rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base"
          >
            <option value="percentual">Percentual</option>
            <option value="valor">Valor fixo</option>
          </select>
        </label>
        <Campo rotulo="Valor">
          <input name="valor" type="text" required placeholder="12 ou 20,00" className="rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base" />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Compra mínima">
          <input name="valor_minimo" type="text" placeholder="0,00" className="rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base" />
        </Campo>
        <Campo rotulo="Teto do desconto">
          <input name="teto" type="text" placeholder="opcional" className="rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base" />
        </Campo>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Nicho</span>
        <select
          name="nicho_id"
          className="rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base"
        >
          <option value="">Vale para todos</option>
          {nichos.map((n) => (
            <option key={n.id} value={n.id}>
              {n.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Válido até</span>
        <input
          type="date"
          name="vigente_ate"
          className="rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base"
        />
        <span className="text-xs text-texto-fraco">
          No fuso de São Paulo. Sem data, ele nunca sai sozinho das mensagens.
        </span>
      </label>

      <Botao type="submit" variante="primaria" tamanho="lg">
        Cadastrar
      </Botao>
    </form>
  );
}
