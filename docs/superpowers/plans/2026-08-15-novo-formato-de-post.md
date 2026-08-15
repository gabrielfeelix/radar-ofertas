# Novo formato de post do Radar Delas

> **Para quem executa:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans` para tocar tarefa a tarefa. Os passos usam
> caixa (`- [ ]`) para marcar o que já saiu.

**Objetivo:** trocar o post do Radar Delas pelo formato que o dono aprovou em
15/08: título curto, descrição de gente escrita por IA, lastro por faixa de
tempo, e o bloco de preço colado.

**Abordagem:** o motor da mensagem não muda. O que muda é (a) o texto do
modelo no banco, (b) o que a IA escreve e o que a validação recusa, e (c) dois
campos novos que o publicador passa a preencher. Nada disso toca curadoria,
detecção ou envio.

**Stack:** TypeScript, Node com `--experimental-strip-types`, Postgres via
migrations do Supabase, Gemini (`gemini-3.5-flash-lite`) para as duas tarefas
de IA. Testes em `testes/*.mjs`, sem banco e sem rede.

**Spec:** `docs/superpowers/specs/2026-08-15-novo-formato-de-post-design.md`

## Restrições que valem para todas as tarefas

- **Regra 3.5:** dinheiro é `INTEGER` em centavos. Nunca `float`.
- **Regra 3.11:** nada de `—` nem `–` em texto que o público lê.
- **Regra 3.4:** nenhuma linha afirma mínimo histórico sem a série sustentar.
  A faixa de 30 dias da spec é mais conservadora que os 14 da regra, e é ela
  que vale.
- **Migration nunca se altera depois de aplicada.** Cria outra.
- **Mexeu no texto do modelo no banco, mexa no `RESERVA`** de
  `lib/modelo.ts:22`. Eles já divergiram uma vez, em 10/08.
- **Só o canal `1b22b636` (Radar Delas, WhatsApp)** muda. Os outros oito
  ficam como estão.
- Código, tabelas e commits em português.
- Falha de IA nunca cala o canal: sem chave, sem cota ou com resposta
  reprovada, o post sai com o texto original.

---

### Tarefa 1: A faixa de tempo do lastro

Uma função pura que recebe a idade da série e devolve a linha. Pura porque é
onde a regra 3.4 vira código, e é o que dá para testar sem banco.

**Arquivos:**
- Criar: `lib/lastro.ts`
- Testar: `testes/lastro.mjs`
- Modificar: `package.json` (somar `testes/lastro.mjs` ao script `testa`)

**Interfaces:**
- Produz: `faixaDoLastro(dias: number | null, quedaPct: number | null): FaixaDeLastro`
  onde `type FaixaDeLastro = "historico" | "mes" | "semana" | "dias" | "ontem" | "hoje" | "queda" | "nenhuma"`

- [ ] **Passo 1: escrever o teste que falha**

```javascript
// testes/lastro.mjs
import { faixaDoLastro } from "../lib/lastro.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

confere("30 dias afirma histórico", faixaDoLastro(30, null) === "historico");
confere("29 dias não afirma histórico", faixaDoLastro(29, null) === "mes");
confere("14 dias é mês", faixaDoLastro(14, null) === "mes");
confere("13 dias é semana", faixaDoLastro(13, null) === "semana");
confere("7 dias é semana", faixaDoLastro(7, null) === "semana");
confere("6 dias é dias", faixaDoLastro(6, null) === "dias");
confere("2 dias é dias", faixaDoLastro(2, null) === "dias");
confere("1 dia é ontem", faixaDoLastro(1, null) === "ontem");
confere("0 dia é hoje", faixaDoLastro(0, null) === "hoje");
confere("série nula não afirma nada", faixaDoLastro(null, null) === "nenhuma");
confere("queda medida vence a idade da série", faixaDoLastro(30, 25) === "queda");
confere("queda de 0% não conta como queda", faixaDoLastro(5, 0) === "dias");
confere("dia negativo não quebra", faixaDoLastro(-1, null) === "nenhuma");

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) process.exit(1);
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/lastro.mjs`
Espera: erro de módulo não encontrado, `lib/lastro.ts`.

- [ ] **Passo 3: implementar**

```typescript
// lib/lastro.ts
/**
 * Qual linha de lastro a série sustenta.
 *
 * A REGRA 3.4 MORA AQUI. "Menor valor histórico" só sai com 30 dias de
 * série, e trinta é decisão do dono em 15/08, mais conservadora que os
 * 14 da regra. Abaixo disso a linha diz tempo decorrido, nunca data:
 * o dono pediu isso com todas as letras, e "desde 02/08" não diz nada
 * a quem lê.
 *
 * A QUEDA VENCE TODAS, e não é estética: ela é a única coisa que NÓS
 * medimos, entre duas leituras nossas. Nenhum canal que repassa oferta
 * alheia consegue dizer isso.
 *
 * MEDIDO EM 15/08, e vale saber antes de esperar o selo no grupo:
 * nenhuma oferta tinha 30 dias de série, porque a coleta começou em
 * agosto. 98% caíam em "dias" ou "ontem". O selo de histórico é
 * verdadeiro e raro de propósito.
 */
export type FaixaDeLastro =
  | "historico" | "mes" | "semana" | "dias" | "ontem" | "hoje" | "queda" | "nenhuma";

export function faixaDoLastro(
  dias: number | null,
  quedaPct: number | null,
): FaixaDeLastro {
  if (quedaPct !== null && quedaPct > 0) return "queda";
  if (dias === null || dias < 0) return "nenhuma";
  if (dias >= 30) return "historico";
  if (dias >= 14) return "mes";
  if (dias >= 7) return "semana";
  if (dias >= 2) return "dias";
  if (dias >= 1) return "ontem";
  return "hoje";
}
```

- [ ] **Passo 4: rodar e ver passar**

Roda: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/lastro.mjs`
Espera: `13 passaram, 0 falharam`.

- [ ] **Passo 5: somar ao `pnpm testa`**

Em `package.json`, no script `testa`, acrescentar após `testes/mensagem.mjs`:

```
 && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/lastro.mjs
```

- [ ] **Passo 6: commitar**

```bash
git add lib/lastro.ts testes/lastro.mjs package.json
git commit -m "a linha de lastro passa a falar de tempo decorrido, nao de data"
```

---

### Tarefa 2: As colunas de lastro no modelo

O modelo hoje tem `lastro_com`, `lastro_sem`, `lastro_queda` e
`lastro_declarado`. As faixas novas pedem três textos que não existem.

**Arquivos:**
- Criar: `supabase/migrations/20260815120000_lastro_por_faixa_de_tempo.sql`
- Modificar: `lib/supabase/tipos.ts` (a linha `ModeloMensagemLinha`)
- Modificar: `lib/mensagem.ts:423` (a escolha do molde, em `montaMensagem`)
- Modificar: `lib/modelo.ts:22` e `lib/modelo.ts:61` (o `RESERVA` e os `CAMPOS`)
- Testar: `testes/mensagem.mjs`

**Interfaces:**
- Consome: `faixaDoLastro` da Tarefa 1.
- Produz: `ModeloDeMensagem` ganha `lastroMes`, `lastroSemana`, `lastroHoje`.

- [ ] **Passo 1: escrever a migration**

```sql
-- supabase/migrations/20260815120000_lastro_por_faixa_de_tempo.sql
--
-- A LINHA DE LASTRO DEIXA DE DIZER DATA E PASSA A DIZER TEMPO.
--
-- Decisão do dono em 15/08: "não precisa colocar exatamente desde o dia
-- dois". Data específica não diz nada a quem lê o grupo; tempo decorrido
-- diz. As faixas vivem em lib/lastro.ts, porque são regra e não texto.
--
-- TRINTA DIAS PARA AFIRMAR HISTÓRICO, e é mais duro que os 14 da regra
-- 3.4. Também é do dono, e fica.
alter table public.modelo_mensagem
  add column if not exists lastro_mes     text not null default '🔥 <b>Menor preço do último mês</b>',
  add column if not exists lastro_semana  text not null default '📉 <b>Menor preço da semana</b>',
  add column if not exists lastro_hoje    text not null default '⚡ <b>Baixou de novo hoje</b>';

comment on column public.modelo_mensagem.lastro_mes is
  'Série de 14 a 29 dias. Não afirma histórico.';
comment on column public.modelo_mensagem.lastro_semana is
  'Série de 7 a 13 dias.';
comment on column public.modelo_mensagem.lastro_hoje is
  'Preço caiu de novo no mesmo dia. Só existe com releitura intradiária.';

-- O texto do canal Radar Delas (WhatsApp). Só ele muda agora.
update public.modelo_mensagem
   set lastro_com  = '🔥 <b>Menor valor histórico!</b>',
       lastro_sem  = '📉 <b>Menor preço em dias</b>',
       lastro_queda = '⚡ <b>Baixou {queda}% desde ontem</b>'
 where canal_id = '1b22b636-b723-4592-95fd-a87053b7dcc6';
```

- [ ] **Passo 2: aplicar no local e conferir o ledger**

```bash
pnpm db:reset
supabase migration list --linked
```

Espera: as colunas `local` e `remote` batendo, fora a migration nova, que
ainda não subiu. Se divergirem em qualquer outra linha, **pare** e resolva
antes de seguir.

- [ ] **Passo 3: escrever o teste que falha**

Em `testes/mensagem.mjs`, ao fim do bloco de lastro:

```javascript
const modeloDeFaixa = {
  corpo: "{produto}\n\n{lastro}\nDe <s>{preco_antes}</s> por <b>{preco}</b>",
  lastroCom: "🔥 <b>Menor valor histórico!</b>",
  lastroMes: "🔥 <b>Menor preço do último mês</b>",
  lastroSemana: "📉 <b>Menor preço da semana</b>",
  lastroSem: "📉 <b>Menor preço em dias</b>",
  lastroQueda: "⚡ <b>Baixou {queda}% desde ontem</b>",
  lastroHoje: "⚡ <b>Baixou de novo hoje</b>",
  lastroDeclarado: "",
  linhaFrete: "",
};
const base = {
  produto: "Blush", precoCentavos: 1649, precoAnteriorCentavos: null,
  loja: "Mercado Livre", link: "https://meli.la/x", vendedor: "Loja",
  gatilho: "declarado", podeAfirmarMinimo: false,
};

confere(
  "série de 30 dias afirma histórico",
  montaMensagem(modeloDeFaixa, { ...base, diasDeSerie: 30 }).includes("Menor valor histórico"),
);
confere(
  "série de 20 dias não afirma histórico, fala do mês",
  montaMensagem(modeloDeFaixa, { ...base, diasDeSerie: 20 }).includes("último mês"),
);
confere(
  "série de 8 dias fala da semana",
  montaMensagem(modeloDeFaixa, { ...base, diasDeSerie: 8 }).includes("Menor preço da semana"),
);
confere(
  "série de 3 dias não afirma mínimo histórico em lugar nenhum",
  !afirmaMinimoSemLastro(montaMensagem(modeloDeFaixa, { ...base, diasDeSerie: 3 })),
);
confere(
  "nenhuma faixa deixa data no texto",
  !/\d{2}\/\d{2}/.test(montaMensagem(modeloDeFaixa, { ...base, diasDeSerie: 3 })),
);
```

- [ ] **Passo 4: rodar e ver falhar**

Roda: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/mensagem.mjs`
Espera: FAIL nos cinco novos, porque `montaMensagem` ainda escolhe o molde
por `podeAfirmarMinimo` e ignora `diasDeSerie`.

- [ ] **Passo 5: trocar a escolha do molde**

Em `lib/mensagem.ts`, dentro de `montaMensagem`, substituir o encadeado que
começa em `const molde =` por:

```typescript
  /*
    A ESCOLHA DO MOLDE PASSOU A SER PELA IDADE DA SÉRIE (15/08).

    Antes era `podeAfirmarMinimo` (14 dias) ou nada, e o resultado é que
    a linha de histórico não saía em post nenhum: medido em 15/08,
    nenhuma das 1.000 ofertas mais recentes tinha 14 dias de série. A
    faixa devolve sempre alguma coisa verdadeira, e o texto de cada uma
    é do dono, no banco.

    `podeAfirmarMinimo` continua sendo o freio: mesmo com 30 dias de
    série, se o motor disse que não dá para afirmar, cai para o mês.
  */
  const faixa = faixaDoLastro(dados.diasDeSerie ?? null, quedaPct);
  const porFaixa: Record<string, string> = {
    historico: dados.podeAfirmarMinimo ? modelo.lastroCom : (modelo.lastroMes ?? modelo.lastroSem),
    mes: modelo.lastroMes ?? modelo.lastroSem,
    semana: modelo.lastroSemana ?? modelo.lastroSem,
    dias: modelo.lastroSem,
    ontem: modelo.lastroSem,
    hoje: modelo.lastroHoje ?? modelo.lastroSem,
    queda: modelo.lastroQueda,
    nenhuma: modelo.lastroDeclarado,
  };
  const molde = porFaixa[faixa] ?? modelo.lastroDeclarado;
```

Acrescentar no topo do arquivo:

```typescript
import { faixaDoLastro } from "@/lib/lastro";
```

Acrescentar `diasDeSerie?: number | null` ao tipo `DadosDaMensagem`, e
`lastroMes?: string`, `lastroSemana?: string`, `lastroHoje?: string` ao tipo
`ModeloDeMensagem`.

- [ ] **Passo 6: atualizar o `RESERVA` e os `CAMPOS`**

Em `lib/modelo.ts`, somar ao objeto `RESERVA`:

```typescript
  lastroMes: "🔥 Menor preço do último mês",
  lastroSemana: "📉 Menor preço da semana",
  lastroHoje: "⚡ Baixou de novo hoje",
```

E na constante `CAMPOS`, somar `, lastro_mes, lastro_semana, lastro_hoje`.
Somar os três a `montaModelo` e ao tipo `ModeloLido`.

- [ ] **Passo 7: o publicador passa a mandar a idade da série**

Em `scripts/publica-automatico.mjs:1458` e em `lib/publicacoes.ts:307`, onde
já vai `janelaDias: oferta.referencia_janela_dias`, somar:

```javascript
      diasDeSerie: oferta.dias_de_serie,
```

E somar `dias_de_serie` à lista de colunas lidas em `lib/publicacoes.ts:188`.

- [ ] **Passo 8: rodar tudo**

Roda: `pnpm verifica`
Espera: tipos, lint e os testes passando.

- [ ] **Passo 9: commitar**

```bash
git add supabase/migrations/20260815120000_lastro_por_faixa_de_tempo.sql lib/mensagem.ts lib/modelo.ts lib/publicacoes.ts lib/supabase/tipos.ts scripts/publica-automatico.mjs testes/mensagem.mjs
git commit -m "o lastro passa a escolher a linha pela idade da serie"
```

---

### Tarefa 3: O título curto por IA

**Arquivos:**
- Criar: `lib/titulo-curto.ts`
- Testar: `testes/titulo-curto.mjs`
- Modificar: `package.json`

**Interfaces:**
- Produz: `validaTituloCurto(bruto: string | null, original: string): string | null`
  e `INSTRUCAO_TITULO: string` e `TETO_TITULO = 55`.
- A chamada de rede segue o mesmo desenho de `lib/gancho.ts`: função separada,
  para a validação ser testável sem gastar cota.

- [ ] **Passo 1: escrever o teste que falha**

```javascript
// testes/titulo-curto.mjs
import { validaTituloCurto } from "../lib/titulo-curto.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

const ORIGINAL = "Protetor Solar Em Bastão Com Cor 6 15g Sallve FPS 90 Antimanchas";

console.log("\no que tem que passar\n");
confere(
  "título curto e fiel passa",
  validaTituloCurto("Protetor Solar em Bastão Sallve FPS 90, 15g", ORIGINAL)
    === "Protetor Solar em Bastão Sallve FPS 90, 15g",
);
confere(
  "travessão vira vírgula, não reprova",
  validaTituloCurto("Base Payot — tom 3", "Base matte Payot 30ml tom 3 Francisca")
    === "Base Payot, tom 3",
);

console.log("\no que tem que ser recusado\n");
confere(
  "número que não existe no original é recusado",
  validaTituloCurto("Protetor Solar Sallve FPS 70, 15g", ORIGINAL) === null,
);
confere(
  "acima do teto é recusado",
  validaTituloCurto("Protetor Solar em Bastão com Cor Sallve FPS 90 15g Antimanchas Facial", ORIGINAL) === null,
);
confere(
  "vazio é nulo",
  validaTituloCurto("", ORIGINAL) === null,
);
confere(
  "unidade trocada é recusada",
  validaTituloCurto("Protetor Solar Sallve FPS 90, 15ml", ORIGINAL) === null,
);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) process.exit(1);
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/titulo-curto.mjs`
Espera: módulo não encontrado.

- [ ] **Passo 3: implementar**

```typescript
// lib/titulo-curto.ts
/**
 * O TÍTULO CURTO, e por que a validação é sobre número.
 *
 * MEDIDO EM 15/08, sobre 1.000 produtos de produção: a mediana tem 62
 * caracteres, o p90 tem 101, e o maior tem 200. Metade do catálogo
 * estoura uma linha e meia no celular, e o título é a primeira coisa do
 * post.
 *
 * O QUE NÃO PODE ACONTECER é a IA inventar especificação. Em 11/08 o
 * gancho transformou 36 pacotes em "sessenta pacotinhos", sem dígito e
 * sem palavra de preço, e a validação inteira deixou passar. Aqui o
 * risco é maior, porque FPS, ml e tom são o que escolhe a versão do
 * produto: um FPS errado no título é informação falsa sobre o que a
 * pessoa está comprando.
 *
 * A REGRA: todo número com unidade que aparece no curto tem que aparecer
 * no original. Não é checagem de sentido, é de fato, e é grosseira de
 * propósito. Falso positivo custa um post com título comprido, que é o
 * que já temos hoje.
 */
const TETO = 55;

/** `90`, `15g`, `30ml`, `4,5` — número com ou sem unidade colada. */
const NUMEROS = /\d+(?:[.,]\d+)?\s*(?:ml|g|kg|mg|l|cm|mm|un|w|v)?/gi;

const normaliza = (t: string) => t.toLowerCase().replace(/\s+/g, "");

export function validaTituloCurto(
  bruto: string | null | undefined,
  original: string,
): string | null {
  if (!bruto) return null;

  const t = String(bruto)
    .replace(/^\s*(t[íi]tulo|resposta)\s*:\s*/i, "")
    .replace(/[\r\n]+/g, " ")
    // Regra 3.11: conserto, não recusa. É pontuação, não muda o que afirma.
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "");

  if (!t || t.length > TETO) return null;

  // Todo número do curto tem que existir no original, com a mesma unidade.
  const doOriginal = normaliza(original).match(NUMEROS) ?? [];
  const doCurto = normaliza(t).match(NUMEROS) ?? [];
  for (const n of doCurto) {
    if (!doOriginal.includes(n)) return null;
  }

  return t;
}

export const INSTRUCAO_TITULO = `Encurte o título de um produto para um post de promoção. Máximo de 55 caracteres.

PRECISA SOBREVIVER, porque é o que decide qual versão a pessoa compra:
- a marca
- o que a coisa é
- FPS, ml, g, tamanho, quantidade, tom ou cor de maquiagem
- a linha pela qual o produto é conhecido (Boca Rosa Beauty, Creamy Cheeks, Snail 96)

PODE SAIR:
- adjetivo de vendedor: potente, premium, original, promoção, top de linha
- lista de compatibilidade: para iPhone Xiaomi Motorola
- ficha técnica que não escolhe a versão: drivers 10mm, bluetooth 5.3
- a marca repetida
- cor no fim, quando a cor não é o produto. Em maquiagem o tom FICA.

NUNCA
- Não invente número nenhum. Se o original diz FPS 90, é FPS 90.
- Não mude unidade. 15g não vira 15ml.
- Não use travessão. Use vírgula.
- Não escreva TUDO EM MAIÚSCULA e não escreva tudo em minúscula: use
  maiúscula como em nome próprio.
- Não acrescente palavra que o original não garante.

Responda SÓ com o título, nada mais.`;
```

- [ ] **Passo 4: rodar e ver passar**

Roda: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/titulo-curto.mjs`
Espera: `6 passaram, 0 falharam`.

- [ ] **Passo 5: somar ao `pnpm testa` e commitar**

```bash
git add lib/titulo-curto.ts testes/titulo-curto.mjs package.json
git commit -m "o titulo do produto encurta sem inventar especificacao"
```

---

### Tarefa 4: A descrição de gente

Reescreve o que hoje é o gancho: novo registro, dez modos, e a validação
contra o tique de relógio. O nome muda de gancho para descrição porque muda
de lugar no post.

**Arquivos:**
- Modificar: `lib/gancho.ts` (`INSTRUCAO_BASE`, `CONSTRUCOES_GASTAS`, `validaGancho`)
- Modificar: `testes/gancho.mjs`

**Interfaces:**
- Consome: nada das tarefas anteriores.
- Produz: `INSTRUCAO_BASE` reescrita e `MAX_CARACTERES` sobe de 60 para 140.

- [ ] **Passo 1: escrever o teste que falha**

Em `testes/gancho.mjs`:

```javascript
console.log("\no tique de relógio, medido em 15/08\n");

confere("hora do dia é recusada", validaGancho("dura o dia inteiro sem borrar") === null);
confere("refeição é recusada", validaGancho("batom que sobrevive ao almoço") === null);
confere("café é recusado", validaGancho("cabelo seco antes do café esfriar") === null);
confere("duração em horas é recusada", validaGancho("segura 12h na pele") === null);

console.log("\no que o dono aprovou em 15/08 e a lista barrava\n");

confere(
  "amei passa",
  validaGancho("esse blush eu amei 🥰 esfuma com o dedo e dá cara de descansada") !== null,
);
confere(
  "gente sem vocativo passa",
  validaGancho("gente, esse gloss é viciante 😍 não gruda no cabelo") !== null,
);

console.log("\no que continua barrado\n");

confere("amigas continua barrado", validaGancho("amigas, achei esse aqui") === null);
confere("meninas continua barrado", validaGancho("meninas, olha esse") === null);
confere("corre continua barrado", validaGancho("corre que achei esse") === null);
confere("duas frases cabem no teto novo",
  validaGancho("esfuma com o dedo e não marca poro. já comprei dois tons") !== null);
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/gancho.mjs`
Espera: FAIL nos dez.

- [ ] **Passo 3: trocar as listas**

Em `lib/gancho.ts`, subir o teto:

```typescript
/**
 * O teto de tamanho.
 *
 * Era 60, quando isto era uma linha acima do produto. Virou descrição de
 * uma ou duas frases abaixo dele, e 140 é o que cabe sem virar parágrafo.
 */
const MAX_CARACTERES = 140;
```

Acrescentar a lista nova, com o motivo:

```typescript
/**
 * O TIQUE DE RELÓGIO, medido pelo dono em 15/08.
 *
 * Ele viu sem olhar o código: *"ele sempre coloca uma temporização das
 * coisas"*. A causa estava nos nossos próprios exemplos, que ancoravam
 * três vezes em hora do dia (`antes do café esfriar`, `sobrevive ao
 * almoço`, `descansada de manhã`). É a segunda vez que o mesmo mecanismo
 * pega: em 11/08 foi a caixa alta dos exemplos.
 *
 * Vira validação porque proibição que só vive no prompt é pedido, e
 * modelo de linguagem falha na cauda, que é o post que a pessoa lê.
 */
const TIQUE_DE_RELOGIO =
  /\b(caf[ée]|almo[çc]o|jantar|manh[ãa]|madrugada|dia inteiro|o dia todo|\d+\s*h(?:oras?)?\b)\b/i;
```

Em `CONSTRUCOES_GASTAS`, **remover** `/\bamei\b/i` e `/^gente[,!\s]/i`, com o
motivo escrito ali:

```typescript
  // `amei` e `gente,` SAÍRAM da lista em 15/08. Elas entraram como vício
  // de canal de promoção, e levaram junto o jeito de falar que o dono
  // quer: as duas frases que ele mais elogiou no teste ("esse blush eu
  // amei", "gente, esse gloss é viciante") eram recusadas por elas.
  // `amigas`, `meninas` e `corre` ficam: são de locutor, não de pessoa.
```

Em `validaGancho`, somar a recusa após as outras:

```typescript
  if (TIQUE_DE_RELOGIO.test(t)) return null;
```

- [ ] **Passo 4: reescrever a instrução**

Trocar `INSTRUCAO_BASE` pela versão da spec, §2. Os dez modos, os exemplos
sem relógio, e o `NUNCA` somando:

```
- Não ancore em hora do dia nem em duração. Nada de "antes do café", "durante o almoço", "dura o dia inteiro", "12h de duração", "de manhã". Isso virou o nosso carimbo e é o que mais denuncia texto de máquina.
- No máximo um em cada três posts pode dizer que você usou o produto. Nos outros, fale do que ele é, de quem gosta dele, ou de como ele aparece na vida de alguém. Se todo post disser "eu usei", ninguém acredita em nenhum.
```

- [ ] **Passo 5: rodar e ver passar**

Roda: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/gancho.mjs`
Espera: todos passando.

- [ ] **Passo 6: comparar saída real antes de subir**

`scripts/publica-automatico.mjs` **não tem modo de simulação**, e rodá-lo
publica de verdade. Criar `scripts/amostra-de-descricao.mjs`, que só chama a
IA e imprime:

```javascript
/**
 * Vinte descrições impressas, sem publicar nada.
 *
 * Existe porque a única forma de saber se o registro pegou é ler vinte
 * seguidas: uma boa não prova nada, e o defeito que importa (todas
 * iguais, todas dizendo "eu usei") só aparece na sequência.
 */
import { geraGancho } from "../lib/gancho.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const r = await fetch(
  `${url}/rest/v1/produto?select=titulo_canonico&limit=20&nicho_id=not.is.null`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);

for (const p of await r.json()) {
  const d = await geraGancho(p.titulo_canonico, "beleza");
  console.log(`\n${p.titulo_canonico.slice(0, 60)}\n  -> ${d ?? "(reprovada)"}`);
}
```

Roda: `node --env-file=.env.producao --experimental-strip-types scripts/amostra-de-descricao.mjs`

Ler as vinte. **Contar quantas afirmam uso pessoal:** se passar de sete em
vinte, a proporção do prompt não pegou e o passo 4 volta. Contar quantas têm
âncora de tempo: tem que ser zero. Contar quantas foram reprovadas: se passar
de cinco, a validação está apertada demais e o post vai sair sem descrição na
maioria das vezes.

- [ ] **Passo 7: commitar**

```bash
git add lib/gancho.ts testes/gancho.mjs
git commit -m "a descricao passa a ter dez modos e perde o tique de relogio"
```

---

### Tarefa 5: O corpo novo do post

A última, porque só faz sentido com as quatro anteriores no lugar.

**Arquivos:**
- Criar: `supabase/migrations/20260815130000_corpo_novo_do_radar_delas.sql`
- Modificar: `lib/modelo.ts:22` (o `RESERVA`)
- Modificar: `app/acoes/modelos.ts:65` (a validação que exige `#publi`)
- Modificar: `testes/mensagem.mjs`

- [ ] **Passo 1: escrever a migration**

```sql
-- supabase/migrations/20260815130000_corpo_novo_do_radar_delas.sql
--
-- O CORPO QUE O DONO APROVOU EM 15/08, e só no Radar Delas do WhatsApp.
--
-- O que saiu, e o motivo de cada um está em
-- docs/superpowers/specs/2026-08-15-novo-formato-de-post-design.md:
--
--   {gancho} da primeira linha   virou a descrição, e desceu
--   {desconto}% off              o de/por já mostra
--   {frete} e {vendedor}         não decidem compra de beleza barata
--   #publi · {loja}              decisão do dono, ver §6 da spec
--
-- O BLOCO DE PREÇO É COLADO DE PROPÓSITO. Lastro, preço e avaliação são
-- a mesma informação, e separá-los em três parágrafos fazia o post
-- ocupar tela sem dizer mais nada. Palavras do dono: "você juntou, o
-- texto ficou muito menor, ficou mais gostoso de ler".
update public.modelo_mensagem
   set corpo = concat_ws(E'\n',
         '{emoji} <b>{produto}</b>',
         '',
         -- O placeholder continua sendo {gancho}: é o nome que
         -- `preenche` conhece em lib/mensagem.ts. O que mudou foi o que
         -- ele contém e onde ele aparece, não como se chama.
         '{gancho}',
         '',
         '{lastro}',
         'De <s>{preco_antes}</s> por <b>{preco}</b>',
         '{nota}',
         '',
         '🛒 {link}'
       )
 where canal_id = '1b22b636-b723-4592-95fd-a87053b7dcc6';
```

- [ ] **Passo 2: afrouxar a validação de `#publi`**

Em `app/acoes/modelos.ts:65`, a recusa vira aviso. O motivo fica escrito:

```typescript
  /*
    A EXIGÊNCIA DE #publi VIROU AVISO EM 15/08, por decisão do dono.
    A regra 3.10 continua no AGENTS.md e continua sendo a recomendação;
    o que mudou é que ela não bloqueia mais o salvamento. O dono
    contestou a base ("ninguém sabe se a doc tá certa") e a pesquisa em
    fonte primária (CONAR, CDC art. 36, termos de Shopee e Amazon) ficou
    como tarefa aberta. Enquanto ela não sai, quem decide é ele.
  */
  if (!temIdentificacaoPublicitaria(corpo)) {
    avisos.push("o modelo não identifica que é publicidade (regra 3.10)");
  }
```

Manter `identificacaoEstaEscondida` e `afirmaMinimoSemLastro` como estão: a
segunda é a regra 3.4, que ninguém pediu para mexer.

- [ ] **Passo 3: atualizar o `RESERVA`**

Copiar o corpo novo para `lib/modelo.ts:22`. Ele já divergiu do banco uma vez,
em 10/08, e foi de lá que uma linha morta voltou ao ar.

- [ ] **Passo 4: rodar tudo**

Roda: `pnpm verifica`
Espera: tudo passando.

- [ ] **Passo 5: ver o post montado antes de publicar**

Abrir `/ajustes/modelos` no painel, que já tem prévia do modelo montado
(`previa`, em `lib/mensagem.ts:670`), e conferir com o modelo do Radar Delas
selecionado: título abaixo de 55 caracteres, descrição sem relógio, lastro
coerente com a idade da série, e nenhuma linha vazia sobrando entre lastro,
preço e avaliação.

Depois disso, e só depois, deixar sair **um post real** no grupo e ler no
celular. O espaçamento é o único defeito deste plano que nenhum teste pega:
ele estava certo no texto e errado na tela, em 04/08, e só apareceu lendo o
post publicado.

- [ ] **Passo 6: subir a migration**

```bash
supabase migration list --linked
pnpm db:publica
```

Se `local` e `remote` não baterem antes do push, **pare**.

- [ ] **Passo 7: commitar**

```bash
git add supabase/migrations/20260815130000_corpo_novo_do_radar_delas.sql lib/modelo.ts app/acoes/modelos.ts testes/mensagem.mjs
git commit -m "o radar delas passa a postar no formato curto"
```

---

## O que este plano não faz

- **Não aplica aos outros oito canais.** Roda uma semana no Radar Delas
  primeiro.
- **Não faz a releitura intradiária**, que é o que faria a faixa "baixou de
  novo hoje" existir.
- **Não resolve o `#publi`.** Ele sai do post e a pesquisa em fonte primária
  fica aberta.
- **Não gera título curto na coleta.** A IA encurta na hora de publicar; se
  isso ficar caro em cota, o passo seguinte é gravar o curto no produto.
