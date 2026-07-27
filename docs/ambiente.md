# Ambiente de desenvolvimento

Como montar o projeto numa máquina nova, e por que ele está montado assim.

O objetivo é que os dois PCs rodem exatamente a mesma coisa. Isso não exige containerizar tudo — exige travar as versões que importam e deixar o banco no Docker, que é onde a diferença entre máquinas realmente aparece.

---

## O que está travado, e onde

| Peça | Versão | Onde está travada |
|---|---|---|
| Node | 24.18.0 | `.nvmrc` e `engines` no `package.json` |
| pnpm | 10.32.1 | `packageManager` no `package.json` |
| Dependências npm | exatas | `pnpm-lock.yaml` |
| Supabase CLI | 2.109.1 | `devDependencies` no `package.json` |
| Postgres | 17 | `supabase/config.toml` |
| Serviços do Supabase | fixas | `supabase/config.toml` |

O Supabase CLI é dependência do projeto, não programa instalado no sistema. Por isso é sempre `pnpm exec supabase ...` ou os atalhos `pnpm db:*` — nunca `supabase` solto no terminal, que pegaria alguma versão diferente.

---

## Por que o banco roda em Docker e a aplicação não

**O banco roda em Docker.** O comando `supabase start` sobe um ambiente completo em containers: Postgres, PostgREST, autenticação, storage, runtime das Edge Functions e o Studio. As versões vêm do `supabase/config.toml`, que está no Git. Duas máquinas com o mesmo arquivo sobem o mesmo banco, byte a byte.

**A aplicação roda direto no sistema.** Colocar o Next.js dentro de container no Windows com WSL tem um problema conhecido: eventos de alteração de arquivo não atravessam a fronteira entre o filesystem do Windows e o container, então o hot reload para de funcionar. A saída é ligar polling, que come CPU e deixa o ciclo de desenvolvimento lento.

O ganho de containerizar a aplicação seria paridade de versão do Node — e isso o `.nvmrc` já resolve, sem custo.

---

## Máquina nova, do zero

### 1. Instalar

- **Docker Desktop** — [docker.com](https://www.docker.com/products/docker-desktop). Depois de instalar: **Settings → Resources → WSL Integration**, ligue a distro Ubuntu, **Apply & Restart**. Sem isso o `supabase start` não sobe.
- **Node 24** — pelo [nvm](https://github.com/nvm-sh/nvm) é melhor, porque respeita o `.nvmrc`.
- **pnpm** — `corepack enable && corepack prepare pnpm@10.32.1 --activate`
- **Git** e o **[gh](https://cli.github.com)** para autenticar no repositório privado.

### 2. Clonar e instalar

```bash
gh repo clone gabrielfeelix/radar-ofertas
cd radar-ofertas
nvm use            # lê o .nvmrc e troca para o Node 24
pnpm install       # instala tudo, inclusive o Supabase CLI
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

O `.env` **não vem no Git e nunca vem** — ele tem chave do Supabase e ID de afiliado. Preencha à mão em cada máquina, copiando do painel do Supabase em **Project Settings → API**.

Se algum dia o `.env` aparecer numa listagem de `git status`, pare tudo: o `.gitignore` quebrou.

### 4. Subir o banco local

```bash
pnpm db:sobe       # sobe os containers e aplica as migrations
pnpm db:status     # mostra as URLs e as chaves locais
```

O `db:status` imprime uma `anon key` e uma `service_role key` locais. São chaves de brinquedo, iguais em toda máquina, e servem para preencher o `.env` enquanto você desenvolve — não são as de produção.

### 5. Rodar a aplicação

```bash
pnpm dev           # http://localhost:3000
```

---

## Comandos do dia a dia

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe o painel em modo desenvolvimento |
| `pnpm verifica` | Confere tipos e lint. Rode antes de commitar |
| `pnpm db:sobe` | Sobe o banco local em Docker |
| `pnpm db:desce` | Desliga o banco local e libera memória |
| `pnpm db:reset` | Apaga o banco local e reaplica todas as migrations do zero |
| `pnpm db:tipos` | Regera `lib/supabase/tipos.ts` a partir do banco |
| `pnpm db:publica` | Aplica as migrations no projeto do Supabase na nuvem |

**`db:reset` apaga os dados locais.** É o comando certo depois de escrever migration nova — ele prova que a sequência inteira roda limpa numa base vazia, que é exatamente o que vai acontecer em produção. Só não rode apontando para a nuvem.

---

## Quando mexer em migration

Migration já aplicada **nunca** se edita. Crie outra.

O motivo: no seu PC você pode resetar o banco à vontade, mas na nuvem a migration antiga já rodou. Editar o arquivo faz os dois bancos divergirem em silêncio, e a divergência só aparece semanas depois, num erro que não faz sentido nenhum.

```bash
pnpm exec supabase migration new descricao_curta_do_que_muda
```

---

## Problemas comuns

**`supabase start` reclama que não acha o Docker.** A integração com WSL está desligada. Docker Desktop → Settings → Resources → WSL Integration → ligue a distro → Apply & Restart.

**Porta ocupada ao subir o banco.** Algum `supabase start` de outro projeto ficou de pé. `pnpm db:desce` neste, ou `pnpm exec supabase stop --all`.

**`pnpm install` reclama da versão do Node.** É o `engines` fazendo o trabalho dele. Rode `nvm use` na pasta do projeto.

**O painel abre mas não carrega nada do banco.** Quase sempre é `.env` faltando ou com valor de exemplo. O código avisa qual variável está faltando, com o nome exato.
