/**
 * O gerador de link de afiliado do Mercado Livre.
 *
 * POR QUE ISTO NÃO É A API OFICIAL: não existe API oficial de
 * afiliados. Varridas 15 rotas plausíveis em `api.mercadolibre.com`
 * (`affiliates/link`, `affiliate-program/links`, `social/links` e
 * outras), todas 404, e o portal do desenvolvedor não menciona o
 * programa. Este é o mesmo endpoint que a Central chama quando alguém
 * clica em "Gerar", com a sessão da conta do dono.
 *
 * E É OBRIGATÓRIO PASSAR POR AQUI. Montar
 * `?matt_word=X&matt_tool=Y` numa URL comum não atribui comissão: o
 * próprio gerador descarta o `matt_word` que a gente manda e devolve um
 * `ref=` cifrado (`type_url: SOCIAL_PROFILE_ENCRYPTED`), que é onde a
 * atribuição de fato mora. Sete publicações saíram com o link montado
 * à mão antes disso ficar claro.
 *
 * A ETIQUETA PRECISA EXISTIR NA CENTRAL. Testado com uma inventada:
 * `{"message":"Tag is not associated with this affiliate.","error_code":109}`.
 * É por isso que a granularidade de atribuição do ML é por canal, e
 * não por publicação.
 */

export type LinkGerado = {
  /** O `meli.la/...`, que é o que vai para o canal. */
  curto: string;
  /** A forma longa, com o `ref` cifrado. Guardada para auditoria. */
  longo: string;
  urlOriginal: string;
};

export type FalhaDoGerador = {
  urlOriginal: string;
  motivo: string;
  /** 109 = etiqueta não cadastrada. É erro de configuração, não de rede. */
  codigo?: number;
};

export type SessaoDaCentral = {
  cookie: string;
  csrf: string;
};

const ENDERECO = "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

/**
 * Quantas URLs por chamada.
 *
 * O endpoint aceita lista e devolve uma resposta por item. Quatro
 * passaram numa chamada só, testado. O teto é baixo de propósito: é o
 * painel de outra empresa, e lote pequeno erra pequeno.
 */
const POR_LOTE = 4;

/**
 * Gera os links de uma etiqueta.
 *
 * Devolve os dois lados separados porque eles pedem tratamento
 * diferente: link que falhou não pode virar publicação, e o motivo
 * precisa aparecer em algum lugar. Falha silenciosa aqui quer dizer
 * canal mudo sem explicação.
 */
export async function geraLinks(
  urls: string[],
  etiqueta: string,
  sessao: SessaoDaCentral,
): Promise<{ gerados: LinkGerado[]; falhas: FalhaDoGerador[] }> {
  const gerados: LinkGerado[] = [];
  const falhas: FalhaDoGerador[] = [];

  for (let i = 0; i < urls.length; i += POR_LOTE) {
    const lote = urls.slice(i, i + POR_LOTE);

    let resposta: Response;
    try {
      resposta = await fetch(ENDERECO, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain, */*",
          origin: "https://www.mercadolivre.com.br",
          referer: "https://www.mercadolivre.com.br/afiliados/linkbuilder",
          "x-csrf-token": sessao.csrf,
          cookie: sessao.cookie,
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({ urls: lote, tag: etiqueta }),
      });
    } catch (erro) {
      for (const u of lote) falhas.push({ urlOriginal: u, motivo: (erro as Error).message });
      continue;
    }

    /*
      SESSÃO MORTA TEM QUE GRITAR.

      Quando o cookie expira, o endpoint responde 401/403 ou devolve
      HTML de login com status 200. Nos dois casos o sintoma seria o
      mesmo se a gente engolisse: canal mudo, sem motivo. Aqui ele vira
      um motivo escrito, que é o que faz alguém ir renovar a sessão.
    */
    const bruto = await resposta.text();
    let dados: { urls?: unknown[] } | null = null;
    try {
      dados = JSON.parse(bruto);
    } catch {
      const pista = resposta.status === 200 ? "resposta não é JSON (sessão expirada?)" : `HTTP ${resposta.status}`;
      for (const u of lote) falhas.push({ urlOriginal: u, motivo: `sessao_da_central: ${pista}` });
      continue;
    }

    const itens = Array.isArray(dados?.urls) ? dados.urls : [];
    if (itens.length === 0) {
      for (const u of lote) falhas.push({ urlOriginal: u, motivo: "gerador não devolveu nada" });
      continue;
    }

    // A resposta vem na ordem do pedido, e o item de sucesso traz
    // `origin_url`; o de erro traz `entity`. Os dois dizem qual URL é.
    for (let j = 0; j < itens.length; j++) {
      const it = itens[j] as Record<string, unknown>;
      const original = String(it.origin_url ?? it.entity ?? lote[j] ?? "");

      if (typeof it.short_url === "string" && it.short_url) {
        gerados.push({
          curto: it.short_url,
          longo: String(it.long_url ?? ""),
          urlOriginal: original,
        });
      } else {
        falhas.push({
          urlOriginal: original,
          motivo: String(it.message ?? "erro sem mensagem"),
          codigo: typeof it.error_code === "number" ? it.error_code : undefined,
        });
      }
    }
  }

  return { gerados, falhas };
}
