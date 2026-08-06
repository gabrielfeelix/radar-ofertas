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

import { atributosDe, chaveDeIdentidade } from "../lib/identidade.ts";
import { atributosComUso } from "../lib/uso-do-produto.ts";
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
  /*
    BRINQUEDO DE PET, pedido do dono em 06/08. `brinquedo pet` sozinho
    ja existia e trazia pouco: medido em 05/08, o catalogo tinha 6
    brinquedos contra 275 antipulgas. Os termos abaixo procuram o
    brinquedo pelo NOME dele, que e como a loja o anuncia.
  */
  "mordedor cachorro", "bolinha para cachorro", "brinquedo gato",
  "corda mordedor", "ratinho catnip", "varinha gato", "brinquedo interativo pet",
  "petisco cachorro", "casinha cachorro", "arranhador gato", "caixa transporte pet",
  // Casa e cozinha
  "air fryer", "panela antiaderente", "jogo de cama", "toalha banho", "organizador",
  "cortina blackout", "tapete sala", "liquidificador", "cafeteira", "ferro de passar",
  "aspirador de po", "pote hermetico", "escorredor", "luminaria", "ventilador",
  // Eletrônico
  "fone bluetooth", "smartwatch", "carregador rapido", "cabo usb c", "power bank",
  "caixa de som bluetooth", "mouse sem fio", "teclado", "webcam", "ssd",
  "cartao de memoria", "suporte celular", "smart tv", "roteador wifi", "pen drive",
  /*
    CELULAR E NOTEBOOK FALTAVAM, e sao o que o dono pediu para o Tech em
    06/08: *"quero que entre mais celulares tipo iphone, notebook"*.

    A lista de eletronico era toda de acessorio -- fone, cabo, suporte,
    cartao. Ticket alto nao entrava por busca nenhuma, e o canal de Tech
    virava canal de cabo USB.
  */
  "iphone", "celular samsung", "celular motorola", "celular xiaomi",
  "notebook", "notebook gamer", "macbook", "tablet",
  "monitor gamer", "placa de video", "memoria ram", "processador",
  /*
    Os cinco blocos abaixo entraram em 01/08, com os canais de Fitness,
    Tech, Geek, Kids, Beauty e Perfumes.

    A base é o gargalo da detecção — a queda é medida contra a NOSSA
    leitura anterior, então nicho com pouco anúncio nunca produz oferta,
    e o canal nasce mudo. Pet, casa e eletrônico tinham 44 termos; os
    seis nichos novos tinham zero, e o catálogo deles vinha só do
    `highlights`, que satura.

    O nicho NÃO sai daqui, e é por isso que ampliar ficou barato: desde
    a migration 24 ele vem do `domain_id`. Se "creatina" arrastar um
    pote de ração junto, o produto cai em pet e não em suplemento, sem
    que ninguém precise prever isso na lista.
  */
  // Fitness e suplemento
  "whey protein", "creatina", "barra de proteina", "colageno", "pre treino",
  "halter", "kettlebell", "tapete yoga", "faixa elastica", "corda de pular",
  "luva academia", "coqueteleira", "bicicleta ergometrica", "caneleira peso", "termogenico",
  /*
    PERFUME TINHA DOIS TERMOS EM 109, e o canal masculino era alimentado
    por UM deles (D-063). Perfume era o 4o menor nicho do sistema: 81
    produtos, contra 3.206 de casa. Nao era o filtro que segurava o
    canal, era nao haver o que publicar.

    Os termos abaixo cobrem os tres jeitos de a pessoa procurar perfume:
    pelo genero, pela marca que ela ja conhece, e pela familia olfativa.
    Perfume arabe entra porque e o que mais aparece no catalogo da
    Shopee hoje, e importado porque e onde mora o desconto grande.
  */
  // Perfume
  "perfume masculino", "perfume feminino", "perfume importado", "perfume arabe",
  "perfume masculino importado", "perfume feminino importado",
  "body splash", "colonia masculina", "deo colonia feminino", "eau de parfum",
  "perfume natura", "perfume boticario", "perfume granado", "perfume amadeirado",
  "kit perfume", "perfume 100ml", "lattafa", "armaf",
  /*
    MARCA POR NOME, pedido do dono em 06/08: *"nao tem como preferirmos
    perfumes de marcas boas ou perfumes arabes? tbm marcas br tipo
    natura, granado"*.

    O canal ficou 30 horas mudo em 05/08 e a causa foi catalogo
    esgotado: dos 112 masculinos, 60 estavam no bloqueio de 30 dias e os
    outros 52 nao eram oferta. Preferir marca boa na hora de publicar
    (`lib/marca-de-perfume.ts`) so ordena o que ja entrou; quem decide o
    que ENTRA e esta lista.

    Medido em 06/08: dos 393 produtos do nicho, 317 sao de marca que
    ninguem reconhece, e Amakha Paris aparece mais que todas as outras
    juntas. Termo de marca e o jeito mais barato de mudar isso, porque
    a busca do ML procura por texto.
  */
  "perfume azzaro", "perfume paco rabanne", "perfume carolina herrera",
  "perfume hugo boss", "perfume calvin klein", "perfume antonio banderas",
  "perfume ferrari", "perfume lacoste", "perfume versace",
  "perfume malbec boticario", "natura essencial masculino", "natura homem",
  "perfume eudora", "perfume avon", "colonia granado",
  "maison alhambra", "al haramain", "rasasi", "swiss arabian", "afnan",
  // Beleza
  "protetor solar", "hidratante corporal", "serum facial",
  "shampoo", "condicionador", "base maquiagem", "batom", "esmalte",
  "secador de cabelo", "prancha cabelo", "barbeador eletrico", "creme para pentear", "desodorante",
  // Bebê e infantil
  "fralda descartavel", "lenco umedecido", "formula infantil", "mamadeira", "chupeta",
  "carrinho de bebe", "cadeirinha carro bebe", "papinha", "shampoo infantil", "berco portatil",
  // Brinquedo
  "lego", "boneca", "quebra cabeca", "pelucia", "carrinho de brinquedo",
  "patinete infantil", "massinha de modelar", "brinquedo educativo", "pista hot wheels", "nerf",
  // Geek e games
  /*
    ANIME, MANGA E IMPRESSAO 3D, pedidos pelo dono em 06/08: *"action
    figure de animes la no de geek, mangas, impressao 3d de anime"*.

    O que havia era generico ("action figure", "miniatura colecionavel")
    e trazia sobretudo brinquedo de tabuleiro. Anime nao aparecia por
    nenhum termo.
  */
  "action figure anime", "figure anime", "manga", "manga one piece",
  "estatua anime", "nendoroid", "impressao 3d anime", "chaveiro anime",
  "action figure", "jogo de tabuleiro", "card game", "funko pop", "miniatura colecionavel",
  "controle ps5", "controle xbox", "headset gamer", "cadeira gamer", "jogo ps5",
  "nintendo switch jogo", "mousepad gamer", "kit modelismo", "album de figurinhas", "cubo magico",
];

/** Produtos por termo de busca, por página. */
const POR_BUSCA = Number(process.env.ML_PRODUTOS_POR_BUSCA ?? 20);

/**
 * Quantas páginas por termo, a cada rodada, e onde a janela para.
 *
 * Três páginas dão 60 candidatos por termo por rodada. Não é o número
 * que importa, e sim o cursor que anda: com 126 termos, a janela varre
 * até o fim de `OFFSET_MAX` em umas dezessete rodadas e recomeça.
 *
 * A busca é barata: uma chamada devolve vinte ids. Caro é o produto
 * escolhido, que custa quatro chamadas, e quem segura isso é o teto de
 * `ML_DESCOBERTAS_POR_RODADA`, que não mudou.
 *
 * O TAMANHO DO QUE ESTÁVAMOS PERDENDO, medido em 04/08 contra a API
 * real: "brinquedo pet" tem `paging.total` de **10.000** produtos. Nós
 * víamos vinte, sempre os mesmos.
 *
 * E o teto de 1.000 é da API, medido e não suposto: offset 1000
 * responde com 20 itens, offset 1020 devolve HTTP 400 `bad_request`.
 */
const PAGINAS_POR_BUSCA = Number(process.env.ML_PAGINAS_POR_BUSCA ?? 3);
const OFFSET_MAX = Number(process.env.ML_OFFSET_MAX ?? 1000);

/**
 * Descobrir e reler preço são trabalhos de ritmo diferente, e juntá-los
 * quebrou a coleta horária.
 *
 * A descoberta varre 109 termos de busca e desce nas subcategorias
 * das raízes com canal — leva bem mais de dez minutos, então
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
    // Mesmo motivo do TEMPO_LIMITE_MS abaixo: sem isto, uma conexão
    // pendurada aqui trava a rodada antes mesmo de ela começar.
    signal: AbortSignal.timeout(20_000),
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

/**
 * Quanto se espera uma resposta antes de desistir.
 *
 * POR QUE ISTO PRECISOU EXISTIR, e o caso é literal: em 01/08 à noite a
 * descoberta ficou **quarenta minutos parada** numa única chamada de
 * `products/search`, com 0,01 de CPU e nenhuma linha nova no log. O
 * `fetch` do Node **não tem timeout por padrão** — uma conexão que o
 * outro lado nunca fecha simplesmente pendura o processo para sempre.
 *
 * Rodando à mão isso é chato. No agendador é grave: a rotina diária
 * ficaria pendurada até o teto de seis horas do GitHub Actions, e os
 * canais amanheceriam sem catálogo novo sem ninguém entender por quê.
 *
 * Vinte segundos é folgado para esta API — as chamadas medidas no mesmo
 * dia ficaram entre 150ms e 5,5s. Quem estourar isso não está lento,
 * está pendurado.
 *
 * Quem chama já trata falha: categoria e termo de busca entram em
 * `problemas` e a rodada segue. Desistir de uma chamada custa uma
 * categoria; não desistir custa a rodada inteira.
 */
const TEMPO_LIMITE_MS = Number(process.env.ML_TEMPO_LIMITE_MS ?? 20_000);

async function api(caminho) {
  const r = await fetch(`${API}/${caminho}`, {
    headers: { Authorization: `Bearer ${ACESSO}` },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
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

/**
 * As subcategorias de uma raiz.
 *
 * POR QUE ISTO É O MAIOR GANHO DE LARGURA DISPONÍVEL HOJE, e o número
 * explica: `highlights` devolve algumas dezenas de campeões por
 * categoria e **satura**. Pedir os mais vendidos de "Pet Shop" traz o
 * topo de uma categoria com 4,2 milhões de itens — sempre os mesmos, e
 * justamente os de preço mais estável, que é o pior insumo possível
 * para detectar queda.
 *
 * "Pet Shop" tem **28 filhas**: Cães, Gatos, Coleiras, Petiscos,
 * Escovas e Pentes, Recipiente para Ração… Cada uma tem o próprio topo,
 * e o topo de "Coleiras" nunca aparece no topo de "Pet Shop". A mesma
 * chamada, descida um nível, vê produto que a raiz esconde.
 *
 * Medido em 01/08 nas raízes que importam: Pet Shop 28 filhas, Casa 13,
 * Eletrônicos 16, Informática 21, Celulares 10, Eletrodomésticos 8.
 *
 * A árvore não muda no meio da rodada, então a resposta é guardada.
 */
const FILHAS_DE = new Map();
async function subcategorias(raiz) {
  if (FILHAS_DE.has(raiz)) return FILHAS_DE.get(raiz);

  const c = await api(`categories/${raiz}`).catch(() => null);
  const filhas = (c?.children_categories ?? []).map((f) => f.id);
  FILHAS_DE.set(raiz, filhas);
  return filhas;
}

/**
 * Ids de produto por termo de busca. É o que faz a base crescer.
 *
 * ELE PEDIA SEMPRE OS MESMOS VINTE PRIMEIROS, e isso congelou a
 * descoberta. Não havia `offset`: cada rodada perguntava a mesma coisa
 * e recebia a mesma resposta, e o filtro de "já conhecidos" descartava
 * tudo. Com 126 termos a 20, a busca tinha um teto duro de 2.520
 * produtos na vida inteira do projeto — e depois de alcançá-lo ela
 * passou a contribuir **zero**, para sempre, sem erro e sem aviso.
 *
 * COMO O DEFEITO APARECEU: o dono cobrou que o canal de pet não recebia
 * brinquedo, casinha, arranhador nem coleira. Os termos existiam
 * ("brinquedo pet", "casinha cachorro", "arranhador gato"), o domínio
 * estava mapeado, e as comportas não eram o problema. O catálogo é que
 * tinha 6 brinquedos e 7 casinhas contra 275 antipulgas: cada termo
 * entregou seus 20 uma vez, em 01/08, e nunca mais.
 *
 * É O MESMO DEFEITO QUE ESTE ARQUIVO JÁ DOCUMENTA um nível acima, no
 * `slice` que pegava sempre os 600 primeiros do rodízio. Lá foi
 * consertado com o filtro de conhecidos; aqui o filtro é justamente o
 * que esconde o problema, porque ele descarta em silêncio.
 *
 * A JANELA ANDA A CADA RODADA, e é isso que impede o congelamento de
 * voltar. Uma janela fixa maior (0 a 60, digamos) só adiaria: ela
 * congelaria em 60. O cursor vive em `parametro`, porque ele precisa
 * sobreviver ao agendador — cada execução do Actions começa de um clone
 * limpo, e cursor em memória sempre valeria zero.
 */
async function porBusca(termo, inicio) {
  const ids = [];

  for (let pagina = 0; pagina < PAGINAS_POR_BUSCA; pagina++) {
    const offset = inicio + pagina * POR_BUSCA;

    /*
      O Mercado Livre RECUSA offset alto em vez de devolver lista vazia,
      então o teto é conferido aqui e não descoberto no erro.

      Medido em 04/08 contra a API real, e não lido em documentação:
      offset 1000 responde com 20 itens; offset 1020 devolve HTTP 400,
      `bad_request`. Então 1000 é o último offset válido, e não o
      primeiro inválido — a diferença vale uma página inteira por termo.
    */
    if (offset > OFFSET_MAX) break;

    /*
      A PRIMEIRA PÁGINA ESTOURA, AS SEGUINTES SÓ INTERROMPEM.

      Se a página de entrada falha, o termo falhou de verdade e quem
      chama precisa saber: ele registra em `problemas`, que é o que
      aparece no fim da execução. Engolir isso deixaria a busca quebrada
      parecer busca vazia, e essa confusão é a própria história deste
      conserto.

      Já numa página funda, com ids bons no bolso, abortar a rodada por
      causa da terceira chamada seria trocar o certo pelo perfeito.
    */
    let d;
    try {
      d = await api(
        `products/search?site_id=MLB&status=active&limit=${POR_BUSCA}` +
          `&offset=${offset}&q=${encodeURIComponent(termo)}`,
      );
    } catch (e) {
      if (pagina === 0) throw e;
      console.log(`  busca "${termo}": parei no offset ${offset} (${e.message})`);
      break;
    }

    const achados = (d?.results ?? []).map((p) => p.id);
    ids.push(...achados);

    // Termo raso acabou: insistir nas páginas seguintes só gasta cota.
    if (achados.length < POR_BUSCA) break;
  }

  return ids;
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
      return {
        item: i,
        vendedor: u,
        reputacao: reputacaoDoVendedor(u) ?? 0,
        oficial: Boolean(i.official_store_id),
      };
    }),
  );

  comReputacao.sort((a, b) => {
    // Loja oficial ganha de todo mundo: é a marca vendendo.
    if (a.oficial !== b.oficial) return a.oficial ? -1 : 1;
    if (b.reputacao !== a.reputacao) return b.reputacao - a.reputacao;
    return a.item.price - b.item.price;
  });

  /*
    DEVOLVE O VENDEDOR JUNTO, E NÃO SÓ O ITEM.

    Antes daqui saía só `comReputacao[0].item`, e o objeto do vendedor
    — que esta função **já buscou** para poder ordenar — era jogado
    fora. Isso custava duas coisas:

    1. A releitura horária gravava o preço do vendedor novo e mantinha
       a reputação do vendedor antigo. O sistema aprovava a oferta de
       um olhando o histórico de outro.
    2. A descoberta pedia `users/{id}` de novo, logo depois, para ter
       de volta exatamente o que acabara de ser descartado.

    Devolver o conjunto conserta as duas de uma vez, sem nenhuma
    chamada nova de API.
  */
  return comReputacao[0] ?? null;
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

/**
 * A raiz e o ramo de uma categoria, com cache: a árvore do ML não muda
 * no meio da rodada.
 *
 * RAIZ é `path_from_root[0]`, e decide o nicho quando o domínio não tem
 * opinião. RAMO é `path_from_root[1]`, a filha direta da raiz, e é a
 * granularidade que separa "Cães" de "Cavalos" dentro de Pet Shop
 * (migration 36). Os dois saem da MESMA resposta — o ramo era jogado
 * fora.
 */
const ARVORE_DE = new Map();
async function arvoreDaCategoria(categoriaId) {
  if (!categoriaId) return { raiz: null, ramo: null };
  if (ARVORE_DE.has(categoriaId)) return ARVORE_DE.get(categoriaId);

  const c = await api(`categories/${categoriaId}`).catch(() => null);
  const caminho = c?.path_from_root ?? [];
  const arvore = { raiz: caminho[0]?.id ?? null, ramo: caminho[1]?.id ?? null };
  ARVORE_DE.set(categoriaId, arvore);
  return arvore;
}

/** Só a raiz, para quem não precisa do ramo. */
async function categoriaRaiz(categoriaId) {
  return (await arvoreDaCategoria(categoriaId)).raiz;
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
function decideNicho(dominio, raiz, porDominio, porCategoria, ramo, porRamo) {
  // Três níveis (migration 46): domínio vence ramo, ramo vence raiz.
  // Nulo em qualquer um é decisão tomada, não ausência — e bloqueia os
  // de baixo, senão a regra grossa desfaria a fina.
  if (dominio && porDominio.has(dominio)) return porDominio.get(dominio) ?? null;
  if (ramo && porRamo?.has(ramo)) return porRamo.get(ramo) ?? null;
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
async function relePrecos(db, mktId, porDominio, porCategoria, porRamo) {
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
      const escolha = await melhorOferta(produtoId);
      if (!escolha) continue;

      const oferta = escolha.item;
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
      // Raiz e ramo saem da mesma resposta. O ramo é o que separa
      // "Cães" de "Cavalos" dentro de Pet Shop (migration 36).
      const daArvore = await arvoreDaCategoria(arvore.categoria_folha);
      const raiz = a.categoria_raiz ?? daArvore.raiz;
      const ramo = daArvore.ramo;

      const precisaClassificar = !a.dominio_externo || a.produto?.nicho_id == null;
      let dominio = a.dominio_externo ?? null;

      if (precisaClassificar) {
        const p = await api(`products/${produtoId}`).catch(() => null);
        dominio = p?.domain_id ?? dominio;

        if (a.produto?.nicho_id == null) {
          const nicho = decideNicho(dominio, raiz, porDominio, porCategoria, ramo, porRamo);
          if (nicho) {
            await db.from("produto").update({ nicho_id: nicho }).eq("id", a.produto_id);
            classificados++;
          }
        }
      }

      /*
        QUEM VENDE É RELIDO JUNTO COM O PREÇO, e esta é a correção
        mais importante desta função.

        `melhorOferta` reordena os vendedores do catálogo a cada
        execução: loja oficial primeiro, depois reputação, depois
        preço. **O vendedor escolhido muda de uma hora para outra.**

        Antes daqui só saía o preço. O resultado é que o anúncio
        guardava o preço do vendedor de agora e a reputação do
        vendedor da descoberta — e as comportas de `publica-automatico`
        aprovavam olhando o histórico da pessoa errada. Medido em
        01/08: 288 dos 708 anúncios (41%) com `reputacao_vendedor`
        nula, e nulo não reprova.

        O caminho de descoberta já fazia isto certo, e o comentário
        dele explica por quê: *"vendedor que caiu de nível precisa
        parar de passar hoje, não na próxima vez que o anúncio for
        cadastrado"*. Só que a descoberta toca as categorias raiz, e é
        esta função que passa pela base inteira de hora em hora.

        Não custa chamada nova: `melhorOferta` já buscou o vendedor.
      */
      await db
        .from("anuncio")
        .update({
          ultima_coleta_em: new Date().toISOString(),
          dominio_externo: dominio ?? undefined,
          categoria_raiz: raiz ?? undefined,
          categoria_ramo: ramo ?? undefined,
          ...arvore,
          ...promocaoDeclarada(oferta),
          vendedor: escolha.vendedor?.nickname ?? `vendedor ${oferta.seller_id}`,
          loja_oficial: escolha.oficial,
          reputacao_vendedor: reputacaoDoVendedor(escolha.vendedor),
          vendas_estimadas: escolha.vendedor?.seller_reputation?.transactions?.total ?? null,
          /*
            O SELO CRU, guardado porque o número o perde (migration 64).

            `reputacaoDoVendedor` soma o bônus de platinum e fecha com
            `Math.min(1, ...)`, então verde comum e verde platinum viram
            o mesmo 1,0. A comporta não se importa; a mensagem sim, e é
            ela que diz "MercadoLíder Platinum" ao leitor.
          */
          selo_vendedor: escolha.vendedor?.seller_reputation?.power_seller_status ?? null,
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

  /*
    O nível do meio (migration 46). "Esportes e Fitness" tem 40 filhas e
    só sete são academia: sem este corte, o Radar Fitness recebe
    carabina de pressão e taco de beisebol, que é o que ele recebeu na
    primeira noite.
  */
  const { data: porRamoLinhas } = await db
    .from("nicho_ramo")
    .select("ramo, nicho_id")
    .eq("marketplace_id", mkt.id);

  const porRamo = new Map((porRamoLinhas ?? []).map((r) => [r.ramo, r.nicho_id]));

  /*
    Os nichos em que volume grande significa "tamanho de salão".

    Fora daqui, litro é o produto: panela de 4,2 L é panela. É a regra da
    migration 56, que existia só em SQL e por isso não valia para quem
    escreve no banco. Vive como consulta e não como lista fixa porque id
    de nicho não se decora.
  */
  const { data: nichosDeVolumeLinhas } = await db
    .from("nicho")
    .select("id")
    .in("slug", ["beleza", "perfume"]);

  const nichosDeVolume = new Set((nichosDeVolumeLinhas ?? []).map((n) => n.id));
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
  /*
    A DESCOBERTA OLHA PRIMEIRO ONDE EXISTE CANAL.

    O teto de descoberta é de 600 produtos por rodada, e até agora o
    corte era um `slice` na ordem em que as 28 categorias aparecem na
    lista. Isso ignora um fato medido em 01/08: **existe um canal, e
    ele é de pet**. Numa rodada, 61 ofertas de 109 rejeitadas morreram
    em `nenhum_canal_do_nicho`.

    Descobrir produto de nicho sem canal não é errado — a base precisa
    existir antes do canal, senão o canal nasce mudo. Mas gastar o teto
    com ele **antes** de esgotar o nicho que tem canal é trocar oferta
    publicável por oferta que vai ser rejeitada na mesma rodada.

    Então a ordem muda e o conjunto não: primeiro as categorias cuja
    raiz roteia para um nicho com canal ativo, depois todo o resto. Se
    o teto não for atingido, nada é perdido; se for, o que fica de fora
    é o que não tinha onde ser publicado.

    Quando o dono abrir canal de casa e de eletrônico, esta prioridade
    se reconfigura sozinha: ela lê os canais do banco, não uma lista.
  */
  const { data: canaisAtivos } = await db
    .from("canal")
    .select("canal_nicho ( nicho_id )")
    .eq("ativo", true);

  const nichosComCanal = new Set(
    (canaisAtivos ?? []).flatMap((c) => (c.canal_nicho ?? []).map((cn) => cn.nicho_id)),
  );

  const temCanal = (cat) => {
    const nicho = porCategoria.get(cat);
    return Boolean(nicho && nichosComCanal.has(nicho));
  };

  const categoriasEmOrdem = SO_PRECOS
    ? []
    : [...CATEGORIAS].sort((a, b) => Number(temCanal(b)) - Number(temCanal(a)));

  if (!SO_PRECOS) {
    const priorizadas = categoriasEmOrdem.filter(temCanal);
    console.log(
      `\nprioridade de descoberta: ${priorizadas.length} categoria(s) com canal ativo` +
        `${priorizadas.length ? ` (${priorizadas.join(", ")})` : " — nenhuma, a ordem é a da lista"}`,
    );
  }

  /*
    UM BALDE POR RAIZ, E NAO UMA LISTA SO. Esta foi a lição da primeira
    rodada com sete canais, e o número mostra o tamanho do problema:
    4.239 candidatos achados, teto de 600 por rodada, e as 600 vagas
    foram embora nas primeiras raízes da lista. O resultado no banco:

      eletronico=242  pet=228  casa=98  games=3  beleza=2  esporte=2

    "Pet Shop" tem 28 filhas e cada uma devolve algumas dezenas de
    campeões: sozinha, a primeira raiz da lista já enche metade do teto.
    Brinquedos, Bebês e Beleza vinham depois e não sobrava vaga — e um
    canal sem catálogo não é um canal, é uma lista de espera.

    Concatenar em ordem só funcionava enquanto havia um canal. Com sete,
    a ordem da lista virou uma decisão de negócio disfarçada de detalhe
    de implementação.

    Agora cada raiz tem o próprio balde e o rateio é por rodízio: uma
    de cada, até o teto. Raiz que se esgota sai do rodízio e as outras
    dividem o que sobra, então nada se perde quando uma categoria é
    pequena.

    E O RODÍZIO É DE DOIS NÍVEIS, porque a primeira versão consertou
    entre raízes e deixou o mesmo defeito uma camada abaixo. Sintoma:
    `beleza=33` e **`perfume=1`**, com um canal de perfume no ar.

    A causa é a mesma, com outros números. "Beleza e Cuidado Pessoal"
    tem 13 filhas, e "Perfumes" é a décima segunda. Concatenando as
    filhas em ordem, os ids de perfume ficam na posição ~400 do balde
    de beleza; o rodízio entre onze raízes tira só as ~55 primeiras de
    cada uma, e nunca chega lá.

    Então cada ALVO (raiz ou filha) tem balde próprio, e o rodízio
    acontece duas vezes: entre as filhas de uma raiz, e entre as raízes.
    Assim "Perfumes" aparece na 12ª rodada do balde de beleza, e não na
    posição 400.
  */
  const baldesPrioritarios = new Map();
  const ids = [];

  /** Um de cada balde, por vez, até acabar. */
  function rodizio(baldes) {
    const filas = [...baldes.values()].map((v) => [...v]);
    const saida = [];
    let sobrou = true;
    while (sobrou) {
      sobrou = false;
      for (const fila of filas) {
        const item = fila.shift();
        if (item === undefined) continue;
        saida.push(item);
        sobrou = true;
      }
    }
    return saida;
  }

  /*
    A DESCIDA POR SUBCATEGORIA, e ela só acontece onde existe canal.

    `highlights` satura: são algumas dezenas de campeões por categoria,
    e o topo de "Pet Shop" é sempre o mesmo punhado de itens de preço
    estável. Descendo às 28 filhas, a mesma chamada vê o topo de
    "Coleiras", de "Petiscos", de "Escovas e Pentes" — produto que a
    raiz nunca mostra.

    **Só para as raízes com canal**, e por dois motivos que se somam:
    o custo em chamadas multiplica pelo número de filhas, e produto de
    nicho sem canal já é o que enche `nenhum_canal_do_nicho`. Onde não
    há canal, continua sendo uma chamada na raiz — a base cresce
    devagar, que é o certo enquanto não há onde publicar.

    `ML_SUBCATEGORIAS=0` desliga, se algum dia o custo apertar.
  */
  const DESCE = process.env.ML_SUBCATEGORIAS !== "0";
  let filhasUsadas = 0;

  for (const cat of categoriasEmOrdem) {
    const prioritaria = temCanal(cat);
    const alvos = [cat];

    if (DESCE && prioritaria) {
      try {
        const filhas = await subcategorias(cat);
        alvos.push(...filhas);
        filhasUsadas += filhas.length;
      } catch (e) {
        problemas.push(`subcategorias de ${cat}: ${e.message}`);
      }
    }

    for (const alvo of alvos) {
      try {
        const achados = await maisVendidos(alvo);
        if (prioritaria) {
          if (!baldesPrioritarios.has(cat)) baldesPrioritarios.set(cat, new Map());
          baldesPrioritarios.get(cat).set(alvo, achados);
        } else {
          ids.push(...achados);
        }
      } catch (e) {
        // Folha sem destaque não é problema: nem toda subcategoria tem
        // campeão de venda. Só a raiz falhando merece registro.
        if (alvo === cat) problemas.push(`categoria ${cat}: ${e.message}`);
      }
    }
  }

  if (filhasUsadas > 0) {
    console.log(`desceu para ${filhasUsadas} subcategorias das raízes com canal`);
  }
  /*
    A busca por termo não sabe em que nicho vai cair, então ela entra
    depois do que tem canal e antes do que não tem.

    Mas ela tem o MESMO problema de rateio da lista de categorias: os
    termos estão agrupados por nicho no topo do arquivo, e concatenar em
    ordem faria os catorze termos de pet entregarem tudo antes de
    "perfume masculino" ser consultado. Um balde por termo, e rodízio.
  */
  /*
    O CURSOR DA BUSCA, que é o que faz a janela andar.

    Ele vive no banco e não em memória porque cada execução do Actions
    começa de um clone limpo: em memória ele valeria zero toda rodada, e
    a busca voltaria a perguntar sempre a mesma coisa, que é o defeito
    que este conserto existe para matar.

    Falhando a leitura, ele vale zero e a rodada ainda funciona — só não
    avança. Descoberta rasa é bem melhor que rodada abortada.
  */
  let cursorDaBusca = 0;
  if (!SO_PRECOS) {
    const { data: p } = await db
      .from("parametro")
      .select("valor")
      .eq("chave", "descoberta_ml_offset")
      .is("nicho_id", null)
      .maybeSingle();
    cursorDaBusca = Number(p?.valor ?? 0);
    console.log(`busca começando no offset ${cursorDaBusca}`);
  }

  const baldesDeBusca = new Map();
  for (const termo of SO_PRECOS ? [] : BUSCAS) {
    try {
      baldesDeBusca.set(termo, await porBusca(termo, cursorDaBusca));
    } catch (e) {
      problemas.push(`busca "${termo}": ${e.message}`);
    }
  }
  ids.push(...rodizio(baldesDeBusca));

  /*
    A janela anda, e dá a volta ao chegar no teto.

    Ela avança MESMO que a rodada não tenha achado nada de novo, e isso
    é de propósito: parar de avançar quando a página vem repetida é
    exatamente como a busca ficaria presa de novo, um pouco mais fundo.

    Dando a volta, a varredura recomeça do topo, onde a essa altura já
    há produto novo — a lista do Mercado Livre muda com o tempo, e o
    filtro de conhecidos cuida do que não mudou.
  */
  if (!SO_PRECOS) {
    const passo = PAGINAS_POR_BUSCA * POR_BUSCA;
    const proximo = cursorDaBusca + passo >= OFFSET_MAX ? 0 : cursorDaBusca + passo;

    const { error } = await db
      .from("parametro")
      .update({ valor: proximo, atualizado_em: new Date().toISOString() })
      .eq("chave", "descoberta_ml_offset")
      .is("nicho_id", null);

    if (error) {
      problemas.push(`cursor da busca não avançou: ${error.message}`);
    } else {
      console.log(`busca: próxima rodada começa no offset ${proximo}`);
    }
  }

  {
    // Já conhecidos saem fora: relê-los aqui gastaria a cota que faz a
    // base crescer, e quem atualiza o preço deles é `relePrecos`.
    //
    // O teto existe porque cada produto custa quatro chamadas (produto,
    // ofertas, vendedor, avaliações) e a rotina diária tem uma janela.
    // Sem ele, ampliar as categorias transformaria "descobre menos do
    // que cabe" em "estoura o tempo e não grava nada".
    // O `Set` sobre a concatenação preserva a primeira aparição, então
    // um produto que existe nas duas listas conta como prioritário.
    // Primeiro entre as filhas de cada raiz, depois entre as raízes.
    const porRaizIntercalada = new Map(
      [...baldesPrioritarios].map(([cat, filhas]) => [cat, rodizio(filhas)]),
    );
    const idsPrioritarios = rodizio(porRaizIntercalada);
    const todos = [...new Set([...idsPrioritarios, ...ids])];

    /*
      O QUE JÁ ESTÁ NO BANCO SAI FORA, e isto faltava.

      O comentário logo acima sempre disse "já conhecidos saem fora" e o
      filtro nunca existiu. O sintoma demorou a aparecer porque, com a
      base pequena, quase tudo era novo mesmo. Com 1.714 produtos ele
      ficou explícito: a quinta rodada da noite de 01/08 escolheu 600
      produtos e trouxe **zero novos**.

      A causa é o `slice`: sem filtro, ele pega sempre os primeiros 600
      do rodízio, que são exatamente os que a rodada anterior já
      ingeriu. Havia 4.239 candidatos e a base parou de crescer em
      1.714 — e "a base pequena é o gargalo, não o algoritmo" é a frase
      que abre a lista de buscas deste arquivo.

      O preço dos conhecidos não se perde: quem cuida disso é
      `relePrecos`, que roda de hora em hora e é ordenada pelo anúncio
      lido há mais tempo. Descoberta descobre; releitura relê.
    */
    const conhecidos = new Set();
    for (let de = 0; ; de += 1000) {
      const { data: pagina } = await db
        .from("anuncio")
        .select("url_original")
        .eq("marketplace_id", mkt.id)
        .range(de, de + 999);
      if (!pagina || pagina.length === 0) break;
      for (const a of pagina) {
        const id = (a.url_original ?? "").match(/\/p\/(MLB\d+)/)?.[1];
        if (id) conhecidos.add(id);
      }
      if (pagina.length < 1000) break;
    }

    const ineditos = todos.filter((id) => !conhecidos.has(id));
    const escolhidos = ineditos.slice(0, Number(process.env.ML_DESCOBERTAS_POR_RODADA ?? 600));

    console.log(
      `\n${conhecidos.size} produtos de catálogo já no banco · ` +
        `${todos.length - ineditos.length} candidatos descartados por já existirem`,
    );

    const prioritariosEscolhidos = escolhidos.filter((id) =>
      new Set(idsPrioritarios).has(id),
    ).length;
    console.log(
      `\ndescoberta — ${escolhidos.length} produtos de ${todos.length} achados ` +
        `(${prioritariosEscolhidos} de nicho com canal)`,
    );

    for (const produtoId of escolhidos) {
      try {
        const [produto, escolha] = await Promise.all([
          api(`products/${produtoId}`),
          melhorOferta(produtoId),
        ]);
        if (!escolha) {
          console.log(`  · ${produtoId} sem oferta nova viva`);
          continue;
        }

        // O vendedor vem junto da escolha: `melhorOferta` já o buscou
        // para poder ordenar, e pedir de novo era pagar duas vezes pela
        // mesma resposta.
        const oferta = escolha.item;
        const vendedor = escolha.vendedor;

        // O que o público achou do PRODUTO. É por item e não por
        // vendedor, então continua sendo uma chamada à parte.
        //
        // Falha aqui não derruba a coleta: sem o dado, a comporta não
        // reprova, e o preço continua entrando na série. Perder um
        // sinal é melhor que perder a série.
        const avaliacoes = await api(`reviews/item/${oferta.item_id}`).catch(() => null);

        /*
          O PRODUTO É ACHADO PELA IDENTIDADE, NÃO PELO TÍTULO.

          O ML cadastra o mesmo saco de ração com três títulos
          diferentes, e enquanto a chave era o título eles viravam três
          produtos nossos, com a comparação de preço nunca cruzando
          entre eles. Foi assim que o canal publicou R$ 130,00 existindo
          R$ 119,90 do mesmo item.

          Sem identidade (produto genérico, sem marca cadastrada) cai no
          título, que é o comportamento antigo. Perde-se a comparação
          entre catálogos, não o produto.
        */
        /*
          O `USO` ENTRA AQUI, e não entrava, e essa era a falha da
          migration 55.

          Ela marcou `USO = profissional` num `update` de uma vez só, em
          04/08 às 14h16, e o Beauty passou a excluir o que estivesse
          marcado. Só que **nada aplicava a regra dali para frente no
          Mercado Livre**: quem importava `atributosComUso` era só o
          coletor da Shopee. Resultado medido: na noite do mesmo dia, 32
          produtos entraram casando com a regra e sem a marca.

          E eles não têm segunda chance. A escrita de `atributos` em
          produto que já existe é guardada por `is("atributos", null)`,
          justamente para não sobrescrever — e produto novo já nasce com
          o objeto preenchido pela API. Nulo ele nunca mais fica, então
          a marca nunca mais aparece.

          `atributosComUso` devolve nulo quando não tem o que marcar, e
          por isso o `??` mantém os atributos da API intactos. O `GENDER`
          não entra aqui como na Shopee: no Mercado Livre ele vem da
          própria API, dentro de `atributosDe` (D-068).
        */
        const atributosApi = atributosDe(produto);

        /*
          A IDENTIDADE É CALCULADA SOBRE OS ATRIBUTOS DA API, e de
          propósito, não por descuido. Identidade é o que o produto É;
          `USO` é etiqueta editorial nossa, sobre para quem ele serve.

          Hoje isso não mudaria nada, porque `COMPOEM` é lista BRANCA de
          atributos nomeados e `USO` não está nela — conferido antes de
          escrever. Mas depender disso seria depender de uma lista que
          já mudou três vezes, e o estrago seria mudo: a chave mudaria,
          o mesmo produto viraria dois, e a série de preço partiria em
          duas sem erro nenhum.
        */
        const identidade = chaveDeIdentidade(atributosApi, produto.domain_id, produto.name);

        let { data: linha } = identidade
          ? await db
              .from("produto")
              .select("id")
              .eq("operacao_id", operacao.id)
              .eq("chave_identidade", identidade)
              .maybeSingle()
          : await db
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
        const daArvore = await arvoreDaCategoria(arvore.categoria_folha);
        const raiz = daArvore.raiz;
        const ramo = daArvore.ramo;
        const nichoDoProduto = decideNicho(produto.domain_id, raiz, porDominio, porCategoria, ramo, porRamo);

        if (raiz && !porCategoria.has(raiz)) categoriasNovas.add(raiz);

        /*
          O `USO` É DECIDIDO AQUI, depois do nicho, e a ordem é a razão
          de ele não estar lá em cima junto dos atributos da API.

          `volumeConta` só é verdadeiro em beleza e perfume, que é a
          regra da migration 56: "litro" quer dizer tamanho de salão num
          shampoo e quer dizer o produto numa panela. Sem esse cuidado,
          ligar a marcação neste coletor encheria o banco de chaleira
          marcada como profissional, desfazendo as 741 correções que
          aquela migration fez.
        */
        const atributos =
          atributosComUso(produto.name, atributosApi, nichosDeVolume.has(nichoDoProduto)) ??
          atributosApi;

        if (!linha) {
          const { data: novo, error } = await db
            .from("produto")
            .insert({
              operacao_id: operacao.id,
              nicho_id: nichoDoProduto,
              titulo_canonico: produto.name,
              chave_identidade: identidade,
              /*
                OS ATRIBUTOS ERAM CALCULADOS E JOGADOS FORA. A migration
                31 criou a coluna para a comparação de irmãos, e quem a
                preenchia era só `funde-identidades.mjs`, que roda à
                parte — por isso 471 de 1.714 produtos a tinham.

                Custou o Radar Perfumes (masc): o filtro da migration 43
                exige `GENDER`, os sete perfumes do catálogo estavam com
                `atributos` nulo, e o canal ficaria mudo para sempre. O
                dado vem nesta mesma resposta, duas linhas acima.
              */
              atributos,
            })
            .select("id")
            .single();
          if (error) throw new Error(`produto: ${error.message}`);
          linha = novo;
          produtosNovos++;
        } else {
          /*
            Produto que já existe também ganha os atributos, e só quando
            faltam. Sem isto, os 1.243 produtos que entraram antes desta
            correção continuariam sem eles para sempre: a descoberta pula
            quem já conhece, e nunca voltaria a olhar.

            `is("atributos", null)` faz a escrita acontecer no máximo uma
            vez por produto.
          */
          await db
            .from("produto")
            .update({ atributos })
            .eq("id", linha.id)
            .is("atributos", null);
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
              produto_externo_id: produtoId,
              dominio_externo: produto.domain_id ?? null,
              categoria_raiz: raiz,
              categoria_ramo: ramo,
              ...arvore,
              ...promocaoDeclarada(oferta),
              vendedor: vendedor?.nickname ?? `vendedor ${oferta.seller_id}`,
              loja_oficial: Boolean(oferta.official_store_id),
              reputacao_vendedor: reputacaoDoVendedor(vendedor),
              vendas_estimadas: vendedor?.seller_reputation?.transactions?.total ?? null,
              // O selo cru, que o número perde no teto (migration 64).
              selo_vendedor: vendedor?.seller_reputation?.power_seller_status ?? null,
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
              categoria_ramo: ramo ?? undefined,
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
              // O selo cru, que o número perde no teto (migration 64).
              selo_vendedor: vendedor?.seller_reputation?.power_seller_status ?? null,
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
  await relePrecos(db, mkt.id, porDominio, porCategoria, porRamo);
  if (problemas.length > 0) {
    console.log(`\n${problemas.length} problema(s):`);
    for (const p of problemas.slice(0, 10)) console.log(`  ${p}`);
  }
}

await main();
