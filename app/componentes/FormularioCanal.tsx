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
import type { Canal } from "@/lib/distribuicao";
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

export function FormularioCanal({
  canal,
  nichos,
  bots = [],
}: {
  canal?: Canal;
  /** Os nichos que existem no banco. Sem eles o canal não roteia nada. */
  nichos: { slug: string; nome: string }[];
  /**
   * Os bots ativos de WhatsApp. Lista vazia é estado legítimo: antes
   * do primeiro chip cadastrado não há o que escolher, e o campo diz
   * isso em vez de mostrar um seletor vazio sem explicação.
   */
  bots?: { id: string; nome: string; plataforma: string; identificador: string }[];
}) {
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
  const erroDe = (
    campo:
      | "nome"
      | "nichos"
      | "split"
      | "teto"
      | "horarios"
      | "telegram"
      | "whatsapp_grupo"
      | "bot",
  ) =>
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
          Esta dica dizia "o envio automático é da Fase 2", e deixou de
          ser verdade em 01/08: o bot existe e a fila publica sozinha no
          Telegram. Faltava o campo do identificador do canal, sem o
          qual o banco recusava a linha — e o erro chegava como "não
          consegui salvar", que não diz o que fazer.

          E o WhatsApp deixou de ser manual em 06/08 (D-071). A regra
          3.2 proibia automatizar para proteger o número; o dono assumiu
          o risco e a conta dos chips. Agora ele também pede cadastro:
          o grupo e QUAL chip fala por ele.
        */}
        <Campo
          rotulo="Plataforma"
          dica={
            plataforma === "telegram"
              ? "O bot publica sozinho, pela API oficial. Ele precisa ser administrador do canal, com “Publicar mensagens” ligado."
              : "O bot publica sozinho pela Evolution API. O número do bot NUNCA pode ser o único admin do grupo: quando ele cair, é o outro admin que segura a audiência."
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

      {plataforma === "telegram" && (
        <Campo
          rotulo="Canal no Telegram"
          dica="É para onde o bot publica. Use @nomedocanal, ou o id numérico se o canal for privado."
          erro={erroDe("telegram")}
        >
          <input
            name="telegram_chat_id"
            type="text"
            defaultValue={canal?.telegramChatId ?? ""}
            placeholder="@radarpet"
            className={classeDeCampo}
          />
        </Campo>
      )}

      {plataforma === "whatsapp" && (
        <>
          <Campo
            rotulo="Grupo no WhatsApp"
            dica="O JID do grupo, copiado do painel da Evolution. Termina em @g.us."
            erro={erroDe("whatsapp_grupo")}
          >
            <input
              name="whatsapp_grupo_id"
              type="text"
              defaultValue={canal?.whatsappGrupoId ?? ""}
              placeholder="120363000000000000@g.us"
              className={classeDeCampo}
            />
          </Campo>

          <Campo
            rotulo="Chip que publica aqui"
            dica="Qual número fala por este canal. O teto de envios do dia é contado por chip, somando todos os canais dele: é o chip que cai, não o canal."
            erro={erroDe("bot")}
          >
            {bots.filter((b) => b.plataforma === "whatsapp").length === 0 ? (
              /*
                Sem bot cadastrado, um seletor vazio não diz o que
                fazer. O canal pode ser salvo assim: ele fica parado
                até ganhar um chip, e o publicador registra o motivo
                no log da rodada.
              */
              <p className="text-sm leading-longo text-texto-fraco">
                Nenhum chip cadastrado ainda. Cadastre um em Bots e volte aqui: sem chip, este canal
                fica parado.
              </p>
            ) : (
              <select name="bot_id" defaultValue={canal?.botId ?? ""} className={classeDeCampo}>
                <option value="">Sem chip, canal parado</option>
                {bots
                  .filter((b) => b.plataforma === "whatsapp")
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome} · {b.identificador}
                    </option>
                  ))}
              </select>
            )}
          </Campo>
        </>
      )}

      <Campo
        rotulo="Nichos que este canal aceita"
        dica="É o que roteia oferta para cá. Canal sem nicho não recebe nada e fica no painel parecendo que funciona."
        erro={erroDe("nichos")}
      >
        <div className="flex flex-wrap gap-3">
          {nichos.map((nicho) => (
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

