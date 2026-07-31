"use client";

import { useActionState, useState } from "react";

import { salvaModelo, type ResultadoModelo } from "@/app/acoes/modelos";
import { Botao } from "@/app/componentes/Botao";
import { AcoesDoFormulario, Campo, classeDeCampo } from "@/app/componentes/Campo";
import { Cartao, RotuloDeSecao } from "@/app/componentes/Cartao";
import {
  afirmaMinimoSemLastro,
  EXEMPLO,
  identificacaoEstaEscondida,
  IDENTIFICACOES,
  previa,
  temIdentificacaoPublicitaria,
  VARIAVEIS,
  type ModeloDeMensagem,
} from "@/lib/mensagem";

/**
 * Editar o modelo, com a prévia ao lado.
 *
 * A PRÉVIA É AO VIVO, E É O PONTO DA TELA. O texto do modelo é cheio de
 * `{chave}` e não se parece com a mensagem que sai; sem ver o
 * resultado, a pessoa edita no escuro e descobre o erro no grupo.
 *
 * E ELA MOSTRA OS DOIS ESTADOS SEMPRE. Não é "escolha entre a redação
 * completa e a honesta" — pela regra 3.4, com menos de 14 dias de
 * série a honesta é obrigatória. O que a tela oferece é ver o que as
 * mesmas palavras viram quando o histórico não existe. A diferença
 * continua sendo escolhida conscientemente, mas dentro da regra em vez
 * de por cima dela.
 */
export function FormularioModelo({
  id,
  inicial,
}: {
  id: string;
  inicial: ModeloDeMensagem;
}) {
  const [resultado, acao, salvando] = useActionState<ResultadoModelo | null, FormData>(
    salvaModelo,
    null,
  );

  const [corpo, setCorpo] = useState(inicial.corpo);
  const [lastroCom, setLastroCom] = useState(inicial.lastroCom);
  const [lastroSem, setLastroSem] = useState(inicial.lastroSem);

  const textos = previa({ corpo, lastroCom, lastroSem }, EXEMPLO);
  const erroDe = (campo: "corpo" | "lastro_sem" | "geral") =>
    resultado?.ok === false && resultado.campo === campo ? resultado.mensagem : null;

  // O mesmo aviso da ação, mostrado enquanto se digita. A recusa mora
  // no servidor; isto aqui é só não deixar chegar lá sem saber.
  const violaAoVivo = afirmaMinimoSemLastro(lastroSem);

  // Regra 3.10, conferida enquanto se digita. São dois problemas
  // diferentes: não ter identificação, e tê-la onde ninguém lê.
  const semIdentificacao = !temIdentificacaoPublicitaria(corpo);
  const identificacaoEscondida = identificacaoEstaEscondida(corpo);
  const impedeSalvar = violaAoVivo || semIdentificacao || identificacaoEscondida;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form action={acao} className="flex flex-col gap-5">
        <input type="hidden" name="modelo_id" value={id} />

        <Campo
          rotulo="A mensagem"
          dica="As chaves viram dado na hora de publicar. O que não for chave conhecida fica no texto como está — de propósito, para o erro aparecer aqui e não no grupo."
          erro={erroDe("corpo")}
        >
          <textarea
            name="corpo"
            rows={10}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            className={`${classeDeCampo} resize-y leading-longo`}
          />
        </Campo>

        {(semIdentificacao || identificacaoEscondida) && (
          <p
            role="alert"
            className="rounded-md border border-perigo-borda bg-perigo-fundo px-3 py-2 text-sm leading-longo text-perigo"
          >
            {semIdentificacao ? (
              <>
                <strong>Falta dizer que é publicidade.</strong> Link de afiliado gera comissão, e
                conteúdo remunerado é publicidade — CONAR, CDC e a própria Shopee. Use{" "}
                {IDENTIFICACOES.join(", ")}.
              </>
            ) : (
              <>
                <strong>A identificação está escondida.</strong> Ela precisa aparecer nas primeiras
                linhas, sem a pessoa rolar a tela. No rodapé, depois do link, não conta.
              </>
            )}
          </p>
        )}

        <Cartao tom="apagado" espaco="sm">
          <RotuloDeSecao>o que dá para usar</RotuloDeSecao>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {VARIAVEIS.map((v) => (
              <li key={v.chave} className="text-sm">
                <code className="font-mono font-bold text-marca-texto">{`{${v.chave}}`}</code>{" "}
                <span className="text-texto-fraco">{v.explica}</span>
              </li>
            ))}
          </ul>
        </Cartao>

        <fieldset className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie-alt p-5">
          <legend className="sr-only">A frase do histórico</legend>
          <div>
            <p
              className="text-xs font-bold tracking-eyebrow text-texto-fraco uppercase"
              aria-hidden
            >
              a frase do histórico
            </p>
            <p className="mt-2 text-sm leading-longo text-texto-fraco">
              É o que <code className="font-mono">{"{lastro}"}</code> vira. O sistema escolhe
              sozinho qual das duas usar, pela série que o anúncio tem — você não escolhe na hora de
              publicar, e é isso que impede o erro.
            </p>
          </div>

          <Campo
            rotulo="Com 14 dias ou mais de série"
            dica="Aqui pode afirmar mínimo. Existe lastro para isso."
          >
            <input
              name="lastro_com"
              type="text"
              value={lastroCom}
              onChange={(e) => setLastroCom(e.target.value)}
              className={classeDeCampo}
            />
          </Campo>

          <Campo
            rotulo="Com menos de 14 dias"
            dica="Aqui não pode afirmar mínimo histórico — não temos como saber. A redação honesta traz a data em que começamos a observar."
            erro={erroDe("lastro_sem")}
          >
            <input
              name="lastro_sem"
              type="text"
              value={lastroSem}
              onChange={(e) => setLastroSem(e.target.value)}
              className={classeDeCampo}
            />
          </Campo>

          {violaAoVivo && !erroDe("lastro_sem") && (
            <p
              role="alert"
              className="rounded-md border border-perigo-borda bg-perigo-fundo px-3 py-2 text-sm text-perigo"
            >
              Isto afirma mínimo histórico, e este texto é usado justamente quando ainda não há
              série para afirmar. Não vai salvar.
            </p>
          )}
        </fieldset>

        {erroDe("geral") && <p className="text-base text-perigo">{erroDe("geral")}</p>}

        <AcoesDoFormulario>
          {resultado?.ok === true && (
            <span className="mr-auto text-sm font-semibold text-sucesso">salvo</span>
          )}
          <Botao type="submit" variante="primaria" disabled={salvando || impedeSalvar}>
            {salvando ? "Salvando…" : "Salvar modelo"}
          </Botao>
        </AcoesDoFormulario>
      </form>

      <div className="flex flex-col gap-4">
        <Previa
          titulo="Com série suficiente"
          nota="O anúncio tem 14 dias ou mais. A mensagem pode afirmar mínimo."
          tom="sucesso"
          texto={textos.comLastro}
        />
        <Previa
          titulo="Sem série suficiente"
          nota="O anúncio é novo no catálogo. É esta que sai na maior parte do primeiro mês."
          tom="atencao"
          texto={textos.semLastro}
        />
      </div>
    </div>
  );
}

function Previa({
  titulo,
  nota,
  tom,
  texto,
}: {
  titulo: string;
  nota: string;
  tom: "sucesso" | "atencao";
  texto: string;
}) {
  const cor =
    tom === "sucesso"
      ? "border-sucesso-borda bg-sucesso-fundo text-sucesso"
      : "border-atencao-borda bg-atencao-fundo text-atencao";

  return (
    <Cartao espaco="sm" className="flex flex-col gap-3">
      <div className={`-m-4 mb-0 rounded-t-lg border-b px-4 py-3 ${cor}`}>
        <p className="text-base font-bold tracking-titulo">{titulo}</p>
        <p className="mt-1 text-sm">{nota}</p>
      </div>
      {/*
        A mensagem em fonte de conversa, dentro de uma bolha, e não num
        bloco de código: o que importa é como ela chega no telefone de
        quem lê, não como ela é armazenada.
      */}
      <p className="rounded-md rounded-tl-xs bg-preenchimento px-4 py-3 text-base leading-longo whitespace-pre-wrap">
        {texto}
      </p>
    </Cartao>
  );
}
