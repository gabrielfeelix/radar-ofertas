/**
 * Operação simulada — o dado que as telas de decisão usam enquanto
 * não existe série de preço real.
 *
 * POR QUE ISTO EXISTE, já que `docs/plano.md` diz "nenhuma tela é
 * construída com dado falso": porque a alternativa era esperar
 * credencial de marketplace, domínio e canal para só então descobrir
 * se o fluxo de aprovar e publicar funciona na mão de uma pessoa.
 * A regra continua valendo para dado que o banco *deveria* ter e não
 * tem; aqui a escolha é deliberada e está registrada na D-026.
 *
 * O QUE ISSO CUSTA, para ninguém se surpreender depois: número
 * simulado é bem-comportado. Título curto, preço redondo, canal com
 * nome curto. O dado real vem com título de 180 caracteres vindo de
 * canal alheio, preço em 1.199,99 e nome de canal com emoji. Quando
 * plugar, algum layout aperta — é esperado e é barato.
 *
 * Sem `server-only` de propósito: não há segredo aqui, e o estado
 * precisa ser importável pelo teste em `testes/simulacao.mjs`, que
 * roda em Node puro.
 *
 * REGRA DE OURO DESTE ARQUIVO: ele só serve dado. Nenhuma decisão de
 * curadoria mora aqui. A nota e os motivos vêm prontos, como viriam
 * de `avalia_anuncios` — a tela nunca recalcula regra, nem quando a
 * regra é de mentira (restrição 4 de `docs/telas.md`).
 */

export type Plataforma = "whatsapp" | "telegram";

export type CanalSimulado = {
  id: string;
  nome: string;
  plataforma: Plataforma;
  nichos: string[];
  /** Teto real de posts por dia. A fila respeita; não avisa depois de estourar. */
  tetoDiario: number;
  publicadasHoje: number;
  audiencia: number;
  /** Quem traz a audiência. */
  parceiro: string;
  /** Quem publica todo dia. Pode ser a mesma pessoa do parceiro. */
  operador: string;
  /**
   * A divisão de receita, em duas parcelas separadas — nunca um
   * número só. A mesma pessoa pode trazer a audiência e operar, ou
   * só trazer a audiência, e arranjos diferentes convivem no mesmo
   * sistema. O que sobra das duas é a parte do dono.
   */
  splitAudienciaPct: number;
  splitOperacaoPct: number;
  /** Horários permitidos, no fuso de São Paulo ainda que tudo grave em UTC. */
  horarios: string;
  /**
   * Canal desativado para de receber publicação imediatamente, mas o
   * histórico continua existindo — é ele que sustenta a prestação de
   * contas ao parceiro depois.
   */
  ativo: boolean;
  ultimaPublicacaoEm: string | null;
};

/** Os nichos que a operação simulada cobre. */
export const NICHOS = [
  { slug: "pet", nome: "Pet" },
  { slug: "casa", nome: "Casa e cozinha" },
  { slug: "eletronico", nome: "Eletrônico" },
] as const;

export function nomeDoNicho(slug: string): string {
  return NICHOS.find((n) => n.slug === slug)?.nome ?? slug;
}

export type ParcelasDaNota = {
  /** 0 a 50 */
  desconto: number;
  /** 0 a 30 */
  comissao: number;
  /** 0 a 20 */
  vendedor: number;
};

export type ComportaAvaliada = {
  nome: string;
  passou: boolean;
  observado: string;
  limiar: string;
};

export type StatusOferta = "nova" | "aprovada" | "rejeitada" | "adiada";

export type OfertaSimulada = {
  id: string;
  produto: string;
  nicho: string;
  loja: "mercado_livre" | "shopee" | "amazon";
  vendedor: string;
  url: string;
  precoAtualCentavos: number;
  /** Mediana da NOSSA série. Nunca o "preço de" do marketplace. */
  precoReferenciaCentavos: number;
  referenciaJanelaDias: number;
  descontoPct: number;
  diasDeSerie: number;
  /** Falso enquanto a série não chega a 14 dias (regra 3.4 do AGENTS). */
  podeAfirmarMinimo: boolean;
  observadoDesde: string;
  comissaoEstimadaCentavos: number;
  nota: number;
  parcelas: ParcelasDaNota;
  comportas: ComportaAvaliada[];
  /** Última vez que ESTE produto foi publicado, em qualquer canal. */
  publicadaAntesEm: string | null;
  status: StatusOferta;
  motivoRejeicao: string | null;
  /** Canais escolhidos na aprovação. Vazio = todos os elegíveis. */
  canaisEscolhidos: string[];
};

export const NOME_DA_LOJA: Record<OfertaSimulada["loja"], string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
};

/**
 * Motivos de rejeição. Lista fechada de propósito: rejeição com
 * motivo digitado vira texto livre que ninguém agrega depois, e o
 * ponto de exigir motivo é justamente poder calibrar o motor.
 */
export const MOTIVOS_DE_REJEICAO = [
  "Desconto não é real",
  "Produto ruim, ainda que barato",
  "Vendedor duvidoso",
  "Comissão não paga o post",
  "Já publiquei parecido",
  "Não combina com os canais",
] as const;

/**
 * Os canais da operação.
 *
 * Os quatro iniciais cobrem os arranjos que existem de verdade, e
 * não quatro variações do mesmo caso: canal do próprio dono sem
 * split, canal em que a mesma pessoa traz a audiência e opera, e
 * canal em que uma pessoa traz e outra publica. Se os quatro fossem
 * iguais, a tela de canal pareceria simples e quebraria no primeiro
 * parceiro real.
 */
const canaisDaOperacao: CanalSimulado[] = [
  {
    id: "c1",
    nome: "Achados de Pet",
    plataforma: "whatsapp",
    nichos: ["pet"],
    tetoDiario: 6,
    publicadasHoje: 2,
    audiencia: 890,
    parceiro: "você",
    operador: "você",
    // Canal do próprio dono: nada a repassar.
    splitAudienciaPct: 0,
    splitOperacaoPct: 0,
    horarios: "09:00 e 18:00",
    ativo: true,
    ultimaPublicacaoEm: "2026-07-27",
  },
  {
    id: "c2",
    nome: "Ofertas do Bruno",
    plataforma: "telegram",
    nichos: ["pet", "casa"],
    tetoDiario: 10,
    publicadasHoje: 3,
    audiencia: 2400,
    parceiro: "Bruno",
    operador: "Bruno",
    // Traz a audiência e opera: as duas parcelas vão para ele.
    splitAudienciaPct: 30,
    splitOperacaoPct: 10,
    horarios: "08:00, 12:00 e 20:00",
    ativo: true,
    ultimaPublicacaoEm: "2026-07-28",
  },
  {
    id: "c3",
    nome: "Casa e Cozinha",
    plataforma: "whatsapp",
    nichos: ["casa"],
    tetoDiario: 4,
    publicadasHoje: 4,
    audiencia: 1250,
    parceiro: "você",
    operador: "você",
    splitAudienciaPct: 0,
    splitOperacaoPct: 0,
    horarios: "10:00",
    ativo: true,
    ultimaPublicacaoEm: "2026-07-26",
  },
  {
    id: "c4",
    nome: "Tech em Conta",
    plataforma: "telegram",
    nichos: ["eletronico"],
    tetoDiario: 8,
    publicadasHoje: 1,
    audiencia: 5100,
    parceiro: "Rafael",
    // Traz a audiência, mas quem publica é outra pessoa.
    operador: "Marina",
    splitAudienciaPct: 25,
    splitOperacaoPct: 10,
    horarios: "07:30 e 19:00",
    ativo: true,
    ultimaPublicacaoEm: "2026-07-28",
  },
];

export function canais(): CanalSimulado[] {
  return canaisDaOperacao.map((c) => ({ ...c }));
}

export function buscaCanal(id: string): CanalSimulado | undefined {
  const canal = canaisDaOperacao.find((c) => c.id === id);
  return canal ? { ...canal } : undefined;
}

export type DadosDoCanal = {
  nome: string;
  plataforma: Plataforma;
  nichos: string[];
  tetoDiario: number;
  audiencia: number;
  parceiro: string;
  operador: string;
  splitAudienciaPct: number;
  splitOperacaoPct: number;
  horarios: string;
};

export function criaCanal(dados: DadosDoCanal): string {
  const id = `c${canaisDaOperacao.length + 1}_${canaisDaOperacao.length}`;

  canaisDaOperacao.push({
    id,
    ...dados,
    publicadasHoje: 0,
    ativo: true,
    ultimaPublicacaoEm: null,
  });

  return id;
}

export function atualizaCanal(id: string, dados: DadosDoCanal): void {
  const canal = canaisDaOperacao.find((c) => c.id === id);
  if (!canal) return;

  Object.assign(canal, dados);
}

export function alternaCanalAtivo(id: string, ativo: boolean): void {
  const canal = canaisDaOperacao.find((c) => c.id === id);
  if (!canal) return;

  canal.ativo = ativo;
}

/**
 * A parte do dono é o que sobra — não é um terceiro campo editável.
 * Guardar os três somando 100 permitiria o estado impossível de
 * somarem 97, e alguém acabaria perguntando para onde foram os 3%.
 */
export function parteDoDono(canal: CanalSimulado): number {
  return 100 - canal.splitAudienciaPct - canal.splitOperacaoPct;
}

/**
 * A fila de hoje.
 *
 * Doze ofertas, não três: uma fila curta esconde exatamente o
 * problema que a tela precisa resolver, que é decidir depressa em
 * volume. Foi assim que o protótipo, desenhado para quatro
 * publicações, quebrou em trinta.
 */
const FILA_INICIAL: OfertaSimulada[] = [
  oferta({
    id: "o1",
    produto: "Tapete higiênico SuperSecão 80×60, 100 unidades",
    nicho: "pet",
    loja: "mercado_livre",
    vendedor: "PetShop Oficial",
    precoAtual: 8990,
    referencia: 14990,
    diasDeSerie: 34,
    comissao: 1078,
    parcelas: { desconto: 42, comissao: 21, vendedor: 18 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o2",
    produto: "Ração Golden Special Frango 15kg",
    nicho: "pet",
    loja: "shopee",
    vendedor: "Mundo Animal",
    precoAtual: 12490,
    referencia: 16990,
    diasDeSerie: 21,
    comissao: 1874,
    parcelas: { desconto: 33, comissao: 27, vendedor: 16 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o3",
    produto: "Air Fryer Mondial 4L",
    nicho: "casa",
    loja: "mercado_livre",
    vendedor: "Mondial Store",
    precoAtual: 27900,
    referencia: 39900,
    diasDeSerie: 45,
    comissao: 1395,
    parcelas: { desconto: 45, comissao: 12, vendedor: 20 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o4",
    produto: "Fone Bluetooth QCY T13",
    nicho: "eletronico",
    loja: "shopee",
    vendedor: "QCY Brasil",
    precoAtual: 8900,
    referencia: 11900,
    diasDeSerie: 9,
    comissao: 1068,
    parcelas: { desconto: 31, comissao: 20, vendedor: 14 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o5",
    produto: "Arranhador para gato com 3 níveis",
    nicho: "pet",
    loja: "shopee",
    vendedor: "Casa Pet",
    precoAtual: 15990,
    referencia: 21900,
    diasDeSerie: 28,
    comissao: 2398,
    parcelas: { desconto: 34, comissao: 28, vendedor: 12 },
    publicadaAntesEm: "2026-07-12",
  }),
  oferta({
    id: "o6",
    produto: "Jogo de panelas antiaderente 5 peças",
    nicho: "casa",
    loja: "amazon",
    vendedor: "Tramontina",
    precoAtual: 19900,
    referencia: 26900,
    diasDeSerie: 12,
    comissao: 796,
    parcelas: { desconto: 34, comissao: 9, vendedor: 19 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o7",
    produto: "Comedouro automático 6L com temporizador",
    nicho: "pet",
    loja: "mercado_livre",
    vendedor: "Import Pet",
    precoAtual: 21900,
    referencia: 27900,
    diasDeSerie: 19,
    comissao: 2628,
    parcelas: { desconto: 27, comissao: 29, vendedor: 11 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o8",
    produto: "Smartwatch Xiaomi Redmi Watch 4",
    nicho: "eletronico",
    loja: "shopee",
    vendedor: "Xiaomi Oficial",
    precoAtual: 29900,
    referencia: 37900,
    diasDeSerie: 52,
    comissao: 2093,
    parcelas: { desconto: 29, comissao: 25, vendedor: 20 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o9",
    produto: "Escova removedora de pelos para sofá",
    nicho: "casa",
    loja: "shopee",
    vendedor: "Limpa Fácil",
    precoAtual: 2490,
    referencia: 4990,
    diasDeSerie: 26,
    comissao: 199,
    parcelas: { desconto: 48, comissao: 3, vendedor: 13 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o10",
    produto: "Caixa de transporte para gato até 10kg",
    nicho: "pet",
    loja: "mercado_livre",
    vendedor: "Pet Viagem",
    precoAtual: 11900,
    referencia: 14900,
    diasDeSerie: 8,
    comissao: 1428,
    parcelas: { desconto: 24, comissao: 22, vendedor: 15 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o11",
    produto: "Liquidificador Philco 1200W",
    nicho: "casa",
    loja: "mercado_livre",
    vendedor: "Philco Oficial",
    precoAtual: 14900,
    referencia: 19900,
    diasDeSerie: 41,
    comissao: 894,
    parcelas: { desconto: 30, comissao: 11, vendedor: 20 },
    publicadaAntesEm: null,
  }),
  oferta({
    id: "o12",
    produto: "Cabo USB-C 2m reforçado",
    nicho: "eletronico",
    loja: "shopee",
    vendedor: "AceCabos",
    precoAtual: 1990,
    referencia: 3490,
    diasDeSerie: 30,
    comissao: 159,
    parcelas: { desconto: 47, comissao: 2, vendedor: 17 },
    publicadaAntesEm: null,
  }),
];

/**
 * Estado da simulação, na memória do servidor.
 *
 * Some quando o servidor reinicia, e isso é aceitável: o objetivo é
 * um testador atravessar o fluxo inteiro numa sessão. Gravar em
 * banco daria persistência de mentira — dado simulado com aparência
 * de dado real é o jeito mais fácil de alguém tirar conclusão errada
 * de um teste.
 */
const fila: OfertaSimulada[] = FILA_INICIAL.map((o) => ({ ...o }));

export function ofertasDaFila(): OfertaSimulada[] {
  return fila.filter((o) => o.status === "nova").map((o) => ({ ...o }));
}

export function todasAsOfertas(): OfertaSimulada[] {
  return fila.map((o) => ({ ...o }));
}

export function buscaOferta(id: string): OfertaSimulada | undefined {
  const encontrada = fila.find((o) => o.id === id);
  return encontrada ? { ...encontrada } : undefined;
}

/**
 * Canal desativado não é elegível. Ele para de receber publicação no
 * instante em que é desligado — não no dia seguinte, não na próxima
 * detecção.
 */
export function canaisElegiveis(nicho: string): CanalSimulado[] {
  return canais().filter((c) => c.ativo && c.nichos.includes(nicho));
}

/** Vagas de hoje: o que o teto de cada canal ativo ainda permite. */
export function vagasDeHoje(): number {
  return canais()
    .filter((c) => c.ativo)
    .reduce((total, c) => total + Math.max(0, c.tetoDiario - c.publicadasHoje), 0);
}

/**
 * Quantas publicações a fila inteira geraria se tudo fosse aprovado.
 * É o número que muda comportamento: sem ele o dono aprova de graça
 * e descobre o custo depois, em pé, no telefone.
 */
export function publicacoesSeAprovarTudo(): number {
  return ofertasDaFila().reduce((total, o) => total + canaisElegiveis(o.nicho).length, 0);
}

export function decideOferta(
  id: string,
  decisao: { status: StatusOferta; motivo?: string; canais?: string[] },
): void {
  const oferta = fila.find((o) => o.id === id);
  if (!oferta) return;

  oferta.status = decisao.status;
  oferta.motivoRejeicao = decisao.motivo ?? null;
  oferta.canaisEscolhidos = decisao.canais ?? [];
}

export function desfazDecisao(id: string): void {
  const oferta = fila.find((o) => o.id === id);
  if (!oferta) return;

  oferta.status = "nova";
  oferta.motivoRejeicao = null;
  oferta.canaisEscolhidos = [];
}

/* =============================================================
   Publicações — o que a aprovação gerou.
   ============================================================= */

export type OrigemDoEnvio = "fluxo" | "auto_declarada";

export type PublicacaoSimulada = {
  id: string;
  ofertaId: string;
  canal: CanalSimulado;
  produto: string;
  url: string;
  mensagem: string;
  /** Preço no momento em que entrou na fila. */
  precoNaFilaCentavos: number;
  /** Preço agora. Diferente do de cima = a oferta mudou embaixo. */
  precoAgoraCentavos: number;
  subid: string;
  enviadaEm: string | null;
  origem: OrigemDoEnvio | null;
  cancelada: boolean;
};

type EstadoDePublicacao = {
  enviadaEm: string | null;
  origem: OrigemDoEnvio | null;
  cancelada: boolean;
};

const estadoDasPublicacoes = new Map<string, EstadoDePublicacao>();

/**
 * Uma oferta cujo preço subiu depois de entrar na fila.
 *
 * Existe na simulação de propósito: oferta que entrou às 6h e é
 * publicada às 20h pode não existir mais, e publicar preço morto
 * queima o canal na mesma proporção que publicar preço falso. Sem um
 * caso assim, ninguém testa o bloqueio.
 */
const PRECO_QUE_MUDOU: Record<string, number> = { o5: 18990 };

export function publicacoesDaFila(): PublicacaoSimulada[] {
  const publicacoes: PublicacaoSimulada[] = [];

  for (const oferta of fila) {
    if (oferta.status !== "aprovada") continue;

    for (const canalId of oferta.canaisEscolhidos) {
      const canal = canaisDaOperacao.find((c) => c.id === canalId);
      if (!canal) continue;

      const id = `${oferta.id}:${canal.id}`;
      const estado = estadoDasPublicacoes.get(id) ?? {
        enviadaEm: null,
        origem: null,
        cancelada: false,
      };

      publicacoes.push({
        id,
        ofertaId: oferta.id,
        canal,
        produto: oferta.produto,
        url: oferta.url,
        mensagem: montaMensagem(oferta),
        precoNaFilaCentavos: oferta.precoAtualCentavos,
        precoAgoraCentavos: PRECO_QUE_MUDOU[oferta.id] ?? oferta.precoAtualCentavos,
        // Subid único por publicação, nunca reaproveitado: é o campo
        // que liga a venda ao canal, e sem ele não existe divisão de
        // receita.
        subid: `${canal.id}${oferta.id}`.replace(/[^a-z0-9]/gi, ""),
        enviadaEm: estado.enviadaEm,
        origem: estado.origem,
        cancelada: estado.cancelada,
      });
    }
  }

  return publicacoes;
}

export function marcaEnviada(id: string, origem: OrigemDoEnvio): void {
  estadoDasPublicacoes.set(id, {
    enviadaEm: new Date().toISOString(),
    origem,
    cancelada: false,
  });
}

/**
 * Desfazer no envio, em vez de confirmação antes.
 *
 * Diálogo de confirmação custa um toque em 100% dos casos para
 * proteger 2%. O desfazer custa zero no caminho feliz.
 */
export function desfazEnvio(id: string): void {
  estadoDasPublicacoes.delete(id);
}

export function cancelaPublicacao(id: string): void {
  estadoDasPublicacoes.set(id, { enviadaEm: null, origem: null, cancelada: true });
}

/**
 * A mensagem publicada.
 *
 * Sem série de 14 dias, nada de "menor preço histórico" — a redação
 * honesta traz a data em que a observação começou. Vale para a
 * mensagem tanto quanto para a tela: é ela que chega em milhares de
 * pessoas com o nome do canal em cima.
 */
function montaMensagem(oferta: OfertaSimulada): string {
  const lastro = oferta.podeAfirmarMinimo
    ? `Menor preço em ${oferta.referenciaJanelaDias} dias.`
    : `Menor preço que observamos desde ${formataDiaBR(oferta.observadoDesde)}.`;

  return [
    `🔥 ${oferta.produto}`,
    "",
    `De ${formataSimples(oferta.precoReferenciaCentavos)} por ${formataSimples(oferta.precoAtualCentavos)} (−${oferta.descontoPct}%)`,
    lastro,
    "",
    `${NOME_DA_LOJA[oferta.loja]} · ${oferta.vendedor}`,
    "👉 [link com subid]",
  ].join("\n");
}

function formataDiaBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

/**
 * Monta a oferta derivando o que o motor derivaria, para que os
 * números fechem entre si: desconto contra a referência, nota como
 * soma das parcelas, e a permissão de afirmar mínimo saindo dos 14
 * dias de série.
 */
function oferta(base: {
  id: string;
  produto: string;
  nicho: string;
  loja: OfertaSimulada["loja"];
  vendedor: string;
  precoAtual: number;
  referencia: number;
  diasDeSerie: number;
  comissao: number;
  parcelas: ParcelasDaNota;
  publicadaAntesEm: string | null;
}): OfertaSimulada {
  const descontoPct = Math.round(((base.referencia - base.precoAtual) / base.referencia) * 100);
  const janela = Math.min(base.diasDeSerie, 30);

  return {
    id: base.id,
    produto: base.produto,
    nicho: base.nicho,
    loja: base.loja,
    vendedor: base.vendedor,
    url: `https://exemplo.invalido/${base.id}`,
    precoAtualCentavos: base.precoAtual,
    precoReferenciaCentavos: base.referencia,
    referenciaJanelaDias: janela,
    descontoPct,
    diasDeSerie: base.diasDeSerie,
    podeAfirmarMinimo: base.diasDeSerie >= 14,
    observadoDesde: diasAtras(base.diasDeSerie),
    comissaoEstimadaCentavos: base.comissao,
    nota: base.parcelas.desconto + base.parcelas.comissao + base.parcelas.vendedor,
    parcelas: base.parcelas,
    comportas: [
      {
        nome: "desconto mínimo",
        passou: true,
        observado: `${descontoPct}%`,
        limiar: "15%",
      },
      {
        nome: "série mínima para avaliar",
        passou: true,
        observado: `${base.diasDeSerie} dias`,
        limiar: "7 dias",
      },
      {
        nome: "comissão mínima",
        passou: true,
        observado: formataSimples(base.comissao),
        limiar: base.nicho === "pet" ? "R$ 2,00" : "R$ 3,00",
      },
      {
        nome: "menor preço da janela",
        passou: true,
        observado: `menor em ${janela} dias`,
        limiar: "precisa ser o menor",
      },
      {
        nome: "preço recorrente",
        passou: true,
        observado: `${Math.max(5, 40 - base.parcelas.desconto)}% dos dias`,
        limiar: "até 60% dos dias",
      },
      {
        nome: "fadiga do produto",
        passou: base.publicadaAntesEm === null,
        observado: base.publicadaAntesEm ? `publicado em ${base.publicadaAntesEm}` : "nunca publicado",
        limiar: "não repetir em 30 dias",
      },
    ],
    publicadaAntesEm: base.publicadaAntesEm,
    status: "nova",
    motivoRejeicao: null,
    canaisEscolhidos: [],
  };
}

/**
 * Data em ISO, N dias atrás. A simulação precisa de datas que façam
 * sentido entre si — série de 34 dias começando há 34 dias.
 */
function diasAtras(dias: number): string {
  const quando = new Date(Date.now() - dias * 86_400_000);
  return quando.toISOString().slice(0, 10);
}

function formataSimples(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}
