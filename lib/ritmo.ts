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
  /**
   * Quantos minutos o intervalo pode ENCURTAR, por sorteio.
   *
   * Com intervalo de 5 e folga de 2, os posts saem a cada 3, 4 ou 5
   * minutos em vez de 5 cravado. **O motivo é parecer gente.**
   *
   * Canal que publica exatamente de 5 em 5 tem carimbo de robô, e
   * canal de oferta vive de parecer gente — é a mesma razão da regra
   * 3.11, que proíbe travessão. O dono notou isso observando os
   * concorrentes: os horários deles são irregulares.
   *
   * ENCURTA E NUNCA ALONGA, de propósito: alongar deixaria o canal mais
   * lento que o combinado, e o intervalo configurado é o teto de
   * frequência que o parceiro aceitou, não uma média.
   */
  jitterMin: number;
};

export const RITMO_PADRAO: RitmoConfigurado = {
  intervaloPicoMin: 10,
  intervaloNormalMin: 30,
  intervaloMadrugadaMin: 90,
  modoIntenso: false,
  jitterMin: 0,
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

/**
 * Os minutos que precisam passar entre um post e o seguinte.
 *
 * `sorteio` existe para o teste poder fixar o acaso. Em produção ele é
 * `Math.random`; no teste, uma função que devolve o número que se quer.
 * Sem isso, ou o jitter fica sem teste, ou o teste fica intermitente —
 * e teste intermitente é pior que teste nenhum, porque ensina a ignorar
 * falha vermelha.
 */
export function intervaloEmMinutos(
  faixa: FaixaDoDia,
  ritmo: RitmoConfigurado,
  sorteio: () => number = Math.random,
): number {
  const base =
    faixa === "pico"
      ? ritmo.intervaloPicoMin
      : faixa === "madrugada"
        ? ritmo.intervaloMadrugadaMin
        : ritmo.intervaloNormalMin;

  const comIntensidade = ritmo.modoIntenso ? Math.round(base / FATOR_INTENSO) : base;

  // A folga nunca engole o intervalo inteiro: sorteada maior que o
  // próprio intervalo, ela viraria "publique sempre".
  const folga = Math.min(Math.max(0, ritmo.jitterMin), Math.max(0, comIntensidade - 1));
  const sorteado = folga > 0 ? Math.floor(sorteio() * (folga + 1)) : 0;

  // Nunca abaixo de um minuto, por mais intenso que o dia seja: dois
  // posts no mesmo minuto chegam como um bloco e o segundo não é lido.
  return Math.max(1, comIntensidade - sorteado);
}

/* =============================================================
   O RITMO DO WHATSAPP, que é outro e não negocia.
   ============================================================= */

/**
 * O piso e o teto do intervalo no WhatsApp, em minutos.
 *
 * **Regra do dono, em 10/08, com estas palavras: *"tem que ser
 * aleatório entre 4 à 10 min cada promo, NAO PODEMOS SER MENOS OU MAIS
 * QUE ISSO"*.** É a primeira regra do WhatsApp, e vale acima da faixa
 * do dia: pico, normal e madrugada usam esta mesma janela.
 *
 * Por que ela é diferente do Telegram: no Telegram o intervalo serve à
 * audiência, e publicar demais faz o membro silenciar o canal. Aqui ele
 * serve ao NÚMERO. Cadência regular é assinatura de robô no protocolo,
 * e cadência curta demais é o padrão de disparo em massa que derruba
 * conta. As duas pontas custam o chip, então as duas são duras.
 *
 * O que continua valendo por cima: o teto diário do canal, o
 * `whatsapp_envios_dia_max` por chip, e o `horarios_permitidos` — é ele,
 * e não o intervalo, que impede o grupo de tocar às 3 da manhã.
 */
export const WHATSAPP_INTERVALO_MIN = 4;
export const WHATSAPP_INTERVALO_MAX = 10;

/**
 * Um número entre 0 e 1, sorteado mas ESTÁVEL para a mesma semente.
 *
 * `Math.random` não serve aqui, e a razão é sutil o bastante para
 * merecer o comentário: o publicador chama `podePublicarAgora` de novo
 * a cada volta do laço, enquanto dorme esperando a vez do canal. Com
 * sorteio novo a cada chamada, o alvo se mexeria embaixo dele — sorteia
 * 9, dorme, acorda, sorteia 5, e o intervalo real vira o maior dos
 * sorteios da espera, passando dos 10 minutos que a regra proíbe.
 *
 * Amarrado ao canal e ao último post, o sorteio é um só enquanto aquele
 * post for o último, e muda assim que sai o próximo. É acaso para quem
 * olha de fora e é estável para o laço.
 *
 * O algoritmo é o hash de string do Java (`h * 31 + char`), que não
 * serve para criptografia e aqui não precisa servir: o que se pede dele
 * é espalhar sete valores, não resistir a ataque.
 */
function sorteioEstavel(semente: string): number {
  let h = 0;
  for (let i = 0; i < semente.length; i++) {
    h = (Math.imul(h, 31) + semente.charCodeAt(i)) | 0;
  }

  /*
    O EMBARALHAMENTO FINAL, E ELE NÃO É ENFEITE.

    MEDIDO EM 11/08, ao alargar a faixa: doze sorteios seguidos com
    sementes vizinhas devolveram `14, 14, 18, 18, 18, 18, 18, 18…`. O
    hash do Java espalha o suficiente para escolher entre sete valores,
    que era a faixa de 4 a 10, e não espalha para quinze.

    O motivo é o de sempre nesse hash: os bits altos, que são os que a
    divisão usa, mudam pouco quando a semente muda pouco — e as nossas
    sementes são vizinhas de propósito, porque carregam um instante em
    milissegundos.

    E um intervalo que se repete é exatamente o que o dono proibiu, em
    maiúscula: *"NUNCA SER HORARIO EXATOOOOOOO, ISSO TEM CARA DE ROBO"*.
    Sorteio que devolve 18 doze vezes é horário exato com outro nome.

    O finalizador abaixo é o do MurmurHash3: três deslocamentos com
    multiplicação, que levam a diferença de um bit na entrada para
    metade dos bits na saída. Continua determinístico, que é o que o
    laço do publicador exige.
  */
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;

  return (h >>> 0) / 4294967296;
}

/**
 * O intervalo do WhatsApp: um inteiro de 4 a 10, inclusive nas pontas.
 *
 * A semente é `canalId|instanteDoUltimoPost`, montada por quem chama.
 */
export function intervaloDoWhatsAppEmMinutos(semente: string, porHora?: number): number {
  const { min, max } = faixaDoWhatsApp(porHora);
  const faixas = max - min + 1;
  const sorteado = Math.floor(sorteioEstavel(semente) * faixas);
  // O `min` protege da borda em que o sorteio devolve exatamente 1.
  return min + Math.min(sorteado, faixas - 1);
}

/**
 * A faixa de sorteio para uma taxa de posts por hora.
 *
 * POR QUE A FAIXA DEIXOU DE SER FIXA, e o pedido do dono em 11/08 é a
 * explicação inteira. A regra antiga era 4 a 10 minutos cravado, e com
 * ela o canal fazia os posts do dia em duas horas e emudecia: às 14h29
 * de 11/08 o Radar Delas estava parado desde 12h21, com a cota do dia
 * gasta. **Intervalo curto com teto diário não é ritmo, é rajada.**
 *
 * Então o intervalo passa a sair da taxa: 3 por hora quer dizer um a
 * cada 20 minutos, e a faixa é 20 mais ou menos 35%.
 *
 *     3 por hora   ->  13 a 27 min
 *     5 por hora   ->   8 a 16 min
 *    10 por hora   ->   4 a  8 min
 *
 * E repare onde a rampa termina: a 10 por hora a faixa volta a ser
 * praticamente a de 4 a 10 da regra original. O ritmo de operação é o
 * mesmo de sempre; o que mudou é o caminho até ele.
 *
 * OS 35% NÃO SÃO ENFEITE. Palavras do dono, em maiúscula:
 * *"LEMBRA DE NUNCA SER HORARIO EXATOOOOOOO, ISSO TEM CARA DE ROBO, TEM
 * QUE SER IMPREVISIVEL"*. Uma faixa larga o bastante para o intervalo
 * nunca se repetir é o que separa isto de um cron.
 *
 * O piso de 4 minutos continua de pé em qualquer taxa: abaixo disso é
 * padrão de disparo em massa, e essa ponta nunca foi negociada.
 */
export function faixaDoWhatsApp(porHora?: number): { min: number; max: number } {
  if (!porHora || porHora <= 0) {
    return { min: WHATSAPP_INTERVALO_MIN, max: WHATSAPP_INTERVALO_MAX };
  }
  const alvo = 60 / porHora;
  const min = Math.max(WHATSAPP_INTERVALO_MIN, Math.round(alvo * 0.65));
  const max = Math.max(min + 1, Math.round(alvo * 1.35));
  return { min, max };
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
  /**
   * Preenchido = canal de WhatsApp, e aí vale a janela de 4 a 10 min em
   * vez da faixa do dia. Nulo = Telegram, o comportamento de sempre.
   */
  whatsapp: { canalId: string; porHora?: number } | null = null,
): Veredito {
  const faixa = faixaDaHora(horaEmSaoPaulo(agora));

  // Canal que nunca publicou não espera nada: o primeiro post é o que
  // tira o canal do zero. Vale para os dois — a regra dos 4 minutos é
  // sobre a distância ENTRE promos, e aqui não existe a de trás.
  if (!ultimaPublicacaoEm) return { pode: true };

  const intervalo = whatsapp
    ? intervaloDoWhatsAppEmMinutos(`${whatsapp.canalId}|${ultimaPublicacaoEm.getTime()}`, whatsapp.porHora)
    : intervaloEmMinutos(faixa, ritmo);

  const passados = (agora.getTime() - ultimaPublicacaoEm.getTime()) / 60_000;
  if (passados >= intervalo) return { pode: true };

  const faltam = Math.ceil(intervalo - passados);
  return {
    pode: false,
    motivo: whatsapp
      ? `whatsapp: sorteou ${intervalo} min para esta promo, faltam ${faltam}`
      : `faixa ${faixa}: um post a cada ${intervalo} min, faltam ${faltam}`,
    faltamMinutos: faltam,
  };
}

/**
 * O CHIP pode falar agora?
 *
 * Vale AO LADO de `podePublicarAgora`, não no lugar dela. O canal tem
 * ritmo por causa da audiência; o chip tem o dele por causa do número,
 * e é o número que cai.
 *
 * O CASO QUE ISTO CONSERTA são oito grupos num chip só. O intervalo
 * conferido apenas contra `canal.ultima_publicacao_em` dá a cada canal
 * um relógio próprio, e todos podem estar liberados no mesmo instante.
 * O laço publica um por vez, mas em sequência: canal A às 12:00:00,
 * canal B às 12:00:06, canal C às 12:00:12. Do lado do WhatsApp, é um
 * número mandando oito mensagens em menos de um minuto para oito
 * grupos diferentes — o padrão de disparo em massa, com cada canal
 * tendo respeitado a própria regra.
 *
 * A semente do sorteio é o bot e o instante do último envio dele, pela
 * mesma razão do sorteio por canal: chamada de novo a cada volta do
 * laço, uma semente nova faria o intervalo real virar o maior sorteio
 * da espera, estourando os 10 minutos sem levantar erro.
 */
export function podeChipFalarAgora(
  agora: Date,
  ultimoEnvioDoChip: Date | null,
  botId: string,
  /** A taxa do dia do aquecimento. Ver `faixaDoWhatsApp`. */
  porHora?: number,
): Veredito {
  // Chip que ainda não falou hoje não espera: a regra é sobre a
  // distância ENTRE envios, e aqui não existe o de trás.
  if (!ultimoEnvioDoChip) return { pode: true };

  const intervalo = intervaloDoWhatsAppEmMinutos(
    `chip:${botId}|${ultimoEnvioDoChip.getTime()}`,
    porHora,
  );
  const passados = (agora.getTime() - ultimoEnvioDoChip.getTime()) / 60_000;
  if (passados >= intervalo) return { pode: true };

  const faltam = Math.ceil(intervalo - passados);
  return {
    pode: false,
    motivo: `chip: sorteou ${intervalo} min entre envios, faltam ${faltam}`,
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

  // A conta da tela ignora o jitter, e é por isso que o sorteio aqui é
  // fixo em zero: número que muda a cada carregamento da página, sem
  // nada ter mudado, faz quem lê desconfiar da tela inteira. O jitter
  // só encurta, então este número é o piso — cabem estes ou mais.
  const semSorteio = () => 0;

  for (let h = hora; h < 24; h++) {
    const minutosDaHora = h === hora ? 60 - minutoAtual : 60;
    total += minutosDaHora / intervaloEmMinutos(faixaDaHora(h), ritmo, semSorteio);
  }

  return Math.floor(total);
}

/**
 * A BORDA DO DIA, SORTEADA — abrir e fechar sem hora cheia.
 *
 * `horarios_permitidos` é uma lista de HORAS, então o canal abria às
 * 09:00:00 e fechava às 21:59 cravado, todo dia igual. Pedido do dono
 * em 11/08, e ele foi específico:
 *
 *   *"pare todo dia às 21h e volte às 09h, ok? nao EXATAMENTEEEEEE, É
 *   RANDOMIZADO, pode ser 20:57, 21:07, o prazo maximo é 21:11 e o
 *   minimo é 09:07"*
 *
 * É a mesma exigência do intervalo entre posts, aplicada à borda: o
 * primeiro e o último post do dia são os dois mais fáceis de cronometrar
 * de fora, e hora cheia todo dia é assinatura de agendador.
 *
 * AS FOLGAS SAEM DOS NÚMEROS QUE ELE DEU. Sobre a primeira hora
 * permitida, de 7 a 21 minutos depois; sobre a última, de 3 minutos
 * antes a 11 depois. Com a lista de 9 a 21 isso dá exatamente o que ele
 * pediu: abre entre 09:07 e 09:21, fecha entre 20:57 e 21:11.
 *
 * O SORTEIO É ESTÁVEL POR DIA, e isso não é detalhe. O publicador
 * pergunta "posso agora?" muitas vezes por hora; com sorteio novo a
 * cada pergunta a borda andaria para frente e para trás, e o canal
 * fecharia e reabriria sozinho. A semente carrega o dia, então a borda
 * é uma só do começo ao fim e muda na virada.
 */
const ABERTURA_FOLGA_MIN = 7;
const ABERTURA_FOLGA_MAX = 21;
const FECHAMENTO_FOLGA_MIN = -3;
const FECHAMENTO_FOLGA_MAX = 11;

export type BordaDoDia = { abreEmMinutos: number; fechaEmMinutos: number };

/**
 * A borda de hoje para este canal, em minutos desde a meia-noite de
 * São Paulo.
 *
 * `horas` é o `horarios_permitidos` do canal. Lista vazia devolve nulo,
 * que quer dizer "sem restrição" — a mesma leitura que o publicador já
 * fazia, e a diferença importa: canal com a coluna zerada à mão
 * emudeceria para sempre.
 *
 * Lista com buraco no meio (7, 12, 20) não é tratada como três janelas:
 * a borda sai da MENOR e da MAIOR hora, e as horas do meio continuam
 * valendo pela lista. A borda só decide as pontas do dia.
 */
export function bordaDoDia(horas: number[] | null | undefined, semente: string): BordaDoDia | null {
  if (!Array.isArray(horas) || horas.length === 0) return null;

  const primeira = Math.min(...horas);
  const ultima = Math.max(...horas);

  const folga = (min: number, max: number, sufixo: string) => {
    const faixas = max - min + 1;
    const sorteado = Math.floor(sorteioEstavel(`${semente}|${sufixo}`) * faixas);
    return min + Math.min(sorteado, faixas - 1);
  };

  return {
    abreEmMinutos: primeira * 60 + folga(ABERTURA_FOLGA_MIN, ABERTURA_FOLGA_MAX, "abre"),
    fechaEmMinutos: ultima * 60 + folga(FECHAMENTO_FOLGA_MIN, FECHAMENTO_FOLGA_MAX, "fecha"),
  };
}

/** Minutos desde a meia-noite de São Paulo. */
export function minutosEmSaoPaulo(agora: Date): number {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/**
 * O canal está dentro da janela de hoje?
 *
 * Devolve `true` quando não há restrição, pela mesma razão de sempre:
 * ausência de configuração não pode virar silêncio permanente.
 */
export function dentroDaJanelaDoDia(
  horas: number[] | null | undefined,
  canalId: string,
  agora: Date,
): boolean {
  const borda = bordaDoDia(horas, `${canalId}|${diaEmSaoPaulo(agora)}`);
  if (!borda) return true;
  const agoraMin = minutosEmSaoPaulo(agora);
  return agoraMin >= borda.abreEmMinutos && agoraMin <= borda.fechaEmMinutos;
}
