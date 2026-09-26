"use client";

import { useActionState, useEffect } from "react";

import { salvaParceiro, type ResultadoParceiro } from "@/app/acoes/parceiros";
import { Botao } from "@/app/componentes/Botao";
import { AcoesDoFormulario, Campo, classeDeCampo } from "@/app/componentes/Campo";
import { useFechaModal } from "@/app/componentes/Modal";
import type { Parceiro } from "@/lib/parceiros";

/**
 * Formulário de parceiro — o mesmo para criar e para editar (D-074).
 *
 * As dicas dizem ONDE o parceiro acha cada número, porque quem preenche
 * é o dono com o WhatsApp do parceiro aberto do lado.
 */
export function FormularioParceiro({ parceiro }: { parceiro?: Parceiro }) {
  const [resultado, acao, salvando] = useActionState<ResultadoParceiro | null, FormData>(
    salvaParceiro,
    null,
  );

  const fechaModal = useFechaModal();
  useEffect(() => {
    if (resultado?.ok) fechaModal();
  }, [resultado, fechaModal]);

  const erroDe = (campo: "nome" | "shopee" | "amazon") =>
    resultado?.ok === false && resultado.campo === campo ? resultado.mensagem : null;

  return (
    <form action={acao} className="flex flex-col gap-5">
      {parceiro && <input type="hidden" name="parceiro_id" value={parceiro.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Nome" erro={erroDe("nome")}>
          <input
            name="nome"
            type="text"
            required
            defaultValue={parceiro?.nome}
            placeholder="Breno"
            className={classeDeCampo}
          />
        </Campo>

        <Campo rotulo="Contato" dica="Opcional. Telefone ou @, para você lembrar quem é.">
          <input
            name="contato"
            type="text"
            defaultValue={parceiro?.contato ?? ""}
            className={classeDeCampo}
          />
        </Campo>
      </div>

      <Campo
        rotulo="ID de afiliado da Shopee"
        dica="Só número, uns 11 dígitos. Na dúvida, abra um link de afiliado dele: o número vem depois de an_ (utm_source=an_18373711182). Vazio: o grupo dele não recebe oferta da Shopee."
        erro={erroDe("shopee")}
      >
        <input
          name="afiliado_shopee"
          type="text"
          inputMode="numeric"
          defaultValue={parceiro?.contas.shopee ?? ""}
          placeholder="18373711182"
          className={classeDeCampo}
        />
      </Campo>

      <Campo
        rotulo="Tag de associado da Amazon"
        dica="Opcional. Termina em -20. Vazio: o grupo dele não recebe oferta da Amazon."
        erro={erroDe("amazon")}
      >
        <input
          name="afiliado_amazon"
          type="text"
          defaultValue={parceiro?.contas.amazon ?? ""}
          placeholder="nome0a-20"
          className={classeDeCampo}
        />
      </Campo>

      <p className="text-sm leading-longo text-texto-fraco">
        Mercado Livre ainda não: o link de lá só sai logado na Central de Afiliados do parceiro.
        Enquanto isso, o grupo dele simplesmente não recebe oferta do ML. Nunca sai com o seu ID.
      </p>

      <AcoesDoFormulario>
        <Botao type="submit" variante="primaria" disabled={salvando}>
          {salvando ? "Salvando…" : parceiro ? "Salvar parceiro" : "Criar parceiro"}
        </Botao>
        {resultado?.ok === true && <span className="text-base text-sucesso">Salvo.</span>}
      </AcoesDoFormulario>
    </form>
  );
}
