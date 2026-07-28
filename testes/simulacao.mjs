/**
 * Teste da máquina de estados da operação simulada.
 *
 * Roda com `pnpm testa`. Sem banco, sem rede, sem Docker.
 *
 * Por que existe: é aqui que mora a regra do fluxo de decidir e
 * publicar — aprovar gera uma publicação por canal elegível, preço
 * mudado bloqueia envio, desfazer volta ao estado anterior. Errar
 * qualquer uma dessas produz tela que parece certa e conta história
 * errada para quem estiver testando o fluxo.
 *
 * Quando o backend entrar, este teste continua valendo: ele descreve
 * o comportamento esperado, não a implementação simulada.
 */

import {
  alternaCanalAtivo,
  atualizaCanal,
  buscaCanal,
  canais,
  canaisElegiveis,
  criaCanal,
  parteDoDono,
  decideOferta,
  desfazDecisao,
  desfazEnvio,
  marcaEnviada,
  ofertasDaFila,
  publicacoesDaFila,
  publicacoesSeAprovarTudo,
  vagasDeHoje,
} from "../lib/simulacao/loja.ts";

let falhas = 0;

function confere(nome, condicao, detalhe = "") {
  if (condicao) {
    console.log(`✓ ${nome}`);
  } else {
    console.error(`✗ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
    falhas++;
  }
}

// --- A fila nasce com volume -----------------------------------
// Fila curta esconde o problema que a tela existe para resolver, que
// é decidir depressa em volume.
const fila = ofertasDaFila();
confere("a fila tem volume suficiente para testar", fila.length >= 10, `tem ${fila.length}`);
confere(
  "toda oferta da fila tem status nova",
  fila.every((o) => o.status === "nova"),
);

// --- Lastro de preço -------------------------------------------
// Regra 3.4: sem 14 dias de série, nada de afirmar mínimo histórico.
confere(
  "afirmar mínimo exige 14 dias de série",
  fila.every((o) => o.podeAfirmarMinimo === o.diasDeSerie >= 14),
);
confere(
  "o desconto bate com a referência",
  fila.every(
    (o) =>
      o.descontoPct ===
      Math.round(((o.precoReferenciaCentavos - o.precoAtualCentavos) / o.precoReferenciaCentavos) * 100),
  ),
);

// --- A nota é a soma das parcelas ------------------------------
confere(
  "a nota é a soma das três parcelas",
  fila.every((o) => o.nota === o.parcelas.desconto + o.parcelas.comissao + o.parcelas.vendedor),
);
confere(
  "cada parcela respeita o teto da escala",
  fila.every(
    (o) => o.parcelas.desconto <= 50 && o.parcelas.comissao <= 30 && o.parcelas.vendedor <= 20,
  ),
);

// --- Capacidade -------------------------------------------------
confere("existe vaga em algum canal", vagasDeHoje() > 0);
confere(
  "publicações previstas somam os canais elegíveis de cada oferta",
  publicacoesSeAprovarTudo() ===
    fila.reduce((total, o) => total + canaisElegiveis(o.nicho).length, 0),
);

// --- Aprovar é um ato, não quinze ------------------------------
const alvo = fila[0];
const elegiveis = canaisElegiveis(alvo.nicho);
decideOferta(alvo.id, { status: "aprovada", canais: elegiveis.map((c) => c.id) });

const geradas = publicacoesDaFila().filter((p) => p.ofertaId === alvo.id);
confere(
  "aprovar gera uma publicação por canal elegível",
  geradas.length === elegiveis.length,
  `gerou ${geradas.length} para ${elegiveis.length} canais`,
);
confere(
  "cada publicação leva um subid diferente",
  new Set(geradas.map((p) => p.subid)).size === geradas.length,
);
confere(
  "a oferta aprovada sai da fila de decisão",
  !ofertasDaFila().some((o) => o.id === alvo.id),
);

// --- Preço mudado bloqueia o envio -----------------------------
// A oferta o5 tem preço diferente do que entrou na fila, de
// propósito: publicar preço morto queima o canal igual a preço falso.
decideOferta("o5", { status: "aprovada", canais: canaisElegiveis("pet").map((c) => c.id) });
const bloqueadas = publicacoesDaFila().filter(
  (p) => p.precoAgoraCentavos !== p.precoNaFilaCentavos,
);
confere("existe publicação com preço mudado", bloqueadas.length > 0);
confere(
  "só a oferta marcada tem preço divergente",
  bloqueadas.every((p) => p.ofertaId === "o5"),
);

// --- Enviar e desfazer -----------------------------------------
const paraEnviar = geradas[0];
marcaEnviada(paraEnviar.id, "fluxo");
confere(
  "publicação enviada guarda a origem",
  publicacoesDaFila().find((p) => p.id === paraEnviar.id)?.origem === "fluxo",
);

marcaEnviada(geradas[1] ? geradas[1].id : paraEnviar.id, "auto_declarada");
confere(
  "origem auto-declarada fica separada da do fluxo",
  publicacoesDaFila().some((p) => p.origem === "auto_declarada"),
);

desfazEnvio(paraEnviar.id);
confere(
  "desfazer o envio devolve a publicação para a fila",
  publicacoesDaFila().find((p) => p.id === paraEnviar.id)?.enviadaEm === null,
);

// --- Desfazer a decisão ----------------------------------------
desfazDecisao(alvo.id);
confere(
  "desfazer a aprovação devolve a oferta para a fila",
  ofertasDaFila().some((o) => o.id === alvo.id),
);
confere(
  "e some com as publicações que ela tinha gerado",
  !publicacoesDaFila().some((p) => p.ofertaId === alvo.id),
);

// --- Canais -----------------------------------------------------
// A parte do dono é o que sobra das duas parcelas, e não um terceiro
// campo — senão existiria o estado em que os três somam 97.
confere(
  "a parte do dono fecha em 100 com as duas parcelas",
  canais().every((c) => parteDoDono(c) + c.splitAudienciaPct + c.splitOperacaoPct === 100),
);

// Canal desligado para de receber publicação AGORA. Se continuasse
// elegível até a próxima detecção, uma oferta aprovada no meio do
// caminho iria para um canal que o dono achava que tinha desligado.
const canalPet = canais().find((c) => c.nichos.includes("pet") && c.ativo);
alternaCanalAtivo(canalPet.id, false);
confere(
  "canal desligado sai da elegibilidade na hora",
  !canaisElegiveis("pet").some((c) => c.id === canalPet.id),
);
confere(
  "e continua existindo, com o histórico dele",
  buscaCanal(canalPet.id) !== undefined,
);

const vagasSemEle = vagasDeHoje();
alternaCanalAtivo(canalPet.id, true);
confere("religar devolve a capacidade", vagasDeHoje() > vagasSemEle);

// Canal novo entra na capacidade e no roteamento do próprio nicho.
const novoId = criaCanal({
  nome: "Teste de Canal",
  plataforma: "telegram",
  nichos: ["eletronico"],
  tetoDiario: 5,
  audiencia: 100,
  parceiro: "você",
  operador: "você",
  splitAudienciaPct: 20,
  splitOperacaoPct: 10,
  horarios: "12:00",
});
confere(
  "canal novo passa a receber oferta do nicho dele",
  canaisElegiveis("eletronico").some((c) => c.id === novoId),
);
confere("canal novo nasce sem nada publicado", buscaCanal(novoId).publicadasHoje === 0);
confere("e a parte do dono dele é o que sobra", parteDoDono(buscaCanal(novoId)) === 70);

atualizaCanal(novoId, {
  ...buscaCanal(novoId),
  nichos: ["pet"],
});
confere(
  "trocar o nicho muda o roteamento",
  canaisElegiveis("pet").some((c) => c.id === novoId) &&
    !canaisElegiveis("eletronico").some((c) => c.id === novoId),
);

console.log(`\n${falhas === 0 ? "todos os casos passaram" : `${falhas} casos falharam`}`);
if (falhas > 0) process.exit(1);
