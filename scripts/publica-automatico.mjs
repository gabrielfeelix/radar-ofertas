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
 *   4. respeita o ritmo do canal (intervalo, não cota)
 *   5. publica no Telegram, com foto
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CHAVE;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });
const TELEGRAM = "https://api.telegram.org";

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
      preco_leitura_centavos, preco_original_centavos,
      marketplace:marketplace_id ( nome, slug ),
      produto:produto_id ( titulo_canonico, nota_curador, nicho_id )
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
        "produto:produto_id ( titulo_canonico, nota_curador, nicho_id )",
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
      "id, nome, plataforma, telegram_chat_id, posts_por_dia_max, ultima_publicacao_em, etiqueta_afiliado, canal_nicho ( nicho_id )",
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

  let reprovadas = 0;
  let publicadas = 0;
  let esperando = 0;
  let semLink = 0;
  let trocas = 0;
  let noTeto = 0;
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
    const elegiveis = (canais ?? []).filter((c) =>
      (c.canal_nicho ?? []).some((cn) => cn.nicho_id === nichoId),
    );

    if (elegiveis.length === 0) {
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

      // 4. WhatsApp NUNCA sai daqui (regra 3.2). Fica pendente, e um
      // humano envia pela tela.
      if (canal.plataforma !== "telegram") continue;

      // 5. O teto diário, que é o combinado com o parceiro. Ele vem
      // antes do ritmo porque é mais duro: o ritmo adia, o teto encerra
      // o dia do canal.
      if (noTetoDiario(canal)) {
        noTeto++;
        continue;
      }

      // 6. O ritmo. Intervalo, não cota: a fila não sai toda de uma vez.
      const veredito = podePublicarAgora(
        new Date(),
        canal.ultima_publicacao_em ? new Date(canal.ultima_publicacao_em) : null,
        ritmo,
      );
      if (!veredito.pode) {
        esperando++;
        continue;
      }

      /*
        ANTES DO LINK, A PRATELEIRA. A ordem importa: gerar link para o
        anúncio errado gastaria uma chamada ao painel do ML e ainda
        publicaria o preço pior.
      */
      const escolha = await melhorPrateleira(db, oferta);

      if (!escolha.usar) {
        const dela = escolha.melhorSemLastro;
        console.log(
          `  ⤫ ${canal.nome}: existe prateleira melhor sem lastro próprio ` +
            `(R$ ${(dela.preco_leitura_centavos / 100).toFixed(2)} contra ` +
            `R$ ${(oferta.preco_atual_centavos / 100).toFixed(2)})`,
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
        continue;
      }

      const aPublicar = escolha.usar;
      const trocou = escolha.trocou;

      // Quando troca, os três números vêm TODOS da prateleira nova.
      // Misturar o preço de uma com o "de" de outra seria inventar
      // desconto com dois números verdadeiros que nunca conviveram.
      const precoFinal = trocou ? aPublicar.preco_leitura_centavos : oferta.preco_atual_centavos;
      const referenciaFinal = trocou
        ? aPublicar.preco_original_centavos
        : oferta.preco_referencia_centavos;
      const descontoFinal = trocou
        ? Math.round((1 - precoFinal / referenciaFinal) * 100)
        : Math.round(Number(oferta.desconto_pct));

      if (trocou) {
        trocas++;
        console.log(
          `  ⇄ prateleira melhor: R$ ${(precoFinal / 100).toFixed(2)} contra ` +
            `R$ ${(oferta.preco_atual_centavos / 100).toFixed(2)}`,
        );
      }

      /*
        O LINK É GERADO AQUI, POR ÚLTIMO, e a posição importa.

        Só chega neste ponto o que já passou pelas comportas de
        confiança, achou canal do nicho e ganhou a vez no ritmo. São
        algumas dezenas por dia, e não milhares: gerar antes da
        curadoria seria pedir link para produto que nunca vai sair.

        Se a geração falhar, a publicação NÃO sai e fica pendente com o
        motivo gravado. Link montado à mão não atribui comissão, então
        publicar sem ele é entregar audiência de graça.
      */
      if (!canal.etiqueta_afiliado) {
        console.log(`  ✗ ${canal.nome}: sem etiqueta de afiliado cadastrada`);
        continue;
      }

      const jaTinha = pub.link_afiliado;
      let curto = jaTinha;

      if (!curto) {
        const { gerados, falhas } = await geraLinks(
          [aPublicar.url_original],
          canal.etiqueta_afiliado,
          sessao,
        );

        if (gerados.length === 0) {
          const motivo = falhas[0]?.motivo ?? "gerador não respondeu";
          console.log(`  ✗ ${canal.nome}: link não gerado (${motivo})`);
          semLink++;
          continue;
        }

        curto = gerados[0].curto;
        await db
          .from("publicacao")
          .update({ link_afiliado: curto, link_afiliado_em: new Date().toISOString() })
          .eq("id", pub.id);
      }

      const link = { url: curto };

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
        link: link.url,
      });

      const envio = await mandaAoTelegram(canal.telegram_chat_id, texto, fotoValida(aPublicar));

      // Falha NÃO marca como enviada: a publicação fica pendente com o
      // canal mudo, que é visível, em vez de sumir da fila em silêncio.
      if (!envio.ok) {
        console.log(`  ✗ ${canal.nome}: ${envio.motivo}`);
        continue;
      }

      const agora = new Date().toISOString();
      await db
        .from("publicacao")
        .update({ estado: "enviada", origem: "fluxo", enviada_em: agora, mensagem: texto })
        .eq("id", pub.id);
      await db.from("canal").update({ ultima_publicacao_em: agora }).eq("id", canal.id);
      canal.ultima_publicacao_em = agora;
      enviadasHoje[canal.id] = (enviadasHoje[canal.id] ?? 0) + 1;

      publicadas++;
      console.log(`  ✓ ${canal.nome}: ${anuncio.produto?.titulo_canonico?.slice(0, 46)}`);
    }
  }

  /*
    SEGUNDA PASSADA: as publicações que ficaram pendentes.

    Sem isto o laço tem um buraco que só aparece com o canal cheio: a
    oferta vira `aprovada` antes da checagem de ritmo, então a rodada
    seguinte, que só procura ofertas `novas`, nunca mais a encontra. A
    publicação fica pendente para sempre e o canal perde a oferta em
    silêncio.

    Aprovar e enviar são atos separados, e a fila de envio precisa ser
    varrida por conta própria.
  */
  const { data: pendentes } = await db
    .from("publicacao")
    .select(`id, subid, canal_id, link_afiliado, oferta:oferta_id ( ${SELECAO} )`)
    .eq("estado", "pendente")
    .order("criado_em");

  for (const pub of pendentes ?? []) {
    const oferta = pub.oferta;
    const anuncio = oferta?.anuncio;
    const canal = (canais ?? []).find((c) => c.id === pub.canal_id);
    if (!oferta || !anuncio || !canal || canal.plataforma !== "telegram") continue;

    // O teto vale igual aqui: sem isto a fila pendente seria a porta
    // dos fundos por onde o combinado com o parceiro é furado.
    if (noTetoDiario(canal)) {
      noTeto++;
      continue;
    }

    const veredito = podePublicarAgora(
      new Date(),
      canal.ultima_publicacao_em ? new Date(canal.ultima_publicacao_em) : null,
      ritmo,
    );
    if (!veredito.pode) {
      esperando++;
      continue;
    }

    // Mesma regra da primeira passada: sem link gerado, não sai. E
    // reaproveita o que já foi gerado antes, para não pedir duas vezes
    // o mesmo link ao painel de outra empresa.
    if (!canal.etiqueta_afiliado) {
      console.log(`  ✗ ${canal.nome}: sem etiqueta de afiliado cadastrada`);
      continue;
    }

    let curto = pub.link_afiliado;
    if (!curto) {
      const { gerados, falhas } = await geraLinks(
        [anuncio.url_original],
        canal.etiqueta_afiliado,
        sessao,
      );
      if (gerados.length === 0) {
        console.log(`  ✗ ${canal.nome}: link não gerado (${falhas[0]?.motivo ?? "sem resposta"})`);
        semLink++;
        continue;
      }
      curto = gerados[0].curto;
      await db
        .from("publicacao")
        .update({ link_afiliado: curto, link_afiliado_em: new Date().toISOString() })
        .eq("id", pub.id);
    }

    const texto = montaMensagem(modelo, {
      produto: anuncio.produto?.titulo_canonico ?? "",
      precoCentavos: oferta.preco_atual_centavos,
      precoAntesCentavos: oferta.preco_referencia_centavos,
      descontoPct: Math.round(Number(oferta.desconto_pct)),
      loja: anuncio.marketplace?.nome ?? "",
      vendedor: anuncio.loja_oficial ? "Loja oficial" : (anuncio.vendedor ?? ""),
      janelaDias: oferta.referencia_janela_dias,
      observadoDesde: oferta.detectada_em.slice(0, 10),
      podeAfirmarMinimo: oferta.pode_afirmar_minimo,
      gatilho: oferta.gatilho,
      notaDoCurador: anuncio.produto?.nota_curador,
      freteGratis: anuncio.frete_gratis,
      link: curto,
    });

    const envio = await mandaAoTelegram(canal.telegram_chat_id, texto, fotoValida(anuncio));
    if (!envio.ok) {
      console.log(`  ✗ ${canal.nome}: ${envio.motivo}`);
      continue;
    }

    const quando = new Date().toISOString();
    await db
      .from("publicacao")
      .update({ estado: "enviada", origem: "fluxo", enviada_em: quando, mensagem: texto })
      .eq("id", pub.id);
    await db.from("canal").update({ ultima_publicacao_em: quando }).eq("id", canal.id);
    canal.ultima_publicacao_em = quando;
    enviadasHoje[canal.id] = (enviadasHoje[canal.id] ?? 0) + 1;

    publicadas++;
    console.log(`  ✓ ${canal.nome}: ${anuncio.produto?.titulo_canonico?.slice(0, 46)} (pendente)`);
  }

  /*
    TERCEIRA PASSADA: O POST DE CUPOM.

    Vem por último de propósito. Oferta é o produto do canal; cupom é
    complemento, e um cupom ocupando a vaga de uma oferta boa seria
    troca ruim.

    ELE NÃO DEPENDE DE SÉRIE NENHUMA, e é por isso que existe agora: a
    série de preço tem dois dias, então quase toda oferta de hoje vem do
    desconto que a loja declara. O cupom é verdade verificável no
    primeiro dia.

    UM POR CANAL POR RODADA. `cupom_publicado` tem constraint única por
    (cupom, canal), então o mesmo cupom não sai duas vezes nem se o
    script rodar duas vezes na mesma hora.
  */
  const { data: cupons } = await db
    .from("cupons_vivos")
    .select("id, codigo, valor, valor_minimo_centavos, teto_desconto_centavos, vigente_ate, nicho_id, nicho_slug, geral, marketplace_nome")
    .eq("tipo", "percentual")
    .order("valor", { ascending: false });

  let cuponsPublicados = 0;

  for (const canal of canais ?? []) {
    if (canal.plataforma !== "telegram") continue;
    if (!modelo.corpoCupom) continue;
    if (noTetoDiario(canal)) continue;

    const veredito = podePublicarAgora(
      new Date(),
      canal.ultima_publicacao_em ? new Date(canal.ultima_publicacao_em) : null,
      ritmo,
    );
    if (!veredito.pode) continue;

    const nichosDoCanal = new Set((canal.canal_nicho ?? []).map((cn) => cn.nicho_id));

    /*
      A MESMA COMPORTA DE NICHO DAS OFERTAS, e pelo mesmo motivo.

      `geral` é o cupom que atravessa categoria (Full, Lojas Oficiais).
      O de nicho só sai onde o canal declara aquele nicho. E cupom sem
      mapa não é nem um nem outro: ele fica no banco, aparece na tela, e
      não vai ao ar até alguém decidir o que ele é.
    */
    const elegiveis = (cupons ?? []).filter(
      (c) => c.geral || (c.nicho_id && nichosDoCanal.has(c.nicho_id)),
    );

    if (elegiveis.length === 0) continue;

    // Quais este canal já recebeu.
    const { data: jaFoi } = await db
      .from("cupom_publicado")
      .select("cupom_id")
      .eq("canal_id", canal.id);
    const vistos = new Set((jaFoi ?? []).map((x) => x.cupom_id));

    const cupom = elegiveis.find((c) => !vistos.has(c.id));
    if (!cupom) continue;

    const texto = montaMensagemDeCupom(modelo.corpoCupom, {
      codigo: cupom.codigo,
      loja: cupom.marketplace_nome ?? "Mercado Livre",
      percentual: cupom.valor,
      minimoCentavos: cupom.valor_minimo_centavos ?? 0,
      tetoCentavos: cupom.teto_desconto_centavos,
      onde: cupom.geral ? null : (cupom.nicho_slug ?? null),
      /*
        A VALIDADE É O DIA EM SÃO PAULO, e não o pedaço da ISO.

        `vigente_ate` é 23:59:59 de São Paulo, que em UTC já é o dia
        seguinte. Cortar a string em dez caracteres dava um dia a mais
        de validade ao leitor: o cupom `...0108` saía anunciado como
        "vale até 02/08". Prometer prazo que não existe é o mesmo erro
        de família da regra 3.4, do lado do calendário.
      */
      validade: diaEmSaoPaulo(new Date(cupom.vigente_ate)),
    });

    const envio = await mandaAoTelegram(canal.telegram_chat_id, texto, null);
    if (!envio.ok) {
      console.log(`  ✗ cupom ${cupom.codigo} em ${canal.nome}: ${envio.motivo}`);
      continue;
    }

    const quando = new Date().toISOString();
    await db
      .from("cupom_publicado")
      .insert({ cupom_id: cupom.id, canal_id: canal.id, enviada_em: quando, mensagem: texto });
    await db.from("canal").update({ ultima_publicacao_em: quando }).eq("id", canal.id);
    canal.ultima_publicacao_em = quando;
    enviadasHoje[canal.id] = (enviadasHoje[canal.id] ?? 0) + 1;

    cuponsPublicados++;
    console.log(`  ✓ ${canal.nome}: cupom ${cupom.codigo} (${cupom.valor}%)`);
  }

  console.log(
    `\n${publicadas} publicadas · ${cuponsPublicados} cupons · ${reprovadas} reprovadas · ${esperando} esperando o ritmo · ` +
      `${noTeto} no teto do dia · ${semLink} sem link · ${trocas} trocaram de prateleira`,
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

await main();
