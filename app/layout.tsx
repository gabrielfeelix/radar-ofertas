import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Navegacao } from "@/app/componentes/Navegacao";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-fundo text-texto">
        <Navegacao />
        {children}
      </body>
    </html>
  );
}
