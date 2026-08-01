# Síntese — como o mercado de canais de promoção funciona por dentro

Pesquisa de 01/08/2026. As fontes de cada afirmação estão em `bruto/`, numeradas por frente.

---

## O retrato, em uma frase

**A maioria dos canais de promoção brasileiros não descobre oferta nenhuma: eles assinam a descoberta de outra pessoa por R$50 a R$300 por mês, e a única coisa que ninguém vende, porque ninguém tem, é histórico de preço confiável.**

Tudo o mais nesta síntese é detalhe dessa frase.

---

## 1. O mercado terceiriza a descoberta, e isso é um produto maduro

Foi o achado mais consistente entre as frentes 01, 02 e 03: existe uma indústria brasileira, nomeada e com preço de tabela, que faz o trabalho que um canal de promoção parece fazer.

**Quatorze ferramentas SaaS brasileiras** foram catalogadas, de R$35 a R$500 por mês. Uma amostra, com preço confirmado na página de venda:

| Ferramenta | Preço | O que entrega |
|---|---|---|
| PromoBot / Hub do Afiliado | R$48,50 a R$248,50/mês | Monitora Kabum e Terabyte, **ciclo de 6 a 19 segundos por loja**, pico de 287 ofertas/hora, link de afiliado automático no plano Pro |
| Shozap | R$50 a R$300/mês | Shopee, ML, Amazon, Magalu, Shein; posta em WhatsApp, Telegram e Instagram; vende **rotação de número** como recurso anti-ban |
| Pro Afiliados | grátis a R$100/mês | Monitora grupos alheios e converte link de terceiro para o seu; **"Feed Global P2P"** |
| DivulgaLinks | R$69,90 a R$169,90/mês | 10 programas de afiliado, artes automáticas |
| FluxoPromo | R$37 a R$197/mês | 12 lojas, grátis até 20 ofertas/dia |
| Achadinho Pro | R$49,97 a R$59,97/mês | Só WhatsApp, inclui "Shopee Videos" |
| CAT (Clonador Automático Telegram) | R$24 a R$47/mês | **Clona canal alheio e troca o link pelo seu.** Windows-only, roda na máquina do operador |

Dois desses merecem parágrafo próprio:

**O "Feed Global P2P" do Pro Afiliados** é uma rede em que afiliados concorrentes redistribuem ofertas entre si automaticamente, cada um recebendo com o próprio link já convertido. A concorrência do nicho é institucionalmente cooperativa na camada de descoberta e só compete na de audiência.

**O CAT** existe para clonar canal e trocar link. Não é gambiarra de fórum: é produto com plano anual e "mais vendido". E a prática nem é marginal — a **Admitad**, rede de afiliados internacional, mantém um bot oficial de Telegram que faz exatamente o mesmo (você cola um post com links, ele devolve com os deeplinks trocados).

**Como o mercado chama isso**, e vale saber para pesquisar depois: não é "link swap". É **"clonador automático"**, **"conversor de link"**, e tecnicamente **"deeplink"**.

### O que isso significa para o Radar

O diferencial do projeto **não pode ser velocidade nem volume de descoberta**. Existe um produto de R$97/mês que descobre em 6 segundos e converte o link sozinho. Competir ali é competir com preço de commodity contra quem já tem escala.

O diferencial tem que ser a única coisa que dinheiro não compra pronto: a série de preço acumulada.

---

## 2. Ninguém no mundo resolveu detecção de desconto falso

A frente 06 foi atrás de como Slickdeals, DealNews e a rede Pepper resolvem o "de/por" inflado. A resposta é que **não resolvem por algoritmo**:

- **DealNews**: regra editorial dura e humana. Para entrar no site, a oferta precisa ser o menor preço que a equipe conseguir encontrar naquele dia. O selo "Editors' Choice" exige que **2/3 dos editores** concordem. Mais de 100 funcionários.
- **Slickdeals**: funil de três camadas. Moderador humano tria a entrada, threshold automático promove a "Popular", e **editor humano** pesquisa histórico de preço antes de promover à capa. *"Front Page is earned, not bought."*
- **Pepper (mydealz, HotUKDeals, Chollometro, Dealabs)**: a "temperatura" é voto de comunidade renomeado, com destaque manual pontual. Não há peso algorítmico publicado.
- **O resto do mundo**: empurra para o usuário conferir Keepa ou CamelCamelCamel por conta própria.

Uma reportagem da PCWorld, ainda citada, documentou que a maioria dos "deals" de tecnologia da Amazon é artificial: o lojista sobe o preço semanas antes do evento e "desce" de volta ao normal durante ele.

**Nenhuma fonte descreveu um algoritmo de detecção de desconto falso rodando no lado do servidor de qualquer agregador grande.** Isso é lacuna de mercado global, não brasileira.

### Correção de fato para o repositório

O **Promobit não é da Pepper**. Foi comprado pela **Méliuz em 13/05/2021 por R$ 13 milhões**. A joint-venture da Pepper no Brasil é o **Pelando**, também com a Méliuz. A Méliuz tem os dois ativos, de origens diferentes. Se `docs/mercado.md` disser outra coisa, precisa de correção.

E a Pepper virou **Atolls** em 2024, depois de fundir com a Global Savings Group em 2022.

---

## 3. O vento regulatório sopra a favor de quem guarda histórico

- **União Europeia**: o Artigo 6a da Diretiva Omnibus (2019/2161) exige que o "preço anterior" exibido num desconto seja **o menor praticado nos 30 dias anteriores**. Multa de até 4% do faturamento anual, piso de €2 milhões. Portugal já aplica.
- **Brasil**: não há lei federal equivalente. O CDC art. 37 pega "preço fantasma" como publicidade enganosa comissiva, mas de forma genérica, sem janela numérica.
- **Mas**: a **Paraíba** aprovou lei obrigando o comércio a mostrar **histórico de 90 dias** de preço em produto com desconto, com menor, maior e datas das variações.

Construir voluntariamente o que a Europa exige por lei é diferenciação de confiança de custo relativo baixo, **e é risco regulatório zero** porque é mais transparência do que a lei brasileira pede, não menos. Se a tendência da Paraíba subir para federal, quem já acumulou a série não precisa fazer nada.

**Dado histórico não se compra, só se acumula.** É a única vantagem do projeto que cresce sozinha com o tempo.

---

## 4. Cupom: a fonte é o painel logado, não uma API

Resposta curta à pergunta que originou a pesquisa, com o detalhe em `cupons-de-onde-vem.md`.

**O padrão foi confirmado em campo, em dois dias e três canais diferentes.** Os agentes leram os canais concorrentes ao vivo:

- 31/07: `FULL3107`, `DECORELETRO3107`, `LIVROSJOGOS3107`
- 01/08: `LOJASOFICIAIS0108`, `MODAEBELEZA0108`

**A fórmula é `<CATEGORIA><DDMM>`.** É campanha de categoria criada em lote pelo próprio Mercado Livre, todo dia. Previsível.

**Por que os nove endpoints deram 404**: o único endpoint de cupom documentado do ML é `/seller-promotions/promotions`, e ele serve o **vendedor gerenciando a própria campanha**. Não existe GET público de "cupons ativos" para terceiro. Não foi erro de nome, foi ausência de recurso.

**O mesmo cupom apareceu em dois canais no mesmo dia com texto quase idêntico.** Isso derruba a hipótese de garimpo manual independente e aponta fonte comum a montante: ou robô com sessão de afiliado logada, ou um dos SaaS da seção 1 servindo de back-end para vários canais.

**A Shopee tem API de voucher de verdade** (`v2.voucher.get_voucher_list`), mas é Seller API: devolve só os vouchers da própria loja autenticada. Não é feed global.

**A Amazon não tem cupom em API de afiliado nenhuma.** Vem da página pública `/promocoes`.

---

## 5. O canal, por dentro: o que retém e o que mata

### O motivo de saída número um não é a oferta ruim. É volume.

Este foi o achado mais contraintuitivo, e apareceu em duas frentes independentes. Os três gatilhos de saída de membro, em ordem de recorrência nas fontes: **(1) excesso de notificação, (2) entrada não consentida no grupo, (3) suspeita de golpe**. Nenhuma fonte relatou "qualidade da oferta" como motivo principal.

Implicação direta: **mexer no teto diário por canal protege mais o negócio do que afinar a nota da curadoria.**

### Cadência

| Superfície | Faixa apurada |
|---|---|
| Grupo de WhatsApp | 4 a 8 ofertas/dia. "Abaixo de 4 o grupo esquece você; acima de 8 vira spam." **30+/dia mata o engajamento em uma semana** |
| Canal de Telegram, com curadoria | 1 a 3/dia recomendado; 10 a 30 tolerado |
| Canal de Telegram, automação agressiva | 50 a 100/dia, e há relato de 40 a 60 notificações em 3 minutos, que empurra direto para o mute |

### Segmentação por nicho quase dobra a conversão

Publishers de nicho reportam **4 a 6% de conversão**, contra canal genérico de estilo de vida amplo. Uma operação citada roda **8 grupos independentes por categoria**: eletrônicos, suplementos, mercado, beleza, games, pet, casa, moda.

Contraponto honesto de campo: o canal público mais ativo observado (`t.me/s/hardmob_promo`, 511 inscritos) é generalista e mistura beleza, eletrônico, brinquedo e vestuário livremente. O nicho vertical é a melhor prática recomendada; o achadinho generalista continua sendo o que se vê rodando.

### Mix de conteúdo que sustenta

Recomendação recorrente: **60% baixo ticket** (R$15 a 60, avaliação 4.8+), **25% premium com desconto forte**, **10% relâmpago**, **5% não-comercial** (dica, tendência). O componente não-comercial aparece como redutor de fadiga de venda.

### Horário

Consolidando as fontes: **8h–11h e 17h–20h**, com terça a quinta convertendo melhor que segunda e sexta. Nenhum estudo primário nomeado foi encontrado — são todos blogs de ferramenta de disparo, então trate como consenso de mercado, não como dado validado.

**Isso não bate com o `lib/horarios.ts` do projeto**, que usa 07–09, 12–13 e 19–22. Ver `o-que-muda-no-radar.md`.

### Lista de transmissão converte de 3 a 5 vezes mais que grupo

Porque a mensagem chega individualizada, sem ruído de outros membros. É uma superfície que não está no modelo de dados do projeto nem na D-031, que só comparou grupo com Canal.

---

## 6. Limites técnicos oficiais das duas plataformas

### Telegram Bot API

Da documentação oficial:

- **1 mensagem/segundo por chat**
- **20 mensagens/minuto por grupo**, e 20 edições/minuto
- **~30 mensagens/segundo em broadcast** para múltiplos chats
- `HTTP 429` vem com campo `retry_after`; ignorar aumenta o cooldown progressivamente, **mas o bot nunca é bloqueado permanentemente só por isso**
- Os limites exatos "não são especificados e são flexíveis"; a orientação oficial é tratar o 429 quando ele vier, não fazer throttle preventivo
- `allow_paid_broadcast` libera até 1.000 msg/s a 0,1 Telegram Star por mensagem acima do teto grátis

**Volume não derruba canal no Telegram.** O que derruba é violar os ToS, e a moderação é por denúncia de usuário com revisão humana. Um canal opt-in com audiência engajada tem risco estrutural baixo.

### WhatsApp

- Grupo: **1.024 membros**. Comunidade: 5.000. **Canal: sem limite**, unidirecional, e **não usa criptografia ponta a ponta**
- `wa.me` **não envia nada sozinho.** É clique manual, sempre
- **Cinco gatilhos oficiais de banimento**: envio em massa sem opt-in; app não oficial (GB, Plus); automação por plataforma não homologada; alto índice de denúncia; categoria de produto proibida
- **"Em todos os casos, o banimento é automático e sem aviso prévio."** Taxa de bloqueio acima de 2% já é sinal grave
- **Três em cada quatro bloqueios de WhatsApp Business vêm de automação sem opt-in.** E a palavra "promoção" no primeiro contato já é classificada como alto risco pelos próprios fornecedores de CRM

### A API oficial do WhatsApp virou cobrança por mensagem em janeiro de 2026

Marketing entre **R$0,31 e R$0,55** por template, mais mensalidade de BSP de **R$97 a R$1.200/mês**. Em escala de canal de oferta, o custo por mensagem come a comissão. Ela serve para notificação pontual e personalizada ("o preço do produto que você salvou caiu"), não para broadcast de várias ofertas por dia.

### E o crackdown de 2026 contra biblioteca não oficial

Relato datado e concreto: **issue #1869 do repositório Baileys, 5 de outubro de 2025** — um usuário perde 5 bots e cerca de 45 grupos em uma semana, **incluindo contas limpas há mais de três anos**. A issue foi marcada como stale, sem resposta de mantenedor.

Fontes de mercado apontam detecção intensificada desde janeiro de 2026, monitorando cadência de mensagem, padrão de digitação, intervalo entre ações e fingerprint de automação, atingindo Baileys, Venom, WPPConnect e Evolution API.

**A regra 3.2 do projeto ganha uma terceira justificativa.** Não é só termo de uso e não é só ética: é que o caminho não é sustentável tecnicamente, e o número é o ativo do parceiro.

---

## 7. O dinheiro, e a distância entre a vitrine e o chão

### Comissão por programa

A Amazon é a única com tabela oficial acessível e auditável. As outras vêm de blogs que divergem entre si em 2 a 5 pontos percentuais para a mesma categoria — **trate como faixa, nunca como valor contratual**, e confirme no painel logado.

**Amazon Associados BR, oficial:** Bebê/Beleza/Saúde/Alimentos 13% · Roupas e Pet Shop 11% · Livros 10% · Dispositivos Amazon 9,5% · Esporte, Casa, Ferramentas, Cozinha, Eletrônicos, Informática, Games 8% · Calçados, Joias, Relógios, Automotivo 7% · demais 7%.

**Mercado Livre**, faixas relatadas: eletrônicos 11–16%, beleza 13–18%, casa 12–17%, roupa 14–19%, livros e brinquedos 10–13%.

**Shopee**, faixas relatadas: beleza até 30%, moda 15–25%, casa 5–14%, eletrônicos 1–4%, celulares 1–3%. Comissão turbinada nas datas duplas.

### Janela de cookie, e ela muda tudo

| Programa | Janela |
|---|---|
| Mercado Livre | ~30 dias (não oficial) |
| Shopee | **7 dias** (oficial) |
| AliExpress | 3 dias |
| **Amazon** | **24 horas** (oficial). Exceção: item no carrinho estende para 89–90 dias, e nesse caso a comissão vale para o carrinho inteiro |

**A mesma publicação vale coisas muito diferentes dependendo da loja.** A nota da oferta hoje não sabe disso.

### Prazo e piso

R$30 de piso em ML, Shopee e Amazon; R$50 no Magalu. O dinheiro cai de fato **30 a 60 dias depois da venda confirmada**, porque todos esperam a janela de devolução passar. AliExpress cobra **US$15 fixos por saque** e limita a comissão a **US$50 por venda**.

### Subid: o item crítico, e ele tem um problema

| Programa | Suporte | Detalhe |
|---|---|---|
| Shopee | `sub_id1` a `sub_id5` | O mais robusto. 5 posições customizáveis |
| Amazon | Até **100 Tracking IDs** | Granularidade de **canal**, não de publicação |
| Amazon `ascsubtag` | Acesso restrito | E os termos proíbem: *"você não poderá dinamicamente atribuir sub-tags aos usuários na medida em que eles entrarem em seu site"* |
| Mercado Livre | "Etiqueta" + `matt_word`/`matt_tool` | 1 nível. **Não há confirmação de que `matt_word` colado numa URL comum é honrado** |
| AliExpress, Magalu | Ponto cego | Não documentado nas fontes |

**O `ascsubtag` fecha uma porta.** O modelo do projeto assume subid único por publicação. Na Amazon isso não é possível dentro dos termos: sobram 100 Tracking IDs, que é granularidade de canal. Ver `o-que-muda-no-radar.md`.

### Quanto se ganha, na vitrine e no chão

| Fonte | Faixa | Selo |
|---|---|---|
| FluxoPromo, tabela por tamanho de canal | R$500 a R$15.000+/mês | `[VENDEDOR]` |
| "Um canal com 3.000 seguidores postando 50 ofertas/dia gera 15 a 40 vendas diárias" | R$2.250 a R$18.000/mês | `[VENDEDOR]`, e o texto diz "pode gerar" |
| Devzapp, grupos de 100 membros | **R$100 a R$300/mês** | `[RELATO indireto]` |
| Devzapp, acima de 300 membros com frequência mantida | **R$1.000+/30 dias** | `[RELATO indireto]` |
| **Filipe Souza**, grupo WhatsApp Amazon, ~250 membros | **R$8.060 em 7 meses**. Jun/25 R$1.450 · jul/25 R$2.923 (pico) · set/25 ~R$1.000 | `[RELATO]`, único com números datados |
| BlackHatWorld, título de journey | "From 0 to **1k/month**" | O marco que alguém acha digno de documentar |

**A distância entre a vitrine e o chão é de quase uma ordem de grandeza.** E o único relato auditável mostra receita *variável*, dependente de esforço constante — o próprio autor admite que operou de forma inconsistente em parte do período e que isso derrubou o resultado. Renda de afiliado não é passiva.

Custo de operação do mesmo caso: automação inicial (Make + UltraMSG) a ~R$500/mês, depois otimizada para VPS a R$89/mês.

### Crescimento

Custo por lead real com tráfego pago: **R$0,60 a R$1,80**, com conversão clique→membro efetivo de **20 a 30%**. Orçamento de teste sugerido: R$10/dia por 2 ou 3 dias.

Piso oficial do Telegram para monetização por anúncio da própria plataforma: **1.000 inscritos**, com 50% da receita. Abaixo disso, a única renda é afiliação.

---

## 8. Erro de preço: existe, é o evento de maior engajamento, e não é para nós

A frente 02 e a 06 convergiram: erro de preço é o evento de maior engajamento por unidade de tempo do nicho, e a janela útil é de **segundos a poucas horas**.

A pesquisa da **Kasada** sobre "Freebie Bots" documentou o tamanho da coisa: mais de 250 varejistas alvo, e uma única comunidade comprando quase **100 mil produtos em um mês**, valor de tabela de US$3,4 milhões, pagando US$882 no total.

A técnica é simples (monitorar sitemap, diff de JSON, webhook para Discord/Telegram); a barreira real é ter comunidade grande o bastante para vigiar muitas lojas ao mesmo tempo.

**Para um projeto de dono único, competir em "quem acha o erro primeiro" é entrar numa corrida armamentista já povoada por operadores organizados.** Faz mais sentido ser bom em desconto legítimo bem verificado — que é, aliás, o que ninguém é.

---

## 9. As ferramentas de histórico, e o buraco brasileiro

- **Keepa**: API paga documentada, a partir de €19/mês, por tokens que expiram 60 minutos após criados. Só registra o preço quando ele **muda**. É a peça de infraestrutura mais replicável do ramo.
- **CamelCamelCamel**: gratuito, sem API pública robusta, e **não cobre a Amazon Brasil**. Os locales suportados são Canadá, França, Alemanha, Itália, Japão, Espanha, Reino Unido e Estados Unidos.
- **Zoom/Buscapé**: mostra histórico de preço, mas a API deles é para o *lojista enviar* produto, não para terceiro consumir.
- **Nenhum agregador brasileiro tem API pública.** Promobit, Pelando, Gatry e Hardmob são curadoria humana. O Promobit modera "mais de 200 ofertas diariamente". Quem quer automação sobre eles está raspando.

**Não existe um Keepa brasileiro.** É exatamente o buraco onde o Radar está sendo construído.

---

## 10. O que derruba a operação

Consolidado da frente 08, com texto literal quando disponível.

### Mercado Livre

Os termos da API proíbem scraping com essa palavra: *"não poderão utilizar robôs, harvesters, spiders, scraping ou outra tecnologia para acessar o Conteúdo"*. O encerramento de acesso é discricionário: *"sem justificativa e a qualquer momento, sem necessidade de notificação"*. O robots.txt dá `Disallow: /` nominalmente para ClaudeBot, GPTBot, PerplexityBot, Amazonbot e outros.

E **não existe API oficial de afiliados do ML** — há reclamação formal no Reclame Aqui sobre isso. A ausência empurra quem quer automatizar para caminho não sancionado.

### Shopee

*"Os cupons nominais fornecidos aos Afiliados são exclusivos para compartilhamento do Afiliado com seus seguidores. A divulgação ou compartilhamento de cupons nominais de afiliados terceiros pelo Afiliado será considerada violação."*

**Isso atinge diretamente o "atalho mais barato" anotado no `AGENTS.md`**: extrair cupom por regex do texto colhido de canais alheios. Para a Shopee, é violação contratual, e a rescisão pode ser imediata e sem aviso, com retenção de comissão já ganha.

Também proibido: anúncio pago com a marca, SEM com "Shopee", link em site de torrent ou streaming, conteúdo irrelevante, fake news.

### Amazon

Além da regra de imagem já citada: disclosure obrigatório com wording específico; link em mensagem direta **só se a comunicação for solicitada** (o que exige canal opt-in, não DM fria nem adição a grupo); autocompra proibida inclusive por familiares que dividem endereço ou cartão; uso de "amazon"/"kindle" (e erros de grafia propositais) como palavra-chave em busca paga desqualifica a venda; e **três vendas em 180 dias** ou a conta é desativada.

### CONAR

Hashtags aceitas: **#publicidade, #anúncio, #patrocinado, #conteúdoPago, #parceriaPaga**. Insuficientes: **#ad, #adv, #ambassador, #parceiro, #colab**. Identificação exigida *"de forma clara e diretamente na primeira tela"*, sem clique adicional. A recomendação atual é usar primeiro o recurso nativo da plataforma, quando existir, e a hashtag "vai perdendo protagonismo" como suficiente sozinha.

Camada nova de 2025: **Lei 15.211/2025 (ECA Digital)**, quando o público inclui criança ou adolescente.

**A regra 3.10 do projeto já cumpre isso**, e agora tem lastro citável.

### LGPD

A **ANPD**, no Radar Tecnológico nº 3 (nov/2024), trata web scraping como forma de tratamento de dados sujeita à LGPD **mesmo quando o dado é público**. "Está na internet" não é base legal.

Para raspar preço de produto o risco jurídico direto é baixo (preço não é dado pessoal); ele sobe imediatamente se a coleta capturar nome de vendedor pessoa física ou de quem avaliou.

E há um ponto de desenho: em **grupo** há exposição recíproca de nome e telefone entre todos os membros. Em **canal** não há. Do ponto de vista de LGPD, canal é estruturalmente mais seguro que grupo.

---

## 11. O que esta pesquisa não conseguiu responder

Honestamente listado, para não virar buraco silencioso:

1. **Tamanho real dos maiores canais de oferta brasileiros.** O TgStat bloqueou (403).
2. **Quem está por trás** de A Barateou, Pechinchou e afins.
3. **Teste A/B nomeado sobre "de/por"** e posição do preço na mensagem. Nenhuma fonte publicou número.
4. **Cadência específica de aumento em Black Friday** para canal de afiliado.
5. **Comissão de Netshoes, Centauro, Kabum e Americanas** por categoria.
6. **Mudanças de regra em 2025–2026** nos programas do ML e da Shopee que pegaram gente de surpresa.
7. **Taxa agregada de anulação de comissão** por programa. Só relatos individuais.
8. **App contra navegador**: só a Amazon documenta que app não aprovado quebra a atribuição. Para ML e Shopee é folclore de mercado sem confirmação técnica.
9. **Caso nomeado de multa do Procon** por preço fantasma, e decisão específica do CONAR.
10. **Relato datado de conta de Telegram banida por Telethon/Pyrogram** especificamente.

Os itens 5, 6, 7 e 8 são os que mais importam para o projeto, e são os candidatos naturais a uma segunda rodada.
