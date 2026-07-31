# O que buscar, e nesta ordem

Guia do trabalho que **só o dono pode fazer** — nada aqui se resolve escrevendo
código. Cada item diz o que ele destrava, o passo a passo, onde o valor é colado
e como saber que deu certo.

A ordem não é por facilidade: é por **quanto cada item destrava**, e o primeiro
é o único capaz de invalidar o projeto inteiro.

---

## Antes de tudo: o que NÃO é necessário agora

- **Domínio.** Ele serve ao redirecionador, que é o que encurta o link e grava o
  clique — trabalho da Fase 2. A prova de rastreio da Fase 0 usa o subid do
  próprio marketplace, num link gerado à mão. Você tem razão: não é agora.
- **Instagram, TikTok, YouTube.** Não fazem o sistema funcionar; servem para
  trazer audiência, que é outro problema.
  **Com uma ressalva que atrapalha logo no primeiro passo:** os programas de
  afiliado costumam pedir, no cadastro, **onde você vai divulgar**. A Amazon
  exige listar site ou canal; a Shopee normalmente pergunta a rede ou o grupo. Um
  grupo de WhatsApp costuma servir, e um perfil qualquer com alguma atividade
  também. Não é audiência — é campo de formulário. Mas se você não tiver nada
  para escrever ali, o cadastro trava, então vale ter um perfil ou grupo pronto
  antes de começar.
- **Cartão de crédito.** Nada nesta lista é pago. O Supabase gratuito basta, e as
  APIs de afiliado não cobram.

---

## 1. Contas de afiliado, e a compra de teste (Fase 0)

**Destrava:** a única pergunta capaz de matar o projeto — *o subid volta no
relatório de comissão?* Sem isso não existe divisão de receita com parceiro, e
sem divisão de receita não existe modelo.

**Custo:** cerca de R$20 e uma a duas semanas de espera pelo relatório.

### Passo a passo

1. **Crie conta de afiliado** nos três programas. São gratuitos e independentes:
   - Shopee — Programa de Afiliados Shopee (`affiliate.shopee.com.br`)
   - Mercado Livre — Mercado Livre Afiliados, dentro da sua conta
   - Amazon — Amazon Associates (`associados.amazon.com.br`)
2. **Anote o ID de afiliado de cada um.** É o código que identifica você e entra
   em todo link. Guarde os três: vão para o `.env`.
3. **Gere um link de teste com subid manual** em cada programa. O subid é um
   campo livre — use algo reconhecível, tipo `teste01`. Cada programa chama isso
   de um jeito: *SubID*, *tag de rastreamento*, *identificador personalizado*.
4. **Compre alguma coisa barata** por cada link, de verdade, com dinheiro seu.
   Compra de teste tem que ser compra: simulação não aparece em relatório.
5. **Espere o relatório** e confira, por marketplace:
   - o subid apareceu?
   - apareceu **íntegro**, ou foi cortado/alterado?
   - qual o tamanho máximo que ele aceita?
   - aceita letra e número, ou só número?
   - quantos dias levou para aparecer?
6. **Me passe essas respostas.** Elas viram registro em `docs/decisoes.md` e
   decidem a granularidade do subid — se ele identifica o canal, a publicação ou
   as duas coisas.

> **Se o subid não voltar em nenhum dos três, pare.** Não é para contornar com
> código: é para reavaliar o modelo comigo antes de construir mais qualquer
> coisa. Está escrito assim no roadmap desde o começo, de propósito.

**Onde vai:** `AFILIADO_SHOPEE`, `AFILIADO_MERCADO_LIVRE`, `AFILIADO_AMAZON`
no `.env`.

---

## 2. Projeto Supabase na nuvem

**Destrava:** o sistema sair da sua máquina. Hoje o banco só existe no Docker
local — se o seu computador desligar, não existe sistema. É também o que permite
as rotinas automáticas rodarem sozinhas de madrugada.

**Custo:** zero. O plano gratuito dá 500 MB, que segundo a conta em
`docs/infra.md` aguenta cerca de oito meses de coleta.

### Passo a passo

1. Crie conta em `supabase.com` (dá para entrar com o GitHub).
2. **New project.** Nome à sua escolha, região **South America (São Paulo)** — é
   a mais perto, e latência de banco aparece em toda tela.
3. Escolha uma **senha de banco de dados forte** e guarde num gerenciador de
   senhas. Ela não vai para o `.env`; serve para administração.
4. Vá em **Project Settings → API** e copie três valores:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`
5. Me avise. Eu rodo `pnpm db:publica`, que aplica as 15 migrations lá.

> **A `service_role` ignora todas as regras de segurança do banco.** Ela nunca
> vai para o navegador, nunca para o Git, nunca para uma captura de tela. Se
> vazar, qualquer pessoa lê e escreve tudo. Se acontecer, dá para gerar outra no
> mesmo painel — e aí é para fazer na hora.

> **Atenção que muda uma regra do projeto:** hoje as migrations podem ser
> reescritas, porque o banco está vazio e nada foi publicado. **No dia em que
> este projeto na nuvem existir, essa porta fecha** — migration aplicada não se
> altera nunca mais, só se cria outra em cima.

---

## 3. Credencial da Shopee (Open API de afiliado)

**Destrava:** a coleta de preço de verdade. Hoje o coletor está pronto e pula
todas as lojas por falta de chave — o catálogo só enche pela colheita de canais
alheios, e sem preço coletado não existe série, sem série não existe oferta.

**É a aposta principal, e o motivo é concreto:** a mesma credencial resolve
**dado de produto e link curto rastreável**. Nos outros programas são duas coisas
separadas.

### Passo a passo

1. Tenha a conta de afiliado do passo 1 **aprovada** — a Open API sai de dentro
   dela.
2. No painel de afiliado, procure **Open API** (fica em `affiliate.shopee.com.br/open_api`).
3. Gere a credencial. Ela vem em duas partes:
   - **App ID** → `SHOPEE_APP_ID`
   - **Secret** → `SHOPEE_APP_SECRET`
4. Me mande um aviso de que existe — **não o valor pelo chat**. Cole você mesmo
   no `.env`.

**Como saber que funcionou:** eu rodo o coletor e ele deixa de dizer "pulei a
Shopee". A tela *Precisa de atenção* passa a mostrar a coleta como concluída.

> O painel da Shopee muda de lugar com alguma frequência. Se você não achar
> "Open API", me diga o que aparece na tela e eu procuro o caminho atual —
> melhor do que sair clicando.

---

## 4. Mercado Livre (API de itens)

**Destrava:** a segunda fonte de preço. Importa mais do que parece: **a série
histórica de preço só pode ser construída sobre Mercado Livre e Shopee**, porque
a política da Amazon proíbe guardar preço além de 24 horas (regra 3.3). Com uma
loja só, a base do produto fica numa perna só.

### Passo a passo

1. Entre em `developers.mercadolivre.com.br` com a sua conta.
2. **Criar aplicação.** Preencha nome e descrição.
3. Em URL de redirecionamento, pode usar `http://localhost:3000` por enquanto —
   é só para o fluxo de autorização.
4. Copie:
   - **Client ID** → `ML_CLIENT_ID`
   - **Client Secret** → `ML_CLIENT_SECRET`
5. O **refresh token** (`ML_REFRESH_TOKEN`) sai de um fluxo de autorização que
   dá para fazer no navegador. É chato e cheio de detalhe — **me chame nessa
   hora** e eu te passo os endereços exatos, na ordem.

> **Este é o que vence.** O token do Mercado Livre tem validade e precisa ser
> renovado; quando vencer, o coletor pula a loja e avisa. Está anotado em
> `docs/infra.md` junto com as outras dependências que expiram em silêncio.

---

## 5. Telegram — duas coisas diferentes, não confunda

### 5a. Conta de usuário, para **ler** (colheita)

**Destrava:** a colheita de canais fechados. Hoje ela lê o que é público; grupo
e canal fechado exigem uma conta de verdade.

1. **Use um número dedicado** — chip pré-pago, número virtual, o que for. **Nunca
   o seu pessoal.** A string de sessão equivale à conta inteira: quem a tem entra
   no seu Telegram.
2. Entre em `my.telegram.org` com esse número.
3. **API development tools** → crie uma aplicação. Nome e descrição podem ser
   qualquer coisa.
4. Copie **api_id** → `TELEGRAM_API_ID` e **api_hash** → `TELEGRAM_API_HASH`.
5. A **string de sessão** (`TELEGRAM_SESSION`) é gerada num primeiro login que
   pede o código de confirmação. Me chame que eu monto o script e você roda —
   **o código chega no seu telefone e não passa por mim**.

> Esta conta **só lê**. Nunca publica, nunca responde, nunca entra em conversa.
> Automatizar conta de usuário para publicar é o que derruba número.

### 5b. Bot, para **publicar** (Fase 2)

**Destrava:** a publicação automática no Telegram. É Fase 2 — não é urgente, mas
leva dois minutos e não custa nada.

1. No Telegram, fale com **@BotFather**.
2. `/newbot`, escolha nome e usuário.
3. Copie o token → `TELEGRAM_BOT_TOKEN`.
4. **Adicione o bot como administrador** do canal onde ele vai publicar, com
   permissão de postar. Sem isso ele não escreve.
5. O **chat_id** do canal é um número que a gente descobre depois, com o bot já
   dentro. Anota que existe e segue.

---

## 6. Amazon — deixe por último, e saiba por quê

A API que servia para isto, a **PA-API v5, foi aposentada em 15/05/2026**. Não
aceita cliente novo. A substituta é a **Creators API**, com autenticação e
formato diferentes.

E tem um detalhe que inverte a prioridade: a PA-API exigia **10 vendas
qualificadas nos últimos 30 dias** para manter o acesso. Se a Creators API
herdou a regra — e a pesquisa não conseguiu confirmar —, **a compra de teste da
Fase 0 não destrava nada**: só volume real de vendas destrava.

**Conclusão prática:** crie a conta de afiliado da Amazon (passo 1, para o teste
de subid) e **não conte com a Amazon como fonte de preço** no primeiro ano. Ela
entra como oferta pontual, nunca como base de histórico — que aliás é o que a
regra 3.3 já mandava.

---

## 7. Dois segredos que você mesmo gera

Não dependem de ninguém, levam dez segundos, e é melhor fazer agora:

```
openssl rand -hex 32
```

Rode duas vezes e cole cada resultado em:

- `COLETA_SEGREDO` — autoriza o agendador a chamar as rotinas. Sem ele,
  qualquer pessoa na internet dispara a coleta.
- `SAL_HASH_IP` — embaralha o IP de quem clica, para não guardarmos dado
  pessoal (LGPD, regra 3.8).

> **O sal do IP nunca muda depois que a coleta começar.** Se mudar, os cliques
> antigos deixam de bater com os novos e a contagem de visitante único quebra
> para sempre.

---

## Resumo: o que destrava o quê

| Item | Sem ele | Urgência |
|---|---|---|
| Contas de afiliado + compra de teste | não se sabe se o modelo funciona | **agora** |
| Supabase na nuvem | o sistema mora na sua máquina | **agora** |
| Shopee Open API | catálogo sem preço, motor sem série | **agora** |
| Segredos gerados | rotina exposta, clique sem anonimato | agora, custa 10s |
| Mercado Livre | uma perna só na série de preço | logo depois |
| Telegram conta de usuário | colheita só do que é público | quando quiser mais catálogo |
| Telegram bot | publicação manual em tudo | Fase 2 |
| Amazon Creators API | sem oferta pontual da Amazon | depois de ter vendas |
| Domínio | sem link curto e sem clique gravado | Fase 2 |

---

## Regra de segurança, para todos eles

**Nenhum destes valores entra no Git, no chat, ou numa captura de tela.** Eles
vivem em três lugares, e só:

1. `.env` na sua máquina, que está no `.gitignore` e continua lá.
2. Segredos do projeto no Supabase, para as Edge Functions.
3. Segredos do repositório no GitHub, para as rotinas agendadas.

Quando me disser "peguei a credencial da Shopee", **não cole o valor**. Diga só
que existe, cole você mesmo no `.env`, e eu sigo daí. Se algum valor vazar em
algum lugar, o certo é gerar outro imediatamente — todos os painéis permitem.
