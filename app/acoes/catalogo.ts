"use server";

import { revalidatePath } from "next/cache";

import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Ações do catálogo.
 *
 * As duas mexem em dado real, e as duas são reversíveis de propósito:
 * nada aqui apaga. O catálogo é o ativo do projeto — a série leva
 * meses para se formar e não pode ser refeita, então "desativar" é o
 * mais destrutivo que esta tela oferece.
 */

/**
 * Troca o nicho do produto.
 *
 * Vale daqui para frente. Nicho é o eixo de roteamento: mudar aqui
 * muda para quais canais as próximas ofertas deste produto vão, e não
 * reescreve publicação nenhuma que já saiu.
 */
export async function defineNichoDoProduto(form: FormData): Promise<void> {
  const produtoId = String(form.get("produto_id") ?? "");
  const nichoId = String(form.get("nicho_id") ?? "");

  if (produtoId === "" || nichoId === "") return;

  await supabaseServidor().from("produto").update({ nicho_id: nichoId }).eq("id", produtoId);

  revalidatePath(`/produtos/${produtoId}`);
  revalidatePath("/produtos");
  revalidatePath("/atencao");
}

/**
 * Liga e desliga a coleta de um anúncio.
 *
 * Desativar para de coletar preço novo e **mantém a série inteira**. O
 * uso real é anúncio que saiu do ar na loja: continuar tentando
 * coletar dele todo dia gasta requisição e enche a tela de anúncio
 * parado, escondendo os que pararam por defeito nosso.
 */
export async function alternaAnuncioAtivo(form: FormData): Promise<void> {
  const anuncioId = String(form.get("anuncio_id") ?? "");
  const produtoId = String(form.get("produto_id") ?? "");
  const ativo = String(form.get("ativo") ?? "") === "true";

  if (anuncioId === "") return;

  await supabaseServidor().from("anuncio").update({ ativo }).eq("id", anuncioId);

  revalidatePath(`/produtos/${produtoId}`);
  revalidatePath("/produtos");
  revalidatePath("/atencao");
}

/**
 * Triagem de nicho em lote.
 *
 * Existe porque canal misto agora é escolha legítima (ver
 * `app/acoes/fontes.ts`), e escolha legítima precisa de um lugar para
 * cair. Sem esta ação, "misto" seria só uma forma educada de encher o
 * catálogo de produto que nunca chega a canal nenhum.
 *
 * **Em lote e não um por um** porque a triagem é o único trabalho
 * manual por item do sistema. Um canal genérico entrega dezenas de
 * produtos por dia; classificar de um em um, com um clique e uma
 * espera de rede cada, é o tipo de tarefa que ninguém faz na segunda
 * semana — e aí o catálogo para de crescer sem ninguém decidir isso.
 */
export async function classificaProdutos(form: FormData): Promise<void> {
  const nichoId = String(form.get("nicho_id") ?? "").trim();
  const ids = form.getAll("produto_id").map(String).filter((id) => id !== "");

  if (nichoId === "" || ids.length === 0) return;

  await supabaseServidor().from("produto").update({ nicho_id: nichoId }).in("id", ids);

  revalidatePath("/produtos/sem-nicho");
  revalidatePath("/produtos");
}
