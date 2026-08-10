"use client";

import { useState, useTransition } from "react";

import { buscaQrCode } from "@/app/acoes/bots";
import { Botao } from "@/app/componentes/Botao";

/**
 * O QR Code de reconexão.
 *
 * É a única operação da Evolution que o painel faz, e ela existe porque
 * é a única urgente: a sessão cai às 22h de sábado e ninguém quer abrir
 * terminal na VPS. Criar e apagar instância continuam no Manager, que
 * já tem tela.
 *
 * O código é buscado SOB DEMANDA, no clique, e nunca no carregamento da
 * página. Dois motivos: pedir QR Code a uma instância conectada derruba
 * a sessão dela, e o código expira em segundos — buscado cedo, chegaria
 * vencido na tela.
 */
export function QrCodeDoBot({ instancia, nome }: { instancia: string; nome: string }) {
  const [estado, setEstado] = useState<
    { fase: "parado" } | { fase: "pronto"; imagem: string } | { fase: "erro"; motivo: string }
  >({ fase: "parado" });
  const [buscando, comecaBusca] = useTransition();

  function busca() {
    comecaBusca(async () => {
      const r = await buscaQrCode(instancia);
      setEstado(r.ok ? { fase: "pronto", imagem: r.imagem } : { fase: "erro", motivo: r.motivo });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Botao type="button" variante="secundaria" tamanho="sm" onClick={busca} disabled={buscando}>
        {buscando ? "Buscando…" : estado.fase === "pronto" ? "Gerar outro QR Code" : "Reconectar"}
      </Botao>

      {estado.fase === "erro" && (
        <p className="max-w-xs text-sm leading-longo text-perigo">{estado.motivo}</p>
      )}

      {estado.fase === "pronto" && (
        <div className="flex flex-col gap-2">
          {/*
            `img` cru em vez do componente do Next: a imagem é um
            `data:` gerado agora, sem URL para otimizar, e o
            otimizador do Next não faz nada por ela.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={estado.imagem}
            alt={`QR Code para reconectar ${nome}`}
            className="size-56 rounded-md border border-borda-sutil bg-white p-2"
          />
          <p className="max-w-xs text-xs leading-longo text-texto-fraco">
            No celular do chip: WhatsApp, Aparelhos conectados, Conectar um aparelho. O código
            expira em segundos, então leia agora.
          </p>
        </div>
      )}
    </div>
  );
}
