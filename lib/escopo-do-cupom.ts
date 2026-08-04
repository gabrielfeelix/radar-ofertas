/**
 * A que nicho um cupom pertence, pelo prefixo do código.
 *
 * POR QUE ISTO PRECISOU EXISTIR. `cupom_prefixo` guarda o escopo por
 * prefixo (`FULL`, `TODOSITE`, `MODAEBELEZA`) e a busca era **igualdade
 * exata**. Isso funcionava enquanto todo cupom trazia `DDMM` no fim: o
 * coletor cortava os quatro dígitos e o que sobrava era exatamente o
 * prefixo cadastrado.
 *
 * Em 04/08 a colheita passou a achar cupom sem data (`FASHIONML`,
 * `ALLSITERELAMPAGO`), e aí o "prefixo" virou o código inteiro. Nenhum
 * deles casa por igualdade, e todos nascem sem escopo — que, pela
 * D-039, significa não publicar nunca.
 *
 * A tabela se chama `cupom_prefixo`. Buscar por prefixo é o que ela
 * sempre prometeu.
 *
 * **O MAIS LONGO GANHA, e essa é a única regra que importa.** Com
 * `MODA` e `MODAEBELEZA` cadastrados, `MODAEBELEZA0108` casa com os
 * dois, e o certo é o segundo: ele é mais específico, e escopo errado
 * publica cupom que falha no carrinho. Empate de tamanho não existe,
 * porque dois prefixos do mesmo tamanho que casam com o mesmo código
 * seriam o mesmo prefixo.
 *
 * NÃO INVENTA ESCOPO. Código que não casa com prefixo nenhum devolve
 * nulo, e nulo continua significando "não publica" — é a regra da
 * D-036: o desconhecido separa, não é ignorado.
 */

export type EscopoDeCupom = {
  prefixo: string;
  nicho_id: string | null;
  geral: boolean;
};

export function escopoDoCupom<T extends EscopoDeCupom>(
  codigo: string,
  escopos: T[],
): T | null {
  const alvo = (codigo ?? "").toUpperCase();
  if (!alvo) return null;

  let melhor: T | null = null;
  for (const e of escopos) {
    const p = (e.prefixo ?? "").toUpperCase();
    if (!p || !alvo.startsWith(p)) continue;
    if (!melhor || p.length > melhor.prefixo.length) melhor = e;
  }
  return melhor;
}
