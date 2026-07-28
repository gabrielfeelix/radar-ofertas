"use client";

import { useActionState, useState } from "react";

import { salvaCanal, type ResultadoCanal } from "@/app/acoes/canais";
import { NICHOS, type CanalSimulado } from "@/lib/simulacao/loja";
import { Botao } from "@/app/componentes/Botao";

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
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base"
          />
        </Campo>

        <Campo rotulo="Plataforma" dica="Telegram publica sozinho. WhatsApp é sempre na mão.">
          <select
            name="plataforma"
            defaultValue={canal?.plataforma ?? "whatsapp"}
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base"
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
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 font-mono text-base"
          />
        </Campo>

        <Campo rotulo="Audiência estimada" dica="Só para dimensionar. Ninguém é cadastrado.">
          <input
            name="audiencia"
            type="number"
            min={0}
            defaultValue={canal?.audiencia ?? 0}
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 font-mono text-base"
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
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base"
          />
        </Campo>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Parceiro" dica="Quem traz a audiência. Pode ser você.">
          <input
            name="parceiro"
            type="text"
            defaultValue={canal?.parceiro ?? "você"}
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base"
          />
        </Campo>

        <Campo rotulo="Operador" dica="Quem publica todo dia. Pode ser a mesma pessoa.">
          <input
            name="operador"
            type="text"
            defaultValue={canal?.operador ?? "você"}
            className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 text-base"
          />
        </Campo>
      </div>

      {/*
        Duas parcelas separadas, nunca um número só. A mesma pessoa
        pode trazer a audiência e operar, ou só trazer — e os dois
        arranjos convivem. A parte do dono é o que sobra, e por isso
        não é campo: se fosse, os três poderiam somar 97.
      */}
      <fieldset className="rounded-lg border border-borda bg-superficie-alt p-5">
        <legend className="px-2 text-base font-bold">Divisão da comissão</legend>

        <div className="grid gap-5 sm:grid-cols-3">
          <Campo rotulo="Por trazer a audiência">
            <input
              name="split_audiencia"
              type="number"
              min={0}
              max={100}
              value={audiencia}
              onChange={(e) => setAudiencia(Number(e.target.value))}
              className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 font-mono text-base"
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
              className="w-full rounded-md border border-borda-forte bg-superficie px-4 py-3 font-mono text-base"
            />
          </Campo>

          <div>
            <span className="mb-2 block text-base font-semibold">Fica com você</span>
            <p
              className={`rounded-md px-4 py-3 font-mono text-base font-bold tabular-nums ${
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

      <div className="flex items-center gap-4">
        <Botao type="submit" variante="primaria" tamanho="lg" disabled={salvando || dono < 0}>
          {salvando ? "Salvando…" : canal ? "Salvar canal" : "Criar canal"}
        </Botao>

        {resultado?.ok === true && (
          <span className="text-base text-sucesso">
            {canal ? "Salvo." : "Canal criado. Já entra na capacidade da aprovação."}
          </span>
        )}
      </div>
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
