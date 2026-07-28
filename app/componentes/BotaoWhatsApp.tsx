"use client";

import { useTransition } from "react";

import { registraEnvio } from "@/app/acoes/publicacao";

/**
 * Publicar no WhatsApp.
 *
 * O botão faz duas coisas num toque: abre o WhatsApp com a mensagem
 * pronta e registra que a publicação saiu pelo fluxo. **Ele não
 * envia nada** — quem aperta enviar é a pessoa, do outro lado, no
 * aplicativo. Automatizar isso derruba o número, que é o ativo do
 * parceiro (regra 3.2 do AGENTS.md).
 *
 * Registrar antes de saber se a pessoa realmente apertou enviar é
 * deliberado: o caminho de volta é o desfazer, que custa zero no
 * caminho feliz. A alternativa — perguntar "enviou mesmo?" na volta
 * — cobra um toque em 100% dos casos para corrigir uns poucos.
 */
export function BotaoWhatsApp({
  publicacaoId,
  mensagem,
  desabilitado,
}: {
  publicacaoId: string;
  mensagem: string;
  desabilitado?: boolean;
}) {
  const [enviando, transicao] = useTransition();

  function publicar() {
    // Link oficial de compartilhamento. Sem número: quem escolhe o
    // destino é a pessoa, no aplicativo.
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");

    transicao(() => {
      const dados = new FormData();
      dados.set("publicacao_id", publicacaoId);
      registraEnvio(dados);
    });
  }

  return (
    <button
      type="button"
      onClick={publicar}
      disabled={desabilitado || enviando}
      className="w-full rounded-md bg-whatsapp px-5 py-4 text-base font-bold text-white disabled:opacity-40 sm:w-auto"
    >
      {enviando ? "Registrando…" : "Publicar no WhatsApp"}
    </button>
  );
}
