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

import { montaLinkDeAfiliado } from "../lib/afiliado.ts";
import { montaMensagem } from "../lib/mensagem.ts";
import { RITMO_PADRAO, podePublicarAgora } from "../lib/ritmo.ts";

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
      url_original, vendedor, imagem_url, imagem_obtida_em, loja_oficial,
      avaliacao, avaliacao_qtd, reputacao_vendedor, vendas_estimadas, frete_gratis,
      marketplace:marketplace_id ( nome, slug ),
      produto:produto_id ( titulo_canonico, nota_curador, nicho_id )
    )`;

  const { data: novas } = await db
    .from("oferta")
    .select(SELECAO)
    .eq("status", "nova")
    .order("nota", { ascending: false });

  console.log(`${(novas ?? []).length} ofertas novas`);

  // Modelo e canais, uma vez só.
  const { data: modeloLinha } = await db
    .from("modelo_mensagem")
    .select("corpo, lastro_com, lastro_sem, lastro_queda, lastro_declarado, linha_frete, nota_prefixo")
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
  };

  const { data: canais } = await db
    .from("canal")
    .select("id, nome, plataforma, telegram_chat_id, posts_por_dia_max, ultima_publicacao_em, canal_nicho ( nicho_id )")
    .eq("ativo", true);

  let reprovadas = 0;
  let publicadas = 0;
  let esperando = 0;
  const motivos = {};

  for (const oferta of novas ?? []) {
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
        .select("id, subid, estado")
        .single();

      if (erroPub || !pub || pub.estado === "enviada") continue;

      // 4. WhatsApp NUNCA sai daqui (regra 3.2). Fica pendente, e um
      // humano envia pela tela.
      if (canal.plataforma !== "telegram") continue;

      // 5. O ritmo. Intervalo, não cota: a fila não sai toda de uma vez.
      const veredito = podePublicarAgora(
        new Date(),
        canal.ultima_publicacao_em ? new Date(canal.ultima_publicacao_em) : null,
        ritmo,
      );
      if (!veredito.pode) {
        esperando++;
        continue;
      }

      const link = montaLinkDeAfiliado(
        anuncio.url_original,
        pub.subid,
        anuncio.marketplace?.slug ?? "",
      );

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
        link: link.url,
      });

      const envio = await mandaAoTelegram(canal.telegram_chat_id, texto, fotoValida(anuncio));

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
    .select(`id, subid, canal_id, oferta:oferta_id ( ${SELECAO} )`)
    .eq("estado", "pendente")
    .order("criado_em");

  for (const pub of pendentes ?? []) {
    const oferta = pub.oferta;
    const anuncio = oferta?.anuncio;
    const canal = (canais ?? []).find((c) => c.id === pub.canal_id);
    if (!oferta || !anuncio || !canal || canal.plataforma !== "telegram") continue;

    const veredito = podePublicarAgora(
      new Date(),
      canal.ultima_publicacao_em ? new Date(canal.ultima_publicacao_em) : null,
      ritmo,
    );
    if (!veredito.pode) {
      esperando++;
      continue;
    }

    const link = montaLinkDeAfiliado(anuncio.url_original, pub.subid, anuncio.marketplace?.slug ?? "");
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
      link: link.url,
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

    publicadas++;
    console.log(`  ✓ ${canal.nome}: ${anuncio.produto?.titulo_canonico?.slice(0, 46)} (pendente)`);
  }

  console.log(
    `\n${publicadas} publicadas · ${reprovadas} reprovadas · ${esperando} esperando o ritmo`,
  );
  if (reprovadas > 0) console.log(`motivos: ${JSON.stringify(motivos)}`);
}

await main();
