/**
 * De quem é a comissão de um link: do dono ou do parceiro (D-074).
 *
 * POR QUE ISTO É UM MÓDULO SÓ, e não um `if` no publicador: errar aqui
 * não dá erro em lugar nenhum. O link sai perfeito, a pessoa compra, e
 * a comissão cai na conta errada. O parceiro só descobre no extrato, e
 * aí a parceria já acabou.
 *
 * AS TRÊS RESPOSTAS:
 *
 *   * `dono`     — canal sem parceiro, ou parceiro sem nenhuma conta
 *                  cadastrada. É o comportamento de antes da D-074,
 *                  byte por byte: todos os canais do dono caem aqui.
 *   * `parceiro` — o parceiro tem conta nesta loja. O link sai com o ID
 *                  dele, e NUNCA pelo link curto da Open API, que é do
 *                  AppID do dono e atribuiria a venda ao dono.
 *   * `ninguem`  — o parceiro tem conta, mas não nesta loja. A oferta
 *                  não sai no grupo dele. Cair para o ID do dono aqui
 *                  seria o defeito que a D-074 existe para impedir.
 */

/** Slug da loja → ID de afiliado do parceiro nela. */
export type ContasDoParceiro = Record<string, string>;

export type DonoDoLink =
  | { de: "dono" }
  | { de: "parceiro"; afiliadoId: string }
  | { de: "ninguem"; motivo: string };

/**
 * As lojas em que um ID sozinho basta para o link pagar. O Mercado
 * Livre não está: lá o link só sai pelo gerador da Central, logado na
 * conta de quem recebe (D-034), e a sessão do parceiro ainda não existe
 * no sistema.
 */
const LOJAS_SO_COM_ID = new Set(["shopee", "amazon"]);

export function donoDoLink(
  contas: ContasDoParceiro | null | undefined,
  loja: string,
): DonoDoLink {
  if (!contas || Object.keys(contas).length === 0) return { de: "dono" };

  const afiliadoId = contas[loja]?.trim();
  if (!afiliadoId) {
    return { de: "ninguem", motivo: `o parceiro não tem conta de afiliado em ${loja}` };
  }
  if (!LOJAS_SO_COM_ID.has(loja)) {
    return {
      de: "ninguem",
      motivo: `${loja} ainda não gera link com a conta do parceiro (falta a sessão da Central dele)`,
    };
  }
  return { de: "parceiro", afiliadoId };
}

/** Monta o mapa a partir do que o banco devolve em `parceiro_afiliado`. */
export function contasDasLinhas(
  linhas: { afiliado_id: string; marketplace: { slug: string } | null }[] | null | undefined,
): ContasDoParceiro {
  const contas: ContasDoParceiro = {};
  for (const l of linhas ?? []) {
    if (l.marketplace?.slug && l.afiliado_id?.trim()) contas[l.marketplace.slug] = l.afiliado_id.trim();
  }
  return contas;
}
