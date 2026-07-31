/**
 * Os horários em que vale publicar.
 *
 * Vindos da pesquisa de operação (`docs/pesquisa-operacao.md`): os
 * picos de engajamento em WhatsApp e Telegram no Brasil são
 * **07h–09h, 12h–13h e 19h–22h**, e fora deles o engajamento cai
 * bastante.
 *
 * ISTO CORRIGE UM ERRO NOSSO. O formulário de canal sugeria
 * "09:00 e 18:00" como exemplo, e **as 18h estão fora dos três
 * picos** — é o fim da tarde, entre o almoço e a noite, provavelmente
 * o pior horário do dia útil. Sugestão errada em campo de exemplo é
 * pior que campo vazio: ela vira o padrão de quem não tem opinião.
 *
 * E são três, não um: publicar mais de uma vez por dia faz a pessoa
 * ver a notificação mais de uma vez. Concentrar tudo num disparo
 * desperdiça dois dos três picos.
 */

export type Pico = { inicio: string; fim: string; nome: string; porque: string };

export const PICOS: Pico[] = [
  {
    inicio: "07:00",
    fim: "09:00",
    nome: "manhã",
    porque: "trajeto e primeira olhada no telefone",
  },
  {
    inicio: "12:00",
    fim: "13:00",
    nome: "almoço",
    porque: "a janela mais curta, e a mais concorrida",
  },
  {
    inicio: "19:00",
    fim: "22:00",
    nome: "noite",
    porque: "a mais longa, e a de maior intenção de compra",
  },
];

/** O que um canal novo recebe. Um horário dentro de cada pico. */
export const HORARIOS_SUGERIDOS = "07:30, 12:30 e 20:00";

/**
 * O horário cai dentro de algum pico?
 *
 * Comparação de texto `HH:MM`, que ordena igual a relógio — sem
 * precisar de data, fuso ou biblioteca. Os horários do canal são no
 * fuso de São Paulo (regra 3.9).
 */
export function estaEmPico(hora: string): boolean {
  return PICOS.some((p) => hora >= p.inicio && hora <= p.fim);
}

/**
 * Lê os horários que o dono digitou.
 *
 * O campo é texto livre de propósito — "07:30, 12:30 e 20:00" é como
 * uma pessoa escreve. Extrair com expressão regular aceita vírgula,
 * "e", ponto e vírgula ou espaço, sem obrigar ninguém a decorar
 * formato.
 */
export function leHorarios(texto: string): string[] {
  return [...texto.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map(
    (m) => `${m[1].padStart(2, "0")}:${m[2]}`,
  );
}

/** Os que estão fora de todos os picos. Vazio = tudo bem. */
export function foraDePico(texto: string): string[] {
  return leHorarios(texto).filter((h) => !estaEmPico(h));
}
