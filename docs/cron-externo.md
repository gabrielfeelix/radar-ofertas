# Cron externo: disparar a publicação sem depender do agendador do GitHub

**Problema que isto resolve:** o agendamento do GitHub Actions é melhor esforço, e
na prática entrega uma fração do que se pede. Medido em 03/08, com o cron pedindo
de 15 em 15 minutos, o `publica.yml` rodou às **16:08 e 18:04** — duas vezes onde
deveriam ter sido oito. Cerca de **uma em cada oito**.

**A saída:** parar de pedir e passar a mandar. Um serviço de cron externo chama a
API do GitHub e dispara o workflow por `workflow_dispatch`. Isso **não passa pelo
agendador** — entra na fila na hora, igual a um push.

Testado em 03/08: a chamada foi feita e a execução começou em segundos.

> **Isto conserta o disparo, não o ritmo.** O intervalo entre posts é de 5
> minutos e vem de `parametro`, no banco (D-033). Disparar mais vezes não faz o
> canal publicar mais rápido — faz ele não ficar mudo.

---

## ✅ Resolvido de outro jeito, em 03/08: quem dispara é o banco

**O cron externo não foi usado.** O `pg_cron` está disponível neste projeto
(1.6.4, conferido em 03/08), e ele é melhor em tudo que importava aqui:

| | pg_cron | cron-job.org |
|---|---|---|
| Token sai da nossa infraestrutura | não | sim |
| Conta em serviço de terceiro | não | sim |
| Intervalo | 5 minutos | 15 minutos, com atraso de 4 a 40s |

O desenho: **`pg_cron` chama `public.dispara_publicacao()` de 5 em 5 minutos**, que
lê o token do **Vault** e faz `POST` no `workflow_dispatch` do GitHub pelo
`pg_net`. A API responde `204` e a execução começa em cerca de um segundo,
medido.

Isso **não revoga a D-015**, e a distinção é o que torna aceitável: o `pg_cron`
aqui é *gatilho*, não *agendador de rotina*. Ele não coleta, não publica e não
expurga — manda o GitHub Actions rodar. O trabalho, o log e a falha continuam
visíveis lá, que era o motivo da D-015.

### Onde olhar quando o canal ficar mudo

```sql
-- o gatilho está ativo?
select jobname, schedule, active from cron.job;

-- as últimas execuções do gatilho
select status, return_message, start_time
  from cron.job_run_details order by start_time desc limit 10;

-- o que o GitHub respondeu (204 é o certo)
select status_code, error_msg, created
  from net._http_response order by id desc limit 10;
```

`401` quer dizer token trocado ou revogado. `403`, token sem a permissão
*Actions*. O segredo se troca sem publicar versão:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'github_dispatch_token'),
  'novo_token_aqui'
);
```

### O que continua ligado

Os três caminhos convivem, e a trava no banco impede post duplicado:

1. **`pg_cron`, de 5 em 5 minutos** — o principal
2. agendamento do GitHub, de 15 em 15 — funciona cerca de uma vez a cada oito
3. reserva na coleta horária, de hora em hora

**A rotina diária ganhou o mesmo tratamento em 04/08**, por
`dispara_rotina_diaria()`, às **00:00 UTC (21:00 em São Paulo)** — depois de a
Shopee atualizar o feed de produto. O cron do GitHub continua tentando às 09:00
como segundo caminho.

Some tudo quando o publicador virar processo permanente numa máquina nossa
(`docs/migracao-para-vps.md`).

---

## O caminho do cron externo, se um dia for preciso

Fica registrado porque serve para qualquer outro gatilho, e porque o `pg_cron`
pode não estar disponível num projeto novo.

---

## Passo 1 — Criar o token, restrito

Em **github.com/settings/personal-access-tokens** → *Fine-grained tokens* →
**Generate new token**.

| Campo | Valor |
|---|---|
| **Repository access** | *Only select repositories* → **radar-ofertas** |
| **Permissions → Actions** | **Read and write** |
| **Expiration** | o mais curto que você aceite renovar |

**Só isso.** Nenhuma outra permissão. Com esse escopo o token dispara workflow e
não faz mais nada: não lê código privado, não escreve no repositório, não toca
nos segredos.

> **Por que o escopo importa mais aqui do que de costume:** o token vai ficar
> guardado num serviço gratuito de terceiro. Um token amplo vazando ali seria o
> repositório inteiro; este, no pior caso, deixa alguém disparar uma publicação.
>
> **Anote a data de expiração.** Token vencido faz o disparo parar em silêncio, e
> o sintoma é o canal ficar mudo de novo — que é o problema que isto veio
> resolver. A reserva de hora em hora continua ligada justamente para esse dia.

---

## Passo 2 — Configurar o cron

Em **cron-job.org**, criar conta e um cronjob:

- **URL:**
  ```
  https://api.github.com/repos/gabrielfeelix/radar-ofertas/actions/workflows/publica.yml/dispatches
  ```
- **Método:** `POST`
- **Intervalo:** a cada 15 minutos
- **Cabeçalhos:**
  ```
  Accept: application/vnd.github+json
  Authorization: Bearer SEU_TOKEN_AQUI
  X-GitHub-Api-Version: 2022-11-28
  Content-Type: application/json
  ```
- **Corpo:**
  ```json
  {"ref":"main"}
  ```

**Resposta esperada: `204`**, sem conteúdo. É assim que a API do GitHub responde
a um disparo aceito. Qualquer outra coisa é erro:

| Código | O que é |
|---|---|
| `401` | token errado ou vencido |
| `403` | token sem a permissão *Actions: Read and write* |
| `404` | caminho errado, ou token sem acesso a este repositório |
| `422` | o `ref` não existe, ou o workflow não tem `workflow_dispatch` |

---

## Passo 3 — Conferir que pegou

Depois do primeiro disparo, em `/actions`, as execuções devem aparecer com origem
**`workflow_dispatch`** em vez de `schedule`, de 15 em 15 minutos.

Pela linha de comando:

```bash
gh run list --workflow="Publica no Telegram" --limit 10 \
  --json startedAt,event,conclusion \
  -q '.[]|"\(.startedAt) \(.event) \(.conclusion)"'
```

---

## O que NÃO desligar

**A reserva de hora em hora, dentro da "Coleta horária", fica.** Ela é o que
segurou o canal hoje, quando o workflow novo não disparava. Agora existem três
caminhos até a publicação:

1. cron externo, de 15 em 15 minutos — o principal
2. agendamento do GitHub, de 15 em 15 — funciona uma vez a cada oito
3. reserva na coleta horária — de hora em hora

Parece exagero e não é: **nenhum dos três é confiável sozinho**, e os três juntos
custam nada. A trava de execução no banco impede post duplicado — quem chega
segundo encontra a trava tomada e sai na hora, sem publicar.

Isso deixa de ser necessário quando o publicador virar processo permanente numa
máquina nossa (`docs/migracao-para-vps.md`). Aí não há disparo: ele simplesmente
não para.
