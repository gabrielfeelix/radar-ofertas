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
 *   5. publica no Telegram DORMINDO entre os posts, no ritmo do canal
 *
 * O WhatsApp NUNCA entra aqui. Regra 3.2: o sistema monta o texto e um
 * humano aperta enviar. Isso não é limitação técnica, é o que protege
 * o número do parceiro.
 *
 * DUAS TRAVAS, porque publicação sem ninguém olhando precisa delas:
 * `publicacao_automatica = 0` é o freio de mão, e o intervalo do ritmo
 * impede despejar a fila inteira de uma vez.
 */

import { createClient } from "@supabase/supabase-js";

import { geraLinks } from "../lib/gerador-ml.ts";
import { montaMensagem, montaMensagemDeCupom } from "../lib/mensagem.ts";
import {
  RITMO_PADRAO,
  diaEmSaoPaulo,
  inicioDoDiaEmSaoPaulo,
  podePublicarAgora,
} from "../lib/ritmo.ts";
import { intercalaPorVariedade } from "../lib/variedade.ts";
import { canalAceitaAtributos } from "../lib/canal-aceita.ts";

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

/** Foto ainda dentro das 24 horas que a política permite (regra 3.3). */
function fotoValida(anuncio) {
  if (!anuncio.imagem_url || !anuncio.imagem_obtida_em) return null;
  const horas = (Date.now() - new Date(anuncio.imagem_obtida_em).getTime()) / 3_600_000;
  return horas <= 24 ? anuncio.imagem_url : null;
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
  };

  const SELECAO = `
    id, operacao_id, anuncio_id, preco_atual_centavos, preco_referencia_centavos,
    referencia_janela_dias, desconto_pct, pode_afirmar_minimo, detectada_em, gatilho,
    anuncio:anuncio_id (
      id, produto_id, url_original, vendedor, imagem_url, imagem_obtida_em, loja_oficial,
      avaliacao, avaliacao_qtd, reputacao_vendedor, vendas_estimadas, frete_gratis,
      preco_leitura_centavos, preco_original_centavos, categoria_ramo,
      marketplace:marketplace_id ( nome, slug ),
      produto:produto_id ( titulo_canonico, nota_curador, nicho_id, atributos )
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
      "id, produto_id, url_original, vendedor, imagem_url, imagem_obtida_em, loja_oficial, " +
        "avaliacao, avaliacao_qtd, reputacao_vendedor, vendas_estimadas, frete_gratis, " +
        "preco_leitura_centavos, preco_original_centavos, " +
        "marketplace:marketplace_id ( nome, slug ), " +
        "produto:produto_id ( titulo_canonico, nota_curador, nicho_id, atributos )",
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
      grupo: o.anuncio?.produto?.nicho_id ?? null,
      precoCentavos: o.preco_atual_centavos,
      oferta: o,
    })),
  ).map((x) => x.oferta);

  // Modelo e canais, uma vez só.
  const { data: modeloLinha } = await db
    .from("modelo_mensagem")
    .select(
      "corpo, lastro_com, lastro_sem, lastro_queda, lastro_declarado, linha_frete, nota_prefixo, corpo_cupom",
    )
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  const modelo = {
    corpo: modeloLinha.corpo,
    lastroCom: modeloLinha.lastro_com,
    lastroSem: modeloLinha.lastro_sem,
    lastroQueda: modeloLinha.lastro_queda,
    lastroDeclarado: modeloLinha.lastro_declarado,
    linhaFrete: modeloLinha.linha_frete,
    notaPrefixo: modeloLinha.nota_prefixo,
    corpoCupom: modeloLinha.corpo_cupom,
  };

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

  if (!sessao.cookie || !sessao.csrf) {
    console.log("Falta a sessão da Central de Afiliados em `credencial_rotativa`. Nada sai sem link.");
    return;
  }

  const { data: canais } = await db
    .from("canal")
    .select(
      "id, nome, plataforma, telegram_chat_id, posts_por_dia_max, ultima_publicacao_em, etiqueta_afiliado, canal_nicho ( nicho_id ), canal_atributo ( atributo, valores, modo, exige_atributo )",
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

  let reprovadas = 0;
  let publicadas = 0;
  let esperando = 0;
  let semLink = 0;
  let trocas = 0;
  let noTeto = 0;
  let cuponsPublicados = 0;
  let adiadosPorProporcao = 0;
  const motivos = {};

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
        (c.canal_atributo ?? []).map((f) => ({ ...f, exigeAtributo: f.exige_atributo })),
        anuncio.produto?.atributos,
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

  const doTelegram = (canais ?? []).filter((c) => c.plataforma === "telegram");

  /* Envia uma oferta pendente. Devolve se saiu. */
  async function enviaOferta(pub, canal) {
    const oferta = pub.oferta;
    const anuncio = oferta?.anuncio;
    if (!oferta || !anuncio) return false;

    if (!canal.etiqueta_afiliado) {
      console.log(`  ✗ ${canal.nome}: sem etiqueta de afiliado cadastrada`);
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
      return false;
    }

    const aPublicar = escolha.usar;
    const trocou = escolha.trocou;
    if (trocou) trocas++;

    const precoFinal = trocou ? aPublicar.preco_leitura_centavos : oferta.preco_atual_centavos;
    const referenciaFinal = trocou
      ? aPublicar.preco_original_centavos
      : oferta.preco_referencia_centavos;
    const descontoFinal = trocou
      ? Math.round((1 - precoFinal / referenciaFinal) * 100)
      : Math.round(Number(oferta.desconto_pct));

    let curto = pub.link_afiliado;
    if (!curto) {
      const { gerados, falhas } = await geraLinks(
        [aPublicar.url_original],
        canal.etiqueta_afiliado,
        sessao,
      );
      if (gerados.length === 0) {
        console.log(`  ✗ ${canal.nome}: link não gerado (${falhas[0]?.motivo ?? "sem resposta"})`);
        semLink++;
        return false;
      }
      curto = gerados[0].curto;
      await db
        .from("publicacao")
        .update({ link_afiliado: curto, link_afiliado_em: new Date().toISOString() })
        .eq("id", pub.id);
    }

    const texto = montaMensagem(modelo, {
      produto: aPublicar.produto?.titulo_canonico ?? "",
      precoCentavos: precoFinal,
      precoAntesCentavos: referenciaFinal,
      descontoPct: descontoFinal,
      loja: aPublicar.marketplace?.nome ?? "",
      vendedor: aPublicar.loja_oficial ? "Loja oficial" : (aPublicar.vendedor ?? ""),
      janelaDias: oferta.referencia_janela_dias,
      observadoDesde: oferta.detectada_em.slice(0, 10),
      podeAfirmarMinimo: trocou ? false : oferta.pode_afirmar_minimo,
      gatilho: trocou ? "declarado" : oferta.gatilho,
      notaDoCurador: aPublicar.produto?.nota_curador,
      freteGratis: aPublicar.frete_gratis,
      link: curto,
    });

    const envio = await mandaAoTelegram(canal.telegram_chat_id, texto, fotoValida(aPublicar));
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
      */
      .update({
        estado: "enviada",
        origem: "fluxo",
        enviada_em: quando,
        mensagem: texto,
        telegram_message_id: envio.id ?? null,
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

    const envio = await mandaAoTelegram(canal.telegram_chat_id, texto, null);
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
      "id, codigo, valor, valor_minimo_centavos, teto_desconto_centavos, vigente_ate, nicho_id, nicho_slug, geral, marketplace_nome",
    )
    .eq("tipo", "percentual")
    .order("valor", { ascending: false });

  const { data: pendentes } = await db
    .from("publicacao")
    .select(`id, subid, canal_id, link_afiliado, oferta:oferta_id ( ${SELECAO} )`)
    .eq("estado", "pendente")
    .order("criado_em");

  const filaDoCanal = new Map();

  for (const canal of doTelegram) {
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

    // As ofertas do canal, intercaladas para não sair oito parecidas em
    // sequência (o mesmo motivo de `lib/variedade.ts`).
    const minhas = (pendentes ?? []).filter((p) => p.canal_id === canal.id && p.oferta?.anuncio);
    const emOrdem = intercalaPorVariedade(
      minhas.map((p) => ({
        grupo: p.oferta?.anuncio?.produto?.nicho_id ?? null,
        precoCentavos: p.oferta?.preco_atual_centavos ?? 0,
        pub: p,
      })),
    ).map((x) => ({ tipo: "oferta", pub: x.pub }));

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
  const primariosDesde = new Map();

  {
    const { data: doDia } = await db
      .from("publicacao")
      .select(`canal_id, oferta:oferta_id ( anuncio:anuncio_id ( categoria_ramo ) )`)
      .eq("estado", "enviada")
      .gte("enviada_em", desdeMeiaNoite)
      .order("enviada_em", { ascending: false });

    for (const canal of doTelegram) {
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

    for (const canal of doTelegram) {
      const fila = filaDoCanal.get(canal.id);
      if (!fila || fila.length === 0) continue;
      if (noTetoDiario(canal)) {
        noTeto++;
        filaDoCanal.set(canal.id, []);
        continue;
      }

      const veredito = podePublicarAgora(
        new Date(),
        canal.ultima_publicacao_em ? new Date(canal.ultima_publicacao_em) : null,
        ritmo,
      );
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

    const saiu =
      item.tipo === "cupom" ? await enviaCupom(item.cupom, canal) : await enviaOferta(item.pub, canal);

    // O relógio do canal só anda quando algo REALMENTE saiu. Andar na
    // falha faria o item seguinte esperar por um post que não houve.
    if (saiu) {
      const quando = new Date().toISOString();
      await db.from("canal").update({ ultima_publicacao_em: quando }).eq("id", canal.id);
      canal.ultima_publicacao_em = quando;
      enviadasHoje[canal.id] = (enviadasHoje[canal.id] ?? 0) + 1;

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
      `${semLink} sem link · ${trocas} trocaram de prateleira`,
  );
  for (const canal of canais ?? []) {
    const saiu = enviadasHoje[canal.id] ?? 0;
    console.log(`  ${canal.nome}: ${saiu}/${canal.posts_por_dia_max ?? "sem teto"} hoje`);
  }
  if (semLink > 0) {
    console.log("Sem link é quase sempre sessão da Central expirada. Renove e rode de novo.");
  }
  if (reprovadas > 0) console.log(`motivos: ${JSON.stringify(motivos)}`);
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
