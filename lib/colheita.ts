/**
 * O valor que o formulário de fonte manda quando o canal é genérico.
 *
 * Mora aqui, e não junto da ação, por uma restrição do Next: arquivo
 * marcado com `"use server"` só pode exportar função assíncrona.
 * Exportar uma constante dele quebra em tempo de execução, e não na
 * verificação de tipos — foi assim que passou.
 *
 * Não é string vazia: vazio é o campo não preenchido, e distinguir os
 * dois é o que permite exigir uma escolha sem proibir "misto".
 */
export const MISTO = "misto";
