import { Identidade } from "@/app/componentes/Identidade";
import Link from "next/link";

import {
  cancelaEnvio,
  desfazCancelamentoDaPublicacao,
  desfazEnvioDaPublicacao,
  devolveOfertaParaAprovacao,
  publicaLoteTelegram,
  registraEnvioAutoDeclarado,
} from "@/app/acoes/publicacao";
import { AvisoSimulacao } from "@/app/componentes/AvisoSimulacao";
import { Botao, BotaoDePlataforma } from "@/app/componentes/Botao";
import { BotaoWhatsApp } from "@/app/componentes/BotaoWhatsApp";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { formataReais } from "@/lib/dinheiro";
import { montaMensagem, type ModeloDeMensagem } from "@/lib/mensagem";
import { intercalaPorVariedade, repeticoesSeguidas } from "@/lib/variedade";
import { modeloGlobal } from "@/lib/modelo";
import {
  publicacoesDaFila,
  vagasDoCanal,
  type CanalSimulado,
  type PublicacaoSimulada,
} from "@/lib/simulacao/loja";

/**
 * Publicar — a fila de envio.
 *
 * Usada **em pé, com uma mão, de manhã**, e o trabalho precisa caber
 * em dez minutos. Se passar disso, o operador desiste em três semanas
 * e o canal morre junto — é o modo de morte mais provável do sistema,
 * mais provável que falta de oferta.
 *
 * AGRUPADA POR CANAL, e não por plataforma. Publicar é um ato por
 * canal: quem está no telefone abre um aplicativo, cola, volta.
 * Agrupar por plataforma obrigaria a pular de canal em canal dentro do
 * mesmo bloco, que é troca de contexto a cada item.
 *
 * COM QUANTO FALTA NO TOPO. "Faltam 5 de 8" é o que dá ao operador a
 * noção de fim — sem isso, uma fila de oito parece infinita no
 * terceiro item.
 */

export const dynamic = "force-dynamic";

export default async function Publicar() {
  // O texto sai do modelo que o dono edita em Ajustes, e não de uma
  // função dentro do código. Sem banco, cai no de partida — a fila não
  // pode ficar sem mensagem só porque o Docker está parado.
  const modelo = await modeloGlobal();

  const todas = publicacoesDaFila();
  const pendentes = todas.filter((p) => !p.enviadaEm && !p.cancelada);
  const enviadas = todas.filter((p) => p.enviadaEm);
  const canceladas = todas.filter((p) => p.cancelada);

  const bloqueadas = pendentes.filter((p) => p.precoAgoraCentavos !== p.precoNaFilaCentavos);
  const prontas = pendentes.filter((p) => p.precoAgoraCentavos === p.precoNaFilaCentavos);

  // Agrupa preservando a ordem em que as publicações entraram.
  const porCanal = new Map<string, { canal: CanalSimulado; itens: PublicacaoSimulada[] }>();
  for (const publicacao of prontas) {
    const grupo = porCanal.get(publicacao.canal.id) ?? { canal: publicacao.canal, itens: [] };
    grupo.itens.push(publicacao);
    porCanal.set(publicacao.canal.id, grupo);
  }

  const feitas = enviadas.length;
  const total = feitas + pendentes.length;

  return (
    <>
      <Pagina
        trilha="Hoje"
        titulo="Publicar"
        medida="media"
        subtitulo={
          pendentes.length === 0
            ? "Nada esperando envio."
            : "O WhatsApp abre com a mensagem pronta — você aperta enviar. O Telegram sai sozinho."
        }
      >
        <AvisoSimulacao detalhe="Nada é publicado de verdade. O botão do WhatsApp abre o aplicativo com o texto, e o do Telegram só marca como enviado." />

        {total > 0 && (
          <section className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-md font-extrabold tracking-titulo">
                {pendentes.length === 0
                  ? "Tudo publicado"
                  : `Faltam ${pendentes.length} de ${total}`}
              </p>
              <p className="text-sm text-texto-fraco">
                {feitas} {feitas === 1 ? "enviada" : "enviadas"}
              </p>
            </div>
            <span className="h-2 rounded-xs bg-preenchimento" aria-hidden>
              <span
                className="block h-2 rounded-xs bg-marca"
                style={{ width: `${Math.round((feitas / total) * 100)}%` }}
              />
            </span>
          </section>
        )}

        {total === 0 && (
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

        {[...porCanal.values()].map((grupo) => (
          <GrupoDoCanal key={grupo.canal.id} canal={grupo.canal} itens={grupo.itens} modelo={modelo} />
        ))}

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
                  <span className="size-2 shrink-0 rounded-circulo bg-sucesso" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-base">{publicacao.produto}</span>
                  <span className="text-sm text-texto-fraco">
                    {publicacao.canal.nome}
                    {/*
                      Origem auto-declarada aparece marcada, e nunca
                      somada no mesmo contador da que passou pelo fluxo:
                      é o único sinal de supervisão sobre operador
                      remoto que o sistema tem.
                    */}
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

        {canceladas.length > 0 && (
          <section>
            <h2 className="mb-3 text-md font-bold tracking-titulo text-texto-fraco">
              Canceladas ({canceladas.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {canceladas.map((publicacao) => (
                <li
                  key={publicacao.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-borda px-4 py-3 text-texto-fraco"
                >
                  <span className="min-w-0 flex-1 truncate text-base line-through">
                    {publicacao.produto}
                  </span>
                  <span className="text-sm">{publicacao.canal.nome}</span>
                  <form action={desfazCancelamentoDaPublicacao}>
                    <input type="hidden" name="publicacao_id" value={publicacao.id} />
                    <Botao type="submit" variante="fantasma" tamanho="sm">
                      devolver para a fila
                    </Botao>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Pagina>
    </>
  );
}

/**
 * Um canal, com o que falta sair nele.
 *
 * O teto aparece no cabeçalho do grupo porque é limite real: quando
 * as vagas acabam, o resto espera amanhã, e é melhor saber disso antes
 * de publicar do que depois de explicar ao parceiro.
 */
function GrupoDoCanal({
  canal,
  itens,
  modelo,
}: {
  canal: CanalSimulado;
  itens: PublicacaoSimulada[];
  modelo: ModeloDeMensagem;
}) {
  const vagas = vagasDoCanal(canal.id);
  const cabemHoje = Math.min(vagas, itens.length);
  const paraAmanha = itens.length - cabemHoje;

  /*
    A ordem sai daqui, e não da nota. Ofertas parecidas pontuam
    parecido — desconto, comissão e reputação andam juntos dentro do
    mesmo nicho e faixa de preço — então ordenar por nota agrupa o
    semelhante justamente no topo. Oito variações da mesma coisa em
    sequência é uma das cinco causas de morte de um grupo
    (`docs/pesquisa-operacao.md`).

    Nada é descartado: só muda a ordem em que sai.
  */
  const paraVariedade = itens.map((p) => ({
    grupo: p.nicho,
    precoCentavos: p.precoNaFilaCentavos,
    publicacao: p,
  }));
  const emOrdem = intercalaPorVariedade(paraVariedade).map((x) => x.publicacao);
  const aindaRepetidas = repeticoesSeguidas(
    emOrdem.slice(0, cabemHoje).map((p) => ({ grupo: p.nicho, precoCentavos: p.precoNaFilaCentavos })),
  );

  return (
    <section className="rounded-lg border border-borda bg-superficie">
      <header className="flex flex-wrap items-center gap-3 border-b border-borda bg-superficie-alt px-5 py-3">
        <span
          className={`size-2 rounded-circulo ${
            canal.plataforma === "telegram" ? "bg-telegram" : "bg-whatsapp"
          }`}
          aria-hidden
        />
        <h2 className="text-base font-bold tracking-titulo">{canal.nome}</h2>
        <span className="rounded-pilula border border-borda bg-superficie px-3 py-1 text-xs font-semibold text-texto-fraco">
          {canal.plataforma === "telegram" ? "Telegram" : "WhatsApp"}
        </span>
        <span className={`ml-auto text-sm ${vagas === 0 ? "text-atencao" : "text-texto-fraco"}`}>
          {vagas === 0
            ? `teto de ${canal.tetoDiario} atingido hoje`
            : `${vagas} de ${canal.tetoDiario} vagas hoje`}
        </span>
      </header>

      {paraAmanha > 0 && (
        <p className="border-b border-borda-sutil bg-atencao-fundo px-5 py-3 text-sm text-atencao">
          {cabemHoje === 0
            ? `As ${itens.length} ficam para amanhã: o teto combinado com o parceiro já foi usado hoje.`
            : `Cabem ${cabemHoje} hoje. As outras ${paraAmanha} ficam para amanhã, respeitando o teto.`}
        </p>
      )}

      {/*
        Quando não deu para variar, isso é dito. Não é defeito do
        sistema — é o catálogo do dia sendo monótono. Sem o aviso, o
        dono olha oito ofertas parecidas em sequência e conclui que a
        ordenação está quebrada, quando ela está mostrando a verdade.
      */}
      {aindaRepetidas > 0 && (
        <p className="border-b border-borda-sutil px-5 py-3 text-sm text-texto-fraco">
          A ordem intercala nicho e faixa de preço, mas{" "}
          <strong className="font-semibold text-texto-medio">
            {aindaRepetidas} {aindaRepetidas === 1 ? "publicação sai" : "publicações saem"} parecida
            {aindaRepetidas === 1 ? "" : "s"} com a anterior
          </strong>{" "}
          — não há variedade suficiente na fila de hoje. Repetir o mesmo assunto em sequência é uma
          das razões que fazem membro silenciar o grupo.
        </p>
      )}

      {/*
        Telegram em lote: o robô publica sozinho pela API oficial, e um
        bloco resolve o canal inteiro num toque. Não fere a regra do
        WhatsApp — ela restringe só o WhatsApp.
      */}
      {canal.plataforma === "telegram" && itens.length > 1 && vagas > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda-sutil px-5 py-4">
          <p className="text-sm text-texto-fraco">
            O robô posta sozinho. Nenhum toque por item.
          </p>
          <form action={publicaLoteTelegram}>
            <input type="hidden" name="canal_id" value={canal.id} />
            <BotaoDePlataforma type="submit" plataforma="telegram">
              <span className="size-2 rounded-circulo bg-white/85" aria-hidden />
              Publicar as {cabemHoje}
            </BotaoDePlataforma>
          </form>
        </div>
      )}

      <ul className="flex flex-col">
        {emOrdem.map((publicacao, indice) => (
          <li key={publicacao.id} className="border-b border-borda-sutil last:border-0">
            <CartaoDeEnvio publicacao={publicacao} cabeHoje={indice < cabemHoje} modelo={modelo} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CartaoDeEnvio({
  publicacao,
  cabeHoje,
  modelo,
}: {
  publicacao: PublicacaoSimulada;
  cabeHoje: boolean;
  modelo: ModeloDeMensagem;
}) {
  // O link do redirecionador ainda não existe — falta domínio. O subid
  // é real desde já, e é ele que liga a venda ao canal.
  const texto = montaMensagem(modelo, {
    ...publicacao.dadosDaMensagem,
    link: `${process.env.URL_BASE_REDIRECIONADOR ?? "https://link.pendente"}/${publicacao.subid}`,
  });

  return (
    <article className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-4">
        <Identidade nome={publicacao.produto} forma="caixa" tamanho="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-base font-bold leading-titulo tracking-titulo">{publicacao.produto}</p>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-extrabold tracking-titulo tabular-nums">
              {formataReais(publicacao.precoNaFilaCentavos)}
            </span>
          </p>
        </div>
      </div>

      {/*
        A mensagem inteira fica à vista, não atrás de "ver prévia". É
        ela que vai para milhares de pessoas com o nome do canal em
        cima — esconder para economizar altura é economizar no lugar
        errado.
      */}
      <pre className="whitespace-pre-wrap rounded-md bg-superficie-alt p-4 font-sans text-base leading-longo">
        {texto}
      </pre>

      {cabeHoje ? (
        publicacao.canal.plataforma === "whatsapp" ? (
          <BotaoWhatsApp publicacaoId={publicacao.id} mensagem={texto} />
        ) : (
          <form action={publicaLoteTelegram}>
            <input type="hidden" name="canal_id" value={publicacao.canal.id} />
            <BotaoDePlataforma type="submit" plataforma="telegram">
              <span className="size-2 rounded-circulo bg-white/85" aria-hidden />
              Publicar no Telegram
            </BotaoDePlataforma>
          </form>
        )
      ) : (
        <p className="rounded-md border border-borda bg-superficie-alt px-4 py-3 text-sm text-texto-fraco">
          Fica para amanhã: o teto do canal já foi usado hoje.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {/*
          O subid é o que liga a venda ao canal. Fica à vista porque,
          quando uma comissão não casar, é o primeiro lugar em que se
          olha.
        */}
        <span className="rounded-sm border border-borda-sutil bg-fundo px-2 py-1 font-mono text-xs text-texto-fraco">
          subid {publicacao.subid}
        </span>
        <span className="text-xs text-texto-fraco">preço conferido agora</span>
      </div>

      <details>
        <summary className="cursor-pointer list-none py-2 text-sm font-semibold text-texto-fraco">
          outras opções
        </summary>
        <div className="mt-2 flex flex-wrap gap-3">
          {/*
            A ação honesta precisa ser mais barata que a auto-declarada:
            "já enviei" custa um toque a mais, e fica longe do botão
            principal. No protótipo, "Já enviei" e "Cancelar" eram
            vizinhos de 11px com efeitos opostos no dado.
          */}
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
    </article>
  );
}

/**
 * Publicação bloqueada por preço.
 *
 * Ela não oferece "publicar assim mesmo" nem "rejeitar": o operador
 * não é dono da curadoria, e deixá-lo com um item travado e só
 * "cancelar" como saída seria dar a ele um veto disfarçado. O botão
 * devolve a oferta para a aprovação, com o preço de agora.
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
        <span className="font-bold tabular-nums">{formataReais(publicacao.precoNaFilaCentavos)}</span>{" "}
        para{" "}
        <span className="font-bold tabular-nums">{formataReais(publicacao.precoAgoraCentavos)}</span>{" "}
        depois de entrar na fila.
      </p>
      <p className="mt-2 text-sm text-atencao">
        Não dá para publicar: preço morto queima o canal igual a preço falso. A decisão é de quem
        aprova, não de quem publica.
      </p>

      <form action={devolveOfertaParaAprovacao} className="mt-4">
        <input type="hidden" name="oferta_id" value={publicacao.ofertaId} />
        <Botao type="submit" variante="secundaria">
          Devolver para a aprovação
        </Botao>
      </form>
    </article>
  );
}
