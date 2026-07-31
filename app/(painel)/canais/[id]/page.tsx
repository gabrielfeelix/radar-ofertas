import { notFound } from "next/navigation";

import { alternaCanal } from "@/app/acoes/canais";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { FormularioCanal } from "@/app/componentes/FormularioCanal";
import { buscaCanal, nichosDisponiveis, parteDoDono, vagasDoCanal } from "@/lib/distribuicao";
import { publicacoesDoCanal } from "@/lib/publicacoes";

/**
 * Canal — como este canal se comporta.
 *
 * O detalhe existe separado da listagem porque o que se edita aqui
 * é combinado com outra pessoa: split, operador, horário e teto. São
 * campos que ninguém mexe no meio da correria da manhã, e misturá-los
 * com a operação diária é o caminho para alguém mudar um split
 * achando que está adiando uma oferta.
 */

export const dynamic = "force-dynamic";

export default async function Canal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canal = await buscaCanal(id);

  if (!canal) notFound();

  const [nichos, contagem] = await Promise.all([
    nichosDisponiveis(),
    publicacoesDoCanal(canal.id),
  ]);
  const esperando = contagem.pendentes;
  const enviadas = contagem.enviadasHoje;
  const dono = parteDoDono(canal);

  return (
    <>
      <Pagina
        trilha="Canais"
        titulo={canal.nome}
        subtitulo={`${canal.plataforma === "telegram" ? "Telegram" : "WhatsApp"} · ${canal.nichos
          .join(", ")} · ${canal.audiencia.toLocaleString("pt-BR")} pessoas`}
        acoes={
          <form action={alternaCanal}>
            <input type="hidden" name="canal_id" value={canal.id} />
            <input type="hidden" name="ativo" value={canal.ativo ? "false" : "true"} />
            <Botao type="submit" variante="secundaria">
              {canal.ativo ? "Desligar canal" : "Ligar canal"}
            </Botao>
          </form>
        }
        medida="media"
      >
      {!canal.ativo && (
        <p className="rounded-md border border-atencao-borda bg-atencao-fundo px-4 py-3 text-base text-atencao">
          Desligado: para de receber publicação agora, não amanhã. O histórico continua — é ele que
          sustenta a prestação de contas ao parceiro depois.
        </p>
      )}

      <section className="grid gap-5 sm:grid-cols-3">
        <Numero rotulo="Esperando envio" valor={esperando} />
        <Numero rotulo="Enviadas hoje" valor={enviadas} />
        <Numero
          rotulo="Vagas restantes"
          valor={canal.ativo ? vagasDoCanal(canal) : 0}
        />
      </section>

      <section className="rounded-lg border border-borda-sutil bg-superficie shadow-repouso p-5">
        <h2 className="mb-1 text-lg font-bold tracking-titulo">Como este canal funciona</h2>
        <p className="mb-5 text-base text-texto-fraco">
          Split, operador e teto são combinados com gente. Mudar aqui não reescreve o que já foi
          publicado.
        </p>
        <FormularioCanal canal={canal} nichos={nichos} />
      </section>

      <section className="rounded-lg border border-borda bg-superficie-alt p-5">
        <h2 className="text-lg font-bold tracking-titulo">A conta do repasse</h2>
        <p className="mt-2 text-base text-texto-fraco">
          De cada R$ 100 de comissão <strong>recebida</strong> por este canal:
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-base">
          <Linha rotulo={`${canal.parceiro}, por trazer a audiência`} valor={canal.splitAudienciaPct} />
          <Linha rotulo={`${canal.operador}, por operar`} valor={canal.splitOperacaoPct} />
          <Linha rotulo="você" valor={dono} destaque />
        </ul>
        <p className="mt-4 text-sm text-texto-fraco">
          Só entra nessa conta comissão no estado <strong>recebida</strong>. Repassar sobre
          estimativa é financiar a operação com dinheiro próprio e absorver cada cancelamento
          sozinho.
        </p>
      </section>
      </Pagina>
    </>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-borda-sutil bg-superficie shadow-repouso p-5">
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-texto-fraco">{rotulo}</p>
      <p className="text-2xl font-extrabold tabular-nums tracking-titulo">{valor}</p>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <li className="flex items-center gap-4">
      <span className="min-w-0 flex-1 truncate text-texto-medio">{rotulo}</span>
      <span className="h-2 w-32 rounded-xs bg-preenchimento" aria-hidden>
        <span
          className={`block h-2 rounded-xs ${destaque ? "bg-marca" : "bg-info"}`}
          style={{ width: `${Math.max(0, Math.min(100, valor))}%` }}
        />
      </span>
      <span className="w-20 text-right font-bold tabular-nums">
        R$ {valor.toFixed(2).replace(".", ",")}
      </span>
    </li>
  );
}
