import { redirect } from "next/navigation";

import { Casca } from "@/app/componentes/Casca";
import { usuarioAtual } from "@/lib/sessao";

/**
 * O painel — tudo que exige estar dentro.
 *
 * A verificação aqui é a segunda tranca, não a primeira: o
 * `middleware.ts` já barra quem não tem sessão antes de a página
 * existir. Ela é repetida porque middleware protege *rota*, e este
 * layout é o que garante que nenhuma página nova nasça aberta por
 * esquecimento de alguém editar a lista de rotas públicas.
 *
 * E é aqui que o usuário entra na casca: sem ele, a barra superior
 * mostrava "Gabriel · dono" escrito à mão no código.
 */
export default async function LayoutDoPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");

  return <Casca usuario={usuario}>{children}</Casca>;
}
