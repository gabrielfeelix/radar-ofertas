"use client";

import { useActionState, useEffect, useState } from "react";
import { AcoesDoFormulario, classeDeCampo, classeDeCampoLiteral } from "@/app/componentes/Campo";

import { cadastraAnuncio, type ResultadoCadastro } from "@/app/acoes/cadastra-anuncio";
import { leLinkDeProduto } from "@/lib/marketplaces";
import { Botao } from "@/app/componentes/Botao";
import { useFechaModal } from "@/app/componentes/Modal";

/**
 * Formulário de cadastro de anúncio.
 *
 * A leitura do link acontece duas vezes de propósito: aqui, na
 * hora que o operador cola, só para dar retorno imediato — e de
 * novo no servidor, que é quem decide de verdade. Validação de
 * navegador é conveniência, nunca garantia.
 *
 * Título e preço são digitados à mão. Buscar isso na página do
 * produto depende dos termos de cada marketplace e ainda não foi
 * decidido — ver a pendência em docs/decisoes.md.
 */

const NOME_DA_LOJA: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
};

export type NichoOpcao = { id: string; nome: string };

export function FormularioAnuncio({ nichos }: { nichos: NichoOpcao[] }) {
  const [resultado, acao, enviando] = useActionState<ResultadoCadastro | null, FormData>(
    cadastraAnuncio,
    null,
  );

  const fechaModal = useFechaModal();

  // Deu certo: fecha o modal, quando existe um. A confirmação é o item
  // aparecendo na lista atrás — mais forte que uma linha verde dentro
  // de um painel que some em seguida.
  useEffect(() => {
    if (resultado?.ok) fechaModal();
  }, [resultado, fechaModal]);

  return (
    <div className="flex flex-col gap-3">
      {/*
        A `key` muda a cada cadastro bem-sucedido, o que remonta os
        campos vazios. Na Fase 1 o operador cadastra dezenas de
        anúncios seguidos — limpar à mão a cada um é o tipo de
        atrito que faz a pessoa largar o sistema.

        As mensagens ficam fora do componente com key, senão
        sumiriam junto com a remontagem.
      */}
      <Campos
        key={resultado?.ok ? resultado.token : "inicial"}
        acao={acao}
        enviando={enviando}
        resultado={resultado}
        nichos={nichos}
      />

      {resultado?.ok === true && (
        <p className="text-sm text-green-700">
          {resultado.jaExistia
            ? "Esse anúncio já estava cadastrado. Registrei o preço de hoje nele."
            : "Cadastrado. Já entra na próxima coleta."}
        </p>
      )}
      {resultado?.ok === false && resultado.campo === "geral" && (
        <p className="text-sm text-red-700">{resultado.mensagem}</p>
      )}
    </div>
  );
}

function Campos({
  acao,
  enviando,
  resultado,
  nichos,
}: {
  acao: (formData: FormData) => void;
  enviando: boolean;
  resultado: ResultadoCadastro | null;
  nichos: NichoOpcao[];
}) {
  const [link, setLink] = useState("");

  // Retorno imediato sobre o link, antes de enviar qualquer coisa.
  const leitura = link.trim() === "" ? null : leLinkDeProduto(link);

  const erroDe = (campo: "link" | "titulo" | "nicho" | "preco") =>
    resultado?.ok === false && resultado.campo === campo ? resultado.mensagem : null;

  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo
        rotulo="Link do produto"
        dica="Cole o endereço da página do produto. Link curto de app não funciona — abra no navegador e copie o de cima."
        erro={erroDe("link")}
      >
        <input
          name="link"
          type="url"
          required
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.mercadolivre.com.br/..."
          className={classeDeCampoLiteral}
        />
        {leitura?.ok === true && (
          <p className="mt-1 text-sm text-green-700">
            {NOME_DA_LOJA[leitura.link.marketplaceSlug]} · código{" "}
            <code className="font-mono">{leitura.link.sku}</code>
          </p>
        )}
        {leitura?.ok === false && (
          <p className="mt-1 text-sm text-amber-700">{leitura.erro.mensagem}</p>
        )}
      </Campo>

      <Campo
        rotulo="Título"
        dica="Curto e reconhecível. É o que vai aparecer na mensagem do grupo, não o título poluído da loja."
        erro={erroDe("titulo")}
      >
        <input
          name="titulo"
          type="text"
          required
          minLength={3}
          maxLength={120}
          className={classeDeCampo}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          rotulo="Nicho"
          dica="Decide para quais canais a oferta vai, e qual limiar vale."
          erro={erroDe("nicho")}
        >
          <select
            name="nicho_id"
            required
            defaultValue={nichos.length === 1 ? nichos[0].id : ""}
            className={classeDeCampo}
          >
            <option value="">escolha…</option>
            {nichos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo rotulo="Vendedor" dica="Opcional.">
          <input
            name="vendedor"
            type="text"
            className={classeDeCampo}
          />
        </Campo>

        <Campo
          rotulo="Preço de hoje"
          dica="Opcional. Vira o primeiro ponto da série."
          erro={erroDe("preco")}
        >
          <input
            name="preco"
            type="text"
            inputMode="decimal"
            placeholder="R$ 89,90"
            className={classeDeCampo}
          />
        </Campo>
      </div>

      <AcoesDoFormulario>
        <Botao type="submit" variante="primaria" disabled={enviando || leitura?.ok === false}>
          {enviando ? "Salvando…" : "Cadastrar anúncio"}
        </Botao>
      </AcoesDoFormulario>
    </form>
  );
}

function Campo({
  rotulo,
  dica,
  erro,
  children,
}: {
  rotulo: string;
  dica?: string;
  erro?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{rotulo}</span>
      {children}
      {erro ? (
        <p className="mt-1 text-sm text-red-700">{erro}</p>
      ) : dica ? (
        <p className="mt-1 text-xs text-neutral-500">{dica}</p>
      ) : null}
    </label>
  );
}
