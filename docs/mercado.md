# Como o mercado de grupos de oferta funciona de verdade

Pesquisa feita em 27/07/2026, a partir de ferramentas vendidas no mercado, código aberto de bots reais e material das plataformas. Serve para responder duas perguntas: **o que os concorrentes realmente fazem por baixo do capô**, e **onde eles ganham dinheiro**.

Leia junto com `docs/negocio.md`. Onde os dois divergirem, esta pesquisa é mais recente.

**Aviso sobre as fontes:** boa parte do material disponível é conteúdo de venda — blog de ferramenta que quer vender assinatura. Números de faturamento e de engajamento vindos dessas fontes estão marcados como não verificados ao longo do texto. O que é verificável — código aberto e documentação de plataforma — está separado do que é alegação.

---

## 1. O mercado é saturado, mas saturado por baixo

Sim, tem muita gente fazendo. Mas quando se olha o que essas operações fazem tecnicamente, o padrão dominante é bem mais raso do que parece de fora.

O desenho mais comum, encontrado em vários projetos abertos:

1. O bot **monitora grupos de Telegram de outras pessoas** em tempo real
2. Pega a oferta que alguém já publicou
3. **Troca o link de afiliado pelo próprio**
4. Reenvia para os próprios canais de Telegram e WhatsApp

Não há coleta de preço. Não há curadoria. A "inteligência" é filtro por palavra-chave.

O caso mais explícito é o [BlueBot](https://github.com/SaulloGabryel/BlueBot), cujo README descreve exatamente isso: monitoramento de grupos do Telegram por polling, filtro de mensagem por regra, troca do link de afiliado e reenvio. Nenhuma menção a histórico de preço ou validação de desconto.

**A implicação é grande.** A maior parte dos "concorrentes" não compete em curadoria porque não faz curadoria. Eles são canos de distribuição de oferta alheia. Quando alguém na ponta da cadeia publica uma promoção falsa, ela se propaga por dezenas de grupos em minutos, com o link de afiliado trocado a cada salto.

---

## 2. O que eles usam por baixo

### Extração de preço e produto

Predominantemente **raspagem de página**, com Selenium. Vários projetos abertos automatizam o navegador para abrir a página do produto, e em alguns casos o próprio gerador de link de afiliado do site — há projeto que clica no botão "gerar link" e lê a área de transferência do sistema para pegar o resultado.

É frágil e quebra a cada mudança de layout. É também o que a maioria faz, porque não exige aprovação de ninguém.

### Envio no WhatsApp

**Automação não oficial, via `whatsapp-web.js` com autenticação por QR Code.** É o padrão de mercado e é o que derruba número.

O material das próprias empresas de disparo é direto sobre isso: essas ferramentas simulam ações humanas no WhatsApp Web, os sistemas antifraude da Meta detectam o padrão, e o banimento é questão de tempo, não de "se".

### Envio no Telegram

**API oficial de bots.** Aqui todo mundo está nos trilhos, porque o Telegram permite e é fácil. Não há tensão entre o que é permitido e o que é prático.

### Volume

O material de venda recomenda **15 a 30 ofertas por dia** para um canal, e afirma que com automação se chega a **50 a 100 por dia**.

Esse número responde a pergunta "como eles mandam tanto": eles mandam tanto **porque não curam**. Repassar oferta alheia não tem custo marginal. Selecionar tem.

---

## 3. Quem faz certo, e como ganha dinheiro

O contraste está em Promobit e Pelando, que não são grupos — são plataformas.

O Promobit descreve o próprio modelo assim: mais de 95% das ofertas vêm dos usuários, e a equipe avalia cada uma para conferir que o preço é o menor de verdade. **Se o produto esteve mais barato no último mês, a oferta não é publicada.** Volume na casa de 300 ofertas por dia. A receita vem de comissão das lojas, na faixa de 3% a 20%, mais ações patrocinadas.

Ou seja: **a validação por histórico de preço é exatamente o que separa quem é referência de quem é cano.** E os operadores de grupo, que são a concorrência direta deste projeto, estão do lado do cano.

Isso confirma a tese central do projeto. Também mostra que ela não é original — só é rara na faixa em que vamos operar.

---

## 4. Onde o dinheiro realmente está: vender a ferramenta

As ferramentas de automação para afiliado são um mercado por si só, e mais previsível que operar grupo.

O [Divulgador Inteligente](https://www.divulgadorinteligente.com/) vende assinatura escalonada **por número de lojas**: 10 lojas no plano de entrada, 16 no intermediário, 121 no topo. Automação de grupo de WhatsApp é vendida como adicional pago à parte. IA Divulgadora, do mesmo mercado, anuncia planos a partir de R$ 69,90 por mês.

Repare no "121 lojas". Ninguém integra 121 APIs. Isso é **rede de afiliados** — Lomadee, Awin, Afilio — que dá catálogo de produto e gerador de link de várias lojas por uma credencial só. Uma das ferramentas inclusive lista "Afilio" como se fosse loja, o que entrega a estrutura.

**Alegações de faturamento não verificadas:** esse mesmo material afirma que afiliados faturam de R$ 2 mil a R$ 15 mil por mês, e que quem automatiza ganha de 5 a 10 vezes mais. É material de venda de assinatura. Não há fonte independente. Trate como propaganda até ver número próprio.

---

## 5. Telegram ou WhatsApp

**WhatsApp** — 98% de penetração no Brasil. É onde a audiência já está, e onde o custo de trazer alguém é menor porque não exige instalar nada.

**Telegram** — 63% de penetração. Escala melhor, aceita bot oficial, e o público que está lá tende a ser mais engajado por haver menos ruído.

Circula um número de 80% de engajamento no WhatsApp contra 20% no Telegram. **Vem de blog de fornecedor, sem metodologia, e não deve ser levado a sério como medida.** A direção é plausível; a magnitude, não.

Conclusão prática: os dois, com papéis diferentes. Telegram é onde o sistema publica sozinho, sem custo humano. WhatsApp é onde está o volume de gente, com envio manual.

---

## 6. A descoberta que muda o nosso desenho: Canal, não grupo

O plano original falava em **grupo** de WhatsApp. O certo é **Canal**.

| | Grupo | Canal |
|---|---|---|
| Limite de membros | 1.024 | **Sem limite** |
| Quem publica | Todos | Só o administrador |
| Telefone dos membros | **Visível para todos** | Invisível |
| Ruído | Alto | Nenhum |

Três motivos, em ordem de importância:

1. **O limite de 1.024 é um teto de receita.** Grupo cheio obriga a criar um segundo grupo, e a partir daí toda publicação é feita duas vezes, à mão.
2. **Canal não expõe telefone de ninguém.** Em grupo, o telefone de cada membro fica visível para todos os outros — o que é risco de LGPD e desconforto real para quem entra.
3. **Canal é unidirecional.** Ninguém responde "alguém já comprou?" às 7 da manhã, e o operador não vira moderador.

O que se perde: a conversa entre membros, que em grupo de oferta costuma ser mais ruído do que comunidade.

Canal não tem API de publicação — se publica pelo aplicativo, à mão. Isso **não muda nada para nós**, porque a decisão D-002 já era envio manual no WhatsApp.

### O que isso não resolve

A API oficial do WhatsApp Business **não publica em grupo**. Existe uma Groups API restrita, desenhada para casos pequenos e controlados, na casa de poucos participantes — não é canal de transmissão. Listas de transmissão exigem que o destinatário tenha seu número salvo na agenda.

Ou seja: **não existe caminho oficial e automatizado para distribuição em massa no WhatsApp.** Quem promete isso está usando automação não oficial. A escolha por envio manual não é conservadorismo — é a única via legítima que existe.

---

## 7. Vias oficiais que a maioria não usa

Aqui está a vantagem prática, porque exige paciência e a maioria não tem.

### Shopee — API de afiliado aberta e documentada

A Shopee tem **Open API de afiliado** com explorador público de GraphQL. As operações relevantes são `productOfferV2`, para dados de oferta, e `generateShortLink`, para link rastreável. A autenticação é por assinatura HMAC-SHA256 por requisição.

Isso é melhor do que se supunha ao escrever a D-010: a Shopee resolve **dados de produto e geração de link na mesma credencial**, oficialmente. Pode ser a primeira integração, à frente do Mercado Livre.

- Explorador: <https://open-api.affiliate.shopee.com.br/explorer/v2>

### Mercado Livre — API de afiliado existe, com porteiro

Há API oficial para gerar link de afiliado programaticamente. O material disponível indica que ela é destinada a quem já tem volume — a referência que aparece é a partir de 500 cliques por dia — o que sugere liberação sob análise, não cadastro automático.

Enquanto o acesso não sai, a API pública de itens (`/items/MLB...`, já implementada em `supabase/functions/_compartilhado/fontes/mercado-livre.ts`) resolve o preço, e o link de afiliado sai do gerador manual.

### Redes de afiliados — a via para escalar loja

Lomadee, Awin e Afilio dão catálogo e geração de link para muitas lojas com uma credencial. Comissões citadas: Lomadee de 1% a 15%, com pagamento em até 60 dias; Awin de 1% a 50%, com pagamento em até 90 dias.

**É por aqui que se sai do problema de "não posso raspar página".** Feed de produto de rede de afiliados é dado que a rede fornece para exatamente este uso. Não é área cinzenta.

---

## 8. O que isso significa para este projeto

**Confirmado:**

- A validação por histórico de preço é o diferencial real, e quase ninguém na nossa faixa faz. Quem faz virou Promobit.
- A recusa a automatizar o WhatsApp está certa, e agora por evidência: é o vetor de banimento número um, e não existe alternativa oficial para grupo.
- Vender a ferramenta é mercado de verdade, com preço estabelecido entre R$ 70 e algumas centenas por mês.

**A corrigir:**

- Passar de **grupo** para **canal** no WhatsApp. Some o teto de 1.024 e some a exposição de telefone.
- Reavaliar a ordem das integrações: a **Shopee** tem API de afiliado aberta e documentada, e pode vir antes do Mercado Livre.
- **Rede de afiliados** é caminho legítimo para catálogo de produto, e destrava a pendência de extração sem depender de raspagem.

**A vigiar:**

- Volume de 5 a 10 ofertas curadas por dia contra 50 a 100 repassadas dos concorrentes. Somos outro produto, e isso precisa ficar explícito para o membro — senão ele compara pelo número e acha que o canal está parado.
- Repasse de oferta alheia é grátis e imediato. Nossa curadoria custa três semanas de coleta antes da primeira publicação. Essa diferença de arranque é o risco real de execução.

---

## Fontes

- [BlueBot — bot que monitora grupos e troca o link de afiliado](https://github.com/SaulloGabryel/BlueBot)
- [Bot-Afiliado-Telegram — geração de link por Selenium](https://github.com/murilo813/Bot-Afiliado-Telegram)
- [Divulgador Inteligente — planos por número de lojas](https://www.divulgadorinteligente.com/)
- [O que é Promobit — curadoria e recusa de oferta falsa](https://www.promobit.com.br/o-que-e-promobit/)
- [Promobit no Projeto Draft — comissão de 3% a 20%](https://www.projetodraft.com/a-promobit-e-uma-rede-social-de-ofertas-e-cupons-de-descontos/)
- [API oficial do WhatsApp para grupos: o que é suportado](https://chatsac.com/blog/api-oficial-whatsapp-grupos/)
- [WhatsApp Business API e grupos: limitações e alternativas](https://sleekflow.io/en-us/blog/whatsapp-broadcast-vs-group)
- [Canais do WhatsApp como afiliado](https://www.hostgator.com.br/blog/canais-whatsapp/)
- [Grupo ou Canal do WhatsApp para achadinhos](https://espelhagrupos.com.br/blog/grupo-ou-canal-whatsapp-achadinhos)
- [Disparo em massa sem banir — por que a automação não oficial cai](https://www.socialhub.pro/blog/disparo-em-massa-whatsapp-sem-banir/)
- [Banimento do WhatsApp Business: causas](https://www.socialhub.pro/blog/banimento-whatsapp-business-causas-prevencao/)
- [Shopee Affiliate Open API Explorer](https://open-api.affiliate.shopee.com.br/explorer/v2)
- [SDK aberto da API de afiliado da Shopee](https://github.com/gregojoao/shopee-affiliate)
- [API de afiliados do Mercado Livre](https://afiliadomarketplace.com.br/api-completa-para-gerar-links-de-afiliados-no-mercado-livre/)
- [Redes de afiliados no Brasil — comissões e prazos](https://sendpulse.com/br/blog/quais-os-melhores-programas-de-afiliados-do-brasil)
- [Volume recomendado por canal de ofertas](https://fluxopromo.com/blog/como-criar-canal-ofertas-telegram)
- [Telegram e WhatsApp para afiliados — penetração e engajamento](https://www.socialhub.pro/blog/whatsapp-vs-telegram-empresa-2026/)
