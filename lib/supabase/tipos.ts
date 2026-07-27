/**
 * Tipos do banco, escritos à mão para espelhar as migrations da
 * Fase 1.
 *
 * Assim que o projeto Supabase existir, estes tipos passam a ser
 * gerados a partir do banco de verdade com:
 *
 *   supabase gen types typescript --linked > lib/supabase/tipos.ts
 *
 * Até lá, este arquivo é a fonte — e precisa ser atualizado junto
 * com qualquer migration nova.
 */

export type MarketplaceLinha = {
  id: string;
  slug: string;
  nome: string;
  afiliado_id: string | null;
  comissao_padrao_pct: number;
  suporta_subid: boolean | null;
  subid_tamanho_max: number | null;
  cache_preco_max_horas: number | null;
  base_de_historico: boolean;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type ProdutoLinha = {
  id: string;
  titulo_canonico: string;
  categoria: string | null;
  imagem_url: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type AnuncioLinha = {
  id: string;
  produto_id: string;
  marketplace_id: string;
  url_original: string;
  sku_externo: string;
  vendedor: string | null;
  avaliacao: number | null;
  /** Quantas avaliações. Nota 5,0 com 2 avaliações não vale nota 4,6 com 800. */
  avaliacao_qtd: number | null;
  /** Normalizada de 0 a 1. Cada loja tem escala própria; a conversão é feita na fonte. */
  reputacao_vendedor: number | null;
  loja_oficial: boolean | null;
  vendas_estimadas: number | null;
  ativo: boolean;
  ultima_coleta_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type ComissaoCategoriaLinha = {
  id: string;
  marketplace_id: string;
  categoria: string;
  percentual: number;
  vigente_desde: string;
  vigente_ate: string | null;
  criado_em: string;
};

/** Limiares da curadoria. Ajustáveis sem deploy, porque mudam toda semana no começo. */
export type ParametroLinha = {
  chave: string;
  valor: number;
  descricao: string;
  atualizado_em: string;
};

export type OfertaStatus = "nova" | "aprovada" | "rejeitada" | "expirada";

export type OfertaLinha = {
  id: string;
  anuncio_id: string;
  preco_atual_centavos: number;
  /** Mediana observada por nós. Nunca o "preço de" da loja, que é inflado. */
  preco_referencia_centavos: number;
  /** Abaixo de 14, a mensagem não pode falar em desconto histórico. */
  referencia_janela_dias: number;
  dias_de_serie: number;
  desconto_pct: number;
  comissao_estimada_centavos: number;
  /** Escala de 0 a 100, teto real 80 até a Fase 2 trazer canal. */
  nota: number;
  nota_desconto: number;
  nota_comissao: number;
  nota_qualidade: number;
  status: OfertaStatus;
  detectada_em: string;
  expirada_em: string | null;
  criado_em: string;
};

/** Veredito de `avalia_anuncio`. É o que responde "por que essa oferta não apareceu?". */
export type VeredictoAnuncio = {
  anuncio_id: string;
  aprovada: boolean;
  /** Vazio quando aprovada. Ex.: `serie_curta(5_de_14_dias)`, `comissao_baixa(144_centavos)`. */
  motivos: string[];
  preco_atual_centavos: number;
  preco_referencia_centavos: number;
  referencia_janela_dias: number;
  dias_de_serie: number;
  desconto_pct: number;
  comissao_estimada_centavos: number;
  nota: number;
  nota_desconto: number;
  nota_comissao: number;
  nota_qualidade: number;
};

export type PrecoPontoLinha = {
  id: number;
  anuncio_id: string;
  preco_centavos: number;
  disponivel: boolean;
  coletado_em: string;
  dia_local: string;
};

/** View `anuncio_serie` — saúde da série histórica por anúncio. */
export type AnuncioSerieLinha = {
  anuncio_id: string;
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

type Tabela<Linha, Obrigatorios extends keyof Linha> = {
  Row: Linha;
  Insert: Pick<Linha, Obrigatorios> & Partial<Omit<Linha, Obrigatorios>>;
  Update: Partial<Linha>;
  Relationships: [];
};

export type Banco = {
  public: {
    Tables: {
      marketplace: Tabela<MarketplaceLinha, "slug" | "nome">;
      produto: Tabela<ProdutoLinha, "titulo_canonico">;
      anuncio: Tabela<
        AnuncioLinha,
        "produto_id" | "marketplace_id" | "url_original" | "sku_externo"
      >;
      preco_ponto: Tabela<PrecoPontoLinha, "anuncio_id" | "preco_centavos">;
      comissao_categoria: Tabela<
        ComissaoCategoriaLinha,
        "marketplace_id" | "categoria" | "percentual"
      >;
      parametro: Tabela<ParametroLinha, "chave" | "valor" | "descricao">;
      oferta: Tabela<
        OfertaLinha,
        | "anuncio_id"
        | "preco_atual_centavos"
        | "preco_referencia_centavos"
        | "referencia_janela_dias"
        | "dias_de_serie"
        | "desconto_pct"
        | "comissao_estimada_centavos"
        | "nota"
        | "nota_desconto"
        | "nota_comissao"
        | "nota_qualidade"
      >;
    };
    Views: {
      anuncio_serie: { Row: AnuncioSerieLinha; Relationships: [] };
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
      expurga_precos_expirados: {
        Args: Record<string, never>;
        Returns: number;
      };
      parametro: {
        Args: { p_chave: string };
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
