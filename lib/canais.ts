/**
 * Leitor do identificador de um canal do Telegram.
 *
 * O dono vai colar o canal do jeito que ele apareceu: `@ofertas`,
 * `t.me/ofertas`, `https://t.me/s/ofertas`, ou só `ofertas`. Todos
 * são o mesmo canal, e o banco tem índice único em
 * (operacao, plataforma, identificador) — se cada forma virasse uma
 * linha, o mesmo canal seria lido quatro vezes e o rendimento de
 * cada um apareceria dividido por quatro.
 *
 * Função pura sobre texto: não faz requisição e não confere se o
 * canal existe. Quem descobre isso é a primeira leitura.
 */

export type LeituraDeCanal =
  | { ok: true; identificador: string }
  | { ok: false; mensagem: string };

/**
 * Regra do Telegram: 5 a 32 caracteres, letras, números e
 * sublinhado, começando por letra. Não validamos o começo por
 * letra — canais antigos fogem disso — mas o resto vale.
 */
const FORMATO_VALIDO = /^[A-Za-z0-9_]{4,32}$/;

/** Prefixos de link que envolvem o identificador e não fazem parte dele. */
const PREFIXOS = [
  "https://t.me/s/",
  "http://t.me/s/",
  "https://t.me/",
  "http://t.me/",
  "https://telegram.me/",
  "http://telegram.me/",
  "t.me/s/",
  "t.me/",
  "telegram.me/",
];

export function leIdentificadorDeCanal(entrada: string): LeituraDeCanal {
  let texto = entrada.trim();

  if (texto === "") {
    return { ok: false, mensagem: "Escreva o canal, com ou sem @." };
  }

  for (const prefixo of PREFIXOS) {
    if (texto.toLowerCase().startsWith(prefixo)) {
      texto = texto.slice(prefixo.length);
      break;
    }
  }

  // Query e âncora sobram quando o link vem copiado do navegador.
  texto = texto.split(/[?#]/)[0];
  // Barra final, e qualquer caminho depois do canal (post individual,
  // que não é o canal).
  texto = texto.replace(/\/.*$/, "");
  texto = texto.replace(/^@/, "").trim();

  if (texto === "") {
    return { ok: false, mensagem: "Não achei o nome do canal nesse endereço." };
  }

  // Convite de canal privado. Não é identificador público, e a
  // leitura por conta de usuário ainda não existe.
  if (/^\+/.test(texto) || texto.toLowerCase() === "joinchat") {
    return {
      ok: false,
      mensagem:
        "Isso é convite de canal privado. Só lemos canal público — o link precisa ser t.me/nome.",
    };
  }

  if (!FORMATO_VALIDO.test(texto)) {
    return {
      ok: false,
      mensagem: "Nome de canal inválido. Use só letras, números e sublinhado.",
    };
  }

  return { ok: true, identificador: texto };
}

/** Endereço da versão pública do canal — a mesma que a colheita lê. */
export function enderecoPublico(identificador: string): string {
  return `https://t.me/s/${identificador}`;
}
