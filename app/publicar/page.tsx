import Link from "next/link";

import {
  cancelaEnvio,
  desfazEnvioDaPublicacao,
  publicaLoteTelegram,
  registraEnvioAutoDeclarado,
} from "@/app/acoes/publicacao";
import { AvisoSimulacao } from "@/app/componentes/AvisoSimulacao";
import { Botao, BotaoDePlataforma } from "@/app/componentes/Botao";
import { BotaoWhatsApp } from "@/app/componentes/BotaoWhatsApp";
import { CabecalhoDaPagina } from "@/app/componentes/CabecalhoDaPagina";
import { formataReais } from "@/lib/dinheiro";
import { publicacoesDaFila, type PublicacaoSimulada } from "@/lib/simulacao/loja";

/**
 * Publicar — a fila de envio.
 *
 * Esta tela é usada **em pé, com uma mão, de manhã**. É a única do
 * sistema com essa restrição, e ela é inegociável: o envio no
 * WhatsApp acontece no telefone porque é manual por decisão de
 * projeto.
 *
 * O trabalho diário precisa caber em dez minutos. Se passar disso, o
 * operador desiste em três semanas e o canal morre junto — é o modo
 * de morte mais provável do sistema, mais provável do que falta de
 * oferta. Daí as três escolhas de forma:
 *
 * TELEGRAM EM LOTE. O bot publica sozinho pela API oficial, então um
 * bloco "3 no Telegram — publicar todas" tira três itens do caminho
 * do polegar com um toque.
 *
 * DESFAZER, NÃO CONFIRMAR. Confirmação custa um toque em todos os
 * casos para proteger uns poucos.
 *
 * "JÁ ENVIEI" NO MENU SECUNDÁRIO. Sendo o atalho mais barato, ele
 * silenciaria o único sinal de supervisão sobre operador remoto.
 */

export const dynamic = "force-dynamic";

export default async function Publicar() {
  const todas = publicacoesDaFila();
  const pendentes = todas.filter((p) => !p.enviadaEm && !p.cancelada);
  const enviadas = todas.filter((p) => p.enviadaEm);

  const bloqueadas = pendentes.filter((p) => p.precoAgoraCentavos !== p.precoNaFilaCentavos);
  const prontas = pendentes.filter((p) => p.precoAgoraCentavos === p.precoNaFilaCentavos);

  const telegramProntas = prontas.filter((p) => p.canal.plataforma === "telegram");
  const whatsappProntas = prontas.filter((p) => p.canal.plataforma === "whatsapp");

  return (
    <>
      <CabecalhoDaPagina
        trilha="Hoje"
        titulo="Publicar"
        subtitulo={
          pendentes.length === 0
            ? "Nada esperando envio."
            : `${pendentes.length} ${pendentes.length === 1 ? "publicação" : "publicações"} esperando. O WhatsApp abre com a mensagem pronta — você aperta enviar.`
        }
      />

      <main className="flex w-full max-w-3xl flex-col gap-5 px-6 pt-5 pb-10">
      <AvisoSimulacao detalhe="Nada é publicado de verdade. O botão do WhatsApp abre o aplicativo com o texto, e o do Telegram só marca como enviado." />

      {pendentes.length === 0 && enviadas.length === 0 && (
        <div className="rounded-lg border border-dashed border-borda-forte p-8 text-center">
          <p className="text-md font-bold tracking-titulo">Nada para publicar agora.</p>
          <p className="mx-auto mt-2 max-w-md text-base text-texto-fraco">
            Fila vazia é sucesso, não erro — pode fechar o aplicativo em paz. O que for aprovado
            aparece aqui.
          </p>
          <Link
            href="/aprovar"
            className="mt-5 inline-block rounded-md border border-borda-forte bg-superficie px-5 py-4 text-md font-bold text-texto-medio"
          >
            Ver a fila de aprovação
          </Link>
        </div>
      )}

      {/*
        Telegram primeiro, e em bloco: é o que sai sem trabalho
        humano nenhum. Tirar essas do caminho antes deixa a tela só
        com o que exige o polegar.
      */}
      {telegramProntas.length > 0 && (
        <section className="rounded-lg border border-borda bg-superficie p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-md font-bold tracking-titulo">
                {telegramProntas.length} no Telegram
              </h2>
              <p className="mt-1 text-sm text-texto-fraco">
                O robô posta sozinho pela API oficial. Nenhum toque por item.
              </p>
            </div>
            <form action={publicaLoteTelegram}>
              <BotaoDePlataforma type="submit" plataforma="telegram">
                <span className="size-2 rounded-circulo bg-white/85" aria-hidden />
                Publicar todas
              </BotaoDePlataforma>
            </form>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {telegramProntas.map((publicacao) => (
              <li
                key={publicacao.id}
                className="flex flex-wrap items-center gap-3 rounded-md bg-superficie-alt px-4 py-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{publicacao.produto}</span>
                <span className="text-texto-fraco">{publicacao.canal.nome}</span>
                <span className="font-mono tabular-nums">
                  {formataReais(publicacao.precoNaFilaCentavos)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {whatsappProntas.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-md font-bold tracking-titulo">
            {whatsappProntas.length} no WhatsApp
            <span className="ml-2 text-base font-normal text-texto-fraco">
              uma de cada vez, na mão
            </span>
          </h2>
          {whatsappProntas.map((publicacao) => (
            <CartaoDeEnvio key={publicacao.id} publicacao={publicacao} />
          ))}
        </section>
      )}

      {bloqueadas.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-md font-bold tracking-titulo text-atencao">
            {bloqueadas.length} com preço mudado
          </h2>
          {bloqueadas.map((publicacao) => (
            <CartaoBloqueado key={publicacao.id} publicacao={publicacao} />
          ))}
        </section>
      )}

      {enviadas.length > 0 && (
        <section>
          <h2 className="mb-3 text-md font-bold tracking-titulo">
            Enviadas{" "}
            <span className="text-base font-normal text-texto-fraco">({enviadas.length})</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {enviadas.map((publicacao) => (
              <li
                key={publicacao.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-borda bg-superficie-alt px-4 py-3"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-sucesso" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-base">{publicacao.produto}</span>
                <span className="text-sm text-texto-fraco">
                  {publicacao.canal.nome}
                  {publicacao.origem === "auto_declarada" && " · auto-declarada"}
                </span>
                <form action={desfazEnvioDaPublicacao}>
                  <input type="hidden" name="publicacao_id" value={publicacao.id} />
                  <Botao type="submit" variante="fantasma" tamanho="sm">
                    desfazer
                  </Botao>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
      </main>
    </>
  );
}

function CartaoDeEnvio({ publicacao }: { publicacao: PublicacaoSimulada }) {
  return (
    <article className="rounded-lg border border-borda bg-superficie p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-sm bg-preenchimento px-2 py-1 text-xs font-semibold text-texto-medio">
          {publicacao.canal.nome}
        </span>
        <span className="text-sm text-texto-fraco">
          {publicacao.canal.audiencia.toLocaleString("pt-BR")} pessoas
        </span>
        <span className="ml-auto font-mono text-base font-bold tabular-nums">
          {formataReais(publicacao.precoNaFilaCentavos)}
        </span>
      </div>

      {/*
        A mensagem inteira fica à vista, não atrás de "ver prévia".
        É ela que vai para milhares de pessoas com o nome do canal em
        cima — esconder para economizar altura é economizar no lugar
        errado.
      */}
      <pre className="mt-4 whitespace-pre-wrap rounded-md bg-superficie-alt p-4 font-sans text-base leading-longo">
        {publicacao.mensagem}
      </pre>

      <div className="mt-4 flex flex-col gap-3">
        <BotaoWhatsApp publicacaoId={publicacao.id} mensagem={publicacao.mensagem} />

        {/*
          A ação honesta precisa ser mais barata que a auto-declarada.
          Por isso "já enviei" e "cancelar" ficam atrás de um toque a
          mais, e longe do botão principal: no protótipo eles eram
          vizinhos de 11px com efeitos opostos no dado.
        */}
        <details>
          <summary className="cursor-pointer list-none py-2 text-sm font-semibold text-texto-fraco">
            outras opções
          </summary>
          <div className="mt-2 flex flex-wrap gap-3">
            <form action={registraEnvioAutoDeclarado}>
              <input type="hidden" name="publicacao_id" value={publicacao.id} />
              <Botao type="submit" variante="fantasma" tamanho="sm">
                Já enviei por fora
              </Botao>
            </form>
            <form action={cancelaEnvio}>
              <input type="hidden" name="publicacao_id" value={publicacao.id} />
              <Botao type="submit" variante="perigo" tamanho="sm">
                Cancelar publicação
              </Botao>
            </form>
          </div>
        </details>
      </div>
    </article>
  );
}

/**
 * Publicação bloqueada por preço.
 *
 * Ela não oferece "publicar assim mesmo" nem "rejeitar": o operador
 * não é dono da curadoria, e deixá-lo com um item travado e só
 * "cancelar" como saída seria dar a ele um veto disfarçado. O item
 * volta sozinho para a aprovação.
 */
function CartaoBloqueado({ publicacao }: { publicacao: PublicacaoSimulada }) {
  const subiu = publicacao.precoAgoraCentavos > publicacao.precoNaFilaCentavos;

  return (
    <article className="rounded-lg border border-atencao-borda bg-atencao-fundo p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-sm border border-atencao-borda bg-superficie px-2 py-1 text-xs font-semibold text-atencao">
          {publicacao.canal.nome}
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-semibold">
          {publicacao.produto}
        </span>
      </div>

      <p className="mt-3 text-base">
        O preço {subiu ? "subiu" : "caiu"} de{" "}
        <span className="font-mono font-bold">{formataReais(publicacao.precoNaFilaCentavos)}</span>{" "}
        para{" "}
        <span className="font-mono font-bold">{formataReais(publicacao.precoAgoraCentavos)}</span>{" "}
        depois de entrar na fila.
      </p>
      <p className="mt-2 text-sm text-atencao">
        Não dá para publicar: preço morto queima o canal igual a preço falso. Esta voltou para a
        fila de aprovação, para ser decidida de novo com o preço de agora.
      </p>

      <Link
        href="/aprovar"
        className="mt-4 inline-block text-base font-semibold text-marca-texto underline"
      >
        Ver na aprovação
      </Link>
    </article>
  );
}
