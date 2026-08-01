# Cupons: como os concorrentes sabem, em minutos, que saiu cupom novo

Pesquisa realizada em 2026-08-01. Objetivo: descobrir de onde canais concorrentes tiram cupons como `FULL3107`, `TODOSITE31072`, `LOJASOFICIAIS0108`, `DECORELETRO3107`, sempre com formato idêntico (percentual/valor + valor mínimo + teto), minutos depois de saírem — mesmo com os 9 endpoints de API do Mercado Livre testados pelo cliente todos retornando 404.

Legenda: **[OFICIAL]** documentação/página da própria empresa · **[RELATO]** post de fórum/Reddit/Telegram descrevendo experiência real · **[VENDEDOR]** ferramenta/curso paga vendendo a solução · **[BLOG]** site de conteúdo/afiliado explicando o tema sem ser fonte primária.

---

## 1. Mercado Livre

### 1.1 A API de cupom existe — mas não é a que o cliente testou

O cliente testou endpoints do tipo `marketplace/coupons`, `users/me/coupons`, `loyalty/coupons`, `sites/MLB/promotions`, `affiliates/coupons`. Todos 404. Isso faz sentido: **nenhum desses nomes é o endpoint real**. O endpoint real, documentado publicamente, é:

```
POST   /seller-promotions/promotions?app_version=v2
PUT    /seller-promotions/promotions/{PROMOTION_ID}?app_version=v2
DELETE /seller-promotions/promotions/{PROMOTION_ID}?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
GET    /seller-promotions/promotions/{PROMOTION_ID}?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
GET    /seller-promotions/promotions/{PROMOTION_ID}/items?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
POST   /seller-promotions/items/{ITEM_ID}?app_version=v2
```
**[OFICIAL]** developers.mercadolivre.com.br/pt_br/cupons-do-vendedor (última atualização listada: 28/08/2025). Campos de request: `promotion_type`, `name`, `sub_type` (`FIXED_AMOUNT` ou `FIXED_PERCENTAGE`), `start_date`, `finish_date`, `min_purchase_amount`, `budget`, `partial_coupon_code` (opcional). Resposta traz `remaining_budget`, `used_coupons`, `redeems_per_user` (sempre 1).

Ponto crítico: **esse endpoint é para o VENDEDOR criar/gerenciar a própria campanha de cupom, não para um terceiro listar cupons de outros vendedores.** Não existe (documentado) um GET público que devolva "todos os cupons ativos agora no MLB". Isso explica por que 9 tentativas de endpoint genérico deram 404 — a API não foi desenhada para consumo de terceiros, só para quem é dono do cupom.

Achado extra relevante sobre nomenclatura: quando existe `partial_coupon_code`, "se o nickname do vendedor for NICKNAME1234, o código do cupom será NICKN mais o código completado pelo usuário" (máx. 10 caracteres). **[OFICIAL]** mesma fonte acima.

### 1.2 A página pública de cupons existe, mas é vazia de código sem contexto de sessão

- `mercadolivre.com.br/l/cupons-todos-os-dias` — landing informativa. Frase textual: *"Cupom limitado a 1 uso por CPF. Válido somente para compras feitas no app"*. Instrui a baixar o app e logar; cupom "de verdade" só aparece autenticado, no fluxo do app. **[OFICIAL]** (acesso 2026-08-01).
- `mercadolivre.com.br/ofertas/cupons` — mostra cupons já **expirados** publicamente (ex.: "R$ 35 OFF, compra mínima R$ 219, em PRESENTES"), sem exigir login, mas sem código alfanumérico explícito — o cupom se aplica automaticamente ao navegar. **[OFICIAL]** (acesso 2026-08-01).

Conclusão: existe conteúdo de cupom acessível sem autenticação completa (a página `/ofertas/cupons` é rastreável), mas o **código explícito com prefixo alfabético** (tipo `FULL3107`) normalmente é distribuído via banner interno do app/checkout, não por uma rota JSON aberta.

### 1.3 Cupom de afiliado — a pista mais forte

**[OFICIAL]** `mercadolivre.com.br/ajuda/35616` ("Como o Cupons de afiliados funciona"): *"Você pode decidir que todas as pessoas que visitam o Mercado Livre usem o cupom aplicando-o no processo de compra ou na seção de cupons ou você pode digitar um código e compartilhá-lo com quem você quiser para que somente essas pessoas possam ter acesso ao desconto."*

Isso confirma: **o próprio afiliado pode gerar/receber um cupom para divulgar**, isso é um recurso oficial do Programa de Afiliados e Criadores, acessado pela "Central de Marketing" → "Venda com afiliados" → criar campanha, definindo o valor promocional extra. **[OFICIAL]** hunterhub.com.br cita a existência do painel exclusivo com métricas, mas **não detalha** a distribuição de cupom por API — a interface é humana (painel web), não API pública. mambadigital.com.br e ecommercenapratica.com confirmam o modelo (comissão de 8–16%) mas também sem detalhar cupom-por-API. **[BLOG]**

Achado de campo com prova concreta: o post `pelando.com.br/d/afiliados-10porcento...` mostra um cupom **`VIROUDESCONTO`** — 10% off acima de R$79, limite R$100, **marcado explicitamente como "[Afiliados]"** — postado por um usuário Pelando. **[RELATO]** pelando.com.br (post de nov/2025, expirado no momento do acesso). Isso é evidência direta de que cupons de afiliado circulam e são republicados por qualquer um que tenha acesso ao painel de afiliados — não precisa de API, precisa de conta de afiliado aprovada mais o hábito de checar o painel/app com frequência.

### 1.4 O padrão de nomenclatura com data embutida — CONFIRMADO em campo

Captura ao vivo de canal de Telegram no dia 01/08/2026 (ver seção 5) mostrou simultaneamente:

- `LOJASOFICIAIS0108` — 15% off, mínimo R$29, teto R$20 (Lojas Oficiais)
- `MODAEBELEZA0108` — 20% off, mínimo R$49, teto R$20 (Moda e Beleza)

E, em captura do dia anterior (31/07/2026), do canal "SD | CUPONS":

- `DECORELETRO3107` — 30% off, teto R$20
- `LIVROSJOGOS3107` — 20% off, teto R$30
- `FULL3107` — 25% off, teto R$30, categoria Full, "resgate às 00h"

**O padrão é: `<CATEGORIA><DDMM>`.** O sufixo numérico é a data de expiração (ou de início) da campanha, no formato dia+mês sem separador. Isso é **exatamente o comportamento esperado de um gerador de campanha em lote**, rodando todo dia à meia-noite, criando um cupom por categoria com o nome da categoria concatenado à data corrente — script interno do Mercado Livre (ou de um parceiro de mídia dele) gerando `sub_type=FIXED_PERCENTAGE` por segmento todo santo dia. Isso é forte indício de que **o cupom nasce dentro do próprio ML de forma automatizada e previsível**, e não é "vazado" — é público, só que divulgado por push/banner in-app, não por endpoint JSON aberto.

### 1.5 Meli+, MELIMAIS, primeira compra

**[BLOG]** techtudo.com.br e canaltech.com.br confirmam: existem cupons exclusivos de "Primeira Compra" (novos usuários) e cupons exclusivos para assinantes Meli+. mercadolivre.com.br/ofertas/meli-mais-week é uma página oficial de campanha temática (Meli+ Week) — outro padrão de nomenclatura de campanha por evento, não por API. **[OFICIAL]** confirma a existência da página, mas não expõe os códigos sem autenticação de assinante.

---

## 2. Shopee

### 2.1 Open API / Affiliate API — dois mundos diferentes

Existem **duas APIs Shopee** que é fácil confundir, e isso pode explicar parte da confusão dos 9 endpoints 404 do cliente:

1. **Shopee Open Platform (Seller API)** — API para o **lojista** gerenciar a própria loja. Tem o endpoint real:
   ```
   v2.voucher.get_voucher_list
   ```
   Parâmetros: `status` (`ongoing`/`upcoming`/`expired`/`all`), `page_no`, `page_size`. Resposta: `voucher_list[]` com `voucher_id`, `voucher_name`, `voucher_code`, `usage_quantity`. **[OFICIAL]/[VENDEDOR]** github.com/congminh1254/shopee-sdk/blob/main/docs/managers/voucher.md — é uma API de **loja**, não de afiliado: só devolve os vouchers **da própria loja autenticada**, não um feed global de cupons de todas as lojas Shopee.

2. **Shopee Affiliate Open API** (`affiliate.shopee.com.br/open_api`, `open-api.affiliate.shopee.com.br/explorer/v2`) — API **GraphQL** autenticada por HMAC-SHA256, para afiliados. O endpoint relevante para descoberta de campanhas é o **`shopeeOfferV2`**, que retorna campanhas e ofertas especiais (sazonais tipo Black Friday, coleções temáticas, flash offers), com campos `commissionRate`, `offerLink`, `offerName`, `offerType`, `periodStartTime`, `periodEndTime`. **[VENDEDOR]** apify.com (openapi definition) e affiliateshopee.com.br/documentacao confirmam a existência do playground. Não há confirmação explícita de um campo `voucherCode` genérico dentro do `shopeeOfferV2` nos textos acessados — o foco desse endpoint é campanha/comissão, não necessariamente o código de cupom de checkout.

### 2.2 Como o afiliado realmente descobre voucher novo, na prática

**[BLOG]** divulganinja.com.br (blog de curso de afiliados): *"Shopee vouchers enter and exit several times per day, making it impractical to constantly refresh the Affiliate Portal or check app notifications manually"* — confirma que **o mecanismo oficial é olhar a aba "Vouchers"/"Cupons" dentro do Portal do Afiliado** (login humano) ou o banner rotativo do app. Não existe, nos textos acessados, confirmação de endpoint aberto tipo "GET todos os vouchers ativos agora".

**[VENDEDOR]** divulganinja.com.br vende justamente a solução para esse problema: *"o DivulgaNinja monitora cupons ativos automaticamente e publica as ofertas nos seus grupos de WhatsApp e Telegram no momento certo"* — mas **não revela a técnica** (API oficial vs. scraping do próprio Portal do Afiliado autenticado). Isso é o retrato exato do "concorrente estruturado": alguém constrói um robô que faz login persistente no Portal do Afiliado (ou usa a Affiliate Open API com token próprio) e posta assim que aparece algo novo — não é garimpo manual, mas também não é um endpoint público e documentado de terceiros.

**[VENDEDOR]** shozap.com.br: *"Nossa automação monitora as principais plataformas o dia inteiro e seleciona as promoções"*, cobre Shopee, Mercado Livre, Amazon, Magalu e Shein — de novo, sem revelar API vs. scraping, mas confirma que **"monitoramento contínuo + auto-postagem" é um produto de mercado já vendido para afiliados brasileiros**, o que é evidência forte de que **essa categoria de ferramenta é a explicação mais provável para os concorrentes do cliente**.

### 2.3 Formato de cupom Shopee observado ao vivo (canal `shopeepromocoesecuponsbr`, 01/08/2026)

Códigos capturados: `OFERTAS10`, `FL4NASH0AF`, `3XCLU51V020`, `PR3S3NT3P41S`, `D1AD0SP41S`, `4QUAM4N`, `10F3RT4SCR`, `EXTRACUPOM29AF`, `D35C0NT4SS0`. Padrão: **leetspeak** (substituição de vogais por números — `E→3`, `A→4`, `I→1`, `O→0`), sem data explícita no formato Shopee (diferente do ML). Isso é consistente com geração de código "customizado" pelo lojista/afiliado dentro do painel de voucher (campo livre de texto), não um gerador automático por categoria como no ML.

---

## 3. Amazon

**[OFICIAL]** A PA-API 5 está em processo de descontinuação (deprecation em 15/05/2026 segundo webservices.amazon.com/paapi5/documentation/), substituída pela **Creators API** (`affiliate-program.amazon.com/creatorsapi`). A página de deprecation acessada **não menciona cupons/coupons** em nenhum trecho — o foco é catálogo de produto, preço e imagem. Não há evidência de endpoint de cupom na PA-API nem na Creators API nos textos acessados.

Isso sugere que **cupons Amazon não vêm de API de afiliado nenhuma** — vêm da página pública `/promocoes` do site (visível a qualquer visitante, sem autenticação de afiliado) ou de e-mails/newsletter da Amazon para clientes. Ferramentas de automação (DivulgaNinja, Shozap) tratam Amazon como "mais uma plataforma monitorada" pelo mesmo motor genérico — provavelmmente scraping da página pública de ofertas, não API.

---

## 4. AliExpress

**[OFICIAL]** openservice.aliexpress.com/doc/api.htm lista métodos de afiliado como `listPromotionProduct`, `getPromotionProductDetail`, `getPromotionLinks` — focados em produto e link de afiliado, não em cupom de loja isolado. **[BLOG]** zuplo.com/learning-center/aliexpress-api-guide confirma a mesma lista sem mencionar endpoint de cupom/coin dedicado.

AliExpress tem sistema de "moedas" (coins) e cupom de loja acessível dentro do app/carrinho — mas não achei, nas páginas acessadas, endpoint de API de afiliado que devolva cupons de loja em lote. O padrão observado nos canais de Telegram (`BRAE1` a `BRAE7`, combinados com cupons de loja tipo `NETACDDR43 + BRAE4`) sugere que **os códigos `BRAEx` são cupons genéricos e estáveis, reaproveitados por múltiplos canais** — não são "descobertos" a cada campanha, são conhecidos e reutilizados enquanto funcionam. Cupom de loja (o segundo código da combinação) provavelmente vem do painel de loja/portal de afiliado, replicado por quem tem acesso, igual ao padrão Shopee.

---

## 5. Canais de Telegram brasileiros — a fonte primária real dos concorrentes

Canais lidos ao vivo via `t.me/s/<canal>` em 2026-08-01:

| Canal | URL | Conteúdo observado |
|---|---|---|
| China Cupons BR Promoções | t.me/s/chinacuponsbr | AliExpress + ML + Amazon. Muitas mensagens marcadas **"Forwarded from"** outros canais (ex.: "Importa Hardware Periférico PC Tech Gamer"). Intervalo de 5–60 min entre posts, das 04h17 às 15h32. |
| Shopee Promoções e Cupons da Shô e da She | t.me/s/shopeepromocoesecuponsbr | Cupons Shopee em leetspeak, todos com link de afiliado + remete a site externo `chinacuponsbr.com` para "lista completa". |
| SD \| CUPONS | t.me/s/sddescontos | ML, Amazon, Magalu, Shopee. Mostrou ao vivo `FULL3107`, `DECORELETRO3107`, `LIVROSJOGOS3107` — confirma o padrão `<CATEGORIA><DDMM>`. |
| Ei, é Útil! OFERTAS E CUPONS | t.me/s/canaldeofertasecupons | Formato padronizado por emoji de cor por loja, hashtags fixas, links `meli.la`/`s.shopee.com.br`/Amazon com `tag=eieutil-20`. Mostrou `LOJASOFICIAIS0108`/`MODAEBELEZA0108` no mesmo dia da pesquisa. Frase da bio: "Siga nosso perfil e use nossos links antes de comprar — isso ajuda a liberar mais cupons" (sugere ligação com desempenho de vendas do afiliado, não vazamento). |
| Mih - Cupons e Descontos | t.me/s/PromosdaMih | Confirmou de novo `LOJASOFICIAIS0108`/`MODAEBELEZA0108` (ML) e cupons Shopee de "8.8" no mesmo horário — **mesmo cupom, mesmo texto, propagado entre múltiplos canais dentro de minutos**, reforçando a hipótese de fonte comum (forward em cadeia ou ferramenta compartilhada, não descoberta independente). |
| Canal de S.O Cupons | t.me/s/canaldesocupons | Funciona como hub/diretório, direciona para canais temáticos por loja + grupo de WhatsApp. |

**Achado-chave da seção 5:** o mesmo cupom (`LOJASOFICIAIS0108`, `MODAEBELEZA0108`) apareceu **em dois canais Telegram diferentes, no mesmo dia, com texto quase idêntico**. Isso é evidência direta de que existe um "hub" a montante — seja o próprio banner do app ML puxado por um bot com conta logada, seja um serviço terceirizado (tipo DivulgaNinja/Shozap) que várias operações de canal usam como back-end e cada dono só reposta.

---

## 6. Sites agregadores de cupom (Cuponomia, Méliuz, Cupom Válido, Pelando, Promobit)

- **Cuponomia** — extensão de navegador que testa cupons automaticamente no carrinho do lojista (client-side, roda no browser do usuário). Nenhuma documentação pública de API encontrada. **[BLOG]** apps.apple.com/chrome-stats descrevem o produto, não a arquitetura de coleta.
- **Méliuz** — mais de 800 lojas parceiras, cashback + cupom via extensão. Também sem API pública documentada encontrada nas buscas. **[BLOG]**
- **Rakuten Advertising** tem uma **Coupon Feed API** documentada (`pubhelp.rakutenadvertising.com/hc/en-us/articles/5949828511757-Coupon-Feed-API`) — mas essa página deu **403 Forbidden** ao tentar acessar (provável paywall/login de publisher). A existência do artigo confirma que **esse tipo de API existe no modelo de rede de afiliados** (Rakuten, Awin, Lomadee) — só não é aberta ao público, exige login de publisher aprovado na rede.
- **Lomadee** tem documentação de API para `cupons` e `ofertas` (`developer.lomadee.com/afiliados/cupons/`), mas o domínio **não resolveu (DNS ENOTFOUND)** no momento da pesquisa — indício de que a doc pode ter sido descontinuada/movida. O blog institucional (`lomadee.com.br/blog/cupons-de-afiliados`) fala de estratégia (códigos únicos e rastreáveis por afiliado, cupom por nível de desempenho: bronze 5%, prata 10%, ouro 15%+) mas não expõe a API tecnicamente.
- **Promobit** — página de cupons Shopee lida ao vivo (`promobit.com.br/cupons/loja/shopee/`) mostrou ~15 cupons ativos com valor/percentual/mínimo/teto, sem data embutida no código, sugerindo curadoria humana + comunidade (usuários reportam cupom, outros validam com "Como foi?"), não feed automatizado.
- **RadarCupom** — pertence à Oberst BV (Amsterdã), administra dezenas de sites de cupom desde 2010. Página "sobre" retornou 403 ao fetch direto, mas o snippet de busca confirma: parte do modelo depende de **usuários reportando e validando** cupons ("Como foi?" / revisão da comunidade), não é um feed de API de marketplace.

**Conclusão da seção 6:** os grandes agregadores não expõem API pública gratuita para terceiros replicarem o feed em tempo real. O que existe de API de cupom estruturada mora **dentro das redes de afiliados** (Rakuten, Awin, Lomadee, Admitad), atrás de login de publisher aprovado — coerente com "fonte estruturada e não garimpo manual", mas não é gratuita/pública.

---

## 7. Programas de afiliado tradicionais (CJ, Awin, Rakuten, Lomadee)

Confirmado: essas redes entregam **Coupon Feed API** para publishers aprovados (caso Rakuten, documentado). Isso é plausível como uma das fontes "estruturadas" de operações maiores — mas **nenhum dos grandes marketplaces citados pelo cliente (ML, Shopee, Amazon, Magalu, AliExpress) usa essas redes tradicionais como canal principal de afiliação no Brasil** — cada um tem programa de afiliados próprio e direto (ML: Programa de Afiliados e Criadores; Shopee: Shopee Affiliate Program/Open API; Amazon: Associados; Magalu: Parceiro Magalu/Magazine Você; AliExpress: Portals de afiliados). Isso reduz a probabilidade de a fonte real ser CJ/Awin/Rakuten/Lomadee para esse conjunto específico de lojas — mais provável são os programas diretos.

---

## 8. Ferramentas de automação — o "produto" que resolve exatamente o problema do cliente

Três ferramentas comerciais brasileiras, achadas em busca direta, vendem precisamente a automação de "descobrir cupom rápido e postar":

1. **DivulgaNinja** (divulganinja.com.br) — monitora cupons Shopee automaticamente, publica em WhatsApp/Telegram "no momento certo". **[VENDEDOR]**
2. **Shozap** (shozap.com.br) — "automação monitora as principais plataformas o dia inteiro" (Shopee, ML, Amazon, Magalu, Shein), publica em WhatsApp (grupos/canais/status), Telegram e Instagram simultaneamente. Também oferece extensão de navegador para adicionar produto manualmente. **[VENDEDOR]**
3. **Pro Afiliados** (proafiliados.com) — bot que monitora grupos de WhatsApp/Telegram, detecta link de produto postado por qualquer pessoa e converte automaticamente para link de afiliado próprio usando as credenciais do usuário (menciona uso de "proxy residencial" para ML). Foco em conversão de link, não em cupom especificamente. **[VENDEDOR]**

Nenhuma das três revela publicamente se usa API oficial autenticada (login do afiliado + chamada ao endpoint de voucher/campanha) ou scraping da interface autenticada do Portal do Afiliado/App. Do ponto de vista técnico, **as duas abordagens produzem o mesmo resultado observável**: postagem em minutos, formato idêntico ao painel oficial (porque o texto vem literalmente do painel).

---

## 9. Padrão de nomenclatura com data — conclusão consolidada

Evidência coletada em 2 dias diferentes (31/07 e 01/08/2026), 3 canais diferentes, mesmo padrão:

- ML: `<CATEGORIA><DDMM>` — `FULL3107`, `DECORELETRO3107`, `LIVROSJOGOS3107` (31/07); `LOJASOFICIAIS0108`, `MODAEBELEZA0108` (01/08).
- Confirma a hipótese do cliente: **cupom com data no código = campanha própria do marketplace, curta duração (1 dia), criada em lote por categoria.**
- Shopee não mostrou esse padrão nos códigos observados (usa leetspeak, não data), o que sugere que a hipótese de "data no código" é **específica do gerador de campanha do Mercado Livre**, não um padrão cross-marketplace.

Esse padrão previsível (categoria + data do dia, resetando à meia-noite) é, por si só, uma pista de engenharia reversa poderosa: se o nome da campanha segue fórmula fixa, um bot pode **tentar aplicar cupons candidatos por força bruta** (`FRETEGRATIS` + data, `ELETRO` + data, etc.) sem nunca ter "descoberto" nada — mas isso é diferente de replicar o texto exato que aparece nos canais, que exige ver o cupom já ativo (painel/app/push), não adivinhar.

---

## 10. Extração por regex de canal alheio: quem faz, funciona, armadilhas

Ferramentas como Pro Afiliados confirmam publicamente que **"reler" canais/grupos concorrentes e reagir automaticamente a padrões de texto é uma prática de mercado estabelecida** no ecossistema de afiliados brasileiro — o bot "detecta links de produtos" postados por terceiros em grupos monitorados e os reconverte. Aplicar a mesma lógica a cupons (regex sobre texto de canal Telegram público via `t.me/s/<canal>`, que não exige login) é tecnicamente trivial e não é hipotético — é o modelo de negócio inteiro de "Pro Afiliados".

Armadilhas identificadas na pesquisa:

- **Cupom por CPF/conta**: a página oficial do ML (`/l/cupons-todos-os-dias`) explicita "limitado a 1 uso por CPF" — um cupom lido de canal alheio pode já estar esgotado para a cota do dia mesmo sendo "válido" em texto.
- **Cupom de uso único ou por lote**: a doc oficial de cupom de vendedor mostra `remaining_budget`/`used_coupons` — cupons têm orçamento finito; quando o lote acaba, o código aparece como "atingiu o limite" mesmo sendo real (confirmado por `seletronic.com.br`).
- **Cupom regional/categoria restrita**: `MODAEBELEZA0108` só funciona em Moda e Beleza; aplicar fora do contexto falha e gera reclamação de seguidor.
- **Cupom de afiliado marcado**: alguns cupons (como `VIROUDESCONTO`, achado no Pelando) são atrelados à campanha de um afiliado específico — replicar sem ser o dono da campanha pode não creditar a comissão pretendida, mesmo funcionando para o comprador.
- **Latência de propagação**: como visto na seção 5, o mesmo cupom apareceu em 2 canais diferentes quase ao mesmo tempo — extrair de canal alheio via regex funciona, mas coloca o operador **sempre um passo atrás de quem tem acesso direto** (painel de afiliado, ferramenta paga, ou robô com conta logada no app).

---

## Hipóteses ordenadas por probabilidade de ser a fonte real dos concorrentes

### 1. (Mais provável) Robô com conta de afiliado/vendedor logada, lendo o Portal do Afiliado ou o app via sessão autenticada — não API pública de terceiros
**O que sustenta:** os 9 endpoints testados pelo cliente eram nomes genéricos plausíveis de API pública; a única API real documentada (`/seller-promotions/promotions`) é de **gestão da própria campanha**, não de consulta de campanhas alheias. O ML não expõe um "GET cupons ativos" para terceiros. Ferramentas comerciais (DivulgaNinja, Shozap) vendem exatamente "monitoramento automático" sem revelar a técnica — consistente com scraping de sessão autenticada (login persistente no app/portal, headless) em vez de chamada a API pública.
**Como testar em <1h:** criar conta de afiliado ML e Shopee, logar num navegador com sessão persistente, abrir as DevTools → Network na página `mercadolivre.com.br/ofertas/cupons` e no app (via proxy tipo mitmproxy/Charles) logado, procurar chamadas XHR/fetch que carregam os cards de cupom — o endpoint real (autenticado, não documentado) provavelmente aparece ali, com nome diferente dos 9 testados.

### 2. Serviço terceirizado compartilhado (DivulgaNinja / Shozap / similar) que várias operações de canal assinam como back-end
**O que sustenta:** o mesmo cupom (`LOJASOFICIAIS0108`/`MODAEBELEZA0108`) apareceu em 2 canais Telegram diferentes no mesmo dia com texto quase idêntico — indício de fonte comum a montante, não descoberta independente. Existem pelo menos 3 produtos comerciais brasileiros vendendo esse serviço.
**Como testar em <1h:** assinar o plano mais barato de um desses serviços (DivulgaNinja ou Shozap têm planos de teste/entrada) e cronometrar o tempo entre "cupom aparece no seu feed pago" e "aparece nos canais concorrentes do cliente" — se o delta for de segundos/poucos minutos, é a mesma fonte.

### 3. Repost em cadeia entre canais ("Forwarded from"), com 1 canal de verdade descobrindo primeiro e todos os outros copiando manualmente
**O que sustenta:** o China Cupons BR mostrou várias mensagens explicitamente "Forwarded from" outros canais. Isso é evidência direta e visível (não hipótese) de que parte da rede de canais **não tem fonte própria, só reposta**.
**Como testar em <1h:** monitorar 5-6 canais grandes de cupom (lista na seção 5) por 1-2 horas notando ordem cronológica exata de quando cada cupom aparece em cada canal — o primeiro a postar consistentemente é a fonte real; os demais são "forwards" com atraso de 1-15 min.

### 4. Cupom de afiliado próprio, criado pelo operador (ou obtido no painel) e não "descoberto" de fonte alheia nenhuma
**O que sustenta:** a doc oficial confirma que afiliados podem gerar cupom próprio pela Central de Marketing. O achado do Pelando (`VIROUDESCONTO`, marcado "[Afiliados]") mostra que cupons de afiliado circulam livremente depois de criados.
**Como testar em <1h:** entrar no Programa de Afiliados e Criadores do ML (se o cliente já não estiver), acessar Central de Marketing → "Venda com afiliados", e ver se dá para gerar um cupom com nome customizado imediatamente — se sim, uma fração dos cupons vistos nos canais pode ser autoproduzida por cada operador, não "puxada" de lugar nenhum.

### 5. Força bruta sobre o padrão previsível `<CATEGORIA><DDMM>` do Mercado Livre
**O que sustenta:** o padrão foi confirmado em 2 dias distintos com categorias diferentes — é mecânico o suficiente para ser adivinhado (lista de categorias do ML é finita e conhecida; data é o dia corrente).
**Como testar em <1h:** pegar a lista de ~20-30 categorias do ML (Eletro, Moda e Beleza, Lojas Oficiais, Casa, Livros e Jogos, Decoração, Full etc.), montar `<CATEGORIA_SEM_ACENTO><DDHOJE><MMHOJE>` e `<CATEGORIA><DDAMANHA><MM>`, e testar cada string no campo de cupom do carrinho ML logado — se uma fração relevante "colar" sem nunca ter sido vista em canal nenhum, essa é uma fonte adicional (não excludente da #1).

### 6. (Menos provável, mas não descartada) API de rede de afiliados tradicional (Rakuten/Awin/Lomadee Coupon Feed)
**O que sustenta:** a Rakuten documenta publicamente uma Coupon Feed API para publishers. Existe em teoria.
**Por que é pouco provável aqui:** nenhum dos 5 marketplaces do cliente (ML, Shopee, Amazon, Magalu, AliExpress) roda seu programa de afiliados principal através dessas redes no Brasil — cada um tem programa direto. Precisaria de evidência de que um desses marketplaces também publica em Rakuten/Awin/Lomadee no Brasil, o que não foi encontrado nas fontes acessadas.
**Como testar em <1h:** criar conta de publisher gratuita na Awin e Lomadee, buscar "Mercado Livre" e "Shopee" na lista de anunciantes — se não aparecerem como advertiser ativo, a hipótese cai.

---

## Recomendação prática imediata para o projeto (fora do escopo da pesquisa, mas decorre dela)

Considerando as regras do projeto (D-010: via oficial é prioridade, Shopee publica API abertamente — ver `AGENTS.md`), a rota mais alinhada ao que já foi decidido é a **hipótese 1 combinada com a 4**: registrar-se oficialmente como afiliado Mercado Livre e Shopee, inspecionar via DevTools (não força bruta, não scraping de terceiro) o tráfego autenticado do Portal do Afiliado para achar o endpoint real de listagem de cupom/voucher (que não é nenhum dos 9 testados), e complementar gerando cupom próprio pela Central de Marketing quando fizer sentido para o negócio do cliente. Isso evita depender de repostar cupom de canal alheio (hipótese 3), que é sempre mais lenta que a fonte primária.

---

## Fontes consultadas

1. developers.mercadolivre.com.br/pt_br/cupons-do-vendedor — API oficial de cupom do vendedor (`/seller-promotions/*`). [OFICIAL]
2. developers.mercadolivre.com.br/pt_br/gerenciar-ofertas — endpoint de ofertas do vendedor. [OFICIAL]
3. developers.mercadolibre.com.ar/en_us/manage-promotion — gestão de promoções (espelho ARG). [OFICIAL]
4. mercadolivre.com.br/l/cupons-todos-os-dias — página pública "Cupons todos os dias". [OFICIAL]
5. mercadolivre.com.br/ofertas/cupons — página pública de cupons (mostra expirados sem login). [OFICIAL]
6. mercadolivre.com.br/ajuda/35616 — "Como o Cupons de afiliados funciona". [OFICIAL]
7. mercadolivre.com.br/l/afiliados-portal-do-afiliado — Portal do Afiliado. [OFICIAL]
8. mercadolivre.com.br/l/afiliados-home — Programa de afiliados e criadores. [OFICIAL]
9. mercadolivre.com.br/ofertas/meli-mais-week — página oficial Meli+ Week. [OFICIAL]
10. vendedores.mercadolivre.com.br/nota/cupons-de-compra-o-que-sao-e-como-cria-los-para-vender-mais — Central de aprendizagem do vendedor. [OFICIAL]
11. hunterhub.com.br/blog/programa-de-afiliados-mercado-livre-como-funciona-comissao-afiliados-ml/ — guia de afiliados ML. [BLOG]
12. ecommercenapratica.com/blog/afiliado-mercado-livre/ — guia de afiliados ML. [BLOG]
13. mambadigital.com.br/blog/programa-afiliados-mercado-livre/ — guia de afiliados ML. [BLOG]
14. pelando.com.br/d/afiliados-10porcento-de-desconto-acima-de-rdollar7900-limitado-a-rdollar100-em-produtos-selecionados-3bf1 — post real com cupom `VIROUDESCONTO` marcado [Afiliados]. [RELATO]
15. gist.github.com/pitinga/26de31fd8c0cfbf4f7a3c1ed917649e5 — script de ativação em massa de cupons inativos ML (client-side). [RELATO]/[VENDEDOR]
16. seletronic.com.br/4-4-mercado-livre-cupons-lista-de-codigos-2026/ — cobertura de campanha 4.4 com códigos `VALEOFERTA`/`MELIOFERTA`. [BLOG]
17. techtudo.com.br/noticias/2026/07/cupom-mercado-livre-todos-os-codigos-para-usar-em-julho-de-2026-edqualcomprar.ghtml — lista de códigos ML. [BLOG]
18. canaltech.com.br/apps/cupom-mercado-livre-como-conseguir-e-onde-usar-codigos-de-desconto/ — guia de uso de cupom. [BLOG]
19. cuponomia.com.br/desconto/mercado-livre — agregador. [BLOG]
20. meliuz.com.br/desconto/cupom-desconto-mercado-livre — agregador. [BLOG]
21. radarcupom.com.br/loja/mercadolivre.com.br — agregador. [BLOG]
22. radarcupom.com.br/sobre — sobre o RadarCupom / Oberst BV (403 no fetch direto, dados por snippet de busca). [BLOG]
23. cupomspot.com.br/cupons/mercado-livre — agregador. [BLOG]
24. affiliate.shopee.com.br/open_api — portal Shopee Affiliate Open API. [OFICIAL]
25. open-api.affiliate.shopee.com.br/explorer/v2 — Explorer da API GraphQL de afiliados Shopee. [OFICIAL]
26. affiliateshopee.com.br/documentacao — documentação de terceiro sobre a API Shopee. [VENDEDOR]
27. apify.com/viralanalyzer/shopee-affiliate-products/api/openapi — spec OpenAPI de terceiro cobrindo `shopeeOfferV2`. [VENDEDOR]
28. github.com/congminh1254/shopee-sdk/blob/main/docs/managers/voucher.md — doc de `v2.voucher.get_voucher_list` (Seller API). [VENDEDOR]
29. github.com/bcat95/shopee-aff — SDK não oficial Shopee. [VENDEDOR]
30. github.com/mu-hanz/shoapi — cliente Shopee não oficial Laravel. [VENDEDOR]
31. divulganinja.com.br/en/blog/cupons-shopee-afiliado-como-usar/ — ferramenta de monitoramento automático de cupom Shopee. [VENDEDOR]
32. shozap.com.br — automação multi-loja (Shopee, ML, Amazon, Magalu, Shein) para WhatsApp/Telegram/Instagram. [VENDEDOR]
33. proafiliados.com — bot de conversão de link em grupos WhatsApp/Telegram. [VENDEDOR]
34. cupomparalelo.com.br/guia-completo-criar-cupom-de-desconto-shopee-afiliado/ — guia de criação de cupom de afiliado Shopee. [BLOG]
35. promobit.com.br/cupons/loja/shopee/ — lista ao vivo de cupons Shopee (comunidade). [BLOG]
36. webservices.amazon.com/paapi5/documentation/offers.html → redireciona para affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation — deprecação PA-API 5, sem menção a cupom. [OFICIAL]
37. affiliate-program.amazon.com/creatorsapi — Creators API (sucessora da PA-API). [OFICIAL]
38. affiliate-program.amazon.com/creatorsapi/docs/ — documentação Creators API. [OFICIAL]
39. openservice.aliexpress.com/doc/api.htm — API Reference AliExpress Open Platform (métodos `listPromotionProduct`, `getPromotionProductDetail`, `getPromotionLinks`). [OFICIAL]
40. zuplo.com/learning-center/aliexpress-api-guide — guia de API AliExpress. [BLOG]
41. portals.aliexpress.com — Portal de Afiliados AliExpress. [OFICIAL]
42. t.me/s/chinacuponsbr — canal Telegram "China Cupons BR Promoções" (leitura ao vivo). [RELATO]
43. t.me/s/shopeepromocoesecuponsbr — canal Telegram Shopee (leitura ao vivo). [RELATO]
44. t.me/s/canaldesocupons — canal/hub Telegram multi-loja (leitura ao vivo). [RELATO]
45. t.me/s/canaldeofertasecupons — canal Telegram "Ei, é Útil!" (leitura ao vivo, cupons `LOJASOFICIAIS0108`/`MODAEBELEZA0108`). [RELATO]
46. t.me/s/PromosdaMih — canal Telegram "Mih - Cupons e Descontos" (leitura ao vivo, confirma mesmos cupons do canal anterior no mesmo dia). [RELATO]
47. t.me/s/sddescontos — canal Telegram "SD | CUPONS" (leitura ao vivo, confirma padrão `<CATEGORIA><DDMM>` com `FULL3107` etc.). [RELATO]
48. telegrupos.com.br/promoes-relmpago-shopee-amazon-mercado-livre-cupons/ — diretório de grupo WhatsApp/Telegram. [BLOG]
49. pubhelp.rakutenadvertising.com/hc/en-us/articles/5949828511757-Coupon-Feed-API — Coupon Feed API da Rakuten Advertising (403 no fetch direto, confirmado por snippet). [OFICIAL]
50. lomadee.com.br/blog/cupons-de-afiliados — estratégia de cupom por nível de afiliado (bronze/prata/ouro). [OFICIAL]
51. developer.lomadee.com/afiliados/cupons/ — API de cupons Lomadee (domínio não resolveu no momento da pesquisa — DNS ENOTFOUND). [OFICIAL, não verificado]
52. gruposwhats.app — diretório de grupos WhatsApp de afiliados/promoções. [BLOG]
53. shozap.com.br (ver item 32, referenciado também para grupo WhatsApp/gerente de conta). [VENDEDOR]
54. 99freelas.com.br/project/instalacao-de-api-rsquo-s-para-cupons-de-descontos-e-promocoes-140716 — projeto freelancer confirmando demanda de integração de API de cupom (Rakuten/Awin/Admitad/Lomadee). [RELATO]
55. couponapi.org/pt/ — "API única para obter cupões de todos os programas de afiliados" (agregador de terceiro). [VENDEDOR]
56. thiagoramos20042.medium.com/web-scraping-com-python-como-extrair-dados-do-mercado-livre-9e70b7e174f0 — tutorial de scraping ML. [BLOG]
57. github.com/rhanyele/mercadolivre-scraping-kafka — projeto de scraping de ofertas ML com Kafka/Postgres. [RELATO]
58. github.com/linces/MercadoScraper — scraper ML (produto, preço, imagem). [RELATO]
59. apify.com/pegai/mercadolivre-deals-scraper — scraper comercial de ofertas ML, cita uso para "affiliate automation". [VENDEDOR]
60. github.com/Fripixel/mercadolivre-link-de-afiliados — API não oficial geradora de link de afiliado ML. [RELATO]
61. afiliadomarketplace.com.br/api-essencial-para-afiliados-no-mercado-livre-guia-completo/ — guia sobre API de afiliados ML. [BLOG]
62. parceiromagalu.com.br (citado via canaltech.com.br/e-commerce/como-ser-um-parceiro-magalu-veja-como-funciona-o-programa/) — programa Parceiro Magalu. [OFICIAL/BLOG]
63. magazinevoce.com.br — "Influenciador Magalu", loja virtual de afiliado. [OFICIAL]
64. r1.community.samsung.com/t5/promoções/cupom-da-live-funciona-no-vip/m-p/26780767 — fórum sobre cupom de live Shopee. [RELATO]

**Nota metodológica:** o orçamento de WebSearch da sessão (compartilhado com outras atividades do ambiente) esgotou em 200/200 chamadas durante a pesquisa; a partir desse ponto a coleta continuou via WebFetch direto em URLs já mapeadas pelas buscas anteriores, o que ainda permitiu cobrir os pontos pendentes (Amazon, AliExpress, Rakuten, mais canais de Telegram) sem perda relevante de cobertura.
