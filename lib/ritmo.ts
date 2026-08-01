/**
 * O ritmo de publicação — quando o canal pode falar de novo.
 *
 * A pergunta que isto responde é a que o dono fez: *"não pode sair
 * publicando do nada também"*. Uma fila que despeja tudo de uma vez é
 * a forma mais rápida de fazer membro silenciar o canal, e é o erro
 * que a pesquisa de 28/07 já apontava.
 *
 * **INTERVALO, NÃO COTA DIÁRIA.** Cota gasta tudo de manhã e deixa a
 * tarde muda; intervalo distribui sozinho e sobrevive a um dia em que
 * a detecção acha trinta ofertas às oito da manhã. O teto diário do
 * canal continua valendo por cima, porque ele é o combinado com o
 * parceiro, não uma regra de ritmo.
 *
 * OS NÚMEROS SÃO POR PLATAFORMA, e a diferença é grande. A pesquisa de
 * 28/07 fixou 5 a 8 por dia, e isso era sobre **WhatsApp**. Canal de
 * Telegram não notifica como grupo, o membro não vê badge do mesmo
 * jeito, e a referência de mercado para canal de nicho é 20 a 50 por
 * dia. Aplicar o número do WhatsApp ao Telegram desperdiça o canal;
 * o contrário mata o grupo (D-033).
 */

export type FaixaDoDia = "pico" | "normal" | "madrugada";

export type RitmoConfigurado = {
  intervaloPicoMin: number;
  intervaloNormalMin: number;
  intervaloMadrugadaMin: number;
  /** Dia de pico divide os intervalos por três. Ligado à mão. */
  modoIntenso: boolean;
};

export const RITMO_PADRAO: RitmoConfigurado = {
  intervaloPicoMin: 10,
  intervaloNormalMin: 30,
  intervaloMadrugadaMin: 90,
  modoIntenso: false,
};

/** Quanto o modo intenso encurta os intervalos. */
const FATOR_INTENSO = 3;

/**
 * Em que faixa do dia estamos, no fuso de São Paulo.
 *
 * Os picos são os mesmos de `lib/horarios.ts`, que saíram da pesquisa
 * de operação: 07–09, 12–13 e 19–22. Repetir a lista aqui seria a
 * segunda verdade, então a hora vem de fora e a faixa é só a
 * classificação.
 */
export function faixaDaHora(hora: number): FaixaDoDia {
  if (hora >= 0 && hora < 7) return "madrugada";
  if ((hora >= 7 && hora < 9) || (hora >= 12 && hora < 13) || (hora >= 19 && hora < 22)) {
    return "pico";
  }
  return "normal";
}

/** A hora de agora em São Paulo, que é o fuso em que o canal vive (regra 3.9). */
export function horaEmSaoPaulo(agora: Date): number {
  return Number(
    agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }),
  );
}

/**
 * O dia de hoje em São Paulo, como `YYYY-MM-DD`.
 *
 * Existe por causa do teto diário do canal: "quantos posts saíram
 * hoje" precisa de um recorte de dia, e o recorte é o do fuso em que o
 * canal vive, não o do UTC (regra 3.9). Sem isto o teto zeraria às
 * 21h de São Paulo, que é a meia-noite de Londres, bem no meio do
 * pico da noite.
 *
 * `sv-SE` não é exotismo: é a locale cujo formato de data é
 * exatamente `YYYY-MM-DD`, o mesmo que o Postgres usa.
 */
export function diaEmSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/**
 * O instante, em UTC, em que o dia de São Paulo começou.
 *
 * É o `>=` de uma consulta por `enviada_em`. O deslocamento é fixo em
 * `-03:00` porque **o Brasil não tem horário de verão desde 2019**, e
 * enquanto não voltar não há segundo deslocamento possível. Se ele
 * voltar, esta é a linha que muda.
 */
export function inicioDoDiaEmSaoPaulo(agora: Date): Date {
  return new Date(`${diaEmSaoPaulo(agora)}T00:00:00-03:00`);
}

/** Os minutos que precisam passar entre um post e o seguinte. */
export function intervaloEmMinutos(faixa: FaixaDoDia, ritmo: RitmoConfigurado): number {
  const base =
    faixa === "pico"
      ? ritmo.intervaloPicoMin
      : faixa === "madrugada"
        ? ritmo.intervaloMadrugadaMin
        : ritmo.intervaloNormalMin;

  // Nunca abaixo de um minuto, por mais intenso que o dia seja: dois
  // posts no mesmo minuto chegam como um bloco e o segundo não é lido.
  return ritmo.modoIntenso ? Math.max(1, Math.round(base / FATOR_INTENSO)) : base;
}

export type Veredito =
  | { pode: true }
  | { pode: false; motivo: string; faltamMinutos?: number };

/**
 * O canal pode publicar agora?
 *
 * Devolve o motivo quando não pode, e não só um falso: publicação
 * automática que não sai precisa dizer por quê, senão a única pista de
 * que algo está errado é o canal mudo.
 */
export function podePublicarAgora(
  agora: Date,
  ultimaPublicacaoEm: Date | null,
  ritmo: RitmoConfigurado,
): Veredito {
  const faixa = faixaDaHora(horaEmSaoPaulo(agora));
  const intervalo = intervaloEmMinutos(faixa, ritmo);

  // Canal que nunca publicou não espera nada: o primeiro post é o que
  // tira o canal do zero.
  if (!ultimaPublicacaoEm) return { pode: true };

  const passados = (agora.getTime() - ultimaPublicacaoEm.getTime()) / 60_000;
  if (passados >= intervalo) return { pode: true };

  const faltam = Math.ceil(intervalo - passados);
  return {
    pode: false,
    motivo: `faixa ${faixa}: um post a cada ${intervalo} min, faltam ${faltam}`,
    faltamMinutos: faltam,
  };
}

/**
 * Quantos posts cabem no resto do dia, respeitando o intervalo.
 *
 * Serve à tela, não ao envio: é o número que responde "aprovei trinta,
 * quantos saem hoje?" sem obrigar ninguém a fazer a conta de cabeça.
 */
export function cabemAteMeiaNoite(agora: Date, ritmo: RitmoConfigurado): number {
  let total = 0;
  const hora = horaEmSaoPaulo(agora);
  const minutoAtual = agora.getMinutes();

  for (let h = hora; h < 24; h++) {
    const minutosDaHora = h === hora ? 60 - minutoAtual : 60;
    total += minutosDaHora / intervaloEmMinutos(faixaDaHora(h), ritmo);
  }

  return Math.floor(total);
}
