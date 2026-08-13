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
 * O REGISTRO MUDOU EM 11/08, e a mudança é a razão de metade deste
 * arquivo. A instrução de 10/08 mandava escrever em CAIXA ALTA sempre e
 * "provocar, brincar, exagerar" em todo post, e dava como exemplo do tom
 * `DURA MAIS QUE MUITO RELACIONAMENTO 💋`. Três coisas nisso estavam
 * erradas ao mesmo tempo:
 *
 *   caixa alta em trinta posts por dia não é ênfase, é o timbre do
 *   canal, e o timbre vira o de bot de promoção;
 *
 *   piada OBRIGATÓRIA vira piada forçada, e amiga de verdade só faz
 *   graça de vez em quando;
 *
 *   modelo de linguagem copia o REGISTRO dos exemplos antes de obedecer
 *   à instrução, e aqueles exemplos eram trocadilho de legenda antiga.
 *
 * No lugar disso: minúscula por padrão, maiúscula só no soco, e SEIS
 * MODOS sorteados entre os posts. O conserto do carimbo não é escrever
 * mais engraçado, é variar o tipo de frase, que é o mesmo remédio que a
 * lista de `recentes` já tentava dar sozinha.
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

/**
 * O modelo, e a troca de 11/08 foi por COTA, não por qualidade.
 *
 * Era `gemini-3.5-flash`, escolhido comparando saída real em 10/08. O
 * que a comparação não mediu foi o teto, e ele é o que decide se o
 * recurso existe: o plano gratuito dá **20 requisições por dia** nesse
 * modelo. A própria API diz, com todas as letras:
 *
 *   Quota exceeded for metric: generate_content_free_tier_requests,
 *   limit: 20, model: gemini-3.5-flash
 *
 * Vinte por dia contra um teto de 150 posts por canal, em nove canais,
 * significa gancho nos primeiros vinte e silêncio no resto. E o modo de
 * falha é o pior possível de diagnosticar: nada quebra, os posts saem,
 * e a diferença só aparece lendo o canal.
 *
 * O `-lite` foi medido no mesmo dia, com os mesmos títulos de produção e
 * a mesma instrução: a saída é igual ou melhor, e a cota é muito maior.
 * Metade dos exemplos que o dono aprovou em 11/08 saiu dele.
 *
 * `gemini-2.5-flash` e `gemini-2.5-flash-lite` não são saída: os dois
 * respondem 404 com *"no longer available to new users"*.
 */
export const MODELO_PADRAO = "gemini-3.5-flash-lite";

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

/**
 * NÚMERO POR EXTENSO, que é o furo que a recusa de dígito deixava.
 *
 * MEDIDO EM 11/08, com título de produção: de um `Booster Box Copag
 * Megaevolução 36 Pacotes` saiu *"sessenta pacotinhos pra abrir num
 * sábado à noite"*. Nenhum dígito, nenhuma palavra de preço, e a
 * validação inteira deixou passar. Trinta e seis viraram sessenta.
 *
 * Não é a regra 3.4, porque não é preço. É a mesma doença dela: número
 * que ninguém conferiu, numa linha que ninguém leu antes de publicar. E
 * quem confere uma vez e vê que está errado não confia em nenhum outro
 * número da mensagem, inclusive nos que vieram do banco e estão certos.
 *
 * A LISTA COMEÇA NO DOIS, e a exclusão é deliberada:
 *
 *   `um` e `uma` são artigo antes de serem número, e barrá-los mataria
 *   metade dos ganchos bons (*"um cabo a menos na mesa"*).
 *
 *   `meia` e `meio` ficam de fora pelo mesmo motivo: *"a sala limpa por
 *   meia hora inteira"* não afirma quantidade de produto nenhum.
 *
 *   Ordinal fica de fora: *"cabelo de segundo dia"* é cena, não conta.
 */
const NUMERO_POR_EXTENSO =
  /\b(dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|(?:qua|ca)torze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|trezentos|quatrocentos|quinhentos|mil|milh[õo](?:es|ao)|d[úu]zia|dezena|centena)s?\b/i;

/**
 * NOJEIRA E COMENTÁRIO SOBRE O CORPO, as duas que escaparam em 11/08.
 *
 * O QUE ACONTECEU, e vale ficar escrito porque a causa é a mesma nas
 * duas. A instrução pede "exagero honesto" e diz para exagerar a CENA,
 * e o caminho mais curto para uma cena exagerada é a cena suja: de um
 * limpador de fone saiu *"tira a craca do fone sem drama"*, e de um
 * creme saiu *"passou no teste do travesseiro sem acordar melecada"*.
 * Antes disso, na leva de 10/08, *"BOCA DE RICA SEM PRECISAR DE
 * PREENCHIMENTO"* num grupo de mulheres.
 *
 * A instrução já proibia as duas em texto ("nada de grosseria,
 * escatologia ou piada sobre o corpo de quem lê"). Não bastou, e a
 * lição é a mesma que a 3.4 ensinou: proibição que só vive no prompt é
 * pedido, não regra. Modelo de linguagem obedece na média e falha na
 * cauda, e a cauda é o post que a pessoa lê.
 *
 * FALSO POSITIVO AQUI CUSTA UM POST SEM GANCHO. Um único gancho nojento
 * num grupo de beleza custa a pessoa, e ela não avisa que saiu.
 *
 * `gordura` fica fora da lista de propósito: "tira a gordura do fogão"
 * é produto de limpeza fazendo o trabalho dele. O que entra é o
 * vocabulário que só existe para dar nojo ou para apontar defeito em
 * quem lê.
 */
const NOJEIRA_OU_CORPO: RegExp[] = [
  // Sujeira como piada.
  /\b(craca|melec\w*|catarro|ranho|chul[ée]|gosma\w*|nojo|nojeir\w*|nojent\w*|imund\w*|fedor|fedid\w*|encardid\w*|pus|sebo)\b/i,
  // Defeito apontado no corpo de quem lê. O produto pode tratar disso;
  // o gancho não precisa dizer que a pessoa tem.
  /\b(celulite|estrias?|flacidez|fl[áa]cid\w*|papada|pelanca|banha|barriga|botox|preenchimento|rugas?|espinhas?|cravos?|gordura localizada)\b/i,
];

/**
 * O QUE ENVELHECEU, e por que isto é validação e não pedido no prompt.
 *
 * O gancho nasceu em 10/08 com uma instrução que mandava gritar em caixa
 * alta e "provocar, brincar, exagerar" em todo post. Os exemplos que ela
 * dava (`DURA MAIS QUE MUITO RELACIONAMENTO 💋`, `CHEGA DE VIRAR CAMARÃO
 * NO SOL ☀️`) são trocadilho de legenda antiga, e modelo de linguagem
 * copia o REGISTRO dos exemplos muito antes de obedecer à instrução.
 *
 * O resultado saiu na primeira leva: `CHEGA DE SOFRER COM SECADOR
 * FRAQUINHO 💨`. O `CHEGA DE` já era o carimbo medido em 10/08, quatro
 * ganchos em seis, e é o mesmo mal que a regra 3.11 combate no travessão:
 * a linha não está errada, ela está denunciando que quem escreveu não é
 * gente do grupo.
 *
 * A lista é curta de propósito. Cada entrada aqui é uma construção que
 * não tem uso honesto num gancho nosso, e recusar custa um post sem
 * gancho, que continua sendo um post bom. Gosto fica no prompt; o que
 * vira regra aqui é só o que já apareceu ou já virou vício de canal.
 */
const CONSTRUCOES_GASTAS: RegExp[] = [
  // O carimbo medido. Só na abertura: "e chega de" no meio de uma frase
  // é português normal, o vício é a linha inteira começar assim.
  /^chega de\b/i,
  // Vocativo de canal de promoção. Ninguém fala assim no próprio grupo.
  /\bamigas?\b/i,
  /\bmeninas\b/i,
  /^gente[,!\s]/i,
  /gente do c[ée]u/i,
  // Urgência inventada. Nós não sabemos o estoque de ninguém.
  /\bcorre\b/i,
  /[úu]ltimas unidades/i,
  // Gíria datada e superlativo de anúncio.
  /\bamei\b/i,
  /\barras(ou|o)\b/i,
  /\bimperd[íi]vel\b/i,
  /\bsocorro\b/i,
  /\bincr[íi]vel\b/i,
  /\bmaravilhos[oa]\b/i,
  /\btop\b/i,
  // Frase de embalagem.
  /vai agradecer/i,
  /voc[êe] precisa/i,
];

export const INSTRUCAO_BASE = `Você escreve a PRIMEIRA LINHA de um post de promoção num grupo de WhatsApp ou Telegram.

Essa linha é um gancho: é o que faz a pessoa parar de rolar a tela. Ela vem ANTES do nome do produto e do preço, que já aparecem logo abaixo.

O REGISTRO
- Escreva em minúscula, como quem digita rápido no grupo.
- De 3 a 8 palavras. Curto.
- Fale como uma pessoa de verdade mandando mensagem, nunca como loja e nunca como locutor de propaganda.
- Fale do BENEFÍCIO ou da cena da vida real, não da ficha técnica.
- No máximo um emoji, e só quando ele disser o que a palavra não disse. A maioria dos ganchos não leva emoji nenhum.

OS SEIS MODOS. Escolha UM e varie entre um post e o seguinte.

1. A CENA REAL, e é o modo mais usado. Nomeia o momento da vida em que o produto entra. Sem piada.
   cabelo seco antes do café esfriar
   pra não perder mais brinco na gaveta
   o xixi fora do lugar acabou
   veste e sai, sem discussão

2. O VEREDITO SECO. Opinião curta de quem já usou.
   esse segura o cacho na chuva
   batom que sobrevive ao almoço
   cabo que não morre em um mês

3. A CONFIDÊNCIA. Alguém contando uma descoberta.
   achei sem procurar e vim avisar
   tô usando faz um mês, vim contar

4. O EXAGERO HONESTO, e é aqui que mora o humor. Exagera a CENA, nunca o produto.
   guardei os sapatos e virei outra pessoa
   meu banheiro finalmente parece de gente
   a bagunça da pia não sobreviveu

5. A PROVOCAÇÃO CURTA.
   seu secador atual não faz isso
   seu fone tá pedindo aposentadoria

6. O SOCO EM MAIÚSCULA. Uma palavra só em caixa alta, o resto em minúscula.
   cabelo seco em MINUTOS
   essa gaveta ficou DECENTE

A GRAÇA É NA MEDIDA. Um gancho em cada três pode ser engraçado; o resto é só útil. Piada em todo post cansa mais rápido que post sem piada nenhuma.

NUNCA
- Não diga preço, valor, porcentagem, desconto, "barato", "promoção", "oferta" nem "metade do preço". Os números vêm logo abaixo, e inventar número sobre preço queima o grupo.
- Não use travessão. Use vírgula ou dois pontos.
- Não use hashtag, aspas, link nem ponto final.
- Não diga quantidade, nem em algarismo nem por extenso. Nada de "sessenta pacotinhos", "duas peças", "três meses". O título já diz, e errar a conta queima o grupo do mesmo jeito que errar o preço.
- Não invente característica que o título não garante.
- Nada de grosseria nem de escatologia. NADA DE NOJEIRA: não fale de craca, meleca, catarro, gosma, sebo, encardido, fedor nem de sujeira acumulada. O produto pode limpar sujeira; o gancho fala do resultado limpo, nunca da sujeira em detalhe.
- NADA SOBRE O CORPO DE QUEM LÊ. Não mencione celulite, estria, flacidez, papada, barriga, ruga, espinha, cravo nem preenchimento. Um creme antirruga vira "pele descansada de manhã", nunca "adeus rugas". Apontar defeito em quem lê expulsa a pessoa do grupo, e ela sai sem avisar.
- O exagero é da CENA, e a cena exagerada não é a cena suja. "guardei os sapatos e virei outra pessoa" é exagero; "tira a craca do fone" é nojeira.
- Não comece com "chega de". Já virou carimbo nosso.
- Nada de vocativo: nada de "amiga", "amigas", "meninas", "gente".
- Nada destas palavras: amei, arrasou, top, imperdível, corre, socorro, luxo, maravilhoso, incrível.
- Nada de trocadilho forçado, de rima, nem de frase de embalagem ("seu cabelo vai agradecer", "você precisa disso na sua vida").
- Nada de urgência inventada ("corre que tá acabando", "últimas unidades").

O QUE SOA VELHO, e é exatamente o que não imitar:
  CHEGA DE VIRAR CAMARÃO NO SOL ☀️
  DURA MAIS QUE MUITO RELACIONAMENTO 💋
  AMIGAS, CORRE QUE EU ACHEI
  SOCORRO QUE COISA LINDA 😍😍
  SEU CABELO VAI AGRADECER

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

  let t = String(bruto)
    // Modelo às vezes devolve a linha entre aspas ou com rótulo.
    .replace(/^\s*(gancho|linha|resposta)\s*:\s*/i, "")
    .replace(/[\r\n]+/g, " ")
    // Regra 3.11: travessão vira vírgula em vez de reprovar a linha
    // inteira. É conserto e não recusa, porque é de pontuação e não
    // muda o que a frase afirma.
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .replace(/[.\s]+$/, "")
    .trim();

  if (!t) return null;

  /*
    A LINHA INTEIRA EM CAIXA ALTA VIRA MINÚSCULA.

    A instrução antiga mandava gritar em todo post, e caixa alta trinta
    vezes por dia deixa de ser ênfase: vira o timbre do canal, e o timbre
    é de bot de promoção. O registro que o dono aprovou é o contrário,
    minúscula de quem digita rápido no grupo.

    É conserto e não recusa, pela mesma razão do travessão: é forma, não
    é o que a frase afirma. E pega SÓ a linha inteira em caixa alta.
    `essa gaveta ficou DECENTE` tem minúscula e passa intacta, que é
    justamente o modo em que a maiúscula volta a significar alguma coisa.

    O par `\p{Ll}` / `\p{Lu}` em vez de comparar com `toUpperCase()`:
    emoji, número e pontuação não têm caixa, e uma linha só de emoji não
    pode ser confundida com um grito.
  */
  if (/\p{Lu}/u.test(t) && !/\p{Ll}/u.test(t)) t = t.toLocaleLowerCase("pt-BR");

  if (t.length > MAX_CARACTERES) return null;

  // Regra 3.4: dígito no gancho é promessa de número que ninguém
  // conferiu. O preço verdadeiro vem do banco, duas linhas abaixo.
  if (/\d/.test(t)) return null;
  if (PALAVRAS_DE_PRECO.test(t)) return null;

  // E o mesmo número escrito com letra, que passava por baixo da linha
  // acima até 11/08.
  if (NUMERO_POR_EXTENSO.test(t)) return null;

  // O que já virou carimbo ou já soa velho. Recusar custa um post sem
  // gancho; publicar custa o canal parecer os outros oitenta.
  if (CONSTRUCOES_GASTAS.some((padrao) => padrao.test(t))) return null;

  // Nojeira e comentário sobre o corpo de quem lê. Recusar custa um
  // post sem gancho; publicar custa a pessoa, e ela sai sem avisar.
  if (NOJEIRA_OU_CORPO.some((padrao) => padrao.test(t))) return null;

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
  /**
   * Um fato conferido sobre o produto, que a IA pode usar sem inventar.
   *
   * POR QUE ISTO EXISTE. Pedido do dono em 13/08: *"se for algo coreano,
   * é legal a gente destacar que é coreano... a IA no texto ela pode
   * falar, produto coreano de alguma coisa"*.
   *
   * E ela NÃO PODIA, e a proibição estava certa. `INSTRUCAO_BASE` diz
   * "não invente característica que o título não garante", e o título de
   * um COSRX diz "COSRX Advanced Snail 96 Mucin Power Essence" — nada
   * ali contém a palavra coreano. Quem sabe que a marca é coreana é a
   * lista de `lib/marca-de-beleza.ts`, não o modelo de linguagem.
   *
   * Então o fato entra por aqui, apurado do nosso lado, e o prompt o
   * apresenta como CONFERIDO. É a mesma disciplina da regra 3.4 com
   * preço: o que a IA pode afirmar é o que nós verificamos, e o resto
   * continua proibido.
   *
   * Nulo é o caso normal. A imensa maioria dos posts não tem destaque
   * nenhum, e o gancho sai como sempre saiu.
   */
  destaque?: string | null;
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
  const { titulo, vozDoCanal, recentes = [], destaque, chave, modelo = MODELO_PADRAO } = pedido;
  if (!chave || !titulo || !vozDoCanal) return null;

  const evitar = recentes.filter(Boolean).slice(0, 15);
  const instrucao =
    `${INSTRUCAO_BASE}\n\nO GRUPO DE HOJE\n${vozDoCanal}` +
    (evitar.length
      ? `\n\nJÁ FOI USADO NOS ÚLTIMOS POSTS DESTE GRUPO, não repita a abertura nem a piada:\n${evitar.map((g) => `- ${g}`).join("\n")}`
      : "");

  /*
    O FATO CONFERIDO VAI NA MENSAGEM DO PRODUTO, e não na instrução do
    sistema. A instrução é a mesma em todo post do canal e fica em cache;
    o fato muda de produto para produto e é dele que o modelo precisa
    perto do título.

    Ele é apresentado como PERMISSÃO e não como ordem. Mandar dizer
    "coreano" em todo post coreano criaria o carimbo que a lista de
    `recentes` existe para evitar, e três posts seguidos abrindo com
    "coreaninho que" soariam pior que nenhum.
  */
  const conteudo = destaque
    ? `Produto: ${titulo}\n\nFATO CONFERIDO POR NÓS SOBRE ESTE PRODUTO: ${destaque}\nVocê PODE usar esse fato no gancho, porque nós o verificamos e ele não é invenção. Use quando ele for a parte interessante do produto, e ignore quando não for.`
    : `Produto: ${titulo}`;

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(chave)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instrucao }] },
            contents: [{ role: "user", parts: [{ text: conteudo }] }],
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
