# De onde saem as ofertas: como quem toca canal de promoção descobre que um produto ficou barato antes dos outros

Pesquisa realizada em 01/08/2026. Metodologia: 30 buscas WebSearch (PT-BR e EN) + 21 páginas lidas via WebFetch, cobrindo documentação oficial, fóruns, GitHub, blogs de afiliado e comunidades de "erro de preço". Cada achado está marcado como [OFICIAL] (documentação da empresa/API), [RELATO] (post de usuário/fórum/comunidade), [VENDEDOR] (empresa que vende ferramenta/serviço) ou [BLOG] (conteúdo editorial de terceiro).

---

## 1. APIs oficiais de afiliado — o que cada uma entrega de verdade

### 1.1 Amazon PA-API 5.0 (Product Advertising API)

**Status atual — atenção**: em 2026 a Amazon está migrando a PA-API 5 para uma nova "Creators API". A página oficial de troubleshooting/rates da PA-API 5 (`webservices.amazon.com/paapi5/...`) hoje **redireciona** para um aviso de descontinuação: "PA-API 5 is no longer the recommended way to access Amazon's product catalog", com contas antigas recebendo `HTTP 403 AccessDeniedException` [OFICIAL — https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation, consultado 01/08/2026]. Isso é relevante para qualquer projeto que planeje se apoiar nela a longo prazo.

**Limites de taxa (regras "clássicas" da PA-API 5, ainda documentadas em espelhos de terceiros):**
- Conta nova: até **1 requisição/segundo (TPS)** e **8.640 requisições/dia (TPD)** durante os primeiros 30 dias após aprovação [OFICIAL/espelho — http://docs.aa-team.com/woocommerce-amazon-affiliates/documentation/pa-api-5-restrictions-requirements/].
- Depois dos 30 dias, o limite passa a ser **proporcional à receita gerada**: 1 TPD extra a cada US$ 0,05 (5 centavos) de receita de itens enviados nos últimos 30 dias, até um teto de 10 TPS a cada US$ 4.320 de receita [mesma fonte, confirmado também na busca sobre "PA API 5 Rates" — https://docs.aa-team.com/woocommerce-amazon-affiliates/documentation/pa-api-5-rates/].
- **GetItems aceita até 10 ASINs por chamada**, contando como 1 única transação — ou seja, dá para consultar 10 produtos "no preço" de 1 [WebSearch, confirmado por múltiplas fontes].
- PA-API 5 só importa **as primeiras 10 variações** de um produto com múltiplas opções (cor/tamanho) [docs.aa-team.com, mesma página].
- Exige HTTPS/SSL no site que consome os dados [mesma fonte].

**Regra das 24 horas de cache — texto oficial:**
> "você pode armazenar um link para Conteúdo de Publicidade de Produtos consistindo em uma imagem por até 24 horas, e pode armazenar outro Conteúdo de Publicidade de Produtos que não seja imagem para fins de cache por até 24 horas, mas se fizer isso deve imediatamente atualizar e reexibir o conteúdo." Além disso, **ASINs podem ser guardados indefinidamente** (o identificador, não o preço/estoque), e se o app atualiza os dados com frequência **menor que 1x/hora**, é obrigatório exibir um **timestamp** ao lado do preço/disponibilidade [OFICIAL — Amazon Associates Operating Policies, via https://affiliate-program.amazon.com/help/operating/policies, resumido em WebSearch 01/08/2026].

Conclusão prática: a Amazon **não permite** montar um catalog estático de preços com a API — o preço tem que ser refrescado pelo menos a cada 24h (idealmente de hora em hora, para não precisar do timestamp), e o volume de chamadas de quem está começando é baixo (8.640/dia = ~6/min), o que **exige priorização de quais ASINs monitorar**.

### 1.2 Mercado Livre

O Mercado Livre tem uma família de endpoints em `api.mercadolibre.com/seller-promotions/...` acessível a **vendedores** (não a afiliados terceiros generalistas) via OAuth Bearer token [OFICIAL — https://developers.mercadolivre.com.br/pt_br/ofertas-relampago e https://developers.mercadolivre.com.br/pt_br/ofertas-do-dia, ambos consultados 01/08/2026]:

- **Ofertas relâmpago (LIGHTNING)**:
  `GET /seller-promotions/promotions/$PROMOTION_ID/items?app_version=v2&promotion_type=LIGHTNING` — retorna id do item, datas de início/fim, status (`candidate`, `pending`, `started`, `finished`), preço e faixa de desconto permitida, estoque mínimo/máximo reservado.
  Importante: **uma vez ativada, a oferta relâmpago não pode ser removida, só pausada**.
- **Ofertas do dia (DOD)**: mesmo padrão de endpoint, trocando `promotion_type=DOD`. Também progride pelos estados `candidate → pending → started → finished`, com paginação (offset/limit/total).
- **API de Preços**: `GET /items/$ITEM_ID/sale_price` retorna o preço vencedor atual filtrado por canal de venda e nível de fidelidade do comprador; `GET /items/$ITEM_ID/prices` retorna todos os preços válidos (padrão e promocionais) com datas e canais. Existe também um sistema de **notificação/webhook** no tópico `items_prices` que dispara quando o preço muda — ou seja, dá para ser avisado em tempo real de mudança de preço de itens que você acompanha, sem precisar ficar pooling [OFICIAL — https://developers.mercadolivre.com.br/pt_br/api-de-precos].
- Desde 18/03/2026, se a automação de preço estiver ativa no item, **updates diretos de preço via PUT /items são rejeitados com erro 400** — reforça que o ML está fechando a porta de manipulação externa de preço e empurrando tudo para os endpoints dedicados de promoção [mesma fonte].

Conclusão: **não existe um endpoint público "me dê a lista de ofertas relâmpago de hoje" para qualquer afiliado** — o acesso pleno a `seller-promotions` é por vendedor autenticado. Isso explica por que praticamente ninguém fora do próprio seller/ML consegue "puxar" a lista de ofertas relâmpago via API oficial, e por que scrapers de terceiros (ver seção 2) existem especificamente para cobrir a seção "Ofertas do Dia" pública do site.

### 1.3 Shopee Open API / Affiliate API

A API de afiliados da Shopee **é exposta via GraphQL**, com queries como `productOfferV2`, `shopOfferV2` e `shopeeOfferV2` (campanhas) [WebSearch, confirmado por múltiplas fontes incluindo Stack Overflow e Apify]. Fluxo:
- Cadastro no programa de afiliados Shopee → recebe `app_id` + `secret_key`.
- Toda chamada exige assinatura (`signature`) calculada com o `secret_key` sobre os parâmetros da requisição — erro comum reportado é "Invalid Signature" quando a assinatura é montada errado [RELATO — Stack Overflow, via busca].
- Endpoint tem **Explorer interativo** por região: `https://open-api.affiliate.shopee.com.br/explorer/v2` para o Brasil (não consegui abrir o conteúdo — retornou 403 ao WebFetch, provavelmente exige sessão logada, mas a existência do endpoint confirma cobertura Brasil).
- Retorna preço, comissão, e permite gerar **short link** de afiliado e puxar relatório de conversão.

### 1.4 AliExpress Affiliate API

Acesso via **AliExpress Open Platform**, modelo key/secret + tracking ID. Bibliotecas wrapper (Python, PHP) expõem:
- `get_products()` — busca por `keywords` + `max_sale_price`.
- `get_hotproducts()` — catálogo de "Hot Product" (produtos com alta comissão destacados pela própria AliExpress), mesmos parâmetros de busca [WebSearch — Botize, vandevliet.me].
- `get_products_details()` — detalhes por ID ou URL de produto.
- `get_affiliate_links()` — gera o link de afiliado rastreado a partir de uma URL de produto.
- `get_parent_categories()` / `get_child_categories()`.
- Para acessar o catálogo **Hot Product / New Arrival / Best Seller / weeklydeals** é preciso solicitar acesso à **"Advanced API"**, um nível de permissão extra além do básico [WebSearch — community.make.com, elfsight.com].
- Lib Python de referência: `sergioteula/python-aliexpress-api`, MIT, 127 estrelas, sem rate limit documentado no README [GitHub — https://github.com/sergioteula/python-aliexpress-api, consultado 01/08/2026].

### 1.5 Awin

Não tem uma "API de ofertas" no sentido de erro de preço/flash sale — o modelo é **datafeed + ferramentas de link**:
- **Create-A-Feed**: interface que gera feed customizado (CSV/XML) por anunciante, categoria, ou combinação de vários anunciantes; suporta **URL dinâmica** que se atualiza automaticamente com mudanças de preço/estoque [OFICIAL — https://www.awin.com/br/marketing-de-afiliacao/aproveitando-as-ferramentas-awin, consultado 01/08/2026].
- Anunciantes com **mais de 20 produtos** são orientados a produzir um feed de produto e subir na interface — ou seja, o padrão de mercado do Awin pressupõe catálogos médios/grandes, não SKUs avulsos [mesma fonte, seção "produzir um feed de produto"].
- Formatos suportados: CSV, XML, com opção de delimitador e compressão configuráveis.
- **Link Builder** (deeplink automático), **MyAwin** (extensão Chrome que já mostra "as últimas ofertas de consumidor da Awin" e cupons exclusivos direto no site do anunciante) e **Opportunity Marketplace** completam o kit.

### 1.6 Rakuten Advertising

Modelo equivalente ao Awin — **Product Catalog** processado internamente e distribuído a publishers via **SFTP**, formatos CSV/TSV (com compressão .zip/.gz) [OFICIAL — https://pubhelp.rakutenadvertising.com/hc/en-us/articles/11258487715981-Product-Catalog-Data-Feed-Implementation-Guidelines, título confirmado via busca; fetch retornou 403 mas o título e resumo do datafeed foram capturados na busca]. Há também **Link Locator API** (busca links/criativos de anunciantes parceiros) e **Advertisers API** (lista/descobre novos anunciantes) [WebSearch — pubhelp.rakutenadvertising.com].

### 1.7 Lomadee

Programa brasileiro de afiliados (modelo CPA), com **API de Ofertas** própria:
- Permite consultar ofertas, produtos e categorias de todos os parceiros, e gerar links rastreados via API.
- Também dá para consultar cupons ativos e checar vendas/comissões.
- Autenticação via `app-token` + `sourceId`.
- **Recomendação oficial de cache**: "não é recomendado o uso de cache para os recursos da API de ofertas, pois as lojas alteram preço e disponibilidade a qualquer momento", mas se cachear, **validar a cada 30 minutos** se a oferta ainda está disponível [OFICIAL — developer.lomadee.com / developer.socialsoul.com.vc, capturado via WebSearch 01/08/2026; ambos os domínios deram erro de DNS ao tentar WebFetch direto, possivelmente domínio trocado/descontinuado — sinal de que a Lomadee pode estar em transição de infraestrutura].

### 1.8 Zoom / Buscapé

Não é uma API de "puxar ofertas" — é o **inverso**: API para **lojistas enviarem** seus produtos ao comparador:
- REST API permite ao lojista **adicionar, remover, atualizar e buscar** produtos no portfólio da loja dentro do Zoom&Buscapé.
- Ofertas enviadas em **lote, máximo de 1.000 ofertas por requisição**.
- Cada oferta precisa ter ao menos uma opção de preço à vista e uma de parcelamento (boleto, cartão à vista, cartão com/sem juros).
- Autenticação via `auth-token`, obtido só falando com o time comercial do Buscapé [OFICIAL/via Postman — https://documenter.getpostman.com/view/4582221/SWTK3tt8, capturado via WebSearch].
- Ou seja: **para um canal de ofertas, o Zoom não é fonte de dados via API — é fonte via raspagem do site público** (que expõe histórico de preço, ver seção 8).

### 1.9 Magalu

A API pública do Magalu (`developers.magalu.com`) é voltada para **sellers do marketplace**, não para afiliados: endpoints de SAC, Pedidos, e desde novembro/2024 um módulo de **Produtos/Catálogo** com consulta de SKUs, preços, estoques e webhooks [OFICIAL — https://developers.magalu.com/releases.html, consultado 01/08/2026]. **Não há programa de afiliados exposto via API** — o "Parceiro Magalu" é via link manual/vitrine, e um afiliado real reclamou publicamente no Reclame Aqui da "falta de API completa e ferramentas de rastreamento para afiliados no Magalu", pedindo que a API permitisse busca e consulta de produto diretamente em vez de navegação manual no site [RELATO — https://www.reclameaqui.com.br/magazine-luiza-loja-online/falta-de-api-completa-e-ferramentas-de-rastreamento-para-afiliados-no-magalu_BImM0a874cW1L8Gk/, capturado via WebSearch].

### 1.10 Americanas / Netshoes

- **Netshoes Marketplace API**: focada em **sellers** (cadastro de produto, inventário, preço, notificação de pedido/status), com ambientes Sandbox e Produção e SDKs para download. Não é API de afiliado — é API de operação de marketplace [OFICIAL — https://developers.netshoes.com.br/api-portal/content/entenda-api, consultado 01/08/2026].
- **Programa de afiliados Netshoes**, batizado "Parceiro Netshoes", relançado com comissão de até 13% dependendo do valor da compra e do "score" do vendedor — mas isso é link de afiliado tradicional, não API [WebSearch — mercadoeconsumo.com.br].
- Americanas: nenhuma menção a API pública de afiliados encontrada nas buscas; o padrão de mercado parece ser via Lomadee/Awin/Rakuten como intermediários.

**Resumo da seção 1**: das plataformas pesquisadas, só **Mercado Livre** (webhook de preço) e **Lomadee** (API de ofertas dedicada) têm algo parecido com "me avise quando o preço mudar" de forma nativa. Amazon é a mais restritiva em volume (TPD baixo no início) mas a mais explícita em regras de cache. Shopee e AliExpress têm APIs de afiliado robustas focadas em catálogo/comissão, não em "oferta relâmpago" per se. As redes de datafeed (Awin, Rakuten) pressupõem catálogos grandes atualizados em lote, não velocidade de segundos.

---

## 2. Feeds e datafeeds — quem usa

- **Awin Create-A-Feed**: XML/CSV, atualização dinâmica via URL, pensado para catálogos com 20+ produtos, plugins prontos para WordPress (ex.: "Awin Data Feed" no WordPress.org) [OFICIAL/VENDEDOR — https://wordpress.org/plugins/awin-data-feed/, via busca].
- **Rakuten**: SFTP, CSV/TSV, compressão zip/gzip.
- **Amazon**: tem "Data Feeds" citados na própria política de cache — se os dados vierem de Data Feed em vez de chamada de API, a regra de atualização de timestamp/hora ainda se aplica [OFICIAL, Associates Operating Policies].
- **Shopee**: não usa datafeed tradicional — tudo via GraphQL sob demanda.
- Quem usa datafeed na prática: sites de **comparação de preço** (agregadores como Zoom/Buscapé do lado oposto, recebendo feed do lojista) e afiliados de **catálogo grande** (cupons, moda, cosméticos) que preferem importar milhares de SKUs de uma vez a fazer chamada individual. Canais de "oferta relâmpago"/Telegram **não usam datafeed** — é rápido demais para o ciclo de atualização em lote (geralmente diário ou de poucas em poucas horas) que datafeeds oferecem.

---

## 3. Agregadores como fonte — API pública? RSS? Quem raspa e como

| Agregador | API pública? | RSS? | Modelo de alimentação |
|---|---|---|---|
| Promobit | Não encontrada | Não encontrado | Curadoria: usuários enviam, equipe modera "mais de 200 ofertas diariamente" [OFICIAL — https://www.promobit.com.br/o-que-e-promobit/] |
| Pelando | Não encontrada | Não encontrado (só páginas `/recentes`) | Qualquer usuário publica oferta/cupom; ranqueamento por voto comunitário; equipe "monitora tudo de perto, revisando cada publicação" [OFICIAL — https://ajuda.pelando.com.br/como-usar-o-pelando/] |
| Hardmob (fórum Promoções) | Não; é fórum comum (vBulletin-like) | Não confirmado | Postagem manual por usuários cadastrados há 30+ dias e com 45+ mensagens no fórum [RELATO — https://www.hardmob.com.br/threads/488256-Regra-dos-45-posts-no-forum-de-promocoes-vs-flood]. Tem conta oficial no X/Twitter (@hardmob_promo) que provavelmente espelha os tópicos. |
| Gatry | Não encontrada | Não encontrado | Comunidade tipo Pelando, com seção "Recebidos" sugerindo notificação; parceiros visíveis incluem Amazon BR, Mercado Livre, Drogaria Raia [WebFetch — https://gatry.com/] |
| Zoom/Buscapé | API só para **lojista enviar** produto, não para consumir ofertas | Não encontrado | Feed de preço enviado pelo lojista via API/Postman documentada |
| Slickdeals (EUA, referência) | Extensão de navegador + fórum comunitário; sem API pública documentada nas buscas | — | "Deal Alerts" configuráveis por palavra-chave/loja; comunidade de +12 milhões de usuários [OFICIAL/VENDEDOR — https://daily.slickdeals.net/shopping/how-to-find-amazon-price-mistakes/] |
| Camelcamelcamel | **Tem API** (via terceiros tipo Parse.bot) mas não cobre Amazon Brasil | — | Ver seção 4 |
| Keepa | **Tem API oficial paga**, cobre Amazon Brasil | — | Ver seção 4 |

**Quem raspa quem, na prática**: como nenhum agregador brasileiro (Promobit, Pelando, Gatry) expõe API pública, times que constroem produtos em cima dessas fontes recorrem a **scraping direto do HTML** ou dependem inteiramente da própria curadoria manual. Isso é reforçado pelo padrão encontrado em bots como o Gafanhoto (seção 5) que **raspa o fórum do Hardmob por falta de alternativa oficial**.

---

## 4. Keepa e camelcamelcamel

### Keepa
- Ferramenta de referência para histórico de preço Amazon, com gráficos de preço novo/usado/warehouse, **Sales Rank**, histórico de **Buy Box** e contagem de ofertas, cobrindo "mais de 6 bilhões de produtos" [VENDEDOR — keepa.com, via WebSearch].
- **Planos de assinatura a partir de €19/mês**; para uso pesado (vendedores/agências) há planos de até ~CAD 50/mês [WebSearch — fbamultitool.com].
- **API baseada em tokens**: cada assinatura de API gera um número de tokens por minuto, e **todos os tokens expiram 60 minutos após serem criados** — ou seja, é preciso gastar a cota ou perder [WebSearch — resumo da doc oficial, fetch direto bloqueado por 403].
- Permite configurar **price watches**: alerta quando o produto cai abaixo de um preço-alvo ou volta ao estoque.
- Amplamente citado como ferramenta de referência mesmo para quem opera no Brasil, mas focado no catálogo Amazon (US/outras locales — não há confirmação de cobertura BR nas fontes consultadas).

### Camelcamelcamel
- Modelo de negócio: alertas por e-mail quando o preço cruza um limiar definido pelo usuário; gráficos de 3 tipos de preço (Amazon, terceiro novo, terceiro usado) com máxima/mínima/média histórica [WebSearch — resumo, fetch direto bloqueado por 403].
- **API não-oficial via Parse.bot**: endpoint `get_popular_products` retorna lista deduplicada de produtos populares (nome, ASIN, URL) — mas **não retorna configuração de alerta ou watchlist de usuário**, só dados públicos [WebSearch — https://parse.bot/marketplace/887bdb14-2889-4486-a776-90f8edba8f0f/camelcamelcamel-com-api].
- **Locales suportados**: Canadá, França, Alemanha, Itália, Japão, Espanha, Reino Unido e Estados Unidos — **Brasil não está na lista de locales suportados** [WebSearch, resumo da doc do produto]. Isso é um achado relevante: quem monitora Amazon.com.br não pode contar com camelcamelcamel; a opção seria Keepa (se cobrir BR) ou monitoramento próprio.

---

## 5. Erro de preço ("pricing error", "bug de preço", "pit stop") — a maior fonte de engajamento

Este é provavelmente o achado mais forte da pesquisa: **velocidade de aviso é o produto**, e há uma distinção clara entre lista pública (ruído, atraso) e curadoria (filtro, mas ainda mais rápida que o "boca a boca" de listas lotadas).

- Definição de mercado: bug de preço ocorre por "erro de cadastro (vírgula no lugar errado)" ou "falha de integração de sistemas" — não é promoção deliberada [BLOG — https://www.relampagoofertas.com.br/home/blog/bug-de-preco.html, publicado 26/06/2026].
- **Ciclo de vida**: "variável e curto — de poucos segundos a algumas horas, dependendo de quão rápido a loja percebe"; quando o volume de pedidos anormal denuncia o erro, a loja corrige e cancela as compras [mesma fonte].
- **Listas públicas lotadas = atraso e ruído**: "quando a mensagem chega até você, o erro já pode ter sido corrigido"; **curadoria humana filtra o que é bug real, confere a loja oficial, descarta links suspeitos e só então avisa** [mesma fonte — este é o argumento comercial de serviços pagos de curadoria de erro de preço].
- No Reddit (referência internacional, mesma dinâmica se replica no Brasil): "a comunidade está simultaneamente procurando e documentando, com posts batendo minutos depois do glitch ir ao ar"; "posts com 500+ upvotes em r/deals são quase sempre preços genuinamente bons — a comunidade é agressiva em downvotar ofertas medianas ou descontos inflados"; **erros de preço da Amazon e Lightning Deals costumam aparecer entre meia-noite e 6h**, quando algoritmos de precificação automática erram mais; "a maioria dos glitch deals está morta antes do post chegar a 100 comentários" [RELATO/BLOG — via WebSearch, blippr.com e daily.slickdeals.net, consultado 01/08/2026].
- Caso concreto documentado: **Smart TV Samsung de 82" avaliada em US$ 4.500 vendida por US$ 131 (redução de 97%) em 2020** via erro de preço detectado pela comunidade Slickdeals [BLOG — https://daily.slickdeals.net/shopping/how-to-find-amazon-price-mistakes/].
- **Discord como canal dedicado**: existem servidores Discord inteiramente dedicados a "price errors" — "essas Discords facilitam a compra de itens com desconto pesado, e às vezes até grátis, para revenda ou uso próprio... e notificam assim que o erro acontece"; comunidades rastreiam "glitch deals, erros de preço, empilhamento de cupom, erros da Amazon/Walmart/Target, flash sales e descontos extremos antes que desapareçam", com "monitores customizados raspando varejistas 24/7" [RELATO — DISBOARD/cook-groups.com, via WebSearch]. Legalidade: comprar em erro de preço é legal nos EUA; a loja pode cancelar se perceber antes do envio.
- No Brasil, aparentemente **não existe um sub-fórum "Pit Stop" isolado e documentado publicamente** dentro do Hardmob (a busca específica por essa nomenclatura não trouxe confirmação — pode ser jargão de nicho não indexado, ou pode ter mudado de nome). O fórum "Promoções" do Hardmob é o canal geral, com regra de acesso de **30 dias de cadastro + 45 mensagens mínimas** para poder postar, o que funciona como filtro anti-spam/anti-bot [RELATO — https://www.hardmob.com.br/threads/488256-Regra-dos-45-posts-no-forum-de-promocoes-vs-flood].

**Conclusão da seção 5**: sim, erro de preço é claramente tratado pelo mercado (blogs, Discord, fóruns) como o evento de maior engajamento por unidade de tempo — a literatura toda gira em torno de "quem avisa primeiro ganha", e isso gerou um mercado de curadoria paga (ex.: relampagoofertas.com.br cobra para filtrar e avisar mais rápido que listas públicas).

---

## 6. Monitoramento de preço próprio — frequência, SKUs, bloqueio

O achado mais concreto e quantificado da pesquisa inteira veio de um produto comercial brasileiro real:

### PromoBot (ofertasbot.com) [VENDEDOR — https://ofertasbot.com/, consultado via WebSearch e WebFetch em 01/08/2026, fetch direto retornou 403 mas conteúdo foi capturado pela busca]
- Monitora **Kabum e Terabyte** em paralelo, com "validação de estoque e preço" antes de disparar alerta.
- Frequência: "monitoramento 24/7, sem pausa", com **ciclos de aproximadamente 6 a 19 segundos por loja**.
- Throughput declarado: **pico de 287 ofertas/hora**.
- Ofertas processadas "em segundos" após publicação na loja.
- Roadmap: Amazon e Pichau "já estão na fila".
- Modelo de negócio (revela como monetizam e para quem vendem):
  - Básico R$ 47/mês — 1 canal, link manual.
  - Pro R$ 97/mês — até 3 canais, **link de afiliado automático** (ou seja, o bot já gera o link de afiliado sozinho a partir do produto raspado).
  - Ultra R$ 197/mês — canais ilimitados, acesso a API.
  - O próprio marketing do produto estima que o plano Pro "se paga com ~6 vendas" mensais de comissão.

### Gafanhoto (bot open source, Hardmob) [OFICIAL/GitHub — https://github.com/robsonbittencourt/gafanhoto, consultado 01/08/2026]
- Raspa e armazena URLs de tópicos do fórum de Promoções do Hardmob.
- Usuário configura monitor por palavra-chave via comando `/monitorar` no Telegram; recebe notificação quando aparece tópico compatível.
- Stack: Java/Maven, MongoDB, Docker, Telegram Bot API, CI via Travis/Jenkins. 52 estrelas no GitHub — projeto de nicho mas mantido com rigor de engenharia (SonarCloud para cobertura/vulnerabilidades).
- Frequência de checagem não documentada explicitamente no README.

### Scraping de Mercado Livre como alternativa à API oficial
Scraper comercial (Apify, `karamelo/mercadolivre-scraper-brasil-portugues`) existe **especificamente para cobrir a lacuna da API oficial**: extrai posição no ranking de busca, tipo de resultado, indicador de patrocinado, e tem **modo dedicado para a seção "Ofertas do Dia"** — dado que a API `seller-promotions` só é acessível a vendedores autenticados, não a terceiros que querem só ler as ofertas públicas do site [WebFetch — https://apify.com/karamelo/mercadolivre-scraper-brasil-portugues/api, consultado 01/08/2026]. Também é usado para "criação de histórico de preço e datasets para BI/IA/RAG/agentes autônomos" — confirmando que **quem quer histórico de preço do ML precisa raspar, porque a API não oferece isso a terceiros**.

### Bloqueio/captcha/proxy
A pesquisa dedicada a esse subtema não retornou fontes específicas de e-commerce brasileiro antes de esgotar o orçamento de busca da sessão. O que ficou confirmado por adjacência: ferramentas de scraping "corporativas" (ex.: descrição genérica de automação de scraping) mencionam lidar com "anti-bot challenges, browser fingerprinting, e integração de rotação de proxy com proxies residenciais de alta qualidade" como prática padrão de mercado para scraping em escala [WebSearch, resumo genérico — automatio.ai].

---

## 7. Copiar de outros canais — como se organiza

- Blogs voltados a quem quer montar canal de ofertas **desaconselham explicitamente copiar link de afiliado de outro canal**: "usar links de outro afiliado não gera comissão e prejudica sua reputação se descoberto" — a orientação de mercado é "observe o que canais maiores estão postando para entender quais ofertas estão gerando engajamento, mas não copie — use como referência" [BLOG — via WebSearch, digital.app.br/fluxopromo.com].
- Isso implica, na prática de mercado, que existe um espectro: (a) canais que **descobrem** oferta primeiro (via scraping próprio, API, ou fórum), (b) canais que **reescrevem/republicam** a mesma oferta trocando o link de afiliado pelo próprio (prática amplamente reconhecida, mas malvista/arriscada de reputação), e (c) canais que **misturam preço inflado com "de/por" falso** — mencionado como problema conhecido: "alguns grupos repetem links e outros divulgam preço inflado com falso desconto, por isso é importante verificar a qualidade do canal antes de seguir" [BLOG — mesma fonte].
- Não foi encontrado dado quantitativo confiável (percentual do mercado) sobre "quantos canais só repostam" — as buscas não retornaram nenhuma pesquisa de mercado ou survey formal sobre isso; é uma lacuna de dados públicos.
- Sinal indireto forte: a existência de produtos como o PromoBot cujo diferencial de venda é justamente **"link de afiliado automático"** sugere que uma fração significativa do mercado de canais de Telegram/WhatsApp de ofertas **não descobre nada por conta própria** — paga um serviço terceirizado que descobre e converte o link automaticamente, e o "dono do canal" só posta.

---

## 8. Como sabem que é desconto de verdade — ferramentas de histórico

- **Zoom.com.br "Histórico de Preços"**: mostra a variação de preço de um produto por **até ~40 dias ou cerca de 6 meses** (a fonte não é precisa sobre qual é o real teto de retenção); usado explicitamente para "reconhecer ofertas reais" comparando o preço atual com o histórico [OFICIAL/BLOG — https://www.zoom.com.br/zoom-explica/deumzoom/historico-de-precos-do-zoom, consultado 01/08/2026].
- Técnica de detecção de "meia do dobro" (desconto inflado) descrita por um blog de consumo: **se o gráfico mostra um pico súbito para cima nas últimas semanas antes da "promoção", o desconto é maquiado** — exemplo dado: produto estável em R$ 1.200 por meses, sobe para R$ 2.400 na semana anterior à campanha, "cai" para R$ 1.100 durante a promoção — desconto real de R$ 100 (não os 54% anunciados) [BLOG — via WebSearch, techtudo/serasa].
- **Promobit** afirma que a própria curadoria da equipe usa "histórico de preço" como um dos critérios de aprovação de oferta enviada por usuário, explicitamente para "desmascarar falsas promoções e garantir o menor preço" [OFICIAL — https://www.promobit.com.br/o-que-e-promobit/].
- Fora do Brasil, Keepa/camelcamelcamel cumprem esse papel de forma mais granular (gráfico diário/por hora), mas como visto na seção 4, **camelcamelcamel não cobre Amazon Brasil**, deixando um vazio de ferramenta gratuita de histórico de preço específica para o mercado brasileiro fora do Zoom/Buscapé.

---

## 9. Tempo entre a oferta aparecer e o post sair — relatos concretos

Dado quantificado mais direto encontrado, do próprio material comercial do PromoBot: **ofertas processadas "em segundos" após publicação na loja**, com ciclo de scraping de **6 a 19 segundos por loja monitorada** e pico de **287 ofertas/hora** de throughput [VENDEDOR — ofertasbot.com, via WebSearch].

Para erro de preço especificamente (seção 5), o consenso das fontes é que a **janela útil de ação é de segundos a poucas horas**, e "a maioria dos glitch deals está morta antes do post chegar a 100 comentários" no modelo Reddit/Slickdeals — ou seja, mesmo em comunidades gigantes, boa parte do valor do erro já foi capturado por quem viu primeiro.

Não foram encontrados relatos pessoais detalhados e datados (ex. "eu vi a oferta às 14h02 e postei às 14h03") em fóruns brasileiros dentro do escopo desta pesquisa — o dado mais próximo disso é o material de marketing quantificado do PromoBot acima, que embora seja [VENDEDOR] (logo, com viés a favor do produto), é o número mais concreto e específico disponível sobre a prática no Brasil.

Prazos de **comissão/pagamento** (não confundir com velocidade de descoberta) também ficaram documentados: Mercado Livre libera comissão só depois de **até 60 dias** da compra (período de "quarentena da venda"); Shopee leva de **3 a 5 dias úteis** para analisar cadastro de anúncio de afiliado e até **7 dias úteis** para aprovar o afiliado [BLOG — via WebSearch, afiliadolivre.com.br e portalinsights.com.br].

---

## 10. Achados adicionais relevantes fora do roteiro original

- **Canal de Telegram como formato dominante no Brasil**: blogs de afiliação relatam que "um canal com 3.000 seguidores que posta 50 ofertas por dia pode gerar de 15 a 40 vendas diárias" e, com comissão média de R$5–15 por venda, chega a **R$2.250–18.000/mês**; e que "afiliados que automatizam reportam ganhos 5–10x maiores que os que fazem tudo na mão" [BLOG — via WebSearch, fluxopromo.com, rendaextradeverdade.com.br]. Isso reforça por que existe todo um mercado de bots pagos (PromoBot e concorrentes) — a automação de descoberta + postagem é percebida como o maior alavancador de receita, mais que o conteúdo em si.
- **Regra de acesso do Hardmob (30 dias de cadastro + 45 mensagens)** funciona como filtro anti-spam que também atrasa a entrada de bots/scrapers automatizados novos na comunidade — uma barreira estrutural que favorece contas antigas/estabelecidas na corrida por postar primeiro.
- **Rakuten, Awin e Lomadee** têm em comum o padrão "catálogo grande, atualização em lote (SFTP/feed diário)" — nenhuma delas é desenhada para velocidade de segundos; são o oposto do caso de uso de erro de preço/oferta relâmpago.

---

## Lacunas e limites desta pesquisa

- Orçamento de WebSearch da sessão se esgotou em 30 buscas (limite de 200 chamadas compartilhado, atingido durante a sessão) antes de cobrir com a mesma profundidade: bloqueio/captcha/proxy específico de e-commerce brasileiro, dados quantitativos sobre proporção de canais que só repostam, e confirmação/negação da existência de um sub-fórum "Pit Stop" nomeado assim no Hardmob.
- Vários fetches diretos retornaram 403 (Keepa, camelcamelcamel, GitHub python-aliexpress-api, developers.magalu.com para hardmob, Rakuten pubhelp, disboard.org) — nesses casos o conteúdo foi reconstruído a partir dos resultados de busca (snippets), não da página completa; tratados aqui como [WebSearch] em vez de [WebFetch] direto.
- `developer.lomadee.com` e `developer.socialsoul.com.vc` retornaram erro de DNS (ENOTFOUND) nas duas tentativas de fetch direto — possível sinal de que a infraestrutura de documentação da Lomadee mudou de domínio ou está fora do ar no momento da pesquisa (01/08/2026); os dados sobre a API de Ofertas Lomadee vêm de snippets de busca, não de leitura direta da doc.

---

## Fontes consultadas

1. https://webservices.amazon.com/paapi5/documentation/troubleshooting/api-rates.html (redirecionou para #2)
2. https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation
3. https://webservices.amazon.com/paapi5/documentation/best-programming-practices.html (redirecionou para #2)
4. http://docs.aa-team.com/woocommerce-amazon-affiliates/documentation/pa-api-5-restrictions-requirements/
5. https://docs.aa-team.com/woocommerce-amazon-affiliates/documentation/pa-api-5-rates/
6. https://affiliate-program.amazon.com/help/operating/policies
7. https://a2sdeveloper.com/page-working-with-the-one-second-rule.html (403 ao abrir; título/contexto via busca)
8. https://developers.mercadolivre.com.br/pt_br/ofertas-relampago
9. https://developers.mercadolivre.com.br/pt_br/ofertas-do-dia
10. https://developers.mercadolivre.com.br/pt_br/api-de-precos
11. https://developers.mercadolivre.com.br/pt_br/mercado-envios-modo-2/ofertas-relampago
12. https://open-api.affiliate.shopee.com.br/explorer/v2 (403 ao abrir; existência confirmada via busca)
13. https://github.com/bcat95/shopee-aff
14. https://github.com/mu-hanz/shoapi
15. https://community.make.com/t/aliexpress-affiliate-api/96695
16. https://botize.com/en/method/aliexpress_associates/search_hotproduct
17. https://vandevliet.me/how-to-make-aliexpress-affiliate-api-call/ (erro 522 ao abrir; conteúdo via busca)
18. https://elfsight.com/blog/how-to-get-and-use-aliexpress-api-key/
19. https://pypi.org/project/python-aliexpress-api/
20. https://github.com/sergioteula/python-aliexpress-api
21. https://www.awin.com/br/marketing-de-afiliacao/aproveitando-as-ferramentas-awin
22. https://www.awin.com/br/marketing-de-afiliacao/primeiros-passos-parte-1
23. https://wordpress.org/plugins/awin-data-feed/
24. https://pubhelp.rakutenadvertising.com/hc/en-us/articles/11258487715981-Product-Catalog-Data-Feed-Implementation-Guidelines (403 ao abrir; conteúdo via busca)
25. https://pubhelp.rakutenadvertising.com/hc/en-us/articles/5949974275853-Link-Locator-API
26. https://pubhelp.rakutenadvertising.com/hc/en-us/articles/5949799815053-Advertisers-API
27. https://developer.lomadee.com/afiliados (ENOTFOUND ao abrir; conteúdo via busca)
28. https://developer.socialsoul.com.vc/afiliados/ofertas/ (ENOTFOUND ao abrir; conteúdo via busca)
29. https://documenter.getpostman.com/view/4582221/SWTK3tt8 (API Zoom&Buscapé Comparador)
30. https://github.com/buscape-company/api-ofertas
31. https://developers.magalu.com/releases.html
32. https://www.reclameaqui.com.br/magazine-luiza-loja-online/falta-de-api-completa-e-ferramentas-de-rastreamento-para-afiliados-no-magalu_BImM0a874cW1L8Gk/
33. https://developers.netshoes.com.br/api-portal/content/entenda-api
34. https://mercadoeconsumo.com.br/10/04/2023/ecommerce/netshoes-amplia-programa-de-afiliados-para-venda-de-produtos/
35. https://www.promobit.com.br/o-que-e-promobit/
36. https://www.promobit.com.br/institucional/faq/
37. https://www.promobit.com.br/forum/manual-de-boas-praticas-e-regras-para-o-forum-7183/
38. https://ajuda.pelando.com.br/como-usar-o-pelando/
39. https://www.pelando.com.br/recentes
40. https://www.hardmob.com.br/threads/488256-Regra-dos-45-posts-no-forum-de-promocoes-vs-flood
41. https://www.hardmob.com.br/forums/407-Promocoes (403 ao abrir; conteúdo via busca)
42. https://github.com/robsonbittencourt/gafanhoto
43. https://x.com/hardmob_promo
44. https://keepa.com/#!api (403 ao abrir; conteúdo via busca)
45. https://fbamultitool.com/keepa-subscription-pricing-quick-guide-for-amazon-sellers/
46. https://camelcamelcamel.com/features (403 ao abrir; conteúdo via busca)
47. https://parse.bot/marketplace/887bdb14-2889-4486-a776-90f8edba8f0f/camelcamelcamel-com-api
48. https://camelcamelcamel.com/tools
49. https://www.relampagoofertas.com.br/home/blog/bug-de-preco.html
50. https://daily.slickdeals.net/shopping/how-to-find-amazon-price-mistakes/
51. https://daily.slickdeals.net/shopping/recent-price-mistakes-you-missed/
52. https://disboard.org/servers/tag/price-errors (403 ao abrir; conteúdo via busca)
53. https://cook-groups.com/price-error-discords/
54. https://blippr.com/blog/ultimate-guide-to-glitch-deals
55. https://blippr.com/blog/subreddits-for-deal-hunters
56. https://help.slickdeals.net/hc/en-us/articles/41900657858203-Why-a-Deal-Might-Not-Match-the-Posted-Price-and-What-You-Can-Do-About-It
57. https://gatry.com/
58. https://ofertasbot.com/ (403 ao abrir; conteúdo via busca)
59. https://www.99freelas.com.br/project/bot-telegram-para-canal-de-ofertas-e-promocoes-699122
60. https://www.zoom.com.br/zoom-explica/deumzoom/historico-de-precos-do-zoom
61. https://www.techtudo.com.br/dicas-e-tutoriais/2022/11/black-friday-2022-como-saber-se-um-produto-esta-realmente-barato-bf2022.ghtml
62. https://apify.com/karamelo/mercadolivre-scraper-brasil-portugues/api
63. https://apify.com/karamelo/mercadolivre-scraper-brasil-portugues
64. https://thiagoramos20042.medium.com/web-scraping-com-python-como-extrair-dados-do-mercado-livre-9e70b7e174f0
65. https://github.com/linces/MercadoScraper
66. https://fluxopromo.com/blog/como-criar-canal-ofertas-telegram
67. https://fluxopromo.com/blog/como-ganhar-dinheiro-no-telegram
68. https://digital.app.br/glossario/como-criar-um-canal-no-telegram-para-divulgar-promocoes-afiliadas/
69. https://rendaextradeverdade.com.br/como-ganhar-dinheiro-no-telegram/
70. https://afiliadolivre.com.br/quanto-tempo-cai-comissao-ml/
71. https://www.portalinsights.com.br/perguntas-frequentes/quanto-tempo-demora-para-aparecer-uma-venda-de-afiliado-na-shopee
72. https://www.portalinsights.com.br/perguntas-frequentes/quanto-tempo-a-shopee-demora-para-aceitar-afiliado
73. https://www.mercadolivre.com.br/ajuda/32116
74. https://www.serasa.com.br/blog/black-friday-como-comparar-precos/
75. https://www.serasa.com.br/premium/blog/black-friday-oito-sites-para-monitorar-precos-e-fraudes/
76. https://automatio.ai/es/how-to-scrape/2captcha
