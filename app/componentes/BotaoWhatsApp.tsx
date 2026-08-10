"use client";

import { useTransition } from "react";

import { registraEnvio } from "@/app/acoes/publicacao";
import { BotaoDePlataforma } from "@/app/componentes/Botao";

/**
 * Publicar no WhatsApp.
 *
 * O botão faz duas coisas num toque: abre o WhatsApp com a mensagem
 * pronta e registra que a publicação saiu pelo fluxo. **Ele não
 * envia nada** — quem aperta enviar é a pessoa, do outro lado, no
 * aplicativo.
 *
 * ISTO NÃO É RESTO DA REGRA VELHA. Desde a D-071 o sistema publica
 * sozinho no WhatsApp, e este botão continua existindo porque o chip
 * cai — é a premissa da D-071, não o imprevisto. Número novo leva de 7
 * a 14 dias para aquecer, e este é o caminho que mantém o grupo vivo
 * nesse período.
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
    <BotaoDePlataforma
      type="button"
      plataforma="whatsapp"
      onClick={publicar}
      disabled={desabilitado || enviando}
    >
      <span className="size-2 rounded-circulo bg-white/85" aria-hidden />
      {enviando ? "Registrando…" : "Publicar no WhatsApp"}
    </BotaoDePlataforma>
  );
}
