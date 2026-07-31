import Link from "next/link";

import { removeExcecao } from "@/app/acoes/ajustes";
import { Botao } from "@/app/componentes/Botao";
import { Cartao, RotuloDeSecao } from "@/app/componentes/Cartao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { CampoDeLimiar } from "@/app/componentes/CampoDeLimiar";
import { Modal } from "@/app/componentes/Modal";
import { formataLimiar, montaQuadroDaCuradoria, type Limiar } from "@/lib/curadoria";
import type { NichoLinha } from "@/lib/supabase/tipos";

/**
 * As três perguntas que a curadoria faz, e quais limiares respondem
 * cada uma.
 *
 * A ordem dentro de cada família vai do que se mexe mais para o que se
 * mexe menos. Limiar que não estiver listado aqui não some da tela: cai
 * na última família, que é onde ele fica visível até alguém decidir a
 * casa dele.
 */
const FAMILIAS: { titulo: string; porque: string; chaves: string[] }[] = [
  {
    titulo: "quando um preço vira oferta",
    porque: "O que separa queda de verdade de oscilação normal e de promoção de etiqueta.",
    chaves: [
      "desconto_minimo_pct",
      "recorrencia_maxima_pct",
      "janela_referencia_dias",
      "janela_minimo_dias",
    ],
  },
  {
    titulo: "quando dá para confiar no que vemos",
    porque:
      "Série curta e vendedor sem reputação fazem o desconto ser o que a loja diz que é, não o que nós observamos.",
    chaves: [
      "dias_minimos_de_serie",
      "dias_para_afirmar",
      "avaliacao_minima",
      "reputacao_minima",
    ],
  },
  {
    titulo: "o que paga o espaço, e o que cansa o grupo",
    porque:
      "Oferta que rende pouco não paga o post; oferta repetida ou velha cobra caro na paciência de quem lê.",
    chaves: [
      "comissao_minima_centavos",
      "dias_recompra_mesmo_anuncio",
      "horas_validade_oferta",
    ],
  },
];

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
        medida="media"
        /*
          O efeito da curadoria sai da faixa de cima e vira coluna.

          Ele era três caixas no topo que rolavam para fora da tela no
          primeiro limiar — e a promessa escrita no subtítulo é que o
          efeito fica AO LADO do controle. Colada no rolar, a coluna
          cumpre a frase: ajustar o desconto no oitavo cartão continua
          mostrando a taxa que aquele ajuste move.
        */
        contexto={
          <EfeitoDaCuradoria
            aprovadas={aprovadas}
            totalReprovado={totalReprovado}
            taxa={taxa}
            motorRodou={motorRodou}
            dias={dias}
          />
        }
      >

        <p className="rounded-md border border-atencao-borda bg-atencao-fundo px-4 py-3 text-base text-atencao">
          Alterar um limiar <strong>não reprocessa oferta já decidida</strong>. Vale da próxima
          detecção em diante.
        </p>

        {/*
          Em famílias, e não numa pilha só.

          Eram onze cartões idênticos empilhados, cada um com o seu
          botão de salvar — na captura de tela a página vira uma coluna
          de retângulos iguais, sem nenhum lugar onde o olho descanse, e
          quem procura "aquele limiar do preço" lê os onze títulos.

          A divisão não é estética: são as três perguntas diferentes que
          a curadoria faz. Um limiar de série responde "dá para confiar
          no que vejo?", e um de recorrência responde "isto cansa o
          grupo?" — misturá-los é o que faz alguém apertar o desconto
          quando o problema era repetição.
        */}
        {FAMILIAS.map((familia, indice) => {
          const daFamilia = limiares.filter((l) => familia.chaves.includes(l.chave));

          // Limiar novo, ainda sem família, entra na última em vez de
          // sumir da tela. Some seria pior que ficar no lugar errado:
          // um limiar invisível continua reprovando oferta.
          if (indice === FAMILIAS.length - 1) {
            const semFamilia = limiares.filter(
              (l) => !FAMILIAS.some((f) => f.chaves.includes(l.chave)),
            );
            daFamilia.push(...semFamilia);
          }

          if (daFamilia.length === 0) return null;

          return (
            <section key={familia.titulo} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <RotuloDeSecao>{familia.titulo}</RotuloDeSecao>
                <p className="text-base text-texto-fraco">{familia.porque}</p>
              </div>
              <ul className="flex flex-col gap-3">
                {daFamilia.map((limiar) => (
                  <li key={limiar.chave}>
                    <CartaoDoLimiar limiar={limiar} nichos={nichos} dias={dias} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

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

/**
 * O efeito da curadoria, na coluna da direita.
 *
 * As três medidas respondem à mesma pergunta em ordem: quanto passou,
 * quanto barrou, e o que a razão entre as duas diz. A taxa é a única
 * que muda de cor, porque é a única em que existe valor errado — perto
 * de zero é limiar apertado demais, alta demais é curadoria virando
 * carimbo. Aprovadas e reprovadas sozinhas não têm valor bom nem ruim.
 */
function EfeitoDaCuradoria({
  aprovadas,
  totalReprovado,
  taxa,
  motorRodou,
  dias,
}: {
  aprovadas: number;
  totalReprovado: number;
  taxa: number;
  motorRodou: boolean;
  dias: number;
}) {
  if (!motorRodou) {
    return (
      <Cartao espaco="md" className="flex flex-col gap-3">
        <RotuloDeSecao>efeito em {dias} dias</RotuloDeSecao>
        <p className="text-md leading-longo font-semibold text-texto-medio">
          O motor ainda não rodou nenhuma vez.
        </p>
        <p className="text-base leading-longo text-texto-fraco">
          Sem execução não existe taxa, e ajustar limiar agora é ajustar no escuro — zero de zero
          não é curadoria rígida, é ausência de dado.
        </p>
      </Cartao>
    );
  }

  const alerta = taxa === 0 || taxa > 40;

  return (
    <Cartao espaco="md" className="flex flex-col gap-4">
      <RotuloDeSecao>efeito em {dias} dias</RotuloDeSecao>

      <div className="flex flex-col gap-1">
        <p
          className={`text-3xl leading-titulo font-extrabold tabular-nums tracking-titulo ${
            alerta ? "text-atencao" : ""
          }`}
        >
          {taxa}%
        </p>
        <p className="text-base text-texto-fraco">
          {taxa === 0
            ? "nada passa: limiar apertado demais?"
            : taxa > 40
              ? "alta: a curadoria está virando carimbo?"
              : "dentro do esperado"}
        </p>
      </div>

      {/*
        A barra é a mesma razão do número, em forma. Ela existe porque
        "18%" e "82%" viram a mesma coisa depois do terceiro limiar
        ajustado — a proporção se lembra, o número não.
      */}
      <span className="flex h-2 overflow-hidden rounded-xs bg-preenchimento" aria-hidden>
        <span className="block h-2 bg-sucesso" style={{ width: `${taxa}%` }} />
      </span>

      <dl className="flex flex-col gap-2 text-base">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-texto-fraco">aprovadas</dt>
          <dd className="font-bold tabular-nums">{aprovadas}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-texto-fraco">reprovadas</dt>
          <dd className="font-bold tabular-nums">{totalReprovado}</dd>
        </div>
      </dl>
    </Cartao>
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
    <article className="rounded-lg border border-borda-sutil bg-superficie shadow-repouso p-5">
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
            <div className="mt-3">
              <Modal
                rotuloDoGatilho="+ exceção para um nicho"
                varianteDoGatilho="fantasma"
                tamanhoDoGatilho="sm"
                titulo={`Exceção de ${limiar.rotulo.toLowerCase()}`}
                largura="media"
                descricao="Vale só para o nicho escolhido. Os outros continuam seguindo o valor global, e mudam junto quando ele mudar."
              >
                <ul className="flex flex-col gap-3">
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
              </Modal>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
