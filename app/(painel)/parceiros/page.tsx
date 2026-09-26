import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { Cartao } from "@/app/componentes/Cartao";
import { Chip } from "@/app/componentes/Chip";
import { FormularioParceiro } from "@/app/componentes/FormularioParceiro";
import { Modal } from "@/app/componentes/Modal";
import { parceiros as leParceiros, type Parceiro } from "@/lib/parceiros";

/**
 * Parceiros — quem tem grupo próprio e recebe na própria conta (D-074).
 *
 * O passo a passo mora na tela, e não só no `docs/`, porque quem segue
 * é o dono, no meio de uma conversa com o parceiro.
 */

export const dynamic = "force-dynamic";

export default async function Parceiros() {
  const lista = await leParceiros();

  return (
    <Pagina
      trilha="Distribuição"
      titulo="Parceiros"
      subtitulo="Grupo de outra pessoa, com o nosso bot e a comissão na conta de afiliado dela."
      acoes={
        <Modal rotuloDoGatilho="Novo parceiro" titulo="Novo parceiro" largura="larga">
          <FormularioParceiro />
        </Modal>
      }
    >
      <Cartao>
        <h2 className="text-lg font-bold text-texto">Como colocar o grupo de um parceiro no ar</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-base leading-longo text-texto-medio">
          <li>
            <strong>Peça ao parceiro o ID de afiliado da Shopee</strong> (só número, uns 11
            dígitos). Nada de senha, nada de API: o ID basta para a comissão cair na conta dele.
          </li>
          <li>
            <strong>Peça para ele pôr o chip do bot no grupo</strong> e dar admin ao chip. O bot
            nunca pode ser o único admin.
          </li>
          <li>
            <strong>Cadastre o parceiro aqui</strong>, em “Novo parceiro”, com o ID da Shopee.
          </li>
          <li>
            <strong>Em Canais → Novo canal</strong>: plataforma WhatsApp, escolha o chip, escolha
            o grupo na lista (ela vem do próprio chip), marque o nicho e, em Parceiro, escolha
            ele.
          </li>
          <li>
            Pronto. Os links do grupo dele saem com o ID dele, só da Shopee. Oferta de loja em
            que ele não tem conta não sai no grupo dele, nunca com o seu ID.
          </li>
        </ol>
      </Cartao>

      <div className="mt-4 flex flex-col gap-4">
        {lista.length === 0 ? (
          <Cartao>
            <p className="text-base leading-longo text-texto-medio">
              Nenhum parceiro ainda. Todos os canais publicam com o seu ID.
            </p>
          </Cartao>
        ) : (
          lista.map((p) => <CartaoDoParceiro key={p.id} parceiro={p} />)
        )}
      </div>
    </Pagina>
  );
}

function CartaoDoParceiro({ parceiro }: { parceiro: Parceiro }) {
  const lojas = Object.entries(parceiro.contas);

  return (
    <Cartao>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-texto">{parceiro.nome}</h2>
          <p className="mt-1 text-sm text-texto-fraco">
            {parceiro.canais.length === 0
              ? "Nenhum canal ligado ainda"
              : `Canais: ${parceiro.canais.join(", ")}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lojas.length === 0 ? (
              <Chip tom="atencao">Sem conta: os canais dele saem com o SEU ID</Chip>
            ) : (
              lojas.map(([loja, id]) => (
                <Chip key={loja} tom="info">
                  {loja} · <span className="font-mono">{id}</span>
                </Chip>
              ))
            )}
          </div>
        </div>

        <Modal rotuloDoGatilho="Editar" titulo={`Editar ${parceiro.nome}`} largura="larga">
          <FormularioParceiro parceiro={parceiro} />
        </Modal>
      </div>
    </Cartao>
  );
}
