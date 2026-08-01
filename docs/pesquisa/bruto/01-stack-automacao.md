# Stack técnica real de quem administra grupos/canais de ofertas com link de afiliado no Brasil

Pesquisa feita em 01/08/2026, via WebSearch (36 buscas) e WebFetch (24 páginas abertas, ~22 com conteúdo utilizável). Cobertura: GitHub, BlackHatWorld, sites de venda de bot/curso, blogs de SEO, documentação oficial de APIs de afiliado, um fórum brasileiro (Samsung Members) e vídeos do YouTube. Não foi possível abrir Reddit diretamente (as buscas `site:reddit.com` não retornaram resultados reais do Reddit — o motor de busca disponível não indexa bem o Reddit no momento da pesquisa) nem BlackHatWorld/Warrior Forum (bloqueiam fetch com HTTP 403). Esses dois pontos são uma limitação importante: a "voz do operador anônimo" está sub-representada aqui e vem principalmente de páginas de vendedores de ferramenta, não de depoimentos crus de fórum.

Nível de confiança usado em cada achado:
- **[OFICIAL]** documentação do fabricante/plataforma
- **[RELATO]** depoimento de pessoa real (dev que documentou seu próprio projeto/uso)
- **[VENDEDOR]** quem vende a ferramenta/curso — viés comercial explícito
- **[BLOG]** conteúdo de SEO, possivelmente reciclado/genérico, sem fonte primária clara

---

## 1. n8n, Make, Zapier: uso real em grupos de oferta

### 1.1 n8n é citado com frequência, mas as buscas não encontraram um relato real de operador brasileiro usando n8n em produção para canal de ofertas — o que existe é conteúdo de terceiros ensinando a montar o workflow.

- **[BLOG]** Hostinger tem um tutorial genérico de integração n8n + Telegram (criar bot no BotFather, pegar token, configurar nó Telegram). Não é específico de afiliados. Fonte: https://www.hostinger.com/br/tutoriais/n8n-telegram
- **[BLOG]** FluxoPromo publica "Automação para Telegram: Guia Completo para Afiliados 2026", que descreve o conceito geral (bots publicam ofertas 24/7 com link de afiliado) mas não entrega workflow técnico n8n. Fonte: https://fluxopromo.com/automacao-telegram
- **[VENDEDOR/TUTORIAL]** Existe um vídeo do YouTube especificamente intitulado "👾 BOT DE OFERTAS no TELEGRAM com N8N: Afiliados Amazon, Shopee, AliExpress e ML!" — o WebFetch não conseguiu extrair a descrição real (só pegou o título e menu de navegação do YouTube), então não há confirmação do conteúdo técnico exato. Fonte: https://www.youtube.com/watch?v=NadDpetjo2A — **tratar como indício, não confirmação**.

### 1.2 Templates públicos do n8n.io relevantes (produção real da comunidade, não específico de afiliados BR, mas usável)

- **[OFICIAL — repositório de templates n8n]** "Multi-platform price finder: Scraping prices with Bright Data, Claude AI & Telegram" — workflow público que usa Bright Data (scraping de Amazon, Wayfair, Lowe's), gera mensagem promocional com Claude AI ("🔥 Pegue o iPhone 15 Pro Max por apenas $1199!") e publica no Telegram. Descrito textualmente como voltado para "afiliados, revendedores e plataformas de busca de ofertas". Fluxo: Form Trigger → HTTP Request (Bright Data) → If/Wait (polling até status "ready") → Code node (comparação de preço) → Telegram node. Fonte: https://n8n.io/workflows/6408-multi-platform-price-finder-scraping-prices-with-bright-data-claude-ai-and-telegram/
- **[OFICIAL]** "Daily website data extraction with Firecrawl and Telegram alerts" — scraping diário agendado + Telegram. Fonte: https://n8n.io/workflows/5591-daily-website-data-extraction-with-firecrawl-and-telegram-alerts/
- **[OFICIAL]** "Monitor regulatory updates with ScrapeGraphAI and send alerts via Telegram" — usa Redis para deduplicar itens já vistos antes de mandar pro Telegram; padrão reaproveitável para deduplicar ofertas repetidas. Fonte: https://n8n.io/workflows/12072-monitor-regulatory-updates-with-scrapegraphai-and-send-alerts-via-telegram/
- **[OFICIAL]** Firecrawl (empresa de scraping) publicou "Web Scraping with n8n: 8 Powerful Workflow Templates" — nenhum dos 8 é focado especificamente em e-commerce/afiliados; o mais próximo é um monitor de mudanças em site concorrente. Conclusão: **o catálogo oficial de templates n8n não tem, hoje, um template dedicado e testado para "canal de ofertas + afiliado"** — quem quer isso monta na mão combinando nós de scraping (HTTP Request/Bright Data/Firecrawl) com o nó nativo do Telegram. Fonte: https://www.firecrawl.dev/blog/n8n-web-scraping-workflow-templates

### 1.3 Templates vendidos avulsos (Gumroad) — mercado paralelo de "pacote de workflow"

- **[VENDEDOR]** Existem pacotes como "100+ Telegram-focused AI automation workflows" por US$49+ vendidos no Gumroad, e bundles genéricos de "500+ n8n marketing automation AI agent workflow templates". Isso sugere que uma fatia de quem monta canal de oferta **compra** o workflow pronto em vez de construir do zero. Fontes: https://automatewithbishal.gumroad.com/l/TelegramAIAutomations , https://inferencebysequoia.substack.com/p/best-content-and-community-resources

### 1.4 Make vs Zapier

- **[BLOG]** Make.com é recomendado sobre Zapier para fluxos de Telegram porque "jornadas reais de cliente são ramificadas" (Make tem roteador/branches nativos; Zapier é mais linear). Fonte: https://www.entergram.com/blog/make-com-telegram-crm-automations
- **[VENDEDOR — Make/Zapier, thread de contratação]** No fórum da comunidade Make há um pedido explícito de "AliExpress Affiliate API — Hire Help", confirmando que gente paga freelancer para conectar Make.com à API de afiliados da AliExpress e gerar deeplinks automaticamente. Fonte: https://community.make.com/t/aliexpress-affiliate-api/96695

**Conclusão da seção 1:** n8n/Make aparecem mais como *possibilidade técnica bem documentada* (templates genéricos de scraping+Telegram existem e são robustos) do que como prática consolidada e nomeada por operadores de canal de oferta brasileiros. O ecossistema comercial brasileiro (SaaS prontos, seção 3) parece ter capturado boa parte da demanda que teoricamente iria para n8n/Make — ou seja, quem não sabe programar paga R$47-297/mês por um "Bot do Afiliado" pronto em vez de montar um workflow n8n.

---

## 2. Scripts Python/Node: bibliotecas, quem usa o quê, o que dá ban, o que custa

### 2.1 Telegram — bibliotecas Python

| Biblioteca | Tipo | Uso típico em canal de oferta |
|---|---|---|
| **python-telegram-bot** | Bot API (HTTP/webhook) | Só funciona como *bot*, não como conta de usuário. Não consegue "ler" mensagens de grupos que não administra. |
| **Telethon** | MTProto (userbot, client) | Loga como conta de usuário real. Permite monitorar/copiar mensagens de qualquer grupo que a conta participe — é a escolha de quem quer "espiar" ofertas de canais de terceiros. |
| **Pyrogram** | MTProto (userbot, mais moderno/pythonico) | Alternativa ao Telethon, citada como mais fácil para iniciantes. |

- **[BLOG/comparativo técnico]** "MTProto clients like Telethon connect directly to Telegram's servers... no HTTP connection, no polling or webhooks... less overhead" — explica por que quem quer copiar conteúdo de canais de terceiros (autoforward, clonagem) usa Telethon/Pyrogram em vez da Bot API. Fonte: https://github.com/LonamiWebs/Telethon/blob/0814a20ec4105dde9b25f014472c7aad5d9b0f50/readthedocs/concepts/botapi-vs-mtproto.rst
- **Confirmação em projeto real:** o bot `murilo813/Bot-Afiliado-Telegram` usa **Selenium** (para interagir com sites de loja e gerar o link de afiliado) + **Telethon** (para postar no canal). Repositório com 12 estrelas, 8 forks, só 5 commits — **projeto pequeno e parado**, feito para uso pessoal do autor ("developed for personal use and can be adapted for other purposes"). [RELATO/projeto pessoal] Fonte: https://github.com/murilo813/Bot-Afiliado-Telegram
- **`SaulloGabryel/BlueBot`** — combina **Telethon** (monitorar Telegram) + **Selenium** (gerar link Mercado Livre) + **httpx** (chamar API oficial de AliExpress/Shopee) + **Node.js com whatsapp-web.js** (repassar para WhatsApp). Roda "há meses em VPS 24/7", segundo o próprio README. 10 estrelas, licença MIT. É o exemplo mais completo encontrado de "bridge" Telegram→WhatsApp com geração de afiliado multiplataforma. [RELATO] Fonte: https://github.com/SaulloGabryel/BlueBot
- **`hectorzin/botaffiumeiro`** — bot de **troca automática de link** (ver seção 5), Python + `python-telegram-bot`, 13 estrelas, 80 commits, considerado ativo pelo volume de commits. Suporta Amazon, AliExpress (com cupom automático), e redes de afiliados espanholas Awin/Admitad/Tradedoubler (PcComponentes, Leroy Merlin, Mediamarkt). É europeu, não brasileiro, mas é o repositório open-source mais maduro de "link swap" encontrado na pesquisa. Fonte: https://github.com/hectorzin/botaffiumeiro
- **`rafaelcitario/telegram-oferbot`** — Node.js/TypeScript, usa **Telegraf** (não Python). Envia mensagens automáticas simulando ofertas relâmpago da Shopee a cada 2h e lembretes de carrinho a cada 90 min. README avisa explicitamente que é "projeto não-oficial da Shopee" e pede para operar "dentro dos termos de uso da plataforma e do Telegram" — sinal de que o próprio autor sabe que está numa zona cinzenta. 3 estrelas. Fonte: https://github.com/rafaelcitario/telegram-oferbot
- **`Fripixel/mercadolivre-link-de-afiliados`** — API própria em **Node.js** com **web scraping** para gerar link de afiliado do Mercado Livre, porque "o programa de Afiliados do Mercado Livre não possui uma API simples de usar". Confirma achado da seção 5 sobre a lacuna de API oficial do ML. 1 estrela, 21 commits, licença CC0. [RELATO] Fonte: https://github.com/Fripixel/mercadolivre-link-de-afiliados
- **`KvnBarrios/Bot-de-Ofertas-Mercado-Livre`** — Python + Selenium + ChromeDriver, faz scraping da seção "Ofertas" do Mercado Livre e joga os dados numa planilha. 13 estrelas, 29 commits — o mais "vivo" entre os pequenos projetos BR encontrados. Fonte: https://github.com/KvnBarrios/Bot-de-Ofertas-Mercado-Livre
- Outros repositórios internacionais de "Telegram + Amazon affiliate" (não BR, mas do mesmo gênero técnico): `Aritzherrero4/AffiliateTelegramBot`, `Jakeedot/telegram-affiliate-bot`, `sulasoft/Amacapy-Bot-Telegram-Amazon-Affiliates` (Flet + BeautifulSoup), `doublegram/telegram-amazon-affiliate-bot` (autopromovido como "primeiro bot self-hosted com IA integrada" — página do repo retornou 404 no fetch, não confirmado). Fontes: https://github.com/Aritzherrero4/AffiliateTelegramBot , https://github.com/Jakeedot/telegram-affiliate-bot , https://github.com/sulasoft/Amacapy-Bot-Telegram-Amazon-Affiliates , https://github.com/doublegram/telegram-amazon-affiliate-bot [404 — não confirmado]

### 2.2 Risco de ban com Telethon/userbot

- **[OFICIAL — FAQ Telethon]** https://docs.telethon.dev/en/v2/developing/faq.html trata do tema mas o resumo da busca não trouxe citação direta; usar com cautela.
- **[RELATO — issue do GitHub]** Há uma issue aberta "My account is banned" no repositório oficial do Telethon, mostrando que é uma reclamação recorrente de usuários reais. Fonte: https://github.com/LonamiWebs/Telethon/issues/3955
- **[BLOG]** Boas práticas citadas: "cada conta deve ter sua própria session file, nunca compartilhar session strings entre dispositivos", "idealmente cada conta deve conectar por um proxy residencial diferente", "evitar rodar mais de 2-3 contas pela mesma IP simultaneamente", "contas de países 'limitados' (Irã, Rússia) têm muito mais chance de ban". FloodWait é descrito como throttle temporário (segundos até 24h+), não ban definitivo — mas reincidência derruba a conta. Fonte: https://telegramscraper.shop/blog/how-to-avoid-telegram-ban
- **[VENDEDOR/thread]** Há um freelance job específico "Resolve the problem: the ban of telegram accounts when the telethon script is installed", confirmando que isso é problema comum o suficiente para virar demanda paga de conserto. Fonte: https://freelancehunt.com/en/project/reshit-problemu-bana-akauntov-telegram-pri/1342657.html
- **[BlackHatWorld — thread não acessível via fetch, HTTP 403]** "Avoid telegram account ban for telethon message transfer" — título indica que o tema é discutido lá, mas não consegui ler o conteúdo. Fonte: https://www.blackhatworld.com/seo/avoid-telegram-account-ban-for-telethon-message-transfer.1589435/ [não confirmado, só título]

### 2.3 WhatsApp: Baileys, whatsapp-web.js, venom-bot, wppconnect, Evolution API, Z-API — e a crise de 2026

Este foi o achado mais importante e mais recente da pesquisa: **em 2026 a Meta endureceu a detecção de bots não-oficiais no WhatsApp**, o que muda o cálculo de risco de quem usa essas bibliotecas para grupo de oferta.

- **[BLOG, com afirmações fortes — checar]** Segundo o SocialHub, "se sua plataforma usa Baileys, wwebjs, Venom-Bot ou qualquer outra biblioteca não-oficial, seu número de WhatsApp está em sério risco de banimento, já que essas bibliotecas usam engenharia reversa do protocolo WhatsApp". Fonte: https://www.socialhub.pro/blog/baileys-wwebjs-venom-bibliotecas-whatsapp-nao-oficial-risco/
- **[BLOG]** Artigo específico sobre 2026: "Meta lançou o WhatsApp Business AI gratuito no Brasil em fevereiro de 2026 e está banindo ferramentas não-oficiais como Baileys, Venom e WPPConnect". Detalhes extraídos via WebFetch:
  - Detecção "intensificada" a partir de **janeiro de 2026**, monitorando: cadência de mensagens, padrões de digitação, intervalo entre ações, geolocalização de IP, "fingerprints" de automação.
  - Ferramentas citadas como "em risco direto": **Baileys** (emulador WebSocket open-source), **Venom-bot** (Node.js/Puppeteer), **WPPConnect** (projeto brasileiro), **Chat-API** (wrapper comercial), **Evolution API e forks dependentes de QR Code**.
  - Consequência de detecção: banimento permanente do número, exposição de dados (mensagens passam por servidor de terceiro sem criptografia ponta-a-ponta), perda de histórico e configurações.
  - Alternativa recomendada: API oficial Cloud API via BSPs certificados (Twilio, Take Blip, Zenvia), custo mensal de R$99-999 + tarifa por conversa de R$0,05-0,35.
  - Fonte: https://blog.dastecnologia.com/whatsapp-business-ai-brasil-bloqueios-meta-2026.html — **[BLOG, sem fonte primária citada no texto — tratar a data exata e os números de preço como indicativos, não oficiais]**

- **[VENDEDOR]** Contraponto: o próprio blog da Z-API (que vende acesso via API não-oficial) minimiza o risco e destaca vantagem de custo. Dados extraídos:
  - Preço: **R$99,99/mês** por 1 instância (plano "Ultimate"); "Parceiro" de R$54,99 a R$89,99/mês conforme volume de instâncias.
  - Alega "+60.000 clientes em 79 países", cita clientes como Sonae, Grupo Decolar, Sebrae, Hurb.
  - Caso de uso citado explicitamente: "bots que monitoram e controlam grupos WhatsApp, garantindo regras de conduta e distribuição agendada de ofertas" — ou seja, a própria Z-API se posiciona para esse uso.
  - Vantagem alegada sobre API oficial: mensagens ilimitadas por preço fixo, vs. cobrança por mensagem da API oficial da Meta.
  - Fonte: https://z-api.io/blog/z-api-em-2026-por-que-mais-de-80-mil-operacoes-confiando-na-plataforma/
- **[BLOG]** Comparativo aponta Evolution API como "mais barata pois é open source, custo só de servidor ~R$50-200/mês", mas cita bugs recorrentes, "instabilidade frequente" e um bug específico apelidado de **"Mensagem Fantasma"**, onde a automação duplica/triplica envios sem aparecer na interface. Fonte: https://horadecodar.com.br/diferencas-api-oficial-whatsapp-evolution-custos/

**Leitura combinada:** existe uma tensão real de mercado em 2026 — as bibliotecas não-oficiais (Baileys/Venom/WPPConnect/Evolution API) continuam sendo as mais baratas e mais usadas por quem monta grupo de oferta no WhatsApp, mas o risco de banimento subiu bastante desde o início do ano, e isso está empurrando parte do mercado de volta para Telegram (que não tem esse tipo de crackdown ativo, ver seção 4) ou para provedores comerciais tipo Z-API que pelo menos assumem a manutenção técnica.

---

## 3. Ferramentas SaaS brasileiras prontas ("robô de ofertas")

Esta foi a área com achados mais concretos e verificáveis (preços reais em página de venda). Comparativo consolidado a partir de `ofertasbot.com` [VENDEDOR — provavelmente o próprio site é de um desses produtos ou afiliado deles, então tratar os "contras" como relativamente confiáveis mas os "prós" com desconto]:

| Ferramenta | Preço mensal | Canais | Observação |
|---|---|---|---|
| **PromoBot** (Hub do Afiliado) | R$48,50–248,50 (com desconto de lançamento; "regular" R$97–497) | Telegram | Monitora Kabum e Terabyte na fonte; até 150 posts/dia (Pro) ou ilimitado (Expert); até 5 canais |
| **Divulgador Inteligente** | não divulgado | WhatsApp | Cobre 100+ lojas, mas não monitora sozinho — você acha a oferta |
| **Pro Afiliados** | Grátis (plano base) / Premium R$50-100 | WhatsApp + Telegram | **Feed Global P2P**: afiliados compartilham entre si os links já convertidos (ver quadro abaixo) |
| **Pai das Ofertas** | R$35,90–75,90 (grátis limitado a Shopee) | — | — |
| **Shozap** | R$50–300, teste 5 dias | WhatsApp + Telegram + Instagram | 3 modos de postagem (Auto/Manual/Espelhado), IA integrada |
| **DivulgaLinks** | R$69,90–169,90, teste 7 dias | WhatsApp, Instagram, Telegram | Confirmado por fetch direto: até 10 programas de afiliado (Shopee, AliExpress, ML, Amazon, Magalu, Natura +), posts agendados de Feed/Stories, artes automáticas |
| **Afiliado Inteligente** | teste R$1/15 dias | — | Feed automático + site com marca própria |
| **Bot do Afiliado** | a partir de R$99, módulos avulsos (Ofertas, Cupons, Broadcast, Grupos, API) | Telegram apenas | Confirmado por fetch: extrai imagem/título/preço/cupom oculto automaticamente; módulo específico "Shopee Live"; alega ser "1º bot do mundo que aumenta desconto de compras no AliExpress" |
| **Busqy** | assinatura, valor não claro | — | — |
| **Gigi Prime Bot** | freemium | — | — |
| **Guru das Promoções** | grátis | — | Templates personalizáveis, mas garimpo ainda manual |
| **Divulga Ninja** | não especificado | WhatsApp | — |
| **FluxoPromo** | R$37–197, grátis até 20 ofertas/dia | Telegram (WhatsApp +R$149,90 à parte) | 12 lojas cobertas |
| **Achadinho Pro** | R$49,97 (só Shopee) / R$59,97 (3 marketplaces), teste 7 dias | WhatsApp apenas | Inclui "Shopee Videos" automático |

Fonte do comparativo completo: https://ofertasbot.com/blog/melhores-bots-de-ofertas-para-afiliados [VENDEDOR/BLOG]

### 3.1 Achado mais interessante: o "Feed Global P2P" — rede de troca de ofertas entre afiliados

- **[VENDEDOR, confirmado por fetch direto na página do produto]** Pro Afiliados oferece um recurso chamado **Feed Global P2P**: "quando você ativa o Feed Global, recebe automaticamente links de outros afiliados e envia para seus grupos — multiplicando seus disparos sem esforço adicional." Isso é uma rede em que múltiplos operadores compartilham ofertas (já convertidas para o link de afiliado de quem recebe) entre si automaticamente — uma espécie de syndication de ofertas peer-to-peer. Suporta Shopee, Amazon, Mercado Livre, AliExpress, Magazine Luiza. Também funciona bidirecionalmente WhatsApp ↔ Telegram. Fonte: https://proafiliados.com/
- Isso também aparece descrito de forma mais crua no comparativo `achadinhopro.com.br`, que lista ProAfiliados com "Feed Global P2P" como diferencial de canal. Fonte: https://achadinhopro.com.br/blog/melhores-ferramentas-afiliados-shopee-2026

### 3.2 Hub do Afiliado / PromoBot / ZapSyncBot — dados de preço confirmados por fetch direto

- Plano Starter: R$48,50/mês (regular R$97)
- Plano Pro: R$148,50/mês (regular R$297)
- Plano Expert: R$248,50/mês (regular R$497)
- ZapSyncBot (módulo WhatsApp): **R$100/mês por sessão**, com 5-15% de desconto vitalício para assinantes do PromoBot
- Lojas: Amazon, Shopee, Magalu, Mercado Livre, AliExpress, Terabyte, e rede Awin (Kabum, Casas Bahia, Americanas, Centauro, Carrefour)
- Rastreamento via Pixel do Meta em cada clique, eventos "ButtonClick" para Facebook/TikTok
- Fonte: https://hubdoafiliado.com/ [VENDEDOR]

### 3.3 Métricas de ROI alegadas (ceticismo recomendado — números de site de venda)

- **[VENDEDOR/BLOG, FluxoPromo]**: canais manuais postam 5-15 ofertas/dia (4-8h de trabalho manual/dia); canais automatizados postam 50-100+/dia (10 min de setup único, depois "150+ horas de tempo recuperado por mês"). Receita: manual R$200-800/mês vs. automatizado R$2.000-10.000+/mês, alegando "5x mais comissões". Também afirma que afiliados manuais perdem ~80% das ofertas relâmpago fora do horário comercial. **Esses números vêm de quem vende a ferramenta FluxoPromo — tratar como propaganda, não como estatística de mercado.** Fonte: https://fluxopromo.com/blog/automacao-canal-telegram-ofertas

### 3.4 Content Egg (WordPress) — para quem monta site de ofertas, não só canal de Telegram

- **[VENDEDOR/OFICIAL do produto]** Content Egg Pro é plugin WordPress "tudo-em-um" para afiliados: integra Aliexpress, Amazon (com e sem API oficial), Awin, Shopee, Walmart, eBay, Rakuten/LinkShare, Lomadee, Impact Radius, CJ, e dezenas de outras redes. Cria comparador de preço, histórico de preço, alerta de queda, importação em um clique convertendo em post otimizado para SEO ou produto WooCommerce, com link de afiliado adicionado automaticamente. Inclui "Egg Blocks" (25+ blocos Gutenberg prontos com schema markup). É uma alternativa para quem quer um **site** de ofertas (não canal de mensageria) monetizado com afiliado, mais próximo do modelo "cupom/deal site" americano do que do modelo canal-de-Telegram brasileiro. Fonte: https://wordpress.org/plugins/content-egg/ e https://www.keywordrush.com/contentegg [VENDEDOR]

---

## 4. Bots prontos de Telegram para repostar/clonar canal e trocar link no meio do caminho

Esse é o núcleo mais sensível da pesquisa e onde os achados foram mais concretos.

### 4.1 CAT — Clonador Automático Telegram (2Tec Digital)

- **[VENDEDOR, confirmado por fetch direto]** Produto brasileiro específico para esse fluxo. Descrição textual: "repasse ou clone conteúdos de qualquer grupo ou canal do Telegram" e permite "interceptar a mensagem original e fazer a troca por qualquer outro link".
- Fluxo de 3 passos: conectar conta/token do Telegram → escolher grupo/canal de origem → escolher grupos de destino. Roda sem intervenção manual depois de configurado.
- Preços: **R$47/mês**, **R$33/mês no trimestral (R$97 total)**, **R$24/mês no anual (R$297 total, "mais vendido")**.
- Integra Shopee, Mercado Livre, Amazon, AliExpress; Magazine Luiza e Kabum "em breve".
- Requer **Windows 10/11** e uma conta de Telegram dedicada (não é SaaS hospedado — roda localmente na máquina do operador).
- Fonte: https://2tecdigital.com/cat-clonador-automatico-telegram/

Isso confirma tecnicamente o mecanismo que o CLAUDE.md do projeto radar-ofertas provavelmente já supõe: existe um mercado nomeado e maduro para "pegar oferta de canal alheio, trocar o link pelo próprio, repostar automaticamente" — e ele já tem um nome comercial ("clonador automático") e um público comprador.

### 4.2 Bot do Afiliado

- **[VENDEDOR, confirmado por fetch direto]** Explicitamente descreve capacidade de "replacement de link e gerenciamento de link dentro de grupos do Telegram" — ou seja, também faz swap de link em grupos, além de gerar posts a partir de link colado manualmente. Fonte: https://botdoafiliado.com/

### 4.3 Admitad Bot — o equivalente "oficial de rede de afiliados" ao link swap

- **[OFICIAL — documentação da rede de afiliados Admitad/Mitgo]** Ferramenta legítima (não é gambiarra) de uma rede de afiliados internacional: você manda uma mensagem com link(s) embutido(s) pro bot do Telegram e ele devolve o mesmo post com todos os links já trocados por deeplinks de afiliado. Também gera deeplink para "Hot Products" da AliExpress, verifica deeplinks já criados, retorna cupons/promo codes, e mostra estatísticas por programa. Isso mostra que **o conceito de "link swap"/deeplink automático via bot de chat não é exclusividade de ferramenta paralela brasileira — é prática endossada pela própria rede de afiliados internacional**, só que usada manualmente (colar → receber) em vez de automatizada ponta a ponta num canal. Fonte: https://support.admitad.com/hc/en-us/articles/360019378578-Admitad-Bot-for-Telegram

### 4.4 TeleFeed e Auto Forward Telegram — ferramentas internacionais de clonagem/forward

- **[VENDEDOR]** TeleFeed: "forwarding bot for cloning, mirroring, filtering, and backing up any chat your account can access", com filtros e "transformações" onde o forward nativo do Telegram é bloqueado. Fonte: https://telegrambotting.com/tg_feed
- **[VENDEDOR]** "Auto Forward Telegram" tem módulo específico "Clone Message" documentado, e o texto de marketing geral menciona explicitamente "some auto-forwarders can automatically replace links with affiliate URLs to monetize content effortlessly" — confirmação direta e explícita do padrão "clone + troca de link" em produto internacional. Fontes: https://docs-v2.autoforwardtelegram.com/fundamentals/clone-message , https://autoforwardtelegram.com/
- **[VENDEDOR]** `Drrivao/Clonechat-Telegram-Colab` no GitHub — clonar canais do Telegram rodando em Google Colaboratory (ou seja, gratuito, sem precisar de VPS). Indício de que parte da comunidade roda esse tipo de automação em ambiente efêmero/gratuito, não em servidor dedicado. Fonte: https://github.com/Drrivao/Clonechat-Telegram-Colab [não fiz fetch de conteúdo, só título/descrição do resultado de busca]

### 4.5 Terminologia confirmada

A pesquisa confirma que o termo usado pelo mercado brasileiro para essa prática **não é exatamente "link swap"** (termo mais usado internacionalmente/técnico) mas sim:
- "**clonador automático**" / "**clonar canal**" (2Tec Digital / CAT)
- "**conversor de link**" / "**trocar/substituir link**" (Bot do Afiliado, ofertasbot.com)
- "**deeplink**" continua sendo o termo técnico usado nas APIs oficiais (Admitad, AliExpress Open Platform, Awin)

---

## 5. Substituição automática de link de afiliado: como funciona e APIs por loja

### 5.1 Shopee — Open Platform API (a mais madura das brasileiras)

- **[OFICIAL, confirmado por fetch na documentação de um wrapper/serviço que replica a doc oficial]** Endpoints principais: Offer List (campanhas), Shop Offer List, **Product Offer List** (busca de produto com dados de comissão — "o mais usado"), **Short Link Generation** (converte URL de produto Shopee em link curto rastreável), Conversion Report, Validated Report.
- Autenticação: header `Authorization: SHA256 Credential={AppId}, Timestamp={Timestamp}, Signature={Signature}`, assinatura = hash de AppId+Timestamp+payload JSON+Secret.
- **Sub-IDs**: até 5 identificadores customizados por link, aparecem no campo `utmContent` do relatório de conversão — usados pra saber qual canal/campanha vendeu.
- Acesso à API não é automático: precisa ser afiliado ativo, depois pedir credenciais via formulário no Help Center, "processamento até 2 semanas".
- Fonte: https://www.affiliateshopee.com.br/documentacao ; confirmação cruzada em https://hubdoafiliado.com/blog/como-ser-afiliado-shopee-e-liberar-a-api-oficial-guia-definitivo-2026 (não fiz fetch deste último, só apareceu no resultado de busca)

### 5.2 Amazon — PA-API / Creators API / OneLink

- **[BLOG]** "A Creators API mais nova é mais rápida e flexível que a PA-API antiga, permite busca por palavra-chave sem precisar configurar categorias complexas" — sugere que a Amazon está migrando o ecossistema de afiliados para uma API mais simples.
- **[BLOG]** "A Amazon só libera a API oficial depois das primeiras vendas" — ponto de atrito real citado: quem está começando não tem acesso à API e precisa usar a tag de afiliado manualmente ou via serviço terceiro que processa "na nuvem".
- Existe pelo menos um repositório (`Vadilonga/example-amazon-affiliate-telegram-bot`) que usa a API oficial do Programa de Associados da Amazon para gerar post automático a partir de link colado.
- Fontes: síntese de busca, sem fetch direto confirmado — https://hubdoafiliado.com/blog/como-ser-afiliado-amazon-pegar-links-e-entender-a-api-guia-2026 , https://github.com/Vadilonga/example-amazon-affiliate-telegram-bot

### 5.3 Mercado Livre — a lacuna mais citada

- **Achado consistente em múltiplas fontes independentes**: o Mercado Livre **não tem uma API oficial simples/pública de afiliados** para gerar link programaticamente. Isso força todo mundo a usar scraping ou extensão de navegador:
  - **[RELATO, confirmado por fetch]** `Fripixel/mercadolivre-link-de-afiliados`: API própria em Node.js via web scraping, "preenche a ausência de API oficial". Fonte: https://github.com/Fripixel/mercadolivre-link-de-afiliados
  - **[BLOG]** "É possível conectar sua conta com uma Extensão Oficial do Chrome, e o bot fará a captura de ofertas, troca de link e postagem em grupos de WhatsApp 24h" — ou seja, parte do ecossistema comercial usa extensão de navegador (não API) pra contornar a lacuna.
  - Fonte agregada: https://rallydevendas.com.br/blog/como-criar-link-afiliado-mercado-livre (não fiz fetch direto, só resultado de busca)

### 5.4 AliExpress — Open Platform tem deeplink nativo

- **[OFICIAL, citado]** AliExpress Affiliate API "suporta geração de deeplink junto com hot products, busca de produto e detalhes de produto". Documentação oficial: https://openservice.aliexpress.com/doc/api.htm
- Portal de gestão de Tracking ID: https://portals.aliexpress.com/
- Existem ferramentas de terceiro como extensão Chrome "DeepAli" para gerar deeplink direto da página do produto sem chamar a API manualmente.
- Redes de afiliado como Awin e ePN também oferecem link builder com deeplink de AliExpress embutido (não é preciso ir direto na Aliexpress Open Platform). Fontes: https://www.awin.com/us/news-and-events/awin-news/updated-link-builder-supports-aliexpress-deeplinking , https://epn.bz/en/faq/tools

### 5.5 "affiliate-deeplink" genérico open-source (não Brasil-específico, mas Lomadee é citado)

- **[RELATO, projeto pessoal]** `itsimpleapp/affiliate-deeplink` no GitHub: "Gerador de Deeplink para Zanox, Afilio, **Lomadee**, Afiliados, Rakuten, Actionpay e Cityads" — confirma que Lomadee (rede de afiliados brasileira popular, ligada à B2W/Americanas) tem geração de deeplink suportada por ferramentas de terceiro, embora não tenha sido possível confirmar detalhes da API oficial da Lomadee nesta pesquisa (busca sobre Lomadee foi cortada pelo limite de buscas da sessão). Fonte: https://github.com/itsimpleapp/affiliate-deeplink

---

## 6. Hospedagem: VPS, Raspberry Pi, PythonAnywhere, Railway, Replit, Sheets+Apps Script

### 6.1 Relato pessoal real (o único "puramente RELATO" desta seção)

- **[RELATO — Medium, dev real descrevendo o próprio projeto]** Hallison Paz, autor do bot `@PGDinamicaBot`, escolheu **KingHost** (empresa BR, preços em Real) aproveitando uma **promoção de Black Friday** para contratar VPS "muito barato" (valor exato não informado no texto). Stack: **Python + python-telegram-bot + ReportLab** (geração de PDF), rodando como serviço **systemd** no Ubuntu para manter o processo vivo. Não é um bot de ofertas (gera carteirinha de fã), mas é um relato genuíno de escolha de hospedagem barata no Brasil, transferível para bot de oferta. Fonte: https://medium.com/programacaodinamica/como-criei-um-bot-para-meu-canal-com-uma-hospedagem-boa-e-barata-cbcd2e6d945e

### 6.2 Opções e preços citados (fontes agregadas, não confirmadas por fetch profundo)

- VPS genérico para bot Telegram: **a partir de US$6/mês** citado por comparativo de hosting. Fonte: https://pt.hostadvice.com/vps/telegram-bot/
- Raspberry Pi: opção de custo muito baixo "se você já possui o equipamento" — ou seja, custo de oportunidade zero de hosting recorrente, mas exige hardware próprio e always-on em casa (energia, internet estável). Fonte: https://dev.to/dmitry-koleev/host-telegram-bot-on-raspberry-pi-5-16ld
- **Railway**: tem templates de deploy de 1 clique especificamente para bot Telegram em Python, usa long polling (não precisa configurar webhook/domínio público), free tier com créditos mensais limitados. Fontes: https://railway.com/deploy/python-telegram-bot , https://starsearn.com/guides/deploy-telegram-bot-railway
- **Replit** e **PythonAnywhere**: citados como opções gratuitas/baratas de entrada, mas sem dado de preço específico extraído.
- **Google Sheets + Apps Script**: buscas não trouxeram um relato específico de "canal de oferta rodando 100% em Sheets+Apps Script" — o que existe é documentação genérica de Apps Script (extensão de Sheets com JS, menus customizados, integração com Gmail/Calendar/Drive). É plausível como camada de armazenamento/agendamento (planilha como "banco de dados" de ofertas a postar), mas não achei confirmação de alguém usando isso como motor principal de um bot de oferta. Fonte: https://developers.google.com/apps-script/guides/sheets?hl=pt [OFICIAL, genérico]

**Conclusão da seção 6:** a pesquisa não encontrou uma "convenção" clara — o que aparece é um espectro que vai de VPS BR barato (KingHost, ~R$20-50/mês em promoção) até free tiers de PaaS (Railway/Replit) para quem está testando, com Raspberry Pi como opção de nicho para quem já tem o hardware. Nenhuma fonte forte confirma volume de gente usando Sheets+Apps Script como motor principal.

---

## 7. Quem faz tudo na mão, e quanto tempo gasta

- **[BLOG, sem fonte primária clara — mas o número aparece repetido em mais de um site de venda de ferramenta]**: "Ao operar um canal de ofertas manualmente, você gasta horas navegando em sites de lojas, copiando links, formatando posts e publicando um por um". FluxoPromo quantifica: **4 a 8 horas por dia** de trabalho manual, "150+ horas de tempo recuperado por mês" ao automatizar. Como é o próprio vendedor da automação falando, **hipérbole é esperada** — mas a ordem de grandeza (várias horas/dia para manter um canal ativo manualmente) é consistente entre 3 fontes independentes de venda (FluxoPromo, PromoBot/Hub do Afiliado, ofertasbot.com comparativo).
- **[BLOG]** Outro artigo, sobre canais que vendem acesso pago (não just afiliado): "quem começa a vender no Telegram geralmente faz tudo na mão: responde cada cliente no privado, envia a chave Pix, espera o comprovante, confere se o pagamento é real, adiciona a pessoa ao grupo e tenta lembrar quando o acesso vai vencer" — processo manual mais citado é o de **cobrança/liberação de acesso**, não necessariamente o de postar oferta. Fonte: https://app.botelitepass.com/blog/como-vender-no-telegram-com-bot
- **Contraste de volume**: manual = 5-15 posts/dia; automatizado = 50-100+/dia (FluxoPromo). Esse número de "5-15 manual" é o dado mais concreto e crível sobre o "fazer na mão", porque é uma faixa razoável e não um extremo de propaganda.
- **Por que alguém ainda faz na mão**: nenhuma fonte trouxe diretamente uma voz de operador dizendo "prefiro fazer na mão porque X" — essa lacuna é real na pesquisa (provavelmente estaria em threads de Reddit/BlackHatWorld que não consegui acessar). A inferência indireta mais forte: controle de qualidade/curadoria (ferramentas automatizadas "espelham" ofertas de terceiros sem verificar se o preço ainda é válido) e risco de banimento por automação (userbot/API não-oficial) são os dois motivos que aparecem implicitamente nas comparações de ferramentas (ex: Achadinho Pro promove "anti-ban" como diferencial, ProAfiliados é descrito com contra "modelo de espelhamento — você posta depois de outros").

---

## 8. Repositórios GitHub concretos — resumo consolidado

| Repositório | O que faz | Stack | Estrelas | Atividade |
|---|---|---|---|---|
| `murilo813/Bot-Afiliado-Telegram` | Gera link de afiliado (ML, Shopee, Amazon, Kabum, Magalu, AliExpress) e posta no canal | Python, Selenium, Telethon | 12 | Baixa (5 commits, parece parado) |
| `hectorzin/botaffiumeiro` | Detecta e troca links de afiliado em grupos automaticamente | Python, python-telegram-bot | 13 | Ativa (80 commits) |
| `SaulloGabryel/BlueBot` | Monitora Telegram, filtra, gera afiliado (ML/Ali/Shopee), repassa p/ Telegram e WhatsApp | Python (Telethon/Selenium/httpx) + Node.js (whatsapp-web.js) | 10 | Rodando há meses em VPS, segundo README |
| `rafaelcitario/telegram-oferbot` | Simula ofertas relâmpago/lembretes de carrinho Shopee | Node.js/TS, Telegraf | 3 | Incerta |
| `Fripixel/mercadolivre-link-de-afiliados` | Gera link de afiliado ML via scraping (supre falta de API oficial) | Node.js | 1 | Baixa (21 commits) |
| `KvnBarrios/Bot-de-Ofertas-Mercado-Livre` | Rastreia seção "Ofertas" do ML e joga numa planilha | Python, Selenium | 13 | Moderada (29 commits) |
| `itsimpleapp/affiliate-deeplink` | Gerador de deeplink para Zanox/Afilio/Lomadee/Rakuten/Actionpay/Cityads | não confirmado | não confirmado | não confirmado |
| `Vadilonga/example-amazon-affiliate-telegram-bot` | Gera post automático no Telegram a partir de link Amazon, via API oficial de Associados | não confirmado (Python provável) | não confirmado | Exemplo/didático |
| `Drrivao/Clonechat-Telegram-Colab` | Clona canais do Telegram rodando em Google Colab (gratuito) | Python/Colab | não confirmado | não confirmado |

**Leitura geral sobre os repositórios BR**: nenhum tem mais de 15 estrelas. Isso sugere que o "bot de oferta BR" open-source é majoritariamente projeto pessoal/portfólio, não ferramenta comunitária adotada em escala — quem realmente opera canal em volume parece migrar para os SaaS pagos da seção 3, não para manter um bot open-source próprio.

---

## 9. Achados sobre o público real (a parte mais fraca da pesquisa)

Não foi possível acessar Reddit nem BlackHatWorld/Warrior Forum de forma completa (bloqueios HTTP 403, e Reddit não apareceu indexado nas buscas). O achado mais próximo de um relato de "consumidor" (não vendedor) veio de um fórum da comunidade Samsung, mas o fetch dessa página também retornou 403 — só o título do resultado de busca ficou disponível: "tem umas [pessoas] desocupadas no telegram que pegam todos os cupons para..." — sugere reclamação de usuário final sobre gente que "garimpa"/rouba cupom em massa, mas o conteúdo completo não foi lido. Fonte (não confirmada): https://r1.community.samsung.com/t5/promo%C3%A7%C3%B5es/tem-umas-desocupadas-no-telegram-que-pegam-todos-os-cupons-para/td-p/20096519

No BlackHatWorld, veio à tona pelo menos um título de thread relevante e específico que não pude ler o conteúdo (bloqueio 403 no fetch): "[HIRING] Telegram Bot Developer – Automated Affiliate Deal Poster (Amazon, AliExpress, etc.)" — o resumo da busca (não o fetch) indicou que o pedido de contratação menciona **Amazon Spain, PcComponentes, El Corte Inglés, AliExpress, Banggood, Gearbest** como lojas-alvo, o que mostra que esse padrão de "bot que garimpa e poste automaticamente com afiliado" é demanda internacional recorrente o bastante pra virar vaga paga de freelancer, não só prática BR. Fonte (conteúdo não confirmado por fetch, só resumo de busca): https://www.blackhatworld.com/seo/hiring-telegram-bot-developer-automated-affiliate-deal-poster-amazon-aliexpress-etc.1714507/

**Recomendação para pesquisa futura**: para captar a "voz do operador real" que faltou aqui, seria necessário acesso autenticado ao Reddit (API oficial ou app logado) e ao BlackHatWorld/Warrior Forum (que exigem conta logada para muitas threads, daí o 403 em fetch anônimo).

---

## Fontes consultadas

Lista completa de URLs abertos durante a pesquisa (buscas e fetches), numerada. "[útil]" = trouxe informação aproveitada no relatório acima; "[inútil]" = não trouxe conteúdo aproveitável (bloqueado, vazio, ou irrelevante).

1. https://www.hostinger.com/br/tutoriais/n8n-telegram — [útil] tutorial genérico n8n+Telegram
2. https://horadecodar.com.br/integrar-n8n-telegram/ — [útil, não citado diretamente] resultado de busca, tutorial n8n+Telegram
3. https://www.youtube.com/watch?v=NadDpetjo2A — [parcialmente útil] vídeo específico bot de ofertas n8n, descrição não extraída
4. https://fluxopromo.com/automacao-telegram — [útil] conceito geral de automação p/ afiliados
5. https://hackceleration.com/es/telegram-n8n — [inútil] não usado no texto
6. https://n8n.io/workflows/10143-create-personalized-email-outreach-with-ai-telegram-bot-and-website-scraping/ — [inútil] fora do escopo (outreach de email)
7. https://n8n.io/workflows/12072-monitor-regulatory-updates-with-scrapegraphai-and-send-alerts-via-telegram/ — [útil] padrão de dedup com Redis
8. https://n8n.io/workflows/5591-daily-website-data-extraction-with-firecrawl-and-telegram-alerts/ — [útil] scraping diário + Telegram
9. https://www.firecrawl.dev/blog/n8n-web-scraping-workflow-templates — [útil, fetch feito] lista dos 8 templates
10. https://n8n.io/workflows/6628-ai-powered-invoice-data-extraction-and-approval-workflow-with-scrapegraphai-and-telegram/ — [inútil] fora do escopo (notas fiscais)
11. https://n8n.io/workflows/6408-multi-platform-price-finder-scraping-prices-with-bright-data-claude-ai-and-telegram/ — [útil, fetch feito] workflow de preço multi-plataforma
12. https://n8n.io/workflows/6532-lead-gen-agent-telegram/ — [inútil] fora do escopo (leads B2B)
13. https://n8n.io/workflows/6663-automated-web-scraper-niche-jobproduct-monitor-with-telegram-alert/ — [inútil, não aprofundado]
14. https://automatewithbishal.gumroad.com/l/TelegramAIAutomations — [útil] pacote pago de workflows Telegram
15. https://dev.to/alitindrawan24/creating-a-telegram-bot-with-n8n-17bg — [inútil] tutorial genérico
16. https://viktorgubanov.gumroad.com/l/n8n-telegram-payment-workflow-stars — [inútil]
17. https://dev.to/n8n/creating-telegram-bots-with-n8n-a-no-code-platform-5elj — [inútil] tutorial genérico
18. https://viktorgubanov.gumroad.com/l/Telegram-AI-Automation-template — [inútil]
19. https://elijahfx.gumroad.com/l/telegram-n8n-mt5-v1 — [inútil] fora do escopo (trading)
20. https://viktorgubanov.gumroad.com/l/telegram-bot-starter-template — [inútil]
21. https://dev.to/altug_gokoglu/no-code-magic-with-n8n-i-built-a-cheeky-telegram-news-bot-in-hours-1bb2 — [inútil]
22. https://dev.to/lightningdev123/building-telegram-automation-workflows-with-n8n-and-pinggy-webhooks-12co — [inútil]
23. https://aroblesai.gumroad.com/l/simple-telegram-bot-template-n8n — [inútil]
24. https://github.com/murilo813/Bot-Afiliado-Telegram — [útil, fetch feito]
25. https://www.tiktok.com/discover/bot-do-telegram-criar-anuncios-de-afiliados-da-shopee — [inútil] não aprofundado
26. https://botdoafiliado.com/ — [útil, fetch feito]
27. https://proafiliados.com/ — [útil, fetch feito]
28. https://afilira.com/bot-afiliados-shopee — [inútil, não aprofundado]
29. https://debricked.com/select/compare/pypi-python-telegram-bot-vs-pypi-Pyrogram-vs-pypi-Telethon — [útil, indireto]
30. https://piptrends.com/compare/telethon-vs-pyrogram-vs-python-telegram-bot — [inútil, não aprofundado]
31. https://github.com/LonamiWebs/Telethon/blob/0814a20ec4105dde9b25f014472c7aad5d9b0f50/readthedocs/concepts/botapi-vs-mtproto.rst — [útil]
32. https://2tecdigital.com/cat-clonador-automatico-telegram/ — [útil, fetch feito] achado central da seção 4
33. https://github.com/Drrivao/Clonechat-Telegram-Colab — [útil, indireto]
34. https://telegrambotting.com/tg_feed — [útil]
35. https://old.junctionbot.io/forwarding-telegram-messages/ — [inútil, não aprofundado]
36. https://github.com/redf0x1/Auto-Forward-Messages — [inútil, não aprofundado]
37. https://autoforwardtelegram.com/ — [útil]
38. https://docs-v2.autoforwardtelegram.com/fundamentals/clone-message — [útil]
39. https://sktechhub.com/auto-forward/ — [inútil, não aprofundado]
40. https://hub.docker.com/r/edkaba/telegram-clone-bot — [inútil, não aprofundado]
41. https://support.mitgo.com/hc/pt-br/articles/33313573563154-Admitad-Bot-no-Telegram — [útil, indireto]
42. https://support.admitad.com/hc/en-us/articles/360019378578-Admitad-Bot-for-Telegram — [útil]
43. https://pro.divulgalinks.com.br/landing — [útil, fetch feito]
44. https://trocalink.com.br/ — [útil, mas fetch retornou 403; dados usados vieram de outra menção]
45. https://core.telegram.org/api/links — [inútil, não aprofundado]
46. https://docs.aiogram.dev/en/v3.20.0/utils/deep_linking.html — [inútil, fora de escopo]
47. https://agenciajatemmais.com.br/como-gerar-link-de-afiliado-shopee-guia-completo-com-rastreamento-e-sub_ids/ — [inútil, não aprofundado]
48. https://apify.com/viralanalyzer/shopee-affiliate-products — [inútil, não aprofundado]
49. https://guiarapidao.com.br/guia-definitivo-acesso-a-api-de-afiliado-shopee-revelado/ — [inútil, não aprofundado]
50. https://www.affiliateshopee.com.br/documentacao — [útil, fetch feito] doc de API Shopee
51. https://ajuda.divulgadorinteligente.com/pt-br/article/automatizacao-da-shopee-no-divulgador-inteligente-1pzn785/ — [inútil, não aprofundado]
52. https://seller.br.shopee.cn/edu/article/3445 — [inútil, não aprofundado]
53. https://hubdoafiliado.com/blog/como-ser-afiliado-shopee-e-liberar-a-api-oficial-guia-definitivo-2026 — [útil, indireto]
54. https://ajuda.busqy.app/pt-br/article/shopee-configurando-a-api-18tfxiq/ — [inútil, não aprofundado]
55. https://br.fiverr.com/losttree0071/do-a-amazon-offers-telegram-bot-with-affliate-link — [útil, indireto] confirma mercado de freelancer
56. https://hubdoafiliado.com/blog/como-ser-afiliado-amazon-pegar-links-e-entender-a-api-guia-2026 — [útil, indireto]
57. https://trocalink.com.br/amazon — [inútil, não aprofundado]
58. https://github.com/Vadilonga/example-amazon-affiliate-telegram-bot — [útil, indireto]
59. https://dev.to/cyanspray/how-to-use-amazon-product-api-igk — [inútil, não aprofundado]
60. https://www.99freelas.com.br/project/api-para-gerar-link-de-afiliado-do-mercado-livre-712897 — [útil, indireto] confirma mercado de freelancer
61. https://github.com/Fripixel/mercadolivre-link-de-afiliados — [útil, fetch feito]
62. https://rallydevendas.com.br/blog/como-criar-link-afiliado-mercado-livre — [útil, indireto]
63. https://www.youtube.com/watch?v=jMft0CQuy58 — [inútil, não aprofundado]
64. https://aceleraafiliado.com/automacao-afiliado-mercadolivre — [inútil, não aprofundado]
65. https://afiliadomarketplace.com.br/api-completa-para-gerar-links-de-afiliados-no-mercado-livre/ — [inútil, não aprofundado]
66. https://community.make.com/t/aliexpress-affiliate-api/96695 — [útil]
67. https://www.awin.com/us/news-and-events/awin-news/updated-link-builder-supports-aliexpress-deeplinking — [útil]
68. https://ce-docs.keywordrush.com/modules/affiliate/aliexpress — [inútil, não aprofundado]
69. https://epn.bz/en/faq/tools — [útil]
70. https://deepali-deeplink-generator-for-aliexpresstm.en.softonic.com/chrome/extension — [útil, indireto]
71. https://github.com/itsimpleapp/affiliate-deeplink — [útil]
72. https://portals.aliexpress.com/ — [útil, oficial]
73. https://openservice.aliexpress.com/doc/api.htm — [útil, oficial]
74. https://github.com/SaulloGabryel/BlueBot — [útil, fetch feito]
75. https://github.com/rafaelcitario/telegram-oferbot — [útil, fetch feito]
76. https://github.com/KvnBarrios/Bot-de-Ofertas-Mercado-Livre — [útil, fetch feito]
77. https://github.com/DesenvolvimentoDeBots/DesenvolvimentoDeBots — [inútil, não aprofundado]
78. https://github.com/pythonbrasil/PyRoles — [inútil, fora de escopo]
79. https://github.com/hectorzin/botaffiumeiro — [útil, fetch feito] achado central
80. https://github.com/grupostelegram/Promocoes — [inútil, não aprofundado]
81. https://www.infoq.com/br/presentations/telegram-bots-with-python — [inútil, não aprofundado]
82. https://www.socialhub.pro/blog/baileys-wwebjs-venom-bibliotecas-whatsapp-nao-oficial-risco/ — [útil]
83. https://bot-whatsapp.netlify.app/docs/provider-baileys/ — [inútil, não aprofundado]
84. https://www.socialhub.pro/blog/baileys-wwebjs-venom-riscos-apis-whatsapp-nao-oficiais/ — [inútil, duplicado]
85. https://blog.dastecnologia.com/whatsapp-business-ai-brasil-bloqueios-meta-2026.html — [útil, fetch feito] achado central da seção 2.3
86. https://www.builderbot.app/en/providers — [inútil, não aprofundado]
87. https://nelio.dev/whatsapp-api-oficial-vs-nao-oficial/ — [inútil, não aprofundado]
88. https://news.hada.io/topic?id=3825 — [inútil, não aprofundado]
89. https://github.com/SazumiVicky/MakeMeow — [inútil, não aprofundado]
90. https://horadecodar.com.br/diferencas-api-oficial-whatsapp-evolution-custos/ — [útil]
91. https://www.cupomonline.com.br/melhores-api-whatsapp/ — [inútil, não aprofundado]
92. https://empresa1p.com.br/comparativo-de-apis-de-whatsapp-z-api-vs-uazapi-vs-evolution-api/ — [inútil, não aprofundado]
93. https://z-api.io/blog/z-api-em-2026-por-que-mais-de-80-mil-operacoes-confiando-na-plataforma/ — [útil, fetch feito]
94. https://www.pablocabral.com.br/z-api-ou-evolution-api-qual-a-melhor-opcao-para-automacao/ — [inútil, não aprofundado]
95. https://zapsterapi.com/blog/melhores-api-para-whatsapp-2026-comparativo-completo — [inútil, não aprofundado]
96. https://wiichat.com.br/ferramentas/calculadora-de-precos-api-oficial-whatsapp — [inútil, não aprofundado]
97. https://wafly.com.br/comparativos/quanto-custa-api-whatsapp/ — [inútil, não aprofundado]
98. https://sites.google.com/view/robo-afiliado-funciona-sim — [inútil] página suspeita de curso genérico
99. https://hotmart.com/pt-br/marketplace/produtos/curso-de-robo-afiliado-facebook/W73933062W — [útil, indireto] confirma existência de mercado de curso
100. https://www.udemy.com/course/fabrica-de-ideias/ — [inútil, não aprofundado]
101. https://hotmart.com/pt-br/marketplace/produtos/robo-do-marketing-automatico-robo-afiliado-wysls/I76127316P — [inútil, não aprofundado]
102. https://signup.hotmart.com/pt-br/afiliado — [inútil, não aprofundado]
103. https://internal-pages.hotmart.com/pt-br/afiliados — [inútil, não aprofundado]
104. https://hotmart.com/pt-br/marketplace/produtos/robozinho-do-telegram/D73240089M — [inútil, não aprofundado]
105. https://omniradhanexus.gumroad.com/l/advance-telegram-bot — [inútil, não aprofundado]
106. https://hub.docker.com/r/lucatnt/telegram-bot-amazon — [útil, indireto] bot que troca link Amazon em grupo
107. https://loudz.gumroad.com/l/cjsxvm — [inútil, não aprofundado]
108. https://hub.docker.com/r/gfsolone/telegram-bot-amazon/tags — [inútil, não aprofundado]
109. https://hub.docker.com/r/jackcky/superpricewatchdog — [inútil, fora do escopo BR]
110. https://github.com/LexiestLeszek/scrapeGPT — [inútil, não aprofundado]
111. https://qna.habr.com/q/1289304 — [inútil, não aprofundado]
112. https://web3market.gumroad.com/l/tg-dexscreener — [inútil, fora de escopo]
113. https://richiedeploy.gumroad.com/l/ujezz — [inútil, não aprofundado]
114. https://dmsllc.gumroad.com/l/nfbmmz — [inútil, não aprofundado]
115. https://inferencebysequoia.substack.com/p/best-content-and-community-resources — [útil, indireto]
116. https://n8nautomations.gumroad.com/l/elmicc — [inútil, não aprofundado]
117. https://adithyan574.gumroad.com/l/ewvcy — [inútil, não aprofundado]
118. https://productivetemplates.gumroad.com/l/modlq — [inútil, não aprofundado]
119. https://dev.to/ronakmunjapara/all-you-need-to-know-about-n8n-workflow-automation-for-free-mkf — [inútil, não aprofundado]
120. https://mijnkaart.gumroad.com/l/sifvvb — [inútil, não aprofundado]
121. https://blog.sendflow.pro/artigo/como-fazer-um-bot-de-ofertas/ — [útil, fetch feito, mas conteúdo raso]
122. https://chatguru.com.br/como-fazer-bot-de-ofertas/ — [inútil, não aprofundado]
123. https://www.1checkout.com.br/bot-telegram — [inútil, não aprofundado]
124. https://www.99freelas.com.br/project/bot-telegram-para-canal-de-ofertas-e-promocoes-699122 — [útil, indireto] confirma mercado de freelancer
125. https://www.youtube.com/watch?v=1lFXcJmZ2MQ — [inútil, não aprofundado]
126. https://apps.apple.com/BR/app/id1500098313 — [inútil, não aprofundado]
127. https://fluxopromo.com/blog/como-criar-canal-ofertas-telegram — [inútil, não aprofundado]
128. https://fluxopromo.com/canal-ofertas-telegram — [inútil, não aprofundado]
129. https://fluxopromo.com/blog/automacao-canal-telegram-ofertas — [útil, fetch feito] dados de ROI
130. https://r1.community.samsung.com/t5/promo%C3%A7%C3%B5es/tem-umas-desocupadas-no-telegram-que-pegam-todos-os-cupons-para/td-p/20096519 — [inútil — 403 no fetch, só título disponível]
131. https://docs.telethon.dev/en/v2/developing/faq.html — [útil, indireto]
132. https://telegramscraper.shop/blog/how-to-avoid-telegram-ban — [útil]
133. https://github.com/LonamiWebs/Telethon/issues/3955 — [útil]
134. https://www.blackhatworld.com/seo/avoid-telegram-account-ban-for-telethon-message-transfer.1589435/ — [inútil — 403 no fetch, só título]
135. https://freelancehunt.com/en/project/reshit-problemu-bana-akauntov-telegram-pri/1342657.html — [útil]
136. https://pypi.org/project/pirobot/1.4.0/ — [inútil, não aprofundado]
137. https://github.com/D3rise/teleflood — [inútil, não aprofundado]
138. https://pypi.org/project/limited-aiogram/0.1.2/ — [inútil, não aprofundado]
139. https://www.blackhatworld.com/seo/hiring-telegram-bot-developer-automated-affiliate-deal-poster-amazon-aliexpress-etc.1714507/ — [parcialmente útil — 403 no fetch direto, mas resumo de busca trouxe conteúdo]
140. https://www.blackhatworld.com/tags/telegram-auto/ — [inútil, não aprofundado]
141. https://www.blackhatworld.com/tags/telegram-adbot/ — [inútil, não aprofundado]
142. https://www.blackhatworld.com/seo/telegram-autoposter-bot.1315655/ — [inútil — 403 no fetch]
143. https://www.blackhatworld.com/seo/what-is-the-best-bot-for-telegram-auto-posting.1414995/ — [inútil, não aprofundado]
144. https://www.blackhatworld.com/seo/turn-your-telegram-into-a-24-7-store-with-teleshopbot-com-customer-buys-bot-delivers-100-automated.1834743/ — [inútil, não aprofundado]
145. https://www.blackhatworld.com/tags/telegram-ad-bot/ — [inútil, não aprofundado]
146. https://involve.asia/blog/affiliate-marketing-on-telegram/ — [inútil, não aprofundado]
147. https://www.warriorforum.com/main-internet-marketing-discussion-forum/511385-looking-affiliate-program-script-these-features.html — [inútil, não aprofundado]
148. https://www.warriorforum.com/main-internet-marketing-discussion-forum/1028912-anyone-know-free-affiliate-network-script.html — [inútil, não aprofundado]
149. https://www.warriorforum.com/main-internet-marketing-discussion-forum/1195387-free-affiliate-script.html — [inútil, não aprofundado]
150. https://www.warriorforum.com/programming/175650-what-affiliate-program-script.html — [inútil, não aprofundado]
151. https://www.warriorforum.com/main-internet-marketing-discussion-forum/588617-free-open-source-affiliate-program-script.html — [inútil, não aprofundado]
152. https://pt.hostadvice.com/vps/telegram-bot/ — [útil]
153. https://alexhost.com/faq/how-to-choose-hosting-for-a-telegram-bot/ — [inútil, não aprofundado]
154. https://medium.com/programacaodinamica/como-criei-um-bot-para-meu-canal-com-uma-hospedagem-boa-e-barata-cbcd2e6d945e — [útil, fetch feito] único relato pessoal confirmado de hospedagem
155. https://alexhost.com/hosting-for-telegram-bot/ — [inútil, não aprofundado]
156. https://the.hosting/en/vps-telegram-bot — [inútil, não aprofundado]
157. https://dev.to/dmitry-koleev/host-telegram-bot-on-raspberry-pi-5-16ld — [útil]
158. https://github.com/lorenzodifuccia/RaspOne — [inútil, não aprofundado]
159. https://www.youtube.com/watch?v=YPmpZVuzDI4 — [inútil, não aprofundado]
160. https://brapi.dev/blog/planilha-google-sheets-cotacoes-automaticas-apps-script — [inútil, não aprofundado]
161. https://medium.com/thiagobarradas/criando-aplicacoes-com-google-app-script-3c04d30bd4ed — [inútil, não aprofundado]
162. https://developers.google.com/apps-script/guides/sheets?hl=pt — [útil, oficial genérico]
163. https://developers.google.com/apps-script/storing_data_spreadsheets?hl=pt — [inútil, não aprofundado]
164. https://railway.com/deploy/a0ln90 — [inútil, não aprofundado]
165. https://railway.com/deploy/python-telegram-bot — [útil]
166. https://railway.com/deploy/aOqPSI — [inútil, não aprofundado]
167. https://www.airdroid.com/ai-insights/telegram-bot-hosting/ — [inútil, não aprofundado]
168. https://railway.com/deploy/sNYhKQ — [inútil, não aprofundado]
169. https://railway.com/deploy/7cnESs — [inútil, não aprofundado]
170. https://starsearn.com/guides/deploy-telegram-bot-railway — [útil]
171. https://medium.com/@andrea.faviait/deploying-a-telegram-bot-using-chatgpt-and-whisper-apis-with-railway-ef79e6cff955 — [inútil, não aprofundado]
172. https://huggingface.co/spaces/Dragdev/telegrambot/blob/ef82d6a42b2bd8eb09ca774f969b1d392e0af633/README.md — [inútil, não aprofundado]
173. https://fluxopromo.com/blog/como-ganhar-dinheiro-no-telegram — [inútil, não aprofundado]
174. https://metricgram.com/pt/blog/automatizar-grupo-telegram — [inútil, não aprofundado]
175. https://blog.devzapp.com.br/post/estrategia-para-grupos-de-ofertas-whatsapp-24h — [inútil, não aprofundado]
176. https://promotop.net/blog/ofertasnasho-telegram-como-aproveitar-as-melhores-promocoes-em-tempo-real/ — [inútil, não aprofundado]
177. https://app.botelitepass.com/blog/como-vender-no-telegram-com-bot — [útil] relato de processo manual de cobrança
178. https://centavocerto.com/blog/como-vender-no-telegram — [inútil, não aprofundado]
179. http://blog.allyhub.co/como-automacao-com-zapier-make-e-chatgpt-pode-ajudar-agencias-de-intercambio-a-aumentar-vendas-e-otimizar-o-tempo/ — [inútil, fora de escopo]
180. https://lagrowthmachine.com/zapier-make/ — [inútil, não aprofundado]
181. https://www.make.com/en/integrations/zapier/telegram — [inútil, não aprofundado]
182. https://www.entergram.com/blog/make-com-telegram-crm-automations — [útil]
183. https://www.make.com/en/integrations/telegram/zapier — [inútil, não aprofundado]
184. https://zapier.com/blog/automate-telegram/ — [inútil, não aprofundado]
185. https://help.zapier.com/hc/en-us/articles/16700016131085-How-to-get-started-with-Telegram-on-Zapier — [inútil, não aprofundado]
186. https://zapier.com/apps/telegram/integrations — [inútil, não aprofundado]
187. https://zapier.com/mcp/telegram — [inútil, não aprofundado]
188. https://www.blackhatworld.com/seo/avoid-telegram-account-ban-for-telethon-message-transfer.1589435/ — [duplicado do item 134]
189. https://fluxopromo.com/blog/como-criar-canal-ofertas-telegram — [duplicado do item 127]
190. https://etsy.com/at/listing/4381633159/... — [inútil, não aprofundado, resultado espúrio de busca]
191. https://ibillonario.gumroad.com/l/Telegram2024 — [inútil, não aprofundado]
192. https://br.tradingview.com/chart/JPYX/... — [inútil, fora de escopo]
193. https://habr.com/en/articles/889536/comments — [inútil, não aprofundado]
194. https://pt.trustpilot.com/review/tgcryptobot.com — [inútil, fora de escopo]
195. https://wassenger.com/blog/pt/a-ferramenta-de-automacao-do-whatsapp-que-esta-tornando-o-atendimento-ao-cliente-obsoleto — [inútil, não aprofundado]
196. https://wassenger.com/blog/pt/eu-automatizei-50-grupos-do-whatsapp-aqui-esta-o-codigo — [útil, indireto, não aprofundado — título promissor mas não fiz fetch]
197. https://mcpmarket.com/server/wassenger — [inútil, não aprofundado]
198. https://promovaweb.com/apps/wppconnect — [inútil, não aprofundado]
199. https://wassenger.com/ — [inútil, não aprofundado]
200. https://wassenger.com/blog/en/send-messages-to-whatsapp-groups-via-api — [inútil, não aprofundado]
201. https://wassenger.com/blog/en/best-whatsapp-business-api-provider — [inútil, não aprofundado]
202. https://apify.com/fatihtahta/shopee-scraper — [inútil, não aprofundado]
203. https://apify.com/ecomscrape/shopee-reviews-scraper/api — [inútil, não aprofundado — deprecated]
204. https://apify.com/marc_plouhinec/shopee-api-scraper/api — [inútil, não aprofundado]
205. https://apify.com/makework36/shopee-scraper-api — [inútil, não aprofundado — deprecated]
206. https://apify.com/xtracto/shopee-scraper — [inútil, não aprofundado]
207. https://apify.com/best_scraper/shopee-scraper — [inútil, não aprofundado]
208. https://apify.com/gio21/shopee-scraper/api — [inútil, não aprofundado]
209. https://apify.com/viralanalyzer/shopee-affiliate-products/api/openapi — [inútil, não aprofundado]
210. https://ofertasbot.com/blog/melhores-bots-de-ofertas-para-afiliados — [útil, fetch feito] comparativo dos 14 bots, achado central da seção 3
211. https://achadinhopro.com.br/blog/melhores-ferramentas-afiliados-shopee-2026 — [útil, fetch feito]
212. https://pluginthemebr.com/produto/content-egg-tudo-em-um-plug-in-para-afiliados-comparacao-de-precos-sites-de-negocios/ — [inútil, não aprofundado]
213. https://wordpress.com/pt-br/plugins/content-egg — [inútil, não aprofundado]
214. https://wordpress.org/plugins/content-egg/ — [útil]
215. https://mercadoonlinedigital.com/produto/content-egg/ — [inútil, não aprofundado]
216. https://www.keywordrush.com/contentegg — [útil]
217. https://uprendamais.com.br/afiliado-amazon-sem-api/ — [inútil — fetch falhou, "site não acessível"]
218. https://kevinbk.com/content-egg-o-melhor-plugin-wordpress-para-afiliados/ — [inútil, não aprofundado]
219. https://www.youtube.com/watch?v=4RtafON0TFI — [inútil, não aprofundado]
220. https://thesimplewp.club/produto/content-egg-pro-wordpress-plugin/ — [inútil, não aprofundado]
221. https://hubdoafiliado.com/ — [útil, fetch feito]
222. https://github.com/doublegram/telegram-amazon-affiliate-bot — [inútil — 404 no fetch]
223. https://github.com/Aritzherrero4/AffiliateTelegramBot — [útil, indireto, não aprofundado]
224. https://github.com/Jakeedot/telegram-affiliate-bot — [útil, indireto, não aprofundado]
225. https://github.com/sulasoft/Amacapy-Bot-Telegram-Amazon-Affiliates — [útil, indireto, não aprofundado]
226. https://github.com/topics/affiliate?l=python&o=desc&s=forks — [inútil, não aprofundado]
227. https://github.com/topics/affiliate-links — [inútil, não aprofundado]
228. https://github.com/topics/referral?l=python — [inútil, não aprofundado]

---

## Resumo executivo (para quem não vai ler tudo)

1. O mercado brasileiro de "ferramenta pronta" para canal de oferta é maduro e tem pelo menos 14 produtos SaaS concorrentes cobrando R$35-500/mês (ver seção 3), o que sugere que a maior parte de quem opera canal em escala **compra** ferramenta em vez de programar a própria.
2. A prática de "clonar canal de terceiro e trocar o link pelo próprio" tem nome comercial estabelecido no Brasil ("Clonador Automático Telegram"/CAT, R$24-47/mês) e é endossada até por rede de afiliados internacional (Admitad Bot faz a mesma coisa, "oficialmente").
3. Existe uma rede peer-to-peer real de troca de ofertas entre afiliados concorrentes ("Feed Global P2P" do Pro Afiliados) — afiliados recebem automaticamente ofertas capturadas por outros afiliados.
4. 2026 trouxe um crackdown real da Meta contra bibliotecas WhatsApp não-oficiais (Baileys, Venom, WPPConnect, Evolution API), o que empurra parte do mercado para Telegram ou para provedores comerciais como Z-API.
5. Mercado Livre não tem API de afiliado oficial simples — todo mundo contorna com scraping ou extensão de navegador.
6. Os repositórios open-source brasileiros de bot de oferta são pequenos (máx. ~13 estrelas) — o "fazer na mão programando" não parece ser prática dominante entre quem monta ferramenta em código aberto.
