"use client";

import { useActionState, useEffect, useState } from "react";
import { AcoesDoFormulario, classeDeCampo } from "@/app/componentes/Campo";

import { salvaCanal, type ResultadoCanal } from "@/app/acoes/canais";
import { NICHOS, type CanalSimulado } from "@/lib/simulacao/loja";
import { Botao } from "@/app/componentes/Botao";
import { useFechaModal } from "@/app/componentes/Modal";

/**
 * Formulário de canal — o mesmo para criar e para editar.
 *
 * Duas coisas que a tela mostra e não são decoração:
 *
 * A PARTE DO DONO É CALCULADA À VISTA, enquanto se digita. Split é o
 * campo em que o erro só aparece meses depois, no primeiro repasse,
 * quando já foi combinado com alguém.
 *
 * O TETO DIÁRIO VEM ACOMPANHADO DO QUE ELE SIGNIFICA em publicações
 * por semana. "8 por dia" não diz nada; "56 por semana" diz.
 */

export function FormularioCanal({ canal }: { canal?: CanalSimulado }) {
  const [resultado, acao, salvando] = useActionState<ResultadoCanal | null, FormData>(
    salvaCanal,
    null,
  );

  const fechaModal = useFechaModal();

  // Deu certo: fecha o modal, quando existe um. A confirmação é o item
  // aparecendo na lista atrás — mais forte que uma linha verde dentro
  // de um painel que some em seguida.
  useEffect(() => {
    if (resultado?.ok) fechaModal();
  }, [resultado, fechaModal]);

  const [audiencia, setAudiencia] = useState(canal?.splitAudienciaPct ?? 0);
  const [operacao, setOperacao] = useState(canal?.splitOperacaoPct ?? 0);
  const [teto, setTeto] = useState(canal?.tetoDiario ?? 6);

  const dono = 100 - audiencia - operacao;
  const erroDe = (campo: "nome" | "nichos" | "split" | "teto") =>
    resultado?.ok === false && resultado.campo === campo ? resultado.mensagem : null;

  return (
    <form action={acao} className="flex flex-col gap-5">
      {canal && <input type="hidden" name="canal_id" value={canal.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Nome do canal" erro={erroDe("nome")}>
          <input
            name="nome"
            type="text"
            required
            defaultValue={canal?.nome}
            placeholder="Achados de Pet"
            className={classeDeCampo}
          />
        </Campo>

        <Campo rotulo="Plataforma" dica="Telegram publica sozinho. WhatsApp é sempre na mão.">
          <select
            name="plataforma"
            defaultValue={canal?.plataforma ?? "whatsapp"}
            className={classeDeCampo}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
          </select>
        </Campo>
      </div>

      <Campo
        rotulo="Nichos que este canal aceita"
        dica="É o que roteia oferta para cá. Canal sem nicho não recebe nada e fica no painel parecendo que funciona."
        erro={erroDe("nichos")}
      >
        <div className="flex flex-wrap gap-3">
          {NICHOS.map((nicho) => (
            <label
              key={nicho.slug}
              className="flex items-center gap-2 rounded-md border border-borda bg-superficie px-4 py-3 text-base"
            >
              <input
                type="checkbox"
                name="nicho"
                value={nicho.slug}
                defaultChecked={canal?.nichos.includes(nicho.slug)}
                className="size-4 accent-marca"
              />
              {nicho.nome}
            </label>
          ))}
        </div>
      </Campo>

      <div className="grid gap-5 sm:grid-cols-3">
        <Campo
          rotulo="Teto de posts por dia"
          dica={`${teto * 7} por semana. É limite real: a fila respeita, não avisa depois de estourar.`}
          erro={erroDe("teto")}
        >
          <input
            name="teto_diario"
            type="number"
            min={1}
            max={50}
            required
            value={teto}
            onChange={(e) => setTeto(Number(e.target.value))}
            className={classeDeCampo}
          />
        </Campo>

        <Campo rotulo="Audiência estimada" dica="Só para dimensionar. Ninguém é cadastrado.">
          <input
            name="audiencia"
            type="number"
            min={0}
            defaultValue={canal?.audiencia ?? 0}
            className={classeDeCampo}
          />
        </Campo>

        <Campo
          rotulo="Horários permitidos"
          dica="Fuso de São Paulo, ainda que tudo seja gravado em UTC."
        >
          <input
            name="horarios"
            type="text"
            defaultValue={canal?.horarios}
            placeholder="09:00 e 18:00"
            className={classeDeCampo}
          />
        </Campo>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Parceiro" dica="Quem traz a audiência. Pode ser você.">
          <input
            name="parceiro"
            type="text"
            defaultValue={canal?.parceiro ?? "você"}
            className={classeDeCampo}
          />
        </Campo>

        <Campo rotulo="Operador" dica="Quem publica todo dia. Pode ser a mesma pessoa.">
          <input
            name="operador"
            type="text"
            defaultValue={canal?.operador ?? "você"}
            className={classeDeCampo}
          />
        </Campo>
      </div>

      {/*
        Duas parcelas separadas, nunca um número só. A mesma pessoa
        pode trazer a audiência e operar, ou só trazer — e os dois
        arranjos convivem. A parte do dono é o que sobra, e por isso
        não é campo: se fosse, os três poderiam somar 97.
      */}
      {/*
        Continua `<fieldset>`, que é o que agrupa campos relacionados
        para o leitor de tela — mas a `<legend>` visível é montada pelo
        navegador sobre a borda, fora do fluxo, e nunca combina com o
        resto. Tirá-la do fluxo à mão (com `float`) quebra a grade que
        vem depois. Então: legenda só para quem ouve, rótulo comum para
        quem vê, com o mesmo desenho de qualquer outra seção.
      */}
      <fieldset className="rounded-lg border border-borda bg-superficie-alt p-5">
        <legend className="sr-only">Divisão da comissão</legend>
        <p className="mb-4 text-xs font-bold tracking-eyebrow text-texto-fraco uppercase" aria-hidden>
          Divisão da comissão
        </p>

        <div className="grid gap-5 sm:grid-cols-3">
          <Campo rotulo="Por trazer a audiência">
            <input
              name="split_audiencia"
              type="number"
              min={0}
              max={100}
              value={audiencia}
              onChange={(e) => setAudiencia(Number(e.target.value))}
              className={classeDeCampo}
            />
          </Campo>

          <Campo rotulo="Por operar">
            <input
              name="split_operacao"
              type="number"
              min={0}
              max={100}
              value={operacao}
              onChange={(e) => setOperacao(Number(e.target.value))}
              className={classeDeCampo}
            />
          </Campo>

          <div>
            <span className="mb-2 block text-base font-semibold">Fica com você</span>
            <p
              className={`rounded-md px-4 py-3 text-base font-bold tabular-nums ${
                dono < 0 ? "bg-perigo-fundo text-perigo" : "bg-superficie text-texto"
              }`}
            >
              {dono}%
            </p>
          </div>
        </div>

        {dono < 0 && (
          <p className="mt-3 text-base text-perigo">
            As parcelas somam {audiencia + operacao}%. O que passa de 100% é dinheiro que não
            existe.
          </p>
        )}
        {erroDe("split") && <p className="mt-3 text-base text-perigo">{erroDe("split")}</p>}
      </fieldset>

      <AcoesDoFormulario>
        <Botao type="submit" variante="primaria" disabled={salvando || dono < 0}>
          {salvando ? "Salvando…" : canal ? "Salvar canal" : "Criar canal"}
        </Botao>

        {resultado?.ok === true && (
          <span className="text-base text-sucesso">
            {canal ? "Salvo." : "Canal criado. Já entra na capacidade da aprovação."}
          </span>
        )}
      </AcoesDoFormulario>
    </form>
  );
}

function Campo({
  rotulo,
  dica,
  erro,
  children,
}: {
  rotulo: string;
  dica?: string;
  erro?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-base font-semibold">{rotulo}</span>
      {children}
      {erro ? (
        <p className="mt-2 text-base text-perigo">{erro}</p>
      ) : dica ? (
        <p className="mt-2 text-sm text-texto-fraco">{dica}</p>
      ) : null}
    </label>
  );
}
