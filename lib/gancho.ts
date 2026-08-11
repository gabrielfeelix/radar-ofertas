/**
 * O GANCHO: a primeira linha do post, escrita por IA.
 *
 * É a linha que faz parar de rolar a tela, antes do nome do produto e do
 * preço. Copiada dos grupos que funcionam, que o dono mandou em 10/08:
 *
 *   ORGANIZAAAA ESSES SAPATO            (sapateira organizadora)
 *   PRA NÃO TER MAIS BRIGA NO SOFÁ      (kit de cobertores)
 *   CHEIROSO PAGANDO POUCO              (perfume masculino)
 *
 * **ISTO ERA FORA DE ESCOPO ATÉ A FASE 4**, e o `AGENTS.md` dizia com
 * todas as letras que template resolvia. O dono decidiu o contrário em
 * 10/08, vendo o post do concorrente ao lado do nosso. A seção 9 autoriza
 * mudar a regra quando a realidade a contraria, e esta é uma delas: o que
 * o template não faz é falar de cada produto como uma pessoa falaria.
 *
 * O QUE A IA LÊ, E POR QUE NÃO É A IMAGEM
 *
 * Só título, e a resposta veio da própria evidência: os quatro ganchos
 * dos concorrentes acima saem todos do TÍTULO, sem olhar foto nenhuma.
 * "Sapateira Arara 4 Andares Organizadora" já contém "organiza esses
 * sapato". Ler imagem custaria mais, seria mais lento, e esbarraria na
 * regra 3.3 no caso da Amazon, que proíbe guardar a imagem e cujo link
 * expira em 24h. Título e nicho bastam, e foi medido com produto real.
 *
 * O QUE NÃO SE NEGOCIA, e por isso é validado e não pedido por favor:
 *
 *   regra 3.4  o gancho NÃO fala de preço, desconto nem porcentagem.
 *              Modelo de linguagem inventa número com naturalidade, e
 *              número inventado sobre preço é o erro que mata o canal.
 *              Por isso a validação recusa DÍGITO, não só "R$".
 *   regra 3.11 nada de travessão. A IA adora, e é justamente o que dá
 *              cara de texto de máquina no canal.
 *   regra 3.10 o gancho não substitui o `#publi`: ele entra ACIMA, e a
 *              identificação continua vindo do modelo.
 *
 * FALHAR AQUI NUNCA CALA O CANAL. Sem chave, com a API fora do ar, com
 * cota estourada ou com resposta reprovada, `geraGancho` devolve nulo e
 * o post sai como sempre saiu. O gancho é tempero, não ingrediente.
 */

/** O modelo, escolhido comparando saída real em 10/08. */
export const MODELO_PADRAO = "gemini-3.5-flash";

/**
 * O teto de tamanho.
 *
 * Oito palavras é o que a instrução pede; 60 caracteres é a margem que
 * aceita palavra comprida sem deixar passar um parágrafo. Gancho que
 * ocupa duas linhas no celular deixa de ser gancho e vira introdução.
 */
const MAX_CARACTERES = 60;

/**
 * As palavras que denunciam promessa de preço.
 *
 * Vêm junto com a recusa de dígito, e não no lugar dela: "METADE DO
 * PREÇO" não tem número nenhum e é exatamente a afirmação que a regra
 * 3.4 proíbe sem lastro.
 */
const PALAVRAS_DE_PRECO =
  /(pre[çc]o|barat|desconto|promo[çc]|oferta|gr[áa]tis|r\$|reais|metade|off\b|pechinch|liquida[çc])/i;

export const INSTRUCAO_BASE = `Você escreve a PRIMEIRA LINHA de um post de promoção num grupo de WhatsApp.

Essa linha é um gancho: é o que faz a pessoa parar de rolar a tela. Ela vem ANTES do nome do produto e do preço, que já aparecem logo abaixo.

COMO ESCREVER
- Fale como amiga animada mandando mensagem no grupo, nunca como loja.
- De 3 a 8 palavras. Curto.
- MAIÚSCULAS, como quem chega contando a novidade.
- Provoque, brinque, exagere um pouquinho. Pode usar gíria e humor.
- Fale do BENEFÍCIO ou da cena da vida real, não da ficha técnica.
- No máximo um emoji, e só se somar.

NUNCA
- Não diga preço, valor, porcentagem, desconto, "barato", "promoção", "oferta" nem "metade do preço". Os números vêm logo abaixo, e inventar número sobre preço queima o grupo.
- Não use travessão. Use vírgula ou dois pontos.
- Não use hashtag, aspas, link nem ponto final.
- Não invente característica que o título não garante.
- Nada de grosseria, escatologia ou piada de mau gosto sobre o corpo de quem lê. É brincadeira entre amigas, não deboche.

EXEMPLOS DO TOM:
Sapateira organizadora -> ORGANIZAAAA ESSES SAPATO
Kit 2 cobertores casal -> PRA NÃO TER MAIS BRIGA NO SOFÁ DE CASA
Batom de longa duração -> DURA MAIS QUE MUITO RELACIONAMENTO 💋
Protetor solar         -> CHEGA DE VIRAR CAMARÃO NO SOL ☀️

Responda SÓ com a linha, nada mais.`;

/**
 * Limpa e aprova o que o modelo devolveu.
 *
 * Devolve o gancho pronto, ou **nulo** quando ele não pode ir ao canal.
 * Nulo é o desfecho seguro: o post sai sem gancho, que é o que já
 * acontece hoje.
 *
 * Separada da chamada de rede de propósito: é a parte com regra, é onde
 * a regressão dói, e é a única que dá para testar sem gastar cota.
 */
export function validaGancho(bruto: string | null | undefined): string | null {
  if (!bruto) return null;

  const t = String(bruto)
    // Modelo às vezes devolve a linha entre aspas ou com rótulo.
    .replace(/^\s*(gancho|linha|resposta)\s*:\s*/i, "")
    .replace(/[\r\n]+/g, " ")
    // Regra 3.11: travessão vira vírgula em vez de reprovar a linha
    // inteira. É o único conserto automático aqui, porque é de
    // pontuação e não muda o que a frase afirma.
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .replace(/[.\s]+$/, "")
    .trim();

  if (!t) return null;
  if (t.length > MAX_CARACTERES) return null;

  // Regra 3.4: dígito no gancho é promessa de número que ninguém
  // conferiu. O preço verdadeiro vem do banco, duas linhas abaixo.
  if (/\d/.test(t)) return null;
  if (PALAVRAS_DE_PRECO.test(t)) return null;

  // Marcação, link e hashtag: nada disso é gancho, e `#` colidiria com
  // a identificação publicitária da regra 3.10.
  if (/[<>#]|https?:/i.test(t)) return null;

  // Sobrou travessão depois da limpeza? Então algo escapou, e a regra
  // 3.11 é dura demais para arriscar.
  if (/[—–]/.test(t)) return null;

  // Uma palavra só não é gancho, é etiqueta.
  if (t.split(" ").filter(Boolean).length < 2) return null;

  return t;
}

type Pedido = {
  /** O título do produto, que é tudo que a IA lê. */
  titulo: string;
  /**
   * A voz do canal, vinda de `modelo_mensagem.instrucao_gancho`.
   *
   * Nula significa que o canal não usa gancho: o Radar Geek e o Radar
   * Delas não falam igual, e um texto só para os dois seria pior que
   * texto nenhum.
   */
  vozDoCanal: string;
  /**
   * Os últimos ganchos do canal, para não repetir a abertura.
   *
   * MEDIDO EM 10/08 e é o defeito mais visível deste recurso: pedindo
   * seis ganchos seguidos, quatro começaram com "CHEGA DE". Num canal a
   * trinta posts por dia isso vira carimbo em uma tarde, que é o mesmo
   * mal que a regra 3.11 combate no travessão.
   */
  recentes?: string[];
  chave: string;
  modelo?: string;
};

/**
 * Pede o gancho ao Gemini. Devolve nulo em qualquer desfecho ruim.
 *
 * `429` acontece de verdade: a cota por minuto é baixa, e foi o que
 * apareceu no primeiro teste. Uma repetição com espera resolve o caso
 * normal, e desistir é melhor que segurar o publicador, porque o post
 * sem gancho continua sendo um post bom.
 */
export async function geraGancho(pedido: Pedido): Promise<string | null> {
  const { titulo, vozDoCanal, recentes = [], chave, modelo = MODELO_PADRAO } = pedido;
  if (!chave || !titulo || !vozDoCanal) return null;

  const evitar = recentes.filter(Boolean).slice(0, 15);
  const instrucao =
    `${INSTRUCAO_BASE}\n\nO GRUPO DE HOJE\n${vozDoCanal}` +
    (evitar.length
      ? `\n\nJÁ FOI USADO NOS ÚLTIMOS POSTS DESTE GRUPO, não repita a abertura nem a piada:\n${evitar.map((g) => `- ${g}`).join("\n")}`
      : "");

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(chave)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instrucao }] },
            contents: [{ role: "user", parts: [{ text: `Produto: ${titulo}` }] }],
            /*
              `temperature` alta porque o produto aqui é a graça, não a
              precisão: a parte que precisa estar certa (preço, loja,
              link) não passa por aqui. `maxOutputTokens` folgado porque
              modelo com raciocínio gasta orçamento antes de escrever, e
              apertado ele devolve vazio.
            */
            generationConfig: { temperature: 1.1, maxOutputTokens: 2000 },
          }),
          signal: AbortSignal.timeout(25_000),
        },
      );

      if (r.status === 429) {
        // Cota por minuto. Uma espera curta resolve; duas seriam o
        // publicador esperando a IA, e ele tem post para entregar.
        if (tentativa === 0) await new Promise((s) => setTimeout(s, 6_000));
        continue;
      }
      if (!r.ok) return null;

      const d = await r.json();
      const texto = (d?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? "")
        .join("");
      return validaGancho(texto);
    } catch {
      // Rede, timeout, JSON quebrado: o post sai sem gancho.
      return null;
    }
  }
  return null;
}
