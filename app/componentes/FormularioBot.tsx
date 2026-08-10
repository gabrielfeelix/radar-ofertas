"use client";

import { useActionState, useEffect, useState } from "react";

import { salvaBot, type ResultadoBot } from "@/app/acoes/bots";
import { Botao } from "@/app/componentes/Botao";
import { AcoesDoFormulario, Campo, classeDeCampo } from "@/app/componentes/Campo";
import { useFechaModal } from "@/app/componentes/Modal";

/**
 * Formulário de bot — o mesmo para criar e para editar.
 *
 * Duas coisas nele não são decoração:
 *
 * O CAMPO DO SEGREDO PEDE O NOME DA VARIÁVEL, não o valor, e a dica diz
 * isso com todas as letras. É o tipo de campo em que a pessoa cola o
 * token por hábito, e o token no banco é exatamente o que o desenho
 * evita.
 *
 * A DATA DE AQUECIMENTO É OBRIGATÓRIA no WhatsApp porque é ela que
 * define a rampa. Descobrir que ela faltava no dia 1 é descobrir tarde.
 */

export type BotEditavel = {
  id: string;
  nome: string;
  plataforma: string;
  identificador: string;
  instancia: string | null;
  variavelDoSegredo: string;
  aquecimentoInicio: string | null;
  enviosDiaMax: number;
  observacao: string | null;
};

export function FormularioBot({ bot }: { bot?: BotEditavel }) {
  const [resultado, acao, salvando] = useActionState<ResultadoBot | null, FormData>(
    salvaBot,
    null,
  );

  const fechaModal = useFechaModal();

  useEffect(() => {
    if (resultado?.ok) fechaModal();
  }, [resultado, fechaModal]);

  const [plataforma, setPlataforma] = useState<string>(bot?.plataforma ?? "whatsapp");
  const ehWhats = plataforma === "whatsapp";

  const erroDe = (campo: "nome" | "identificador" | "instancia" | "aquecimento" | "teto") =>
    resultado?.ok === false && resultado.campo === campo ? resultado.mensagem : null;

  return (
    <form action={acao} className="flex flex-col gap-5">
      {bot && <input type="hidden" name="bot_id" value={bot.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Nome do bot" erro={erroDe("nome")}>
          <input
            name="nome"
            type="text"
            required
            defaultValue={bot?.nome}
            placeholder="Radar 01"
            className={classeDeCampo}
          />
        </Campo>

        <Campo
          rotulo="Plataforma"
          dica={
            ehWhats
              ? "Chip dedicado e descartável. Nunca o número pessoal nem o de trabalho, e nunca o único admin do grupo."
              : "Bot da API oficial. Não cai, não aquece e não tem teto de número."
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
        rotulo={ehWhats ? "Número do chip" : "Usuário do bot"}
        dica={
          ehWhats
            ? "Só para você reconhecer qual chip é. Quem publica é a instância, abaixo."
            : "O @ do bot no Telegram."
        }
        erro={erroDe("identificador")}
      >
        <input
          name="identificador"
          type="text"
          required
          defaultValue={bot?.identificador}
          placeholder={ehWhats ? "+55 44 90000-0000" : "@radar_bot"}
          className={classeDeCampo}
        />
      </Campo>

      {ehWhats && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Instância na Evolution"
            dica="O nome que você deu à instância na Evolution API. É por ele que o publicador chama a VPS."
            erro={erroDe("instancia")}
          >
            <input
              name="instancia"
              type="text"
              defaultValue={bot?.instancia ?? ""}
              placeholder="radar01"
              className={classeDeCampo}
            />
          </Campo>

          <Campo
            rotulo="Primeiro dia do chip"
            dica="O dia 1 da rampa: 10 promos no dia 1, 15 no 2, 20 no 3, 25 no 4, e 30 do 5º ao 14º. Do 15º em diante vale o teto abaixo."
            erro={erroDe("aquecimento")}
          >
            <input
              name="aquecimento_inicio"
              type="date"
              defaultValue={bot?.aquecimentoInicio ?? ""}
              className={classeDeCampo}
            />
          </Campo>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          rotulo="Teto de envios por dia"
          dica="Somando TODOS os canais deste bot, porque é o número que cai, não o canal. Número maduro aguenta menos de 200 por dia e menos de 30 por hora."
          erro={erroDe("teto")}
        >
          <input
            name="envios_dia_max"
            type="number"
            min={1}
            defaultValue={bot?.enviosDiaMax ?? 150}
            className={classeDeCampo}
          />
        </Campo>

        <Campo
          rotulo="Variável do segredo"
          dica="O NOME da variável de ambiente, não o valor. O token e a apikey ficam na Vercel e no GitHub, nunca no banco."
        >
          <input
            name="variavel_do_segredo"
            type="text"
            defaultValue={
              bot?.variavelDoSegredo ?? (ehWhats ? "WHATSAPP_API_KEY" : "TELEGRAM_BOT_TOKEN")
            }
            className={classeDeCampo}
          />
        </Campo>
      </div>

      <Campo
        rotulo="Observação"
        dica="Onde o chip está, quem é o segundo admin dos grupos, o que aconteceu quando ele caiu. É o que a próxima pessoa vai querer saber."
      >
        <textarea
          name="observacao"
          rows={2}
          defaultValue={bot?.observacao ?? ""}
          className={classeDeCampo}
        />
      </Campo>

      <AcoesDoFormulario>
        <Botao type="submit" variante="primaria" disabled={salvando}>
          {salvando ? "Salvando…" : bot ? "Salvar bot" : "Criar bot"}
        </Botao>

        {resultado?.ok === true && (
          <span className="text-base text-sucesso">
            {bot ? "Salvo." : "Bot criado. Agora aponte um canal para ele."}
          </span>
        )}
      </AcoesDoFormulario>
    </form>
  );
}
