import { sai } from "@/app/acoes/sessao";
import { Botao } from "@/app/componentes/Botao";
import { Identidade } from "@/app/componentes/Identidade";
import type { UsuarioDaSessao } from "@/lib/sessao";

/**
 * Barra superior.
 *
 * A BUSCA É UM FORMULÁRIO, e leva ao catálogo. Ela ficou desabilitada
 * enquanto não havia tela de catálogo para receber o termo — campo que
 * aceita texto e não busca nada faz a pessoa concluir que o catálogo
 * está vazio. Agora que `/produtos` existe, ela funciona, sem
 * JavaScript nenhum: o termo vira endereço, e endereço se guarda.
 *
 * O ESTADO DA ROTINA É O DE VERDADE. O protótipo mostra "Rotina
 * 06:08" sempre em verde. Aqui, quando não há execução registrada, a
 * faixa diz isso — ausência de alerta só tranquiliza se for possível
 * distinguir "nada quebrado" de "a verificação não rodou".
 */

export type EstadoDaRotina =
  | { situacao: "ok"; quando: string }
  | { situacao: "falhou"; quando: string }
  | { situacao: "sem_registro" }
  | { situacao: "banco_fora" };

export function BarraSuperior({
  rotina,
  usuario,
}: {
  rotina: EstadoDaRotina;
  usuario: UsuarioDaSessao;
}) {
  return (
    <header className="sticky top-0 z-10 hidden items-center gap-5 border-b border-borda bg-superficie px-6 py-3 lg:flex">
      <form
        action="/produtos"
        className="flex max-w-96 flex-1 items-center gap-3 rounded-md border border-borda bg-fundo px-4 py-3"
      >
        <span className="size-3 flex-none rounded-circulo border-2 border-texto-apagado" aria-hidden />
        <input
          type="search"
          name="q"
          placeholder="Buscar no catálogo"
          aria-label="Buscar no catálogo"
          className="min-w-0 flex-1 bg-transparent text-base text-texto outline-none placeholder:text-texto-fraco"
        />
      </form>

      <div className="ml-auto flex items-center gap-4">
        <FaixaDaRotina rotina={rotina} />

        {/*
          Quem está usando, de verdade. Isto era "Gabriel · dono"
          escrito à mão no código — e num sistema em que o papel muda o
          que a tela mostra, saber com qual conta se está é o começo de
          confiar no que se vê.
        */}
        <div className="flex items-center gap-3 border-l border-borda pl-4">
          <Identidade nome={usuario.nome} forma="circulo" tamanho="sm" />
          <span className="flex flex-col leading-titulo">
            <span className="text-sm font-semibold">{usuario.nome}</span>
            <span className="text-xs text-texto-fraco">{usuario.papeis.join(" · ")}</span>
          </span>
          <form action={sai}>
            <Botao type="submit" variante="fantasma" tamanho="sm">
              sair
            </Botao>
          </form>
        </div>
      </div>
    </header>
  );
}

function FaixaDaRotina({ rotina }: { rotina: EstadoDaRotina }) {
  if (rotina.situacao === "ok") {
    return (
      <Faixa cor="border-sucesso-borda bg-sucesso-fundo text-sucesso" ponto="bg-sucesso">
        Rotina {rotina.quando}
      </Faixa>
    );
  }

  if (rotina.situacao === "falhou") {
    return (
      <Faixa cor="border-perigo-borda bg-perigo-fundo text-perigo" ponto="bg-perigo">
        Rotina falhou {rotina.quando}
      </Faixa>
    );
  }

  if (rotina.situacao === "banco_fora") {
    return (
      <Faixa cor="border-atencao-borda bg-atencao-fundo text-atencao" ponto="bg-atencao">
        Banco fora do ar
      </Faixa>
    );
  }

  return (
    <Faixa cor="border-borda bg-fundo text-texto-fraco" ponto="bg-texto-apagado">
      Rotina ainda não rodou
    </Faixa>
  );
}

function Faixa({
  cor,
  ponto,
  children,
}: {
  cor: string;
  ponto: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${cor}`}>
      <span className={`size-2 rounded-circulo ${ponto}`} aria-hidden />
      {children}
    </span>
  );
}
