/**
 * Leitura da versão web pública de um canal do Telegram.
 *
 * Todo canal público tem uma página aberta em `t.me/s/<canal>`,
 * sem login e sem conta nossa envolvida — é o mesmo conteúdo que
 * qualquer pessoa vê ao abrir o link no navegador. Por isso este
 * caminho não tem risco de banimento: não há conta para banir.
 *
 * A leitura por conta de usuário (que alcança grupo fechado) é
 * outro arquivo, com outro risco, registrado na D-012.
 */

export type PostDoCanal = {
  /** Id da mensagem dentro do canal. Usado para não reprocessar. */
  id: number;
  publicadaEm: string | null;
  /** Texto já sem marcação e sem entidades HTML. */
  texto: string;
  /** Links que apareceram na mensagem, como apareceram. */
  links: string[];
};

const ENDERECO_BASE = "https://t.me/s";

export async function leCanalPublico(identificador: string): Promise<PostDoCanal[]> {
  const resposta = await fetch(`${ENDERECO_BASE}/${encodeURIComponent(identificador)}`, {
    headers: {
      // Sem isto o Telegram devolve a página de convite em vez do
      // histórico. É o mesmo cabeçalho de um navegador comum.
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });

  if (!resposta.ok) {
    throw new Error(`t.me devolveu HTTP ${resposta.status} para @${identificador}`);
  }

  return extraiPosts(await resposta.text());
}

/**
 * Separa a página em mensagens e extrai o que interessa de cada uma.
 *
 * A separação é feita por `data-post`, que o Telegram coloca em toda
 * mensagem no formato `canal/123`. Cada mensagem vai do seu marcador
 * até o começo da próxima.
 */
export function extraiPosts(html: string): PostDoCanal[] {
  const posts: PostDoCanal[] = [];

  const marcadores = [...html.matchAll(/data-post="[^"/]+\/(\d+)"/g)];

  for (let i = 0; i < marcadores.length; i++) {
    const atual = marcadores[i];
    const inicio = atual.index ?? 0;
    const fim = i + 1 < marcadores.length ? (marcadores[i + 1].index ?? html.length) : html.length;
    const trecho = html.slice(inicio, fim);

    const id = Number(atual[1]);
    if (!Number.isFinite(id)) continue;

    const data = trecho.match(/<time[^>]+datetime="([^"]+)"/)?.[1] ?? null;

    // O bloco de texto do Telegram contém só elementos em linha, então
    // parar no primeiro fechamento é seguro aqui.
    const blocoTexto = trecho.match(
      /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    )?.[1];

    const texto = blocoTexto ? limpaHtml(blocoTexto) : "";

    // Links saem do bloco de texto, não da página inteira: fora dele
    // vêm o rodapé do canal e a barra de navegação do próprio Telegram.
    const links = blocoTexto
      ? [...blocoTexto.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => decodificaEntidades(m[1]))
      : [];

    posts.push({ id, publicadaEm: data, texto, links });
  }

  return posts;
}

/** Remove marcação e devolve o texto como uma pessoa leria. */
export function limpaHtml(html: string): string {
  return decodificaEntidades(
    html
      // Emoji no Telegram vem como <i class="emoji"><b>🔥</b></i>.
      // O <b> interno já tem o caractere, então basta tirar as tags.
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Entidades nomeadas que aparecem de fato no HTML do Telegram.
 * `&nbsp;` é a mais comum e a que mais estraga título — sem ela o
 * produto nasce no catálogo chamado "Mesa de Cabeceira&nbsp;Retro".
 */
const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  deg: "°",
  reg: "®",
  copy: "©",
  trade: "™",
};

function decodificaEntidades(texto: string): string {
  return (
    texto
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-z]+);/gi, (inteiro, nome: string) => ENTIDADES[nome.toLowerCase()] ?? inteiro)
      // &amp; por último, senão desfaz as substituições acima.
      .replace(/&amp;/g, "&")
  );
}

/**
 * Limpa o título vindo de canal de oferta.
 *
 * Canal escreve título com seta, fogo, emoji de alerta e caixa alta.
 * Isso é enfeite de mensagem, não nome de produto — e ia parar no
 * catálogo como identidade da coisa.
 */
export function limpaTitulo(texto: string): string {
  return texto
    // Emoji, setas e símbolos no começo.
    .replace(
      /^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}←-⇿☀-➿️‍•▪️◾➡⬅✅❗❕‼]+/gu,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai o preço alegado pelo canal.
 *
 * Isto é **alegação de terceiro**, não dado de preço: nunca entra em
 * `preco_ponto`. Serve para comparar depois com o preço que nós mesmos
 * coletamos — e é assim que se descobre canal que mente.
 *
 * Pega o MENOR valor plausível da mensagem. Canal de oferta costuma
 * escrever "de R$ 199 por R$ 89", e o que interessa é o segundo.
 */
export function extraiPrecoAlegado(texto: string): number | null {
  const achados = [...texto.matchAll(/R\$\s*([\d.]+(?:,\d{2})?)/gi)];
  const valores: number[] = [];

  for (const achado of achados) {
    const bruto = achado[1];
    const normalizado = bruto.includes(",")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto.replace(/\./g, "");
    const numero = Number(normalizado);
    // Abaixo de R$ 1 costuma ser fragmento de parcelamento mal lido;
    // acima de R$ 100 mil não é produto de canal de oferta.
    if (Number.isFinite(numero) && numero >= 1 && numero <= 100_000) {
      valores.push(Math.round(numero * 100));
    }
  }

  return valores.length > 0 ? Math.min(...valores) : null;
}

/**
 * Encurtadores que aparecem nos canais. O link publicado quase nunca
 * é o do produto — é um encurtador com o código de afiliado de outra
 * pessoa.
 */
const ENCURTADORES = new Set([
  "meli.la",
  "mercadolivre.com",
  "mercadolibre.com",
  "amzn.to",
  "a.co",
  "s.shopee.com.br",
  "shp.ee",
  "shope.ee",
]);

const LOJAS = ["mercadolivre.com.br", "shopee.com.br", "amazon.com.br"];

/** Vale a pena gastar uma requisição resolvendo este link? */
export function pareceLinkDeProduto(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return ENCURTADORES.has(host) || LOJAS.some((l) => host.endsWith(l));
  } catch {
    return false;
  }
}

/**
 * Descobre para onde um link curto aponta.
 *
 * Só segue o redirecionamento e lê o endereço final — o corpo da
 * página é descartado sem ser lido. Não é leitura de conteúdo do
 * site: é a mesma coisa que o aplicativo de mensagem faz ao montar
 * a prévia de um link, e é a única forma de saber qual produto está
 * do outro lado de um encurtador.
 */
export async function resolveLink(url: string, tempoLimiteMs = 10_000): Promise<string> {
  // Uma repetição: na colheita real, parte das falhas foi
  // intermitente — conexão recusada num link e bem-sucedida no
  // seguinte, para o mesmo domínio. Perder o link por isso seria
  // perder o produto do catálogo até ele ser publicado de novo.
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const controle = new AbortController();
    const alarme = setTimeout(() => controle.abort(), tempoLimiteMs);

    try {
      const resposta = await fetch(url, {
        redirect: "follow",
        signal: controle.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        },
      });

      // Descarta o corpo sem ler: só o endereço final interessa.
      await resposta.body?.cancel();
      return resposta.url || url;
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa === 0) await new Promise((r) => setTimeout(r, 700));
    } finally {
      clearTimeout(alarme);
    }
  }

  throw ultimoErro;
}
