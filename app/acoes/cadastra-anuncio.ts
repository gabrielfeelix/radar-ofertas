"use server";

import { revalidatePath } from "next/cache";

import { paraCentavos, ValorInvalidoError } from "@/lib/dinheiro";
import { leLinkDeProduto } from "@/lib/marketplaces";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Cadastra um anúncio a partir de um link colado.
 *
 * O que esta ação faz e o que não faz, de propósito:
 *
 * FAZ — lê o link, descobre a loja e o código do anúncio, cria o
 * produto e o anúncio, e grava o primeiro ponto de preço.
 *
 * NÃO FAZ — não abre a página do produto para buscar título e
 * preço sozinha. Raspar página depende dos termos de cada site, e
 * isso ainda não foi decidido (AGENTS.md seção 8). Enquanto não
 * for, título e preço são digitados por quem cadastra. É mais
 * lento e é o certo.
 */

export type ResultadoCadastro =
  | { ok: true; anuncioId: string; produtoId: string; jaExistia: boolean }
  | { ok: false; campo: "link" | "titulo" | "preco" | "geral"; mensagem: string };

export async function cadastraAnuncio(
  _anterior: ResultadoCadastro | null,
  form: FormData,
): Promise<ResultadoCadastro> {
  const linkBruto = String(form.get("link") ?? "");
  const titulo = String(form.get("titulo") ?? "").trim();
  const categoria = String(form.get("categoria") ?? "").trim();
  const vendedor = String(form.get("vendedor") ?? "").trim();
  const precoBruto = String(form.get("preco") ?? "").trim();

  const leitura = leLinkDeProduto(linkBruto);
  if (!leitura.ok) {
    return { ok: false, campo: "link", mensagem: leitura.erro.mensagem };
  }

  if (titulo.length < 3) {
    return {
      ok: false,
      campo: "titulo",
      mensagem: "Escreva um título curto e reconhecível. É o que aparece na mensagem depois.",
    };
  }

  let precoCentavos: number | null = null;
  if (precoBruto !== "") {
    try {
      precoCentavos = paraCentavos(precoBruto);
    } catch (erro) {
      if (erro instanceof ValorInvalidoError) {
        return { ok: false, campo: "preco", mensagem: erro.message };
      }
      throw erro;
    }
    if (precoCentavos <= 0) {
      return { ok: false, campo: "preco", mensagem: "O preço precisa ser maior que zero." };
    }
  }

  const db = supabaseServidor();

  const { data: marketplace, error: erroMarketplace } = await db
    .from("marketplace")
    .select("id, nome")
    .eq("slug", leitura.link.marketplaceSlug)
    .single();

  if (erroMarketplace || !marketplace) {
    return {
      ok: false,
      campo: "geral",
      mensagem: `A loja ${leitura.link.marketplaceSlug} não está cadastrada no banco. Rode as migrations.`,
    };
  }

  // O par (loja, sku) é único. Se já existe, não crie de novo —
  // duplicar aqui parte a série de preço em duas e estraga a
  // referência de desconto.
  const { data: existente } = await db
    .from("anuncio")
    .select("id, produto_id")
    .eq("marketplace_id", marketplace.id)
    .eq("sku_externo", leitura.link.sku)
    .maybeSingle();

  if (existente) {
    if (precoCentavos !== null) {
      await db.rpc("registra_preco", {
        p_anuncio_id: existente.id,
        p_preco_centavos: precoCentavos,
      });
    }
    revalidatePath("/");
    return {
      ok: true,
      anuncioId: existente.id,
      produtoId: existente.produto_id,
      jaExistia: true,
    };
  }

  const { data: produto, error: erroProduto } = await db
    .from("produto")
    .insert({
      titulo_canonico: titulo,
      categoria: categoria === "" ? null : categoria,
    })
    .select("id")
    .single();

  if (erroProduto || !produto) {
    return {
      ok: false,
      campo: "geral",
      mensagem: `Não consegui salvar o produto: ${erroProduto?.message ?? "erro desconhecido"}`,
    };
  }

  const { data: anuncio, error: erroAnuncio } = await db
    .from("anuncio")
    .insert({
      produto_id: produto.id,
      marketplace_id: marketplace.id,
      url_original: leitura.link.urlLimpa,
      sku_externo: leitura.link.sku,
      vendedor: vendedor === "" ? null : vendedor,
    })
    .select("id")
    .single();

  if (erroAnuncio || !anuncio) {
    // O produto ficaria órfão. Limpa, senão a base enche de lixo
    // a cada tentativa que falha.
    await db.from("produto").delete().eq("id", produto.id);
    return {
      ok: false,
      campo: "geral",
      mensagem: `Não consegui salvar o anúncio: ${erroAnuncio?.message ?? "erro desconhecido"}`,
    };
  }

  if (precoCentavos !== null) {
    await db.rpc("registra_preco", {
      p_anuncio_id: anuncio.id,
      p_preco_centavos: precoCentavos,
    });
  }

  revalidatePath("/");
  return { ok: true, anuncioId: anuncio.id, produtoId: produto.id, jaExistia: false };
}
