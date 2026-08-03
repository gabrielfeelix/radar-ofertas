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
- ~~**Instagram, TikTok, YouTube.**~~ **Correção de 31/07: são necessários, e são
  o primeiro passo.** Eu tinha dito que provavelmente não. A pesquisa desmente:
  a **Shopee exige pelo menos um perfil ativo** em Instagram, TikTok, YouTube ou
  Facebook, e recomenda que ele já tenha conteúdo publicado. O **Mercado Livre
  exige presença digital** — Instagram, TikTok, YouTube ou blog — e faz **análise
  manual da qualidade do canal**, que leva de 3 a 10 dias úteis.

  Não é exigência de audiência: **não há mínimo de seguidores** em nenhum dos
  dois. É exigência de existir um lugar público onde os links vão aparecer.

  **Segunda correção, feita na prática:** o Mercado Livre aprovou **na hora, sem
  pedir canal nenhum** — provavelmente porque a conta do dono já tem histórico de
  compras, que é o lastro que a análise procura. Então a exigência de rede social
  é real na Shopee e **não foi exigida** no ML para conta com histórico. Quem
  chegar com conta nova provavelmente cai na análise que os guias descrevem — e
  isso vale para o parceiro da Fase 3.

  A Amazon aceita canal do Telegram público como site declarado. **Não declare
  convite de grupo de WhatsApp**: o revisor não consegue abrir, e o contrato dela
  é mais rígido com canal fechado que o dos outros dois.
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
4. **Peça a outra pessoa que compre** alguma coisa barata por cada link, na conta
   e no aparelho dela. Compra de teste tem que ser compra de verdade — simulação
   não aparece em relatório —, mas **não pode ser sua**: autocompra por link de
   afiliado é violação de termo nos três programas, e o risco é encerramento de
   conta. Você devolve o dinheiro por fora.
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

## 2. Projeto Supabase na nuvem — ✅ FEITO em 31/07/2026

> Criado pela linha de comando, com o token de conta que já existia em
> `4yu-apps/.secrets`. Projeto `radar-ofertas`, organização 4YU Systems, região
> São Paulo, ref `fcdkczueohekmgaaacdr`. As 15 migrations foram aplicadas e
> conferidas. Chaves em `.env.producao`, fora do Git.
>
> **Uma coisa continua sendo sua:** a senha do banco está em `.env.producao` e o
> Supabase não a mostra de novo. Copie para um gerenciador de senhas.
>
> O passo a passo abaixo fica registrado para quando houver um segundo ambiente.

### Como foi feito, se precisar repetir

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

> **Estado em 03/08/2026:** cadastro de afiliado **✅ APROVADO**, com dados
> bancários e fiscais enviados. **ID de afiliado: `18378371108`** — já no `.env`
> como `AFILIADO_SHOPEE`. Não é o código de indicação, que é outro número.
>
> **Open API: chamado ABERTO em 03/08/2026**, com retorno "Enviado com sucesso ·
> Seu caso será enviado para análise". Agora é esperar o e-mail.
>
> **E o chamado é mesmo o caminho — isto ficou provado, não inferido.** O
> formulário tem uma opção literal chamada **"Quero ativar a API"**. Se a
> liberação fosse automática depois da análise fiscal, essa opção não existiria.
> A dúvida era legítima: o dono levantou que seria estranho a Shopee fazer cada
> afiliado abrir chamado, e o formulário respondeu.
>
> A página *Abrir API* no painel segue mostrando AppID e Senha vazios, com a
> mensagem "No momento você não possui acesso à Plataforma de Open API dos
> Afiliados Shopee". O link "entre em contato com a gente" que ela oferece
> **está quebrado** — a página imprime o `<a>` cru no meio do texto.
>
> **Prazo: desconhecido, e desconfie de qualquer número.** Os relatos que
> existem estão no Reclame Aqui, que é amostra de quem deu errado por definição
> — ninguém volta lá para dizer que foi liberado em três dias. As duas esperas
> são em série, como já estava previsto: a conta primeiro, a API depois.

**Destrava:** a coleta de preço de verdade. Hoje o coletor está pronto e pula
todas as lojas por falta de chave — o catálogo só enche pela colheita de canais
alheios, e sem preço coletado não existe série, sem série não existe oferta.

**É a aposta principal, e o motivo é concreto:** a mesma credencial resolve
**dado de produto e link curto rastreável**. Nos outros programas são duas coisas
separadas.

### Passo a passo

1. Tenha a conta de afiliado do passo 1 **aprovada** — o chamado exige o ID.
2. **Não adianta ir à página *Abrir API*** (`affiliate.shopee.com.br/open_api`).
   Ela existe no menu, mas até a liberação mostra AppID e Senha vazios. O link
   "entre em contato com a gente" que ela oferece **está quebrado** — a própria
   página imprime o `<a>` cru no meio do texto. Confirmado em 03/08.
3. O pedido é por chamado, na **Central de Ajuda do Afiliado**: role até o
   rodapé, seção **"Acesso rápido"**, escolha **"E-mail"**. As opções aparecem
   em cascata e a sequência é:
   1. `Sim`
   2. `Não, estou com outras dificuldades / dúvidas`
   3. `Tenho dúvidas / dificuldades com meu cadastro / conta`
   4. `Quero ativar a API`
4. O formulário pede **ID do cadastro de afiliado** e **telefone**. Depois é
   análise manual, com resposta por e-mail.
5. Aprovado, a credencial aparece **naquela mesma página *Abrir API***, em duas
   partes:
   - **AppID** → `SHOPEE_APP_ID`
   - **Senha** → `SHOPEE_APP_SECRET`
6. Me mande um aviso de que existe — **não o valor pelo chat**. Cole você mesmo
   no `.env`.

> **Nenhum guia menciona exigência de seguidores, vendas ou tipo de canal** para
> liberar a API. Pelo que se lê, é análise de conta. Então não há motivo para
> esperar audiência antes de pedir.
>
> **A API é GraphQL**, não REST — está escrito no *Guia de Usuário* da própria
> página: *"A plataforma Aberta de Afiliados da Shopee de API usa a
> especificação GraphQL"*. Quem for escrever o adaptador já sabe que o
> `supabase/functions/_compartilhado/fontes/shopee.ts` precisa falar GraphQL.

**Como saber que funcionou:** eu rodo o coletor e ele deixa de dizer "pulei a
Shopee". A tela *Precisa de atenção* passa a mostrar a coleta como concluída.

> O painel da Shopee muda de lugar com alguma frequência. Se você não achar
> "Open API", me diga o que aparece na tela e eu procuro o caminho atual —
> melhor do que sair clicando.

---

## 4. Mercado Livre — ✅ conta de afiliado APROVADA em 31/07/2026

> **Aprovação foi instantânea**, e isso desmente o que a pesquisa dizia: os guias
> falavam em análise manual de 3 a 10 dias úteis e em exigência de canal de
> divulgação. Nenhum dos dois aconteceu — não houve campo de rede social no
> cadastro e o painel abriu na hora.
>
> A explicação provável é **histórico de conta**: a conta do dono no Mercado
> Livre já tem compras e tempo de casa, que é o lastro que a análise procura.
> Quem chega sem histórico provavelmente cai na análise que os guias descrevem.
>
> **Perfil de afiliado:** `fega6031503`.
>
> O painel traz **"Gerador de links"** e **"Administrar etiquetas"** — e é aí que
> mora o subid do Mercado Livre. Vale abrir os dois **antes** da compra de teste:
> tamanho máximo e formato aceito da etiqueta são metade das respostas da Fase 0,
> e essa metade sai de graça, sem esperar relatório.

## 4a. Etiquetas do Mercado Livre — ✅ RESPONDIDO em 01/08/2026

Esta era **a pergunta central da Fase 0**: dá para saber qual canal gerou
qual venda? Resposta: **dá, e sem redirecionador.**

A ajuda do ML diz, com todas as letras: *"vamos atribuir um número de
rastreamento que ficará atrelado a todos os links que você gerar para a
mesma etiqueta — esse número ficará **visível no link completo** e estará
oculto no link curto."*

Ou seja: a etiqueta viaja **dentro da URL**. O `radio button` de "etiqueta
em uso" no painel só decide qual o painel usa quando alguém gera à mão; o
que conta é o número no link. Então o sistema pode montar link por canal
sozinho.

**Formato aceito:** só letras e números, minúsculas, sem espaço nem
caractere especial, **máximo 30 caracteres**.

> Isto valida o `gera_subid()` da migration 16 sem nenhuma adaptação: ele
> produz 8 caracteres de `abcdefghjkmnpqrstuvwxyz23456789`, todos
> minúsculos e alfanuméricos. Cabe folgado nos 30.

### As 8 etiquetas criadas em 01/08/2026

| Etiqueta | Para |
|---|---|
| `fega6031503` | a original, criada sozinha ao ativar a conta |
| `radarpet` | canal de pet |
| `radartech` | tecnologia |
| `radarmoda` | moda |
| `radargeral` | geral |
| `radaranime` | animes |
| `radarmercado` | mercado |
| `radaresporte` | esporte |

**Etiqueta é por CANAL, não por nicho.** Dois canais de tecnologia pedem
`radartech` e `radartech2` — senão os dois somam no mesmo relatório e não
há como saber qual rendeu.

**Trate como definitivo.** O número de rastreamento nasce colado à
etiqueta; renomear ou apagar provavelmente perde o histórico daquele
número. Não foi testado, e até saber o contrário vale a suposição
conservadora.

### O formato do link, decifrado em 01/08/2026

Dois links gerados com etiquetas diferentes, para o mesmo gerador:

```
https://www.mercadolivre.com.br/social/fega6031503
  ?matt_word=radarpet      <- A ETIQUETA, em texto puro
  &matt_tool=66367903      <- constante, igual nos dois
  &forceInApp=true
  &ref=BEtmhz7XQDUw...     <- blob cifrado, muda por produto
```

**`matt_word` carrega a etiqueta e é legível.** Comparando os dois links,
só `matt_word` e `ref` mudam. Isso confirma: **atribuição por canal
funciona sem redirecionador.**

**Mas o `ref` não é gerável do nosso lado.** Ele codifica o produto e vem
cifrado, então o sistema NÃO consegue montar link de afiliado sozinho —
precisa passar pelo gerador do painel, que aceita várias URLs por vez.

**A granularidade real é por CANAL, não por publicação.** O `matt_word`
carrega a *etiqueta*, e etiqueta se cadastra no painel — não dá para
inventar uma por publicação. Para dividir receita com parceiro isso
basta. Para saber qual post vendeu, não.

### O teste que falta, e ele é a compra da Fase 0

Colar `?matt_word=radarpet&matt_tool=66367903` numa URL **normal** de
produto, sem passar pelo gerador. Se o ML honrar, o sistema publica
sozinho; se não, cada lote passa pelo painel.

**Não há como verificar isso sem uma venda real** — é exatamente a compra
de teste da Fase 0, que precisa ser feita por outra pessoa (autocompra é
violação de termo). Faça o link desse jeito, peça a alguém que compre por
ele, e veja se aparece com `radarpet` no relatório.

### O que ainda falta

**Um link completo gerado com cada etiqueta**, para extrair o número de
rastreamento de cada uma e gravá-lo no canal correspondente. Sem isso o
sistema sabe que a etiqueta existe, mas não sabe qual número usar.

Gera-se no **"Gerador de links"** da Central de Afiliados e Criadores:
cola a URL do produto, ele devolve o link completo e o curto. **Use o
completo** — no curto o número fica oculto.

---

## 4d. Cupons do Mercado Livre — resolvido em 01/08/2026

**Existem DUAS origens de cupom, e confundi-las custou uma conclusão
errada minha em 01/08.**

**1. Cupom que o afiliado gera.** A Central de Afiliados tem um gerador:
*"Gere códigos de cupons, compartilhe-os com seu público e ganhe por
venda."* Cria-se um **prefixo de até 9 caracteres**, uma vez, e depois
códigos com ele.

**2. Cupom que o próprio Mercado Livre solta**, em campanha. É o que os
concorrentes publicam, segundo o dono, que conhece a operação deles.
Eu tinha olhado o gerador e concluído que os cupons dos prints saíam
dali, pelo formato parecido. **Não havia evidência disso** e a conclusão
estava errada.

A diferença importa para o produto: cupom do ML é **achado**, e vale
correr atrás; cupom gerado é **seu**, e vale emitir. São duas frentes,
não uma.

**O que isso muda no sistema:** a tabela `cupom` (migration 17) continua
certa, mas o texto que diz "digitado à mão porque a loja não expõe" está
incompleto. O correto é: o cupom nasce no painel do ML, com o seu
prefixo, e é cadastrado aqui com regra e validade.

**O que continua fechado:** a API não devolve cupom. Foram varridos 13
endpoints plausíveis em 31/07 e 01/08, todos 404. E a página `/cupons`
do site exige login, então não é legível de fora como a colheita lê
`t.me/s/`. Cadastro à mão segue sendo o caminho.

**Falta escolher o prefixo.** Ele aparece em todo cupom que você
distribuir, então é marca: `RADAR` deixa 4 caracteres para a data, e
combina com as etiquetas `radar*` já criadas.

---

## 4b. Mercado Livre (API) — ✅ FUNCIONANDO desde 31/07/2026

> **O caminho é indireto, e ninguém o encontra sozinho.** O ML fechou
> `GET /items/{id}` e `GET /sites/MLB/search` com `403 PolicyAgent` —
> para todo mundo, com ou sem token, e há uma fila de reclamações
> públicas de outros desenvolvedores. **A rota que funciona é pelo
> produto de catálogo:**
>
> | Endpoint | |
> |---|---|
> | `highlights/MLB/category/{cat}` | ids de PRODUTO mais vendidos ✅ |
> | `products/search?q=` | ids de PRODUTO por palavra ✅ |
> | `products/{id}` | nome, fotos, atributos ✅ |
> | `products/{id}/items` | **PREÇO**, por vendedor ✅ |
> | `items/{id}` | fechado ⛔ e desnecessário |
>
> **Exige a permissão "Publicação e sincronização" na aplicação** — sem
> ela tudo volta a dar 403, inclusive `highlights`. E o escopo mora no
> **token**, gravado na hora da autorização: mexeu na permissão,
> **refaça a autorização**, senão o token velho carrega o escopo velho
> e nada muda.
>
> O coletor é `scripts/coleta-mercado-livre.mjs`. Ele grava o refresh
> token rotacionado sozinho, o que fecha o defeito conhecido.

## 4c. Como a aplicação foi criada

**Destrava:** a segunda fonte de preço. Importa mais do que parece: **a série
histórica de preço só pode ser construída sobre Mercado Livre e Shopee**, porque
a política da Amazon proíbe guardar preço além de 24 horas (regra 3.3). Com uma
loja só, a base do produto fica numa perna só.

### ✅ A aplicação já existe (31/07/2026)

| | |
|---|---|
| **Nome** | `Radar de Ofertas 4YU` (nome curto `radar-ofertas-4yu`) |
| **Client ID** | `7618355784652588` |
| **Client Secret** | ⚠️ **não está em lugar nenhum.** Conferido em 31/07 no `.env`, no cofre `4yu-apps/.secrets/` e nas variáveis da Vercel: em nenhum. Precisa ser copiado de novo da tela da aplicação |
| **Onde** | `developers.mercadolivre.com.br` → *Minhas aplicações* |

**Como ela foi configurada**, para quem precisar conferir ou repetir:

- **Fluxos OAuth:** `Authorization Code` **e `Refresh Token`**. O segundo é o que
  faz o coletor rodar sozinho — sem ele o acesso morre em ~6 horas e não há como
  renovar. `Client Credentials` ficou desmarcado, não serve aqui. PKCE
  desmarcado, para o fluxo manual no navegador não exigir `code_verifier`.
- **Unidade de negócio:** Mercado Livre. (`VIS` é veículos, imóveis e serviços.)
- **Permissões:** `Usuários` em leitura; **todo o resto em "Sem acesso"**. O
  formulário exige escolha explícita em cada linha — o cinza é texto de exemplo,
  não seleção.
- **Tópicos: nenhum.** Tópico é *webhook*, e webhook do ML avisa sobre a **sua
  conta de vendedor** — `Items`, `Items Prices`, `Public Offers` e afins falam de
  anúncios que **você** publica. Não existe tópico que entregue promoção de
  terceiro; marcar qualquer um só torna obrigatória uma URL de notificação que
  este projeto não tem. Feed oficial de oferta é a Shopee, não o ML.
- **URIs de redirect:** as duas da Vercel, `.../callback`. O alias estável é
  **`https://radar-ofertas.vercel.app/callback`**; a outra é a URL do deploy de
  31/07, que muda a cada publicação e por isso não serve a longo prazo.
  **Confirme a grafia exata na tela da aplicação antes de usar** — ela precisa
  bater caractere por caractere nos dois passos abaixo.

### Falta só o refresh token

1. Abra no navegador, trocando `REDIRECT` pela URI exata cadastrada:

   ```
   https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=7618355784652588&redirect_uri=REDIRECT
   ```

2. Autorize. O navegador vai para `REDIRECT?code=TG-xxxxx`.

   **Não dá 404** — isso foi testado em 31/07. O painel não tem rota `/callback`,
   então o middleware redireciona para a tela de entrada **preservando o code**:
   a barra fica em `/entrar?code=TG-xxxxx&de=%2Fcallback`. É de lá que você
   copia. O `code` **vale ~10 minutos e serve uma vez só**.

3. Troque o code pelos tokens:

   ```bash
   curl -X POST https://api.mercadolibre.com/oauth/token \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d grant_type=authorization_code \
     -d client_id=7618355784652588 \
     -d client_secret="$ML_CLIENT_SECRET" \
     -d code=TG-xxxxx \
     -d redirect_uri=REDIRECT
   ```

4. Guarde o `refresh_token` da resposta em `ML_REFRESH_TOKEN`, no `.env` e nos
   secrets da Edge Function.

> ⚠️ **Antes de agendar a primeira coleta, leia isto.** O Mercado Livre **troca o
> refresh token a cada renovação** e invalida o anterior. O adaptador em
> `supabase/functions/_compartilhado/fontes/mercado-livre.ts` descarta o token
> novo que vem na resposta, então o valor do `.env` envelhece: a primeira
> renovação funciona, a próxima execução fria falha e a loja é pulada. Guardar o
> token rotacionado em lugar que sobreviva à função **é pré-requisito da coleta
> automática**, não melhoria. Está registrado em "Bloqueado, e por quem" no
> `AGENTS.md`.

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

## 6. Amazon — ✅ conta criada em 31/07/2026

> **ID de Associado: `radar4yu-20`.** Já está no `.env`, em `AFILIADO_AMAZON`.
> Informações fiscais preenchidas com **CPF**.
>
> **Prazo em curso: 27/01/2027.** Se nenhum link levar a um pedido em 180 dias, a
> conta e o acesso à Central de Associados são revogados. O dono decidiu
> cadastrar mesmo assim, com o argumento de que quatro meses sem três vendas
> significaria que o projeto não anda — e nesse caso a conta é o menor dos
> problemas. Argumento aceito.
>
> **Pendência fiscal registrada:** a conta está no CPF porque ainda não há CNPJ.
> Migrar para pessoa jurídica, ou abrir outra conta no CNPJ, fica para quando a
> empresa existir. Isso conversa com a nota da D-011 sobre enquadramento — há
> divergência entre fontes sobre afiliado digital caber no MEI, e o CNAE
> 7490-1/04 apareceria fora da lista permitida. **Precisa de contador antes de
> repassar dinheiro a terceiro**, que é o que a Fase 3 faz.
>
> **Situação fiscal:** enviada em 31/07, com status **Enviado** — a Amazon ainda
> revisa. Se voltar como pendente, resolver na hora: comissão acumula e não é
> paga enquanto o questionário tributário não for aceito.

### Por que ela era para ficar por último

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
