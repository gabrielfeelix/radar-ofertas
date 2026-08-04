/**
 * Teste da classificação de falha de link.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede.
 *
 * POR QUE ELE EXISTE. Esta função decide se uma publicação morre ou
 * volta a tentar, e os dois erros custam caro em direções opostas:
 * classificar de menos deixa o item batendo no painel da Central para
 * sempre (o defeito medido em 04/08), e classificar de mais some com
 * oferta boa sem ninguém saber.
 *
 * As mensagens abaixo são as REAIS, copiadas do log do Actions e da
 * resposta do gerador. Inventar mensagem de erro aqui seria testar a
 * minha imaginação.
 */

import { classificaFalhaDeLink } from "../lib/falha-de-link.ts";

let passou = 0;
let falhou = 0;

function confere(nome, condicao) {
  if (condicao) {
    passou += 1;
    console.log(`✓ ${nome}`);
  } else {
    falhou += 1;
    console.error(`✗ ${nome}`);
  }
}

console.log("\nclassificação de falha de link\n");

// -------------------------------------------------------------
// Permanente — a URL não é aceita, e isso não muda amanhã
// -------------------------------------------------------------

// Literal do log de 04/08, 7 a 11 vezes por rodada, o dia inteiro.
confere(
  "URL recusada pelo programa é permanente",
  classificaFalhaDeLink({ motivo: "URL not allowed in affiliates program" }) === "permanente",
);
confere(
  "e a caixa da mensagem não importa",
  classificaFalhaDeLink({ motivo: "url not allowed in affiliates program" }) === "permanente",
);
// Estas duas vêm de `montaLinkDeAfiliado`, no caminho da Amazon e da
// Shopee. A classificação é a mesma para não haver duas verdades.
confere(
  "URL inválida do anúncio também é permanente",
  classificaFalhaDeLink({ motivo: "a URL do anúncio é inválida" }) === "permanente",
);
confere(
  "anúncio sem URL também",
  classificaFalhaDeLink({ motivo: "o anúncio não tem URL" }) === "permanente",
);

/*
  E o contraveneno da regex: falta de variável de ambiente é deploy, e
  volta a funcionar sem ninguém mexer no banco.
*/
confere(
  "falta de configuração NÃO é permanente",
  classificaFalhaDeLink({ motivo: "falta AFILIADO_SHOPEE — sai sem comissão" }) === "transitorio",
);

/*
  O falso positivo que a lista literal existe para impedir. Uma regex
  com "inválid" solto casaria aqui, e o efeito seria apagar a fila
  inteira toda vez que o cookie da Central expirasse.
*/
confere(
  "sessão inválida continua transitória",
  classificaFalhaDeLink({ motivo: "sessao_da_central: sessão inválida" }) === "transitorio",
);

// -------------------------------------------------------------
// Canal — cadastro da etiqueta, vale para a fila inteira dele
// -------------------------------------------------------------

// Resposta literal do gerador, testada com etiqueta inventada.
confere(
  "etiqueta não cadastrada é problema do canal",
  classificaFalhaDeLink({
    motivo: "Tag is not associated with this affiliate.",
    codigo: 109,
  }) === "canal",
);
confere(
  "o código 109 basta, mesmo sem a mensagem",
  classificaFalhaDeLink({ codigo: 109 }) === "canal",
);
confere(
  "a mensagem basta, mesmo sem o código",
  classificaFalhaDeLink({ motivo: "Tag is not associated with this affiliate." }) === "canal",
);

// -------------------------------------------------------------
// Transitório — o padrão, e é o padrão de propósito
// -------------------------------------------------------------

confere(
  "sessão expirada volta a tentar",
  classificaFalhaDeLink({ motivo: "sessao_da_central: HTTP 401" }) === "transitorio",
);
confere(
  "sessão que devolve HTML também",
  classificaFalhaDeLink({
    motivo: "sessao_da_central: resposta não é JSON (sessão expirada?)",
  }) === "transitorio",
);
confere(
  "erro de rede volta a tentar",
  classificaFalhaDeLink({ motivo: "fetch failed" }) === "transitorio",
);
confere(
  "resposta vazia volta a tentar",
  classificaFalhaDeLink({ motivo: "gerador não devolveu nada" }) === "transitorio",
);

/*
  O DESCONHECIDO PASSA, e esta é a decisão de desenho mais importante
  do arquivo. Mensagem que ninguém previu não pode matar publicação:
  o custo de tentar de novo é uma chamada, e o de encerrar por engano é
  uma oferta boa que some sem explicação.
*/
confere(
  "mensagem desconhecida é transitória",
  classificaFalhaDeLink({ motivo: "algo que ninguém viu ainda" }) === "transitorio",
);
confere("falha sem motivo é transitória", classificaFalhaDeLink({}) === "transitorio");
confere("falha nula é transitória", classificaFalhaDeLink(null) === "transitorio");
confere("falha ausente é transitória", classificaFalhaDeLink() === "transitorio");

/*
  E o código 109 ganha da mensagem de URL, se as duas viessem juntas:
  etiqueta errada é consertável e não pode virar encerramento.
*/
confere(
  "código de canal ganha de mensagem de URL",
  classificaFalhaDeLink({ motivo: "URL not allowed", codigo: 109 }) === "canal",
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
