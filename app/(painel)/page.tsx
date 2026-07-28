import { redirect } from "next/navigation";

import { casaDeQuemEntrou } from "@/app/acoes/sessao";

/**
 * A raiz leva para a casa do papel de quem entrou.
 *
 * Dono cai em Aprovar: a casa dele é a pergunta com que ele abre o
 * sistema — "o que precisa de mim agora?" — e não o catálogo. O
 * catálogo é consulta; aprovar é o trabalho.
 *
 * Operador cai em Publicar, que é o trabalho dele. Mandar o operador
 * para a fila de aprovação seria entregá-lo numa tela de decisão que
 * não é dele e que ele não pode resolver.
 */
export default async function Raiz() {
  redirect(await casaDeQuemEntrou());
}
