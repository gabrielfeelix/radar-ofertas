/**
 * Tipos do banco, escritos à mão para espelhar as migrations.
 *
 * Só está aqui o que a aplicação usa. Tabela que ainda não tem
 * tela não entra: tipo sem uso envelhece sem que ninguém perceba.
 *
 * **Não sobrescreva este arquivo com o gerador.** Ele traz `Banco` e
 * os apelidos `*Linha`, que a aplicação inteira importa e que a saída
 * crua não tem — sobrescrever custa ~25 erros de tipo em cadeia, além
 * da explicação de cada campo. `pnpm db:tipos` escreve em
 * `tipos-gerados.ts` justamente por isso: serve para comparar, e a
 * coluna nova vem para cá à mão.
 *
 * Quando o projeto Supabase da nuvem existir, dá para reavaliar se
 * vale passar a gerar.
 */

/**
 * A fronteira de isolamento (D-021).
 *
 * Hoje existe uma linha só e a interface não menciona a palavra. Ela
 * está tipada porque o cadastro de fonte misto precisa saber a qual
 * operação a linha pertence, e nesse caso não há nicho de onde tirar.
 */
export type OperacaoLinha = {
  id: string;
  nome: string;
  fuso: string;
  criado_em: string;
  atualizado_em: string;
};

/**
 * Quem tem acesso.
 *
 * `papeis` é lista e não valor único: a mesma pessoa pode trazer a
 * audiência e operar o canal, e é o arranjo mais provável entre
 * amigos. Com papel único ela perderia o extrato ou perderia a fila,
 * e nenhuma das duas daria erro (`docs/dados.md`).
 */
export type UsuarioLinha = {
  /** O mesmo id de `auth.users`. */
  id: string;
  operacao_id: string;
  nome: string;
  email: string;
  papeis: string[];
  /** Preenchido quando a pessoa é parceira. Liga ao extrato dela. */
  parceiro_id: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type MarketplaceLinha = {
  id: string;
  operacao_id: string;
  slug: string;
  nome: string;
  /** Só o dono lê, e por função. Nunca vem em SELECT do navegador. */
  afiliado_id?: string | null;
  /** Nulo = não configurado, que é diferente de zero. */
  comissao_padrao_pct: number | null;
  suporta_subid: boolean | null;
  subid_tamanho_max: number | null;
  cache_preco_max_horas: number | null;
  base_de_historico: boolean;
  cor_texto: string | null;
  cor_fundo: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type NichoLinha = {
  id: string;
  operacao_id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

/**
 * Percentual de comissão de uma loja para um nicho, com vigência.
 *
 * Nunca fica em código: ele muda a cada campanha sazonal, e a comissão
 * calculada é sempre marcada como estimativa. A linha vigente é a que
 * tem `vigente_ate` nulo — o histórico fica, porque comissão de venda
 * antiga foi calculada pelo percentual daquela época.
 */
export type ComissaoCategoriaLinha = {
  id: string;
  operacao_id: string;
  marketplace_id: string;
  nicho_id: string;
  percentual: number;
  vigente_desde: string;
  vigente_ate: string | null;
  criado_em: string;
};

export type ProdutoLinha = {
  id: string;
  operacao_id: string;
  /** Nulo = não roteado para canal nenhum. É a fila da triagem. */
  nicho_id: string | null;
  titulo_canonico: string;
  categoria: string | null;
  imagem_url: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type AnuncioLinha = {
  id: string;
  operacao_id: string;
  produto_id: string;
  marketplace_id: string;
  url_original: string;
  sku_externo: string;
  vendedor: string | null;
  /** Nota do produto, 0 a 5. Sinal diferente da reputação do vendedor. */
  avaliacao: number | null;
  avaliacao_qtd: number | null;
  /** Reputação do vendedor, normalizada de 0 a 1. */
  reputacao_vendedor: number | null;
  loja_oficial: boolean | null;
  vendas_estimadas: number | null;
  ativo: boolean;
  ultima_coleta_em: string | null;
  /** LINK para a imagem na loja, nunca a imagem. Expira pela política dela. */
  imagem_url: string | null;
  /** Quando o link foi obtido. Sem isto não há como saber a idade dele. */
  imagem_obtida_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

/**
 * Um ponto da série de preço: o menor preço do dia, por anúncio.
 *
 * Entra aqui em 31/07, quando a fila de aprovação passou a ler o banco
 * e a série virou dado de tela — antes disso ela era gerada por
 * `lib/simulacao/loja.ts`, e o painel de detalhe desenhava um número
 * inventado a partir do id da oferta.
 *
 * `dia_local` existe porque o "dia" aqui é o dia de quem opera, no fuso
 * de São Paulo, e não o dia UTC (regra 3.9).
 */
export type PrecoPontoLinha = {
  id: number;
  anuncio_id: string;
  preco_centavos: number;
  /** Falso quando o anúncio existe mas está esgotado. */
  disponivel: boolean;
  coletado_em: string;
  dia_local: string;
};

/**
 * Canal de distribuição (para onde a oferta vai).
 *
 * Nunca esteve aqui porque a tela de canais rodava sobre a simulação
 * em memória. Entra em 31/07, quando o painel passou a ler só dado
 * real.
 *
 * Os dois splits ficam separados de propósito: a mesma pessoa pode
 * trazer a audiência e operar, ou só trazer a audiência. O que sobra
 * dos dois é a parte do dono.
 */
export type CanalLinha = {
  id: string;
  operacao_id: string;
  parceiro_id: string | null;
  nome: string;
  plataforma: string;
  /** Obrigatório quando a plataforma é telegram (constraint do banco). */
  telegram_chat_id: string | null;
  membros_estimados: number | null;
  /** O orçamento do dia. É o que vira "vagas hoje" na aprovação. */
  posts_por_dia_max: number;
  /** Horas inteiras, no fuso de São Paulo (regra 3.9). */
  horarios_permitidos: number[];
  split_audiencia_pct: number;
  split_operacao_pct: number;
  operador_id: string | null;
  ativo: boolean;
  ultima_publicacao_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

/** Ligação canal ↔ nicho. É ela que roteia a oferta para o canal certo. */
export type CanalNichoLinha = {
  canal_id: string;
  nicho_id: string;
};

/**
 * Uma oferta enviada a um canal (migration 16).
 *
 * `subid` é único no banco, não só aqui: subid repetido não dá erro em
 * lugar nenhum — ele atribui a venda ao canal errado em silêncio, e o
 * parceiro descobre no extrato (regra 3.6).
 */
export type PublicacaoLinha = {
  id: string;
  operacao_id: string;
  oferta_id: string;
  canal_id: string;
  /** Gerado pelo banco, 8 caracteres, sem 0/O/1/I/l. */
  subid: string;
  preco_na_fila_centavos: number;
  /** A mensagem como saiu. Não se remonta depois: o modelo muda. */
  mensagem: string | null;
  estado: "pendente" | "enviada" | "cancelada" | "bloqueada";
  /** Nunca some `fluxo` com `auto_declarada` no mesmo contador. */
  origem: "fluxo" | "auto_declarada";
  enviada_em: string | null;
  enviada_por: string | null;
  cancelada_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type TipoLeituraFonte = "web_publica" | "conta_usuario";

export type FonteDescobertaLinha = {
  id: string;
  operacao_id: string;
  plataforma: string;
  /** Nome do canal sem o @. */
  identificador: string;
  nome: string | null;
  tipo_leitura: TipoLeituraFonte;
  /** O nicho que os produtos colhidos herdam. Nulo = colheita não roteável. */
  nicho_id: string | null;
  ativo: boolean;
  ultima_leitura_em: string | null;
  ultimo_post_id: number | null;
  criado_em: string;
  atualizado_em: string;
};

export type MencaoResultado =
  | "pendente"
  | "anuncio_novo"
  | "anuncio_existente"
  | "loja_desconhecida"
  | "nao_reconhecido"
  | "erro";

/** Os resultados que exigem olho humano. Espelha `mencao_problema_idx`. */
export const RESULTADOS_COM_PROBLEMA: MencaoResultado[] = [
  "pendente",
  "nao_reconhecido",
  "loja_desconhecida",
  "erro",
];

export type MencaoLinha = {
  id: number;
  operacao_id: string;
  fonte_id: string;
  post_externo_id: number;
  publicada_em: string | null;
  /** Link com o afiliado de outra pessoa. Auditoria apenas: nunca republicado. */
  url_bruta: string;
  url_resolvida: string | null;
  marketplace_id: string | null;
  sku_externo: string | null;
  anuncio_id: string | null;
  /** Alegação de terceiro. Nunca entra em preco_ponto. */
  preco_alegado_centavos: number | null;
  resultado: MencaoResultado;
  detalhe: string | null;
  vista_em: string;
  processada_em: string | null;
};

/** View `rendimento_da_fonte` — quanto cada canal rende. */
export type RendimentoDaFonteLinha = {
  fonte_id: string;
  operacao_id: string;
  identificador: string;
  nome: string | null;
  tipo_leitura: TipoLeituraFonte;
  nicho_id: string | null;
  ativo: boolean;
  ultima_leitura_em: string | null;
  mencoes: number;
  anuncios_novos: number;
  ja_conhecidos: number;
  descartadas: number;
};

/**
 * Limiar de curadoria.
 *
 * Vive em dado, e não em código, exatamente para poder ser ajustado
 * sem publicar versão nova do sistema. `nicho_id` nulo é o valor
 * global; com nicho, é o que sobrescreve para aquele nicho (D-023).
 */
export type ParametroLinha = {
  id: string;
  operacao_id: string;
  chave: string;
  nicho_id: string | null;
  valor: number;
  descricao: string | null;
  atualizado_em: string;
  criado_em: string;
};

/**
 * Contador diário de reprovação por comporta.
 *
 * Agregado, e não uma linha por anúncio avaliado: a pergunta é "qual
 * limiar está matando tudo", e uma linha por avaliação daria um milhão
 * de linhas por ano para responder uma pergunta de soma.
 */
export type ComportaDiaLinha = {
  operacao_id: string;
  dia: string;
  comporta: string;
  reprovados: number;
};

/**
 * Como a mensagem publicada é escrita.
 *
 * Um corpo só; o que muda com a série é o trecho do lastro. O porquê
 * de não serem dois modelos está em `lib/mensagem.ts`.
 */
export type ModeloMensagemLinha = {
  id: string;
  operacao_id: string;
  nome: string;
  /** Nulo = global. Preenchido = sobrescreve para aquele canal. */
  canal_id: string | null;
  corpo: string;
  lastro_com: string;
  /** Nunca pode afirmar mínimo histórico (regra 3.4). */
  lastro_sem: string;
  /** Usado quando a oferta veio de queda de hoje. Também não afirma histórico. */
  lastro_queda: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type OfertaStatus = "nova" | "aprovada" | "rejeitada" | "adiada" | "expirada";

export type OfertaLinha = {
  id: string;
  operacao_id: string;
  anuncio_id: string;
  preco_atual_centavos: number;
  /** Mediana observada por nós. Nunca o "preço de" da loja. */
  preco_referencia_centavos: number;
  referencia_janela_dias: number;
  dias_de_serie: number;
  desconto_pct: number;
  comissao_estimada_centavos: number;
  /** Falso: a mensagem não pode falar em mínimo histórico (regra 3.4). */
  pode_afirmar_minimo: boolean;
  /** Escala cheia de 0 a 100: desconto 50, comissão 30, vendedor 20. */
  nota: number;
  nota_desconto: number;
  nota_comissao: number;
  nota_vendedor: number;
  status: OfertaStatus;
  /** serie = barata contra a mediana. queda = caiu desde a leitura anterior. */
  gatilho: "serie" | "queda";
  /** Só em oferta de queda: o preço de antes, contra o qual ela é medida. */
  preco_anterior_centavos: number | null;
  motivo_rejeicao: string | null;
  adiamentos: number;
  detectada_em: string;
  decidida_em: string | null;
  decidida_por: string | null;
  expirada_em: string | null;
  criado_em: string;
};

/**
 * Registro de execução das rotinas.
 *
 * Existe porque as falhas deste sistema são silenciosas: a coleta
 * para e nada acontece na tela. Sem esta tabela, "não rodou" e
 * "rodou e não achou nada" são indistinguíveis.
 */
export type ExecucaoRotinaLinha = {
  id: string;
  operacao_id: string;
  tarefa: string;
  iniciada_em: string;
  terminada_em: string | null;
  /** Nulo enquanto está rodando. */
  sucesso: boolean | null;
  resumo: unknown;
  erro: string | null;
};

/** View `anuncio_serie` — saúde da série por anúncio. */
export type AnuncioSerieLinha = {
  anuncio_id: string;
  operacao_id: string;
  produto_id: string;
  marketplace_id: string;
  marketplace_slug: string;
  base_de_historico: boolean;
  pontos: number;
  dias_com_ponto: number;
  primeiro_dia: string | null;
  ultimo_dia: string | null;
  dias_de_serie: number | null;
  menor_preco_centavos: number | null;
  maior_preco_centavos: number | null;
  mediana_preco_centavos: number | null;
};

/** View `saude_operacao` — os números agregados de "Precisa de atenção". */
export type SaudeOperacaoLinha = {
  operacao_id: string;
  ultima_coleta: string | null;
  ultima_coleta_ok: boolean | null;
  anuncios_parados: number;
  produtos_sem_nicho: number;
  mencoes_com_problema: number;
  ofertas_na_fila: number;
  lojas_sem_credencial: number;
  lojas_sem_comissao: number;
  canais_ativos: number;
};

/**
 * Veredito de `avalia_anuncio`. Responde tanto "por que esta oferta
 * apareceu" quanto "por que este anúncio não virou oferta".
 */
export type VeredictoAnuncio = {
  anuncio_id: string;
  operacao_id: string;
  aprovada: boolean;
  /**
   * Vazio quando aprovada. O nome da comporta vem antes do
   * parêntese: `serie_curta(5_de_7_dias)`, `preco_recorrente(67%_dos_dias)`,
   * `comissao_nao_configurada`.
   */
  motivos: string[];
  preco_atual_centavos: number;
  preco_referencia_centavos: number;
  referencia_janela_dias: number;
  dias_de_serie: number;
  desconto_pct: number;
  comissao_estimada_centavos: number;
  pode_afirmar_minimo: boolean;
  recorrencia_pct: number;
  nota: number;
  nota_desconto: number;
  nota_comissao: number;
  nota_vendedor: number;
};

type Tabela<Linha, Obrigatorios extends keyof Linha> = {
  Row: Linha;
  Insert: Pick<Linha, Obrigatorios> & Partial<Omit<Linha, Obrigatorios>>;
  Update: Partial<Linha>;
  Relationships: [];
};

export type Banco = {
  public: {
    Tables: {
      operacao: Tabela<OperacaoLinha, "nome">;
      usuario: Tabela<UsuarioLinha, "id" | "operacao_id" | "nome" | "email" | "papeis">;
      marketplace: Tabela<MarketplaceLinha, "operacao_id" | "slug" | "nome">;
      nicho: Tabela<NichoLinha, "operacao_id" | "nome" | "slug">;
      produto: Tabela<ProdutoLinha, "operacao_id" | "titulo_canonico">;
      anuncio: Tabela<
        AnuncioLinha,
        "operacao_id" | "produto_id" | "marketplace_id" | "url_original" | "sku_externo"
      >;
      preco_ponto: Tabela<PrecoPontoLinha, "anuncio_id" | "preco_centavos">;
      oferta: Tabela<OfertaLinha, "operacao_id" | "anuncio_id">;
      fonte_descoberta: Tabela<FonteDescobertaLinha, "operacao_id" | "identificador">;
      mencao: Tabela<MencaoLinha, "operacao_id" | "fonte_id" | "post_externo_id" | "url_bruta">;
      execucao_rotina: Tabela<ExecucaoRotinaLinha, "operacao_id" | "tarefa">;
      parametro: Tabela<ParametroLinha, "operacao_id" | "chave" | "valor">;
      comissao_categoria: Tabela<
        ComissaoCategoriaLinha,
        "operacao_id" | "marketplace_id" | "nicho_id" | "percentual"
      >;
      modelo_mensagem: Tabela<ModeloMensagemLinha, "operacao_id" | "nome" | "corpo">;
      comporta_dia: Tabela<ComportaDiaLinha, "operacao_id" | "dia" | "comporta">;
      canal: Tabela<CanalLinha, "operacao_id" | "nome" | "plataforma">;
      canal_nicho: Tabela<CanalNichoLinha, "canal_id" | "nicho_id">;
      publicacao: Tabela<
        PublicacaoLinha,
        "operacao_id" | "oferta_id" | "canal_id" | "preco_na_fila_centavos"
      >;
    };
    Views: {
      anuncio_serie: { Row: AnuncioSerieLinha; Relationships: [] };
      saude_operacao: { Row: SaudeOperacaoLinha; Relationships: [] };
      rendimento_da_fonte: { Row: RendimentoDaFonteLinha; Relationships: [] };
    };
    Functions: {
      registra_preco: {
        Args: {
          p_anuncio_id: string;
          p_preco_centavos: number;
          p_disponivel?: boolean;
          p_coletado_em?: string;
        };
        Returns: number;
      };
      avalia_anuncio: {
        Args: { p_anuncio_id: string };
        Returns: VeredictoAnuncio[];
      };
      detecta_ofertas: {
        Args: Record<string, never>;
        Returns: { avaliados: number; aprovados: number }[];
      };
      manutencao_diaria: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      expurga_precos_expirados: { Args: Record<string, never>; Returns: number };
      abre_execucao: { Args: { p_tarefa: string }; Returns: string };
      fecha_execucao: {
        Args: { p_id: string; p_sucesso: boolean; p_resumo?: unknown; p_erro?: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
