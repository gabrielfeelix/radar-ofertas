import { Pagina } from "@/app/componentes/CabecalhoDaPagina";
import { Cartao } from "@/app/componentes/Cartao";
import { FormularioModelo } from "@/app/componentes/FormularioModelo";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { ModeloMensagemLinha } from "@/lib/supabase/tipos";

/**
 * Modelos de mensagem — como a mensagem publicada é escrita.
 *
 * Era texto fixo no código: trocar uma vírgula exigia publicar versão
 * nova do painel, e quem escreve a mensagem é o dono, não quem edita
 * TypeScript.
 *
 * **Sem inteligência artificial escrevendo mensagem.** Está na
 * especificação e continua valendo: texto gerado é texto que ninguém
 * conferiu antes de ir para milhares de pessoas com o nome do canal em
 * cima. Modelo resolve a maioria dos casos.
 *
 * Por ora existe um modelo global só. Modelo por canal — para o canal
 * cujo tom é diferente — já cabe no schema (`canal_id` nulo é o
 * global) e entra quando houver um segundo canal para justificar.
 */

export const dynamic = "force-dynamic";

export default async function Modelos() {
  const modelo = await buscaModelo();

  if (!modelo) {
    return (
      <Pagina trilha="Ajustes" titulo="Modelos de mensagem" medida="estreita">
        <Cartao espaco="lg" className="border-atencao-borda bg-atencao-fundo">
          O banco não respondeu, ou o modelo padrão não foi criado. Rode{" "}
          <code className="font-mono">pnpm db:sobe</code>.
        </Cartao>
      </Pagina>
    );
  }

  return (
    <Pagina
      trilha="Ajustes"
      titulo="Modelos de mensagem"
      medida="cheia"
      subtitulo="O texto que sai para o grupo. A prévia mostra o mesmo modelo nos dois estados da série — porque abaixo de 14 dias a redação honesta não é preferência, é regra."
    >
      <FormularioModelo
        id={modelo.id}
        inicial={{
          corpo: modelo.corpo,
          lastroCom: modelo.lastro_com,
          lastroSem: modelo.lastro_sem,
        }}
      />
    </Pagina>
  );
}

async function buscaModelo(): Promise<ModeloMensagemLinha | null> {
  try {
    const { data } = await supabaseServidor()
      .from("modelo_mensagem")
      .select("*")
      .is("canal_id", null)
      .maybeSingle();

    return (data as ModeloMensagemLinha | null) ?? null;
  } catch {
    return null;
  }
}
