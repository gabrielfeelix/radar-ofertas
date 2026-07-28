/**
 * Teste do leitor de identificador de canal.
 *
 * Roda com `pnpm testa`. Função pura sobre texto: sem banco, sem
 * Docker, sem rede.
 *
 * Por que existe: o banco tem índice único em
 * (operação, plataforma, identificador). Se `@ofertas`, `t.me/ofertas`
 * e `https://t.me/s/ofertas` virassem linhas diferentes, o mesmo
 * canal seria lido três vezes e o rendimento apareceria dividido —
 * um canal bom pareceria medíocre, e isso não daria erro nenhum.
 */

import { leIdentificadorDeCanal } from "../lib/canais.ts";

const casos = [
  { nome: "nome puro", entrada: "ofertas_pet", identificador: "ofertas_pet" },
  { nome: "com arroba", entrada: "@ofertas_pet", identificador: "ofertas_pet" },
  { nome: "t.me", entrada: "t.me/ofertas_pet", identificador: "ofertas_pet" },
  { nome: "t.me/s (o que a colheita lê)", entrada: "https://t.me/s/ofertas_pet", identificador: "ofertas_pet" },
  { nome: "https com barra final", entrada: "https://t.me/ofertas_pet/", identificador: "ofertas_pet" },
  { nome: "link de post individual", entrada: "https://t.me/ofertas_pet/1423", identificador: "ofertas_pet" },
  { nome: "com query do navegador", entrada: "https://t.me/ofertas_pet?embed=1", identificador: "ofertas_pet" },
  { nome: "telegram.me", entrada: "https://telegram.me/ofertas_pet", identificador: "ofertas_pet" },
  { nome: "espaço em volta", entrada: "  @ofertas_pet  ", identificador: "ofertas_pet" },
  { nome: "maiúsculas preservadas", entrada: "@OfertasPet", identificador: "OfertasPet" },

  // Recusas ------------------------------------------------------
  { nome: "vazio", entrada: "   ", falha: true },
  { nome: "convite privado", entrada: "https://t.me/+AbCdEf123", falha: true },
  { nome: "joinchat antigo", entrada: "https://t.me/joinchat/AbCdEf", falha: true },
  { nome: "caractere inválido", entrada: "@ofertas-pet", falha: true },
  { nome: "curto demais", entrada: "@abc", falha: true },
];

let falhas = 0;

for (const caso of casos) {
  const resultado = leIdentificadorDeCanal(caso.entrada);

  if (caso.falha) {
    if (resultado.ok) {
      console.error(`✗ ${caso.nome}: aceitou "${caso.entrada}", devia recusar`);
      falhas++;
    } else {
      console.log(`✓ ${caso.nome}`);
    }
    continue;
  }

  if (!resultado.ok) {
    console.error(`✗ ${caso.nome}: recusou "${caso.entrada}" — ${resultado.mensagem}`);
    falhas++;
  } else if (resultado.identificador !== caso.identificador) {
    console.error(
      `✗ ${caso.nome}: leu "${resultado.identificador}", esperava "${caso.identificador}"`,
    );
    falhas++;
  } else {
    console.log(`✓ ${caso.nome}`);
  }
}

console.log(`\n${casos.length - falhas}/${casos.length} casos de canal`);

if (falhas > 0) process.exit(1);
