import { redirect } from "next/navigation";

/**
 * A raiz leva para "Aprovar".
 *
 * A casa do dono é a pergunta com que ele abre o sistema — "o que
 * precisa de mim agora?" — e não o catálogo. O catálogo é consulta;
 * aprovar é o trabalho.
 *
 * Quando existirem papéis (Fase 3), este redirecionamento passa a
 * depender de quem entrou: dono vai para Aprovar, operador para
 * Publicar, parceiro para o próprio resultado.
 */
export default function Raiz() {
  redirect("/aprovar");
}
