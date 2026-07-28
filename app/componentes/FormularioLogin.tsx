"use client";

import { useActionState } from "react";

import { entra, type ResultadoLogin } from "@/app/acoes/sessao";
import { Botao } from "@/app/componentes/Botao";
import { AcoesDoFormulario, Campo, classeDeCampo } from "@/app/componentes/Campo";

/**
 * E-mail e senha.
 *
 * Senha, e não link mágico, por decisão registrada (D-022): o link
 * mágico abre no navegador e a sessão nasce lá, não no aplicativo
 * instalado — com o PWA da D-018, a pessoa volta ao ícone ainda
 * deslogada. Senha não depende de nada externo e o gerenciador do
 * celular preenche sozinho.
 *
 * Os `autoComplete` não são detalhe: são o que faz o gerenciador de
 * senhas do celular oferecer o preenchimento. Sem eles, o operador
 * digita a senha à mão toda vez, em pé, de manhã — e é assim que ele
 * desiste.
 */
export function FormularioLogin({ de }: { de?: string }) {
  const [resultado, acao, entrando] = useActionState<ResultadoLogin | null, FormData>(
    entra,
    null,
  );

  return (
    <form action={acao} className="flex flex-col gap-4">
      {de && <input type="hidden" name="de" value={de} />}

      <Campo rotulo="E-mail">
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          placeholder="voce@exemplo.com"
          className={classeDeCampo}
        />
      </Campo>

      <Campo rotulo="Senha">
        <input
          name="senha"
          type="password"
          required
          autoComplete="current-password"
          className={classeDeCampo}
        />
      </Campo>

      {/*
        A mensagem é a mesma para senha errada, e-mail inexistente e
        conta sem convite. Distinguir transformaria esta tela num
        verificador de quem usa o sistema.
      */}
      {resultado?.ok === false && (
        <p
          role="alert"
          className="rounded-md border border-perigo-borda bg-perigo-fundo px-3 py-2 text-sm text-perigo"
        >
          {resultado.mensagem}
        </p>
      )}

      <AcoesDoFormulario>
        <Botao type="submit" variante="primaria" largura="cheia" disabled={entrando}>
          {entrando ? "Entrando…" : "Entrar"}
        </Botao>
      </AcoesDoFormulario>
    </form>
  );
}
