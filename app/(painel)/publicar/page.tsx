import { Identidade } from "@/app/componentes/Identidade";
import Link from "next/link";

import {
  cancelaEnvio,
  desfazCancelamentoDaPublicacao,
  desfazEnvioDaPublicacao,
  devolveOfertaParaAprovacao,
  publicaLote,
  registraEnvioAutoDeclarado,
} from "@/app/acoes/publicacao";
import { Botao, BotaoDePlataforma } from "@/app/componentes/Botao";
import { BotaoWhatsApp } from "@/app/componentes/BotaoWhatsApp";
import { Cartao, RotuloDeSecao } from "@/app/componentes/Cartao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { formataReais } from "@/lib/dinheiro";
import { montaMensagem, type ModeloDeMensagem } from "@/lib/mensagem";
import { intercalaPorVariedade, repeticoesSeguidas } from "@/lib/variedade";
import { modeloGlobal } from "@/lib/modelo";
import { vagasDoCanal, type Canal } from "@/lib/distribuicao";
import { publicacoesDaFila, type Publicacao } from "@/lib/publicacoes";

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

  const todas = await publicacoesDaFila();
  const pendentes = todas.filter((p) => !p.enviadaEm && !p.cancelada);
  const enviadas = todas.filter((p) => p.enviadaEm);
  const canceladas = todas.filter((p) => p.cancelada);

  const bloqueadas = pendentes.filter((p) => p.precoAgoraCentavos !== p.precoNaFilaCentavos);
  const prontas = pendentes.filter((p) => p.precoAgoraCentavos === p.precoNaFilaCentavos);

  // Agrupa preservando a ordem em que as publicações entraram.
  const porCanal = new Map<string, { canal: Canal; itens: Publicacao[] }>();
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
            : "As duas plataformas saem sozinhas. O botão do WhatsApp continua ali para quando o chip cair."
        }
        /*
          O quanto falta sai do topo e vira coluna, colada no rolar.

          Ele era uma faixa acima da fila: no primeiro item já tinha
          rolado para fora da tela, e "faltam 5 de 8" existe justamente
          para dar noção de fim no meio do trabalho — no terceiro item
          uma fila de oito parece infinita. Fora da vista, ele não
          fazia o trabalho dele.
        */
        contexto={
          total > 0 ? (
            <ProgressoDoDia
              feitas={feitas}
              total={total}
              pendentes={pendentes.length}
              canceladas={canceladas.length}
            />
          ) : undefined
        }
      >

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
/**
 * O quanto falta, na coluna da direita.
 *
 * A medida que importa aqui não é quanto já saiu — é **quanto falta**,
 * porque é ela que responde "dá para terminar antes do café esfriar?".
 * Por isso o número grande é o que resta, e o que já foi feito vira
 * linha de apoio.
 */
function ProgressoDoDia({
  feitas,
  total,
  pendentes,
  canceladas,
}: {
  feitas: number;
  total: number;
  pendentes: number;
  canceladas: number;
}) {
  const pct = Math.round((feitas / total) * 100);

  return (
    <Cartao espaco="md" className="flex flex-col gap-4">
      <RotuloDeSecao>a fila de hoje</RotuloDeSecao>

      <div className="flex flex-col gap-1">
        <p className="text-3xl leading-titulo font-extrabold tabular-nums tracking-titulo">
          {pendentes === 0 ? "Tudo publicado" : pendentes}
        </p>
        {pendentes > 0 && (
          <p className="text-base text-texto-fraco">
            {pendentes === 1 ? "esperando envio" : "esperando envio"}, de {total}
          </p>
        )}
      </div>

      <span className="flex h-2 overflow-hidden rounded-xs bg-preenchimento" aria-hidden>
        <span className="block h-2 bg-marca" style={{ width: `${pct}%` }} />
      </span>

      <dl className="flex flex-col gap-2 text-base">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-texto-fraco">enviadas</dt>
          <dd className="font-bold tabular-nums">{feitas}</dd>
        </div>
        {canceladas > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-texto-fraco">canceladas</dt>
            <dd className="font-bold tabular-nums">{canceladas}</dd>
          </div>
        )}
      </dl>

      <p className="border-t border-borda-sutil pt-3 text-sm leading-longo text-texto-fraco">
        Os dois saem em lote, num toque por canal. No WhatsApp o robô fala pelo chip cadastrado no
        canal; se ele estiver fora, use o botão de abrir o aplicativo.
      </p>
    </Cartao>
  );
}

function GrupoDoCanal({
  canal,
  itens,
  modelo,
}: {
  canal: Canal;
  itens: Publicacao[];
  modelo: ModeloDeMensagem;
}) {
  const vagas = vagasDoCanal(canal);
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
    <section className="rounded-lg border border-borda-sutil bg-superficie shadow-repouso">
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
        Publicação em lote: o robô resolve o canal inteiro num toque.

        Era só Telegram, porque a regra 3.2 proibia o WhatsApp
        automático. Desde a D-071 vale para os dois.
      */}
      {itens.length > 1 && vagas > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda-sutil px-5 py-4">
          <p className="text-sm text-texto-fraco">
            O robô posta sozinho. Nenhum toque por item.
          </p>
          <form action={publicaLote}>
            <input type="hidden" name="canal_id" value={canal.id} />
            <BotaoDePlataforma type="submit" plataforma={canal.plataforma}>
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
  publicacao: Publicacao;
  cabeHoje: boolean;
  modelo: ModeloDeMensagem;
}) {
  // O link do redirecionador ainda não existe — falta domínio. O subid
  // é real desde já, e é ele que liga a venda ao canal.
  const texto = montaMensagem(modelo, {
    ...publicacao.dadosDaMensagem,
    link: publicacao.link.url,
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
        <div className="flex flex-wrap items-center gap-3">
          <form action={publicaLote}>
            <input type="hidden" name="canal_id" value={publicacao.canal.id} />
            <BotaoDePlataforma type="submit" plataforma={publicacao.canal.plataforma}>
              <span className="size-2 rounded-circulo bg-white/85" aria-hidden />
              Publicar no {publicacao.canal.plataforma === "whatsapp" ? "WhatsApp" : "Telegram"}
            </BotaoDePlataforma>
          </form>

          {/*
            O caminho manual sobrevive à D-071, e não é resto: quando o
            chip cai, ele é a operação. O número novo leva 14 dias para
            aquecer, e o canal não pode ficar mudo esse tempo todo.
          */}
          {publicacao.canal.plataforma === "whatsapp" && (
            <BotaoWhatsApp publicacaoId={publicacao.id} mensagem={texto} />
          )}
        </div>
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
        {/*
          O botão é vermelho e some com o item da fila, o que o faz
          parecer definitivo — e não é: ele cai em "Canceladas", no pé
          da tela, com "devolver para a fila". Dizer isso aqui é mais
          barato que um diálogo de confirmação, que custaria um toque
          em todo mundo para proteger quem errou o dedo.
        */}
        <p className="mt-2 text-sm text-texto-fraco">
          Cancelar não apaga: a publicação cai em <strong>Canceladas</strong>, no fim desta tela, e
          volta para a fila num toque.
        </p>
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
function CartaoBloqueado({ publicacao }: { publicacao: Publicacao }) {
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
