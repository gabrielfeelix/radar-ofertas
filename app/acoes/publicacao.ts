"use server";

import { revalidatePath } from "next/cache";

import {
  buscaPublicacao,
  cancelaPublicacao,
  desfazCancelamento,
  desfazEnvio,
  devolveParaAprovacao,
  marcaEnviada,
  publicacoesDaFila,
  vagasDoCanal,
} from "@/lib/publicacoes";
import { instanciaDoBot } from "@/lib/bots";
import { montaMensagem } from "@/lib/mensagem";
import { modeloDoCanal } from "@/lib/modelo";
import { usuarioAtual } from "@/lib/sessao";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { publicaComFoto } from "@/lib/telegram";
import { saiComCardDeLink } from "@/lib/texto-whatsapp";
import { publicaNoWhatsApp } from "@/lib/whatsapp";

/**
 * Ações da fila de publicação.
 *
 * A regra 3.2 do AGENTS.md atravessava este arquivo inteiro: nada
 * aqui enviava no WhatsApp, o sistema montava o texto e um humano
 * apertava enviar. **Mudou em 06/08** (D-071): a ação de lote publica
 * nas duas plataformas, o Telegram pela API oficial e o WhatsApp pela
 * Evolution API na VPS.
 *
 * O `BotaoWhatsApp` continua existindo e continua abrindo o `wa.me`.
 * Ele não é resto: é o caminho de quando o chip cai, e cair é
 * esperado. Enquanto o número novo aquece, a operação não para.
 *
 * A regra que sustenta isso: envio que falha **não é marcado como
 * enviado**. A publicação fica na fila com o motivo à vista. Marcar
 * assim mesmo esvaziaria a tela deixando o canal mudo — o pior
 * desfecho possível, porque parece sucesso.
 */

/** Registra o envio feito pelo fluxo — o operador passou pelo botão. */
export async function registraEnvio(form: FormData): Promise<void> {
  const id = String(form.get("publicacao_id") ?? "");
  if (id === "") return;

  const publicacao = await buscaPublicacao(id);
  if (!publicacao) return;

  // Preço morto queima o canal na mesma proporção que preço falso.
  // Se mudou entre a fila e o envio, a ação recusa — a tela já
  // avisa, e isto é a garantia de que avisar não é só decoração.
  if (publicacao.precoAgoraCentavos !== publicacao.precoNaFilaCentavos) return;

  // Teto é limite real, não sugestão.
  if ((await vagasDoCanal(publicacao.canal.id)) <= 0) return;

  const usuario = await usuarioAtual();
  await marcaEnviada(id, "fluxo", undefined, usuario?.id);
  revalidatePath("/publicar");
  revalidatePath("/canais");
}

/**
 * Publica em lote, na plataforma que o canal for.
 *
 * Um bloco "12 no canal, publicar todas" é um toque, e tira 12 itens
 * do caminho do polegar. Chamava-se `publicaLoteTelegram` e só servia
 * o Telegram, porque a regra 3.2 proibia o resto (D-071).
 */
export async function publicaLote(form: FormData): Promise<void> {
  const canalAlvo = String(form.get("canal_id") ?? "");
  const usuario = await usuarioAtual();

  // O modelo é lido por canal, dentro do laço: canais diferentes falam
  // línguas diferentes, e um modelo lido antes do laço daria o texto do
  // primeiro canal a todos.
  const modelos = new Map<string, Awaited<ReturnType<typeof modeloDoCanal>>>();

  /*
    O FREIO DO CARD DE LINK (migration 63), lido UMA vez para o lote.

    Ao contrário do teto de vagas, que é recontado a cada item porque
    cada envio o consome, este não muda no meio de um lote: é
    configuração, e reler por item seria uma consulta por mensagem sem
    nada em troca. Ausente vale 1, que é o comportamento novo.
  */
  const { data: linhaCard } = await supabaseServidor()
    .from("parametro")
    .select("valor")
    .eq("chave", "whatsapp_link_preview")
    .is("nicho_id", null)
    .maybeSingle();
  const cardDeLinkLigado = Number(linhaCard?.valor ?? 1) === 1;

  // O teto é recontado a cada item, e não lido uma vez antes do laço:
  // cada envio consome uma vaga, e um teto lido de véspera deixaria o
  // botão que existe para poupar toque ser justamente o que estoura o
  // combinado com o parceiro.
  for (const publicacao of await publicacoesDaFila()) {
    if (canalAlvo !== "" && publicacao.canal.id !== canalAlvo) continue;
    if (publicacao.enviadaEm || publicacao.cancelada) continue;
    if (publicacao.precoAgoraCentavos !== publicacao.precoNaFilaCentavos) continue;
    if ((await vagasDoCanal(publicacao.canal.id)) <= 0) continue;

    /*
      SEM LINK RASTREADO, NÃO SAI.

      Duas coisas se somavam aqui, e juntas mandaram nove publicações
      repetidas ao canal em 01/08:

      1. o link ia montado à mão, e link montado não paga comissão
         (D-034) — a mensagem chegava com um link que abre o produto
         direto, sem passar pela página do afiliado;
      2. o banco então recusava marcar a linha como enviada, porque a
         constraint exige `link_afiliado` — e a tela dizia "não
         enviada", convidando a clicar de novo.

      Parar antes de enviar corta as duas: a oferta fica na fila, com o
      motivo à vista, até o gerador produzir o link.
    */
    if (!publicacao.link.rastreado) continue;

    // O texto é montado ANTES de enviar e gravado como saiu. Remontar
    // depois daria outra mensagem, porque o modelo muda — e a que foi
    // ao canal é a que precisa ser auditável, inclusive para provar a
    // identificação publicitária da regra 3.10.
    if (!modelos.has(publicacao.canal.id)) {
      modelos.set(publicacao.canal.id, await modeloDoCanal(publicacao.canal.id));
    }
    const modelo = modelos.get(publicacao.canal.id)!;

    const texto = montaMensagem(modelo, {
      ...publicacao.dadosDaMensagem,
      link: publicacao.link.url,
    });

    const envio =
      publicacao.canal.plataforma === "whatsapp"
        ? await publicaNoWhatsApp(
            // O canal guarda o bot; quem publica precisa do nome da
            // instância na Evolution. Vazio significa canal sem chip
            // cadastrado, e `publicaNoWhatsApp` devolve isso como erro
            // de configuração em vez de tentar a rede.
            await instanciaDoBot(publicacao.canal.botId),
            publicacao.canal.whatsappGrupoId ?? "",
            texto,
            publicacao.imagemUrl,
            // O mesmo critério do publicador automático (migration 63):
            // nas lojas cujo link já traz `og:image`, sai texto com card
            // em vez de foto anexada, para não encher a galeria de quem
            // lê. A decisão mora em `lib/texto-whatsapp.ts` justamente
            // para os dois caminhos não divergirem.
            saiComCardDeLink(publicacao.marketplaceSlug, cardDeLinkLigado),
          )
        : await publicaComFoto(
            publicacao.canal.telegramChatId ?? "",
            texto,
            publicacao.imagemUrl,
          );

    // Falhou: NÃO marca como enviada. A publicação fica na fila com o
    // motivo à vista. Marcar assim mesmo esvaziaria a tela deixando o
    // canal mudo, que é o pior desfecho possível.
    if (!envio.ok) continue;

    /*
      O `messageId` é guardado aqui pelo mesmo motivo do laço
      automático: sem ele não há como apagar o post depois.

      O do WhatsApp é `text` e o do Telegram é `number`, e eles moram em
      colunas diferentes — `marcaEnviada` decide pela plataforma do
      canal, não por quem chamou.
    */
    await marcaEnviada(publicacao.id, "fluxo", texto, usuario?.id, envio.messageId);
  }

  revalidatePath("/publicar");
  revalidatePath("/canais");
}

/**
 * "Já enviei" — envio que aconteceu fora do fluxo.
 *
 * Fica no menu secundário de propósito. Sendo o atalho mais barato
 * da tela, ele silencia o único sinal de supervisão sobre operador
 * remoto: a origem fica gravada separada, e publicação auto-declarada
 * sem nenhum clique em 24 horas vira item em "Precisa de atenção".
 * Não é prova, é o sinal certo no lugar certo.
 */
export async function registraEnvioAutoDeclarado(form: FormData): Promise<void> {
  const id = String(form.get("publicacao_id") ?? "");
  if (id === "") return;

  const usuario = await usuarioAtual();
  await marcaEnviada(id, "auto_declarada", undefined, usuario?.id);
  revalidatePath("/publicar");
  revalidatePath("/canais");
}

export async function desfazEnvioDaPublicacao(form: FormData): Promise<void> {
  await desfazEnvio(String(form.get("publicacao_id") ?? ""));
  revalidatePath("/publicar");
  revalidatePath("/canais");
}

export async function cancelaEnvio(form: FormData): Promise<void> {
  await cancelaPublicacao(String(form.get("publicacao_id") ?? ""));
  revalidatePath("/publicar");
}

/** Cancelar também tem volta: é decisão interna, nada saiu daqui. */
export async function desfazCancelamentoDaPublicacao(form: FormData): Promise<void> {
  await desfazCancelamento(String(form.get("publicacao_id") ?? ""));
  revalidatePath("/publicar");
}

/**
 * Devolve para a aprovação a publicação travada por preço.
 *
 * A tela dizia que o item "voltou para a fila de aprovação" e nada
 * voltava — ele ficava travado para sempre, e o operador não tem como
 * resolver, porque não é dele a decisão de curadoria. Agora volta de
 * verdade, e volta com o preço de agora, que é sobre o que a decisão
 * nova precisa acontecer.
 */
export async function devolveOfertaParaAprovacao(form: FormData): Promise<void> {
  const ofertaId = String(form.get("oferta_id") ?? "");
  if (ofertaId === "") return;

  await devolveParaAprovacao(ofertaId);

  revalidatePath("/publicar");
  revalidatePath("/aprovar");
}
