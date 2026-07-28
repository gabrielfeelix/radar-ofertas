import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * A porta, e o que mantém a sessão viva.
 *
 * Faz duas coisas, e as duas precisam acontecer aqui e não na página:
 *
 * **Renova o token.** O token do Supabase dura uma hora. Componente
 * de servidor não pode escrever cookie, então sem middleware a sessão
 * simplesmente morre no meio do dia e a pessoa é deslogada sozinha —
 * exatamente o que a especificação do Login proíbe ("operador que faz
 * login toda manhã abandona").
 *
 * **Barra quem não tem sessão**, antes de a página existir. A
 * verificação repetida no layout do painel é a segunda tranca: esta
 * lista de rotas públicas é a que alguém esquece de atualizar.
 *
 * A LISTA É DE PERMISSÃO, NÃO DE BLOQUEIO. Rota nova nasce fechada.
 * O contrário — bloquear o que está numa lista — faz cada tela nova
 * nascer aberta até alguém lembrar de fechá-la.
 */

const PUBLICAS = ["/entrar"];

export async function middleware(pedido: NextRequest) {
  let resposta = NextResponse.next({ request: pedido });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => pedido.cookies.getAll(),
        setAll: (novos) => {
          for (const { name, value } of novos) {
            pedido.cookies.set(name, value);
          }
          resposta = NextResponse.next({ request: pedido });
          for (const { name, value, options } of novos) {
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getUser()` e não `getSession()`: é a chamada que confere o token
  // com o servidor de autenticação, e é ela que renova o cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = pedido.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => caminho === p || caminho.startsWith(`${p}/`));

  if (!user && !publica) {
    const destino = pedido.nextUrl.clone();
    destino.pathname = "/entrar";
    // Para onde a pessoa queria ir. Depois de entrar, ela continua de
    // onde parou em vez de cair sempre na mesma tela.
    if (caminho !== "/") destino.searchParams.set("de", caminho);
    return NextResponse.redirect(destino);
  }

  if (user && caminho === "/entrar") {
    const destino = pedido.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: [
    /*
      Tudo, menos o que o navegador busca sozinho: arquivos do Next,
      ícone e imagens. Rodar o middleware neles custaria uma checagem
      de sessão por imagem carregada.
    */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
