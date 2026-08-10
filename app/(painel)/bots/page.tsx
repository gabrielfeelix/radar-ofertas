import { alternaBot } from "@/app/acoes/bots";
import { Botao } from "@/app/componentes/Botao";
import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { Cartao } from "@/app/componentes/Cartao";
import { Chip, ChipDePlataforma } from "@/app/componentes/Chip";
import { FormularioBot } from "@/app/componentes/FormularioBot";
import { Modal } from "@/app/componentes/Modal";
import { QrCodeDoBot } from "@/app/componentes/QrCodeDoBot";
import { bots as leBots, type Bot } from "@/lib/bots";

/**
 * Bots — quem fala pelos canais.
 *
 * A tela responde três perguntas que nenhuma outra responde, e as três
 * aparecem em momentos previsíveis:
 *
 *   1. **Está de pé?** É a pergunta operacional do dia num sistema em
 *      que o número cai por projeto. Sem esta tela, a resposta exige
 *      abrir o painel da Evolution na VPS.
 *   2. **Em que dia do aquecimento?** O volume sobe por 14 dias, e sem
 *      um lugar que mostre, o teto do dia depende de alguém lembrar.
 *   3. **Quanto já falou hoje?** O teto é por número, somando todos os
 *      canais dele. É a soma que derruba a conta.
 *
 * O estado da conexão é lido AO VIVO a cada carregamento, e é por isso
 * que a página é dinâmica. Estado gravado mentiria: diria "conectado"
 * com o número já banido há seis horas.
 */

export const dynamic = "force-dynamic";

export default async function Bots() {
  const lista = await leBots();

  const ativos = lista.filter((b) => b.ativo);
  const conectados = lista.filter((b) => b.conexao?.ok).length;
  const doWhats = lista.filter((b) => b.plataforma === "whatsapp");
  const enviosHoje = lista.reduce((total, b) => total + b.enviadasHoje, 0);

  return (
    <Pagina
      trilha="Distribuição"
      titulo="Bots"
      subtitulo="Quem fala pelos canais. O teto de envios é contado por bot, e não por canal, porque é o número que cai."
      acoes={
        <Modal
          rotuloDoGatilho="Novo bot"
          titulo="Novo bot"
          largura="larga"
          descricao="Um chip de WhatsApp ou um bot de Telegram. O segredo nunca entra aqui: o campo pede o nome da variável de ambiente, não o valor."
        >
          <FormularioBot />
        </Modal>
      }
      kpis={[
        {
          rotulo: "Bots ativos",
          valor: `${ativos.length}`,
          nota: `${lista.length} no total`,
        },
        {
          rotulo: "Conectados agora",
          valor: doWhats.length === 0 ? "—" : `${conectados} de ${doWhats.length}`,
          nota: "lido ao vivo, nunca gravado",
        },
        {
          rotulo: "Envios hoje",
          valor: `${enviosHoje}`,
          nota: "somando todos os canais",
        },
      ]}
    >
      {lista.length === 0 ? (
        <Cartao>
          <p className="text-base leading-longo text-texto-medio">
            Nenhum bot cadastrado. Enquanto não houver um, os canais de WhatsApp ficam parados e o
            publicador registra o motivo no log de cada rodada.
          </p>
        </Cartao>
      ) : (
        <div className="flex flex-col gap-4">
          {lista.map((bot) => (
            <CartaoDoBot key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </Pagina>
  );
}

function CartaoDoBot({ bot }: { bot: Bot }) {
  const aquecendo = bot.diaDeAquecimento !== null && bot.diaDeAquecimento < 15;
  const noTeto = bot.enviadasHoje >= bot.tetoDeHoje;

  return (
    <Cartao tom={bot.ativo ? "normal" : "apagado"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-texto">{bot.nome}</h2>
            <ChipDePlataforma plataforma={bot.plataforma} />
            {!bot.ativo && <Chip tom="neutro">Desligado</Chip>}
          </div>

          <p className="mt-1 text-sm text-texto-fraco">
            {bot.identificador}
            {bot.instancia && ` · instância ${bot.instancia}`}
            {` · ${bot.canais} ${bot.canais === 1 ? "canal" : "canais"}`}
          </p>

          {/*
            A variável do segredo aparece porque é o que se confere
            quando o envio falha por autenticação: o nome tem que
            existir na Vercel e no GitHub. O valor não está aqui nem
            no banco.
          */}
          <p className="mt-1 text-sm text-texto-fraco">
            Segredo em <code className="font-mono">{bot.variavelDoSegredo}</code>
          </p>

          {bot.observacao && (
            <p className="mt-2 max-w-prose text-sm leading-longo text-texto-medio">
              {bot.observacao}
            </p>
          )}
        </div>

        <div className="flex flex-none flex-col items-end gap-2">
          <EstadoDaConexao bot={bot} />

          <p className="text-sm text-texto-fraco tabular-nums">
            {bot.enviadasHoje} de {bot.tetoDeHoje} hoje
          </p>

          {aquecendo && (
            <Chip tom="atencao">Dia {bot.diaDeAquecimento} de 14, aquecendo</Chip>
          )}
          {noTeto && bot.ativo && <Chip tom="atencao">Teto do dia batido</Chip>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-borda-sutil pt-4">
        <Modal
          rotuloDoGatilho="Editar"
          titulo={`Editar ${bot.nome}`}
          largura="larga"
          varianteDoGatilho="secundaria"
          tamanhoDoGatilho="sm"
        >
          <FormularioBot
            bot={{
              id: bot.id,
              nome: bot.nome,
              plataforma: bot.plataforma,
              identificador: bot.identificador,
              instancia: bot.instancia,
              variavelDoSegredo: bot.variavelDoSegredo,
              aquecimentoInicio: bot.aquecimentoInicio,
              enviosDiaMax: bot.enviosDiaMax,
              observacao: bot.observacao,
            }}
          />
        </Modal>

        {/*
          O QR Code só aparece quando a instância está fora. Botão de
          reconectar num chip conectado é convite a derrubar a sessão
          por curiosidade.
        */}
        {bot.plataforma === "whatsapp" && bot.instancia && bot.conexao?.ok === false && (
          <QrCodeDoBot instancia={bot.instancia} nome={bot.nome} />
        )}

        <form action={alternaBot} className="ml-auto">
          <input type="hidden" name="bot_id" value={bot.id} />
          <input type="hidden" name="ativo" value={bot.ativo ? "1" : "0"} />
          <Botao type="submit" variante="fantasma" tamanho="sm">
            {bot.ativo ? "Desligar" : "Ligar"}
          </Botao>
        </form>
      </div>
    </Cartao>
  );
}

/**
 * O estado da conexão, em três casos e não dois.
 *
 * "Não alcancei a Evolution" é diferente de "a instância está fora": o
 * primeiro é a VPS, o segundo é o chip. Achatar os dois em "offline"
 * manda consertar a coisa errada às 22h de um sábado.
 */
function EstadoDaConexao({ bot }: { bot: Bot }) {
  if (bot.conexao === null) {
    return bot.plataforma === "telegram" ? (
      <Chip tom="info">API oficial, não cai</Chip>
    ) : (
      <Chip tom="neutro">Sem instância cadastrada</Chip>
    );
  }

  if (bot.conexao.ok) return <Chip tom="sucesso">Conectado</Chip>;

  return (
    <div className="flex max-w-xs flex-col items-end gap-1">
      <Chip tom="perigo">Fora do ar</Chip>
      <p className="text-right text-xs leading-longo text-texto-fraco">{bot.conexao.motivo}</p>
    </div>
  );
}
