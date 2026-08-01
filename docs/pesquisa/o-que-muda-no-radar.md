# O que esta pesquisa cobra do Radar de Ofertas

Leitura da rodada de 01/08/2026 contra o estado atual do projeto. Nada aqui foi implementado — é diagnóstico e proposta.

Cada item diz de que fase é. **Não construí nada de fase futura, e não recomendo que se construa.**

---

## Parte 1 — O que a pesquisa validou

Coisas que o projeto já decidiu e que agora têm lastro externo. Nenhuma ação necessária, só confiança maior.

| Decisão do projeto | O que a pesquisa achou |
|---|---|
| **Regra 3.2** — nunca automatizar WhatsApp | Issue #1869 do Baileys, 05/10/2025: 5 bots e ~45 grupos banidos em uma semana, **incluindo contas limpas há mais de 3 anos**. Cinco gatilhos oficiais de ban da Meta, todos "automáticos e sem aviso prévio". 3 em cada 4 bloqueios vêm de automação sem opt-in |
| **Regra 3.3** — link de imagem por 24h, nunca o arquivo | Conferi na fonte, texto pt-BR completo: *"Você não irá armazenar nem armazenar em cache o Conteúdo de Anúncio de Produtos que consista em uma imagem, **mas você poderá salvar um link** para o Conteúdo de Anúncio de Produtos que consista em uma imagem por até 24 horas."* Está exatamente certo |
| **Regra 3.4** — não afirmar menor preço histórico sem lastro | CDC art. 37 enquadra preço fantasma como publicidade enganosa comissiva. E a UE já tem a regra dos 30 dias com multa de até 4% do faturamento |
| **Regra 3.10** — publicidade identificada, `#ad` não conta | CONAR: aceitas são `#publicidade`, `#anúncio`, `#patrocinado`, `#conteúdoPago`, `#parceriaPaga`; **insuficientes** são `#ad`, `#adv`, `#ambassador`, `#parceiro`, `#colab`. Exigência de *"forma clara e diretamente na primeira tela"*, sem clique |
| **A aposta central no histórico de preço** | Nenhum agregador internacional grande resolve desconto falso por algoritmo. Slickdeals e DealNews usam editor humano; o resto empurra para o usuário conferir Keepa. **E o CamelCamelCamel não cobre a Amazon Brasil.** Não existe Keepa brasileiro |
| **D-010** — API oficial é trabalho de Fase 1, não luxo | Confirmada por eliminação: os termos do ML proíbem scraping com essa palavra, e o robots.txt dá `Disallow: /` nominal para bots de raspagem |
| **`lib/variedade.ts`** | Repetir a mesma categoria em sequência aparece como ponto de ruptura específico, separado do volume total |
| **Canal preferido a grupo** (parte da D-031) | Em grupo há exposição recíproca de nome e telefone entre membros; em canal não. Ganha um argumento de LGPD além dos que já existiam |

---

## Parte 2 — O que a pesquisa contradiz

Aqui o projeto precisa decidir alguma coisa.

### 2.1 Os horários estão em conflito, e nenhum dos dois lados tem estudo primário

`lib/horarios.ts` usa **07–09, 12–13 e 19–22**, com um comentário forte dizendo que as 18h são "provavelmente o pior horário do dia útil".

Esta rodada consolidou **8h–11h e 17h–20h**, com terça a quinta convertendo melhor que segunda e sexta.

O conflito é real: **as 17h–18h que o código chama de pior horário são, na fonte nova, metade do segundo pico.**

Mas seja honesto sobre a qualidade das duas fontes: **nenhuma das duas é estudo primário.** A frente 05 registrou explicitamente que *"não foi encontrado nenhum estudo primário nomeado (tipo pesquisa de universidade ou relatório oficial da Meta) sobre horário de pico no Brasil — todas as fontes são blogs de agências/ferramentas de disparo"*. A pesquisa de 28/07 provavelmente tinha a mesma limitação.

**Não mudei o arquivo.** Trocar um consenso de blog por outro consenso de blog não é progresso. Três caminhos, e a escolha é sua:

1. **Não mexer** até haver dado próprio. Defensável, e é o que eu faria.
2. **Alargar a janela da noite** para 17–22, que é a interseção honesta dos dois consensos, e cobre os dois sem apostar em nenhum.
3. **Medir.** Quando houver publicação de verdade em volume, o clique por horário responde isso melhor que qualquer blog. Isso é Fase 2.

O que **não** é conflito e vale registrar: o dia da semana. Terça a quinta converte melhor. `lib/horarios.ts` não tem nenhuma noção de dia da semana. Adicionar isso é barato e não contradiz nada.

### 2.2 O atalho de cupom por regex tem uma proibição em cima

O `AGENTS.md` registra como "atalho mais barato" extrair cupom por regex do texto colhido de canais alheios.

Termo do Programa de Afiliados da Shopee, literal: *"Os cupons nominais fornecidos aos Afiliados são exclusivos para compartilhamento do Afiliado com seus seguidores. A divulgação ou compartilhamento de cupons nominais de afiliados terceiros pelo Afiliado será considerada violação."*

A Shopee pode rescindir *"imediatamente e sem qualquer aviso prévio"* e **reter comissão já ganha**.

**Proposta:** o atalho não morre, mas deixa de ser genérico. Vira por marketplace, com a Shopee explicitamente de fora. E a mensagem nunca promete que o cupom funciona — no máximo que ele foi visto ativo em tal horário, que é a regra 3.4 aplicada a cupom. Detalhe das armadilhas (uso por CPF, orçamento finito, restrição de categoria) em `cupons-de-onde-vem.md` §7.

### 2.3 O Promobit não é da Pepper

Foi comprado pela **Méliuz em 13/05/2021, por R$ 13 milhões**. A joint-venture da Pepper no Brasil é o **Pelando**, também com a Méliuz. São dois ativos de origens diferentes.

Se `docs/mercado.md` afirmar o contrário, é correção de uma linha. Não fui conferir nem mexer, porque a instrução foi criar documentação nova sem tocar na existente.

---

## Parte 3 — O que vira trabalho, por fase

### Fase 1 (agora)

**3.1 — Webhook de preço do Mercado Livre.** [ALTO VALOR]

O ML tem notificação no tópico `items_prices`, que dispara quando o preço de um item muda. Também há `GET /items/{ID}/prices` (todos os preços válidos, com datas e canais) e `GET /items/{ID}/sale_price` (preço vencedor por canal e nível de fidelidade).

Hoje o coletor faz varredura. Webhook troca "eu pergunto de hora em hora" por "eles me avisam". Isso ataca diretamente o gargalo da Fase 1, que é encher a série depressa o bastante para sustentar 30 ofertas por dia, e reduz consumo de cota.

**Precisa da credencial do ML**, que está a um `ML_REFRESH_TOKEN` de distância. Depende também de ter endpoint público para receber a notificação — a Edge Function do Supabase serve.

**3.2 — A PA-API 5 da Amazon está descontinuada.** [RISCO CONHECIDO]

Conferido por mim na fonte oficial: *"PA-API 5 is no longer the recommended way to access Amazon's product catalog"*, a **Creators API** é a sucessora suportada, e aplicações que continuarem chamando a PA-API 5 recebem `HTTP 403 AccessDeniedException`. **A página não publica data exata.**

A fonte Amazon do coletor precisa nascer já apontando para a Creators API, não para a PA-API 5. Se algum código ou documento do projeto assume PA-API 5, isso é dívida com prazo desconhecido.

Some-se a isso o limite de entrada: **1 TPS e 8.640 requisições/dia** nos primeiros 30 dias, crescendo com a receita. São ~6 chamadas por minuto. **Obriga priorizar quais ASINs monitorar** — não dá para varrer catálogo.

**3.3 — Nicho: o desperdício continua sendo o maior problema, e a pesquisa concorda.**

O `AGENTS.md` já reconhece: numa rodada, 43 ofertas viraram 1 publicação e 24 foram reprovadas por `nenhum_canal_do_nicho`.

A pesquisa diz que **canal segmentado converte 4 a 6%, quase o dobro do genérico**, e que operações reais rodam 8 grupos por categoria. Ou seja: as 24 reprovadas não são defeito de código, são receita parada, e abrir canal por nicho é o movimento validado, não um remendo.

Isso não é trabalho de código de Fase 1 — é trabalho de audiência, que é Fase 2. Mas muda a leitura da métrica: **não trate `nenhum_canal_do_nicho` como problema de curadoria.**

**3.4 — Comportas por marketplace, por causa da janela de cookie.**

| Programa | Janela |
|---|---|
| Mercado Livre | ~30 dias (não oficial) |
| Shopee | 7 dias (oficial) |
| AliExpress | 3 dias |
| **Amazon** | **24 horas** (oficial) |

A mesma publicação vale coisas muito diferentes dependendo da loja. Uma oferta de Amazon precisa converter no mesmo dia; uma de ML tem um mês.

Isso é insumo para a nota da oferta, e a nota mora em `avalia_anuncios`. **Não estou propondo mexer agora** — a nota ainda não foi calibrada com dado real, e mudar a fórmula antes disso é adivinhação. Fica registrado para quando a Fase 2 calibrar.

### Fase 2 (não construir agora)

**3.5 — O `ascsubtag` da Amazon fecha uma porta, e isso é decisão de arquitetura.** [IMPORTANTE]

A regra 3.6 do projeto diz que toda publicação gera um subid único. Na Amazon isso esbarra em duas coisas:

- O `ascsubtag`, que seria o subid dinâmico, é **de acesso restrito** e raramente concedido.
- O termo oficial proíbe: *"você não poderá dinamicamente atribuir sub-tags aos usuários na medida em que eles entrarem em seu site"*.
- O que sobra são **até 100 Tracking IDs**, que é granularidade de **canal**, não de publicação.

Shopee tem `sub_id1` a `sub_id5`, e é o mais robusto dos três. ML tem etiqueta de um nível.

**A consequência é que a granularidade do subid provavelmente não pode ser uniforme entre marketplaces.** Ou o modelo aceita granularidade por canal na Amazon e por publicação nos outros, ou padroniza por baixo. Isso é exatamente a decisão que a Fase 0 existe para fechar, e agora ela tem um dado a mais.

**3.6 — O redirecionador precisa servir Open Graph.**

Documentação oficial da Meta: o preview de link no WhatsApp exige `og:title` (negrito, até 2 linhas), `og:description` (até ~80 caracteres), `og:url` **sem parâmetros de tracking ou sessão**, e `og:image` de no mínimo 300px, proporção 4:1 ou menor, abaixo de 600KB. O crawler faz GET normal com User-Agent identificável e usa o `Accept-Language` do destinatário. O preview leva ~10s para ser gerado ao compor a mensagem.

Sem isso, a mensagem sai sem imagem. E há um detalhe fino: **`og:url` sem parâmetro de tracking** conflita com um redirecionador cujo caminho inteiro é carregar o subid. A solução é o `og:url` ser a URL canônica do produto e o subid viver no caminho do redirecionador, não em query string do OG.

Também: **no WhatsApp o link vai no fim da mensagem por padrão** quando há preview, e a URL é minimizada visualmente. Isso importa para o template.

**3.7 — Limites do Telegram viram regra de código quando o bot entrar.**

1 msg/s por chat, 20 msg/min por grupo, ~30 msg/s em broadcast, `429` com `retry_after`. A orientação oficial é **tratar o 429 quando ele vier, não fazer throttle preventivo**. Ignorar o `retry_after` aumenta o cooldown progressivamente, mas o bot nunca é banido permanentemente só por isso.

Volume não derruba canal no Telegram. O que derruba é violar ToS, e a moderação é por denúncia com revisão humana.

**3.8 — Lista de transmissão é uma quarta superfície, e converte melhor.**

Lista de WhatsApp converte **3 a 5 vezes mais que grupo**, porque chega individualizada. A D-031 discutiu grupo contra Canal e não considerou lista.

Ressalvas que precisam entrar na decisão: a lista do WhatsApp Business App só entrega para **quem tem seu número salvo na agenda**, e o teto é de 256 contatos por envio. É uma superfície de conversão alta e alcance baixo — provavelmente para o núcleo engajado, não para escala.

**3.9 — Teto diário protege mais que curadoria fina.** [MUDANÇA DE PRIORIDADE]

O achado mais contraintuitivo da rodada: os três motivos de saída de membro, em ordem, são **excesso de notificação, entrada não consentida e suspeita de golpe**. Nenhuma fonte apontou qualidade da oferta.

O projeto já tem `canal.teto_diario`. A implicação é de prioridade, não de código: **quando houver escolha entre afinar a nota e ajustar o teto, o teto rende mais.**

Referência de faixa para calibrar: grupo de WhatsApp aguenta 4 a 8/dia (30+ mata em uma semana); canal de Telegram com curadoria, 1 a 3 recomendado e 10 a 30 tolerado.

E o mix que aparece como sustentável: **60% baixo ticket, 25% premium, 10% relâmpago, 5% não-comercial**. Os 5% não-comerciais são o item que o Radar hoje não tem como produzir — vale saber que existe antes de decidir que o canal só publica oferta.

### Fase 3 e adiante

**3.10 — O CNAE do afiliado não cabe no MEI.**

O CNAE mais adequado (**7490-1/04**, intermediação e agenciamento de serviços e negócios em geral) está fora da lista permitida ao MEI. Alternativas citadas (7319-0/02 promoção de vendas, 6319-4/00 portais, 7319-0/03 marketing direto) divergem entre fontes.

Isso confirma a pendência da D-011: **contador antes da Fase 3**, que é quando o sistema repassa dinheiro a terceiro.

---

## Parte 4 — Calibragem de expectativa

Para o `docs/roadmap.md` da Fase 2, que hoje projeta R$800/mês em 90 dias e R$5–15 mil/mês em 12 meses.

Esses números são **compatíveis com a faixa de vitrine dos vendedores de ferramenta**, não com o único relato de campo auditável que a pesquisa achou:

| Fonte | Números | Selo |
|---|---|---|
| Vendedores de ferramenta, tabela por tamanho | R$500 a R$15.000+/mês | `[VENDEDOR]` |
| Devzapp, 100 membros | R$100 a R$300/mês | `[RELATO indireto]` |
| Devzapp, 300+ membros com frequência | R$1.000+/30 dias | `[RELATO indireto]` |
| **Filipe Souza**, ~250 membros, Amazon, WhatsApp | **R$8.060 em 7 meses**, com pico de R$2.923 em um mês e queda para R$1.000 em outro | `[RELATO]`, único datado |
| BlackHatWorld | "From 0 to 1k/month" é o marco que se documenta | `[DISCUSSÃO]` |

**Não estou dizendo que a projeção do roadmap está errada.** Estou dizendo que ela está no teto da faixa, e que o piso realista para um canal de 50 a 100 conhecidos (que é o desenho da Fase 2) fica mais perto de **R$100 a R$300/mês** do que de R$800.

Sugestão: manter o número do roadmap como cenário otimista e acrescentar o piso ao lado. Frustração calibrada não faz ninguém desistir; frustração descalibrada faz.

Um detalhe do mesmo relato que vale mais que o número: **ele operou de forma inconsistente em parte do período e disse que isso derrubou o resultado.** Receita de afiliado não é passiva. É exatamente o risco que o roadmap da Fase 3 já nomeia como churn de operador.

---

## Parte 5 — O que eu recomendaria fazer, em ordem

1. **Os testes de cupom** de `cupons-de-onde-vem.md` §8. Os dois primeiros custam zero e uma tarde, e um deles (cupom próprio pela Central de Marketing) pode virar vantagem em vez de cópia.
2. **Fechar o `ML_REFRESH_TOKEN`**, que já era a primeira coisa da fila, e agora destrava também o webhook `items_prices` do item 3.1.
3. **Decidir o horário** (item 2.1): não mexer, alargar, ou medir depois. Precisa de você.
4. **Anotar o `ascsubtag`** (item 3.5) junto da decisão de granularidade de subid da Fase 0. É a única coisa desta pesquisa que muda arquitetura.
5. **Ressalvar o atalho de cupom** (item 2.2) no `AGENTS.md`, com a Shopee de fora.
6. **Corrigir Promobit/Méliuz** em `docs/mercado.md`, se estiver errado lá.

E uma segunda rodada de pesquisa, se valer a pena, deveria mirar só as quatro lacunas que importam: comissão de Netshoes/Centauro/Kabum, mudanças de regra de 2025–2026 no ML e na Shopee, taxa de anulação de comissão, e o comportamento de deep link app contra navegador no ML e na Shopee.
