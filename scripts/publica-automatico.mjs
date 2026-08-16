/**
 * O laço automático: da oferta detectada até a mensagem no canal.
 *
 * **NÃO HÁ APROVAÇÃO HUMANA AQUI, E É DE PROPÓSITO** (D-033). Decisão
 * do dono em 01/08: *"ninguém vai ficar na minha equipe vasculhando
 * sobre o vendedor"*. Quem aprova são as comportas, e elas são números
 * em `parametro`, ajustáveis sem publicar versão.
 *
 * A tela `/aprovar` continua existindo e não é mais o caminho. Ela vira
 * conferência do que já saiu.
 *
 * O QUE ELE FAZ, em ordem:
 *
 *   1. pega as ofertas novas
 *   2. reprova as que não passam nas comportas de confiança
 *   3. cria a publicação nos canais elegíveis, com subid
 *   4. monta a fila de envio: o cupom primeiro, depois as ofertas
 *   5. publica DORMINDO entre os posts, no ritmo do canal
 *
 * **O WHATSAPP ENTRA AQUI DESDE 06/08** (D-071). Até então não entrava,
 * e o motivo não era técnico: a regra 3.2 mandava o sistema montar o
 * texto e um humano apertar enviar, para não arriscar o número. O dono
 * assumiu o risco e a conta: *"n ligo de derrubar conta do numero, vou
 * ir comprando varios"*. Não existe API oficial para grupo, então o
 * caminho é a Evolution API na VPS, e o número cai um dia — o desenho
 * é para isso custar um chip, não a operação (ver `lib/whatsapp.ts`).
 *
 * QUATRO TRAVAS, porque publicação sem ninguém olhando precisa delas:
 * `publicacao_automatica = 0` é o freio de mão geral,
 * `whatsapp_automatico = 0` é o freio só do WhatsApp,
 * `whatsapp_envios_dia_max` é o teto POR CHIP, e o intervalo do ritmo
 * impede despejar a fila inteira de uma vez.
 */

import { createClient } from "@supabase/supabase-js";

import { geraLinks } from "../lib/gerador-ml.ts";
import { montaLinkDeAfiliado } from "../lib/afiliado.ts";
import { classificaFalhaDeLink } from "../lib/falha-de-link.ts";
import { geraLinkCurtoDaShopee, itemDaShopee } from "../lib/shopee-api.ts";
import { revalidaPreco } from "../lib/revalida-preco.ts";
import { montaMensagem, montaMensagemDeCupom } from "../lib/mensagem.ts";
import { paraWhatsApp, saiComCardDeLink } from "../lib/texto-whatsapp.ts";
import {
  RITMO_PADRAO,
  dentroDaJanelaDoDia,
  diaEmSaoPaulo,
  horaEmSaoPaulo,
  inicioDoDiaEmSaoPaulo,
  podeChipFalarAgora,
  podePublicarAgora,
} from "../lib/ritmo.ts";
import { diaDoAquecimento, tetoDoDia, porHoraDoDia } from "../lib/aquecimento.ts";
import { geraGancho } from "../lib/gancho.ts";

/*
  Bot sem data de aquecimento é bot de Telegram, ou um chip cadastrado
  antes de a rampa existir. Tratar como já aquecido é o certo: a rampa
  protege número NOVO, e inventar aquecimento para um número velho
  calaria um canal que já funcionava.
*/
const DIA_JA_AQUECIDO = 999;
import { intercalaPorVariedade, assinaturaDe } from "../lib/variedade.ts";
import { eixoDeVariedade } from "../lib/familia-de-beleza.ts";
import { pesoDaMarca } from "../lib/marca-de-perfume.ts";
import { pesoDaMarcaDeBeleza, marcaDeBeleza } from "../lib/marca-de-beleza.ts";
import { canalAceitaAtributos } from "../lib/canal-aceita.ts";
import { tipoForaDaBeleza } from "../lib/eletronico-em-beleza.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CHAVE;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });
const TELEGRAM = "https://api.telegram.org";

/** A trava de execução (migration 45). Só quem tomou é que solta. */
const TRAVA = "publica-automatico";
let travaMinha = false;

/** Os parâmetros globais, num objeto só. */
async function parametros() {
  const { data } = await db.from("parametro").select("chave, valor").is("nicho_id", null);
  const mapa = {};
  for (const p of data ?? []) mapa[p.chave] = Number(p.valor);
  return mapa;
}

/**
 * A oferta passa nas comportas de confiança?
 *
 * Devolve o motivo da reprovação, e não só falso: sem o motivo gravado
 * não há como calibrar depois, e "por que quase nada é publicado" fica
 * sem resposta.
 *
 * **Nulo não reprova.** Dado que não medimos não é dado ruim: a loja
 * pode simplesmente não informar avaliação. A comporta só reprova o
 * que ela mediu.
 */
function reprova(anuncio, par) {
  const oficialOuPlatinum = anuncio.loja_oficial || (anuncio.reputacao_vendedor ?? 0) >= 1;

  if (anuncio.avaliacao != null && anuncio.avaliacao < (par.avaliacao_minima ?? 3.5)) {
    return `produto_mal_avaliado(${anuncio.avaliacao})`;
  }

  // Nota alta com poucas avaliações é ruído. Loja oficial e platinum
  // dispensam: a confiança vem da marca, não do histórico do item.
  if (
    !oficialOuPlatinum &&
    anuncio.avaliacao_qtd != null &&
    anuncio.avaliacao_qtd < (par.avaliacoes_minimas ?? 20)
  ) {
    return `poucas_avaliacoes(${anuncio.avaliacao_qtd})`;
  }

  if (
    anuncio.reputacao_vendedor != null &&
    anuncio.reputacao_vendedor < (par.reputacao_minima ?? 0.6)
  ) {
    return `vendedor_fraco(${anuncio.reputacao_vendedor})`;
  }

  /*
    VENDEDOR SOBRE QUEM NÃO SE SABE NADA (migration 32).

    A regra geral acima é "nulo não reprova", e ela está certa para a
    avaliação do produto: a loja pode de fato não informar. Ela está
    errada para a reputação do vendedor, porque **reputação de
    vendedor no Mercado Livre sempre existe**. Nula no nosso banco
    significa que nós não perguntamos, não que ele não tem.

    Medido em 01/08: 288 dos 708 anúncios (41%) sem reputação. A
    curadoria automática (D-033) foi vendida ao dono como capaz de
    substituir o olho humano na conferência de vendedor; deixando
    passar 4 em cada 10 sem medir, ela não estava.

    Loja oficial dispensa, pelo mesmo motivo da regra de avaliações:
    a confiança vem da marca.
  */
  if (
    (par.reputacao_nula_reprova ?? 1) === 1 &&
    !anuncio.loja_oficial &&
    anuncio.reputacao_vendedor == null
  ) {
    return "vendedor_desconhecido";
  }

  // Reputação boa com pouca venda é sorte, não histórico.
  if (
    !anuncio.loja_oficial &&
    anuncio.vendas_estimadas != null &&
    anuncio.vendas_estimadas < (par.vendas_minimas_vendedor ?? 100)
  ) {
    return `vendedor_novato(${anuncio.vendas_estimadas}_vendas)`;
  }

  return null;
}

/**
 * Foto ainda dentro do prazo que a loja permite (regra 3.3).
 *
 * O prazo é da LOJA, não do sistema: `marketplace.cache_preco_max_horas`
 * vale 24 na Amazon e é NULO no Mercado Livre e na Shopee, porque só a
 * Amazon limita retenção. Nulo aqui significa "não expira".
 *
 * Isto já era assim no banco — `expurga_imagens_expiradas` sempre leu a
 * coluna. Era só aqui que 24 estava cravado, e o efeito foi o canal
 * parar de publicar foto de Mercado Livre assim que o catálogo passou
 * de um dia de idade.
 */
function fotoValida(anuncio) {
  if (!anuncio.imagem_url || !anuncio.imagem_obtida_em) return null;
  const limite = anuncio.marketplace?.cache_preco_max_horas;
  if (limite == null) return anuncio.imagem_url;
  const horas = (Date.now() - new Date(anuncio.imagem_obtida_em).getTime()) / 3_600_000;
  return horas <= limite ? anuncio.imagem_url : null;
}

async function mandaAoTelegram(chatId, texto, foto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, motivo: "falta TELEGRAM_BOT_TOKEN" };

  const rota = foto ? "sendPhoto" : "sendMessage";
  const corpo = foto
    ? { chat_id: chatId, photo: foto, caption: texto.slice(0, 1024), parse_mode: "HTML" }
    : { chat_id: chatId, text: texto, parse_mode: "HTML", link_preview_options: { is_disabled: true } };

  const r = await fetch(`${TELEGRAM}/bot${token}/${rota}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const d = await r.json().catch(() => null);

  // Foto que a loja recusa servir não pode custar a publicação.
  if (!d?.ok && foto && /photo|failed to get http url/i.test(String(d?.description))) {
    return mandaAoTelegram(chatId, texto, null);
  }
  return d?.ok ? { ok: true, id: d.result.message_id } : { ok: false, motivo: d?.description };
}

/**
 * O mesmo envio, no WhatsApp, pela Evolution API na VPS.
 *
 * A camada de rede é gêmea de `lib/whatsapp.ts` e vive aqui porque
 * aquele arquivo é `server-only` e este script roda em node puro —
 * o mesmo motivo de `mandaAoTelegram` existir ao lado de
 * `lib/telegram.ts`. A conversão do texto, que é a parte com lógica,
 * NÃO é duplicada: vem de `lib/texto-whatsapp.ts`, importado no topo.
 */
async function mandaAoWhatsApp(instancia, grupoJid, texto, foto, comCard = false) {
  const base = (process.env.WHATSAPP_API_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.WHATSAPP_API_KEY;

  if (!base || !chave) return { ok: false, motivo: "falta WHATSAPP_API_URL ou WHATSAPP_API_KEY" };
  if (!instancia) return { ok: false, motivo: "canal sem instância de WhatsApp cadastrada" };
  if (!grupoJid) return { ok: false, motivo: "canal sem grupo de WhatsApp cadastrado" };

  const corpo = paraWhatsApp(texto);

  /*
    CARD DE LINK EM VEZ DE FOTO ANEXADA (migration 63).

    Com `comCard`, a foto é DESCARTADA de propósito e o WhatsApp monta o
    card a partir do link que já está no texto. Não é perda: nas lojas
    dessa lista o card vem com a mesma foto do produto, e a diferença é
    que ele não é mídia — não baixa e não entope a galeria de quem lê.

    Quem decide é `saiComCardDeLink`, em `lib/texto-whatsapp.ts`, e a
    decisão é compartilhada com o caminho manual do painel: o publicador
    e a tela mandando de formas diferentes seria o tipo de divergência
    que só aparece lendo o grupo.
  */
  const anexaFoto = Boolean(foto) && !comCard;
  const rota = anexaFoto ? "sendMedia" : "sendText";
  const carga = anexaFoto
    ? { number: grupoJid, mediatype: "image", media: foto, caption: corpo }
    : { number: grupoJid, text: corpo, linkPreview: comCard };

  try {
    const r = await fetch(`${base}/message/${rota}/${encodeURIComponent(instancia)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: chave },
      body: JSON.stringify(carga),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json().catch(() => null);

    if (!r.ok) {
      const motivo = String(d?.response?.message ?? d?.message ?? `HTTP ${r.status}`);
      // Foto que a loja recusa servir não pode custar a publicação.
      // Sem foto anexada não há o que repetir: a queda seria do envio.
      if (anexaFoto && /media|download|url|buffer/i.test(motivo)) {
        return mandaAoWhatsApp(instancia, grupoJid, texto, null, comCard);
      }
      return { ok: false, motivo };
    }

    return { ok: true, id: d?.key?.id ?? null };
  } catch (erro) {
    return { ok: false, motivo: `não alcancei a Evolution API: ${erro.message}` };
  }
}

/**
 * Manda pelo canal que for, e devolve sempre a mesma forma.
 *
 * Existe para o laço não precisar saber de plataforma: ele decide QUE
 * mensagem sai e QUANDO, e quem sabe COMO é esta função. Foi o que
 * permitiu ligar o WhatsApp mexendo em um lugar só.
 */
async function manda(canal, texto, foto, instancia, comCard = false) {
  if (canal.plataforma === "whatsapp") {
    return mandaAoWhatsApp(instancia, canal.whatsapp_grupo_id, texto, foto, comCard);
  }
  // O Telegram não entra nisto: lá a foto é `sendPhoto` e não cai em
  // galeria nenhuma, então o problema que o card resolve não existe.
  return mandaAoTelegram(canal.telegram_chat_id, texto, foto);
}

async function main() {
  const par = await parametros();

  if ((par.publicacao_automatica ?? 1) === 0) {
    console.log("publicacao_automatica = 0 — freio de mão puxado, nada sai.");
    return;
  }

  /*
    UMA EXECUÇÃO POR VEZ (migration 45).

    Observado em 01/08: com duas instâncias no ar, os sete canais
    publicaram duas vezes cada com 44 segundos de intervalo, contra os
    cinco minutos configurados. O ritmo não está errado — cada processo
    lê `canal.ultima_publicacao_em` uma vez e guarda a própria cópia, e
    o que a outra instância grava ele nunca vê. Com N processos o canal
    fala N vezes mais.

    E o estrago pior é outro: as duas leem a mesma fila de `publicacao`
    pendente, e nada impede as duas de mandarem a MESMA mensagem. É a
    D-040 outra vez.

    Desistir é o certo, e não esperar: a fila mora no banco e a rodada
    seguinte pega o que sobrou.
  */
  const { data: tomou } = await db.rpc("toma_trava", {
    p_nome: TRAVA,
    p_dono: `${process.env.GITHUB_RUN_ID ? `actions:${process.env.GITHUB_RUN_ID}` : "manual"}:${process.pid}`,
    p_minutos: Number(process.env.PUBLICA_JANELA_MIN ?? 50) + 5,
  });

  if (!tomou) {
    console.log("outra execução do publicador está no ar. Saindo sem publicar.");
    return;
  }

  travaMinha = true;

  const ritmo = {
    intervaloPicoMin: par.intervalo_pico_min ?? RITMO_PADRAO.intervaloPicoMin,
    intervaloNormalMin: par.intervalo_normal_min ?? RITMO_PADRAO.intervaloNormalMin,
    intervaloMadrugadaMin: par.intervalo_madrugada_min ?? RITMO_PADRAO.intervaloMadrugadaMin,
    modoIntenso: (par.modo_intenso ?? 0) === 1,
    // Quanto o intervalo pode encurtar por sorteio. Com 5 de intervalo
    // e 2 de folga, os posts saem a cada 3, 4 ou 5 minutos — em vez de
    // 5 cravado, que é carimbo de robô.
    jitterMin: par.intervalo_jitter_min ?? RITMO_PADRAO.jitterMin,
  };

  const SELECAO = `
    id, operacao_id, anuncio_id, preco_atual_centavos, preco_referencia_centavos,
    preco_anterior_centavos,
    referencia_janela_dias, dias_de_serie, desconto_pct, pode_afirmar_minimo, detectada_em, gatilho,
    nosso_minimo_centavos, nosso_minimo_desde, nossos_dias_lidos,
    anuncio:anuncio_id (
      id, produto_id, url_original, sku_externo, vendedor, imagem_url, imagem_obtida_em, loja_oficial,
      avaliacao, avaliacao_qtd, reputacao_vendedor, vendas_estimadas, selo_vendedor, frete_gratis,
      preco_leitura_centavos, preco_original_centavos, categoria_ramo,
      marketplace:marketplace_id ( nome, slug, cache_preco_max_horas ),
      produto:produto_id ( titulo_canonico, nota_curador, nicho_id, atributos, nicho:nicho_id ( slug ) )
    )`;

/*
  A MELHOR PRATELEIRA DO MESMO PRODUTO.

  O Mercado Livre cadastra o mesmo item em vários catálogos, e até
  01/08 cada um virava um produto nosso: a comparação de preço nunca
  atravessava entre eles. Depois da migration 30 eles são anúncios do
  MESMO produto, e esta é a função que escolhe entre eles.

  A TROCA SÓ ACONTECE COM LASTRO PRÓPRIO, e a restrição é o coração
  disto. Publicar o preço de uma prateleira com o "de" de outra é
  inventar desconto — seria a regra 3.4 violada por dentro, com dois
  números verdadeiros que nunca conviveram. Então:

    prateleira melhor E com desconto declarado próprio  →  troca
    prateleira melhor SEM lastro próprio                →  não publica

  Não publicar dói, e é o lado certo de doer: a alternativa é anunciar
  R$ 130 sabendo que existe R$ 119,90 do mesmo item.
*/
async function melhorPrateleira(db, oferta) {
  const anuncio = oferta.anuncio;
  if (!anuncio?.produto_id) return { usar: anuncio, trocou: false };

  const { data: melhorId } = await db.rpc("melhor_anuncio_do_produto", {
    p_produto_id: anuncio.produto_id,
  });

  if (!melhorId || melhorId === anuncio.id) return { usar: anuncio, trocou: false };

  const { data: melhor } = await db
    .from("anuncio")
    .select(
      "id, produto_id, url_original, sku_externo, vendedor, imagem_url, imagem_obtida_em, loja_oficial, " +
        "avaliacao, avaliacao_qtd, reputacao_vendedor, vendas_estimadas, selo_vendedor, frete_gratis, " +
        "preco_leitura_centavos, preco_original_centavos, " +
        "marketplace:marketplace_id ( nome, slug, cache_preco_max_horas ), " +
        "produto:produto_id ( titulo_canonico, nota_curador, nicho_id, atributos, nicho:nicho_id ( slug ) )",
    )
    .eq("id", melhorId)
    .maybeSingle();

  if (!melhor?.preco_leitura_centavos) return { usar: anuncio, trocou: false };
  if (melhor.preco_leitura_centavos >= oferta.preco_atual_centavos) {
    return { usar: anuncio, trocou: false };
  }

  const temLastro =
    melhor.preco_original_centavos != null &&
    melhor.preco_original_centavos > melhor.preco_leitura_centavos;

  if (!temLastro) return { usar: null, trocou: false, melhorSemLastro: melhor };

  return { usar: melhor, trocou: true };
}

  const { data: novas } = await db
    .from("oferta")
    .select(SELECAO)
    .eq("status", "nova")
    .order("nota", { ascending: false });

  console.log(`${(novas ?? []).length} ofertas novas`);

  /*
    A ORDEM INTERCALA NICHO E FAIXA DE PREÇO, e não é só a nota.

    A consulta acima pede `order("nota", desc)`, e esse é exatamente o
    comportamento que `lib/variedade.ts` foi escrito para corrigir. O
    comentário dele descreve o que acontecia aqui:

      *"ofertas parecidas pontuam parecido, porque desconto, comissão e
      reputação de vendedor andam juntos dentro de um mesmo nicho e
      faixa de preço. O resultado é que as melhores notas do dia tendem
      a ser oito variações da mesma coisa, publicadas em sequência."*

    A intercalação existia, tinha teste, e era usada só na tela manual
    `/publicar`. O laço automático — que é o caminho de verdade desde a
    D-033 — publicava na ordem crua.

    ISTO NÃO É CURADORIA E NÃO PODE VIRAR: nada é descartado, nada muda
    de nota, o conjunto publicado no fim do dia é o mesmo. Só a ordem
    muda. A regra de o que publicar continua no banco, em
    `avalia_anuncios`.
  */
  const ordenadas = intercalaPorVariedade(
    (novas ?? []).map((o) => ({
      grupo: eixoDeVariedade(o.anuncio?.produto?.nicho_id, o.anuncio?.produto?.titulo_canonico),
      precoCentavos: o.preco_atual_centavos,
      oferta: o,
    })),
  ).map((x) => x.oferta);

  /*
    OS MODELOS, e agora é PLURAL.

    Era `.limit(1)` sobre os ativos, o que dava certo enquanto existia
    um só. Com o Radar Delas ganhando texto próprio, `limit(1)` viraria
    sorteio: o canal do Telegram poderia receber o modelo do grupo de
    beleza, ou o contrário, dependendo da ordem que o Postgres
    devolvesse. Bug silencioso, do tipo que só aparece lendo o post.

    Agora vem tudo, e cada canal pega o seu; quem não tem, usa o global
    (`canal_id` nulo).
  */
  const { data: modeloLinhas } = await db
    .from("modelo_mensagem")
    .select(
      "canal_id, corpo, lastro_com, lastro_sem, lastro_queda, lastro_declarado, linha_frete, linha_cupom, nota_prefixo, corpo_cupom, instrucao_gancho",
    )
    .eq("ativo", true);

  const montaModelo = (l) => ({
    corpo: l.corpo,
    instrucaoGancho: l.instrucao_gancho,
    lastroCom: l.lastro_com,
    lastroSem: l.lastro_sem,
    lastroQueda: l.lastro_queda,
    lastroDeclarado: l.lastro_declarado,
    linhaFrete: l.linha_frete,
    linhaCupom: l.linha_cupom,
    notaPrefixo: l.nota_prefixo,
    corpoCupom: l.corpo_cupom,
  });

  const modeloGlobalLinha = (modeloLinhas ?? []).find((l) => l.canal_id == null);
  const modelosPorCanal = new Map(
    (modeloLinhas ?? []).filter((l) => l.canal_id).map((l) => [l.canal_id, montaModelo(l)]),
  );

  if (!modeloGlobalLinha) {
    console.log("✗ nenhum modelo global (canal_id nulo) cadastrado. Nada sai.");
    return;
  }

  const modeloGlobal = montaModelo(modeloGlobalLinha);
  const modeloDo = (canal) => modelosPorCanal.get(canal.id) ?? modeloGlobal;

  // Mantido para o caminho do cupom, que ainda é global.
  const modelo = modeloGlobal;

  /*
    A SESSÃO DA CENTRAL DE AFILIADOS.

    Mora em `credencial_rotativa`, junto do refresh token do ML, e pelo
    mesmo motivo: no agendador cada execução começa de um clone limpo,
    então segredo em arquivo ou em secret do GitHub ficaria velho na
    primeira renovação e a execução seguinte falharia calada.

    Ela EXPIRA sozinha, e é a dependência mais frágil do sistema hoje.
    Quando cair, nenhuma publicação sai — e isso é o desfecho certo:
    publicar com link que não atribui é trabalhar de graça.
  */
  const { data: segredos } = await db
    .from("credencial_rotativa")
    .select("chave, valor")
    .in("chave", ["afiliados_cookie", "afiliados_csrf"]);

  const sessao = {
    cookie: (segredos ?? []).find((s) => s.chave === "afiliados_cookie")?.valor ?? "",
    csrf: (segredos ?? []).find((s) => s.chave === "afiliados_csrf")?.valor ?? "",
  };

  /*
    SEM SESSÃO, SÓ O MERCADO LIVRE PARA. As outras duas seguem.

    Isto era um `return` que encerrava a execução inteira, e ele
    contradizia o que este mesmo arquivo promete 340 linhas abaixo sobre
    a Amazon: *"nunca falha por sessão expirada, que é o motivo número
    um de canal mudo aqui"*.

    A promessa é verdadeira e a guarda a anulava. Amazon e Shopee montam
    o link por URL, sem sessão e sem etiqueta cadastrada (D-049, D-057);
    só o Mercado Livre precisa do gerador da Central. No dia em que o
    cookie expirar, o certo é o canal continuar publicando o que dá para
    publicar, e não emudecer inteiro.
  */
  const temSessaoDaCentral = Boolean(sessao.cookie && sessao.csrf);

  /*
    A credencial da Open API da Shopee, aprovada em 03/08 e em uso desde
    04/08. Vem do ambiente, e não de `credencial_rotativa`, porque ela
    não rotaciona: é par fixo de App ID e secret do painel de afiliado.
    Faltando, a Shopee volta a usar o `an_redir` montado à mão.
  */
  const credShopee = {
    appId: process.env.SHOPEE_APP_ID,
    appSecret: process.env.SHOPEE_APP_SECRET,
  };

  if (!credShopee.appId || !credShopee.appSecret) {
    console.log("Sem SHOPEE_APP_ID/SECRET: os links da Shopee saem no formato longo (an_redir).");
  }

  if (!temSessaoDaCentral) {
    console.log(
      "Sem a sessão da Central em `credencial_rotativa`: o Mercado Livre não gera link " +
        "nesta rodada. Amazon e Shopee seguem normalmente.",
    );
  }

  const { data: canais } = await db
    .from("canal")
    .select(
      "id, operacao_id, nome, plataforma, telegram_chat_id, whatsapp_grupo_id, bot_id, membros_estimados, posts_por_dia_max, ultima_publicacao_em, etiqueta_afiliado, horarios_permitidos, canal_nicho ( nicho_id ), canal_atributo ( atributo, valores, modo, exige_atributo, nicho_id )",
    )
    .eq("ativo", true);

  /*
    O TETO DIÁRIO DO CANAL, que existia no papel e não no código.

    A D-033 diz, com todas as letras: *"O teto diário do canal
    (`posts_por_dia_max`) continua valendo por cima — é o combinado com
    o parceiro."* Ele era lido na consulta acima e nunca usado: o único
    freio era o intervalo do ritmo.

    Com os parâmetros de hoje (pico 10 min, normal 30, madrugada 90) o
    intervalo sozinho permite ~64 posts por dia, contra um teto
    combinado de 50. Ninguém era avisado, porque um teto que não é
    conferido não falha: ele só é ultrapassado.

    E isso não é preciosismo. A pesquisa de campo mediu que **volume é
    o motivo número um de alguém sair de um canal**, à frente da
    qualidade da oferta (`docs/pesquisa/sintese.md` §5).

    O recorte é o dia de São Paulo, não o de UTC: a meia-noite de
    Londres são 21h aqui, no meio do pico da noite, e o teto zeraria
    ali.
  */
  const desdeMeiaNoite = inicioDoDiaEmSaoPaulo(new Date()).toISOString();
  const { data: jaEnviadas } = await db
    .from("publicacao")
    .select("canal_id")
    .eq("estado", "enviada")
    .gte("enviada_em", desdeMeiaNoite);

  const enviadasHoje = {};
  for (const p of jaEnviadas ?? []) {
    enviadasHoje[p.canal_id] = (enviadasHoje[p.canal_id] ?? 0) + 1;
  }

  /** O canal já falou o suficiente hoje? */
  /*
    O HORÁRIO DO CANAL, que existia na tela e não no código.

    `canal.horarios_permitidos` é escrito pelo formulário de canal desde
    sempre e o publicador nunca leu — o dono preenchia e nada acontecia.
    A migration 65 abriu os sete canais para o dia inteiro ANTES desta
    leitura entrar, então o comportamento de hoje não muda: o que muda é
    o campo da tela passar a valer.

    Lista vazia é "sem restrição" e não "nunca publica". A diferença
    importa: canal criado por script antigo, ou coluna zerada à mão,
    emudeceria para sempre e o log não diria por quê.
  */
  function foraDoHorario(canal) {
    const horas = canal.horarios_permitidos;
    if (!Array.isArray(horas) || horas.length === 0) return false;

    /*
      A BORDA DO DIA É SORTEADA, e o miolo continua sendo a lista.

      Abrir 09:00:00 e fechar 21:59 cravado, todo dia, é assinatura de
      agendador — o primeiro e o último post são os dois mais fáceis de
      cronometrar de fora. Pedido do dono em 11/08, com os números:
      abre entre 09:07 e 09:21, fecha entre 20:57 e 21:11
      (`lib/ritmo.ts`, `bordaDoDia`).

      As duas conferências convivem: a borda decide as PONTAS do dia, a
      lista continua decidindo as horas do meio. Um canal configurado
      com buraco (7, 12, 20) segue mudo às 15h.
    */
    if (!dentroDaJanelaDoDia(horas, canal.id, new Date())) return true;
    return !horas.includes(horaEmSaoPaulo(new Date()));
  }

  function noTetoDiario(canal) {
    const teto = canal.posts_por_dia_max ?? Infinity;
    return (enviadasHoje[canal.id] ?? 0) >= teto;
  }

  /*
    OS RAMOS SECUNDÁRIOS (migration 36).

    O "Pet Shop" do Mercado Livre tem 28 filhas, e entre elas estão
    Cavalos, Peixes, Aves e Répteis. Suplemento equino é legitimamente
    pet, e num canal de cão e gato é ruído — a pesquisa põe
    irrelevância ao lado do volume como motivo de saída.

    A regra do dono: quatro primários antes de cada secundário. Ela é
    de DADO, não de código: qualquer nicho pode marcar os ramos dele, e
    a proporção é um `parametro`.

    Ramo sem linha é primário. Aqui o desconhecido **passa**, ao
    contrário da D-036 — porque o custo de errar é oposto: lá seria
    publicar o produto errado, aqui seria calar o canal por falta de
    cadastro.
  */
  const { data: secundarios } = await db.from("ramo_secundario").select("ramo");
  const ramoSecundario = new Set((secundarios ?? []).map((r) => r.ramo));
  const porSecundario = par.primarios_por_secundario ?? 4;

  const ehSecundario = (pub) =>
    ramoSecundario.has(pub?.oferta?.anuncio?.categoria_ramo ?? "");

  let ganchosCriados = 0;
  let ganchosRecusados = 0;
  let reprovadas = 0;
  let publicadas = 0;
  let esperando = 0;
  let semLink = 0;
  let trocas = 0;
  let noTeto = 0;
  let cuponsPublicados = 0;
  let adiadosPorProporcao = 0;
  /* Publicações que a fila trazia e a reconferência da saída barrou. */
  let canceladasNaSaida = 0;
  let foraDeHorario = 0;
  /* Quais canais já entraram na conta de "fora do horário" nesta rodada. */
  const foraDeHorarioContado = new Set();
  let encerradas = 0;
  const motivos = {};

  /*
    POR QUE O LINK NÃO SAIU, contado por causa.

    O rodapé desta execução dizia sempre *"sem link é quase sempre
    sessão da Central expirada"*, e em 04/08 isso era falso o dia
    inteiro: a sessão gerou 37 links na mesma rodada em que 11 falharam.
    O motivo real estava três linhas acima, no log — `URL not allowed in
    affiliates program` — e o aviso mandava renovar uma credencial
    sadia.

    Palpite fixo em rodapé é pior que rodapé nenhum: ele manda alguém
    consertar o que não está quebrado, e some com o defeito de verdade.
  */
  const semLinkPorMotivo = {};

  /*
    O QUE A REVALIDAÇÃO DE PREÇO DA SHOPEE FEZ NESTA RODADA.

    Contado por desfecho porque as quatro coisas querem reações
    diferentes de quem lê o log: `confirmado` é o caso normal,
    `melhorou` é o ganho, `morreu` é curadoria funcionando, e
    `sem_resposta` alto é a API de terceiro caindo — e aí o sistema está
    publicando sobre o feed da véspera sem ninguém perceber.
  */
  const revalidacao = {};

  /*
    CANAL TRAVADO NESTA RODADA.

    Erro de cadastro do canal (etiqueta que não existe na Central, ou
    canal sem etiqueta nenhuma) vale para TODOS os itens da fila dele.
    Sem isto, cada item da fila repete a mesma chamada e recebe a mesma
    recusa: um erro de configuração vira dezenas de batidas no painel de
    outra empresa, por rodada.

    Trava só na memória, e de propósito: consertar a etiqueta tem que
    voltar a funcionar na rodada seguinte, sem ninguém desfazer nada no
    banco.
  */
  const canaisTravados = new Set();

  /**
   * Encerra as publicações de uma oferta que não tem como dar certo.
   *
   * O QUE ISTO CONSERTA, medido em produção em 04/08: publicação que
   * falhava continuava `pendente`, e a fila da rodada seguinte é lida
   * por `estado = 'pendente'`. Não havia estado terminal nem contador de
   * tentativa, então o mesmo item voltava para sempre. A prova é a
   * mesma linha em 4 de 4 execuções examinadas, com uma hora entre
   * elas:
   *
   *   11:14  ⤫ Radar Tech: prateleira melhor sem lastro (R$ 317.00)
   *   10:21  ⤫ Radar Tech: prateleira melhor sem lastro (R$ 317.00)
   *
   * E o custo não é log feio: cada retentativa de link é uma chamada ao
   * gerador da Central com a sessão do dono. O contador de "sem link"
   * subiu de 7 para 11 ao longo do dia, e onze execuções concluídas
   * davam da ordem de noventa chamadas mortas por dia.
   *
   * `cancelada` e não um estado novo: ele já existe na migration 16, a
   * tela já sabe mostrá-lo, e `desfazCancelamento` já sabe voltar
   * atrás. Estado novo pediria migration, e migration eu não teria como
   * aplicar nem conferir daqui.
   *
   * ENCERRA TODAS AS PUBLICAÇÕES DA OFERTA, e não só a deste canal: a
   * causa é da oferta (a prateleira, a URL recusada), então ela vale
   * para todo canal que fosse recebê-la.
   */
  async function encerraPublicacoesDaOferta(ofertaId, motivo) {
    const { data, error } = await db
      .from("publicacao")
      .update({ estado: "cancelada", cancelada_em: new Date().toISOString() })
      .eq("oferta_id", ofertaId)
      .eq("estado", "pendente")
      .select("id");

    // O erro é conferido porque a D-040 é literalmente sobre não
    // conferir o retorno de um update de `publicacao`.
    if (error) {
      console.log(`  ! não consegui encerrar as publicações da oferta: ${error.message}`);
      return;
    }

    const quantas = (data ?? []).length;
    encerradas += quantas;
    if (quantas > 0) {
      console.log(`    ↳ ${quantas} publicação(ões) encerrada(s): ${motivo}`);
    }
  }

  for (const oferta of ordenadas) {
    const anuncio = oferta.anuncio;
    if (!anuncio) continue;

    // 1. As comportas de confiança
    const motivo = reprova(anuncio, par);
    if (motivo) {
      await db
        .from("oferta")
        .update({ status: "rejeitada", motivo_rejeicao: motivo, decidida_em: new Date().toISOString() })
        .eq("id", oferta.id);
      motivos[motivo.split("(")[0]] = (motivos[motivo.split("(")[0]] ?? 0) + 1;
      reprovadas++;
      continue;
    }

    /*
      2. A COMPORTA DE NICHO.

      Na primeira madrugada automática saíram três posts no canal de
      pet e dois eram de outro nicho: uma mangueira de jardim e um whey
      protein. Duas causas se somaram, e esta é a segunda linha de
      defesa contra as duas.

      Produto SEM nicho é reprovado, e não ignorado: antes ele
      simplesmente não achava canal e ficava `nova` para sempre, sendo
      reavaliado de hora em hora sem nunca sair nem aparecer. Erro de
      classificação vira oferta não publicada, que é o lado certo de
      errar, e o motivo gravado é o que permite achar o buraco depois.
    */
    const nichoId = anuncio.produto?.nicho_id;

    if (!nichoId) {
      await db
        .from("oferta")
        .update({
          status: "rejeitada",
          motivo_rejeicao: "sem_nicho",
          decidida_em: new Date().toISOString(),
        })
        .eq("id", oferta.id);
      motivos.sem_nicho = (motivos.sem_nicho ?? 0) + 1;
      reprovadas++;
      continue;
    }

    // O casamento é explícito: o canal precisa declarar este nicho.
    // Nunca "o canal aceita tudo" — foi assim que a mangueira saiu.
    const doNicho = (canais ?? []).filter((c) =>
      (c.canal_nicho ?? []).some((cn) => cn.nicho_id === nichoId),
    );

    if (doNicho.length === 0) {
      await db
        .from("oferta")
        .update({
          status: "rejeitada",
          motivo_rejeicao: "nenhum_canal_do_nicho",
          decidida_em: new Date().toISOString(),
        })
        .eq("id", oferta.id);
      motivos.nenhum_canal_do_nicho = (motivos.nenhum_canal_do_nicho ?? 0) + 1;
      reprovadas++;
      continue;
    }

    /*
      2b. O FILTRO DE ATRIBUTO DO CANAL (migration 37).

      Nicho responde de que prateleira o produto é. Ele não responde
      "perfume masculino", porque isso não é prateleira em lugar
      nenhum: o ML põe todo perfume em `MLB-PERFUMES` e distingue por
      um atributo, `GENDER`.

      Vem DEPOIS do nicho e não junto de propósito. As duas reprovas
      são coisas diferentes e precisam de motivos diferentes: nicho sem
      canal é buraco de cobertura, e pede canal novo; atributo que não
      passa é a preferência do canal funcionando, e não pede nada.
      Somadas num motivo só, a primeira ficaria invisível dentro da
      segunda.
    */
    const elegiveis = doNicho.filter((c) =>
      canalAceitaAtributos(
        (c.canal_atributo ?? []).map((f) => ({
          ...f,
          exigeAtributo: f.exige_atributo,
          nichoId: f.nicho_id,
        })),
        anuncio.produto?.atributos,
        nichoId,
      ),
    );

    if (elegiveis.length === 0) {
      await db
        .from("oferta")
        .update({
          status: "rejeitada",
          motivo_rejeicao: "filtro_de_atributo",
          decidida_em: new Date().toISOString(),
        })
        .eq("id", oferta.id);
      motivos.filtro_de_atributo = (motivos.filtro_de_atributo ?? 0) + 1;
      reprovadas++;
      continue;
    }

    await db
      .from("oferta")
      .update({ status: "aprovada", decidida_em: new Date().toISOString() })
      .eq("id", oferta.id);

    for (const canal of elegiveis) {
      /*
        3. A PUBLICAÇÃO NASCE ANTES DA CHECAGEM DE RITMO, e a ordem
        importa.

        Ao contrário, quando o ritmo bloqueia não sobra linha nenhuma: a
        oferta fica `aprovada` sem publicação, e a rodada seguinte, que
        só procura ofertas `novas`, nunca mais a alcança. A oferta some
        em silêncio, que é o pior desfecho.

        Criando primeiro, ela fica `pendente` e a segunda passada a
        pega quando o intervalo permitir.
      */
      const { data: pub, error: erroPub } = await db
        .from("publicacao")
        .upsert(
          {
            operacao_id: oferta.operacao_id,
            oferta_id: oferta.id,
            canal_id: canal.id,
            preco_na_fila_centavos: oferta.preco_atual_centavos,
          },
          { onConflict: "oferta_id,canal_id", ignoreDuplicates: false },
        )
        .select("id, subid, estado, link_afiliado")
        .single();

      if (erroPub || !pub || pub.estado === "enviada") continue;

      /*
        E PARA AQUI. Esta passada só CRIA a linha; quem envia é o laço
        espaçado mais abaixo.

        Antes ela também publicava, e disso vinha o teto de um post por
        hora: o primeiro envio mexia no relógio do canal e o próprio
        ritmo barrava o resto da rodada.

        O WhatsApp nunca sai de lugar nenhum daqui (regra 3.2): fica
        pendente, e um humano envia pela tela.
      */
    }
  }

  /*
    O ENVIO, ESPAÇADO EM TEMPO REAL DENTRO DA JANELA DO CRON.

    ISTO CONSERTA UM DESCOMPASSO ENTRE O RITMO E O AGENDADOR, e ele
    fazia o canal render muito menos do que o configurado.

    O ritmo diz "um post a cada 10 minutos no pico". O agendador roda de
    hora em hora. E o script publicava um e saía: depois do primeiro
    envio, `ultima_publicacao_em` virava agora, e a iteração seguinte era
    barrada pelo próprio ritmo. O teto real ficava em **um post por
    hora**, qualquer que fosse o intervalo configurado. Medido em 01/08:
    23 ofertas aprovadas na fila e uma publicação na rodada das 18h.

    E o cupom, que vinha por último, nunca pegava a vaga: ela já tinha
    sido gasta pela primeira oferta.

    Agora a execução **fica viva e dorme entre os posts**, respeitando o
    mesmo intervalo. Uma rodada de pico entrega até cinco ou seis posts
    em vez de um. A janela é menor que a hora de propósito, para uma
    execução nunca alcançar a seguinte.

    Os minutos do GitHub Actions são ilimitados desde que o repositório
    virou público (D-038), então dormir aqui não custa dinheiro.
  */
  const JANELA_MIN = Number(process.env.PUBLICA_JANELA_MIN ?? 50);
  const limite = Date.now() + JANELA_MIN * 60_000;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  /*
    OS CANAIS QUE O LAÇO SERVE.

    Era `plataforma === "telegram"` e nada mais, porque a regra 3.2
    proibia o WhatsApp automático. Desde a D-071 (06/08) o WhatsApp
    entra, com freio próprio: `whatsapp_automatico = 0` deixa os canais
    de WhatsApp fora sem tirar o Telegram do ar, que é o que se quer
    enquanto o número está em aquecimento.
  */
  const whatsappLigado = (par.whatsapp_automatico ?? 0) === 1;

  const canaisAtivos = (canais ?? []).filter(
    (c) => c.plataforma === "telegram" || (c.plataforma === "whatsapp" && whatsappLigado),
  );

  if (!whatsappLigado && (canais ?? []).some((c) => c.plataforma === "whatsapp")) {
    console.log("whatsapp_automatico = 0 — canais de WhatsApp fora desta rodada.");
  }

  /*
    O TETO POR CHIP, que é outra conta que o teto do canal.

    `posts_por_dia_max` é o combinado com o parceiro, por canal. Este
    aqui é o que protege o NÚMERO: um chip servindo sete canais a 30
    posts/dia faria ~210 envios, acima do teto de número maduro que a
    D-053 mediu (menos de 200/dia). Estourar isso não quebra combinado
    nenhum, derruba a conta — e é por isso que a contagem é por BOT e
    não por canal.

    O teto do dia vem da RAMPA, e não mais de um parâmetro plano:
    `bot.envios_dia_max` passado por `tetoDoDia`. O parâmetro
    `whatsapp_envios_dia_max` sobrou como valor sugerido de bot novo.
    Duas fontes de verdade para o mesmo teto é como se descobre, tarde,
    que o número mandou o dobro.
  */
  const { data: listaDeBots } = await db
    .from("bot")
    .select("id, nome, instancia, aquecimento_inicio, envios_dia_max, ativo");

  const bots = new Map((listaDeBots ?? []).map((b) => [b.id, b]));

  const instanciaDoCanal = (canal) => {
    const bot = bots.get(canal.bot_id);
    return bot?.ativo ? (bot.instancia ?? "") : "";
  };

  /*
    A TAXA POR HORA DO DIA DE HOJE, que é o que dá o intervalo.

    Sem data de início não há rampa (Telegram, ou chip cadastrado antes
    de ela existir), e aí o intervalo volta à faixa de 4 a 10 de sempre.
  */
  function porHoraDoBot(botId) {
    const bot = bots.get(botId);
    if (!bot || !bot.ativo || !bot.aquecimento_inicio) return undefined;
    return porHoraDoDia(diaDoAquecimento(bot.aquecimento_inicio, new Date()));
  }

  function tetoDoBot(botId) {
    const bot = bots.get(botId);
    if (!bot || !bot.ativo) return 0;
    // Sem data de início não há rampa: é bot de Telegram, ou um chip
    // cadastrado antes de a rampa existir. O teto cheio vale.
    const dia = bot.aquecimento_inicio
      ? diaDoAquecimento(bot.aquecimento_inicio, new Date())
      : DIA_JA_AQUECIDO;
    return tetoDoDia(dia, bot.envios_dia_max);
  }

  const enviadasPorChip = new Map();

  /*
    O ÚLTIMO ENVIO DE CADA CHIP, que é o que sustenta o intervalo por
    número. Começa no que o banco sabe e é atualizado a cada envio da
    rodada, em `contaNoChip`.
  */
  const ultimoEnvioDoBot = new Map();

  for (const c of canais ?? []) {
    if (c.plataforma !== "whatsapp" || !c.bot_id || !c.ultima_publicacao_em) continue;
    const este = new Date(c.ultima_publicacao_em);
    const anterior = ultimoEnvioDoBot.get(c.bot_id);
    if (!anterior || este > anterior) ultimoEnvioDoBot.set(c.bot_id, este);
  }

  /*
    TODOS os canais entram na conta do chip, inclusive os desativados
    hoje. O que já saiu pelo número saiu, e desativar o canal depois
    não desfaz o envio. Contar só os ativos afrouxaria o teto do
    número exatamente no dia em que alguém mexeu na configuração.
  */
  const botDoCanal = new Map((canais ?? []).map((c) => [c.id, c.bot_id]));

  if (whatsappLigado) {
    for (const [canalId, quantas] of Object.entries(enviadasHoje)) {
      const botId = botDoCanal.get(canalId);
      if (botId) enviadasPorChip.set(botId, (enviadasPorChip.get(botId) ?? 0) + quantas);
    }
  }

  function chipNoTeto(canal) {
    if (canal.plataforma !== "whatsapp") return false;
    if (!canal.bot_id) return false;
    return (enviadasPorChip.get(canal.bot_id) ?? 0) >= tetoDoBot(canal.bot_id);
  }

  function contaNoChip(canal) {
    if (canal.plataforma !== "whatsapp" || !canal.bot_id) return;
    enviadasPorChip.set(canal.bot_id, (enviadasPorChip.get(canal.bot_id) ?? 0) + 1);
    ultimoEnvioDoBot.set(canal.bot_id, new Date());
  }

  /* Envia uma oferta pendente. Devolve se saiu. */
  async function enviaOferta(pub, canal) {
    const oferta = pub.oferta;
    const anuncio = oferta?.anuncio;
    if (!oferta || !anuncio) return false;

    /*
      Falta de etiqueta é do CANAL, não deste item. Trava o canal na
      rodada para não repetir o mesmo aviso uma vez por oferta da fila
      dele. É a pendência do Beauty com `radargeral` (D-045).
    */
    if (!canal.etiqueta_afiliado) {
      console.log(`  ✗ ${canal.nome}: sem etiqueta de afiliado cadastrada, canal parado nesta rodada`);
      canaisTravados.add(canal.id);
      semLinkPorMotivo.canal_sem_etiqueta = (semLinkPorMotivo.canal_sem_etiqueta ?? 0) + 1;
      return false;
    }

    /*
      Canal de WhatsApp sem grupo ou sem chip cadastrado é o mesmo caso
      da etiqueta: é do CANAL, não deste item, e tentar mandar daria uma
      chamada de rede perdida por oferta da fila dele.

      A migration que criou as colunas não pôs constraint de propósito —
      os canais de WhatsApp nasceram na época em que a regra 3.2 proibia
      publicar, então nenhum tem grupo. Quem cobra é isto aqui.
    */
    if (canal.plataforma === "whatsapp" && (!canal.whatsapp_grupo_id || !instanciaDoCanal(canal))) {
      const falta = !canal.whatsapp_grupo_id
        ? "o grupo"
        : !canal.bot_id
          ? "o chip"
          : "o chip ATIVO (o bot existe mas está desligado)";
      console.log(`  ✗ ${canal.nome}: falta ${falta} de WhatsApp, canal parado nesta rodada`);
      canaisTravados.add(canal.id);
      return false;
    }

    /*
      A PRATELEIRA VEM ANTES DO LINK, e ela passou a valer aqui também.

      Até 01/08 a troca de prateleira só acontecia no caminho que
      publicava na mesma rodada em que a oferta era detectada. O que
      caía na fila e saía depois pulava a comparação — mesmo defeito da
      D-036, por outra porta.
    */
    const escolha = await melhorPrateleira(db, oferta);

    if (!escolha.usar) {
      const dela = escolha.melhorSemLastro;
      console.log(
        `  ⤫ ${canal.nome}: existe prateleira melhor sem lastro próprio ` +
          `(R$ ${(dela.preco_leitura_centavos / 100).toFixed(2)})`,
      );
      await db
        .from("oferta")
        .update({
          status: "rejeitada",
          motivo_rejeicao: "prateleira_melhor_sem_lastro",
          decidida_em: new Date().toISOString(),
        })
        .eq("id", oferta.id);
      motivos.prateleira_melhor_sem_lastro = (motivos.prateleira_melhor_sem_lastro ?? 0) + 1;
      reprovadas++;
      // A oferta acabou de ser rejeitada; a publicação dela tinha que
      // morrer junto e não morria. Ficavam as duas discordando: oferta
      // `rejeitada`, publicação `pendente` e voltando toda rodada.
      await encerraPublicacoesDaOferta(oferta.id, "prateleira melhor sem lastro próprio");
      return false;
    }

    const aPublicar = escolha.usar;
    const trocou = escolha.trocou;

    /*
      A COMPORTA VALE PARA QUEM DE FATO VAI SER PUBLICADO.

      `reprova()` rodou lá em cima sobre o anúncio da oferta. Se a
      prateleira trocou, quem sai é OUTRO anúncio, de outro vendedor —
      e `melhor_anuncio_do_produto` não aplica comporta nenhuma, só
      ordena por loja oficial, reputação e preço (migration 30). Um
      vendedor com reputação 0,5, abaixo do piso de 0,6, ganha de um com
      reputação nula e entra por aqui.

      É a migration 32 se repetindo: *"as comportas aprovavam olhando o
      histórico da pessoa errada"*, agora por outra porta. Medido em
      04/08: uma troca em onze execuções. Acontece pouco, e curadoria é
      o que separa este projeto de um repassador.
    */
    if (trocou) {
      const motivoDaTroca = reprova(aPublicar, par);
      if (motivoDaTroca) {
        console.log(
          `  ⤫ ${canal.nome}: a prateleira melhor não passa nas comportas (${motivoDaTroca}), fica a original`,
        );
        motivos[`troca_${motivoDaTroca.split("(")[0]}`] =
          (motivos[`troca_${motivoDaTroca.split("(")[0]}`] ?? 0) + 1;
        // Não é motivo para descartar a oferta: a prateleira original
        // passou nas comportas e continua publicável. Só não trocamos.
        return enviaComAnuncio(pub, canal, oferta, anuncio, false);
      }
    }

    if (trocou) trocas++;
    return enviaComAnuncio(pub, canal, oferta, aPublicar, trocou);
  }

  /* A parte que monta e manda, depois de decidido QUAL anúncio sai. */
  async function enviaComAnuncio(pub, canal, oferta, aPublicar, trocou) {

    let precoFinal = trocou ? aPublicar.preco_leitura_centavos : oferta.preco_atual_centavos;
    const referenciaFinal = trocou
      ? aPublicar.preco_original_centavos
      : oferta.preco_referencia_centavos;
    let descontoFinal = trocou
      ? Math.round((1 - precoFinal / referenciaFinal) * 100)
      : Math.round(Number(oferta.desconto_pct));
    let podeAfirmarMinimo = trocou ? false : oferta.pode_afirmar_minimo;

    /*
      O PREÇO DA SHOPEE É CONFERIDO AGORA, ANTES DE MONTAR A MENSAGEM.

      O catálogo da Shopee vem do feed de produto (D-058), que a loja
      publica uma vez por dia. A publicação nasce quando a oferta é
      detectada e sai quando o ritmo do canal permite — medido na fila
      de produção em 04/08, a mediana esperava **19,9 horas**.

      O que a medição disse, em amostra aleatória de 120 pendentes:
      94% com o preço inalterado, 6% com o preço mais BAIXO (até -49%) e
      as subidas raras e pequenas (1,7% e 2,9%, numa segunda amostra).
      Ou seja: o ganho principal não é evitar mentira, é publicar o preço
      bom quando ele já melhorou. A mentira é rara, e ainda assim é ela
      que a regra 3.4 não deixa passar.

      VEM ANTES DO LINK de propósito: oferta morta não gasta chamada de
      geração de link.

      A QUEDA DA API NÃO PODE VIRAR CANAL MUDO. Sem resposta, publica com
      o dado do feed, exatamente como antes — a mesma lógica da queda do
      link curto, logo abaixo. `lib/shopee-api.ts` já tem timeout.
    */
    if (aPublicar.marketplace?.slug === "shopee" && credShopee.appId && credShopee.appSecret) {
      // O SKU da Shopee é `{loja}.{item}` (`scripts/coleta-shopee.mjs`),
      // e a API pergunta pelo item.
      const sku = String(aPublicar.sku_externo ?? "");
      const itemId = sku.includes(".") ? sku.split(".")[1] : sku;
      const vivo = itemId ? await itemDaShopee(itemId, credShopee) : null;

      if (!vivo) {
        revalidacao.sem_resposta = (revalidacao.sem_resposta ?? 0) + 1;
      } else {
        const veredito = revalidaPreco({
          precoPublicadoCentavos: precoFinal,
          referenciaCentavos: referenciaFinal,
          gatilho: trocou ? "declarado" : oferta.gatilho,
          podeAfirmarMinimo,
          precoVivoCentavos: Math.round(Number(vivo.price) * 100),
          toleranciaAltaPct: par.tolerancia_alta_pct ?? 3,
          descontoTetoPct: par.desconto_declarado_teto_pct ?? 70,
        });

        if (veredito.acao === "descarta") {
          console.log(`  ⤫ ${canal.nome}: ${veredito.motivo}`);
          await db
            .from("oferta")
            .update({
              status: "rejeitada",
              motivo_rejeicao: veredito.motivo,
              decidida_em: new Date().toISOString(),
            })
            .eq("id", oferta.id);
          motivos[veredito.motivo.split("(")[0]] =
            (motivos[veredito.motivo.split("(")[0]] ?? 0) + 1;
          reprovadas++;
          revalidacao.morreu = (revalidacao.morreu ?? 0) + 1;
          // Mesma regra da F-01: quem perde a oferta perde as publicações
          // dela, senão elas voltam `pendente` para sempre.
          await encerraPublicacoesDaOferta(oferta.id, veredito.motivo);
          return false;
        }

        if (veredito.acao === "publica") {
          console.log(
            `  ~ ${canal.nome}: preço mudou desde o feed, ` +
              `R$ ${(precoFinal / 100).toFixed(2)} → R$ ${(veredito.precoCentavos / 100).toFixed(2)}`,
          );
          revalidacao[veredito.precoCentavos < precoFinal ? "melhorou" : "piorou"] =
            (revalidacao[veredito.precoCentavos < precoFinal ? "melhorou" : "piorou"] ?? 0) + 1;
          precoFinal = veredito.precoCentavos;
          descontoFinal = veredito.descontoPct;
          podeAfirmarMinimo = veredito.podeAfirmarMinimo;
        } else {
          revalidacao.confirmado = (revalidacao.confirmado ?? 0) + 1;
        }
      }
    }

    let curto = pub.link_afiliado;
    if (!curto) {
      /*
        CADA LOJA GERA O LINK DE UM JEITO, e a diferença é grande.

        O Mercado Livre **descarta** o `matt_word` que a gente manda e
        devolve um `ref=` cifrado: montar a URL à mão não paga comissão
        (D-034), então é obrigatório passar pelo gerador da Central, com
        sessão logada e etiqueta pré-cadastrada.

        A Amazon é o contrário e é o caso fácil: `tag` na URL já paga, e
        `ascsubtag` carrega o subid sem precisar cadastrar nada. É o
        mesmo formato que o SiteStripe produz. Sem sessão, sem etiqueta,
        sem chamada de rede — e por isso nunca falha por sessão
        expirada, que é o motivo número um de canal mudo aqui.

        A Shopee é do time da Amazon (D-057): o redirecionador
        `an_redir` aceita `affiliate_id` e `sub_id` direto na URL,
        testado com a conta real em 03/08. **Ela caía no `else` e ia
        parar no gerador do Mercado Livre**, que responderia erro para
        uma URL da Shopee — canal mudo sem ninguém entender por quê.
      */
      const loja = aPublicar.marketplace?.slug;

      /*
        A SHOPEE PASSA PELA OPEN API, E CAI PARA O `an_redir` SE ELA FALHAR.

        O `an_redir` (D-057) carrega a URL do produto codificada dentro
        de si, e o resultado eram três linhas de URL no post — feio a
        ponto de a migration 49 escondê-lo atrás de "Compre aqui". A Open
        API foi aprovada em 03/08 e a credencial chegou em 04/08: ela
        devolve `s.shopee.com.br/AAG6Zk4mf0`, e o subid sobrevive
        (conferido resolvendo o link: `utm_content=radarteste----`,
        `utm_source=an_18378371108`).

        A QUEDA É OBRIGATÓRIA, e não zelo. API de terceiro sai do ar, e
        canal mudo por causa disso seria trocar um problema de estética
        por um de receita — o `an_redir` é feio e paga comissão igual.
      */
      if (loja === "shopee" && credShopee.appId && credShopee.appSecret) {
        const viaApi = await geraLinkCurtoDaShopee(aPublicar.url_original, pub.subid, credShopee);
        if (viaApi.curto) {
          curto = viaApi.curto;
        } else {
          console.log(`  … ${canal.nome}: link curto falhou (${viaApi.motivo}), usando an_redir`);
        }
      }

      if (curto) {
        /*
          A Open API da Shopee já resolveu, e este ramo existe para a
          cadeia não continuar: sem ele, `curto` preenchido caía no
          `else if (!temSessaoDaCentral)` abaixo e o post da Shopee
          morria por falta de uma sessão que ele nem usa.
        */
      } else if (loja === "amazon" || loja === "shopee") {
        const link = montaLinkDeAfiliado(aPublicar.url_original, pub.subid, loja);
        if (!link.rastreado) {
          console.log(`  ✗ ${canal.nome}: ${link.motivo}`);
          semLink++;

          /*
            A MESMA CLASSIFICAÇÃO DO OUTRO CAMINHO, e de propósito.

            URL quebrada no banco não conserta sozinha. Falta de
            variável de ambiente, sim: é deploy, e a rodada seguinte
            pode já ter a variável — então continua pendente.
          */
          const tipo = classificaFalhaDeLink({ motivo: link.motivo });
          semLinkPorMotivo[tipo] = (semLinkPorMotivo[tipo] ?? 0) + 1;

          if (tipo === "permanente") {
            await encerraPublicacoesDaOferta(oferta.id, `URL inválida (${loja})`);
          }
          return false;
        }
        curto = link.url;
      } else if (!temSessaoDaCentral) {
        // O Mercado Livre é o único que depende da sessão. Fica
        // pendente e sai quando a sessão for renovada.
        console.log(`  ✗ ${canal.nome}: sem sessão da Central, o link do Mercado Livre não sai`);
        semLink++;
        semLinkPorMotivo.sessao_da_central = (semLinkPorMotivo.sessao_da_central ?? 0) + 1;
        return false;
      } else {
        const { gerados, falhas } = await geraLinks(
          [aPublicar.url_original],
          canal.etiqueta_afiliado,
          sessao,
        );
        if (gerados.length === 0) {
          const falha = falhas[0];
          console.log(`  ✗ ${canal.nome}: link não gerado (${falha?.motivo ?? "sem resposta"})`);
          semLink++;

          /*
            AQUI É ONDE OS NOVENTA PEDIDOS MORTOS POR DIA NASCIAM.

            Antes, qualquer falha devolvia `false` e a publicação
            continuava `pendente` — inclusive as que nunca teriam
            conserto. A cada rodada a fila era relida e a mesma URL
            recusada batia de novo no painel da Central.
          */
          const tipo = classificaFalhaDeLink(falha);
          semLinkPorMotivo[tipo] = (semLinkPorMotivo[tipo] ?? 0) + 1;

          if (tipo === "permanente") {
            await encerraPublicacoesDaOferta(
              oferta.id,
              `o programa de afiliados recusa esta URL (${falha?.motivo})`,
            );
          } else if (tipo === "canal") {
            // Etiqueta que não existe na Central: vale para toda a fila
            // deste canal, então para por aqui em vez de repetir.
            console.log(
              `    ↳ ${canal.nome}: a etiqueta "${canal.etiqueta_afiliado}" não está cadastrada na Central. Canal parado nesta rodada.`,
            );
            canaisTravados.add(canal.id);
          }
          return false;
        }
        curto = gerados[0].curto;
      }
      await db
        .from("publicacao")
        .update({ link_afiliado: curto, link_afiliado_em: new Date().toISOString() })
        .eq("id", pub.id);
    }

    /*
      O GANCHO, escrito pela IA (migration 64).

      TRÊS PORTAS ANTES DE GASTAR UMA CHAMADA, e a ordem é da mais
      barata para a mais cara:

        1. o gancho já guardado na publicação, de uma rodada que não
           chegou a enviar. Sem isto, uma publicação que espera o ritmo
           três rodadas paga três vezes pela mesma frase;
        2. `ia_gancho = 0`, que é o freio de mão;
        3. canal sem `instrucao_gancho`, que é como se escolhe ONDE o
           gancho vale.

      Os últimos ganchos do canal vão junto, e não é capricho: medido em
      10/08, pedindo seis seguidos, quatro começaram com "CHEGA DE".
      Repetição de abertura em canal a trinta posts por dia é carimbo de
      robô, que é o mesmo mal que a regra 3.11 combate no travessão.

      `geraGancho` nunca levanta erro: sem chave, fora do ar ou com a
      resposta reprovada na validação, devolve nulo e o post sai como
      sempre saiu. O gancho é tempero, não ingrediente.
    */
    const modeloDesteCanal = modeloDo(canal);
    let gancho = pub.gancho ?? null;

    if (
      !gancho &&
      (par.ia_gancho ?? 1) === 1 &&
      modeloDesteCanal.instrucaoGancho &&
      process.env.GEMINI_API_KEY
    ) {
      /*
        O ÚNICO FATO QUE A IA PODE AFIRMAR HOJE, e ele vem da nossa
        lista, não do modelo. Pedido do dono em 13/08: *"se for algo
        coreano, é legal a gente destacar que é coreano"*.

        Nenhum título de COSRX contém a palavra "coreano", e a instrução
        do gancho proíbe inventar característica. Quem sabe que a marca é
        coreana é `lib/marca-de-beleza.ts`. Por isso o fato é apurado
        aqui e entregue conferido: é a mesma disciplina da regra 3.4 com
        preço, onde a IA só pode dizer o que nós medimos.
      */
      const destaque =
        marcaDeBeleza(aPublicar.produto?.titulo_canonico).faixa === "coreana"
          ? "é um produto de beleza coreano (K-beauty), que é o que está em alta agora"
          : null;

      gancho = await geraGancho({
        titulo: aPublicar.produto?.titulo_canonico ?? "",
        vozDoCanal: modeloDesteCanal.instrucaoGancho,
        recentes: ganchosRecentes.get(canal.id) ?? [],
        destaque,
        chave: process.env.GEMINI_API_KEY,
      });

      if (gancho) {
        await db.from("publicacao").update({ gancho }).eq("id", pub.id);
        // Entra na lista de "não repita" já nesta rodada: o canal
        // publica várias vezes dentro da mesma execução, e sem isto a
        // repetição voltaria por dentro dela.
        const lista = ganchosRecentes.get(canal.id) ?? [];
        ganchosRecentes.set(canal.id, [gancho, ...lista].slice(0, 15));
        ganchosCriados++;
      } else {
        ganchosRecusados++;
      }
    }

    const texto = montaMensagem(modeloDesteCanal, {
      gancho,
      produto: aPublicar.produto?.titulo_canonico ?? "",
      precoCentavos: precoFinal,
      precoAntesCentavos: referenciaFinal,
      descontoPct: descontoFinal,
      loja: aPublicar.marketplace?.nome ?? "",
      vendedor: aPublicar.loja_oficial ? "Loja oficial" : (aPublicar.vendedor ?? ""),
      janelaDias: oferta.referencia_janela_dias,
      diasDeSerie: oferta.dias_de_serie,
      avaliacao: aPublicar?.avaliacao ?? null,
      avaliacaoQtd: aPublicar?.avaliacao_qtd ?? null,
      /*
        O `{desde}` é o primeiro dia em que LEMOS o anúncio, e não o dia
        em que a oferta foi detectada. Os dois divergem sempre: a série
        começa quando o anúncio entra no catálogo, e a oferta nasce
        quando o preço cai, dias depois. Dizer "menor preço que
        observamos desde ontem" com dez dias de leitura seria jogar
        fora a única coisa que o concorrente não tem.

        `detectada_em` fica de reserva para oferta antiga, de antes da
        migration 72, que ainda não tem a série gravada.
      */
      observadoDesde: oferta.nosso_minimo_desde ?? oferta.detectada_em.slice(0, 10),
      nossoMinimoCentavos: oferta.nosso_minimo_centavos,
      nossosDiasLidos: oferta.nossos_dias_lidos,
      diasMinimosParaLastro: par.dias_minimos_para_lastro,
      // Já vem decidido lá em cima: a troca de prateleira zera, e o
      // preço que subiu desde o feed também (regra 3.4).
      podeAfirmarMinimo,
      // A nossa leitura anterior, que vira o {queda} do lastro. Numa
      // troca de prateleira ela não vale: a série é do outro anúncio.
      precoAnteriorCentavos: trocou ? null : oferta.preco_anterior_centavos,
      gatilho: trocou ? "declarado" : oferta.gatilho,
      notaDoCurador: aPublicar.produto?.nota_curador,
      // Decide o {emoji} quando o título não bastar.
      nichoSlug: aPublicar.produto?.nicho?.slug ?? null,
      freteGratis: aPublicar.frete_gratis,
      /*
        O VENDEDOR PASSOU A SER DESCRITO, e não só nomeado.

        "+10.000 vendas, MercadoLíder Platinum" é o sinal de confiança
        mais barato que existe, e é o que os canais que funcionam
        publicam. O Mercado Livre informa vendas em 100% dos nossos
        anúncios; a Shopee em nenhum, e lá a linha sai só com o nome.
      */
      vendasDoVendedor: aPublicar.vendas_estimadas,
      seloDoVendedor: aPublicar.selo_vendedor,
      lojaOficial: aPublicar.loja_oficial,
      // Cupom que sirva para ESTE produto, ou nada. A linha some junto.
      cupom: cupomQueServe(aPublicar, precoFinal),
      link: curto,
    });

    /*
      O CARD DE LINK, decidido por LOJA (migration 63).

      Só vale para o WhatsApp: no Telegram a foto não cai na galeria de
      ninguém, então o problema que o card resolve não existe lá.
    */
    const comCard =
      canal.plataforma === "whatsapp" &&
      saiComCardDeLink(aPublicar.marketplace?.slug, (par.whatsapp_link_preview ?? 1) === 1);

    const envio = await manda(
      canal,
      texto,
      fotoValida(aPublicar),
      instanciaDoCanal(canal),
      comCard,
    );
    if (!envio.ok) {
      console.log(`  ✗ ${canal.nome}: ${envio.motivo}`);
      return false;
    }

    const quando = new Date().toISOString();
    await db
      .from("publicacao")
      /*
        `telegram_message_id` é o que permite apagar ou editar depois
        (migration 44). O Telegram sempre devolveu esse id e nós sempre
        o descartávamos — até um perfume feminino sair no canal
        masculino e não haver como tirar.

        O WhatsApp tem a coluna própria, e ela importa mais lá: o
        Telegram deixa apagar do canal a qualquer momento, e o WhatsApp
        só dentro da janela de "apagar para todos". Sem o id gravado no
        instante do envio, a janela fecha antes de alguém achar o post.
      */
      .update({
        estado: "enviada",
        origem: "fluxo",
        enviada_em: quando,
        mensagem: texto,
        ...(canal.plataforma === "whatsapp"
          ? { whatsapp_message_id: envio.id ?? null }
          : { telegram_message_id: envio.id ?? null }),
      })
      .eq("id", pub.id);

    publicadas++;
    console.log(
      `  ✓ ${canal.nome}: ${aPublicar.produto?.titulo_canonico?.slice(0, 46)}` +
        (trocou ? " (trocou de prateleira)" : ""),
    );
    return true;
  }

  /* Envia um post de cupom. Devolve se saiu. */
  async function enviaCupom(cupom, canal) {
    const texto = montaMensagemDeCupom(modelo.corpoCupom, {
      codigo: cupom.codigo,
      loja: cupom.marketplace_nome ?? "Mercado Livre",
      percentual: cupom.valor,
      minimoCentavos: cupom.valor_minimo_centavos ?? 0,
      tetoCentavos: cupom.teto_desconto_centavos,
      onde: cupom.geral ? null : (cupom.nicho_slug ?? null),
      /*
        A validade é o dia em SÃO PAULO, e não o pedaço da ISO.
        `vigente_ate` é 23:59:59 daqui, que em UTC já é o dia seguinte:
        cortar a string dava um dia a mais de prazo ao leitor.
      */
      validade: diaEmSaoPaulo(new Date(cupom.vigente_ate)),
    });

    const envio = await manda(canal, texto, null, instanciaDoCanal(canal));
    if (!envio.ok) {
      console.log(`  ✗ ${canal.nome}: cupom ${cupom.codigo}: ${envio.motivo}`);
      return false;
    }

    await db
      .from("cupom_publicado")
      .insert({ cupom_id: cupom.id, canal_id: canal.id, enviada_em: new Date().toISOString(), mensagem: texto });

    cuponsPublicados++;
    console.log(`  ✓ ${canal.nome}: cupom ${cupom.codigo} (${cupom.valor}%)`);
    return true;
  }

  /*
    A FILA DE CADA CANAL: o cupom primeiro, depois as ofertas.

    O cupom vem na frente porque ele é o item PERECÍVEL. O do Mercado
    Livre vale um dia e morre à meia-noite; a oferta continua valendo
    amanhã. Deixá-lo por último foi o que fez zero cupom sair hoje,
    mesmo com quatro vivos no banco.

    Um por rodada, no máximo: cupom é complemento, não o produto do
    canal.
  */
  const { data: cupons } = await db
    .from("cupons_vivos")
    .select(
      "id, codigo, valor, valor_minimo_centavos, teto_desconto_centavos, vigente_ate, nicho_id, nicho_slug, geral, marketplace_nome, marketplace_id, marketplace_slug",
    )
    .eq("tipo", "percentual")
    .order("valor", { ascending: false });

  /*
    O CUPOM QUE SERVE PARA ESTE PRODUTO, e o escopo é o que impede o
    erro da mangueira de jardim aparecer com outra roupa.

    Três condições, e todas são de recusa:

      LOJA      cupom do Mercado Livre não vale na Shopee. Óbvio, e é o
                erro mais caro porque o post fica plausível.
      NICHO     cupom `geral` vale em tudo; cupom de nicho vale só no
                nicho dele. Prefixo sem mapa entra com `geral = false` e
                `nicho_id` nulo, e nessa combinação nada serve (D-039).
      MÍNIMO    cupom com mínimo de R$ 99 num produto de R$ 40 é
                promessa que falha no carrinho. Some em vez de sair.

    Empate resolve pelo maior desconto, que é a ordem que a consulta já
    devolve.
  */
  function cupomQueServe(anuncio, precoCentavos) {
    const nichoDoProduto = anuncio?.produto?.nicho_id ?? null;
    const lojaDoProduto = anuncio?.marketplace?.slug ?? null;

    return (
      (cupons ?? []).find((c) => {
        if (c.marketplace_slug && c.marketplace_slug !== lojaDoProduto) return false;
        if (!c.geral && (!c.nicho_id || c.nicho_id !== nichoDoProduto)) return false;
        if ((c.valor_minimo_centavos ?? 0) > precoCentavos) return false;
        return true;
      }) ?? null
    );
  }

  /*
    POR CANAL, E COM TETO, e antes era uma consulta só para todos.

    ISTO ESTAVA MATANDO METADE DOS CANAIS, e em silêncio. A consulta
    pedia todas as publicações pendentes de uma vez, ordenadas por data
    de criação, e o PostgREST corta em 1.000 linhas sem avisar que
    cortou. Com 4.005 pendentes, o publicador só enxergava as 1.000 mais
    ANTIGAS — e nelas apareciam só quatro dos oito canais.

    Medido em 04/08, à noite, quando o Radar Casa nasceu e não publicava:
    a primeira publicação dele estava na posição 3.997 da fila, e a
    milésima era de três horas antes. Ele nunca era considerado. O mesmo
    valia para Pet, Geek e Perfumes, que passavam rodadas mudos enquanto
    Beauty, Kids, Tech e Fitness levavam tudo.

    O sintoma é cruel: canal mudo com fila cheia parece falta de oferta
    ou ritmo apertado, que foram as duas primeiras coisas que eu fui
    conferir. É o mesmo defeito que o `coleta-mercado-livre.mjs` já
    documenta, e lá também só apareceu quando a base passou de mil.

    Consultar POR CANAL resolve os dois lados: cada um recebe a própria
    fatia, e o teto por canal impede que a consulta cresça junto com o
    represamento.

    E O TETO DE CEM ERA O DEFEITO SEGUINTE, achado em 13/08.

    "Cem é folga larga", dizia esta linha, e a conta parecia fechar: o
    canal mais ativo publica 60 numa rodada. Ela só vale enquanto a fila
    ENTRA aos poucos. O Radar Delas nasceu ao contrário: **1.490 das
    1.544 publicações pendentes dele foram criadas de uma vez**, em
    10/08 às 18:44, e ordenar por `criado_em` numa fila que compartilha
    o mesmo instante devolve sempre as mesmas cem — as que o `insert`
    gravou primeiro, que naquele lote vieram ordenadas por nota, que num
    catálogo de beleza favorece kit de salão e secador.

    O efeito é o que o dono viu: *"10 SECADORES E 0 WEPINK"*. As cem que
    o publicador enxergava eram de cabelo, e os 194 produtos de
    maquiagem e 154 de skincare que estavam na MESMA fila, nas posições
    de 100 em diante, não existiam para ele. Não era falta de catálogo,
    não era comporta e não era o revezamento: era a janela.

    Ler a fila inteira devolve ao `intercalaPorVariedade` o material que
    ele precisa para alternar de verdade, e é barato: 1.544 linhas numa
    consulta paginada, uma vez por rodada. O que protege a memória não é
    o teto, é o `TETO_DA_FILA` logo abaixo, que existe para o caso
    patológico e não para o dia a dia.
  */
  const TETO_DA_FILA = Number(process.env.PENDENTES_POR_CANAL ?? 5_000);

  const pendentesDoCanal = new Map();
  for (const canal of canaisAtivos) {
    const fila = [];
    let erro = null;

    // Paginado porque o PostgREST corta em 1.000 linhas sem avisar que
    // cortou — o mesmo defeito que já calou metade dos canais uma vez.
    for (let de = 0; de < TETO_DA_FILA; de += 1000) {
      const ate = Math.min(de + 999, TETO_DA_FILA - 1);
      const { data, error } = await db
        .from("publicacao")
        .select(`id, subid, canal_id, link_afiliado, gancho, oferta:oferta_id ( ${SELECAO} )`)
        .eq("estado", "pendente")
        .eq("canal_id", canal.id)
        .order("criado_em")
        .range(de, ate);

      if (error) {
        erro = error;
        break;
      }

      fila.push(...(data ?? []));
      if ((data ?? []).length < ate - de + 1) break;
    }

    if (erro) {
      console.log(`  ✗ fila de ${canal.nome}: ${erro.message}`);
      pendentesDoCanal.set(canal.id, []);
      continue;
    }
    pendentesDoCanal.set(canal.id, fila);
  }

  const EMPTY_SET = new Set();

  /*
    OS PRODUTOS QUE CADA CANAL JÁ PUBLICOU, dentro da janela de recompra.

    A janela sai do mesmo parâmetro da comporta de fadiga
    (`dias_recompra_mesmo_anuncio`), para não haver dois números
    dizendo "o mesmo produto" com prazos diferentes. Duas fontes de
    verdade para o mesmo prazo é como se descobre, tarde, que o grupo
    recebeu o secador duas vezes.

    Paginado porque o PostgREST corta em 1.000 linhas sem avisar que
    cortou — é o mesmo defeito que já calou metade dos canais uma vez,
    e aqui ele seria pior: a lista viria curta e a repetição passaria
    justamente nos canais mais antigos.
  */
  const jaPublicadosNoCanal = new Map();

  {
    const dias = Number(par.dias_recompra_mesmo_anuncio ?? 30);
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
    let de = 0;

    for (;;) {
      const { data, error } = await db
        .from("publicacao")
        .select("canal_id, oferta:oferta_id ( anuncio:anuncio_id ( produto_id ) )")
        .eq("estado", "enviada")
        .gte("enviada_em", desde)
        .order("enviada_em", { ascending: false })
        .range(de, de + 999);

      if (error || !data?.length) break;

      for (const linha of data) {
        const id = linha.oferta?.anuncio?.produto_id;
        if (!id) continue;
        const set = jaPublicadosNoCanal.get(linha.canal_id) ?? new Set();
        set.add(id);
        jaPublicadosNoCanal.set(linha.canal_id, set);
      }

      if (data.length < 1000) break;
      de += 1000;
    }

    console.log(
      `histórico de ${dias} dias: ${[...jaPublicadosNoCanal.values()].reduce((s, x) => s + x.size, 0)} produtos já publicados`,
    );
  }

  /*
    O MESMO FILTRO DA ENTRADA, APLICADO NA SAÍDA.

    Chama exatamente as funções que o laço das ofertas novas usa —
    `canalAceitaAtributos` e a lista de nichos do canal —, e não uma
    cópia delas. Duas implementações da mesma regra divergem, e a
    divergência aqui é um post no canal errado.

    O TÍTULO TAMBÉM É CONSULTADO, e não só os atributos gravados. Quem
    entrou no catálogo antes de a regra existir pode nunca ter sido
    marcado: a marcação acontece na coleta e no `remarca-atributos`, e
    entre uma coisa e outra a fila anda. `tipoForaDaBeleza` lê o título
    na hora, então um produto sem `TIPO` gravado ainda é barrado se o
    nome dele disser o que ele é.
  */
  function motivoDeNaoServirMais(pub, canal) {
    const produto = pub?.oferta?.anuncio?.produto;
    if (!produto) return null;

    /*
      O PRODUTO JÁ SAIU NESTE CANAL, e a fila não sabia.

      Medido em 13/08, no proprio grupo: o Secador Taiff Black Íon saiu
      às 13:12 e de novo às 14:23, e antes dele o Secador Philco saiu às
      23:02 e 23:54 de 12/08. Sempre o mesmo `produto_id` por duas
      PRATELEIRAS diferentes do Mercado Livre.

      A migration 73 fechou isso na origem: a comporta de fadiga passou
      a ser por produto e não por anúncio. Só que ela vale para oferta
      NOVA, e as 1.599 publicações pendentes destes canais foram criadas
      todas de uma vez, em 10/08 18:44 — antes da correção existir. A
      regra nova não retroage sobre fila já formada, exatamente como a
      de barbearia não retroagia.

      É por isso que a conferência mora aqui e não só lá: a fila
      represada tem dias de vida, e o que a protege é ser reperguntada
      na saída, com o que o canal REALMENTE publicou.
    */
    const produtoId = pub?.oferta?.anuncio?.produto_id;
    if (produtoId && (jaPublicadosNoCanal.get(canal.id) ?? EMPTY_SET).has(produtoId)) {
      return "produto_repetido";
    }

    const nichoId = produto.nicho_id;
    if (!nichoId) return "sem_nicho";

    if (!(canal.canal_nicho ?? []).some((cn) => cn.nicho_id === nichoId)) {
      return "nicho_fora_do_canal";
    }

    /*
      O título vale como atributo quando não há atributo. Não
      sobrescreve o que já existe, pela mesma regra de
      `atributosComTipo`: se alguém marcou à mão, a mão ganha.
    */
    const atributos = { ...(produto.atributos ?? {}) };
    if (!atributos.TIPO) {
      const doTitulo = tipoForaDaBeleza(produto.titulo_canonico);
      if (doTitulo) atributos.TIPO = doTitulo;
    }

    const passa = canalAceitaAtributos(
      (canal.canal_atributo ?? []).map((f) => ({
        ...f,
        exigeAtributo: f.exige_atributo,
        nichoId: f.nicho_id,
      })),
      atributos,
      nichoId,
    );

    return passa ? null : "filtro_de_atributo";
  }

  /** A assinatura de variedade de uma publicação, do jeito que a fila a vê. */
  const assinaturaDaPublicacao = (pub) =>
    assinaturaDe({
      grupo: eixoDeVariedade(
        pub?.oferta?.anuncio?.produto?.nicho_id,
        pub?.oferta?.anuncio?.produto?.titulo_canonico,
      ),
      precoCentavos: pub?.oferta?.preco_atual_centavos ?? 0,
    });

  /*
    O ÚLTIMO POST DE CADA CANAL, para o revezamento não recomeçar do zero.

    Lido do que JÁ FOI ENVIADO, pelo mesmo motivo dos ganchos recentes
    logo acima: o que importa é o que quem lê o grupo viu passar, e não o
    que esta execução montou. Sem isto, cada rodada horária escolhe o
    primeiro post sem saber o que veio antes dela.
  */
  const ultimaAssinaturaDoCanal = new Map();

  {
    const { data: ultimos } = await db
      .from("publicacao")
      .select(
        `canal_id, oferta:oferta_id ( preco_atual_centavos, anuncio:anuncio_id ( produto:produto_id ( titulo_canonico, nicho_id ) ) )`,
      )
      .eq("estado", "enviada")
      .order("enviada_em", { ascending: false })
      .limit(200);

    for (const linha of ultimos ?? []) {
      if (ultimaAssinaturaDoCanal.has(linha.canal_id)) continue;
      if (!linha.oferta?.anuncio) continue;
      ultimaAssinaturaDoCanal.set(linha.canal_id, assinaturaDaPublicacao(linha));
    }
  }

  const filaDoCanal = new Map();

  for (const canal of canaisAtivos) {
    const fila = [];

    if (modelo.corpoCupom) {
      const nichosDoCanal = new Set((canal.canal_nicho ?? []).map((cn) => cn.nicho_id));
      const elegiveis = (cupons ?? []).filter(
        (c) => c.geral || (c.nicho_id && nichosDoCanal.has(c.nicho_id)),
      );

      if (elegiveis.length > 0) {
        const { data: jaFoi } = await db
          .from("cupom_publicado")
          .select("cupom_id")
          .eq("canal_id", canal.id);
        const vistos = new Set((jaFoi ?? []).map((x) => x.cupom_id));
        const cupom = elegiveis.find((c) => !vistos.has(c.id));
        if (cupom) fila.push({ tipo: "cupom", cupom });
      }
    }

    /*
      As ofertas do canal, intercaladas para não sair oito parecidas em
      sequência (o mesmo motivo de `lib/variedade.ts`).

      UM PRODUTO OCUPA UMA VAGA, e não cinco. O Mercado Livre cadastra o
      mesmo item em várias prateleiras, e cada uma virou uma publicação
      pendente: o "Protetor Solar Em Bastão Sallve" aparecia CINCO vezes
      na fila do Radar Delas em 13/08.

      Isso não incomodava enquanto a janela era de cem itens, porque as
      cópias ficavam espalhadas pela fila inteira e o publicador só via
      um pedaço dela. Lendo a fila toda, elas passaram a competir juntas
      pelas mesmas vagas, e a simulação da ordem nova pôs o mesmo Sallve
      cinco vezes nos quarenta primeiros posts.

      A comporta de fadiga não pega isto: ela compara com o que já FOI
      ENVIADO, e estas cinco ainda não foram. A trava do banco também
      não, pelo mesmo motivo. O lugar de resolver é aqui, montando a
      fila, e o critério é o `produto_id`, que é o mesmo que a migration
      73 usa para dizer "o mesmo produto".

      Fica a PRIMEIRA de cada, que na ordem por `criado_em` é a mais
      antiga da fila. As outras não são canceladas: elas continuam
      pendentes e viram a vez do produto no dia em que a janela de
      recompra reabrir.
    */
    const vistos = new Set();
    const minhas = (pendentesDoCanal.get(canal.id) ?? []).filter((p) => {
      if (!p.oferta?.anuncio) return false;

      const produtoId = p.oferta.anuncio.produto_id;
      if (!produtoId) return true;
      if (vistos.has(produtoId)) return false;
      vistos.add(produtoId);
      return true;
    });
    /*
      MARCA BOA VAI PARA A FRENTE, e não exclui ninguém.

      Pedido do dono em 06/08, olhando o canal de perfume: *"quase não
      tá vindo coisa boa, só tá vindo body splash e perfume duvidoso...
      não tem como preferirmos perfumes de marcas boas ou perfumes
      árabes?"*. E o catálogo dá razão: dos 393 produtos do nicho, 317
      são de marca que ninguém reconhece, com Amakha Paris à frente.

      **Ordena, não filtra**, e a distinção é dele: *"não tem problema a
      vir body splash"*. O canal já ficou 30 horas mudo por falta de
      catálogo, e excluir marca desconhecida o calaria de vez.

      A intercalação por variedade continua valendo DENTRO de cada
      grupo, senão trocaríamos "oito Amakha seguidas" por "oito Azzaro
      seguidos" — que é o mesmo defeito que `lib/variedade.ts` existe
      para impedir.

      E A LISTA SÓ CONHECIA PERFUME, o que em 13/08 virou o defeito
      principal do Radar Delas. `pesoDaMarca` é de
      `lib/marca-de-perfume.ts`: Azzaro, Lattafa, Natura. Dos 348
      produtos de maquiagem e skincare que estavam na fila do canal de
      beleza, **três** casavam com ela — Quem Disse Berenice, Kiko
      Milano, Océane, Ruby Rose, Payot, Cerave, Vichy, Principia e
      Creamy todos valiam zero. Eles iam para o segundo bloco, atrás de
      qualquer perfume desconhecido, e é por isso que o dono via *"10
      secadores e 0 WePink"*.

      `lib/marca-de-beleza.ts` é a lista que faltava, escrita com o
      mesmo contrato: ordena, não filtra. As duas somam porque um canal
      pode ter os dois nichos — o Radar Delas tem `beleza` e `perfume`
      juntos —, e um item que casa nas duas não vale mais que um que
      casa numa: o que importa aqui é ser reconhecido ou não.
    */
    const comMarca = (p) => {
      const titulo = p.oferta?.anuncio?.produto?.titulo_canonico;
      return pesoDaMarca(titulo) > 0 || pesoDaMarcaDeBeleza(titulo) > 0;
    };

    /*
      O EIXO DO REVEZAMENTO É A FAMÍLIA, e não mais o nicho.

      Era `nicho_id`, e num canal de nicho único isso é uma CONSTANTE: o
      Radar Delas é inteirinho `beleza`, então a assinatura virava só a
      faixa de preço e não havia nada a alternar. O resultado foi o que
      o dono descreveu em 13/08 olhando o grupo — *"só secador, produto
      caro... tem que revezar, às vezes um gloss, às vezes hidratante"* —
      e as sessenta últimas publicações confirmam: secador, kit de salão,
      escova secadora, secador, secador.

      `lib/familia-de-beleza.ts` separa aparelho de cabelo, skincare,
      maquiagem, cabelo de consumo, corpo, unha e o resto. Continua sendo
      só ORDEM: nada é descartado, e o secador continua saindo, porque o
      dono foi explícito que ele deve sair.
    */
    const paraFila = (lista, semente) =>
      intercalaPorVariedade(
        lista.map((p) => ({
          grupo: eixoDeVariedade(
            p.oferta?.anuncio?.produto?.nicho_id,
            p.oferta?.anuncio?.produto?.titulo_canonico,
          ),
          precoCentavos: p.oferta?.preco_atual_centavos ?? 0,
          pub: p,
        })),
        semente,
      ).map((x) => ({ tipo: "oferta", pub: x.pub }));

    /*
      A SEMENTE É O QUE O CANAL PUBLICOU POR ÚLTIMO, e é ela que faz o
      revezamento sobreviver à virada de rodada. Sem isso a fila é
      montada do zero de hora em hora e o primeiro post da rodada nova
      pode repetir a família do último da rodada velha — que foi o que
      pôs dois secadores Philco em sequência em 12/08.
    */
    const semente = ultimaAssinaturaDoCanal.get(canal.id) ?? null;

    const daMarca = paraFila(minhas.filter(comMarca), semente);
    const emOrdem = [
      ...daMarca,
      ...paraFila(
        minhas.filter((p) => !comMarca(p)),
        daMarca.length > 0 ? assinaturaDaPublicacao(daMarca[daMarca.length - 1].pub) : semente,
      ),
    ];

    fila.push(...emOrdem);
    filaDoCanal.set(canal.id, fila);
  }

  /*
    QUANTOS PRIMÁRIOS JÁ SAÍRAM DESDE O ÚLTIMO SECUNDÁRIO.

    Contado a partir do que o canal REALMENTE publicou hoje, e não
    zerado a cada execução. Zerando, cada rodada horária teria direito a
    um secundário logo de cara, e a proporção de um para quatro viraria
    um para dois no fim do dia.
  */
  /*
    OS ÚLTIMOS GANCHOS DE CADA CANAL, para a IA não repetir a abertura.

    Lidos do que JÁ FOI ENVIADO, e não da fila: o que importa é o que
    quem lê o grupo viu passar. Quinze cobre uns dois dias no ritmo de
    hoje, o suficiente para a repetição incomodar sem carregar histórico
    à toa.
  */
  const ganchosRecentes = new Map();

  {
    const { data: ultimos } = await db
      .from("publicacao")
      .select("canal_id, gancho")
      .not("gancho", "is", null)
      .eq("estado", "enviada")
      .order("enviada_em", { ascending: false })
      .limit(200);

    for (const linha of ultimos ?? []) {
      const lista = ganchosRecentes.get(linha.canal_id) ?? [];
      if (lista.length < 15) {
        lista.push(linha.gancho);
        ganchosRecentes.set(linha.canal_id, lista);
      }
    }
  }

  const primariosDesde = new Map();

  {
    const { data: doDia } = await db
      .from("publicacao")
      .select(`canal_id, oferta:oferta_id ( anuncio:anuncio_id ( categoria_ramo ) )`)
      .eq("estado", "enviada")
      .gte("enviada_em", desdeMeiaNoite)
      .order("enviada_em", { ascending: false });

    for (const canal of canaisAtivos) {
      let contados = 0;
      for (const linha of (doDia ?? []).filter((l) => l.canal_id === canal.id)) {
        if (ramoSecundario.has(linha.oferta?.anuncio?.categoria_ramo ?? "")) break;
        contados += 1;
      }
      primariosDesde.set(canal.id, contados);
    }
  }

  /*
    O LAÇO QUE DORME.

    A cada volta escolhe o canal que pode falar mais cedo. Se ninguém
    pode agora, dorme até o primeiro poder — desde que caiba na janela.
    Não cabendo, encerra: o que sobrar sai na rodada seguinte, que é o
    comportamento certo, e a fila não se perde porque ela é lida do
    banco.
  */
  while (Date.now() < limite) {
    let melhor = null;

    for (const canal of canaisAtivos) {
      const fila = filaDoCanal.get(canal.id);
      if (!fila || fila.length === 0) continue;
      // Erro de cadastro do canal já apareceu nesta rodada: o resto da
      // fila dele daria o mesmo erro, uma chamada de rede por item.
      if (canaisTravados.has(canal.id)) {
        esperando += fila.length;
        filaDoCanal.set(canal.id, []);
        continue;
      }
      if (noTetoDiario(canal)) {
        noTeto++;
        filaDoCanal.set(canal.id, []);
        continue;
      }
      /*
        O chip estourou o dia. Sai da rodada como quem bateu no teto, e
        o log diz QUAL chip — com vários números na operação, "o canal
        parou" sem o nome do chip é diagnóstico impossível.
      */
      if (chipNoTeto(canal)) {
        console.log(
          `  ⏸ ${canal.nome}: chip ${bots.get(canal.bot_id)?.nome ?? "(sem bot)"} bateu ${tetoDoBot(canal.bot_id)} envios hoje`,
        );
        noTeto += fila.length;
        filaDoCanal.set(canal.id, []);
        continue;
      }
      /*
        Fora do horário o canal PULA ESTA VOLTA, e a fila dele fica
        inteira — na memória e no banco.

        ELA ERA ESVAZIADA AQUI, e isso deixou o Radar Delas mudo o dia
        inteiro em 11/08. A rodada dura 50 minutos e pode atravessar a
        virada de uma janela: começou 07:45, achou o canal fora do
        horário, zerou a fila em memória, e às 08:00 — com a janela
        aberta — não havia mais o que publicar. O canal só voltava a
        falar na rodada seguinte, e essa é a diferença entre publicar
        na janela e perder a janela.

        Nos canais de Telegram isso nunca apareceu porque eles aceitam
        as 24 horas e nunca ficam fora. É um defeito que só existe para
        canal com janela estreita, que é exatamente o do WhatsApp.

        A contagem para o resumo passa a ser por canal, uma vez só: sem
        isso ela cresceria a cada volta do laço e o número do fim viria
        multiplicado pelo número de voltas.
      */
      if (foraDoHorario(canal)) {
        if (!foraDeHorarioContado.has(canal.id)) {
          foraDeHorario += fila.length;
          foraDeHorarioContado.add(canal.id);
        }
        continue;
      }

      /*
        O WHATSAPP TEM RITMO PRÓPRIO, e ele ignora a faixa do dia.

        Regra do dono em 10/08: de 4 a 10 minutos entre promos,
        sorteado, nunca menos e nunca mais. O `ritmo` configurado
        continua servindo o Telegram; passar o canal aqui é o que troca
        a régua (`lib/ritmo.ts`).
      */
      const doCanal = podePublicarAgora(
        new Date(),
        canal.ultima_publicacao_em ? new Date(canal.ultima_publicacao_em) : null,
        ritmo,
        canal.plataforma === "whatsapp"
          ? { canalId: canal.id, porHora: porHoraDoBot(canal.bot_id) }
          : null,
      );

      /*
        O CANAL LIBERA E O CHIP AINDA PODE SEGURAR.

        Sem esta segunda trava, oito grupos no mesmo número teriam oito
        relógios independentes: o laço publicaria um por vez, mas em
        sequência, e o número mandaria oito mensagens em menos de um
        minuto. Cada canal teria respeitado a própria regra.
      */
      const doChip =
        canal.plataforma === "whatsapp" && canal.bot_id
          ? podeChipFalarAgora(
              new Date(),
              ultimoEnvioDoBot.get(canal.bot_id) ?? null,
              canal.bot_id,
              porHoraDoBot(canal.bot_id),
            )
          : { pode: true };

      const veredito = doCanal.pode ? doChip : doCanal;
      const faltamMs = veredito.pode ? 0 : (veredito.faltamMinutos ?? 1) * 60_000;
      if (!melhor || faltamMs < melhor.faltamMs) melhor = { canal, faltamMs };
    }

    if (!melhor) break;

    if (melhor.faltamMs > 0) {
      if (Date.now() + melhor.faltamMs >= limite) {
        esperando += filaDoCanal.get(melhor.canal.id)?.length ?? 0;
        break;
      }
      console.log(`  … ${melhor.canal.nome}: esperando ${Math.ceil(melhor.faltamMs / 60_000)} min`);
      // Um segundo a mais para não acordar no limiar e recalcular igual.
      await espera(melhor.faltamMs + 1_000);
      continue;
    }

    const canal = melhor.canal;
    const fila = filaDoCanal.get(canal.id);

    /*
      O PRIMEIRO ITEM ELEGÍVEL, e não simplesmente o primeiro.

      Secundário só entra depois da cota de primários. Não sendo a vez
      dele, ele **fica na fila** e o laço pega o próximo primário — não
      se perde nada, só muda a ordem.
    */
    const indice = fila.findIndex(
      (it) =>
        it.tipo === "cupom" ||
        !ehSecundario(it.pub) ||
        (primariosDesde.get(canal.id) ?? 0) >= porSecundario,
    );

    if (indice === -1) {
      // Só restou secundário e a cota não foi cumprida. Encerra o canal
      // nesta rodada: eles continuam `pendente` e voltam na próxima,
      // quando houver primário para acompanhar.
      adiadosPorProporcao += fila.length;
      filaDoCanal.set(canal.id, []);
      continue;
    }

    const [item] = fila.splice(indice, 1);

    /*
      A ÚLTIMA CONFERÊNCIA, IMEDIATAMENTE ANTES DE SAIR.

      ISTO NASCEU DE UM POST QUE NÃO PODIA TER SAÍDO. Em 13/08, às
      10:32, o grupo de mulheres recebeu:

        Navalha Profissional Retrátil P/ Desfiar Cabo Inox P/ Barba

      E o produto ESTAVA marcado: `atributos.TIPO = "barbearia"`. E o
      canal ESTAVA filtrando: `canal_atributo` exclui `barbearia` e
      `eletronico` nos dois Radar Delas. As duas metades certas, e o
      post saiu assim mesmo.

      A CAUSA É QUANDO O FILTRO RODAVA. Ele roda uma vez só, no momento
      em que a publicação NASCE, lá no laço das ofertas novas. Depois
      disso a linha vira `pendente` e nunca mais é perguntada. Esta
      publicação nasceu em **10/08 18:44** e saiu em **13/08 13:32** —
      no meio, em 12/08, a regra de barbearia foi criada. A regra nova
      não alcançava a fila velha.

      E a fila velha é grande: 2.808 publicações pendentes, 1.599 delas
      nos dois canais de beleza, algumas represadas há dias. Toda regra
      que criarmos daqui para a frente teria o mesmo furo, e o sintoma
      seria sempre este: a regra parece não funcionar, mas ela funciona
      — só não retroage.

      Reconferir na SAÍDA conserta o passado e o futuro de uma vez.
      Quando o veredito mudou, a publicação é CANCELADA e não enviada:
      cancelar é barato e o post errado não tem volta. Ela não é
      apagada, para o cancelamento ficar auditável.

      Custo: nenhuma chamada de rede a mais. Nicho, atributos e canal já
      estão todos em memória nesta altura.
    */
    if (item.tipo === "oferta") {
      const barrado = motivoDeNaoServirMais(item.pub, canal);
      if (barrado) {
        await db
          .from("publicacao")
          .update({ estado: "cancelada", cancelada_em: new Date().toISOString() })
          .eq("id", item.pub.id);
        console.log(
          `  ⛔ ${canal.nome}: ${item.pub.oferta?.anuncio?.produto?.titulo_canonico?.slice(0, 46)} — ${barrado} na saída`,
        );
        canceladasNaSaida += 1;
        continue;
      }
    }

    const saiu =
      item.tipo === "cupom" ? await enviaCupom(item.cupom, canal) : await enviaOferta(item.pub, canal);

    // O relógio do canal só anda quando algo REALMENTE saiu. Andar na
    // falha faria o item seguinte esperar por um post que não houve.
    if (saiu) {
      const quando = new Date().toISOString();
      await db.from("canal").update({ ultima_publicacao_em: quando }).eq("id", canal.id);
      canal.ultima_publicacao_em = quando;
      enviadasHoje[canal.id] = (enviadasHoje[canal.id] ?? 0) + 1;
      // E no chip, que é outra conta: vários canais podem compartilhar
      // o mesmo número.
      contaNoChip(canal);

      /*
        O produto acabou de sair: entra no histórico já nesta rodada.

        Sem isto, a proteção contra repetição só valeria entre
        execuções, e o canal publica várias vezes DENTRO da mesma — que
        é justamente o intervalo em que o secador saiu duas vezes. É a
        mesma razão de `ganchosRecentes` ser atualizado aqui.
      */
      const publicado = item.pub?.oferta?.anuncio?.produto_id;
      if (publicado) {
        const set = jaPublicadosNoCanal.get(canal.id) ?? new Set();
        set.add(publicado);
        jaPublicadosNoCanal.set(canal.id, set);
      }

      // O cupom não conta como primário: ele não é do ramo nenhum.
      if (item.tipo === "oferta") {
        primariosDesde.set(
          canal.id,
          ehSecundario(item.pub) ? 0 : (primariosDesde.get(canal.id) ?? 0) + 1,
        );
      }
    }
  }


  console.log(
    `\n${publicadas} publicadas · ${cuponsPublicados} cupons · ${reprovadas} reprovadas · ${esperando} esperando o ritmo · ` +
      `${noTeto} no teto do dia · ${adiadosPorProporcao} adiados pela proporção · ` +
      `${canceladasNaSaida} barradas na saída · ` +
      `${semLink} sem link · ${encerradas} encerradas · ${trocas} trocaram de prateleira · ` +
      `${foraDeHorario} fora do horário do canal · ` +
      // Recusado alto é sinal de prompt escorregando para preço ou
      // travessão, e sem o contador isso só apareceria como canal sem
      // gancho, que parece IA desligada.
      `${ganchosCriados} ganchos escritos, ${ganchosRecusados} recusados`,
  );
  for (const canal of canais ?? []) {
    const saiu = enviadasHoje[canal.id] ?? 0;
    console.log(`  ${canal.nome}: ${saiu}/${canal.posts_por_dia_max ?? "sem teto"} hoje`);
  }

  /*
    A AUDIÊNCIA, LIDA DO TELEGRAM EM VEZ DE DIGITADA À MÃO.

    `canal.membros_estimados` existe desde 27/07 e é preenchida pelo
    formulário de canal do painel. Ninguém preencheu: em 04/08 estava
    nula em seis dos sete canais e zero no sétimo, e as telas `/canais`
    mostravam "0 pessoas" para grupos que tinham gente dentro.

    O bot é administrador dos sete e `getChatMemberCount` responde na
    hora, então o número certo estava a uma chamada de distância o tempo
    todo.

    POR QUE AQUI, no fim da rodada: o publicador já fala com a Bot API a
    cada 5 minutos e já tem a lista de canais na mão. Rotina nova para
    isso seria mais uma coisa para o agendador não disparar (D-052).

    ISTO NÃO DECIDE NADA, e é bom que não decida: conferido em 04/08,
    `membros_estimados` só é exibida em `/canais` e `/canais/[id]`. Não
    entra em ritmo, teto nem curadoria. Se a leitura falhar, o valor
    velho fica e nada mais é afetado — por isso o erro só é anotado.

    O NÚMERO É PEQUENO E ISSO É O PONTO. São 36 pessoas nos sete grupos,
    e quase todas são família do dono. É exatamente o estado que precisa
    estar gravado ANTES de qualquer divulgação, senão não há como saber
    o que ela comprou (D-056).
  */
  /*
    SÓ TELEGRAM, e continua assim depois da D-071. A Bot API tem
    `getChatMemberCount`; a Evolution devolveria a lista inteira de
    participantes do grupo, e guardar isso esbarra na regra 3.8 (não
    existe cadastro de membro). Audiência de grupo de WhatsApp continua
    digitada à mão em `/canais`.
  */
  for (const canal of canaisAtivos) {
    if (canal.plataforma !== "telegram" || !canal.telegram_chat_id) continue;

    try {
      const r = await fetch(
        `${TELEGRAM}/bot${process.env.TELEGRAM_BOT_TOKEN}/getChatMemberCount` +
          `?chat_id=${encodeURIComponent(canal.telegram_chat_id)}`,
        { signal: AbortSignal.timeout(15_000) },
      ).then((x) => x.json());

      if (!r?.ok || typeof r.result !== "number") {
        console.log(`  ✗ audiência ${canal.nome}: ${r?.description ?? "resposta sem número"}`);
        continue;
      }

      // Grava só quando muda, que é a lição da D-037: escrever o mesmo
      // valor de 5 em 5 minutos é 99% de escrita desperdiçada.
      if (r.result === canal.membros_estimados) continue;

      const antes = canal.membros_estimados;

      const { error } = await db
        .from("canal")
        .update({ membros_estimados: r.result, atualizado_em: new Date().toISOString() })
        .eq("id", canal.id);

      if (error) {
        console.log(`  ✗ audiência ${canal.nome}: ${error.message}`);
        continue;
      }

      /*
        A MEMÓRIA, e ela é o motivo de tudo isto existir.

        `canal.membros_estimados` responde "quantos são agora", que é o
        que as telas mostram. Esta linha responde "quantos eram quando",
        que é o que permite dizer o que uma divulgação comprou (D-056).

        Vem DEPOIS do update de propósito: se a série falhar, o número
        na tela já está certo. Ao contrário, um erro aqui deixaria o
        painel desatualizado por causa da memória, que é secundária.
      */
      const { error: erroSerie } = await db.from("canal_audiencia").insert({
        operacao_id: canal.operacao_id,
        canal_id: canal.id,
        membros: r.result,
        membros_antes: antes ?? null,
      });

      if (erroSerie) console.log(`  ✗ série de audiência ${canal.nome}: ${erroSerie.message}`);

      console.log(
        `  audiência ${canal.nome}: ${antes ?? "nunca lida"} → ${r.result}` +
          (typeof antes === "number" ? ` (${r.result > antes ? "+" : ""}${r.result - antes})` : ""),
      );
    } catch (e) {
      console.log(`  ✗ audiência ${canal.nome}: ${e.message}`);
    }
  }

  /*
    O RODAPÉ DIZ O QUE MEDIU, e não o que costuma ser.

    A versão anterior afirmava sempre *"sem link é quase sempre sessão
    da Central expirada"*. Em 04/08 isso foi falso o dia inteiro: a
    sessão gerou 37 links na mesma rodada em que 11 falharam por `URL
    not allowed in affiliates program`. O aviso mandava renovar uma
    credencial sadia e escondia o defeito de verdade.
  */
  if (semLink > 0) {
    console.log(`sem link, por motivo: ${JSON.stringify(semLinkPorMotivo)}`);
    if (semLinkPorMotivo.sessao_da_central || semLinkPorMotivo.transitorio) {
      console.log("  → sessão da Central: renove o cookie e o csrf em `credencial_rotativa`.");
    }
    if (semLinkPorMotivo.permanente) {
      console.log("  → o programa recusou a URL. Já encerradas, não voltam na próxima rodada.");
    }
    if (semLinkPorMotivo.canal || semLinkPorMotivo.canal_sem_etiqueta) {
      console.log("  → etiqueta de afiliado do canal: cadastre na Central (D-045).");
    }
  }
  if (reprovadas > 0) console.log(`motivos: ${JSON.stringify(motivos)}`);

  if (Object.keys(revalidacao).length > 0) {
    console.log(`preço da Shopee conferido na hora: ${JSON.stringify(revalidacao)}`);
    /*
      Sem resposta não é chatice de log: é o sistema voltando a publicar
      sobre o feed da véspera, que é o estado que este conserto existe
      para tirar. Se for a maioria, alguém tem que olhar a credencial.
    */
    const total = Object.values(revalidacao).reduce((a, b) => a + b, 0);
    if ((revalidacao.sem_resposta ?? 0) > total / 2) {
      console.log(
        "  → a Open API da Shopee não respondeu na maioria dos itens. " +
          "Confira SHOPEE_APP_ID e SHOPEE_APP_SECRET; até lá o preço publicado é o do feed.",
      );
    }
  }
}

/*
  A trava é solta no `finally`, e não no fim de `main`.

  Erro no meio do laço não pode deixar a trava presa: ela venceria
  sozinha em cinquenta e poucos minutos, mas até lá a rodada seguinte
  desistiria de publicar, e o sintoma seria canal mudo por uma hora
  depois de um erro que já passou.

  `travaMinha` existe para não soltar a trava de OUTRO processo: quem
  não tomou também não solta.
*/
try {
  await main();
} finally {
  if (travaMinha) {
    /*
      `try` em volta, e não `.catch()` no fim.

      `db.rpc()` do supabase-js devolve um `PostgrestFilterBuilder`. Ele
      é *thenable* — dá para dar `await` — mas **não é Promise**, e não
      tem `.catch()`. A primeira versão disto escrevia
      `.rpc(...).catch(() => {})` e morria com
      `TypeError: db.rpc(...).catch is not a function` dentro do próprio
      `finally`, deixando a trava presa até vencer.

      O erro é do tipo mais chato: só aparece no caminho de limpeza, e
      só depois de a execução inteira ter dado certo.
    */
    try {
      await db.rpc("solta_trava", { p_nome: TRAVA });
    } catch {
      // Trava presa vence sozinha em `janela + 5`. Não vale derrubar a
      // execução por causa da faxina.
    }
  }
}
