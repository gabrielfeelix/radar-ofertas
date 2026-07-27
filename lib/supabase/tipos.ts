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
  ativo: boolean;
  ultima_coleta_em: string | null;
  criado_em: string;
  atualizado_em: string;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
