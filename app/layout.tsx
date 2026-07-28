import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";

import "./globals.css";

/**
 * Manrope e JetBrains Mono, as do protótipo.
 *
 * Estava rodando com a fonte padrão do Next, e era a maior diferença
 * visual entre o que o design mostra e o que a tela entrega — tipo
 * é metade da personalidade de uma interface densa como esta.
 *
 * Os pesos são os quatro que o design system usa (400, 600, 700,
 * 800); o 500 saiu por ter quatro usos residuais no protótipo.
 */
const manrope = Manrope({
  variable: "--fonte-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

/** Número, preço e identificador. Largura fixa para ler em coluna. */
const jetbrains = JetBrains_Mono({
  variable: "--fonte-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Radar de Ofertas",
  description: "Curadoria e distribuição de ofertas de marketplace",
  // Painel interno. Não deve aparecer em busca nem ser indexado.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${jetbrains.variable} h-full antialiased`}
    >
      {/*
        A casca (barra lateral, barra superior) não mora aqui: ela é do
        grupo `(painel)`. O Login precisa da mesma fonte e do mesmo
        fundo, e de nada mais — barra lateral numa tela de entrar
        mostra o menu do sistema para quem ainda não provou quem é.
      */}
      <body className="min-h-full bg-fundo text-texto">{children}</body>
    </html>
  );
}
