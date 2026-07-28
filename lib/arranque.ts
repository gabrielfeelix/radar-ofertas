import "server-only";

import { canais } from "@/lib/simulacao/loja";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { AnuncioSerieLinha, SaudeOperacaoLinha } from "@/lib/supabase/tipos";

/**
 * Trilha de arranque — por onde começar num sistema vazio.
 *
 * Ela é irmã de "Precisa de atenção", e a diferença entre as duas é a
 * única coisa que importa entender aqui: **atenção mostra o que
 * quebrou; arranque mostra o que ainda não existe.** Um sistema recém
 * instalado não tem nada quebrado — e mesmo assim não funciona.
 *
 * Sem esta tela, um sistema vazio comunica exatamente o mesmo que um
 * sistema com problema: telas em branco. O dono fica sem saber se o
 * próximo passo é dele, do código, ou de esperar.
 *
 * DUAS REGRAS DE DESENHO, e as duas vêm do mesmo lugar — o ritmo real
 * do projeto (`docs/roadmap.md`):
 *
 * 1. **Um passo por vez.** A trilha tem oito etapas e só uma está
 *    aberta. Mostrar as oito como lista de tarefas convidaria a fazer
 *    a sétima antes da segunda, e a sétima depende da segunda.
 *
 * 2. **Esperar é um estado legítimo.** "Acumular 14 dias de série" não
 *    é tarefa de ninguém: é tempo passando. Uma trilha que trata isso
 *    como pendência faz o dono procurar o que consertar quando não há
 *    nada para consertar.
 *
 * Ela some quando a operação estiver completa, e é isso que a torna
 * honesta: enquanto estiver na tela, ainda falta coisa.
 */

export type EstadoDoPasso =
  /** Já está feito. */
  | "pronto"
  /** É o próximo, e dá para fazer agora. */
  | "agora"
  /** Só depende de tempo passando. */
  | "esperando"
  /** Depende de um passo anterior. */
  | "depois";

export type PassoDoArranque = {
  id: string;
  titulo: string;
  /** O que este passo destrava. Sem isso, a ordem parece arbitrária. */
  porque: string;
  estado: EstadoDoPasso;
  /** Onde a coisa está agora, em uma linha. */
  situacao: string;
  /** Quem resolve: você, o sistema, ou o tempo. */
  quem: "você" | "o sistema" | "o tempo";
  acao?: { rotulo: string; href: string };
};

/** Anúncios com série suficiente para a mensagem afirmar mínimo histórico. */
const DIAS_PARA_AFIRMAR_MINIMO = 14;

/** A meta da Fase 1, de `docs/roadmap.md`. */
const META_DE_ANUNCIOS = 150;

export async function montaTrilhaDeArranque(): Promise<{
  passos: PassoDoArranque[];
  completa: boolean;
}> {
  const banco = await leBanco();

  const bancoNoAr = banco !== null;
  const naNuvem = !(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("127.0.0.1");
  const temCredencial = bancoNoAr && banco.saude.lojas_sem_credencial === 0;
  const rotinaRodou = bancoNoAr && banco.saude.ultima_coleta !== null;
  const anuncios = banco?.anuncios ?? 0;
  const comLastro = banco?.comLastro ?? 0;
  // Canal simulado não conta como canal. Esta é a tela que responde
  // "o que ainda não existe" — dar por pronto um passo que só existe
  // na simulação é exatamente a mentira que ela deveria evitar.
  const canaisSimulados = canais().filter((c) => c.ativo).length;
  // Enquanto `canal` não existir no banco, canal de verdade é zero.
  // Quando a tabela entrar, este número passa a vir dela.
  const canaisReais: number = 0;

  const temDominio = enderecoDeVerdade(process.env.URL_BASE_REDIRECIONADOR);

  // A ordem é de dependência, não de importância: cada passo só faz
  // sentido depois do anterior. Publicar sem redirecionador é publicar
  // link sem subid, que é publicar sem saber de onde veio a venda.
  const bruto: Array<Omit<PassoDoArranque, "estado">> = [
    {
      id: "banco",
      titulo: "Banco de pé",
      porque: "Sem banco não existe série, e sem série não existe curadoria.",
      situacao: bancoNoAr
        ? naNuvem
          ? "No ar, na nuvem."
          : "No ar, local. Para publicar o painel, falta o projeto na nuvem."
        : "Não respondeu. Rode pnpm db:sobe.",
      quem: bancoNoAr ? "o sistema" : "você",
    },
    {
      id: "credencial",
      titulo: "Credencial de marketplace",
      porque: "É o que permite coletar preço. Sem ela o coletor roda e não coleta nada.",
      situacao: !bancoNoAr
        ? "—"
        : temCredencial
          ? "Todas as lojas ativas têm credencial."
          : `${banco.saude.lojas_sem_credencial} ${banco.saude.lojas_sem_credencial === 1 ? "loja ativa está" : "lojas ativas estão"} sem credencial.`,
      quem: "você",
    },
    {
      id: "rotina",
      titulo: "Rotina diária rodando",
      porque: "É ela que transforma preço de hoje em série. Preço de ontem não se recupera.",
      situacao: !bancoNoAr
        ? "—"
        : rotinaRodou
          ? "Já rodou pelo menos uma vez."
          : "Nunca executou.",
      quem: "você",
    },
    {
      id: "catalogo",
      titulo: "Catálogo enchendo",
      porque: `A meta da Fase 1 é ${META_DE_ANUNCIOS} anúncios monitorados. A colheita enche isso sozinha.`,
      situacao: !bancoNoAr
        ? "—"
        : `${anuncios} ${anuncios === 1 ? "anúncio" : "anúncios"} no radar, ${banco.fontesAtivas} ${banco.fontesAtivas === 1 ? "canal lido" : "canais lidos"} na colheita.`,
      quem: "o sistema",
      acao: { rotulo: "Ver as fontes", href: "/colheita/fontes" },
    },
    {
      id: "serie",
      titulo: "Série com lastro",
      porque: `Antes de ${DIAS_PARA_AFIRMAR_MINIMO} dias de série, a mensagem não pode falar em mínimo histórico. É tempo, não trabalho.`,
      situacao: !bancoNoAr
        ? "—"
        : comLastro > 0
          ? `${comLastro} ${comLastro === 1 ? "anúncio já tem" : "anúncios já têm"} ${DIAS_PARA_AFIRMAR_MINIMO} dias ou mais.`
          : "Nenhum anúncio chegou aos 14 dias ainda.",
      quem: "o tempo",
    },
    {
      id: "canal",
      titulo: "Primeiro canal",
      porque: "Aprovar sem canal é ato sem efeito: a aprovação gera publicação por canal, e não há nenhum.",
      situacao:
        canaisReais > 0
          ? `${canaisReais} ${canaisReais === 1 ? "canal ativo" : "canais ativos"}.`
          : `Nenhum canal de verdade. Os ${canaisSimulados} da tela de canais são da operação simulada.`,
      quem: "você",
      acao: { rotulo: "Ver os canais", href: "/canais" },
    },
    {
      id: "redirecionador",
      titulo: "Domínio e redirecionador",
      porque: "É o redirecionador que carrega o subid. Sem subid não existe divisão de receita.",
      situacao: temDominio
        ? "Configurado."
        : "Sem domínio registrado. O .env ainda tem o endereço de exemplo.",
      quem: "você",
    },
    {
      id: "primeira-venda",
      titulo: "Primeira comissão rastreada",
      porque: "Fecha o ciclo: prova que a venda volta com o subid certo e que o modelo funciona.",
      situacao: "Depende da primeira publicação com link próprio.",
      quem: "o tempo",
    },
  ];

  // Um passo por vez: o primeiro não pronto vira "agora", ou
  // "esperando" quando quem resolve é o tempo. O resto fica "depois".
  const prontos: Record<string, boolean> = {
    banco: bancoNoAr,
    credencial: temCredencial,
    rotina: rotinaRodou,
    catalogo: anuncios > 0,
    serie: comLastro > 0,
    canal: canaisReais > 0,
    redirecionador: temDominio,
    "primeira-venda": false,
  };

  let jaAbriu = false;
  const passos = bruto.map((passo): PassoDoArranque => {
    if (prontos[passo.id]) return { ...passo, estado: "pronto" };

    if (jaAbriu) return { ...passo, estado: "depois" };

    jaAbriu = true;
    return { ...passo, estado: passo.quem === "o tempo" ? "esperando" : "agora" };
  });

  return { passos, completa: passos.every((p) => p.estado === "pronto") };
}

/**
 * Endereço que existe, e não o de exemplo do `.env.example`.
 *
 * A primeira versão dava o passo por pronto porque a variável começava
 * com `http` — e o valor era `https://go.seudominio.com.br`. Numa tela
 * cujo trabalho é dizer o que falta, marcar como pronto o que não
 * existe é o pior defeito possível.
 */
function enderecoDeVerdade(valor: string | undefined): boolean {
  if (!valor || !valor.startsWith("https://")) return false;

  const exemplos = ["seudominio", "exemplo", "example", "cole_aqui", "localhost", "127.0.0.1"];
  return !exemplos.some((marca) => valor.includes(marca));
}

async function leBanco(): Promise<{
  saude: SaudeOperacaoLinha;
  anuncios: number;
  comLastro: number;
  fontesAtivas: number;
} | null> {
  try {
    const db = supabaseServidor();

    const [saude, anuncios, series, fontes] = await Promise.all([
      db.from("saude_operacao").select("*").limit(1).maybeSingle(),
      db.from("anuncio").select("id", { count: "exact", head: true }).eq("ativo", true),
      db.from("anuncio_serie").select("*"),
      db.from("fonte_descoberta").select("id", { count: "exact", head: true }).eq("ativo", true),
    ]);

    if (saude.error || !saude.data) return null;

    const comLastro = ((series.data ?? []) as AnuncioSerieLinha[]).filter(
      (s) => (s.dias_de_serie ?? 0) >= DIAS_PARA_AFIRMAR_MINIMO,
    ).length;

    return {
      saude: saude.data as SaudeOperacaoLinha,
      anuncios: anuncios.count ?? 0,
      comLastro,
      fontesAtivas: fontes.count ?? 0,
    };
  } catch {
    return null;
  }
}
