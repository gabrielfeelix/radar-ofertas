/**
 * Coletor do Mercado Livre — pela API oficial, sem raspagem.
 *
 * O CAMINHO É INDIRETO, E ISSO PRECISA FICAR ESCRITO, porque ninguém
 * o encontra sozinho. Em 31/07/2026 o Mercado Livre fechou
 * `GET /items/{id}` e `GET /sites/MLB/search` com `403 PolicyAgent`
 * — para todo mundo, com ou sem token, e há uma fila de reclamações
 * públicas de outros desenvolvedores sobre isso.
 *
 * O que continua aberto, com a permissão **Publicação e sincronização**
 * marcada na aplicação, é a rota pelo *produto de catálogo*:
 *
 *   highlights/MLB/category/{cat}  → ids de PRODUTO mais vendidos
 *   products/search?q=...          → ids de PRODUTO por palavra
 *   products/{id}                  → nome, fotos, atributos
 *   products/{id}/items            → PREÇO, por vendedor  ← o pulo do gato
 *
 * `products/{id}/items` devolve `item_id`, `price`, `seller_id` e
 * `official_store_id`, que é exatamente o que `anuncio` precisa. O
 * `/items/{id}` individual segue fechado e **não é mais necessário**.
 *
 * O escopo mora no token, gravado no momento da autorização: se você
 * mexer nas permissões da aplicação, **o token velho continua com o
 * escopo velho** e tudo volta a dar 403. Refaça a autorização.
 *
 * USO
 *
 *   node --env-file=.env scripts/coleta-mercado-livre.mjs
 *   node --env-file=.env.producao scripts/coleta-mercado-livre.mjs
 *
 * Ele é idempotente: rodar de novo não duplica produto nem anúncio,
 * e acrescenta um ponto novo à série de preço.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://api.mercadolibre.com";

/**
 * De onde sai o catálogo.
 *
 * Categoria do Mercado Livre, e não palavra-chave, porque
 * "mais vendidos da categoria" é uma lista curada por eles a partir de
 * venda real — e produto que vende é produto cujo preço vale a pena
 * acompanhar. Busca por palavra traz o que o texto casa, que é outra
 * coisa.
 *
 * ERA UM MAPA POR NICHO, E VIROU UMA LISTA. Enquanto o nicho vinha de
 * quem achou o produto, cada categoria precisava declarar em que nicho
 * o resultado cairia — e foi assim que "mais vendidos de Saúde" virou
 * nicho casa, e o whey acabou publicado no canal de pet. Agora o nicho
 * sai do `domain_id`, então a categoria só responde ONDE PROCURAR.
 *
 * Isso barateou ampliar: doze categorias em vez de oito, incluindo
 * Beleza, Ferramentas e Alimentos, que antes não tinham nicho onde
 * encaixar e por isso ficavam de fora.
 */
const CATEGORIAS = [
  "MLB1071", // Animais
  "MLB1574", // Casa, Móveis e Decoração
  "MLB5726", // Eletrodomésticos
  "MLB1000", // Eletrônicos, Áudio e Vídeo
  "MLB1648", // Informática
  "MLB1051", // Celulares e Telefones
  "MLB1039", // Câmeras e Acessórios
  "MLB264586", // Saúde
  "MLB1246", // Beleza e Cuidado Pessoal
  "MLB1276", // Esportes e Fitness
  "MLB263532", // Ferramentas
  "MLB1500", // Construção
  "MLB1403", // Alimentos e Bebidas
  "MLB1384", // Bebês
  "MLB1132", // Brinquedos e Hobbies
  "MLB1430", // Calçados, Roupas e Bolsas
  "MLB3937", // Joias e Relógios
  "MLB1144", // Games
  "MLB5672", // Acessórios para Veículos
  "MLB1368", // Arte, Papelaria e Armarinho
  "MLB12404", // Festas e Lembrancinhas
  "MLB1182", // Instrumentos Musicais
  "MLB1367", // Antiguidades e Coleções
  "MLB271599", // Agro
  "MLB1499", // Indústria e Comércio
  "MLB1196", // Livros, Revistas e Comics
  "MLB1168", // Música, Filmes e Seriados
  "MLB1953", // Mais Categorias
];

/**
 * Busca por palavra, para engrossar a base.
 *
 * POR QUE ISTO EXISTE, e é a coisa mais importante deste arquivo: a
 * detecção de queda compara o preço de agora com a leitura anterior
 * **da nossa base**. Não existe API que diga "este produto baixou nos
 * últimos minutos" — quem sabe que baixou é o nosso histórico.
 *
 * Então a base PEQUENA é o gargalo, não o algoritmo. Com 64 produtos,
 * todos "mais vendidos" (que são justamente os de preço mais estável),
 * cair 10% numa hora é evento raro e a fila fica vazia. Com milhares,
 * vira fluxo.
 *
 * `highlights` dá os campeões de venda e satura rápido: são poucas
 * dezenas por categoria e mudam devagar. `products/search` não satura,
 * e é o que faz a base crescer de verdade.
 */
const BUSCAS = [
  // Pet
  "racao cachorro", "racao gato", "tapete higienico", "antipulgas", "coleira cachorro",
  "brinquedo pet", "cama pet", "comedouro", "areia gato", "shampoo cachorro",
  "petisco cachorro", "casinha cachorro", "arranhador gato", "caixa transporte pet",
  // Casa e cozinha
  "air fryer", "panela antiaderente", "jogo de cama", "toalha banho", "organizador",
  "cortina blackout", "tapete sala", "liquidificador", "cafeteira", "ferro de passar",
  "aspirador de po", "pote hermetico", "escorredor", "luminaria", "ventilador",
  // Eletrônico
  "fone bluetooth", "smartwatch", "carregador rapido", "cabo usb c", "power bank",
  "caixa de som bluetooth", "mouse sem fio", "teclado", "webcam", "ssd",
  "cartao de memoria", "suporte celular", "smart tv", "roteador wifi", "pen drive",
];

/** Produtos por termo de busca. */
const POR_BUSCA = Number(process.env.ML_PRODUTOS_POR_BUSCA ?? 20);

/**
 * Descobrir e reler preço são trabalhos de ritmo diferente, e juntá-los
 * quebrou a coleta horária.
 *
 * A descoberta varre 44 termos de busca e leva mais de dez minutos —
 * cabe uma vez ao dia. A releitura de preço precisa acontecer de hora
 * em hora, porque é dela que sai a queda. Rodar a descoberta toda hora
 * gastaria a janela inteira redescobrindo o que já está no banco.
 *
 * `ML_SO_PRECOS=1` pula a descoberta.
 */
const SO_PRECOS = process.env.ML_SO_PRECOS === "1";


const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clientId = process.env.ML_CLIENT_ID;
const clientSecret = process.env.ML_CLIENT_SECRET;
const refreshToken = process.env.ML_REFRESH_TOKEN;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
// O refresh token pode vir só do banco: no agendador não há `.env`.
if (!clientId || !clientSecret) {
  console.error("Faltam ML_CLIENT_ID ou ML_CLIENT_SECRET.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

/**
 * Renova o acesso.
 *
 * ⚠️ O Mercado Livre **troca o refresh token a cada renovação** e
 * invalida o anterior. Quem chama isto precisa gravar o novo em algum
 * lugar que sobreviva ao processo, senão a próxima execução fria
 * falha. Aqui ele é devolvido junto, e o chamador decide.
 */
async function pegaToken(guardado) {
  // O do banco vence o do arquivo: no agendador o `.env` nem existe,
  // e na máquina o do arquivo envelhece assim que o agendador roda.
  const corpo = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: guardado ?? refreshToken,
  });

  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`não renovei o token: ${JSON.stringify(d)}`);
  return { acesso: d.access_token, refreshNovo: d.refresh_token };
}

let ACESSO = "";

/**
 * Grava o refresh token novo por cima do velho.
 *
 * ISTO NÃO É CONVENIÊNCIA, É O CONSERTO DE UM DEFEITO CONHECIDO. O
 * Mercado Livre troca o refresh token a cada renovação e invalida o
 * anterior. Sem gravar, a primeira execução funciona e a segunda
 * falha com `invalid_grant` — e o sintoma é o coletor dizendo que
 * pulou a loja, sem nenhuma pista de por quê.
 *
 * O arquivo é escolhido pelo `--env-file` que subiu o processo, e cai
 * no `.env` quando não dá para saber. Em ambiente sem arquivo (Edge
 * Function, GitHub Actions) ele avisa em vez de morrer calado: lá o
 * token precisa de outro lugar para viver, e isso continua em aberto.
 */
async function guardaRefresh(novo, marketplaceId) {
  // O banco primeiro: é ele que sobrevive ao agendador, onde cada
  // execução começa de um clone limpo.
  const { error } = await db
    .from("credencial_rotativa")
    .update({ valor: novo, atualizado_em: new Date().toISOString() })
    .eq("marketplace_id", marketplaceId)
    .eq("chave", "refresh_token");

  if (error) {
    console.log(`\n⚠️  Não gravei o token novo no banco: ${error.message}`);
    console.log(`   Guarde à mão, senão a próxima execução falha:\n   ${novo}\n`);
    return;
  }

  // E o .env também, quando existir, para o desenvolvimento na
  // máquina não sair de sincronia com o banco.
  const alvo = process.execArgv.find((a) => a.startsWith("--env-file="))?.slice(11);
  if (alvo) {
    try {
      const antes = readFileSync(alvo, "utf8");
      writeFileSync(alvo, antes.replace(/^ML_REFRESH_TOKEN=.*$/m, `ML_REFRESH_TOKEN=${novo}`));
    } catch {
      /* arquivo somente leitura não é motivo para parar: o banco já tem. */
    }
  }
}

async function api(caminho) {
  const r = await fetch(`${API}/${caminho}`, {
    headers: { Authorization: `Bearer ${ACESSO}` },
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const codigo = d?.code || d?.error || r.status;
    throw new Error(`${caminho} → ${codigo}`);
  }
  return d;
}

/** Ids de produto mais vendidos da categoria. */
async function maisVendidos(categoria) {
  const d = await api(`highlights/MLB/category/${categoria}`);
  return (d.content ?? []).filter((c) => c.type === "PRODUCT").map((c) => c.id);
}

/** Ids de produto por termo de busca. É o que faz a base crescer. */
async function porBusca(termo) {
  const d = await api(
    `products/search?site_id=MLB&status=active&limit=${POR_BUSCA}&q=${encodeURIComponent(termo)}`,
  );
  return (d.results ?? []).map((p) => p.id);
}

/** Quanto a mais vale pagar para ficar com o vendedor melhor (D-033). */
const TOLERANCIA_PCT = Number(process.env.ML_TOLERANCIA_VENDEDOR_PCT ?? 5);

/**
 * A melhor oferta viva de um produto.
 *
 * ANTES ERA SÓ O MENOR PREÇO, E ISSO ERA UM DEFEITO. O vendedor de
 * nível vermelho com 16 vendas ganhava por dois reais de diferença, e
 * era ele que ia para o canal. A nota do produto não protege disso: ela
 * é do produto de catálogo, agregada entre todos os vendedores, então o
 * vendedor ruim pega emprestada a reputação dos outros (D-033).
 *
 * Agora: entre os que estão até 5% do menor preço, ganha o de melhor
 * reputação. Não se perde a oferta, troca-se de vendedor.
 *
 * Item usado fica de fora: desconto em usado não é a mesma oferta.
 */
async function melhorOferta(produtoId) {
  const d = await api(`products/${produtoId}/items?limit=50`);
  const vivas = (d.results ?? []).filter(
    (i) => i.condition === "new" && typeof i.price === "number" && i.price > 0,
  );
  if (vivas.length === 0) return null;

  const menorPreco = Math.min(...vivas.map((i) => i.price));
  const aceitaveis = vivas.filter((i) => i.price <= menorPreco * (1 + TOLERANCIA_PCT / 100));

  // Uma consulta de vendedor por candidato, e só entre os aceitáveis:
  // pedir a reputação dos cinquenta gastaria cota para descartar
  // quarenta e cinco.
  const comReputacao = await Promise.all(
    aceitaveis.slice(0, 8).map(async (i) => {
      const u = await api(`users/${i.seller_id}`).catch(() => null);
      return { item: i, reputacao: reputacaoDoVendedor(u) ?? 0, oficial: Boolean(i.official_store_id) };
    }),
  );

  comReputacao.sort((a, b) => {
    // Loja oficial ganha de todo mundo: é a marca vendendo.
    if (a.oficial !== b.oficial) return a.oficial ? -1 : 1;
    if (b.reputacao !== a.reputacao) return b.reputacao - a.reputacao;
    return a.item.price - b.item.price;
  });

  return comReputacao[0]?.item ?? null;
}

/**
 * O desconto que a própria loja declara.
 *
 * POR QUE ISTO IMPORTA MAIS DO QUE PARECE: a queda é medida contra a
 * NOSSA leitura anterior, então todo anúncio novo precisa de duas
 * leituras antes de poder virar oferta. Medido em 01/08: 499 anúncios
 * no banco e 6 ofertas desde sempre. O `original_price` já vinha nesta
 * mesma resposta e era jogado fora.
 *
 * E ele NÃO É VERDADE ABSOLUTA. O "de" do Mercado Livre é
 * frequentemente inflado, e repeti-lo como se fosse nosso é a mentira
 * da regra 3.4. Por isso ele entra como peneira de entrada, a mensagem
 * atribui a alegação à loja, e `detecta_declarados` recusa desconto
 * acima do teto, que é onde mora o "de" inventado.
 *
 * `deal_ids` diz de quais campanhas do ML o anúncio participa (oferta
 * do dia, relâmpago). Vazio não quer dizer sem desconto.
 */
/**
 * O que o item diz sobre entrega e onde ele mora na árvore.
 *
 * FRETE GRÁTIS É O DADO MAIS SUBAPROVEITADO DA RESPOSTA. Ele vem em
 * `shipping.free_shipping` desde sempre, e todo canal de oferta que
 * funciona põe isso na mensagem — é a linha que decide a compra em
 * produto barato, onde o frete é metade do preço. Nós tínhamos o dado
 * e não usávamos.
 *
 * `category_id` é a folha, e a raiz sai dela por `path_from_root`. A
 * raiz é o que decide o nicho quando o domínio não tem regra própria.
 */
function entregaEArvore(item) {
  return {
    frete_gratis: item?.shipping?.free_shipping ?? null,
    categoria_folha: item?.category_id ?? null,
  };
}

/** A raiz de uma categoria, com cache: a árvore do ML não muda no meio da rodada. */
const RAIZ_DE = new Map();
async function categoriaRaiz(categoriaId) {
  if (!categoriaId) return null;
  if (RAIZ_DE.has(categoriaId)) return RAIZ_DE.get(categoriaId);

  const c = await api(`categories/${categoriaId}`).catch(() => null);
  const raiz = c?.path_from_root?.[0]?.id ?? null;
  RAIZ_DE.set(categoriaId, raiz);
  return raiz;
}

/**
 * Em que nicho o anúncio cai.
 *
 * DUAS REGRAS, E A FINA VENCE. O domínio é específico e decide quando
 * tem opinião; a categoria raiz é grossa e cobre o resto do site com
 * 28 linhas em vez de milhares. Sem a grossa, "buscar tudo" viraria
 * uma fila de triagem sem fim e o produto ficaria parado no catálogo.
 *
 * E domínio marcado como "não roteia" (linha com nicho nulo) BLOQUEIA
 * os dois. Sem isso, `MLB-SUPPLEMENTS` marcado como fora voltaria pela
 * raiz "Saúde", e a decisão de não publicar seria desfeita pela regra
 * grossa sem ninguém perceber.
 *
 * Espelha `nicho_do_anuncio` no banco. As duas existem porque o
 * coletor decide em lote, na memória, e a tela precisa da mesma
 * resposta para um item só.
 */
function decideNicho(dominio, raiz, porDominio, porCategoria) {
  if (dominio && porDominio.has(dominio)) {
    const escolhido = porDominio.get(dominio);
    // Nulo aqui é decisão tomada, não ausência: não caia para a raiz.
    return escolhido ?? null;
  }
  return raiz ? (porCategoria.get(raiz) ?? null) : null;
}

function promocaoDeclarada(item) {
  const original = Number(item?.original_price);
  if (!Number.isFinite(original) || original <= item.price) {
    // Não zera o que já estava: promoção que acabou some sozinha pela
    // janela de 6 horas de `detecta_declarados`, e apagar aqui perderia
    // o registro de que ela existiu.
    return { promocoes: item?.deal_ids ?? null };
  }
  return {
    preco_original_centavos: Math.round(original * 100),
    preco_original_visto_em: new Date().toISOString(),
    promocoes: item?.deal_ids ?? null,
  };
}

/**
 * O link da foto do produto.
 *
 * LINK, nunca o arquivo — a regra 3.3 é explícita: *"You will not store
 * or cache Product Advertising Content consisting of an image, but you
 * may store a link to it for up to 24 hours."* Vale para a Amazon por
 * contrato, e o sistema aplica para todas para não ter duas políticas.
 *
 * A maior disponível, porque o Telegram reduz sozinho e imagem pequena
 * esticada é o que faz o post parecer amador.
 */
function fotoDoProduto(produto) {
  const foto = produto.pictures?.[0];
  if (!foto) return null;
  return foto.url ?? foto.secure_url ?? null;
}

/**
 * Reputação do vendedor, de 0 a 1.
 *
 * O ML dá a reputação em duas escalas que se completam: o `level_id`
 * (`5_green` é o topo, `1_red` o fundo) e o `power_seller_status`
 * (`platinum`, `gold`, `silver`). Aqui elas viram um número só, porque
 * é isso que a comporta `reputacao_minima` compara.
 *
 * Vendedor sem histórico fica **nulo, não zero**. Zero significaria
 * "medimos e é péssimo"; nulo é "não sabemos" — e a comporta só
 * reprova o que ela mediu.
 */
function reputacaoDoVendedor(usuario) {
  const r = usuario?.seller_reputation;
  if (!r) return null;

  const porNivel = { "5_green": 1.0, "4_light_green": 0.8, "3_yellow": 0.6, "2_orange": 0.35, "1_red": 0.1 };
  const base = porNivel[r.level_id];
  if (base === undefined) return null;

  // O selo de power seller sobe um degrau dentro do nível: distingue
  // quem chegou agora ao verde de quem está lá há anos.
  const bonus = r.power_seller_status === "platinum" ? 0.05 : r.power_seller_status === "gold" ? 0.03 : 0;
  return Math.min(1, Number((base + bonus).toFixed(2)));
}

/**
 * Relê o preço do que JÁ ESTÁ no banco.
 *
 * Esta é a função que faz a detecção de queda existir, e ela faltava: o
 * coletor só lia preço do que descobria na mesma execução, então um
 * anúncio cadastrado ontem nunca mais era consultado. Sem releitura não
 * há "leitura anterior", e sem leitura anterior não há queda — o
 * sistema ficaria para sempre com um ponto por anúncio.
 *
 * É o trabalho que precisa caber de hora em hora, e por isso ele lê em
 * lotes e pelo produto de catálogo, que é uma chamada por anúncio.
 */
async function relePrecos(db, mktId, porDominio, porCategoria) {
  const { data: anuncios } = await db
    .from("anuncio")
    .select(
      "id, url_original, produto_id, dominio_externo, categoria_raiz, produto:produto_id ( nicho_id )",
    )
    .eq("marketplace_id", mktId)
    .eq("ativo", true)
    .order("ultima_coleta_em", { ascending: true, nullsFirst: true })
    .limit(Number(process.env.ML_RELEITURAS_POR_RODADA ?? 400));

  let lidos = 0;
  let quedas = 0;
  let classificados = 0;

  for (const a of anuncios ?? []) {
    // O id do produto de catálogo mora na própria URL que guardamos.
    const produtoId = (a.url_original ?? "").match(/\/p\/(MLB\d+)/)?.[1];
    if (!produtoId) continue;

    try {
      const oferta = await melhorOferta(produtoId);
      if (!oferta) continue;

      const centavos = Math.round(oferta.price * 100);

      const { data: antes } = await db
        .from("anuncio")
        .select("preco_leitura_centavos")
        .eq("id", a.id)
        .single();

      await db.rpc("registra_preco", { p_anuncio_id: a.id, p_preco_centavos: centavos });
      await db.rpc("registra_leitura", { p_anuncio_id: a.id, p_preco_centavos: centavos });
      /*
        CLASSIFICA O QUE CHEGOU SEM NICHO, e é aqui que a colheita fica
        segura.

        Anúncio vindo de canal de terceiro herda o nicho da FONTE, o
        que só funciona em canal de nicho único: "canal de pet traz
        produto de pet". Canal de oferta genérico traz de tudo, e sem
        isto cadastrar um deles ressuscitaria o defeito que a Frente B
        acabou de matar, por outra porta.

        A chamada extra a `products/{id}` acontece UMA VEZ por anúncio,
        e só enquanto faltar domínio ou nicho. Fazê-la sempre dobraria
        o custo da releitura horária para reconfirmar o que não muda.
      */
      const arvore = entregaEArvore(oferta);
      const raiz = a.categoria_raiz ?? (await categoriaRaiz(arvore.categoria_folha));

      const precisaClassificar = !a.dominio_externo || a.produto?.nicho_id == null;
      let dominio = a.dominio_externo ?? null;

      if (precisaClassificar) {
        const p = await api(`products/${produtoId}`).catch(() => null);
        dominio = p?.domain_id ?? dominio;

        if (a.produto?.nicho_id == null) {
          const nicho = decideNicho(dominio, raiz, porDominio, porCategoria);
          if (nicho) {
            await db.from("produto").update({ nicho_id: nicho }).eq("id", a.produto_id);
            classificados++;
          }
        }
      }

      await db
        .from("anuncio")
        .update({
          ultima_coleta_em: new Date().toISOString(),
          dominio_externo: dominio ?? undefined,
          categoria_raiz: raiz ?? undefined,
          ...arvore,
          ...promocaoDeclarada(oferta),
        })
        .eq("id", a.id);

      if (antes?.preco_leitura_centavos && centavos < antes.preco_leitura_centavos) quedas++;
      lidos++;
    } catch {
      /* anúncio que sumiu da loja não derruba a rodada. */
    }
  }

  console.log(
    `\nreleitura: ${lidos} anúncios · ${quedas} com preço menor que antes · ${classificados} ganharam nicho`,
  );
}

async function main() {
  const { data: operacao } = await db.from("operacao").select("id").limit(1).single();
  const { data: mkt } = await db
    .from("marketplace")
    .select("id")
    .eq("slug", "mercado_livre")
    .single();

  const { data: credencial } = await db
    .from("credencial_rotativa")
    .select("valor")
    .eq("marketplace_id", mkt.id)
    .eq("chave", "refresh_token")
    .maybeSingle();

  const { acesso, refreshNovo } = await pegaToken(credencial?.valor);
  ACESSO = acesso;
  if (refreshNovo && refreshNovo !== (credencial?.valor ?? refreshToken)) {
    await guardaRefresh(refreshNovo, mkt.id);
  }
  /*
    O mapa que decide o nicho, carregado uma vez.

    Ele vive no banco (`nicho_dominio`) e não aqui pelo mesmo motivo da
    D-023: mapear domínio novo é trabalho de trinta segundos, e não de
    publicar versão. `has` sem `get` é a distinção que importa: linha
    com nicho nulo quer dizer "olhamos e não roteia", ausência de linha
    quer dizer "ninguém olhou" — e só a segunda vira trabalho.
  */
  const { data: mapeamento } = await db
    .from("nicho_dominio")
    .select("dominio_externo, nicho_id")
    .eq("marketplace_id", mkt.id);

  const porDominio = new Map((mapeamento ?? []).map((m) => [m.dominio_externo, m.nicho_id]));

  const { data: porRaiz } = await db
    .from("nicho_categoria")
    .select("categoria_raiz, nicho_id")
    .eq("marketplace_id", mkt.id);

  const porCategoria = new Map((porRaiz ?? []).map((c) => [c.categoria_raiz, c.nicho_id]));
  const categoriasNovas = new Set();

  let produtosNovos = 0;
  let anunciosNovos = 0;
  let pontos = 0;
  const problemas = [];

  /*
    A DESCOBERTA VIROU UMA PASSADA SÓ, e não uma por nicho.

    Enquanto o nicho vinha de quem achou o produto, o laço TINHA que
    ser por nicho: era ele quem carimbava o resultado. Agora quem
    carimba é o domínio, então categoria e termo respondem só "onde
    procurar", e um laço plano faz o mesmo trabalho sem a mentira no
    meio.

    O que se ganha com isso é poder ampliar: doze categorias, incluindo
    Beleza, Ferramentas e Alimentos, que antes não entravam por não ter
    nicho onde encaixar.
  */
  const ids = [];

  for (const cat of SO_PRECOS ? [] : CATEGORIAS) {
    try {
      ids.push(...(await maisVendidos(cat)));
    } catch (e) {
      problemas.push(`categoria ${cat}: ${e.message}`);
    }
  }
  for (const termo of SO_PRECOS ? [] : BUSCAS) {
    try {
      ids.push(...(await porBusca(termo)));
    } catch (e) {
      problemas.push(`busca "${termo}": ${e.message}`);
    }
  }

  {
    // Já conhecidos saem fora: relê-los aqui gastaria a cota que faz a
    // base crescer, e o preço deles é atualizado no mesmo laço abaixo.
    //
    // O teto existe porque cada produto custa quatro chamadas (produto,
    // ofertas, vendedor, avaliações) e a rotina diária tem uma janela.
    // Sem ele, ampliar as categorias transformaria "descobre menos do
    // que cabe" em "estoura o tempo e não grava nada".
    const escolhidos = [...new Set(ids)].slice(
      0,
      Number(process.env.ML_DESCOBERTAS_POR_RODADA ?? 600),
    );
    console.log(`\ndescoberta — ${escolhidos.length} produtos de ${new Set(ids).size} achados`);

    for (const produtoId of escolhidos) {
      try {
        const [produto, oferta] = await Promise.all([
          api(`products/${produtoId}`),
          melhorOferta(produtoId),
        ]);
        if (!oferta) {
          console.log(`  · ${produtoId} sem oferta nova viva`);
          continue;
        }

        // Quem vende e o que o público achou. É o que alimenta as
        // comportas `reputacao_minima` e `avaliacao_minima`, que
        // existem no motor desde 27/07 e nunca reprovaram nada porque
        // estes campos ficavam vazios.
        //
        // Falha aqui não derruba a coleta: sem o dado, a comporta não
        // reprova, e o preço continua entrando na série. Perder um
        // sinal é melhor que perder a série.
        const [vendedor, avaliacoes] = await Promise.all([
          api(`users/${oferta.seller_id}`).catch(() => null),
          api(`reviews/item/${oferta.item_id}`).catch(() => null),
        ]);

        // O produto: chave é o título canônico dentro da operação.
        let { data: linha } = await db
          .from("produto")
          .select("id")
          .eq("operacao_id", operacao.id)
          .eq("titulo_canonico", produto.name)
          .maybeSingle();

        /*
          O NICHO VEM DO QUE O PRODUTO É, não de quem o achou.

          Antes ele vinha da lista de termos que devolveu o produto: se
          `products/search?q=racao gato` trouxe algo, esse algo virava
          pet. E como a busca casa por texto de forma frouxa, o banco
          ficou com Galaxy Buds e papel fotográfico dentro de pet, e
          com um whey dentro de eletrônico que foi publicado no canal
          de pet na primeira madrugada automática.

          O `domain_id` é a classificação do próprio Mercado Livre
          sobre o produto de catálogo, e vem nesta mesma resposta.
          Domínio sem mapeamento dá nicho NULO de propósito: o produto
          entra no catálogo, aparece em /produtos/sem-nicho, e não é
          publicado até alguém decidir. Errar para o lado de não
          publicar é o lado certo de errar.
        */
        const arvore = entregaEArvore(oferta);
        const raiz = await categoriaRaiz(arvore.categoria_folha);
        const nichoDoProduto = decideNicho(produto.domain_id, raiz, porDominio, porCategoria);

        if (raiz && !porCategoria.has(raiz)) categoriasNovas.add(raiz);

        if (!linha) {
          const { data: novo, error } = await db
            .from("produto")
            .insert({
              operacao_id: operacao.id,
              nicho_id: nichoDoProduto,
              titulo_canonico: produto.name,
            })
            .select("id")
            .single();
          if (error) throw new Error(`produto: ${error.message}`);
          linha = novo;
          produtosNovos++;
        }

        // O anúncio: marketplace + sku_externo é o que impede a série
        // de preço de partir em duas.
        const sku = oferta.item_id;
        let { data: anuncio } = await db
          .from("anuncio")
          .select("id")
          .eq("marketplace_id", mkt.id)
          .eq("sku_externo", sku)
          .maybeSingle();

        if (!anuncio) {
          const { data: novo, error } = await db
            .from("anuncio")
            .insert({
              operacao_id: operacao.id,
              produto_id: linha.id,
              marketplace_id: mkt.id,
              sku_externo: sku,
              url_original: `https://www.mercadolivre.com.br/p/${produtoId}`,
              dominio_externo: produto.domain_id ?? null,
              categoria_raiz: raiz,
              ...arvore,
              ...promocaoDeclarada(oferta),
              vendedor: vendedor?.nickname ?? `vendedor ${oferta.seller_id}`,
              loja_oficial: Boolean(oferta.official_store_id),
              reputacao_vendedor: reputacaoDoVendedor(vendedor),
              vendas_estimadas: vendedor?.seller_reputation?.transactions?.total ?? null,
              avaliacao: avaliacoes?.rating_average ?? null,
              avaliacao_qtd: avaliacoes?.paging?.total ?? null,
              ultima_coleta_em: new Date().toISOString(),
              // O LINK da imagem, nunca o arquivo (regra 3.3). Ele
              // expira pela política da loja, e `imagem_obtida_em` é o
              // que permite a `expurga_imagens_expiradas` saber a idade.
              imagem_url: fotoDoProduto(produto),
              imagem_obtida_em: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (error) throw new Error(`anuncio: ${error.message}`);
          anuncio = novo;
          anunciosNovos++;
        } else {
          await db
            .from("anuncio")
            .update({
              ultima_coleta_em: new Date().toISOString(),
              dominio_externo: produto.domain_id ?? undefined,
              categoria_raiz: raiz ?? undefined,
              ...arvore,
              ...promocaoDeclarada(oferta),
              imagem_url: fotoDoProduto(produto),
              imagem_obtida_em: new Date().toISOString(),
              // Reputação e nota mudam com o tempo, e a curadoria
              // decide com a de agora: vendedor que caiu de nível
              // precisa parar de passar hoje, não na próxima vez que
              // o anúncio for cadastrado.
              vendedor: vendedor?.nickname ?? undefined,
              reputacao_vendedor: reputacaoDoVendedor(vendedor),
              vendas_estimadas: vendedor?.seller_reputation?.transactions?.total ?? null,
              avaliacao: avaliacoes?.rating_average ?? null,
              avaliacao_qtd: avaliacoes?.paging?.total ?? null,
            })
            .eq("id", anuncio.id);
        }

        // O ponto de preço vai pela função do banco, e não por insert
        // direto: é ela que resolve o dia local e guarda o menor do dia.
        const centavos = Math.round(oferta.price * 100);
        // Duas gravações, e são coisas diferentes: `registra_preco`
        // alimenta a série de meses (um ponto por dia, o menor);
        // `registra_leitura` guarda as duas últimas leituras da hora,
        // que é contra o que a queda de agora é medida.
        const { error: erroPreco } = await db.rpc("registra_preco", {
          p_anuncio_id: anuncio.id,
          p_preco_centavos: centavos,
        });
        if (erroPreco) throw new Error(`preço: ${erroPreco.message}`);

        const { error: erroLeitura } = await db.rpc("registra_leitura", {
          p_anuncio_id: anuncio.id,
          p_preco_centavos: centavos,
        });
        if (erroLeitura) throw new Error(`leitura: ${erroLeitura.message}`);
        pontos++;

        console.log(
          `  ✓ R$ ${(centavos / 100).toFixed(2).padStart(9)}  ${produto.name.slice(0, 52)}`,
        );
      } catch (e) {
        problemas.push(`${produtoId}: ${e.message}`);
        console.log(`  ✗ ${produtoId}: ${e.message}`);
      }
    }
  }

  console.log(
    `\n${produtosNovos} produtos novos · ${anunciosNovos} anúncios novos · ${pontos} pontos de preço`,
  );

  // Domínio sem mapeamento é catálogo parado: o produto entra e nunca
  // publica. Dizer isso alto é o que impede a fila de triagem de
  // crescer em silêncio.
  if (categoriasNovas.size > 0) {
    console.log(`\n${categoriasNovas.size} categoria(s) raiz sem mapeamento, e o produto delas não publica:`);
    for (const c of categoriasNovas) console.log(`  ${c}`);
  }

  // E o que já estava no banco. É daqui que sai a queda.
  await relePrecos(db, mkt.id, porDominio, porCategoria);
  if (problemas.length > 0) {
    console.log(`\n${problemas.length} problema(s):`);
    for (const p of problemas.slice(0, 10)) console.log(`  ${p}`);
  }
}

await main();
