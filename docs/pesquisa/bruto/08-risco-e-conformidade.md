# Risco e conformidade — o que derruba a operação

Pesquisa sobre banimento, violação de termo, raspagem, publicidade não identificada, LGPD e as regras que ninguém lê até tomar o bloqueio. Foco: operação de radar de ofertas rodando afiliados (Amazon, Mercado Livre, Shopee), distribuição via WhatsApp/Telegram, e coleta de preços.

Convenção de marcação: **[OFICIAL]** = termo/policy publicado pela empresa/órgão regulador. **[RELATO]** = relato de usuário (Reclame Aqui, GitHub issue, fórum). **[BLOG]** = conteúdo de terceiro (agência, blog de marketing, escritório de advocacia) sem força normativa. **[JURÍDICO]** = decisão judicial, parecer, ou posição de autoridade (ANPD, STJ etc).

---

## 1. Amazon Associados Brasil

### 1.1 Cache de preço — 24 horas, mas só para o que não é imagem

**[OFICIAL]** Portal de Associados (`associados.amazon.com.br/help/operating/policies/`), Políticas do Programa:

> "Você poderá armazenar outro Conteúdo de Anúncio de Produtos que não seja imagens para fins de armazenamento em cache por até 24 horas [...] mas você deverá atualizar e exibir novamente o Conteúdo de Anúncio de Produtos imediatamente através de uma chamada à Creators API."

Ou seja: preço, título, descrição, rating — cache de até 24h é tolerado, mas passado esse prazo a exibição tem que ser atualizada via chamada de API antes de continuar mostrando o conteúdo. Isso significa que um catálogo que raspa/consulta a API uma vez por dia e serve o preço cacheado o dia inteiro está dentro da regra — desde que o refresh realmente aconteça a cada 24h e não vire "cache eterno" que nunca é revalidado.

### 1.2 Imagem: proibição total de cache

**[OFICIAL]** Mesmo documento, trecho literal:

> "Você não irá armazenar nem armazenar em cache o Conteúdo de Anúncio de Produtos que consista em uma imagem."

Isso é mais rígido que o preço. A imagem do produto precisa ser sempre servida a partir da URL fornecida pela Amazon (hotlink), nunca baixada e reservida no seu próprio servidor/CDN. Um catálogo que baixa a imagem do produto e a re-hospeda (comum em scripts de scraping) está violando esse ponto especificamente, independente do prazo.

Fontes de mercado (não-oficiais, mas convergentes) reforçam a leitura: **[BLOG]** "Prices and availability can be cached for up to one hour, titles and descriptions can be cached for up to 24 hours, and product images cannot be stored at all and must link directly to them" (blog.freshstore.com) — o prazo de 1h para preço citado por esse blog é mais conservador que o texto oficial atual (24h), então vale usar o texto oficial (24h) como referência, não o blog.

### 1.3 App cliente não pode cachear

**[OFICIAL]** Trecho literal do Acordo/Políticas:

> "Não obstante o disposto acima, se seu formulário de cadastro incluir um aplicativo de cliente (client application), o aplicativo de cliente não poderá gravar ou salvar (cache) o Conteúdo de Anúncio de Produtos."

Ou seja, a tolerância de 24h de cache vale para sites/páginas web, mas se a superfície de exibição for um app cliente (ex.: bot de Telegram funcionando como "app", extensão de navegador, app mobile fechado), a regra é mais dura: zero cache. Cada exibição deve vir de uma chamada nova à API.

### 1.4 Identificação da participação no programa

**[OFICIAL]**:

> "você incluirá o seguinte aviso legal de isenção de responsabilidade [...] 'O CONTEÚDO EXIBIDO [NESTE APLICATIVO ou NESTE SITE] É ORIGINADO DA AMAZON [...] SOMOS PARTICIPANTES DO PROGRAMA DE ASSOCIADOS DA AMAZON.'"

Disclosure obrigatório, com wording específico. Não é uma sugestão de boa prática — é cláusula contratual com texto sugerido pela própria Amazon.

### 1.5 Link em e-mail / SMS / mensagem direta — só se solicitado

**[OFICIAL]**:

> "Você poderá incluir Links Especiais em e-mails, SMS e mensagens diretas [...] desde que tais comunicações sejam solicitadas."

Isso é crítico para quem distribui ofertas por WhatsApp/Telegram usando link de afiliado Amazon: a comunicação (a mensagem, o grupo, a lista) precisa ser "solicitada" pelo destinatário — i.e., ele entrou por vontade própria no canal/grupo/lista, não foi adicionado ou recebeu sem pedir. Envio de link de afiliado por DM fria, ou adição de contato a um grupo sem consentimento, cai fora da cláusula.

### 1.6 Autocompra proibida

**[OFICIAL]**:

> "você não irá [...] comprar qualquer Produto [...] para seu uso próprio ou para o uso de qualquer outra pessoa" através dos Links Especiais.

E do lado internacional (`affiliate-program.amazon.com`), o texto irmão em inglês, mais explícito:

> "You will not directly or indirectly purchase any Product(s) or take a Bounty Event action through Special Links, whether for your use or for the use of any other person or entity." E: "you may not permit, request or encourage any of your friends, relatives, employees, contractors, or business relations to directly or indirectly purchase any Product(s)" através do link.

**[BLOG]** (geniuslink.com, prosociate.com): a Amazon cruza dados de endereço, pagamento e padrões de conta — "a small cluster of accounts all buying through the same Tracking ID is not subtle" — ou seja, mesmo que a autocompra não seja feita pela própria conta de associado, comprar por familiares/funcionários que compartilham endereço ou cartão é detectável e gera penalização.

### 1.7 Uso da marca em anúncio pago — desqualifica a venda

**[OFICIAL]** (affiliate-program.amazon.com/help/operating/policies):

> Associados não podem "bid on or purchase keywords, search terms, or other identifiers, including the word 'amazon,' Kindle,' or any other trademark of Amazon" em busca paga.

E:

> Compras são desqualificadas "where a customer is referred to an Amazon Site through any advertisement that you purchased" usando marcas Amazon ou variações como "ammazon" ou "kindel" (erros de grafia propositais para escapar do filtro também contam).

### 1.8 Prazo de 3 vendas em 180 dias

**[BLOG]** (múltiplas fontes de mercado convergem, mas não achei o texto oficial literal desse número no Acordo Operacional em si — está provavelmente nas "Participation Requirements", página que não consegui abrir):

> "Após o cadastro, você tem 180 dias para realizar três vendas qualificadas através de seus links de afiliado. Se você não gerar 3 vendas em 180 dias, sua conta é desativada" — mas normalmente é possível se cadastrar novamente.

**[RELATO]** Reclame Aqui, thread "Encerramento da Conta sem passar os 180 dias" (`reclameaqui.com.br/amazon/encerramento-da-conta-sem-passar-os-180-dias_KXq3cMtX4BIjGmoR/`) — a página não carregou o conteúdo completo via fetch (403), mas o próprio título da reclamação confirma que há um caso de usuário que teve a conta encerrada por não bater a meta de vendas mesmo antes do prazo de 180 dias se completar, sugerindo aplicação estrita e por vezes sem aviso prévio claro. Vale revisitar manualmente esse link para o relato completo.

**[OFICIAL]** (blog secundário citando o programa): "a company cannot restore your account or tracking ID after it is rejected" — a reprovação por falta de vendas é definitiva, sem recurso ao mesmo Tracking ID (mas permite novo cadastro).

### 1.9 O que isso significa pra operação (Amazon)

- Preço: cache de 24h é seguro, IMAGEM NUNCA pode ser cacheada/re-hospedada — tem que apontar para a URL da Amazon.
- Se o "produto" for exibido dentro de um bot (Telegram/WhatsApp) classificável como "app cliente", regra de zero-cache pode se aplicar — mais seguro tratar como client application e nunca cachear preço também, só por segurança.
- Disclosure obrigatório com wording específico em qualquer canal/site.
- Nunca comprar pelo próprio link, nem por familiares que dividem cartão/endereço.
- Nunca usar "Amazon"/"amazom"/"kindle" como palavra-chave em anúncio pago.
- Distribuição por WhatsApp/Telegram só em canal onde a pessoa entrou por vontade própria (opt-in), nunca DM fria.
- Bater 3 vendas em 180 dias é obrigatório para não ser desativado — isso é um risco estrutural de negócio, não só jurídico.

---

## 2. Mercado Livre Afiliados

### 2.1 Não existe API oficial para o programa de afiliados

**[RELATO]** Reclame Aqui, múltiplas reclamações — "Falta de API para programa de afiliados do Mercado Livre dificulta o trabalho e impede a automação" e "Programa de afiliados do Mercado Livre não tem uma API" — usuários reclamando formalmente da ausência de uma API dedicada ao programa de afiliados (diferente da API de Developers, que é para integração de vendedor/marketplace, não para afiliados).

Isso é relevante: qualquer automação de geração de link de afiliado do Mercado Livre feita hoje via scraping/simulação de navegador não tem respaldo de "uso de API autorizado" — porque a API de afiliados simplesmente não existe publicamente. A alternativa oficial é o encurtador/gerador manual de link dentro do painel de afiliados.

### 2.2 Termos e Condições da API de Developers (não é a de afiliados, mas rege qualquer uso de dados via API)

**[OFICIAL]** `developers.mercadolivre.com.br/pt_br/termos-e-condicoes`:

> "não poderão comercializar ou sublicenciar a API para uso por terceiros"
> "não poderão modificar, desmontar ou descompilar a API"
> "não poderão utilizar robôs, harvesters, spiders, scraping ou outra tecnologia para acessar o Conteúdo"
> "não poderão obter qualquer informação que não lhes seja fornecida pelo Mercado Livre"

Isto é uma proibição explícita e literal de scraping — mesmo dentro dos termos que regem quem já tem acesso à API. Ou seja: ter conta de developer não dá carta branca para raspar o que não é exposto pela própria API.

### 2.3 Rate limit

**[OFICIAL]**:

> "O Mercado Livre poderá limitar discricionariamente a quantidade de chamadas à API"
> "As chamadas à API não efetuadas não poderão ser utilizadas no dia ou mês seguinte" (ou seja, não há acumulação de "cota" não usada)

Não há um número fixo publicado no texto que consegui extrair (tipicamente esse tipo de limite fica em painel técnico, não no contrato), mas a cláusula deixa claro que o limite é discricionário e pode mudar sem aviso — não dá para depender de um número fixo em produção.

### 2.4 Uso da marca

**[OFICIAL]**:

> "deverão abster-se de incluir no título [...] as palavras: mercado, livre, pagamento, envios"
> "deverão abster-se de utilizar [...] tais denominações ou logotipos" no aplicativo

Nome de canal/bot/domínio "Mercado Livre Ofertas" ou parecido é risco de violação de marca por si só, além de confundir o consumidor sobre oficialidade.

### 2.5 Encerramento de acesso — discricionário

**[OFICIAL]**:

> "O Mercado Livre reserva-se o direito de revogar [...] a licença de uso e acesso à API [...] sem justificativa e a qualquer momento, sem necessidade de notificação."

Sem SLA de aviso prévio. Diferente da Shopee (que promete 7 dias de aviso em alguns casos — ver seção 3).

### 2.6 Obrigação de segurança e notificação de incidente

**[OFICIAL]**:

> "deverão cumprir e implementar práticas suficientes de segurança informática"
> "deverá notificar o Mercado Livre dentro das 24 horas após tomar conhecimento" (de incidente de segurança envolvendo os dados/API)

### 2.7 robots.txt do Mercado Livre

**[OFICIAL]** `mercadolivre.com/robots.txt` e `mercadolivre.com.br/robots.txt`:

Bloqueio explícito (`Disallow: /`) para: **Amazonbot, PerplexityBot, Perplexity-User, ClaudeBot, Claude-User, GPTBot, ChatGPT-User** — ou seja, todos os principais bots de IA/scraping de conteúdo estão nominalmente banidos de indexar qualquer página do site. Permitido: FacebookBot, Twitterbot, LinkedInBot (bots de preview social).

Para o user-agent genérico (`*`), disallow em caminhos de checkout, configuração, e crucialmente `/adn/api*` (bloqueio de rota de API de anúncios via acesso não autorizado por crawler).

**O que isso significa na prática**: mesmo sem citar nominalmente "scraper de preço", o robots.txt do Mercado Livre é hostil por padrão a qualquer coleta automatizada que não seja um dos bots de motor de busca tradicionais explicitamente listados. Um scraper próprio, mesmo respeitando robots.txt, provavelmente cairia sob o `Disallow: /` do user-agent-padrão se usar um header de UA identificável, ou seria tratado como agente não listado (nesse caso as regras específicas para `*` se aplicam).

---

## 3. Shopee Afiliados / Open API

### 3.1 Termos e Condições do Programa de Afiliados

**[OFICIAL]** `help.shopee.com.br` (artigos 76443 e 124094):

Proibições explícitas, sob risco de rescisão sem aviso prévio:

> "usar emails publicitários para promover a Shopee sem o consentimento prévio por escrito"
> "dirigir ou utilizar qualquer palavra-chave [...] e outro tráfego publicitário baseado em palavras-chave usando a marca Shopee" (SEM/Google Ads/Bing Ads com termo "Shopee")
> "fazer anúncios pagos em search ou shopping, como Google Ads e Bing Ads"
> "aplicar Links de Afiliado em Mídias Afiliadas que contenham Conteúdo Proibido, ou em sites de torrent ou streaming"
> "publicar conteúdo aleatório e/ou irrelevante que não promova os itens/lojas"
> "divulgar informações falsas, enganosas ou não verificadas (fake news)"

### 3.2 Conteúdo proibido nas mídias do afiliado

**[OFICIAL]**: atividades ilegais (drogas, phishing, terrorismo), "tabaco, jogos de azar ou armas", pornografia, violência explícita, discurso de ódio, conteúdo difamatório.

### 3.3 Cupons — a regra que mais gente viola sem perceber

**[OFICIAL]**:

> "Os cupons nominais fornecidos aos Afiliados são exclusivos para compartilhamento do Afiliado com seus seguidores ou utilização pelo Afiliado."
> "A divulgação ou compartilhamento de cupons nominais de afiliados terceiros pelo Afiliado será considerada violação."

Isso é relevante para um agregador que reposta cupons "achados" de outros afiliados (prática comum em canais de oferta) — tecnicamente proibido pelo contrato Shopee: cupom nominal é individual, não é "domínio público" mesmo depois de divulgado.

### 3.4 Identificação de publicidade / marca

**[OFICIAL]**: a mídia social aprovada deve conter "as marcas, nomes ou logotipos da Shopee" apenas nos moldes autorizados, "nem exibir conteúdo enganoso". Não há exigência explícita textual do tipo "#publi" nos termos da Shopee em si — a exigência de identificação de publicidade vem de fora (CONAR/CDC, ver seção 7), não do contrato Shopee.

### 3.5 Suspensão / rescisão

**[OFICIAL]**:

> A Shopee pode "rescindir unilateralmente este Contrato a seu exclusivo critério e por qualquer razão", com sete dias de aviso prévio em regra, ou "imediatamente e sem qualquer aviso prévio" em caso de violação (as listadas acima, fraude, ou atraso de pagamento).

Também pode reter comissões: "reter, preventiva ou definitivamente, os valores de comissão devidos aos Afiliados em caso de suspeita de fraudes" — ou seja, o risco não é só perder o acesso, é perder comissão já "ganha" mas ainda não paga.

### 3.6 Open API da Shopee — não pesquisado a fundo

Não encontrei o texto literal da política de Open API/rate limit da Shopee especificamente para o mercado brasileiro nesta rodada (as buscas retornaram majoritariamente o programa de afiliados, não a Open API de e-commerce). Recomendo pesquisa dedicada a `open.shopee.com` / Shopee Open Platform se a operação depender de integração via API oficial de vendedor, que é regime jurídico distinto do afiliado.

---

## 4. WhatsApp — automação e ban

### 4.1 Política oficial

**[OFICIAL/BLOG]** (Zenvia, citando diretriz Meta): "A única forma legal e segura de operar atendimento e marketing em escala no WhatsApp é via WhatsApp Business Platform (API oficial), contratada por meio de parceiros homologados pela Meta [BSP]."

Cinco gatilhos de banimento automático citados de forma convergente em várias fontes de mercado **[BLOG]**:
1. Envio em massa sem opt-in registrado.
2. Uso de app não oficial (WhatsApp GB, Plus, Web Plus).
3. Automação via plataforma/script não homologado pela Meta (é aqui que entram Baileys/whatsapp-web.js/venom).
4. Alto índice de denúncias/reports de spam pelos destinatários.
5. Venda de produto/serviço de categoria proibida pela Política de Comércio (ex.: armas, drogas, jogo de azar não regulado, serviços financeiros não licenciados).

> "Em todos os casos, o banimento é automático e sem aviso prévio — disparado por sistemas que monitoram comportamento da conta, reação dos destinatários e identidade da ferramenta usada."

Sinais de risco citados: volume súbito de envio em número novo; taxa de bloqueio acima de 2%; mensagens reportadas como spam; padrão de automação não autorizada; links encurtados (bit.ly) ou domínio suspeito; envio para lista fria sem opt-in.

### 4.2 Preço da API oficial no Brasil (2026)

**[BLOG]**, convergente entre várias fontes de mercado: a partir de janeiro de 2026 a Meta mudou o modelo de cobrança por conversa (24h) para cobrança por mensagem/template individual, por categoria:

- Marketing: R$ 0,40–0,55 por mensagem
- Utilidade: R$ 0,06–0,09
- Autenticação: R$ 0,03–0,05
- Serviço (iniciado pelo cliente, respondido em até 24h): gratuito, com 1.000 conversas de serviço grátis por mês.

Soma-se a mensalidade do BSP (Business Solution Provider, obrigatório para acessar a API — não dá para contratar direto da Meta): R$ 97–997/mês dependendo do provedor, câmbio USD→BRL impacta o valor final.

### 4.3 Bibliotecas não oficiais (Baileys, whatsapp-web.js, venom)

**[BLOG]** (SocialHub): essas bibliotecas funcionam via engenharia reversa do protocolo do WhatsApp Web ou simulação de navegador headless, sem autorização da Meta. "O WhatsApp monitora ativamente comportamento não humano no WhatsApp Web, e qualquer atividade em massa ou automatizada detectada pode levar a banimento instantâneo do número."

**[RELATO]** GitHub, `WhiskeySockets/Baileys` issue #1869 ("High number of bans on WhatsApp!", 5 out 2025): usuário relata banimento de "5 bots, cada um com aproximadamente 9 grupos" em uma semana. Menciona que dois bots que usavam Baileys há mais de 3 anos sem nunca terem sido banidos foram banidos recentemente — sugerindo mudança de comportamento de detecção do lado da Meta, não só má prática do operador. Outro ponto relatado: WhatsApp aparentemente vem banindo mesmo contas que não rodam bot nenhum (falso positivo ou campanha de enforcement mais agressiva). Issue está marcada "Stale", sem resposta oficial de mantenedor.

**Leitura de risco**: mesmo quem usa Baileys "com cuidado" (rate limiting manual, comportamento humano simulado) não está imune — o padrão de detecção da Meta evolui e casos de conta "limpa" há anos sendo banida de repente existem e são recentes (2025). Não há caminho seguro de longo prazo com biblioteca não oficial para operação que dependa de continuidade.

---

## 5. Telegram

### 5.1 O que derruba canal/conta

**[OFICIAL]** `telegram.org/faq_spam/br`:

> "Quando os usuários usam o botão 'Denunciar spam' em um chat, eles enviam essas mensagens ao nosso time de moderadores" para análise manual.
> Motivos comuns de denúncia: "anúncios irrelevantes, links, links de convite a grupos ou canais, fotos aleatórias" e conteúdo comercial não solicitado.
> "A primeira infração resulta em limitação de poucos dias [...] limitações repetidas irão resultar em um período maior de bloqueio", podendo chegar a perda permanente da capacidade de enviar mensagem não solicitada.
> Contestação via bot oficial `@SpamBot`, revisão manual por humano.

Nota importante: a moderação de spam do Telegram é fortemente baseada em denúncia de usuário + revisão humana, diferente do WhatsApp (que é majoritariamente automático/heurístico). Isso significa que um canal de ofertas com audiência engajada e opt-in tem risco estrutural menor no Telegram do que fazendo o mesmo volume de disparo no WhatsApp — mas conta de usuário (não canal) usada para scraping/automação de forma agressiva (Telethon/Pyrogram simulando cliente) corre risco de ser tratada como comportamento anômalo e limitada, mesmo sem denúncia de terceiro — esse ponto não pôde ser confirmado com relato específico de scraping nesta rodada porque a busca por "Telethon Pyrogram banida" não retornou resultado antes do orçamento de busca se esgotar; recomendo pesquisa complementar dedicada a esse tópico.

### 5.2 Canal vs conta de usuário

Importante distinguir: um **canal** (broadcast, sem interação bidirecional) tem risco de ser denunciado por quem entrou nele, mas é opt-in por natureza (a pessoa entra para receber a oferta). O risco de ban por spam é mais associado a **conta de usuário** usada para adicionar pessoas a grupos, enviar DM fria em massa, ou automatizar interação (join/leave em massa de grupos, scraping de membros de canal via Telethon/Pyrogram) — esse último padrão é tipicamente o que dispara limitação de conta de usuário no Telegram, por analogia com o mesmo tipo de heurística anti-automação usada em outras plataformas, mas sem confirmação literal específica coletada nesta pesquisa.

---

## 6. Raspagem (scraping)

### 6.1 robots.txt — o que cada site diz

**[OFICIAL]** Mercado Livre (`mercadolivre.com/robots.txt`): bloqueio total (`Disallow: /`) para bots de IA nomeados (Amazonbot, PerplexityBot, ClaudeBot, GPTBot, etc). Para o agente genérico `*`: disallow em rotas de compra, checkout, config, e `/adn/api*`.

**[OFICIAL]** Amazon Brasil (`amazon.com.br/robots.txt`): lista extensa de bots bloqueados incluindo scrapers de dados nomeados diretamente — **Scrapy, img2dataset, Crawl4AI** — além dos bots de IA generativa (GPTBot, Claude-SearchBot, PerplexityBot, TavilyBot, DuckAssistBot, Diffbot, Semrush). Não há bot de "monitoramento de preço" citado nominalmente, mas a lista deixa claro que ferramentas de scraping genéricas conhecidas por nome (Scrapy é o framework Python mais usado para esse fim) estão explicitamente banidas.

**[OFICIAL]** Shopee (`shopee.com.br/robots.txt`): sem menção nominal a scrapers, mas bloqueio de rotas de conta/checkout, de parâmetros de rastreamento de afiliado (`utm_medium=affiliates`, `srsltid`) e de rotas de "produtos similares" — que são justamente os endpoints que comparadores de preço tentariam ler. `Crawl-delay` diferenciado: 0.1s para Googlebot, 1s para os demais — sugerindo tolerância a crawling lento, não a raspagem em volume.

### 6.2 O que o robots.txt juridicamente vale

robots.txt não é lei — é um protocolo de cortesia sem força vinculante por si só no Brasil. Seu desrespeito não gera automaticamente ilícito civil ou penal, mas é evidência forte de **má-fé** e de burla a barreira técnica em eventual disputa (ex.: ação por quebra de termos de uso, concorrência desleal, ou acesso indevido a sistema informatizado). O risco jurídico real de scraping no Brasil não vem do robots.txt, vem de três frentes: (a) violação de termos de uso contratuais (a maioria dos sites os proíbe explicitamente, como visto na seção 2.2 do Mercado Livre), (b) LGPD quando há dado pessoal envolvido, (c) em casos extremos, art. 154-A do Código Penal (invasão de dispositivo informático) se houver quebra de mecanismo de segurança — improvável em scraping de página pública, mas citável em teses de acusação mais agressivas.

### 6.3 Jurisprudência e posição regulatória brasileira

**[JURÍDICO]** ANPD, Radar Tecnológico nº 3 (nov/2024) — **[BLOG citando fonte oficial, não consegui acessar o documento primário diretamente]**: a Autoridade Nacional de Proteção de Dados trata web scraping como "forma de tratamento de dados" sujeita à LGPD mesmo quando o dado é publicamente acessível. Ou seja, "está na internet, é público" NÃO é justificativa legal automática — ainda é preciso base legal (art. 7º da LGPD) para tratar dado pessoal coletado por scraping.

**[JURÍDICO]** citado por assisemendes.com.br: TJDFT (2022) — "eventual dispensa da exigência do consentimento não desobriga os agentes de garantir transparência acerca de todo o processo" de coleta e tratamento de dados. STJ (2019) — consumidores têm direito de saber que informações sobre si foram arquivadas/comercializadas, mesmo coletadas de fonte pública, quando usadas para finalidade não esperada pelo titular.

**Risco real vs teórico, para o caso concreto de raspar preço de produto (não dado pessoal) em marketplace**: o risco jurídico direto é baixo (preço de produto não é dado pessoal, não há LGPD envolvida ali), mas o risco **contratual/comercial** é real e imediato — bloqueio de IP, rescisão de conta de afiliado, ou notificação extrajudicial por descumprimento de termo de uso. O risco jurídico sobe se o scraping capturar dado de vendedor pessoa física (nome, contato) ou de comprador/avaliador (nome em review) — aí LGPD entra em cena de verdade.

---

## 7. Publicidade identificada — CONAR, CDC, guia de influenciadores

### 7.1 Regra literal do CONAR (Guia de Publicidade por Influenciadores Digitais, atualizado 2026)

**[OFICIAL/JURÍDICO — autorregulamentação, não é lei, mas referência usada pelo próprio Judiciário e Procon]**:

Expressões recomendadas para identificação: **#publicidade, #anúncio, #patrocinado, #conteúdoPago, #parceriaPaga**. Para publieditorial/recebido em permuta: **#recebido (descrição) a convite da marca XYZ**.

Expressões a **evitar** por serem consideradas insuficientes ou ambíguas: **#ad, #adv, #advertisement, #ambassador, #parceiro, #marcaXYZ, #colaboração, #colab**.

Três requisitos cumulativos para caracterizar publicidade (e, portanto, acionar o dever de identificação): (1) promoção de produto/serviço/causa; (2) relação comercial ou compensação (inclusive permuta, produto grátis); (3) controle editorial/ingerência do anunciante sobre o conteúdo.

Posicionamento exigido: identificação "de forma clara e diretamente na primeira tela", sem necessidade de clique adicional (não vale colocar "#publi" na 15ª linha da legenda depois do "leia mais"), compatível com qualquer dispositivo.

Recomendação de prioridade: usar primeiro os **recursos nativos das plataformas** (selo "Parceria paga" do Instagram, rótulo de conteúdo patrocinado do YouTube) antes da hashtag — a hashtag isolada "vai perdendo protagonismo" como suficiente.

**[OFICIAL]** Nova camada de 2025: **Lei 15.211/2025 (ECA Digital)** — quando o público inclui criança/adolescente, identificação publicitária deve ser "clara e imediata", vedado uso de técnica que explore credulidade infantil, e proibida publicidade de produto/serviço restrito a esse público.

### 7.2 Responsabilidade compartilhada

**[JURÍDICO/OFICIAL]**: "Anunciantes precisam informar, orientar e monitorar os influenciadores com quem trabalham. Se a marca não orientou o criador sobre as regras de transparência, ela é corresponsável pelo descumprimento." — relevante para uma operação de afiliados: mesmo sem "marca" formal por trás, o próprio programa de afiliados (Amazon/ML/Shopee) pode ser lido como o "anunciante" em tese, mas na prática quem responde por publicidade não identificada perante CONAR/Procon é quem publica o conteúdo (o canal/site), não o marketplace.

### 7.3 Casos concretos de punição

Não localizei nesta rodada um caso concreto nomeado (empresa/influenciador específico, data, decisão do CONAR) de punição por falta de identificação de publicidade — a pesquisa retornou majoritariamente guias e explicativos, sem jurisprudência/processo específico. Recomendo busca dedicada a "Representação CONAR influenciador não identificado publicidade decisão" para fechar esse ponto, se necessário para o relatório final da operação.

---

## 8. LGPD aplicada a grupo/canal de promoção

### 8.1 Base legal para coletar telefone de membro

**[JURÍDICO/BLOG convergente]**: número de telefone é dado pessoal. Bases legais aplicáveis normalmente citadas: **consentimento** (art. 7º, I) ou **legítimo interesse** (art. 7º, IX). Para lista de transmissão/grupo promocional, a prática recomendada é a pessoa entrar por iniciativa própria (ex.: via QR code/link de convite) — nesse desenho, o titular controla a entrada e a base legal defensável é o legítimo interesse combinado com transparência (a pessoa sabe que está entrando em um canal de ofertas). **Uso do número para fins de marketing/publicidade tipicamente exige consentimento específico** — legítimo interesse é mais frágil como base para finalidade publicitária, é mais seguro para finalidade de atendimento/prestação de serviço já contratado.

Requisitos de consentimento válido, quando exigido: livre, informado, inequívoco; finalidade específica informada; local de armazenamento; possibilidade de compartilhamento informada; direitos do titular e canal de contato disponibilizados.

### 8.2 Exposição recíproca em grupo (WhatsApp/Telegram)

**[BLOG jurídico]**: "mesmo com intenção institucional, há exposição recíproca de informação pessoal entre todos os membros do grupo, com no mínimo nome e telefone se tornando visíveis" a todos os outros participantes. Ao adicionar um usuário a um grupo, a organização passa de comunicação unilateral para promover compartilhamento horizontal de dado pessoal entre participantes — isso é tratamento de dado de terceiros (os outros membros veem o número de quem entrou) e deve ser considerado no desenho do canal. **Prática mais segura: usar canal (broadcast, um-para-muitos, sem visibilidade de número entre membros) em vez de grupo, quando o objetivo é só distribuir oferta.** Telegram e WhatsApp Channels/Canais atendem esse modelo sem expor a lista de membros.

### 8.3 Hash de IP / cookie

Não obtive fonte específica nesta rodada tratando hash de IP em ferramenta de radar de ofertas — mas por princípio geral de LGPD: IP (mesmo com hash simples reversível ou correlacionável) tende a ser tratado como dado pessoal ou pseudonimizado (art. 5º, XI) — pseudonimização reduz risco mas não retira a informação do escopo da LGPD. Cookie de analytics/tracking também é dado pessoal quando permite identificação, ainda que indireta, de um indivíduo. Base legal usual: legítimo interesse para analytics básico de audiência, consentimento (via banner) para tracking de terceiros/publicidade direcionada.

### 8.4 O que pode e o que não pode, resumo prático

- **Pode**: operar canal (não grupo) onde a pessoa entra voluntariamente para receber oferta, sem exigir dado além do necessário, com aviso claro da finalidade.
- **Pode, com cautela**: coletar número de quem entra em lista de transmissão via opt-in explícito (ex.: comando `/entrar` em bot), com aviso de finalidade e como sair.
- **Não pode, sem base legal**: adicionar contato a grupo/lista sem que a pessoa tenha pedido (isso também viola termo de uso da Shopee/Amazon, que proíbem "adicionar contatos em grupos sem consentimento prévio" e "spam" — ver seção 3 e a nota da Shopee sobre spam citada na primeira rodada de busca).
- **Não pode**: usar número coletado para finalidade diferente da anunciada (ex.: coletar para "avisar sobre oferta X" e depois vender a lista ou usar para outra campanha sem novo aviso).

---

## 9. Preço falso / propaganda enganosa

### 9.1 CDC art. 37 — o texto da proibição

**[JURÍDICO]**: "É proibida toda publicidade enganosa ou abusiva" — publicidade enganosa é a que "carrega informação mentirosa ou que induz em erro o consumidor acerca da natureza, característica, qualidade, quantidade, propriedade, origem, preço e demais dados sobre o produto ou serviço." Modalidades: **comissiva** (o fornecedor mente, total ou parcialmente) e **omissiva** (deixa de informar dado essencial).

Para uma operação de radar de ofertas, isso é crítico: exibir "de R$ X por R$ Y" quando o preço "de" nunca foi praticado de forma consistente (ex.: preço inflado artificialmente pouco antes da "promoção", prática conhecida como "preço fantasma") é publicidade enganosa comissiva por definição do CDC — mesmo que quem publique a oferta não seja o vendedor, mas um agregador/afiliado repassando a comparação.

### 9.2 Sanções

**[JUR�ídico]**: administrativas — advertência, multa, suspensão temporária de atividade, cassação de licença — aplicadas pelo Procon/órgãos de defesa do consumidor. Consumidor pode denunciar via Procon local ou plataforma Consumidor.gov.br.

### 9.3 Regra dos 30 dias como na UE — existe equivalente no Brasil?

Não encontrei, nesta rodada, uma regra brasileira formal equivalente à **Diretiva Omnibus da UE** (que exige que o "preço anterior" mostrado em um desconto seja o menor preço praticado nos 30 dias anteriores ao início da promoção). A busca dedicada a esse ponto não pôde ser concluída porque o orçamento de WebSearch da sessão se esgotou antes. **Isso é uma lacuna da pesquisa** — recomendo verificação dedicada, mas minha leitura de conhecimento geral (não verificada nesta sessão) é que o Brasil **não tem** uma regra numérica equivalente de "menor preço dos últimos 30 dias" na legislação federal; a exigência de veracidade do "preço de referência" no Brasil é tratada de forma mais genérica pelo art. 37 do CDC (proibição de enganosidade) e por normativas de defesa do consumidor em datas específicas (ex.: fiscalização reforçada do Procon-SP em Black Friday), sem um número de dias codificado em lei federal. Não afirmar isso como fato definitivo sem confirmação adicional.

### 9.4 Casos reais de multa por "de/por" inflado

Não obtive, nesta rodada, um caso nomeado e datado de multa brasileira específica por "preço fantasma" em Black Friday (author, valor, data) — as buscas retornaram material genérico sobre o instituto jurídico, não decisões/autos de infração específicos. **Lacuna de pesquisa**: recomendo busca dedicada a "Procon-SP multa Black Friday preço fantasma [ano]" — historicamente há fiscalizações anuais amplamente noticiadas do Procon-SP contra varejistas por esse motivo em campanhas de Black Friday, mas não confirmei um caso específico com fonte nesta sessão.

---

## 10. Casos concretos de canal/conta encerrada no Brasil

### 10.1 Amazon — encerramento de conta de associado

**[RELATO]** Reclame Aqui, "Encerramento da Conta sem passar os 180 dias" (`reclameaqui.com.br/amazon/encerramento-da-conta-sem-passar-os-180-dias_KXq3cMtX4BIjGmoR/`) — confirma existência do caso pelo título, mas não consegui extrair o relato completo (bloqueio 403 na segunda tentativa de fetch). Padrão sugerido pelo título: usuário reclama de encerramento de conta de associado antes mesmo do prazo regulamentar de 180 dias se completar — sugerindo aplicação que pode ser percebida como precipitada ou sem due process claro do lado do usuário.

### 10.2 Mercado Livre — ausência de API de afiliados como fonte de atrito recorrente

**[RELATO]** Duas reclamações formais distintas no Reclame Aqui sobre a falta de API para o programa de afiliados do Mercado Livre — não é um "banimento", mas evidencia que a própria infraestrutura oficial empurra quem quer automatizar para soluções não sancionadas (scraping, simulação de navegador), o que por sua vez aumenta o risco de violação contratual descrita na seção 2.2.

### 10.3 WhatsApp — banimento em massa de bots (Baileys)

**[RELATO]** GitHub issue #1869 do repositório Baileys (detalhado na seção 4.3): usuário `SinhoGamer`, 5 de outubro de 2025, relatando perda de 5 bots / ~45 grupos numa semana, incluindo contas com mais de 3 anos de uso sem histórico prévio de banimento. Esse é o relato mais concreto e datado encontrado nesta pesquisa de um padrão de enforcement real e recente (2025) contra automação não oficial no WhatsApp.

### 10.4 Lacunas desta seção

Não encontrei, nesta rodada, casos nomeados de: canal de Telegram brasileiro de ofertas especificamente derrubado por violação de termo (a busca dedicada não pôde ser concluída — orçamento de WebSearch esgotado); processo judicial brasileiro específico contra operador de canal de ofertas por scraping ou publicidade não identificada. Recomendo pesquisa complementar dedicada a esses dois pontos antes de fechar o dossiê de risco definitivo.

---

## Tabela — Risco × probabilidade × o que fazer

| # | Risco | Probabilidade (operação típica de radar de ofertas) | Gravidade se acontecer | O que fazer |
|---|-------|---|---|---|
| 1 | Cache de imagem de produto Amazon (re-hospedar imagem) | Alta, se o script baixa/re-hospeda imagem | Média (advertência → suspensão de conta de associado) | Nunca baixar imagem; sempre hotlink na URL fornecida pela API/feed da Amazon |
| 2 | Cache de preço além de 24h sem revalidar via API | Média | Média (violação de Operating Agreement, encerramento de acesso à API) | Job de refresh garantido a cada ≤24h; monitorar staleness dos dados |
| 3 | Bot/app tratado como "client application" cacheando conteúdo Amazon | Média-alta se o bot Telegram/WhatsApp for a superfície principal | Média | Tratar toda superfície fora do site como zero-cache; consultar API a cada exibição |
| 4 | Autocompra (própria ou por familiar com mesmo endereço/cartão) via link de afiliado | Baixa se disciplina interna existir | Alta (encerramento definitivo de conta) | Proibição operacional expressa; nunca testar comprando pelo próprio link |
| 5 | Não bater 3 vendas Amazon em 180 dias | Alta em fase inicial de operação nova | Alta (desativação da conta, precisa recadastrar) | Acompanhar métrica de conversão desde o dia 1; ter plano de tráfego mínimo |
| 6 | Uso de "Amazon"/"Mercado Livre"/"Shopee" como keyword em anúncio pago ou no nome do canal/domínio | Média (tentação de SEO/ASO) | Alta (desqualificação de comissão + risco de marca) | Nunca usar nome da marca em Ads pagos nem no nome do canal/domínio |
| 7 | Scraping de Mercado Livre/Amazon violando termo de uso explícito (cláusula anti-scraping) | Alta, se a coleta de preço depende de scraping em vez de API/feed oficial | Média (bloqueio de IP, encerramento de acesso, notificação extrajudicial) | Priorizar API/feed oficial; se scraping for inevitável, ritmo baixo, UA identificável, sem contornar bloqueio técnico, não redistribuir dado além do necessário |
| 8 | Distribuir link/cupom de outro afiliado Shopee (não nominal ao próprio afiliado) | Média (prática comum em canais agregadores) | Média (violação contratual, perda de comissão retida) | Só usar cupom próprio; não republicar cupom "achado" de terceiro |
| 9 | Envio de link de afiliado por WhatsApp fora de canal opt-in (grupo não solicitado, DM fria) | Alta se a distribuição usar lista comprada/importada | Alta (banimento de número, viola também termo Amazon/Shopee) | Só distribuir em canal que a pessoa entrou voluntariamente; nunca importar contato externo |
| 10 | Uso de Baileys/whatsapp-web.js/venom para automação de envio | Alta se WhatsApp for canal de distribuição em escala | Alta (banimento imprevisível mesmo com boas práticas, sem SLA de recurso) | Migrar para WhatsApp Business Platform oficial via BSP assim que houver volume que justifique o custo; tratar automação não oficial como solução transitória de curtíssimo prazo |
| 11 | Canal Telegram com denúncia de spam por conteúdo comercial repetitivo | Baixa-média (moderação por denúncia + revisão humana, mais tolerante que WhatsApp) | Baixa-média (limitação temporária, recuperável via @SpamBot) | Manter cadência razoável, evitar mensagem idêntica repetida, evitar link para grupo não solicitado |
| 12 | Conta de usuário (não bot oficial) usada com Telethon/Pyrogram para automação/scraping de canal | Média (não confirmado com relato concreto nesta pesquisa) | Desconhecida — provável limitação de conta | Preferir Bot API oficial do Telegram a conta de usuário automatizada quando possível |
| 13 | Publicidade não identificada (sem #publicidade/selo nativo) em post de oferta com link de afiliado | Alta se a operação não tiver processo de disclosure padronizado | Média (CONAR não tem poder de multa direta, mas pode gerar recomendação de sustação; Procon/CDC pode agir como publicidade enganosa por omissão) | Identificação padronizada e visível na primeira tela de cada post/mensagem: "#publicidade" ou equivalente, sempre |
| 14 | "De/por" com preço "de" inflado artificialmente (preço fantasma) | Média, se o preço "de" vier de fonte não confiável ou de captura pontual | Alta (enquadramento em publicidade enganosa, CDC art. 37, exposição a multa de Procon) | Preço "de" deve refletir preço efetivamente praticado recentemente pela loja, nunca inventado ou de captura isolada não representativa; documentar a fonte do dado |
| 15 | Coleta de número de telefone/contato de membro de grupo sem base legal clara | Média (comum negligenciar isso em operação early-stage) | Média (LGPD, ANPD pode notificar/sancionar; dano reputacional) | Preferir canal (não grupo) para não expor lista de membros; se coletar número via opt-in, informar finalidade e permitir saída fácil |
| 16 | Scraping de dado pessoal (nome de vendedor, review com nome) junto com preço | Baixa-média, se o scraper captura mais do que preço/título/imagem | Média-alta (aqui sim entra LGPD com força, diferente de raspar só preço) | Escopo de coleta restrito estritamente a dado de produto (preço, título, imagem, categoria); nunca capturar/reter nome de pessoa física |

---

## Fontes consultadas

1. [OFICIAL] Portal de Associados da Amazon.com.br — Políticas do Programa. `https://associados.amazon.com.br/help/operating/policies/`
2. [OFICIAL] Portal de Associados da Amazon.com.br — Acordo Operacional do Programa de Associados. `https://associados.amazon.com.br/help/operating/agreement`
3. [OFICIAL] Amazon Associates Central (EUA/internacional) — Participation Requirements. `https://affiliate-program.amazon.com/help/operating/participation/`
4. [OFICIAL] Amazon Associates Central — Associates Program Operating Agreement. `https://affiliate-program.amazon.com/help/operating/agreement`
5. [OFICIAL] Amazon Associates Central — Policies (prohibited keywords, self-purchase). `https://affiliate-program.amazon.com/help/operating/policies`
6. [BLOG] Amazon Associates Operating Agreement: The Definitive Guide. `https://blog.freshstore.com/amazon-associates-operating-agreement-guide/`
7. [BLOG] Amazon Associates Requirements: Compliance Made Practical (Geniuslink). `https://geniuslink.com/blog/amazon-associates-requirements/`
8. [BLOG] 9 Reasons Affiliates Get Banned from Amazon (Geniuslink). `https://geniuslink.com/blog/amazon-associates-guide-to-getting-account-banned/`
9. [BLOG] Amazon Affiliate Rules — Things That Will Get You Banned. `https://prosociate.com/amazon-affiliate-rules/`
10. [RELATO] Reclame Aqui — Encerramento da Conta sem passar os 180 dias (Amazon). `https://www.reclameaqui.com.br/amazon/encerramento-da-conta-sem-passar-os-180-dias_KXq3cMtX4BIjGmoR/`
11. [RELATO] Reclame Aqui — Falta de API para programa de afiliados do Mercado Livre. `https://www.reclameaqui.com.br/mercado-livre/falta-de-api-para-programa-de-afiliados-do-mercado-livre-dificulta-o-trabal_HnI5QLd1so-ZPBAV/`
12. [RELATO] Reclame Aqui — Programa de afiliados do Mercado Livre não tem uma API. `https://www.reclameaqui.com.br/mercado-livre/programa-de-afiliados-do-mercado-livre-nao-tem-uma-api_-lfESpIamuDGm2ro/`
13. [OFICIAL] Mercado Livre Developers — Termos e Condições. `https://developers.mercadolivre.com.br/pt_br/termos-e-condicoes`
14. [OFICIAL] robots.txt Mercado Livre. `https://mercadolivre.com/robots.txt` e `https://www.mercadolivre.com.br/robots.txt`
15. [OFICIAL] robots.txt Amazon Brasil. `https://www.amazon.com.br/robots.txt`
16. [OFICIAL] robots.txt Shopee Brasil. `https://shopee.com.br/robots.txt`
17. [OFICIAL] Shopee — Programa de Afiliados, Termos e Condições. `https://help.shopee.com.br/portal/4/article/76443-Programa-de-Afiliados-da-Shopee---Termos-e-Condi%C3%A7%C3%B5es` e `https://help.shopee.com.br/portal/10/article/124094`
18. [BLOG] Regras do afiliado Shopee: bloqueio e perda de comissão. `https://afiliadoshopee.mayasantinny.com.br/blog/regras-afiliado-shopee/`
19. [BLOG] Zenvia — Banimento do WhatsApp Business: causas, como recuperar e como evitar. `https://zenvia.com/blog/numero-banido-do-whatsapp/`
20. [BLOG] SocialHub — Como Evitar Banimento WhatsApp Business 2026. `https://www.socialhub.pro/blog/evitar-banimento-whatsapp/`
21. [BLOG] SocialHub — Baileys, Wwebjs, Venom: Riscos das APIs de WhatsApp Não Oficiais. `https://www.socialhub.pro/blog/baileys-wwebjs-venom-riscos-apis-whatsapp-nao-oficiais/`
22. [BLOG] SocialHub — Preço WhatsApp Business API Brasil 2026: Tabela Real. `https://www.socialhub.pro/blog/preco-whatsapp-api-2026-brasil/`
23. [RELATO] GitHub — WhiskeySockets/Baileys, issue #1869 "High number of bans on WhatsApp!". `https://github.com/WhiskeySockets/Baileys/issues/1869`
24. [OFICIAL] Telegram — Perguntas Frequentes sobre Spam. `https://telegram.org/faq_spam/br`
25. [BLOG] MacMagazine — O que fazer para não ter a sua conta banida no Telegram. `https://macmagazine.com.br/post/2023/02/01/o-que-fazer-para-nao-ter-a-sua-conta-banida-no-telegram/`
26. [BLOG] Tecnoblog — Fui banido no Telegram, e agora?. `https://tecnoblog.net/responde/fui-banido-no-telegram-e-agora-saiba-o-que-fazer-em-caso-de-restricao/`
27. [BLOG/JURÍDICO] Assis e Mendes Advogados — Web Scraping e LGPD: Entenda os Riscos Jurídicos. `https://assisemendes.com.br/web-scraping-e-lgpd-entenda-os-riscos-juridicos-e-como-evitar-sancoes/`
28. [JURÍDICO] Referência à posição da ANPD — Radar Tecnológico nº 3 (nov/2024) sobre web scraping (citada via fonte 27, documento primário não acessado diretamente).
29. [JURÍDICO] Migalhas — Tudo sobre as regras de publicidade para influenciadores. `https://www.migalhas.com.br/depeso/423553/tudo-sobre-as-regras-de-publicidade-para-influenciadores`
30. [OFICIAL] Meio & Mensagem — Conar: conheça o código de ética publicitária para influenciadores. `https://www.meioemensagem.com.br/comunicacao/o-codigo-de-etica-publicitaria-do-conar-para-influenciadores`
31. [OFICIAL] Salusse, Marangoni, Parente, Jabur Advogados — CONAR emite novo Guia para Influenciadores Digitais. `https://smabr.com/conar-emite-novo-guia-para-influenciadores-digitais/`
32. [JURÍDICO] ConJur — Publicidade enganosa na omissão de preços. `https://www.conjur.com.br/2022-mar-03/controversias-juridicas-publicidade-enganosa-omissao-precos/` (acesso bloqueado nesta sessão, referência indireta via resumo de busca)
33. [BLOG] IDEC — Entenda o que é uma propaganda enganosa e saiba quais são os seus direitos. `https://idec.org.br/dicas-e-direitos/propaganda-enganosa`
34. [BLOG jurídico] Umbler — Atendimento Via WhatsApp é Compatível Com a LGPD?. `https://blog.umbler.com/br/atendimento-via-whatsapp-e-lgpd/`
35. [BLOG jurídico] Dupont Spiller Fadanelli Advogados — Dicas para vender pelo WhatsApp respeitando a LGPD. `https://www.dsfadvogados.com.br/blog/dicas-para-vender-pelo-whatsapp-respeitando-a-lgpd`
36. [BLOG] Café com Bytes — Quando a boa intenção viola a privacidade (grupos e exposição recíproca de dado pessoal). `https://cafecombytes.com.br/2026/05/14/quando-a-boa-intencao-viola-a-privacidade/`

### Lacunas identificadas (não confirmadas nesta rodada, recomenda-se pesquisa complementar)

- Caso concreto e datado de multa de Procon por "preço fantasma"/"de-por" inflado em Black Friday no Brasil (nome do varejista, valor da multa, ano).
- Existência (ou não) de regra brasileira federal equivalente à "regra dos 30 dias" da Diretiva Omnibus da UE.
- Decisão específica do CONAR (representação, número, data, resultado) punindo influenciador/marca por publicidade não identificada.
- Relatos concretos e datados de conta de usuário do Telegram banida especificamente por uso de Telethon/Pyrogram para scraping de canal.
- Caso nomeado de canal de Telegram brasileiro de ofertas derrubado por violação de termo.
- Texto completo do relato Reclame Aqui sobre encerramento de conta Amazon antes dos 180 dias (bloqueio de acesso 403 impediu leitura integral).
- Termos específicos da Shopee Open API (diferente do programa de afiliados) para integração de vendedor/preço.

Essas lacunas existem porque o orçamento de buscas (WebSearch) da sessão se esgotou antes de cobrir todos os 30+ pontos planejados com o mesmo nível de profundidade; a pesquisa via WebFetch direto em URLs conhecidas continuou até o fim, mas para os pontos acima seria necessário retomar com orçamento de busca renovado.
