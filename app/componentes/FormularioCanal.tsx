"use client";

import { useActionState, useEffect, useState } from "react";
import {
  AcoesDoFormulario,
  Campo,
  CampoComUnidade,
  classeDeCampo,
  classeDeCampoNu,
  ValorCalculado,
} from "@/app/componentes/Campo";

import { salvaCanal, type ResultadoCanal } from "@/app/acoes/canais";
import { NICHOS, type CanalSimulado } from "@/lib/simulacao/loja";
import { Botao } from "@/app/componentes/Botao";
import { useFechaModal } from "@/app/componentes/Modal";
import { foraDePico, HORARIOS_SUGERIDOS, leHorarios, PICOS } from "@/lib/horarios";

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
  const [horarios, setHorarios] = useState(canal?.horarios ?? HORARIOS_SUGERIDOS);

  // Aviso, não impedimento: pode haver motivo para publicar fora do
  // pico, e o dono é quem sabe. O que não pode é ele não saber.
  const foraDosPicos = foraDePico(horarios);

  // O campo aceita texto livre, e por isso precisa devolver o que
  // entendeu. "9h" e "25:00" não são horário para `leHorarios`, e sem
  // este eco a pessoa sai achando que configurou o que não configurou.
  const horariosLidos = leHorarios(horarios);

  const [plataforma, setPlataforma] = useState<string>(canal?.plataforma ?? "whatsapp");

  const dono = 100 - audiencia - operacao;
  const erroDe = (campo: "nome" | "nichos" | "split" | "teto" | "horarios") =>
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

        {/*
          A dica antiga era "Telegram publica sozinho", e isso ainda
          não é verdade: o envio automático precisa de um bot e do
          chat_id do canal, que nenhum campo daqui pede — é trabalho da
          Fase 2. Prometer o que não existe faz o dono criar o canal e
          descobrir na hora errada, olhando um grupo mudo.
        */}
        <Campo
          rotulo="Plataforma"
          dica={
            plataforma === "telegram"
              ? "O envio automático pelo bot é da Fase 2. Até lá o Telegram sai na mão, igual ao WhatsApp."
              : "O envio é sempre na mão: o painel monta a mensagem e abre o WhatsApp com ela pronta."
          }
        >
          <select
            name="plataforma"
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value)}
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

        {/*
          O exemplo antigo era "09:00 e 18:00", e as 18h estão fora dos
          três picos de engajamento. Sugestão errada em campo de
          exemplo é pior que campo vazio: vira o padrão de quem não tem
          opinião formada.
        */}
        <Campo
          rotulo="Horários permitidos"
          dica={
            foraDosPicos.length > 0 || horariosLidos.length === 0
              ? undefined
              : `Entendi ${horariosLidos.join(", ")}. Picos: ${PICOS.map((p) => `${p.inicio}–${p.fim}`).join(", ")}. Fuso de São Paulo.`
          }
          erro={
            horariosLidos.length === 0
              ? `Não reconheci horário nenhum aqui, e canal sem horário não publica. Use horas de 00:00 a 23:59 — por exemplo "${HORARIOS_SUGERIDOS}".`
              : foraDosPicos.length > 0
                ? `Entendi ${horariosLidos.join(", ")}. ${foraDosPicos.join(", ")} ${foraDosPicos.length === 1 ? "está fora" : "estão fora"} dos picos (${PICOS.map((p) => `${p.inicio}–${p.fim}`).join(", ")}). Fora deles o engajamento cai bastante.`
                : erroDe("horarios")
          }
        >
          <input
            name="horarios"
            type="text"
            value={horarios}
            onChange={(e) => setHorarios(e.target.value)}
            placeholder={HORARIOS_SUGERIDOS}
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
            <CampoComUnidade unidade="%">
              <input
                name="split_audiencia"
                type="number"
                min={0}
                max={100}
                value={audiencia}
                onChange={(e) => setAudiencia(Number(e.target.value))}
                className={classeDeCampoNu}
              />
            </CampoComUnidade>
          </Campo>

          <Campo rotulo="Por operar">
            <CampoComUnidade unidade="%">
              <input
                name="split_operacao"
                type="number"
                min={0}
                max={100}
                value={operacao}
                onChange={(e) => setOperacao(Number(e.target.value))}
                className={classeDeCampoNu}
              />
            </CampoComUnidade>
          </Campo>

          {/* Resultado, não campo — e agora com cara de resultado. */}
          <ValorCalculado rotulo="Fica com você" alerta={dono < 0}>
            {dono}%
          </ValorCalculado>
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

