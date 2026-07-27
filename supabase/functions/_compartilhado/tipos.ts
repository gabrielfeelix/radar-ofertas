/**
 * Contrato entre o coletor e as fontes de preço.
 *
 * A ideia central: o coletor não sabe nem quer saber COMO o preço
 * de cada loja chega. Ele sabe pedir "o preço deste anúncio" e
 * lidar com a resposta. Cada loja implementa esse contrato do
 * jeito que a API dela permitir.
 *
 * Isso é o que deixa o sistema pronto antes das credenciais
 * existirem: a estrutura inteira — fila, agendamento, gravação,
 * tratamento de erro, painel — funciona hoje. Quando a chave de
 * um marketplace chegar, muda um arquivo só, e nada mais.
 */

export type MarketplaceSlug = "mercado_livre" | "shopee" | "amazon";

/** O que a fonte devolve quando consegue ler. */
export type PrecoLido = {
  ok: true;
  precoCentavos: number;
  disponivel: boolean;
  /** Campos que a fonte pode ou não trazer. Usados para manter o cadastro fresco. */
  titulo?: string;
  vendedor?: string;
  avaliacao?: number;
};

/**
 * Motivos de falha. A distinção importa porque o tratamento é
 * diferente para cada um:
 *
 *   nao_configurada  — falta credencial. Não é erro, é estado.
 *                      Não polui o log nem desativa o anúncio.
 *   nao_encontrado   — o anúncio sumiu da loja. Depois de algumas
 *                      vezes seguidas, o anúncio deve ser desativado.
 *   indisponivel     — existe, mas está esgotado. É informação
 *                      legítima e vira ponto com disponivel=false.
 *   bloqueado        — a loja recusou o acesso. Precisa de gente,
 *                      não adianta tentar de novo em 5 minutos.
 *   temporario       — rede, timeout, limite de requisição. Tenta
 *                      de novo depois.
 */
export type MotivoFalha =
  | "nao_configurada"
  | "nao_encontrado"
  | "indisponivel"
  | "bloqueado"
  | "temporario";

export type FalhaNaLeitura = {
  ok: false;
  motivo: MotivoFalha;
  detalhe: string;
};

export type ResultadoLeitura = PrecoLido | FalhaNaLeitura;

/** O anúncio, do ponto de vista de quem vai buscar o preço dele. */
export type AnuncioParaColeta = {
  id: string;
  skuExterno: string;
  urlOriginal: string;
};

export interface FonteDePreco {
  readonly slug: MarketplaceSlug;

  /**
   * Se falso, o coletor pula esta loja sem registrar erro.
   * Serve para o sistema rodar inteiro com uma loja configurada e
   * as outras esperando credencial.
   */
  configurada(): boolean;

  /** Explica o que falta, para o painel poder mostrar. */
  oQueFalta(): string;

  lePreco(anuncio: AnuncioParaColeta): Promise<ResultadoLeitura>;
}
