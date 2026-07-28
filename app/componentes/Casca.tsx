import {
  BarraInferior,
  BarraLateral,
  type GrupoDaBarra,
  type ResumoDaBarra,
} from "./BarraLateral";
import { BarraSuperior, type EstadoDaRotina } from "./BarraSuperior";

import { montaTrilhaDeArranque } from "@/lib/arranque";
import { montaQuadroDeAtencao } from "@/lib/atencao";
import type { UsuarioDaSessao } from "@/lib/sessao";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { ofertasDaFila, publicacoesDaFila } from "@/lib/simulacao/loja";

/**
 * A casca do painel: barra lateral, barra superior e o miolo.
 *
 * Ela busca os números das medalhas do menu, e faz isso tolerando o
 * banco fora do ar. O painel roda na máquina do dono; se o Docker
 * não estiver de pé, a casca inteira cair junto transformaria um
 * aviso em tela branca.
 *
 * Repare na mistura, que é temporária e está escrita para não
 * assustar: as contagens de Aprovar e Publicar vêm da operação
 * simulada (D-026), as de Fontes e Menções vêm do banco de verdade.
 */

export async function Casca({
  children,
  usuario,
}: {
  children: React.ReactNode;
  usuario: UsuarioDaSessao;
}) {
  const { grupos, resumo, rotina } = await montaNavegacao();

  return (
    <div className="flex min-h-screen items-stretch">
      <BarraLateral grupos={grupos} resumo={resumo} />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraInferior grupos={grupos} />
        <BarraSuperior rotina={rotina} usuario={usuario} />
        {/*
          Um <main> só, aqui, com o título da tela dentro dele. Antes
          cada página abria o próprio, e o h1 ficava fora — leitor de
          tela anunciava "conteúdo principal" depois do título.
        */}
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

async function montaNavegacao(): Promise<{
  grupos: GrupoDaBarra[];
  resumo: ResumoDaBarra[];
  rotina: EstadoDaRotina;
}> {
  const naFila = ofertasDaFila().length;
  const aPublicar = publicacoesDaFila().filter((p) => !p.enviadaEm && !p.cancelada).length;

  const banco = await leDoBanco();
  // A contagem do menu é a mesma da tela: se divergirem, o dono
  // aprende a não confiar no número do menu, e o alerta que importa
  // passa junto.
  const { alertas } = await montaQuadroDeAtencao();
  const criticos = alertas.filter((a) => a.severidade === "critico").length;

  // A trilha só existe enquanto a operação estiver incompleta. Item de
  // menu que continua ali depois de resolvido vira mobília.
  const { passos, completa } = await montaTrilhaDeArranque();
  const faltam = passos.filter((p) => p.estado !== "pronto").length;

  const grupos: GrupoDaBarra[] = [
    {
      titulo: "Hoje",
      itens: [
        { href: "/aprovar", rotulo: "Aprovar", contagem: naFila, ponto: "#F16A0D" },
        { href: "/publicar", rotulo: "Publicar", contagem: aPublicar, ponto: "#1FA855" },
        {
          href: "/atencao",
          rotulo: "Precisa de atenção",
          // Só o crítico vira medalha. Medalha em cima de aviso
          // informativo é o que ensina a ignorar o menu inteiro.
          contagem: criticos > 0 ? criticos : undefined,
          ponto: criticos > 0 ? "#C13232" : "#9AA0AA",
        },
        ...(completa
          ? []
          : [
              {
                href: "/arranque",
                rotulo: "Trilha de arranque",
                contagem: faltam,
                ponto: "#7A4FBF",
              },
            ]),
      ],
    },
    {
      titulo: "Catálogo",
      itens: [
        { href: "/produtos", rotulo: "Produtos", contagem: banco?.anuncios, ponto: "#1B76B8" },
        // Só aparece quando há o que triar: item de menu que fica ali
        // marcando zero vira mobília, e mobília se aprende a ignorar.
        ...(banco?.semNicho
          ? [
              {
                href: "/produtos/sem-nicho",
                rotulo: "Sem classificação",
                contagem: banco.semNicho,
                ponto: "#B4740A",
              },
            ]
          : []),
        { href: "/colheita/fontes", rotulo: "Fontes", contagem: banco?.fontesAtivas, ponto: "#7A4FBF" },
        {
          href: "/colheita/mencoes",
          rotulo: "Menções",
          contagem: banco?.mencoesComProblema,
          ponto: "#B4740A",
        },
      ],
    },
    {
      titulo: "Distribuição",
      itens: [{ href: "/canais", rotulo: "Canais", ponto: "#2AABEE" }],
    },
    {
      titulo: "Ajustes",
      itens: [
        { href: "/ajustes/curadoria", rotulo: "Rigor da curadoria", ponto: "#4B5563" },
        { href: "/ajustes/nichos", rotulo: "Nichos", ponto: "#4B5563" },
        { href: "/ajustes/marketplaces", rotulo: "Marketplaces", ponto: "#4B5563" },
      ],
    },
  ];

  const resumo: ResumoDaBarra[] =
    banco === null
      ? []
      : [
          { rotulo: "menções", valor: `${banco.mencoes}` },
          {
            rotulo: "anúncios novos",
            valor: `${banco.anuncios}`,
            cor: banco.anuncios > 0 ? "text-sucesso" : "text-texto-fraco",
          },
          {
            rotulo: "descartadas",
            valor: `${banco.mencoesComProblema}`,
            cor: banco.mencoesComProblema > 0 ? "text-atencao" : "text-texto-fraco",
          },
        ];

  return { grupos, resumo, rotina: banco?.rotina ?? { situacao: "banco_fora" } };
}

/**
 * Números do banco, ou `null` quando ele não responde.
 *
 * O `catch` engole o erro de propósito aqui, e só aqui: quem precisa
 * explicar a falha em português é a tela, que tem espaço para dizer o
 * que fazer. O menu só precisa não quebrar.
 */
async function leDoBanco(): Promise<{
  anuncios: number;
  semNicho: number;
  fontesAtivas: number;
  mencoes: number;
  mencoesComProblema: number;
  rotina: EstadoDaRotina;
} | null> {
  try {
    const db = supabaseServidor();

    const [anuncios, semNicho, fontes, mencoes, problemas, execucao] = await Promise.all([
      db.from("anuncio").select("id", { count: "exact", head: true }),
      db.from("produto").select("id", { count: "exact", head: true }).is("nicho_id", null),
      db.from("fonte_descoberta").select("id", { count: "exact", head: true }).eq("ativo", true),
      db.from("mencao").select("id", { count: "exact", head: true }),
      db
        .from("mencao")
        .select("id", { count: "exact", head: true })
        .in("resultado", ["pendente", "nao_reconhecido", "loja_desconhecida", "erro"]),
      db
        .from("execucao_rotina")
        .select("iniciada_em, sucesso")
        .order("iniciada_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (anuncios.error) return null;

    const ultima = execucao.data as { iniciada_em: string; sucesso: boolean | null } | null;

    return {
      anuncios: anuncios.count ?? 0,
      semNicho: semNicho.count ?? 0,
      fontesAtivas: fontes.count ?? 0,
      mencoes: mencoes.count ?? 0,
      mencoesComProblema: problemas.count ?? 0,
      rotina: ultima
        ? {
            situacao: ultima.sucesso === false ? "falhou" : "ok",
            quando: new Date(ultima.iniciada_em).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            }),
          }
        : { situacao: "sem_registro" },
    };
  } catch {
    return null;
  }
}
