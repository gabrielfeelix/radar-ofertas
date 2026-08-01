# Otimização do radar — diagnóstico e plano

**Escrito em 01/08/2026**, depois da primeira madrugada de operação automática.
**Executado no mesmo dia, as cinco frentes.** O que cada uma virou está
na seção 6, no fim, junto com o que foi medido e o que ficou aberto.

O pedido do dono foi direto: *"consegui categorizar certo, consegui
encontrar bastante produto, consegui ter uma boa periodicidade de
postagem, consegui ter um texto legal, quero que a gente consiga
otimizar esse processo"*. Este documento é o apanhado: o que deu errado
na primeira noite, o que a pesquisa achou, e em que ordem consertar.

Tudo aqui é trabalho de **Fase 1** (radar silencioso e motor de
curadoria). Nada antecipa fase futura.

---

## 1. O que aconteceu na primeira madrugada

O dono acordou esperando ver vários produtos no canal. Viu **um**, às
9h, e era um **whey protein** num canal de pet.

Os três posts que existem, na ordem:

| Quando | O quê | Problema |
|---|---|---|
| 01/08 01:00 | Mangueira de jardim 20m | não é pet |
| 01/08 01:50 | Ração Golden Gatos 10kg | correto |
| 01/08 09:03 | Whey Carnibol proteína da carne | não é pet |

Dois de três fora do nicho. E **um só a noite inteira**, quando o
intervalo de madrugada permitiria quatro.

Não é um defeito. São quatro, e eles se somam.

### Defeito 1 · O canal aceita os três nichos

`Radar Pet` está inscrito em `pet`, `casa` **e** `eletronico`. O laço
faz exatamente o que foi mandado: qualquer oferta de qualquer nicho é
elegível para ele.

Isso é configuração, não código. **É a correção mais barata do
documento** e sozinha já teria evitado dois dos três posts errados.

### Defeito 2 · O nicho vem de quem achou, não do que é

Em `scripts/coleta-mercado-livre.mjs`, o nicho do produto é decidido
por **qual lista de termos o encontrou**. Se `products/search?q=racao
gato` devolveu algo, esse algo vira pet. Ponto.

E `products/search` é busca por texto, com casamento frouxo. O
resultado está no banco, e é ruim:

```
Samsung Galaxy Buds Core           ← no nicho pet
Papel Fotográfico Adesivo A4       ← no nicho pet
Tanquinho Colormaq 15kg            ← no nicho pet
Fita Dupla Face 3m                 ← no nicho pet
Whey Carnibol proteína da carne    ← no nicho eletrônico
```

482 produtos, e uma fatia que ninguém sabe medir está no nicho errado.

**A API já resolve isso e a gente joga fora.** A chamada
`products/{id}`, que o coletor **já faz**, devolve `domain_id`:

```
MLB11665856 → MLB-CAT_AND_DOG_FOODS   (Ração Golden Gatos)
MLB50008608 → MLB-SUPPLEMENTS         (Whey Carnibol)
```

Conferido hoje, contra a API de produção. O Mercado Livre classificou
o whey como suplemento e a ração como alimento de cão e gato. O dado
existe, chega junto, e é descartado.

### Defeito 3 · A base cresceu, a detecção não

394 anúncios viraram 499, e o número de ofertas detectadas desde
sempre é **6**. A conta é simples: a queda é medida contra a **nossa
leitura anterior**, então cada anúncio novo precisa de duas leituras
antes de poder gerar oferta, e a maioria dos preços não mexe entre uma
hora e a seguinte.

Aumentar a base ajuda, e o commit de ontem estava certo. Mas ela cresce
devagar e a detecção continua dependendo só do nosso histórico.

**E aqui a API entrega de novo.** A mesma resposta de
`products/{id}/items` que o coletor já lê traz `original_price` e
`deal_ids`:

```
MLB6156919544   price 160,90   original_price 278,85   → 42% declarado
```

Ou seja: existe um sinal de desconto **hoje**, sem esperar duas
leituras, sem histórico nenhum. Está sendo descartado.

**Com uma ressalva que não pode ser esquecida:** o `original_price` do
Mercado Livre é frequentemente inflado, e é exatamente a mentira que a
**regra 3.4** proíbe repetir. Ele serve para **achar candidato**, nunca
para virar o "de" da mensagem. O lastro continua saindo da nossa série.

### Defeito 4 · A madrugada não roda

`coleta-horaria.yml` tem `cron: "0 11-23,0-2 * * *"`, que em São Paulo
cobre das 8h às 23h. O comentário na linha 20 diz *"fora disso ninguém
publica"*, e isso foi escrito **antes** da D-033, em que o dono decidiu
o contrário.

O `intervalo_madrugada_min = 90` que foi criado, testado e comitado
ontem **nunca dispara**: das 00h às 07h não há execução. O canal ia
ficar mudo desde as 23h de qualquer jeito.

---

## 2. O que a pesquisa achou

### A API do Mercado Livre resolve a categorização, de duas formas

1. **`products/{id}` já devolve `domain_id`.** Custo zero, porque a
   chamada já é feita. É a fonte mais confiável: é a classificação do
   próprio ML sobre o produto de catálogo.

2. **`sites/MLB/domain_discovery/search?q={título}`** é o preditor
   oficial de categoria, para quando não houver produto de catálogo.
   Devolve `domain_id`, `category_id` e atributos, ordenados por
   probabilidade. Testado hoje: com o título do whey, devolveu
   `MLB-SUPPLEMENTS` / "Suplementos Alimentares" no primeiro lugar.

`sites/MLB/search?category=` responde **403** — a busca por categoria
está fechada para aplicação comum desde 2024. `highlights` continua
respondendo 200, então o caminho de "mais vendidos por categoria"
segue vivo.

O que a literatura de e-commerce recomenda para isso é o que se chama
**tabela de mapeamento**: manter a taxonomia própria (nosso `nicho`) e
uma tabela separada que liga cada categoria do marketplace ao nicho, em
vez de forçar as duas a serem a mesma coisa. É o desenho que cabe aqui,
e o que permite plugar Shopee e Amazon depois sem refazer nada.

### O histórico dos canais do Telegram é alcançável, e é fundo

`t.me/s/<canal>` aceita `?before=<id>` e pagina para trás. Testado hoje
contra `t.me/s/promobit`: oito páginas seguidas, 20 posts cada, sem
parar, chegando a 30/07 num canal que publica ~20 posts por hora.

Nosso `leCanalPublico` **busca só a primeira página**. Ele lê 20 posts
e para, e a colheita já tem 68 menções de 8 fontes.

E `extraiPrecoAlegado` **já existe** e já tira o preço do texto do
post. A peça que falta é a paginação e o uso da data do post.

### Os projetos que fazem isso

Os repositórios públicos que resolvem o mesmo problema convergem em um
ponto: **eles não constroem série própria quando a loja declara o
desconto**. O `amazon-deals-telegram-bot` filtra por desconto acima de
50% direto da página de ofertas; o `E-Commerce-Offers-Telegram-Bot` usa
a API do Mercado Livre com ID de afiliado. Série própria é o que
diferencia, mas ela é o **segundo** sinal, não o único.

---

## 3. O plano, em ordem de retorno

Ordenado por quanto resolve dividido por quanto custa.

### Frente A · Consertar o roteamento — minutos

**A1. Tirar `casa` e `eletronico` do Radar Pet.** Uma linha em
`canal_nicho`. Sozinha, teria evitado dois dos três posts errados.

**A2. Abrir o cron para as 24 horas.** Uma linha em
`coleta-horaria.yml`, e é só executar o que a D-033 já decidiu. O freio
continua sendo o intervalo de 90 minutos, que limita a madrugada a
~4 posts.

**A3. Comporta de segurança no laço:** publicação só sai se o produto
tiver nicho e o canal aceitar aquele nicho **explicitamente**. Hoje um
produto sem nicho (`nicho_id` nulo, e há 12 no banco) simplesmente não
acha canal; um produto com nicho errado acha o canal errado. A comporta
transforma erro de classificação em oferta não publicada, que é o lado
certo de errar.

### Frente B · Classificar pelo que a loja diz — algumas horas

**B1. Tabela `nicho_dominio`**, ligando `domain_id` do marketplace ao
nosso nicho. `MLB-CAT_AND_DOG_FOODS → pet`,
`MLB-SUPPLEMENTS → nenhum`, e assim por diante. Fica no banco, não no
código, pelo mesmo motivo da D-023: ajustar sem publicar versão.

**B2. O coletor grava `dominio_externo` no anúncio** e decide o nicho
pela tabela, não pela lista de busca que o encontrou.

**B3. Produto cujo domínio não está mapeado nasce sem nicho** e cai em
`/produtos/sem-nicho`, que já existe. Não publica, e aparece para
alguém mapear o domínio uma vez. Mapeou, vale para sempre.

**B4. Reclassificar os 482 produtos que já estão no banco.** Uma
passada, uma chamada por produto. É o que limpa a base suja.

**Por que domínio e não categoria:** o domínio é mais estável e mais
grosso (`MLB-CAT_AND_DOG_FOODS` cobre ração de cão e de gato inteiras),
então a tabela de mapeamento fica com dezenas de linhas, não milhares.

### Frente C · Detectar oferta sem esperar histórico — algumas horas

**C1. Guardar `original_price` e `deal_ids`** no anúncio, que já vêm na
resposta lida.

**C2. Segundo gatilho de detecção: `desconto_declarado`.** Anúncio com
`original_price` acima do preço por uma margem configurável vira
candidato imediato, sem esperar segunda leitura.

**C3. A mensagem continua honesta.** O "de" do texto sai da **nossa**
série quando ela existe; quando não existe, o lastro diz o que a
regra 3.4 manda dizer, e o `original_price` **não aparece na
mensagem**. Ele é peneira de entrada, não argumento de venda.

**C4. Comporta contra o inflado:** desconto declarado acima de um teto
(uns 70%) é suspeito, não é oportunidade. Vira candidato de menor
prioridade, ou não vira.

Esta frente é a que enche o canal. As outras duas fazem ele encher com
a coisa certa.

### Frente D · Histórico de preço vindo dos canais — meio dia

Foi a ideia do dono, e ela é boa: *"pegando nesses grupos, você
consegue basicamente pegar histórico de preços"*.

**D1. Paginar `leCanalPublico` com `?before=`**, com teto de páginas
por execução. Testado: funciona, 20 posts por página, fundo suficiente.

**D2. Usar a data do post como data do ponto de preço.** O post já traz
`datetime`, e `extraiPrecoAlegado` já traz o valor. Um post de
25/07 dizendo R$ 800 vira um ponto de preço de 25/07.

**D3. Marcar esse ponto como `origem = 'canal'`**, e não misturar com o
que a gente mediu. Preço alegado por terceiro tem confiança menor que
preço lido da API, e a mensagem não pode dar lastro em cima dele sem
dizer de onde veio. É a mesma disciplina da regra 3.4.

**D4. Descobrir mais fontes.** São 8 hoje. Canal de oferta grande
publica 20 posts por hora, e cada post é um produto com preço e data.
Vinte fontes boas valem mais que quarenta termos de busca.

**Duas advertências:**

- Preço de canal é **alegação**, não medição. Serve para dar contexto e
  para descobrir produto, não para afirmar mínimo histórico.
- A **regra 3.3** continua: nada disso constrói série de Amazon.

### Frente E · Engrossar a base pelo caminho certo — algumas horas

**E1. Trocar parte da descoberta por termo por descoberta por
domínio.** Termo de busca é frouxo e foi a origem da bagunça. Se o
`highlights` responde por categoria e o domínio classifica, dá para
varrer categoria por categoria com o resultado já classificado.

**E2. Mais nichos, porque a base já tem os produtos.** Existe whey no
banco, existe papel fotográfico, existe tanquinho. Eles não são lixo:
são produtos de nichos que a gente não declarou. Criar `suplemento`,
`ferramenta`, `beleza` transforma erro de classificação em catálogo,
e cada nicho novo é um canal futuro.

**E3. Medir a base pelo que ela produz, não pelo tamanho.** O número
que importa não é "quantos anúncios", é "quantas ofertas por dia". Hoje
é 6 desde sempre. O critério da Fase 1 é 30 por dia por uma semana.

---

## 4. A ordem que eu proponho

| Ordem | Frente | Por quê |
|---|---|---|
| 1 | A1, A2, A3 | minutos, e param o sangramento hoje |
| 2 | C1, C2, C3, C4 | é o que faz o canal ter o que publicar |
| 3 | B1–B4 | é o que faz publicar a coisa certa |
| 4 | D1–D4 | histórico e descoberta, junto |
| 5 | E1–E3 | depois que os três acima estabilizarem |

**Por que C antes de B**, sendo que B é o defeito mais visível: a
frente A já impede o post errado de sair, então o dano de B fica
contido enquanto ela não é feita. O que continua doendo depois de A é
o canal vazio, e quem resolve isso é C.

---

## 5. O que eu deixaria de fora, e por quê

- **IA classificando produto.** O `domain_id` do próprio marketplace é
  mais confiável, mais barato e não alucina. E está fora de escopo até
  a Fase 4.
- **Raspar página de produto do ML.** A API entrega. Raspar é frágil e
  encosta na seção 8 do AGENTS.
- **Colheita por conta de usuário do Telegram.** Alcança grupo fechado,
  mas tem conta para banir. `t.me/s/` resolve o que precisamos agora,
  sem risco.
- **Cota diária por nicho.** Tentador para forçar variedade, mas o
  `lib/variedade.ts` já existe para isso e cota mata a tarde, que foi a
  discussão da D-033.

---

## 6. O que foi feito, e o que foi medido

As cinco frentes foram executadas em 01/08, na ordem proposta. Esta
seção é o registro do que mudou de fato, com os números conferidos
contra produção, não estimados.

### A · Roteamento

- `Radar Pet` ficou só com o nicho `pet`. Estava nos três, e por isso
  a mangueira e o whey eram elegíveis para ele.
- O cron passou de `0 11-23,0-2` para `0 * * * *`. O
  `intervalo_madrugada_min` criado na D-033 nunca disparava: das 00h às
  07h não havia execução nenhuma.
- A comporta de nicho ficou explícita no laço, e **reprova com motivo**
  em vez de ignorar. Produto sem nicho ficava `nova` para sempre,
  reavaliado de hora em hora sem nunca sair nem aparecer.

### B · Nicho pelo domínio

Nova tabela `nicho_dominio`, no banco e não no código (D-023). A
primeira versão da semente trazia domínios inventados por semelhança
(`MLB-PET_TOYS`, `MLB-COOKWARE`) e **quase nenhum existia** — o ML
chama as mesmas coisas de `MLB-DOG_TOY_BONES` e `MLB-KITCHEN_POTS`.
A lista final saiu de perguntar à API o domínio dos 474 produtos do
banco: **100 domínios reais**, 72 mapeados e 28 marcados como
"conhecido e não roteia".

`scripts/reclassifica-nichos.mjs` passou na base:

| | Antes | Depois |
|---|---|---|
| pet | 143 | 137 |
| casa | 147 | 83 |
| eletrônico | 180 | 131 |
| sem nicho | 12 | 131 |

**124 produtos mudaram de nicho.** Um quarto do catálogo estava errado.

### C · Desconto declarado

O `original_price` vinha na mesma resposta já lida e era descartado.
Na mesma rodada, sobre os mesmos 200 anúncios relidos:

| Detecção | Ofertas |
|---|---|
| `detecta_quedas` (mede) | 3 |
| `detecta_declarados` (a loja alega) | 40 |

**Este é o conserto da fila vazia.** As três amarras contra o "de"
inflado estão na migration 23 e valem repetir: é peneira de entrada e
não argumento de venda; a mensagem atribui a alegação à loja; e
desconto acima de 70% é recusado.

A mensagem que saiu, conferida no canal:

```
❌ De R$ 74,90
✅ Por R$ 49,97  (−33%)

a loja marcou de R$ 74,90 por R$ 49,97
```

### D · Escavação do histórico

`t.me/s/<canal>` aceita `?before=`, e a colheita lia só a primeira
página. Duas leituras por canal agora: uma atualiza do topo, outra
escava a partir da borda de baixo.

**E duas das oito fontes não eram canais distintos.** `t.me/s/promobit`
devolve o conteúdo de `ofertasdecomputador`, e `chinasuperofertas`
devolve o de `nerdofertas`. A página responde 200 com posts perfeitos,
então metade do orçamento lia o mesmo canal duas vezes. `leCanalPublico`
passou a conferir quem foi servido e falha alto.

Saíram as duas, entraram sete conferidos um a um: CupomDoGnu, cjpromos,
OfertasDoDia, pechinchou, cuponsoferta, TudoPromo, promoemcasa. Todos
**sem nicho**, porque são genéricos e quem classifica é o domínio.

| | Antes | Depois |
|---|---|---|
| produtos | 482 | 596 |
| menções | 68 | 774 |
| fontes ativas distintas | 6 | 13 |
| histórico alcançado | 1 hora | 19/07 |

### E · Base e medida

- A descoberta virou **uma passada plana**, com teto por rodada. Ela era
  por nicho porque o nicho vinha de quem achava; agora categoria e
  termo só dizem *onde procurar*.
- **Doze categorias em vez de oito**, incluindo Beleza, Ferramentas e
  Alimentos, que antes não entravam por não ter nicho onde encaixar.
- **`suplemento` virou nicho.** Era o maior domínio sem nicho da base,
  com 61 produtos, e não por acaso: as buscas por "racao" arrastaram a
  prateleira de suplemento humano inteira. Os 61 produtos já têm série
  de preço correndo; falta só um canal.
- Duas views para o critério da Fase 1: `ofertas_por_dia`, com o
  gatilho de cada uma, e `motivo_de_rejeicao`. Sem elas, "poucas
  ofertas" e "muitas ofertas reprovadas" pareciam o mesmo problema, e
  são opostos.

---

## 7. O que ficou aberto

**1. Só existe um canal, e ele é de pet.** Na primeira rodada com tudo
ligado, 43 ofertas viraram 1 publicação, e **24 foram reprovadas por
`nenhum_canal_do_nicho`**. O radar está achando oferta de casa,
eletrônico e agora suplemento, e não há onde publicar. Isso não é
defeito de código: é decisão de negócio sobre abrir canal, e é hoje o
maior desperdício do sistema.

**2. O ML erra a categoria dele mesmo, às vezes.** Três produtos
"Molho Ração Cachorro Petisco" estão em `MLB-SAUCES_AND_DRESSINGS`.
Como esse domínio não roteia, eles não publicam. É o lado certo de
errar, mas vale saber que existe.

**3. `dominio_sem_mapeamento` é a fila de trabalho.** Toda categoria
nova traz domínios que ninguém olhou, e produto de domínio não mapeado
não publica. A view ordena pelo que dói mais, e o coletor lista os
novos ao fim de cada rodada.

**4. A medida honesta ainda não existe.** `ofertas_por_dia` responde o
critério da Fase 1, mas "o canal está engajando?" só se responde por
taxa de clique, e ela depende do redirecionador (Fase 2).
