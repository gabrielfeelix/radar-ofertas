# De onde os concorrentes tiram cupom

A pergunta que originou esta rodada de pesquisa. Fontes completas em `bruto/03-cupons.md`, 64 numeradas.

---

## O que já se sabia, e estava certo

A anotação no `AGENTS.md` dizia: *"Eles publicam cupom com formato exato e repetido (`FULL3107`, `TODOSITE31072`, sempre com percentual, mínimo e teto), o que sugere fonte estruturada e não garimpo manual."*

A leitura estava correta. E a varredura dos 9 endpoints do ML que devolveram 404 também não foi trabalho perdido: ela eliminou a hipótese mais barata.

---

## 1. O padrão, confirmado em campo

Os agentes leram os canais concorrentes ao vivo, por `t.me/s/`, em dois dias diferentes:

| Data | Canal | Códigos observados |
|---|---|---|
| 31/07/2026 | `t.me/s/sddescontos` (SD \| CUPONS) | `FULL3107` (25% off, teto R$30, "resgate às 00h"), `DECORELETRO3107` (30%, teto R$20), `LIVROSJOGOS3107` (20%, teto R$30) |
| 01/08/2026 | `t.me/s/canaldeofertasecupons` (Ei, é Útil!) | `LOJASOFICIAIS0108` (15%, mín. R$29, teto R$20), `MODAEBELEZA0108` (20%, mín. R$49, teto R$20) |
| 01/08/2026 | `t.me/s/PromosdaMih` (Mih) | **os mesmos dois códigos, no mesmo dia, com texto quase idêntico** |

**A fórmula é `<CATEGORIA><DDMM>`.** O prefixo é o nome da categoria sem acento; o sufixo é dia e mês, sem separador. É o comportamento esperado de um gerador de campanha em lote rodando todo dia à meia-noite, criando um cupom por segmento.

Ou seja: **o cupom nasce dentro do Mercado Livre, de forma automatizada e previsível. Não é vazamento.** É público. Só que distribuído por banner e push dentro do app, não por rota JSON aberta.

**A Shopee não segue esse padrão.** Os códigos observados em `t.me/s/shopeepromocoesecuponsbr` usam leetspeak (`FL4NASH0AF`, `3XCLU51V020`, `D1AD0SP41S`, `PR3S3NT3P41S`), sem data. Isso é consistente com código customizado digitado à mão no painel de voucher, não com gerador automático. **A hipótese de "data no código" é específica do Mercado Livre.**

---

## 2. Por que os nove endpoints deram 404

Não foi erro de nome. O endpoint de cupom que existe e está documentado no ML é:

```
POST   /seller-promotions/promotions?app_version=v2
GET    /seller-promotions/promotions/{ID}?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
DELETE /seller-promotions/promotions/{ID}?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
```

E ele serve **o vendedor criando e gerenciando a própria campanha de cupom**. Campos de request: `sub_type` (`FIXED_AMOUNT` ou `FIXED_PERCENTAGE`), `start_date`, `finish_date`, `min_purchase_amount`, `budget`, `partial_coupon_code`. Resposta traz `remaining_budget`, `used_coupons`, `redeems_per_user`.

**Não existe, documentado, um GET público que devolva "todos os cupons ativos agora no MLB" para um terceiro.** A API não foi desenhada para esse consumo. Os 404 são ausência de recurso, não falta de permissão.

Detalhe útil de nomenclatura, da mesma doc: quando existe `partial_coupon_code`, *"se o nickname do vendedor for NICKNAME1234, o código do cupom será NICKN mais o código completado pelo usuário"*, com máximo de 10 caracteres.

---

## 3. A pista mais forte: cupom de afiliado é recurso oficial

Da página de ajuda do próprio ML (`mercadolivre.com.br/ajuda/35616`, "Como o Cupons de afiliados funciona"):

> "Você pode decidir que todas as pessoas que visitam o Mercado Livre usem o cupom aplicando-o no processo de compra ou na seção de cupons ou você pode digitar um código e compartilhá-lo com quem você quiser para que somente essas pessoas possam ter acesso ao desconto."

**O afiliado pode gerar o próprio cupom**, pela Central de Marketing → "Venda com afiliados". É recurso oficial do Programa de Afiliados e Criadores, com interface humana (painel web), sem API pública documentada.

Prova de que isso circula: um post no Pelando de nov/2025 mostra o cupom `VIROUDESCONTO` (10% acima de R$79, limite R$100) **marcado explicitamente como "[Afiliados]"**.

---

## 4. As duas páginas públicas do ML

- `mercadolivre.com.br/l/cupons-todos-os-dias` — landing informativa. Texto literal: *"Cupom limitado a 1 uso por CPF. Válido somente para compras feitas no app."* Instrui a baixar o app e logar.
- `mercadolivre.com.br/ofertas/cupons` — mostra cupons **já expirados** sem exigir login, sem código alfanumérico explícito (o cupom se aplica automaticamente ao navegar).

Existe conteúdo de cupom rastreável sem autenticação, mas **o código explícito com prefixo de categoria vem do fluxo autenticado**.

---

## 5. As ferramentas que vendem exatamente isso

Três produtos brasileiros vendem "descobrir cupom rápido e postar":

- **DivulgaNinja** — monitora cupons Shopee automaticamente, publica em WhatsApp e Telegram "no momento certo". A própria copy admite o problema que resolve: *"Shopee vouchers enter and exit several times per day, making it impractical to constantly refresh the Affiliate Portal or check app notifications manually."*
- **Shozap** — *"Nossa automação monitora as principais plataformas o dia inteiro"*, cobrindo Shopee, ML, Amazon, Magalu e Shein.
- **Pro Afiliados** — monitora grupos e converte link de terceiro para o seu. Menciona uso de **proxy residencial** para o ML.

**Nenhuma das três revela se usa API oficial autenticada ou scraping da interface logada.** Do lado de fora, as duas abordagens produzem o mesmo resultado observável: postagem em minutos, com texto idêntico ao do painel oficial — porque o texto vem literalmente do painel.

---

## 6. Hipóteses ordenadas, com teste

### 1ª — Robô com sessão de afiliado logada, lendo tráfego autenticado do portal ou do app

**O que sustenta:** a única API real de cupom do ML é de gestão da própria campanha; não há GET público para terceiros. As ferramentas comerciais vendem "monitoramento automático" sem revelar a técnica. O texto que aparece nos canais é o do painel.

**Teste, menos de 1 hora, e é legítimo porque é a sua própria conta:** logar no Portal do Afiliado com a conta `fega6031503`, abrir DevTools → Network, e olhar as chamadas XHR/fetch que carregam os cards de cupom. O endpoint autenticado real provavelmente aparece ali, com nome diferente dos nove testados.

**Ressalva que precisa ser dita:** descobrir o endpoint é uma coisa; **consumi-lo de forma automatizada é outra**. Os termos da API do ML proíbem literalmente *"robôs, harvesters, spiders, scraping"*, e o encerramento de acesso é discricionário e sem aviso. Achar o endpoint responde a pergunta "de onde vem"; **não autoriza o Radar a usá-lo em produção**. Essa é uma decisão sua, não minha, e cai na regra 8 do `AGENTS.md` ("pare e pergunte antes de coletar dados de um site sem confirmar que os termos permitem").

---

### 2ª — Serviço terceirizado compartilhado, servindo de back-end para vários canais

**O que sustenta:** o mesmo cupom apareceu em dois canais no mesmo dia com texto quase idêntico. Existem pelo menos três produtos comerciais vendendo esse serviço.

**Teste, menos de 1 hora:** assinar o plano de entrada de um deles e cronometrar o intervalo entre "o cupom aparece no seu feed pago" e "aparece nos canais concorrentes". Delta de segundos ou poucos minutos confirma fonte comum. Custo: R$37 a R$70.

---

### 3ª — Repost em cadeia, com um canal descobrindo e os outros copiando

**O que sustenta:** isso não é hipótese, é observação. O canal `t.me/s/chinacuponsbr` mostrou várias mensagens explicitamente marcadas **"Forwarded from"** outros canais. Parte da rede não tem fonte própria.

**Teste, 1 a 2 horas:** monitorar seis canais grandes de cupom anotando a ordem cronológica exata de cada aparição. Quem posta primeiro de forma consistente é a fonte; os demais são forward com 1 a 15 minutos de atraso.

**Este é o teste mais barato dos seis, custa zero, e responde sozinho se vale a pena perseguir os outros.**

---

### 4ª — Cupom próprio, criado pelo operador, não "descoberto" de lugar nenhum

**O que sustenta:** a doc oficial confirma que afiliado gera cupom próprio pela Central de Marketing. O achado do `VIROUDESCONTO` no Pelando mostra que esses cupons circulam depois de criados.

**Teste, minutos:** entrar na Central de Marketing → "Venda com afiliados" e ver se dá para gerar um cupom com nome customizado agora. Se der, uma fração do que se vê nos canais é autoproduzida.

**Esta hipótese é a mais interessante do ponto de vista de negócio** e é a única que não depende de descobrir nada de ninguém: se o Radar pode emitir cupom próprio, ele deixa de correr atrás do cupom alheio e passa a ter uma oferta que os outros canais não têm.

---

### 5ª — Força bruta sobre o padrão `<CATEGORIA><DDMM>`

Tecnicamente possível: a lista de categorias do ML é finita e a data é o dia corrente.

**Não recomendo, e não vou detalhar o procedimento.** Testar centenas de códigos candidatos no carrinho é abuso do sistema de cupom, é o tipo de padrão que classifica a conta como comportamento anômalo, e a conta de afiliado é o ativo que a Fase 0 inteira existe para proteger. O ganho marginal sobre a hipótese 1 é pequeno; o risco não é.

Registro aqui porque a pesquisa a encontrou e porque saber que o padrão *é* adivinhável explica por que ele é previsível — não como convite.

---

### 6ª — API de cupom de rede de afiliados tradicional (Rakuten, Awin, Lomadee, Admitad)

**O que sustenta:** a Rakuten documenta publicamente uma **Coupon Feed API** para publishers aprovados. Existe, em tese.

**Por que é pouco provável:** nenhum dos cinco marketplaces relevantes (ML, Shopee, Amazon, Magalu, AliExpress) roda o programa de afiliados principal por essas redes no Brasil. Cada um tem programa direto.

**Teste, menos de 1 hora:** criar conta gratuita de publisher na Awin e na Lomadee e buscar "Mercado Livre" e "Shopee" na lista de anunciantes. Se não aparecerem como advertiser ativo, a hipótese cai.

---

## 7. O atalho do `AGENTS.md` precisa de ressalva

A anotação atual diz: *"Atalho que já funciona hoje, e é o mais barato: os cupons aparecem nos canais que a colheita já lê. Extrair código de cupom do texto colhido é trabalho de regex, não de credencial."*

Tecnicamente continua verdade. **Mas a pesquisa achou duas coisas que mudam o cálculo:**

**Primeiro, a Shopee proíbe.** Texto literal do termo do Programa de Afiliados: *"A divulgação ou compartilhamento de cupons nominais de afiliados terceiros pelo Afiliado será considerada violação."* A rescisão pode ser imediata e sem aviso, com retenção de comissão já ganha. **Para a Shopee, o atalho não é barato: é risco de perder a conta.** O ML não tem cláusula equivalente encontrada, o que não é o mesmo que permissão explícita.

**Segundo, o atalho põe o Radar sempre um passo atrás.** Extrair de canal alheio funciona, mas por definição só chega depois de quem tem a fonte primária.

E há armadilhas operacionais que a pesquisa listou, todas com consequência de reclamação de seguidor:

- **Cupom por CPF:** *"limitado a 1 uso por CPF"*, texto oficial. O cupom pode estar esgotado para a cota de quem clicou, mesmo válido no texto.
- **Orçamento finito:** a doc mostra `remaining_budget` e `used_coupons`. Quando o lote acaba, o código passa a dar "atingiu o limite" mesmo sendo real.
- **Restrição de categoria:** `MODAEBELEZA0108` só funciona em Moda e Beleza. Aplicado fora, falha.
- **Cupom atrelado a campanha de outro afiliado:** pode funcionar para o comprador e não creditar a comissão pretendida.

**Recomendação:** se o atalho for adiante, que seja **por marketplace**, com a Shopee explicitamente de fora, e que a mensagem nunca prometa que o cupom vai funcionar — no máximo que ele foi visto ativo em tal horário. Isso é a mesma disciplina da regra 3.4 aplicada a cupom.

---

## 8. O caminho que eu recomendaria

Na ordem, e cabe numa tarde:

1. **Rodar o teste da 3ª hipótese** (monitorar seis canais por duas horas, anotar quem posta primeiro). Custo zero, e ele sozinho diz se existe uma fonte primária única a perseguir.
2. **Rodar o teste da 4ª** (ver se a Central de Marketing emite cupom próprio agora). Minutos, e é a hipótese que vira vantagem em vez de cópia.
3. **Rodar o teste da 1ª** (DevTools no portal logado), sabendo que o resultado responde "de onde vem" e **não** autoriza consumo automatizado sem uma decisão sua sobre os termos.
4. Deixar a 2ª e a 6ª para depois, e a 5ª fora.
