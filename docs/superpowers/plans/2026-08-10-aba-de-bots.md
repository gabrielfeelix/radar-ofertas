# Aba de BOTS — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa por tarefa. Os passos usam `- [ ]` para marcação.

**Objetivo:** dar ao sistema o registro do chip — quando começou a aquecer, se está conectado, quanto já falou — e fazer o teto e o ritmo do WhatsApp serem contados por chip, não por canal.

**Arquitetura:** uma tabela `bot` para as duas plataformas, com o segredo fora dela; `canal.bot_id` como chave estrangeira; a curva de aquecimento como função pura em `lib/aquecimento.ts`; e o intervalo do WhatsApp passando a valer também por chip em `lib/ritmo.ts`. A tela lê o estado da conexão ao vivo e nunca o grava.

**Stack:** Next.js App Router, TypeScript, Supabase (Postgres + RLS), testes em `.mjs` rodados por `node --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-08-10-aba-de-bots-design.md`

## Restrições globais

- Código, nomes de tabela, coluna e commit em **português**. Tabela no singular.
- **Nenhum segredo entra no banco nem no Git.** A coluna `variavel_do_segredo` guarda o NOME da variável de ambiente.
- **Dinheiro é inteiro em centavos.** Não se aplica aqui, mas vale se algum campo novo aparecer.
- **Datas em UTC, exibição e contagem de dia em `America/Sao_Paulo`** (regra 3.9). O dia do aquecimento conta pelo fuso de São Paulo.
- **Migration nova, nunca alterar aplicada.** Nome com carimbo `YYYYMMDDHHMMSS_descricao.sql`.
- **RLS ligado em toda tabela**, com `public.operacao_atual()` e `public.tem_papel('dono')`.
- **Nada de `any`** sem comentário justificando.
- **Nunca travessão** (`—`) em texto que vai para o canal. Comentário e documentação podem.
- A curva do aquecimento é **10, 15, 20, 25, e 30 do 5º ao 14º**. Decisão do dono, não negociável no código.
- O intervalo do WhatsApp é **4 a 10 minutos, sorteado, nunca menos e nunca mais** (regra 3.2).
- Cada tarefa termina com `pnpm verifica` passando e um commit.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/aquecimento.ts` (novo) | Curva do aquecimento. Funções puras, sem banco e sem rede. |
| `testes/aquecimento.mjs` (novo) | Cada degrau da curva, o dia 0, data no futuro, virada do dia. |
| `lib/ritmo.ts` (modificar) | Ganha o veredito por chip, ao lado do que já existe por canal. |
| `testes/ritmo.mjs` (modificar) | O caso dos 8 canais num chip só. |
| `supabase/migrations/20260810150000_o_chip_ganha_registro.sql` (novo) | Tabela `bot`, RLS, `canal.bot_id`, remoção de `canal.whatsapp_instancia`. |
| `lib/supabase/tipos.ts` (modificar) | Tipos da tabela `bot` e da coluna nova em `canal`. |
| `lib/bots.ts` (novo) | Leitura dos bots para a tela. `server-only`. |
| `app/acoes/bots.ts` (novo) | Server actions: salvar, alternar ativo, buscar QR Code. |
| `app/(painel)/bots/page.tsx` (novo) | A tela. |
| `app/componentes/FormularioBot.tsx` (novo) | O formulário de bot. |
| `app/componentes/Casca.tsx` (modificar) | Item "Bots" no grupo Distribuição. |
| `scripts/publica-automatico.mjs` (modificar) | Rampa, teto por bot, intervalo por chip. |
| `AGENTS.md`, `docs/decisoes.md` (modificar) | Regra 3.2 atualizada e a D-072. |

---

## Task 1: A curva do aquecimento

**Arquivos:**
- Criar: `lib/aquecimento.ts`
- Criar: `testes/aquecimento.mjs`
- Modificar: `package.json` (script `testa`)

**Interfaces:**
- Consome: `diaEmSaoPaulo` de `lib/ritmo.ts`
- Produz: `diaDoAquecimento(inicio: string, agora: Date): number` e `tetoDoDia(dia: number, tetoCheio: number): number`

- [ ] **Passo 1: escrever o teste que falha**

Criar `testes/aquecimento.mjs`:

```js
/**
 * Teste da curva de aquecimento do chip.
 *
 * Errar aqui não levanta erro: o número só cai algumas semanas depois,
 * e aí não dá para saber se foi a rampa ou outra coisa.
 */
import { diaDoAquecimento, tetoDoDia } from "../lib/aquecimento.ts";

let passou = 0, falhou = 0;
const confere = (n, ok) => { if (ok) { passou++; console.log(`✓ ${n}`); } else { falhou++; console.log(`✗ ${n}`); } };

console.log("\no dia do aquecimento\n");

// 12:00 UTC = 09:00 em São Paulo, bem longe da virada.
const meioDia = (d) => new Date(`${d}T12:00:00Z`);

confere("o dia de início é o dia 1", diaDoAquecimento("2026-08-10", meioDia("2026-08-10")) === 1);
confere("o dia seguinte é o dia 2", diaDoAquecimento("2026-08-10", meioDia("2026-08-11")) === 2);
confere("duas semanas depois é o dia 15", diaDoAquecimento("2026-08-10", meioDia("2026-08-24")) === 15);
confere("data no futuro devolve 0", diaDoAquecimento("2026-08-20", meioDia("2026-08-10")) <= 0);

/*
  A VIRADA DO DIA É NO FUSO DE SÃO PAULO, não no UTC (regra 3.9).
  02h UTC do dia 11 ainda é 23h do dia 10 em São Paulo.
*/
confere(
  "02h UTC do dia 11 ainda é o dia 1",
  diaDoAquecimento("2026-08-10", new Date("2026-08-11T02:00:00Z")) === 1,
);
confere(
  "04h UTC do dia 11 já é o dia 2",
  diaDoAquecimento("2026-08-10", new Date("2026-08-11T04:00:00Z")) === 2,
);

console.log("\na curva, que é decisão do dono\n");

confere("dia 1 são 10", tetoDoDia(1, 150) === 10);
confere("dia 2 são 15", tetoDoDia(2, 150) === 15);
confere("dia 3 são 20", tetoDoDia(3, 150) === 20);
confere("dia 4 são 25", tetoDoDia(4, 150) === 25);
confere("dia 5 são 30", tetoDoDia(5, 150) === 30);
confere("dia 14 ainda são 30", tetoDoDia(14, 150) === 30);
confere("dia 15 libera o teto cheio", tetoDoDia(15, 150) === 150);
confere("e depois continua o teto cheio", tetoDoDia(400, 150) === 150);

/*
  Dia 0 ou negativo é data de início no futuro, que só acontece por erro
  de digitação. Zero é o que impede o erro de virar disparo.
*/
confere("dia 0 não publica nada", tetoDoDia(0, 150) === 0);
confere("dia negativo não publica nada", tetoDoDia(-5, 150) === 0);

// A curva nunca passa do teto cheio, mesmo com um teto baixo cadastrado.
confere("teto cheio baixo limita a curva", tetoDoDia(5, 12) === 12);

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou > 0) process.exit(1);
console.log("todos os casos passaram");
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/aquecimento.mjs
```

Esperado: erro de módulo não encontrado, `lib/aquecimento.ts`.

- [ ] **Passo 3: escrever `lib/aquecimento.ts`**

```ts
import { diaEmSaoPaulo } from "@/lib/ritmo";

/**
 * O aquecimento do chip.
 *
 * Número novo não sai publicando no volume de operação: a D-053 mediu
 * conta caindo em 2 a 8 semanas, e o padrão que derruba é volume alto
 * em número sem história. A rampa é o que separa "chip novo" de "chip
 * queimado no primeiro dia".
 *
 * Isto vive no CÓDIGO e não no banco de propósito. Curva em parâmetro
 * seria botão que ninguém audita: mudaria em produção sem commit, sem
 * teste e sem ninguém lembrar por quê. É política, não configuração.
 *
 * Só a data de início é dado, em `bot.aquecimento_inicio`.
 */

/**
 * A curva, decidida pelo dono em 10/08/2026.
 *
 * Os quatro primeiros dias sobem de cinco em cinco; do 5º ao 14º fica
 * em 30; do 15º em diante vale o teto do chip.
 */
const CURVA_INICIAL = [10, 15, 20, 25];
const PLATO = 30;
const DIA_DA_OPERACAO = 15;

/**
 * Em que dia do aquecimento este chip está.
 *
 * O dia de início é o dia 1, e não o dia 0: "primeiro dia" é o dia em
 * que se começa, que é como a pessoa que cadastrou vai contar.
 *
 * A contagem é pelo dia de São Paulo (regra 3.9). Por UTC, a virada
 * aconteceria às 21h, no meio do pico da noite, e o chip ganharia um
 * degrau da rampa três horas antes da hora.
 */
export function diaDoAquecimento(inicio: string, agora: Date): number {
  const hoje = diaEmSaoPaulo(agora);
  const umDia = 86_400_000;
  // O deslocamento fixo de -03:00 vale porque o Brasil não tem horário
  // de verão desde 2019. É a mesma premissa de `inicioDoDiaEmSaoPaulo`.
  const decorrido =
    Date.parse(`${hoje}T00:00:00-03:00`) - Date.parse(`${inicio}T00:00:00-03:00`);
  return Math.floor(decorrido / umDia) + 1;
}

/**
 * Quantas promos este chip pode mandar hoje.
 *
 * `tetoCheio` é o `bot.envios_dia_max`, e ele é o limite superior em
 * qualquer dia: um chip cadastrado com teto de 12 não manda 30 no dia 5
 * só porque a curva diz 30.
 */
export function tetoDoDia(dia: number, tetoCheio: number): number {
  if (dia < 1) return 0;
  if (dia >= DIA_DA_OPERACAO) return tetoCheio;

  const daCurva = dia <= CURVA_INICIAL.length ? CURVA_INICIAL[dia - 1] : PLATO;
  return Math.min(daCurva, tetoCheio);
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/aquecimento.mjs
```

Esperado: `todos os casos passaram`.

- [ ] **Passo 5: pendurar no `pnpm testa`**

Em `package.json`, no fim do valor de `"testa"`, acrescentar:

```
 && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/aquecimento.mjs
```

- [ ] **Passo 6: verificar e commitar**

```bash
pnpm verifica
git add lib/aquecimento.ts testes/aquecimento.mjs package.json
git commit -m "a rampa de aquecimento do chip, como funcao pura"
```

---

## Task 2: O intervalo passa a valer por chip

**Arquivos:**
- Modificar: `lib/ritmo.ts`
- Modificar: `testes/ritmo.mjs`

**Interfaces:**
- Consome: `intervaloDoWhatsAppEmMinutos`, `Veredito` (já existem em `lib/ritmo.ts`)
- Produz: `podeChipFalarAgora(agora: Date, ultimoEnvioDoChip: Date | null, botId: string): Veredito`

**Por que existe:** hoje o intervalo de 4 a 10 min é conferido contra `canal.ultima_publicacao_em`. Com 8 grupos no mesmo chip, cada canal tem o próprio relógio e todos podem estar liberados ao mesmo tempo — o laço publica um por vez, mas em sequência, e o número dispara 8 mensagens em menos de um minuto. Cada canal respeitou a regra; o chip não.

- [ ] **Passo 1: escrever o teste que falha**

Em `testes/ritmo.mjs`, depois do bloco "o ritmo do whatsapp, de 4 a 10", acrescentar:

```js
/*
  O INTERVALO POR CHIP.

  O caso é 8 grupos no mesmo número. Cada canal tem o próprio relógio, e
  sem esta trava os 8 saem em sequência, com segundos entre eles. Do
  lado do WhatsApp, é um número mandando 8 mensagens em 50 segundos para
  8 grupos: o padrão de disparo em massa.
*/
console.log("\no intervalo por chip\n");

const agora8 = new Date("2026-08-01T14:00:00Z");

confere(
  "chip que nunca falou pode falar",
  podeChipFalarAgora(agora8, null, "bot-1").pode,
);
confere(
  "chip que falou há 2 min espera",
  !podeChipFalarAgora(agora8, new Date(agora8.getTime() - 2 * 60_000), "bot-1").pode,
);
confere(
  "chip que falou há 11 min pode",
  podeChipFalarAgora(agora8, new Date(agora8.getTime() - 11 * 60_000), "bot-1").pode,
);

// Dois chips diferentes não se esperam: o teto é do número, não da operação.
const ultimo8 = new Date(agora8.getTime() - 2 * 60_000);
confere(
  "chips diferentes têm relógios independentes",
  podeChipFalarAgora(agora8, null, "bot-2").pode &&
    !podeChipFalarAgora(agora8, ultimo8, "bot-1").pode,
);

// O sorteio do chip também é estável, pelo mesmo motivo do de canal.
confere(
  "o sorteio do chip não muda entre chamadas",
  podeChipFalarAgora(agora8, ultimo8, "bot-1").faltamMinutos ===
    podeChipFalarAgora(agora8, ultimo8, "bot-1").faltamMinutos,
);
```

E acrescentar `podeChipFalarAgora` à lista de importações no topo do arquivo.

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/ritmo.mjs
```

Esperado: `podeChipFalarAgora is not a function`.

- [ ] **Passo 3: implementar em `lib/ritmo.ts`**

Acrescentar depois de `podePublicarAgora`:

```ts
/**
 * O CHIP pode falar agora?
 *
 * Vale ao lado de `podePublicarAgora`, não no lugar dela: o canal tem
 * seu ritmo por causa da audiência, e o chip tem o dele por causa do
 * número. Com 8 grupos num chip só, o canal libera e o chip segura.
 *
 * A semente do sorteio é o bot e o instante do último envio dele, pela
 * mesma razão do sorteio por canal: chamado de novo a cada volta do
 * laço, sorteio novo faria o intervalo real virar o maior da espera.
 */
export function podeChipFalarAgora(
  agora: Date,
  ultimoEnvioDoChip: Date | null,
  botId: string,
): Veredito {
  if (!ultimoEnvioDoChip) return { pode: true };

  const intervalo = intervaloDoWhatsAppEmMinutos(`chip:${botId}|${ultimoEnvioDoChip.getTime()}`);
  const passados = (agora.getTime() - ultimoEnvioDoChip.getTime()) / 60_000;
  if (passados >= intervalo) return { pode: true };

  const faltam = Math.ceil(intervalo - passados);
  return {
    pode: false,
    motivo: `chip: sorteou ${intervalo} min entre envios, faltam ${faltam}`,
    faltamMinutos: faltam,
  };
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON testes/ritmo.mjs
```

Esperado: `todos os casos passaram`.

- [ ] **Passo 5: verificar e commitar**

```bash
pnpm verifica
git add lib/ritmo.ts testes/ritmo.mjs
git commit -m "o intervalo de 4 a 10 min passa a valer tambem por chip"
```

---

## Task 3: A tabela `bot`

**Arquivos:**
- Criar: `supabase/migrations/20260810150000_o_chip_ganha_registro.sql`
- Modificar: `lib/supabase/tipos.ts`

**Interfaces:**
- Produz: tabela `public.bot` e coluna `public.canal.bot_id`. A coluna `canal.whatsapp_instancia` deixa de existir.

- [ ] **Passo 1: escrever a migration**

```sql
-- =============================================================
-- O chip ganha registro
-- =============================================================
--
-- Até aqui o sistema sabia por qual chip publicar
-- (`canal.whatsapp_instancia`, um texto solto) e nada sobre o chip:
-- quando começou a aquecer, se está conectado, quanto já falou hoje.
--
-- Isso vira problema em três momentos previsíveis: o aquecimento, que
-- depende de alguém lembrar em que dia está; a queda, que aparece como
-- "instância desconectada" e hoje só tem resposta abrindo o painel da
-- Evolution na VPS; e o segundo chip, quando texto solto vira erro de
-- digitação silencioso.
--
-- O SEGREDO NÃO ENTRA AQUI. `variavel_do_segredo` guarda o NOME da
-- variável de ambiente, nunca o valor. O motivo é a Fase 3: hoje só o
-- dono entra no painel, e na Fase 3 entram parceiros — aí a RLS vira a
-- única coisa entre um parceiro e o chip do dono. Policy errada numa
-- migration futura custaria a conta do WhatsApp; com o segredo fora do
-- banco, custa nada.

create table public.bot (
  id                   uuid primary key default gen_random_uuid(),
  operacao_id          uuid not null references public.operacao(id) on delete cascade,
  nome                 text not null,
  plataforma           text not null,
  identificador        text not null,
  instancia            text,
  variavel_do_segredo  text not null,
  aquecimento_inicio   date,
  envios_dia_max       integer not null default 150,
  ativo                boolean not null default true,
  observacao           text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),

  constraint bot_plataforma_valida check (plataforma in ('whatsapp', 'telegram')),
  constraint bot_teto_positivo check (envios_dia_max > 0),
  -- WhatsApp sem instância não alcança a Evolution, e sem data de
  -- início não tem rampa. As duas se decidem no cadastro ou nunca.
  constraint bot_whatsapp_completo check (
    plataforma <> 'whatsapp'
    or (instancia is not null and aquecimento_inicio is not null)
  )
);

comment on table public.bot is
  'Quem fala: um bot de Telegram ou um chip de WhatsApp. O teto de envios e a rampa de aquecimento são POR AQUI, porque é o número que cai.';
comment on column public.bot.identificador is
  'O @ do bot no Telegram ou o número no WhatsApp. Só para leitura humana.';
comment on column public.bot.instancia is
  'Nome da instância na Evolution API. Só WhatsApp.';
comment on column public.bot.variavel_do_segredo is
  'O NOME da variável de ambiente que guarda o token ou a apikey. NUNCA o valor: segredo não entra no banco.';
comment on column public.bot.aquecimento_inicio is
  'Primeiro dia do chip, que é o dia 1 da rampa. A curva mora em lib/aquecimento.ts, não aqui.';
comment on column public.bot.envios_dia_max is
  'Teto de envios por dia deste chip, somando todos os canais dele. Vale a partir do 15º dia; antes, a rampa é menor.';

create unique index bot_instancia_uk
  on public.bot (operacao_id, instancia) where instancia is not null;

create index bot_operacao_idx on public.bot (operacao_id);

create trigger bot_atualizado_em
  before update on public.bot
  for each row execute function public.marca_atualizado_em();

alter table public.bot enable row level security;

-- -------------------------------------------------------------
-- RLS: só o dono, e isso é diferente de `canal`.
--
-- O operador enxerga os canais que opera, porque canal é o dia a dia
-- dele. Bot é infraestrutura do dono: qual chip, qual número, quando
-- começou a aquecer. Na Fase 3, quando entrarem parceiros, essa
-- diferença é o ponto.
-- -------------------------------------------------------------
create policy bot_le on public.bot
  for select to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

create policy bot_dono on public.bot
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

-- -------------------------------------------------------------
-- O canal aponta para o bot.
--
-- `on delete restrict` de propósito: apagar o bot que o Beauty usa
-- vira erro na hora, e não canal mudo descoberto de madrugada.
-- -------------------------------------------------------------
alter table public.canal
  add column bot_id uuid references public.bot(id) on delete restrict;

create index canal_bot_idx on public.canal (bot_id);

comment on column public.canal.bot_id is
  'Quem publica neste canal. O teto de envios é contado por bot, não por canal, porque é o número que cai.';

-- `whatsapp_instancia` nasceu em 06/08 e nunca foi preenchida em
-- produção: os canais de WhatsApp foram criados na época em que a
-- regra 3.2 proibia publicar. Sai sem migração de dados, e sai porque
-- texto solto não garante que a instância exista.
alter table public.canal drop column whatsapp_instancia;

drop index if exists canal_whatsapp_instancia_idx;
```

- [ ] **Passo 2: aplicar no banco local e conferir**

```bash
pnpm db:reset
```

Esperado: todas as migrations aplicam sem erro.

- [ ] **Passo 3: refletir em `lib/supabase/tipos.ts`**

Acrescentar a `bot` ao mesmo molde das outras tabelas do arquivo, com `Row`, `Insert` e `Update`:

```ts
bot: {
  Row: {
    id: string;
    operacao_id: string;
    nome: string;
    plataforma: "whatsapp" | "telegram";
    identificador: string;
    instancia: string | null;
    variavel_do_segredo: string;
    aquecimento_inicio: string | null;
    envios_dia_max: number;
    ativo: boolean;
    observacao: string | null;
    criado_em: string;
    atualizado_em: string;
  };
  Insert: {
    id?: string;
    operacao_id: string;
    nome: string;
    plataforma: "whatsapp" | "telegram";
    identificador: string;
    instancia?: string | null;
    variavel_do_segredo: string;
    aquecimento_inicio?: string | null;
    envios_dia_max?: number;
    ativo?: boolean;
    observacao?: string | null;
  };
  Update: Partial<Database["public"]["Tables"]["bot"]["Insert"]>;
};
```

E em `canal`: acrescentar `bot_id: string | null` no `Row` e `bot_id?: string | null` no `Insert`; **remover** `whatsapp_instancia` dos três.

- [ ] **Passo 4: verificar e commitar**

`pnpm verifica` vai apontar todo lugar que ainda usa `whatsapp_instancia`. Esses lugares são consertados nas Tasks 4 a 7 — nesta tarefa, conserte apenas o que quebrar em `lib/distribuicao.ts` trocando `whatsapp_instancia` por `bot_id` no `SELECAO`, no tipo `LinhaDeCanal` e em `montaCanal` (o campo do tipo `Canal` passa a ser `botId: string | null`).

```bash
pnpm verifica
git add supabase/migrations lib/supabase/tipos.ts lib/distribuicao.ts
git commit -m "o chip ganha tabela, e o canal aponta para ela"
```

---

## Task 4: Leitura e ações

**Arquivos:**
- Criar: `lib/bots.ts`
- Criar: `app/acoes/bots.ts`

**Interfaces:**
- Consome: `diaDoAquecimento`, `tetoDoDia` (Task 1); `instanciaEstaViva` de `lib/whatsapp.ts`; `inicioDoDiaEmSaoPaulo` de `lib/ritmo.ts`
- Produz: `type Bot`, `bots(): Promise<Bot[]>`, `salvaBot`, `alternaBot`, `buscaQrCode`

- [ ] **Passo 1: escrever `lib/bots.ts`**

```ts
import "server-only";

import { diaDoAquecimento, tetoDoDia } from "@/lib/aquecimento";
import { inicioDoDiaEmSaoPaulo } from "@/lib/ritmo";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { instanciaEstaViva } from "@/lib/whatsapp";

/**
 * Os bots — quem fala pelos canais.
 *
 * O estado da conexão é lido AO VIVO e nunca gravado. Estado gravado
 * mente: diria "conectado" com o número já banido há seis horas, que é
 * justamente o momento em que esta tela precisa estar certa.
 *
 * E a leitura não pode derrubar a página. Uma VPS fora do ar não pode
 * quebrar a tela que serve para descobrir que a VPS está fora do ar.
 */

export type Bot = {
  id: string;
  nome: string;
  plataforma: "whatsapp" | "telegram";
  identificador: string;
  instancia: string | null;
  variavelDoSegredo: string;
  aquecimentoInicio: string | null;
  enviosDiaMax: number;
  ativo: boolean;
  observacao: string | null;
  /** Quantos canais este bot serve. */
  canais: number;
  /** Quantas publicações saíram por ele hoje, no dia de São Paulo. */
  enviadasHoje: number;
  /** Nulo em bot de Telegram, que não tem rampa. */
  diaDoAquecimento: number | null;
  /** O teto de hoje: a rampa quando ainda está aquecendo. */
  tetoDeHoje: number;
  /** Nulo enquanto a checagem não terminou ou não se aplica. */
  conexao: { ok: boolean; estado?: string; motivo?: string } | null;
};

export async function bots(): Promise<Bot[]> {
  const db = await supabaseServidor();

  const { data: linhas } = await db
    .from("bot")
    .select("id, nome, plataforma, identificador, instancia, variavel_do_segredo, aquecimento_inicio, envios_dia_max, ativo, observacao")
    .order("criado_em", { ascending: true });

  if (!linhas || linhas.length === 0) return [];

  const { data: canais } = await db.from("canal").select("id, bot_id");

  const { data: enviadas } = await db
    .from("publicacao")
    .select("canal_id")
    .not("enviada_em", "is", null)
    .gte("enviada_em", inicioDoDiaEmSaoPaulo(new Date()).toISOString());

  const botDoCanal = new Map((canais ?? []).map((c) => [c.id, c.bot_id]));
  const porBot = new Map<string, number>();
  for (const p of enviadas ?? []) {
    const bot = botDoCanal.get(p.canal_id);
    if (bot) porBot.set(bot, (porBot.get(bot) ?? 0) + 1);
  }

  const agora = new Date();

  return Promise.all(
    linhas.map(async (l) => {
      const dia = l.aquecimento_inicio ? diaDoAquecimento(l.aquecimento_inicio, agora) : null;

      return {
        id: l.id,
        nome: l.nome,
        plataforma: l.plataforma as "whatsapp" | "telegram",
        identificador: l.identificador,
        instancia: l.instancia,
        variavelDoSegredo: l.variavel_do_segredo,
        aquecimentoInicio: l.aquecimento_inicio,
        enviosDiaMax: l.envios_dia_max,
        ativo: l.ativo,
        observacao: l.observacao,
        canais: (canais ?? []).filter((c) => c.bot_id === l.id).length,
        enviadasHoje: porBot.get(l.id) ?? 0,
        diaDoAquecimento: dia,
        tetoDeHoje: dia === null ? l.envios_dia_max : tetoDoDia(dia, l.envios_dia_max),
        conexao:
          l.plataforma === "whatsapp" && l.instancia
            ? await instanciaEstaViva(l.instancia).catch((e: Error) => ({
                ok: false,
                motivo: e.message,
              }))
            : null,
      };
    }),
  );
}
```

- [ ] **Passo 2: escrever `app/acoes/bots.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { supabaseServidor } from "@/lib/supabase/servidor";

export type ResultadoBot =
  | { ok: true }
  | { ok: false; campo: "nome" | "identificador" | "instancia" | "aquecimento" | "teto"; mensagem: string };

/**
 * Salva um bot.
 *
 * A validação de WhatsApp repete a constraint do banco de propósito: a
 * constraint impede o dado errado de entrar, e isto aqui diz à pessoa
 * o que faltou, em português, no campo certo.
 */
export async function salvaBot(
  _anterior: ResultadoBot | null,
  form: FormData,
): Promise<ResultadoBot> {
  const id = String(form.get("bot_id") ?? "").trim();
  const nome = String(form.get("nome") ?? "").trim();
  const plataforma = String(form.get("plataforma") ?? "whatsapp");
  const identificador = String(form.get("identificador") ?? "").trim();
  const instancia = String(form.get("instancia") ?? "").trim();
  const aquecimentoInicio = String(form.get("aquecimento_inicio") ?? "").trim();
  const enviosDiaMax = Number(form.get("envios_dia_max") ?? 150);
  const variavelDoSegredo = String(form.get("variavel_do_segredo") ?? "").trim();
  const observacao = String(form.get("observacao") ?? "").trim();

  if (nome.length < 2) {
    return { ok: false, campo: "nome", mensagem: "Dê um nome ao bot." };
  }
  if (identificador.length < 3) {
    return { ok: false, campo: "identificador", mensagem: "O @ do bot ou o número do chip." };
  }
  if (plataforma === "whatsapp" && instancia === "") {
    return { ok: false, campo: "instancia", mensagem: "O nome da instância na Evolution." };
  }
  if (plataforma === "whatsapp" && aquecimentoInicio === "") {
    return {
      ok: false,
      campo: "aquecimento",
      mensagem: "O primeiro dia do chip. É ele que define a rampa.",
    };
  }
  if (!Number.isFinite(enviosDiaMax) || enviosDiaMax < 1) {
    return { ok: false, campo: "teto", mensagem: "O teto por dia precisa ser pelo menos 1." };
  }

  const db = await supabaseServidor();
  const { data: operacao } = await db.from("operacao").select("id").limit(1).single();

  const dados = {
    operacao_id: operacao?.id as string,
    nome,
    plataforma,
    identificador,
    instancia: plataforma === "whatsapp" ? instancia : null,
    aquecimento_inicio: plataforma === "whatsapp" ? aquecimentoInicio : null,
    envios_dia_max: enviosDiaMax,
    // Guarda o NOME da variável, nunca o valor. Ver a migration.
    variavel_do_segredo:
      variavelDoSegredo || (plataforma === "whatsapp" ? "WHATSAPP_API_KEY" : "TELEGRAM_BOT_TOKEN"),
    observacao: observacao || null,
  };

  const { error } = id
    ? await db.from("bot").update(dados).eq("id", id)
    : await db.from("bot").insert(dados);

  if (error) {
    return { ok: false, campo: "nome", mensagem: error.message };
  }

  revalidatePath("/bots");
  return { ok: true };
}

export async function alternaBot(form: FormData): Promise<void> {
  const id = String(form.get("bot_id") ?? "");
  const ativo = String(form.get("ativo") ?? "") === "1";

  const db = await supabaseServidor();
  await db.from("bot").update({ ativo: !ativo }).eq("id", id);
  revalidatePath("/bots");
}

/**
 * O QR Code para reconectar.
 *
 * É a única operação da Evolution que esta tela faz, e ela existe
 * porque é a única urgente: a sessão cai às 22h de sábado e ninguém
 * quer abrir terminal na VPS.
 */
export async function buscaQrCode(
  instancia: string,
): Promise<{ ok: true; base64: string } | { ok: false; motivo: string }> {
  const base = (process.env.WHATSAPP_API_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.WHATSAPP_API_KEY ?? "";
  if (!base || !chave) return { ok: false, motivo: "falta WHATSAPP_API_URL ou WHATSAPP_API_KEY" };

  try {
    const r = await fetch(`${base}/instance/connect/${encodeURIComponent(instancia)}`, {
      headers: { apikey: chave },
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json().catch(() => null);
    const base64 = String(d?.base64 ?? "");

    return base64
      ? { ok: true, base64 }
      : { ok: false, motivo: String(d?.message ?? `HTTP ${r.status}`) };
  } catch (erro) {
    return { ok: false, motivo: (erro as Error).message };
  }
}
```

- [ ] **Passo 3: verificar e commitar**

```bash
pnpm verifica
git add lib/bots.ts app/acoes/bots.ts
git commit -m "a leitura dos bots e as acoes da tela"
```

---

## Task 5: A tela

**Arquivos:**
- Criar: `app/(painel)/bots/page.tsx`
- Criar: `app/componentes/FormularioBot.tsx`
- Modificar: `app/componentes/Casca.tsx`

**Interfaces:**
- Consome: `bots()`, `type Bot` (Task 4); `salvaBot`, `alternaBot`, `buscaQrCode` (Task 4)

- [ ] **Passo 0: ler as peças antes de escrever JSX**

Esta tarefa é a única sem código pronto no plano, e é deliberado: escrever JSX
sem conferir as props reais produz código que não compila. Leia, nesta ordem:

```bash
sed -n '1,80p' app/componentes/CabecalhoDaPagina.tsx   # props de Pagina, kpis, acoes
sed -n '1,60p' app/componentes/Cartao.tsx
sed -n '1,60p' app/componentes/Chip.tsx                # Chip e ChipDePlataforma
sed -n '1,50p' app/componentes/Modal.tsx
sed -n '1,60p' app/componentes/FormularioCanal.tsx     # o padrão de useActionState
```

Só escreva depois de ter as assinaturas em mãos.

- [ ] **Passo 1: a tela**

Criar `app/(painel)/bots/page.tsx` seguindo o molde de `app/(painel)/canais/page.tsx`: `export const dynamic = "force-dynamic"`, componente `Pagina` com `trilha="Distribuição"`, `titulo="Bots"`, e um `Modal` com `FormularioBot` na prop `acoes`.

KPIs: bots ativos, quantos conectados, envios de hoje somados.

Um `Cartao` por bot, mostrando:
- nome, `ChipDePlataforma`, identificador
- **estado da conexão**: verde quando `conexao.ok`, vermelho com `conexao.motivo` quando não, cinza quando `conexao === null`
- **o aquecimento**: `Dia {diaDoAquecimento} de 14` enquanto `diaDoAquecimento < 15`, ou "Aquecido" depois
- **o teto de hoje**: `{enviadasHoje} de {tetoDeHoje} hoje`
- quantos canais serve
- botão de QR Code, **só** quando `plataforma === "whatsapp" && conexao?.ok === false`
- botão de ativar/desativar, via `alternaBot`

Subtítulo da página:

```
Quem fala pelos canais. O teto de envios é contado por bot, não por canal, porque é o número que cai.
```

- [ ] **Passo 2: o formulário**

Criar `app/componentes/FormularioBot.tsx` no molde de `FormularioCanal.tsx`, com `useActionState(salvaBot, null)`. Campos: nome, plataforma (select), identificador, instância, `aquecimento_inicio` (`type="date"`), `envios_dia_max`, `variavel_do_segredo`, observação.

Instância e data de aquecimento só aparecem com plataforma `whatsapp`.

Sob o campo do segredo, esta ajuda, literal:

```
O NOME da variável de ambiente, não o valor. O token e a apikey ficam na Vercel e no GitHub, nunca no banco.
```

- [ ] **Passo 3: o menu**

Em `app/componentes/Casca.tsx`, no grupo `Distribuição`, ao lado de Canais:

```ts
{
  titulo: "Distribuição",
  itens: [
    { href: "/canais", rotulo: "Canais", ponto: "#2AABEE" },
    { href: "/bots", rotulo: "Bots", ponto: "#1FA855" },
  ],
},
```

- [ ] **Passo 4: verificar e commitar**

```bash
pnpm verifica
git add "app/(painel)/bots" app/componentes/FormularioBot.tsx app/componentes/Casca.tsx
git commit -m "a tela de bots, com o estado da conexao lido ao vivo"
```

---

## Task 6: O publicador respeita a rampa e o chip

**Arquivos:**
- Modificar: `scripts/publica-automatico.mjs`

**Interfaces:**
- Consome: `diaDoAquecimento`, `tetoDoDia` (Task 1); `podeChipFalarAgora` (Task 2); `canal.bot_id` (Task 3)

- [ ] **Passo 1: trocar a fonte do chip**

No `select` dos canais (perto da linha 492), trocar `whatsapp_instancia` por `bot_id`. Carregar os bots numa consulta:

```js
const { data: listaDeBots } = await db
  .from("bot")
  .select("id, nome, instancia, aquecimento_inicio, envios_dia_max, ativo");
const bots = new Map((listaDeBots ?? []).map((b) => [b.id, b]));
```

Substituir todo uso de `canal.whatsapp_instancia` por `bots.get(canal.bot_id)?.instancia`.

- [ ] **Passo 2: o teto passa a vir da rampa**

Trocar o `TETO_POR_CHIP` global por um teto por bot:

```js
/*
  O TETO DO DIA VEM DA RAMPA, e não mais de um parâmetro plano.

  `whatsapp_envios_dia_max` continua existindo como o valor padrão de
  um bot novo, mas quem manda no dia é `bot.envios_dia_max` passado
  pela curva de `lib/aquecimento.ts`. Duas fontes de verdade para o
  mesmo teto é como se descobre, tarde, que o número mandou o dobro.
*/
function tetoDoBot(bot) {
  if (!bot) return 0;
  const dia = bot.aquecimento_inicio ? diaDoAquecimento(bot.aquecimento_inicio, new Date()) : 999;
  return tetoDoDia(dia, bot.envios_dia_max);
}
```

E `chipNoTeto` passa a comparar contra `tetoDoBot(bots.get(canal.bot_id))`.

- [ ] **Passo 3: fechar o buraco do canal desativado**

A contagem de `enviadasPorChip` hoje soma só os canais ativos: desativar um canal no meio do dia faz o que ele já mandou sumir da conta do chip, e o teto do número afrouxa sozinho. Somar **todos** os canais do bot, ativos ou não:

```js
/*
  TODOS os canais do bot entram na conta, inclusive os desativados
  hoje. O que já saiu pelo número saiu, e desativar o canal depois não
  desfaz o envio. Contar só os ativos afrouxaria o teto do chip
  exatamente no dia em que alguém mexeu na configuração.

  `canais` é a lista COMPLETA lida do banco, antes do filtro de
  `canaisAtivos` — é essa diferença que fecha o buraco.
*/
const botDoCanal = new Map((canais ?? []).map((c) => [c.id, c.bot_id]));

for (const [canalId, quantas] of Object.entries(enviadasHoje)) {
  const botId = botDoCanal.get(canalId);
  if (botId) enviadasPorChip.set(botId, (enviadasPorChip.get(botId) ?? 0) + quantas);
}
```

- [ ] **Passo 4: o intervalo por chip entra no laço**

Manter o último envio de cada bot durante a rodada e conferir os dois vereditos:

```js
const ultimoEnvioDoBot = new Map();
for (const c of canaisAtivos) {
  if (c.plataforma !== "whatsapp" || !c.bot_id || !c.ultima_publicacao_em) continue;
  const anterior = ultimoEnvioDoBot.get(c.bot_id);
  const este = new Date(c.ultima_publicacao_em);
  if (!anterior || este > anterior) ultimoEnvioDoBot.set(c.bot_id, este);
}
```

E, onde hoje se calcula `veredito`:

```js
const doCanal = podePublicarAgora(
  new Date(),
  canal.ultima_publicacao_em ? new Date(canal.ultima_publicacao_em) : null,
  ritmo,
  canal.plataforma === "whatsapp" ? { canalId: canal.id } : null,
);

/*
  O canal libera e o chip pode segurar. Com 8 grupos num número só,
  sem isto os 8 sairiam em sequência, com segundos entre eles.
*/
const doChip =
  canal.plataforma === "whatsapp" && canal.bot_id
    ? podeChipFalarAgora(new Date(), ultimoEnvioDoBot.get(canal.bot_id) ?? null, canal.bot_id)
    : { pode: true };

const veredito = doCanal.pode ? doChip : doCanal;
```

Depois de cada envio bem-sucedido de WhatsApp, atualizar `ultimoEnvioDoBot.set(canal.bot_id, new Date())`.

- [ ] **Passo 5: testar a rodada sem publicar**

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/publica-automatico.mjs
```

Com `whatsapp_automatico = 0`, esperado no log: `whatsapp_automatico = 0 — canais de WhatsApp fora desta rodada.` e o Telegram publicando normalmente.

- [ ] **Passo 6: verificar e commitar**

```bash
pnpm verifica
git add scripts/publica-automatico.mjs
git commit -m "o publicador passa a contar teto e ritmo por chip"
```

---

## Task 7: O canal escolhe o bot, e as regras viram texto

**Arquivos:**
- Modificar: `app/componentes/FormularioCanal.tsx`
- Modificar: `app/acoes/canais.ts`
- Modificar: `AGENTS.md`
- Modificar: `docs/decisoes.md`

- [ ] **Passo 1: o formulário do canal**

Trocar o campo de texto `whatsapp_instancia` por um `select` de bots de WhatsApp ativos, com `name="bot_id"`. Vazio é permitido: canal sem bot fica parado e o publicador diz isso no log.

Em `app/acoes/canais.ts`, trocar a leitura de `whatsapp_instancia` por `bot_id`, e o campo correspondente em `DadosDoCanal` e em `criaCanal`/`atualizaCanal` (`lib/distribuicao.ts`).

- [ ] **Passo 2: a regra 3.2 do AGENTS.md**

Substituir o item do aquecimento, que hoje diz que `whatsapp_automatico = 0` até o 15º dia:

```markdown
- **Número novo aquece por 14 dias, e o sistema faz a conta.** A rampa é 10 promos no dia 1, 15 no 2, 20 no 3, 25 no 4, e 30 do 5º ao 14º; do 15º em diante vale o `bot.envios_dia_max`. A curva vive em `lib/aquecimento.ts`, e o dia 1 é a data em `bot.aquecimento_inicio`. Ela **não** conta o que a pessoa manda do aparelho: os 10 do dia 1 são de promo, e sem conversa humana junto eles são o dia inteiro, o que deixa o padrão visível. `whatsapp_automatico` deixou de ser o freio do aquecimento e passou a ser o freio de mão: mata todo o WhatsApp agora, sem tocar no Telegram.
```

E no item dos 4 a 10 minutos, acrescentar ao fim:

```markdown
O intervalo vale **por canal e por chip**. Só por canal, oito grupos no mesmo número disparariam oito mensagens em menos de um minuto, cada canal tendo respeitado a própria regra.
```

- [ ] **Passo 3: a D-072 em `docs/decisoes.md`**

Registrar, no molde das outras: o chip ganha registro próprio; o segredo fica fora do banco por causa da Fase 3; a curva no código porque é política e não configuração; o estado da conexão ao vivo porque estado gravado mente; e a conta que mostra que um chip não serve 8 grupos a 30 posts por dia (8 × 30 = 240 envios contra o teto de menos de 200).

- [ ] **Passo 4: verificar e commitar**

```bash
pnpm verifica
git add app/componentes/FormularioCanal.tsx app/acoes/canais.ts lib/distribuicao.ts AGENTS.md docs/decisoes.md
git commit -m "o canal escolhe o bot, e a regra 3.2 ganha a rampa"
```

---

## Depois do plano, e fora dele

Estes dependem da VPS estar de pé e **não** entram neste plano:

1. Aplicar a migration na nuvem (`pnpm db:publica`), que é deploy e precisa de autorização.
2. `WHATSAPP_API_URL` e `WHATSAPP_API_KEY` nas variáveis da Vercel e nos secrets do Actions.
3. Criar o bot `radar01` e o canal Beauty de WhatsApp, com teto de canal **30** e não o padrão de 6.
4. Abrir os horários do canal Beauty: com as 5 janelas padrão, os 10 posts do dia 1 sairiam quase todos numa hora só. Espalhar em oito janelas.
5. Virar `whatsapp_automatico` para 1 — **e só depois de tudo acima**.
