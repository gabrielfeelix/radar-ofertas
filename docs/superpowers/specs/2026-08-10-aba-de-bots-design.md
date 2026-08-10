# Aba de BOTS — desenho

**Data:** 10/08/2026
**Estado:** aprovado o desenho, falta o plano de implementação
**Decisão relacionada:** D-071 (o WhatsApp passa a publicar sozinho)

---

## O problema

Hoje o sistema sabe para qual grupo publicar (`canal.whatsapp_grupo_id`) e por
qual chip (`canal.whatsapp_instancia`, um texto solto). Não sabe **nada sobre o
chip em si**: quando ele começou a aquecer, se está conectado agora, quanto já
falou hoje.

Isso vira problema em três momentos previsíveis:

1. **O aquecimento.** O chip começou em 10/08 e o volume sobe por 14 dias. Sem
   uma data gravada, o teto do dia depende de alguém lembrar em que dia está.
2. **A queda.** O número vai cair, e cai como "instância desconectada". A
   pergunta operacional do dia é "está de pé?", e hoje ela só tem resposta
   abrindo o painel da Evolution na VPS.
3. **O segundo chip.** Um número por instância, com teto próprio. Com dois
   chips, `whatsapp_instancia` como texto solto vira erro de digitação silencioso.

## O que esta aba não faz

Não substitui o Manager da Evolution. Criar instância, apagar instância e listar
grupos continuam lá. A única operação que entra aqui é **reconectar por QR
Code**, porque é a única urgente: a sessão cai às 22h de sábado e ninguém quer
abrir terminal.

---

## Decisões

### 1. Uma tabela `bot`, para as duas plataformas

Telegram e WhatsApp respondem à mesma pergunta operacional — quem está de pé e
quanto já falou hoje — e é isso que justifica uma tela só. As colunas exclusivas
do WhatsApp são três, e um `check` impede que fiquem nulas quando deveriam estar
preenchidas.

Duas tabelas separadas evitariam as colunas nulas ao custo de duas telas e duas
consultas para responder "quantos bots eu tenho". Não compensa em três bots.

### 2. O segredo nunca entra no banco

A coluna `variavel_do_segredo` guarda o **nome** da variável de ambiente
(`WHATSAPP_API_KEY`, `TELEGRAM_BOT_TOKEN`), nunca o valor.

O motivo é a Fase 3. Hoje só o dono entra no painel, e guardar o token no banco
seria conveniente. Na Fase 3 entram parceiros, e aí a RLS vira a única coisa
entre um parceiro e o chip do dono. Uma policy errada numa migration futura
custaria a conta do WhatsApp; com o segredo fora do banco, custa nada.

Trocar um token exige mexer nas variáveis da Vercel. É chato uma vez por ano, e
é o preço certo.

### 3. `canal.whatsapp_instancia` vira `canal.bot_id`

Chave estrangeira com `on delete restrict`. Texto solto não garante que a
instância exista; a chave garante, e `restrict` transforma "apaguei o bot que o
Beauty usava" em erro na hora em vez de canal mudo na madrugada.

A coluna atual tem quatro dias, está vazia em produção e sai sem migração de
dados.

### 4. A curva do aquecimento fica no código, não no banco

Só `bot.aquecimento_inicio` (date) fica em coluna. A curva em si é uma função
pura em `lib/aquecimento.ts`.

Curva no banco seria um botão que ninguém audita: mudaria em produção sem
commit, sem teste e sem ninguém lembrar por quê. No código ela muda com teste
junto e fica no histórico. É política, não configuração.

**A curva, decidida pelo dono em 10/08:**

| Dia desde o início | Teto de promos no dia |
|---|---|
| 1 | 10 |
| 2 | 15 |
| 3 | 20 |
| 4 | 25 |
| 5 a 14 | 30 |
| 15 em diante | `bot.envios_dia_max` |

Dia 1 é a própria data de `aquecimento_inicio`, contada no fuso de São Paulo
(regra 3.9). Data no futuro devolve teto 0 — é o que impede um erro de digitação
de virar disparo.

### 5. `bot.envios_dia_max` é a única fonte do teto por chip

O parâmetro global `whatsapp_envios_dia_max` sai da lógica do publicador e passa
a ser só o valor padrão de um bot novo. Duas fontes de verdade para o mesmo teto
é como se descobre, tarde, que o número estava mandando o dobro do combinado.

### 6. O estado da conexão é lido ao vivo e nunca gravado

Estado gravado mente: diria "conectado" com o número já banido há seis horas,
que é exatamente o momento em que a tela precisa estar certa. A leitura usa
`instanciaEstaViva`, que já existe em `lib/whatsapp.ts`, com timeout curto.

Se a Evolution não responder, o cartão mostra o motivo e o resto da página
continua de pé. Uma VPS fora do ar não pode derrubar a tela que serve para
descobrir que a VPS está fora do ar.

### 7. RLS: só o dono, leitura e escrita

Diferente de `canal`, que o operador enxerga. Bot é infraestrutura do dono, não
operação do parceiro — e na Fase 3 essa diferença é o ponto.

### 8. `whatsapp_automatico` continua existindo

Com a rampa, ele vira 1. Ele deixa de ser "espere o aquecimento" e passa a ser o
freio de mão: mata todo o WhatsApp agora, sem tocar no Telegram. Todo sistema
que publica sozinho precisa de um desses.

---

## O modelo

```sql
create table public.bot (
  id                   uuid primary key default gen_random_uuid(),
  operacao_id          uuid not null references public.operacao(id) on delete cascade,
  nome                 text not null,
  plataforma           text not null,
  identificador        text not null,   -- '@radar_bot' ou '+5544XXXXXXXXX'
  instancia            text,            -- só WhatsApp: o nome na Evolution
  variavel_do_segredo  text not null,   -- o NOME da variável, nunca o valor
  aquecimento_inicio   date,            -- só WhatsApp
  envios_dia_max       integer not null default 150,
  ativo                boolean not null default true,
  observacao           text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),

  constraint bot_plataforma_valida check (plataforma in ('whatsapp', 'telegram')),
  constraint bot_teto_positivo check (envios_dia_max > 0),
  -- WhatsApp sem instância não alcança a Evolution, e sem data de início
  -- não tem rampa. As duas coisas se decidem no cadastro ou nunca.
  constraint bot_whatsapp_completo check (
    plataforma <> 'whatsapp'
    or (instancia is not null and aquecimento_inicio is not null)
  )
);

create unique index bot_instancia_uk
  on public.bot (operacao_id, instancia) where instancia is not null;

alter table public.canal add column bot_id uuid references public.bot(id) on delete restrict;
create index canal_bot_idx on public.canal (bot_id);
alter table public.canal drop column whatsapp_instancia;
```

## As peças

**`lib/aquecimento.ts`** — função pura, sem banco e sem rede.

```ts
export function diaDoAquecimento(inicio: string, agora: Date): number
export function tetoDoDia(diaDoAquecimento: number, tetoCheio: number): number
```

Testada em `testes/aquecimento.mjs`: cada degrau da curva, o dia 0, a data no
futuro, a virada do dia no fuso de São Paulo e o dia 15 devolvendo o teto cheio.

**`lib/bots.ts`** — leitura da tabela para a tela, no molde de
`lib/distribuicao.ts`. `server-only`.

**`app/(painel)/bots/page.tsx`** — a tela, em "Distribuição", ao lado de Canais.
Um cartão por bot: nome, plataforma, identificador, estado da conexão, dia do
aquecimento com o teto de hoje, e quanto já saiu. Botão de QR Code só em bot de
WhatsApp desconectado.

**`app/acoes/bots.ts`** — server actions: criar, editar, ativar/desativar, e
buscar o QR Code.

**`scripts/publica-automatico.mjs`** — o teto por chip passa a ser o menor entre
a rampa e o `envios_dia_max` do bot, e o agrupamento por chip passa a ser por
`bot_id`.

## Onde isso pode dar errado

**O identificador do número.** O número que o dono passou tem oito dígitos
depois do DDD, e celular brasileiro tem nove — falta confirmar qual é o certo. O
JID do grupo e o do número vêm da própria Evolution depois de conectada, e é de
lá que eles devem ser copiados; digitar à mão é como se erra o número em
silêncio.

O número em si não é escrito aqui nem em nenhum arquivo do repositório, que é
público desde a D-038. Ele vive no banco, na linha do bot.

**A troca de chip.** Quando o número cair, o certo é criar um bot novo e apontar
o canal para ele, não editar o antigo. O histórico de qual chip publicou o quê
some se o registro for reaproveitado.

**A rampa não conta o que a pessoa manda.** O teto de 10 no dia 1 é de promo. Se
o número não tiver conversa humana junto, os 10 são o dia inteiro e o padrão
fica visível. Isso é operação, não código.

## O que fica de fora, de propósito

Criar e apagar instância pela tela, listar grupos para escolher o JID, histórico
de conexão, alerta quando a instância cai. Todos são Fase 2 ou depois. O que
resolve hoje é saber o estado e reconectar.
