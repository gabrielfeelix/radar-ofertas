# Pesquisa técnica — o que o mundo faz, e onde nós divergimos

Pesquisa de 28/07/2026, feita para responder uma pergunta que ninguém tinha feito: **as decisões técnicas deste projeto se sustentam contra o que outras pessoas fazem?**

Ela é diferente de `docs/mercado.md`, que olha concorrentes e modelo de negócio. Aqui só tem stack, política de plataforma e arquitetura.

Fontes no fim.

---

## 1. O que ficou confirmado

Vale registrar o que passou no teste, porque decisão validada é decisão que não precisa ser rediscutida na próxima sessão.

### Regra 3.3 — 24 horas de cache da Amazon: **certa**

Fui atrás porque uma fonte secundária afirmava "uma hora para preço". A política oficial diz o contrário, e é literal:

> "You may retain non-image Product Advertising Content for caching purposes for up to 24 hours, after which you must immediately thereafter refresh and re-display."

Preço é conteúdo não-imagem. As 24 horas valem. A regra 3.3 e a função `expurga_precos_expirados` estão corretas.

**Bônus da mesma leitura:** ASIN pode ser guardado por prazo indeterminado — *"You may store individual ASINs for an indefinite period until the termination of this License"*. Ou seja, guardar `anuncio.sku_externo` para sempre é explicitamente permitido, e é o que permite reencontrar o produto depois de expurgar o preço.

### D-015 — GitHub Actions em vez de `pg_cron`: **certa, por metade do motivo**

O argumento de disponibilidade **caducou**: em 2026 o `pg_cron` vem habilitado em todos os planos do Supabase, inclusive o gratuito.

O argumento que sobra é o que sempre importou, e é mais forte do que estava escrito: com `pg_cron`, **projeto pausado ou fora do ar pausa todo agendamento em silêncio**. É a mesma falha silenciosa que a tela "Precisa de atenção" existe para combater. Agendador externo falha visível — o Actions manda e-mail.

A decisão continua de pé; o texto dela precisa trocar o motivo.

### D-016 — OpenNext no Cloudflare Workers: **certa**

O adaptador `@opennextjs/cloudflare` chegou ao 1.0 em fevereiro de 2026 e virou o caminho recomendado pela própria Cloudflare, com o `next-on-pages` descontinuado. Suporta Next 14, 15 e 16.

**Um limite que não estava anotado e vai doer primeiro:** o Worker tem **3 MiB no plano gratuito** e 10 MiB no pago. Aplicação Next.js chega perto disso com facilidade. Também exige KV para o cache de página e R2 para estático acima de 25 MiB.

### D-010 — apostar na Open API de afiliado da Shopee: **certa**

A API é GraphQL, em `affiliate.shopee.com.br/graphql`, autenticada por HMAC-SHA256, e **gera link curto rastreável com subId pela via oficial**.

**Correção de 31/07:** a pesquisa original dizia que a credencial "sai do próprio painel de afiliado, sem porteiro". **Está errado.** O App ID e o Secret **não são autoatendimento**: é preciso abrir um chamado na Central de Ajuda do painel de afiliado, por e-mail, pedindo explicitamente a ativação da API, e a resposta leva **até duas semanas**. Só depois disso a seção "Open API" aparece no painel.

Isso não derruba a D-010 — a via oficial continua sendo a única que não depende de raspagem, e continua resolvendo dado e link na mesma chave. O que muda é o **calendário**, e ele é pior do que parece: **as duas esperas são obrigatoriamente em série, não em paralelo.**

O formulário do chamado exige o **ID de Afiliado** como campo obrigatório, e esse ID só passa a existir depois da conta aprovada. Não dá para adiantar o pedido da API enquanto o cadastro está em análise — verificado na prática em 31/07, com o formulário aberto na tela.

Portanto: **até 3 dias úteis** de análise do cadastro, e só então **até 2 semanas** de análise da API. O planejamento tem que somar os dois.

É exatamente o que a D-010 apostou: uma chave que resolve dado de produto e link rastreável de uma vez.

### A premissa do projeto: **confirmada**

Varri os repositórios abertos do gênero. Eles se dividem em dois tipos:

- **Rastreadores de preço por usuário** (PriceGhost e similares). O problema difícil deles é *extração*: o PriceGhost roda quatro métodos de extração em paralelo que "votam" no preço certo, porque raspagem erra e confunde "economize R$200" com o preço. Nossa aposta em API oficial contorna o problema inteiro que eles gastaram a arquitetura resolvendo.
- **Reescritores de link** (os bots de afiliado do Telegram). Pegam um link, trocam a tag, publicam.

**Nenhum dos dois pontua oferta, decide o que vale publicar, ou divide receita por canal.** A curadoria como diferencial não é conversa de apresentação — é uma lacuna real do que existe publicado.

---

## 2. O que está errado ou incompleto aqui

### 2.1 A PA-API da Amazon foi aposentada, e faz dois meses

**Retirada em 15/05/2026.** Não aceita cliente novo e devolve 403. A substituta é a **Creators API** — autenticação nova, endpoint novo, formato novo. Não é troca de configuração.

Nada no repositório menciona nenhuma das duas, então não há código para consertar. O que muda é o **planejamento**: "coletor de preço da Amazon" é trabalho maior do que o roadmap supõe, e a Amazon deve descer na fila. Reforça a D-010.

**A verificar antes de planejar:** a PA-API exigia **10 vendas qualificadas nos últimos 30 dias** para manter acesso. Se a Creators API herdou a regra, a compra de teste da Fase 0 **não** destrava o coletor da Amazon — ele só funciona depois de volume real de vendas. Isso inverteria a ordem de prioridade entre lojas.

### 2.2 `produto.imagem_url` guarda o que a política proíbe guardar

A regra é literal e mais dura para imagem do que para preço:

> "You will not store or cache Product Advertising Content consisting of an image, but you may store a link to Product Advertising Content consisting of an image for up to 24 hours."

Guardamos a URL sem prazo e sem regra por loja. O preço tem `expurga_precos_expirados`; a imagem não tem nada.

Hoje é inofensivo porque não existe coleta de imagem. Deixa de ser no dia em que existir — e o componente `Identidade` já está pronto para receber `imagem`, então a porta está aberta.

**É a mesma regra 3.3, com metade da aplicação.**

### 2.3 O PWA colide com uma cláusula da Amazon

> "If your application includes a client application, the client application may not store or cache Product Advertising Content."

A D-018 escolheu PWA. Service worker cacheando uma tela que mostra preço da Amazon viola isso — e cache offline é exatamente o tipo de coisa que alguém liga achando que é melhoria.

Precisa estar escrito **antes** de existir service worker, não depois.

---

## 3. O que fazer

| # | O quê | Custo |
|---|---|---|
| 1 | Corrigir o motivo da D-015: visibilidade da falha, não disponibilidade do `pg_cron` | documentação |
| 2 | Estender a regra 3.3 à imagem — 24h, por loja, com expurgo | migration pequena |
| 3 | Anotar a cláusula do cliente na D-018, antes de existir service worker | documentação |
| 4 | Registrar a morte da PA-API em `docs/infra.md` | documentação |
| 5 | Anotar o limite de 3 MiB do Worker gratuito | documentação |

Nenhuma delas mexe em item da seção 2 do `AGENTS.md`. Todas são regra e prazo.

---

## Fontes

- [Amazon Associates — Program Policies](https://affiliate-program.amazon.com/help/operating/policies) — a regra de cache, imagem e ASIN, na fonte primária
- [Amazon — depreciação da PA-API v5](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation)
- [Guia de migração PA-API → Creators API](https://blog.freshstore.com/amazon-creators-api-pa-api-retirement/) — datas e impacto
- [Supabase cron jobs em 2026](https://crontap.com/guides/supabase-cron-jobs) — `pg_cron` no plano gratuito, e a falha silenciosa
- [OpenNext — Cloudflare](https://opennext.js.org/cloudflare)
- [Cloudflare Workers — Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) — limite de tamanho do Worker
- [Shopee Afiliados — Open API (BR)](https://affiliate.shopee.com.br/open_api)
- [PriceGhost](https://github.com/clucraft/PriceGhost) — arquitetura de rastreador de preço
- [botaffiumeiro](https://github.com/hectorzin/botaffiumeiro) — reescritor de link de afiliado
