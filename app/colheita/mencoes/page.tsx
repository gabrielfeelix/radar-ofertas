import Link from "next/link";

import { supabaseServidor } from "@/lib/supabase/servidor";
import type {
  MencaoLinha,
  MencaoResultado,
  RendimentoDaFonteLinha,
} from "@/lib/supabase/tipos";
import { RESULTADOS_COM_PROBLEMA } from "@/lib/supabase/tipos";

/**
 * Menções com problema.
 *
 * Esta é a fila de calibragem do leitor de link, e a **única
 * superfície onde a pendência do formato da Shopee fica visível**
 * (docs/decisoes.md). Sem ela, um formato de link que o leitor não
 * entende vira silêncio: a colheita roda, informa sucesso, e o
 * catálogo simplesmente cresce menos do que devia.
 *
 * O que NÃO tem aqui, de propósito: botão de reprocessar. Link que
 * caiu como não reconhecido volta a ser reconhecido quando o leitor
 * aprender o formato — e aí a correção é uma execução da colheita,
 * não um clique por linha.
 */

export const dynamic = "force-dynamic";

const LINHAS_EXIBIDAS = 200;

const EXPLICACAO: Record<MencaoResultado, string> = {
  pendente: "Entrou na fila e ainda não foi processada.",
  nao_reconhecido: "O endereço é de uma loja que conhecemos, mas o formato do link é novo.",
  loja_desconhecida: "A loja não está cadastrada. O detalhe mostra qual é.",
  erro: "Falhou ao resolver o link — quase sempre rede ou certificado.",
  anuncio_novo: "Virou anúncio novo no catálogo.",
  anuncio_existente: "Já conhecíamos esse anúncio.",
};

const ROTULO: Record<MencaoResultado, string> = {
  pendente: "pendente",
  nao_reconhecido: "não reconhecido",
  loja_desconhecida: "loja desconhecida",
  erro: "erro",
  anuncio_novo: "anúncio novo",
  anuncio_existente: "já conhecido",
};

export default async function Mencoes({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const filtro = RESULTADOS_COM_PROBLEMA.includes(tipo as MencaoResultado)
    ? (tipo as MencaoResultado)
    : null;

  let dados: Awaited<ReturnType<typeof buscaDados>>;

  try {
    dados = await buscaDados(filtro);
  } catch (erro) {
    return <AvisoDeConfiguracao mensagem={(erro as Error).message} />;
  }

  const { mencoes, contagem, fontes } = dados;
  const porFonte = new Map(fontes.map((f) => [f.fonte_id, f]));
  const total = RESULTADOS_COM_PROBLEMA.reduce((soma, r) => soma + (contagem[r] ?? 0), 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-bold tracking-titulo">Menções com problema</h1>
        <p className="mt-2 text-base text-texto-fraco">
          Link avistado que não virou anúncio. É aqui que aparece formato de loja que o leitor ainda
          não entende — o tipo de falha que não dá erro em lugar nenhum e só se manifesta como
          catálogo crescendo devagar.
        </p>
      </header>

      <section className="flex flex-wrap gap-3">
        <Filtro href="/colheita/mencoes" rotulo="todas" quantidade={total} ativo={filtro === null} />
        {RESULTADOS_COM_PROBLEMA.map((resultado) => (
          <Filtro
            key={resultado}
            href={`/colheita/mencoes?tipo=${resultado}`}
            rotulo={ROTULO[resultado]}
            quantidade={contagem[resultado] ?? 0}
            ativo={filtro === resultado}
          />
        ))}
      </section>

      {filtro && (
        <p className="rounded-md border border-info-borda bg-info-fundo px-4 py-3 text-base">
          {EXPLICACAO[filtro]}
        </p>
      )}

      {mencoes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda-forte p-8 text-center text-base text-texto-fraco">
          {total === 0
            ? "Nenhuma menção com problema. Todo link avistado virou anúncio ou já era conhecido."
            : "Nada com esse resultado."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
          <table className="w-full text-left text-base">
            <thead className="border-b border-borda bg-superficie-alt text-xs font-semibold uppercase tracking-eyebrow text-texto-fraco">
              <tr>
                <th className="px-4 py-3">Resultado</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3">Detalhe</th>
                <th className="px-4 py-3">Vista</th>
              </tr>
            </thead>
            <tbody>
              {mencoes.map((mencao) => (
                <tr key={mencao.id} className="border-b border-borda-sutil last:border-0 align-top">
                  <td className="px-4 py-3">
                    <Etiqueta resultado={mencao.resultado} />
                  </td>
                  <td className="px-4 py-3 text-texto-medio">
                    @{porFonte.get(mencao.fonte_id)?.identificador ?? "?"}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    {/*
                      A url_bruta carrega o afiliado de OUTRA pessoa.
                      Está aqui para auditoria e para o dono conseguir
                      abrir e ver o formato — nunca para republicar.
                    */}
                    <a
                      href={mencao.url_resolvida ?? mencao.url_bruta}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block truncate font-mono text-sm underline decoration-borda-forte underline-offset-2"
                      title={mencao.url_resolvida ?? mencao.url_bruta}
                    >
                      {mencao.url_resolvida ?? mencao.url_bruta}
                    </a>
                    {mencao.url_resolvida && mencao.url_resolvida !== mencao.url_bruta && (
                      <span
                        className="mt-1 block truncate text-xs text-texto-fraco"
                        title={mencao.url_bruta}
                      >
                        veio como {mencao.url_bruta}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-texto-medio">{mencao.detalhe ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-texto-medio">
                    {descreveQuando(mencao.vista_em)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {mencoes.length >= LINHAS_EXIBIDAS && (
            <p className="border-t border-borda-sutil px-4 py-3 text-sm text-texto-fraco">
              Mostrando as {LINHAS_EXIBIDAS} mais recentes. As mais antigas continuam contando no
              rendimento de cada canal.
            </p>
          )}
        </div>
      )}

      <p className="text-base text-texto-fraco">
        Muitos descartes de um canal só costumam ser formato de link, não canal ruim.{" "}
        <Link href="/colheita/fontes" className="font-semibold text-marca-texto underline">
          Ver o rendimento por canal
        </Link>
        .
      </p>
    </main>
  );
}

async function buscaDados(filtro: MencaoResultado | null) {
  const db = supabaseServidor();

  const consulta = db
    .from("mencao")
    .select("*")
    .in("resultado", filtro ? [filtro] : RESULTADOS_COM_PROBLEMA)
    .order("vista_em", { ascending: false })
    .limit(LINHAS_EXIBIDAS);

  // A contagem por tipo é feita sobre todas as menções com problema,
  // não sobre a página exibida: o número dos filtros não pode mudar
  // conforme o filtro escolhido.
  const [mencoes, todas, fontes] = await Promise.all([
    consulta,
    db.from("mencao").select("resultado").in("resultado", RESULTADOS_COM_PROBLEMA),
    db.from("rendimento_da_fonte").select("*"),
  ]);

  const falha = [mencoes, todas, fontes].find((r) => r.error);
  if (falha?.error) {
    throw new Error(
      `O banco respondeu com erro: ${falha.error.message}. ` +
        `Se as tabelas ainda não existem, rode "pnpm db:reset" para aplicar as migrations.`,
    );
  }

  const contagem: Partial<Record<MencaoResultado, number>> = {};
  for (const linha of (todas.data ?? []) as Pick<MencaoLinha, "resultado">[]) {
    contagem[linha.resultado] = (contagem[linha.resultado] ?? 0) + 1;
  }

  return {
    mencoes: (mencoes.data ?? []) as MencaoLinha[],
    fontes: (fontes.data ?? []) as RendimentoDaFonteLinha[],
    contagem,
  };
}

function descreveQuando(quando: string): string {
  const dias = Math.floor((Date.now() - new Date(quando).getTime()) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

function Etiqueta({ resultado }: { resultado: MencaoResultado }) {
  const cor =
    resultado === "erro"
      ? "bg-perigo-fundo text-perigo border-perigo-borda"
      : resultado === "pendente"
        ? "bg-info-fundo text-info border-info-borda"
        : "bg-atencao-fundo text-atencao border-atencao-borda";

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm border px-2 py-1 text-xs font-semibold ${cor}`}
    >
      {ROTULO[resultado]}
    </span>
  );
}

function Filtro({
  href,
  rotulo,
  quantidade,
  ativo,
}: {
  href: string;
  rotulo: string;
  quantidade: number;
  ativo: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-pilula border px-4 py-2 text-base font-semibold ${
        ativo
          ? "border-marca-borda bg-marca-fundo text-marca-texto"
          : "border-borda bg-superficie text-texto-medio hover:bg-superficie-alt"
      }`}
    >
      {rotulo} <span className="font-mono tabular-nums">{quantidade}</span>
    </Link>
  );
}

function AvisoDeConfiguracao({ mensagem }: { mensagem: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6">
      <h1 className="text-xl font-bold tracking-titulo">Falta configurar</h1>
      <p className="rounded-lg border border-atencao-borda bg-atencao-fundo p-5 text-base">
        {mensagem}
      </p>
      <p className="text-base text-texto-fraco">Passo a passo completo em docs/ambiente.md.</p>
    </main>
  );
}
