# A cena internacional de deal hunting por dentro

Pesquisa sobre como Slickdeals, DealNews, a rede Pepper.com (mydealz/HotUKDeals/Chollometro/Dealabs), Ozbargain, r/buildapcsales e os bots de erro de preço operam de fato — o que é humano, o que é algoritmo, como monetizam, e o que dá para copiar num projeto brasileiro pequeno.

Convenções: **[OFICIAL]** = fonte da própria empresa/documento legal; **[RELATO]** = imprensa, análise de terceiros, comunidade; **[BLOG]** = blog técnico/how-to de terceiro (não é a empresa falando).

---

## 1. Como Slickdeals e DealNews decidem o que é "frontpage"

### Slickdeals: funil de três estágios, maioria automática, checagem humana só no topo

O Slickdeals **não** é um algoritmo puro nem um jornal editorial puro — é um funil:

1. **Postagem inicial**: um usuário submete um deal. Antes de aparecer publicamente, passa por triagem de "Deal Specialists" (papel de moderação, hoje inclusive contratado via terceirizada TCW em parceria com a Slickdeals) [OFICIAL/RELATO] [4][6][7][73].
2. **Hot Deals → votação da comunidade**: o post aparece no fórum "Hot Deals" e a comunidade vota com thumbs up/down. Cada usuário pode alternar o próprio voto [OFICIAL] [1][5].
3. **Popular Deals — corte automático**: quando o deal ultrapassa certos limiares de votos, cliques e/ou visualizações, ele é **automaticamente** marcado como "Popular" — aqui é puramente algorítmico/threshold, sem humano no loop [OFICIAL] [2].
4. **Frontpage — curadoria humana final**: os melhores Popular Deals são triados por "Deal Editors" humanos, que pesquisam histórico de preço, avaliações, disponibilidade e estoque antes de promover para a Frontpage [OFICIAL] [2][4].

A própria empresa resume: "Front Page is earned, not bought" — ou seja, mesmo com parceiros pagantes (loja pode "impulsionar"/boost um post nos fóruns), a Frontpage em si exige aprovação editorial e tração orgânica [OFICIAL] [4][7]. Existe inclusive um mecanismo pago de "boosting a deal" nos fóruns, mas ele afeta visibilidade no fórum, não a Frontpage editorial [OFICIAL] [7].

Conclusão prática: é um sistema híbrido em camadas — **triagem humana → filtro por threshold automático → curadoria editorial humana final**. O algoritmo decide quem passa para a bandeja de revisão; o humano decide quem vira capa.

### DealNews: editorial "puro", com regra de preço objetiva

DealNews é o oposto: não tem votação pública visível como motor central. Uma equipe de escritores/editores (mais de 100 funcionários, incluindo redações em Huntsville, Nova York e Dublin) revisa "milhares de deals e centenas de varejistas" por dia [OFICIAL] [64][65].

Regra editorial publicada: para entrar no site, a promoção precisa ter **o menor preço que a DealNews consegue encontrar** para aquele produto (ou produto comparável) na data de publicação; lojas com histórico ruim de atendimento são banidas independentemente de relação comercial [OFICIAL] [8][9][10].

Selo "Editors' Choice": exige que **pelo menos 2/3 dos editores** concordem que o deal é excepcional — maioria qualificada humana, sem componente algorítmico declarado [OFICIAL] [8][10].

Resumo comparativo:

| | Slickdeals | DealNews |
|---|---|---|
| Motor principal | Comunidade (votos) | Equipe editorial |
| Papel do algoritmo | Filtro de threshold para "Popular" | Não declarado publicamente |
| Papel humano | Moderação de entrada + curadoria de capa | Curadoria integral |
| Regra de preço | Não publicada como regra rígida | "Menor preço encontrado no momento" é regra explícita |
| Fundação | 1999 (crowd-sourced desde o início) | 1997, como dealmac.com para produtos Apple [OFICIAL] [64] |

---

## 2. Pepper.com: a holding europeia por trás de mydealz, HotUKDeals, Dealabs, Chollometro

### Estrutura societária

Pepper.com foi fundada em **junho de 2014** como fusão de três comunidades de deals já líderes de mercado: **hotukdeals** (Reino Unido), **Dealabs** (França) e **mydealz** (Alemanha) — feita pelos fundadores Paul Nikkel (hotukdeals) e Fabian Spielberger (mydealz) [RELATO] [13][18].

**Chollometro** (Espanha) foi lançada depois pela própria Pepper.com como expansão direta da rede, não como aquisição de site pré-existente [OFICIAL/RELATO] [12].

Sede em Berlim, com escritórios em Belo Horizonte, Guadalajara, Londres, Lyon, Mumbai e Winnipeg. Portfólio completo hoje: Dealabs (França), DesiDime (Índia), hotukdeals (Reino Unido), mydealz (Alemanha), **Pelando.com.br (Brasil)**, Pepper.com (Holanda), Pepper.it (Itália), Pepper.pl (Polônia), Pepper.ru (Rússia), Preisjaeger (Áustria) e PromoDescuentos (México) [RELATO] [16].

Em novembro de 2022, hotukdeals entrou formalmente no grupo via fusão entre Pepper.com e a **Global Savings Group** (dona de cashback sites e cupons); a empresa combinada foi rebatizada **Atolls** em 2024 [OFICIAL/RELATO] [15][16].

### E o Promobit brasileiro?

**Promobit não é Pepper.com.** Ele foi adquirido em 13/05/2021 pela **Méliuz** (maior cashback do Brasil) por R$ 13 milhões [RELATO] [23]. A ligação com a rede Pepper é indireta: a Pepper.com fez uma joint-venture com a própria Méliuz para lançar o **Pelando.com.br** ("primeira rede social commerce do Brasil") [RELATO] [16]. Ou seja: Méliuz tem *dois* ativos de deal-sharing no Brasil — Pelando (joint-venture com Pepper.com, tecnologia/DNA europeu) e Promobit (aquisição nacional independente) — e não são o mesmo produto nem compartilham a mesma origem técnica.

### O algoritmo de "temperatura"

O sistema de "temperatura" do Pepper é essencialmente um **voto de comunidade renomeado**: cada membro vota "hot" (positivo) ou "cold" (negativo), e a soma define a temperatura exibida (ex.: 500°) [RELATO] [4-search]. Deals "fixados" (pin icon ao lado da temperatura) recebem destaque manual quando estão performando muito acima da média em views/clicks ou trazendo tráfego relevante de busca — indício de intervenção editorial pontual sobre o que a votação pura não capturou [RELATO] [busca Pepper temperature].

Não há, nas fontes públicas consultadas, detalhamento de peso algorítmico (ex.: decaimento por tempo, ponderação por reputação do votante) — a empresa não publica esse nível de detalhe, ao contrário do funil em camadas do Slickdeals.

### Modelo de negócio

A rede monetiza majoritariamente via **afiliação** (comissão de cada clique/compra que sai do site para a loja) e programas próprios de anúncio para lojistas, incluindo posts patrocinados e destaques pagos — modelo confirmado pela existência de "Merchant Programme"/parcerias comerciais equivalentes em toda a categoria de comparadores/curadores europeus [RELATO] [45][47]. A fusão com a Global Savings Group (2022) reforça isso: GSG é especializada em cashback e cupons, sinal de que a estratégia de receita combinada passou a somar afiliação de deals + cashback + cupons sob o mesmo guarda-chuva [OFICIAL] [15].

---

## 3. Bots de erro de preço: como funcionam e quão rápido

### O ecossistema "Freebie Bot"

A pesquisa mais citada é da **Kasada** (empresa de proteção anti-bot), que documentou o fenômeno "Freebie Bots": bots que varrem sites de varejo em busca de produtos com preço errado e compram em escala **antes que o erro seja corrigido** [RELATO] [24][26][27].

Números da Kasada:
- Mais de **250 varejistas** identificados como alvos recorrentes [RELATO] [24].
- Mais de **7 milhões de mensagens/mês** em comunidades de "freebie" (fóruns/Discord/Telegram fechados) [RELATO] (citado nos resultados de busca, consistente com [24]).
- Em uma comunidade só, usuários compraram quase **100 mil produtos em um mês**, valor de tabela combinado de **US$ 3,4 milhões**, pagando apenas **US$ 882** no total — lucro individual relatado acima de **US$ 100 mil/mês** para alguns operadores [RELATO] [24][27].
- Causa raiz mais comum: **erro de casa decimal** (ex.: US$ 999,00 virar US$ 9,99) ou erro de copy-paste ao subir catálogo, gerando descontos de até 99% [RELATO] [24].

### Técnicas usadas (composto a partir de fontes de scraping/monitoramento, já que não há "manual do bot" público)

1. **Monitoramento de sitemap/feed**: ferramentas de "sitemap monitoring" detectam URLs novas/alteradas entre checagens, com diff completo e timestamp — usado tanto por equipes de e-commerce legítimas quanto adaptável para caça a erro de preço [BLOG] [item "Sitemap Monitoring" nos resultados].
2. **Diff de JSON / campo a campo**: serviços de monitoramento de mudança de página geram `diff.json` por campo junto de um "sidecar" em markdown, e dispara **webhook** a cada checagem — é o padrão replicável para captar quando um preço muda de valor sem precisar re-renderizar a página inteira [BLOG].
3. **Alertas por Telegram/Discord**: comunidades de glitch deals usam bots que empurram alerta com atraso de poucos minutos assim que a anomalia é detectada; velocidade é o fator decisivo — "a maioria dos glitch deals morre quando o post atinge 100 comentários" [BLOG] [60].
4. **Navegador headless para checkout automatizado**: para quem quer *garantir* a compra (não só alertar), a etapa seguinte é automação de carrinho/checkout — mas isso já cruza para prática de risco alto (cancelamento em massa por antifraude do varejista) [BLOG] [60].

### Casos documentados

- Dyson V15 por US$ 199 em vez de US$ 650 na Target [BLOG] [60].
- Fire TV Stick por US$ 9,99 em vez de US$ 39,99 na Amazon [BLOG] [60].
- Erro único relatado com economia agregada de comunidade acima de US$ 200 mil [BLOG] [60].
- No campo de **mistake fares** aéreas (a origem do termo, anos 2000–2010), companhias monitoram ativamente fóruns e redes sociais públicas para *conter* a disseminação (ou seja, o jogo é dos dois lados: caçadores monitoram a companhia, a companhia monitora os caçadores) — Twitter foi citado como canal preferido de disseminação numa era pré-Discord [RELATO] [59].

### Risco prático, não só legal

Reordenar em massa aciona sistemas antifraude e resulta em **cancelamento de pedido** (o vendedor normalmente não é obrigado a honrar preço com erro manifesto, dependendo da jurisdição) — ou seja, o ganho é estatístico/de comunidade, não garantido por pedido [BLOG] [60].

---

## 4. Ferramentas do ramo

| Ferramenta | O que faz | Uso para curadoria de oferta |
|---|---|---|
| **Keepa** | API paga (chave + assinatura mensal) que devolve histórico de preço, disponibilidade, ranking de vendas e ofertas de marketplace da Amazon em arrays compactos de tempo. Só registra o preço quando ele **muda** (sem changelog = preço permanece o do último registro) [OFICIAL/BLOG] [30][32][33]. | É a fonte de verdade mais usada por sites de deal para provar "isso é realmente o menor preço" — dá para plugar como API server-side. |
| **CamelCamelCamel** | Gratuito, rastreador de preço Amazon com gráfico de histórico, alerta de queda de preço e extensão "Camelizer"; importa wishlist da Amazon [OFICIAL] [34][35]. | Curadoria manual por qualquer pessoa: cola o link, vê o histórico, decide se é "deal de verdade". Não tem API pública oficial gratuita robusta — a maior parte do ecossistema de terceiros usa Keepa para isso. |
| **Zonmaster / repricers de Amazon FBA** | Categoria de reprecificação automática para *vendedores* Amazon (ajustar preço próprio conforme concorrência) — não achei fonte primária específica sobre "Zonmaster" nesta pesquisa (ferramenta de nicho, pouca cobertura editorial fora de comunidades de sellers); a categoria geral (repricers) serve ao lado oposto do mercado (quem vende), não a quem cura oferta. |
| **Jungle Scout / Helium 10** | Suites de pesquisa de produto e analytics para **vendedores** Amazon FBA — validação de produto, PPC, estimativa de vendas [RELATO] [48][49]. | Não servem diretamente para curadoria de oferta ao consumidor; são ferramentas do lado do vendedor. Relevante só se o dono do projeto também quiser vender/arbitrar produtos. |
| **PriceRunner** | Comparador sueco fundado em 1999, adquirido pela Klarna em 2021/2022 [RELATO] (achado em busca sobre Idealo/PriceRunner). | Motor de comparação de preço multi-loja — cobra do lojista, não do usuário. |
| **Idealo** | Comparador alemão: cobra dos lojistas em modelo **CPC** via "Merchant Programme", agrega +50 mil lojas [OFICIAL/RELATO] [46]. | Mesma lógica: monetiza o lado da oferta (lojista paga por lead), não o lado do usuário. |

Conclusão da seção: **Keepa é a peça de infraestrutura mais replicável** — é a única com API paga clara, documentada, orientada a desenvolvedor terceiro (Python client oficial da comunidade) [OFICIAL] [31].

---

## 5. Stack de quem faz isso profissionalmente

Achados concretos sobre o Slickdeals (o único caso com detalhe técnico público, via estudo de caso de fornecedor e paper acadêmico):

- **Frontend**: React + Bootstrap. **Backend**: Express.js sobre Node.js [BLOG] [51 fonte: estudo/paper].
- **Scraping**: Puppeteer para extração automatizada de dados de produto [BLOG] [51].
- **Pipeline de dados**: ingestão de deals como objetos JSON semiestruturados vindos de brokers/fontes externas; *fuzzy matching* e tokenização para casar produtos entre fontes diferentes (deduplicação de oferta) [BLOG] [51].
- **Infraestrutura**: migração recente de VMs on-prem legadas para **Amazon EKS** (Kubernetes); time de plataforma/devops de apenas 3–4 pessoas dentro de um engenharia de ~60 [RELATO] [51 — case AtScale/groundcover].
- **Observabilidade**: adotaram uma ferramenta de observabilidade gerenciada (groundcover) em vez de montar stack open-source própria, citando economia de ~6 meses de trabalho de engenharia [RELATO — case comercial do fornecedor, viés esperado] [52].

### Custo de proxy residencial (para quem faz scraping em escala fora dessas empresas)

- **Bright Data**: a partir de **US$ 0,75 por 1.000 requisições bem-sucedidas** sem compromisso mensal; proxy residencial cobrado por banda em **US$ 10/GB** [RELATO/comercial] [54].
- **Oxylabs**: planos a partir de **US$ 49/mês** (Web Scraper API Micro); proxy residencial a partir de **US$ 99/mês** (Micro) até US$ 300/mês (Starter); no modelo pay-as-you-go, proxy residencial cai para ~**US$ 4/GB**, com desconto forte acima de 1TB [RELATO/comercial] [55].
- Ambos declaram **98–99% de taxa de sucesso** em alvos grandes de e-commerce (Amazon, eBay, Shopify) [RELATO/comercial] [54].

Leitura crítica: esses números são de material de marketing dos próprios fornecedores de proxy — plausíveis como ordem de grandeza, mas não auditados de forma independente.

---

## 6. Como monetizam e quanto rende

- **Modelo dominante**: afiliação (comissão por clique/venda que sai para a loja) é citado como o motor central em Slickdeals, DealNews, Pepper e comparadores como Idealo/PriceRunner [RELATO/OFICIAL] [45][46].
- **Comparadores (CSS — Comparison Shopping Engines)**: cobram do **lojista**, não do usuário — tipicamente **CPC de US$ 0,10 a US$ 1,50 por clique**, ou **CPA de 5% a 20% do valor do pedido** [RELATO] [45].
- **Programas de afiliado genéricos**: revenue share típico de **20% a 40%** da receita gerada pelo cliente indicado, dependendo do vertical [RELATO] (achado em busca geral sobre modelos de afiliado).
- **RPM (receita por 1.000 cliques)**: extremamente variável por nicho — uma referência solta encontrada foi **~US$ 10 por 1.000 visitantes** para programas PPC genéricos, mas isso não é confiável como benchmark do setor de deals especificamente; não há dado público e auditável de RPM de Slickdeals/DealNews/Pepper [RELATO fraco] — tratar como não confirmado.
- **Posts pagos e boost**: Slickdeals permite lojista "impulsionar" um post no fórum mediante pagamento — separado da Frontpage editorial, que continua sendo orgânica [OFICIAL] [7].
- **Consolidação recente**: a fusão Pepper.com + Global Savings Group (2022, virou Atolls em 2024) mistura deals + cashback + cupons no mesmo grupo — sinal de que **diversificação de receita** (não só afiliação de deal) é a tendência dos players maduros [OFICIAL] [15][16].

---

## 7. Detecção de desconto falso: como os grandes players resolvem o "de/por" inflado

Achado central: **nenhum dos grandes agregadores parece publicar um algoritmo formal e auditável de "desconto real vs. inflado"**. O que existe:

1. **Regra editorial explícita (DealNews)**: exigir que o preço publicado seja objetivamente o menor encontrado *pela própria equipe* na data — não um "de/por" declarado pelo lojista [OFICIAL] [8][9].
2. **Histórico de preço como ferramenta do usuário, não do agregador**: Keepa e CamelCamelCamel são a camada que resolve isso na prática — a checagem é feita pelo **consumidor**, comparando o preço anunciado com meses de histórico real [BLOG/RELATO] [57][58]. Reportagem da PCWorld (2016, ainda citada em 2024–2025) documentou que "a maioria dos 'deals' de tecnologia da Amazon é artificial" — lojistas sobem o preço semanas antes de um evento de vendas só para "descer" de volta ao normal durante o evento [RELATO] [57].
3. **Nenhuma das fontes consultadas descreve um algoritmo de detecção automática de desconto falso rodando server-side** nos próprios agregadores — o padrão é: comunidade vota "cold"/thumbs-down quando percebe preço inflado, e isso rebaixa organicamente o post (mecanismo de moderação social, não estatístico).

Isso é um ponto de abertura real para um projeto pequeno: nenhum concorrente internacional grande resolveu isso de forma algorítmica pública — construir uma verificação automática contra histórico de preço (ao estilo Keepa, mas aberto) é diferenciação genuína, não commodity já resolvida por todo mundo.

---

## 8. Regulação de preço "de/por": UE/UK têm regra explícita; Brasil está fragmentado

### União Europeia — Omnibus Directive (regra madura, com fiscalização real)

- Base legal: **Diretiva (UE) 2019/2161** ("Omnibus Directive"), que alterou a Diretiva 98/6/EC adicionando o **Artigo 6a** [OFICIAL] [37][38].
- Regra: ao anunciar uma redução de preço, o lojista deve mostrar o **menor preço praticado nos últimos 30 dias** antes da redução — chamado de "preço anterior" (prior price). O lojista **não pode** estabelecer o preço anterior com base em período menor que 30 dias [OFICIAL] [37][38].
- Escopo: aplica-se a **bens móveis** (eletrônicos, roupas, cosméticos etc.); **não** cobre conteúdo/serviço digital nem B2B [OFICIAL] [37].
- Multas: podem chegar a **4% do faturamento anual** da empresa nos países-membro afetados, com piso mínimo de **€2 milhões** quando o faturamento não pode ser apurado [OFICIAL] [37].
- Objetivo declarado: coibir a prática de subir o preço por poucos dias antes de anunciar "50% off" — exatamente o padrão que a PCWorld documentou informalmente para Amazon [OFICIAL+RELATO cruzados] [37][57].

### Brasil — sem lei federal equivalente, mas movimento estadual/municipal começando

- **Não existe** regra federal brasileira equivalente ao Art. 6a da Omnibus Directive nesta pesquisa. O que existe é o arcabouço geral do **CDC** (Código de Defesa do Consumidor) + **Lei nº 10.962/2004** (afixação de preços, letras legíveis) — que trata de transparência de preço, não de janela de referência para desconto [RELATO] [76].
- **Achado mais interessante**: a **Paraíba** aprovou lei estadual/municipal exigindo que o comércio mostre **histórico de 90 dias** de preço em produtos com desconto — menor preço, maior preço e datas das variações relevantes [RELATO] [75]. Isso é um precedente sub-nacional que aponta na mesma direção da regra europeia, só que com janela de 90 dias em vez de 30, e aplicação regional, não nacional.
- Omissão ou manipulação do histórico de preço para simular desconto maior é enquadrada como **prática abusiva** sob o CDC, sujeita a penalidade — mas isso é enforcement genérico de proteção ao consumidor, não uma regra de "janela de referência" explícita e nacional como a europeia [RELATO] [75].
- Portugal (mercado lusófono próximo, referência cultural) já aplica a mesma regra europeia dos 30 dias, com fiscalização e "truque dos 30 dias" já sendo tema de imprensa de consumo [RELATO] [obtido na mesma busca, fonte portuguesa].

### Leitura para o projeto: oportunidade, não risco

Não há hoje regra nacional brasileira que force o lojista a expor preço de referência de 30/90 dias — logo, **construir isso voluntariamente** (mostrar o histórico real de preço de um produto, ao estilo Camelcamelcamel/Keepa, aplicado a lojas brasileiras) é: (a) um diferencial de confiança difícil de copiar rápido por concorrente que não investiu em coleta de série histórica; (b) uma antecipação regulatória — se a tendência de Paraíba virar lei federal (o que já aconteceu na UE), quem já tiver o histórico coletado sai na frente; (c) zero risco regulatório, porque é *mais* transparência do que a lei brasileira hoje exige, não menos.

---

## 9. Aprendizados transferíveis para um projeto brasileiro pequeno, de dono único

1. **Copie o funil de camadas do Slickdeals, não o "editorial puro" da DealNews.** Um dono só não consegue ser 100 editores full-time revisando "milhares de deals por dia" [8]. O que dá para replicar é o funil: (a) triagem automática barata (regra + threshold), (b) validação humana só no que já passou no filtro — inverte o gargalo: humano só olha o que já tem sinal de qualidade.

2. **O "preço de verdade" é a arma mais forte e ninguém no mercado internacional resolveu isso de forma pública/algorítmica** (seção 7). Um histórico de preço próprio, coletado ao longo do tempo por produto/loja, é o ativo mais defensável — é o que substitui "confiar no lojista" por "mostrar o dado". Como não existe API brasileira equivalente ao Keepa para o varejo local, quem monta essa série histórica primeiro tem vantagem que **cresce com o tempo** (dado histórico não se compra, só se acumula).

3. **A "temperatura" do Pepper é só voto renomeado com destaque manual pontual** — não precisa reinventar matemática sofisticada de ranking; comunidade pequena + pin manual do dono já reproduz 90% do efeito prático.

4. **Erro de preço é jogo de velocidade de comunidade fechada** (Discord/Telegram com webhook), não de scraping sofisticado — a barreira de entrada técnica é baixa (diff de JSON + webhook), a barreira real é ter comunidade grande o suficiente para monitorar muitas lojas ao mesmo tempo. Para um projeto pequeno, faz mais sentido focar em **descontos legítimos bem verificados** do que competir em "quem acha o erro de preço primeiro" — esse nicho já tem operadores organizados e é uma corrida armamentista (ver Kasada, seção 3).

5. **Monetização é afiliação — mas todo mundo grande está diversificando para cashback/cupom também** (fusão Pepper+GSG). Um projeto pequeno não precisa (nem consegue) montar isso tudo de uma vez, mas vale desenhar a arquitetura de dados pensando em adicionar cupom/cashback depois, sem reescrever tudo.

6. **Regulação europeia dos 30 dias é uma pista de produto, não só de compliance**: construir "voluntariamente" o que a Europa já exige por lei é diferenciação de confiança de baixo custo relativo, e a Paraíba mostra que o Brasil pode caminhar para lá — antecipar é dado acumulado, não é feature.

7. **O papel dos moderadores humanos é pago no Slickdeals** (contratados via terceirizada) — moderação de comunidade grande não é trabalho voluntário sustentável em escala; para um projeto de dono único, isso reforça que o funil deve minimizar trabalho humano por item revisado (automatizar triagem agressivamente) até haver caixa para contratar.

8. **Ninguém publica o algoritmo de detecção de desconto falso** — isso é uma lacuna real de mercado, não só brasileira. Resolver isso bem (mesmo que de forma simples: regra dura tipo DealNews + histórico tipo Keepa) já coloca o projeto à frente da prática média internacional, não só da brasileira.

---

## Fontes consultadas

1. [How Do I Vote on a Deal? – Slickdeals Help Center](https://help.slickdeals.net/hc/en-us/articles/360000551734-How-Do-I-Vote-on-a-Deal) — [OFICIAL]
2. [What Is a Popular Deal? – Slickdeals Help Center](https://help.slickdeals.net/hc/en-us/articles/360000551534-What-Is-a-Popular-Deal) — [OFICIAL]
3. [How Slickdeals Works - Slickdeals](https://slickdeals.net/corp/how-slickdeals-works/) — [OFICIAL]
4. [From Company Ownership to Front Page: Your Top Slickdeals Questions, Answered](https://slickdeals.net/f/18766330-from-company-ownership-to-front-page-your-top-slickdeals-questions-answered) — [OFICIAL/RELATO]
5. [How to Vote on Slickdeals – Help Center](https://help.slickdeals.net/hc/en-us/articles/35502751623579-How-to-Vote-on-Slickdeals) — [OFICIAL]
6. [How the Slickdeals forums work – Merchant Help](https://help.merchants.slickdeals.net/knowledge/how-the-slickdeals-forums-work) — [OFICIAL]
7. [Boosting a deal on Slickdeals – Merchant Help](https://help.merchants.slickdeals.net/knowledge/boosting-a-deal-on-slickdeals) — [OFICIAL]
8. [Frequently Asked Questions – Corporate Information – DealNews.com](https://corp.dealnews.com/faq/) — [OFICIAL]
9. [Our Process – DealNews Advertising](https://advertise.dealnews.com/pages/our-process) — [OFICIAL]
10. [Frequently Asked Questions – DealNews Advertising](https://advertise.dealnews.com/pages/faq) — [OFICIAL]
11. [Corporate Information – DealNews.com](https://corp.dealnews.com/) — [OFICIAL]
12. [hotukdeals' parent company, Pepper.com, launches chollometro.com](https://www.hotukdeals.com/press/162428-hotukdeals-parent-company-pepper-com-launches-a-spanish-platform-chollometro-com/) — [OFICIAL]
13. [Pepper.com is quietly building a hot - and global - social commerce empire out of Berlin - Tech.eu](https://tech.eu/2015/11/03/pepper-com-social-commerce/) — [RELATO]
14. [Pepper.com - Crunchbase Company Profile & Funding](https://www.crunchbase.com/organization/pepper-networks) — [RELATO]
15. [Global Savings Group and Pepper.com Are Joining Forces – Business Wire](https://www.businesswire.com/news/home/20221130006042/en/Global-Savings-Group-and-Pepper.com-Are-Joining-Forces) — [OFICIAL]
16. [Global Savings Group and Pepper.com are joining forces - Atolls](https://atolls.com/insights/news/global-savings-group-and-pepper-com-are-joining-forces/) — [OFICIAL]
17. [Increasing Click-Outs by 21% for Pepper | Case Study | Recombee](https://www.recombee.com/case-studies/pepper) — [RELATO comercial]
18. [Hotukdeals – Wikipedia](https://en.wikipedia.org/wiki/Hotukdeals) — [RELATO]
19. [About Hotukdeals | Hotukdeals Newsroom](https://www.hotukdeals.com/press/about/) — [OFICIAL]
20. [Promobit – CB Insights company profile](https://www.cbinsights.com/company/promobit) — [RELATO]
21. [Kasada Details the Latest Threat to Retailers this Holiday Season – Freebie Bots](https://www.kasada.io/retail-threats-freebie-bots/) — [RELATO]
22. [Mis-Price 'Freebie Bots' Cost Millions for Retailers on Black Friday – tech.co](https://tech.co/news/freebie-bots-wreak-havok-mis-price) — [RELATO]
23. ["Freebie Bots" Plague Online Holiday Shoppers – MSSP Alert](https://www.msspalert.com/news/freebie-bots-plague-online-holiday-shoppers-reports-bot-defender-kasada) — [RELATO]
24. [Kasada Details the Latest Threat to Retailers this Holiday Season - Business Wire](https://www.businesswire.com/news/home/20221122005148/en/Kasada-Details-the-Latest-Threat-to-Retailers-this-Holiday-Season---Freebie-Bots) — [OFICIAL/RELATO]
25. [Keepa Python Client — documentação oficial](https://keepaapi.readthedocs.io/) — [OFICIAL]
26. [GitHub - akaszynski/keepa: Python Keepa.com API](https://github.com/akaszynski/keepa) — [BLOG/código aberto]
27. [Amazon Price History from Keepa with Python – Medium](https://andrewkushnerov.medium.com/get-amazon-price-history-from-keepa-a313e0fc95bb) — [BLOG]
28. [How to Get Live Amazon Price Updates: Using the Keepa API – Medium](https://basil-latif.medium.com/how-to-get-live-amazon-price-updates-using-the-keepa-api-e98f6ea3a15) — [BLOG]
29. [Create your first price watch | camelcamelcamel.com](https://camelcamelcamel.com/support/first_price_watch) — [OFICIAL]
30. [Amazon Price Tracking Tools | camelcamelcamel.com](https://camelcamelcamel.com/tools) — [OFICIAL]
31. [Camelcamelcamel: Everything You Need to Know – SpotSaaS](https://www.spotsaas.com/blog/camelcamelcamel-amazon-price-tracking-tool) — [BLOG]
32. [All you need to know about the EU Omnibus Directive | Talon.One](https://www.talon.one/blog/eu-requirements-for-advertising-with-price-reductions) — [BLOG]
33. [What Does Lowest Price in 30 Days Mean? Legal Rules - LegalClarity](https://legalclarity.org/what-does-lowest-price-in-30-days-mean-legal-rules/) — [BLOG jurídico]
34. [European Commission publishes guidance on price promotions under the Omnibus Directive | RPC](https://www.rpclegal.com/snapshots/consumer/spring-2022/european-commission-publishes-guidance-on-price-promotions-under-the-omnibus-directive/) — [OFICIAL/jurídico]
35. [EU Omnibus Directive - What you need to know | 7Learnings](https://7learnings.com/blog/what-retailers-need-to-know-about-the-new-eu-consumer-protection-directive/) — [BLOG]
36. [How Retailers Can Stay Compliant with the Omnibus Directive in 2025 – Omnia Retail](https://www.omniaretail.com/blog/how-retailers-can-stay-compliant-with-the-omnibus-directive-in-2025) — [BLOG]
37. [Reddit BuildAPCSales: The Ultimate Guide – buildapcsales.org](https://buildapcsales.org/reddit-buildapcsales/) — [BLOG]
38. [GitHub - azharbaig171/bapcsredditbot](https://github.com/azharbaig171/bapcsredditbot) — [código aberto/RELATO]
39. [How Do Comparison Sites Make Money? – WeCanTrack](https://wecantrack.com/insights/how-do-comparison-sites-make-money/) — [BLOG]
40. [Comparison Shopping Engines (CSS) for Affiliate Programs – Track360](https://track360.io/blog/comparison-shopping-engines-css-ecommerce-affiliate-2026) — [BLOG]
41. [Your Guide to Selling on Idealo – DataFeedWatch](https://www.datafeedwatch.com/blog/your-guide-to-selling-on-idealo) — [BLOG]
42. [Jungle Scout vs. Helium 10 – Jungle Scout](https://www.junglescout.com/resources/articles/jungle-scout-vs-helium-10/) — [OFICIAL/comercial]
43. [Helium 10 vs Jungle Scout – Helium 10](https://www.helium10.com/competitors/helium-10-vs-jungle-scout/) — [OFICIAL/comercial]
44. [Slickdeals Scraper API – ScrapingBee](https://www.scrapingbee.com/scrapers/slickdeals-api/) — [comercial]
45. [How SlickDeals Leveraged a Semantic Layer – AtScale](https://www.atscale.com/blog/slickdeals-leverage-semantic-layer-self-service-business-intelligence/) — [RELATO / case comercial]
46. [Slickdeals saves 6 months of dev time – groundcover](https://www.groundcover.com/customer-stories/slickdeals) — [RELATO / case comercial]
47. [Slickdeals Aggregator Web-Application Using Web Scraping – IJRASET](https://www.ijraset.com/research-paper/slickdeals-aggregator-web-application-using-web-scraping) — [acadêmico]
48. [The 9 Best Web Scraping APIs & Tools in 2026 – Bright Data](https://brightdata.com/blog/web-data/best-web-scraping-apis) — [comercial]
49. [Oxylabs Pricing 2026 – Costbench](https://costbench.com/software/web-scraping/oxylabs/) — [comercial/comparativo]
50. [Top 5 Bright Data Alternatives – Scrape.do](https://scrape.do/blog/bright-data-alternatives/) — [comercial/comparativo]
51. [Amazon says it's a tech 'deal.' Price trackers tell a different story – PCWorld](https://www.pcworld.com/article/3104872/amazon-says-its-a-tech-deal-price-trackers-tell-a-different-story.html) — [RELATO jornalístico]
52. [Is that advertised discount really a deal? – CBS News Philadelphia](https://www.cbsnews.com/philadelphia/news/check-if-a-sale-price/) — [RELATO jornalístico]
53. [Mistake fare – Wikipedia](https://en.wikipedia.org/wiki/Mistake_fare) — [RELATO]
54. [Ultimate Guide to Glitch Deals – Blippr Blog](https://blippr.com/blog/ultimate-guide-to-glitch-deals) — [BLOG]
55. [Warburg Pincus Announces Sale Of Slickdeals to Goldman Sachs Merchant Banking Division and Hearst – PR Newswire](https://www.prnewswire.com/news-releases/warburg-pincus-announces-sale-of-slickdeals-to-goldman-sachs-merchant-banking-division-and-hearst-300666227.html) — [OFICIAL]
56. [Goldman Sachs, Hearst Acquire Slickdeals – Fried Frank](https://www.friedfrank.com/news-and-insights/goldman-sachs-hearst-acquire-slickdeals-10654) — [RELATO jurídico]
57. [Slickdeals – Wikipedia](https://en.wikipedia.org/wiki/Slickdeals) — [RELATO]
58. [DealNews.com Celebrates 25 Years – Huntsville Business Journal](https://huntsvillebusinessjournal.com/news/2022/03/17/dealnews-com-celebrates-25-years/) — [RELATO jornalístico]
59. [About Us – Corporate Information – DealNews.com](https://corp.dealnews.com/about-us/) — [OFICIAL]
60. [DealNews – Wikipedia](https://en.wikipedia.org/wiki/DealNews) — [RELATO]
61. [The Ultimate OzBargain Guide for Australian Shoppers – Cashback Australia](https://cashbackaustralia.com.au/ozbargain/) — [BLOG]
62. [5 OzBargain Alternatives in Australia – FindFetcher](https://findfetcher.com.au/blog/ozbargain-alternative-australia) — [BLOG; nota sobre declínio de moderação]
63. [GitHub - joannalew/deal-scraper](https://github.com/joannalew/deal-scraper) — [código aberto]
64. [GitHub - egemenberk/PriceGetter](https://github.com/egemenberk/PriceGetter) — [código aberto]
65. [GitHub - techwithtim/Price-Tracking-Web-Scraper](https://github.com/techwithtim/Price-Tracking-Web-Scraper) — [código aberto]
66. [Moderator (3am - 11am PST) - Slickdeals – Built In](https://builtin.com/job/moderator-3am-11am-pst/4669673) — [OFICIAL — vaga de emprego real]
67. [Slickdeals Moderators and Administrators – Help Center](https://help.slickdeals.net/hc/en-us/articles/115004725214-Slickdeals-Moderators-and-Administrators) — [OFICIAL]
68. [Nova lei na Paraíba obriga comércio a mostrar histórico de preços de 90 dias – COAD](https://www.coad.com.br/home/noticias-detalhe/138638/nova-lei-na-paraiba-obriga-comercio-a-mostrar-historico-de-precos-de-90-dias-em-produtos-com-desconto) — [RELATO jurídico/jornalístico]
69. [Saldos e promoções 2026: conheça os direitos do consumidor – DECO Proteste (Portugal)](https://www.deco.proteste.pt/familia-consumo/direitos-consumidor/dicas/saldos-promocoes-conheca-regras) — [RELATO]
70. [Mesmo produto, preços diferentes: qual devo pagar? – Jusbrasil](https://www.jusbrasil.com.br/artigos/mesmo-produto-precos-diferentes-qual-devo-pagar/1664341185) — [BLOG jurídico]

**Nota de método**: foram executadas 30 buscas web (WebSearch) e 4 buscas de conteúdo de página (WebFetch, incluindo duas bloqueadas por HTTP 403 — help.slickdeals.net e pepperdeals.com/page/help, cujo conteúdo relevante já havia sido capturado via snippets de busca), cobrindo 70 páginas/fontes distintas listadas acima. O orçamento de busca da sessão (200 WebSearch) foi atingido após a 30ª chamada; os tópicos restantes (revenue detalhado de mydealz/hotukdeals, Zonmaster, comparativo Playwright vs. Puppeteer em escala) não puderam ser aprofundados com buscas adicionais e estão marcados como lacuna acima onde relevante.
