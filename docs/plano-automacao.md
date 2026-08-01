# Plano de automação — do laço que publica ao laço que acerta

Escrito em 01/08/2026, depois de ler o repositório inteiro, o código do laço,
`docs/onde-paramos.md`, as decisões D-033 a D-038, e de **medir o banco da
nuvem em vez de supor**. A pesquisa de campo que sustenta as recomendações
está em `docs/pesquisa/`.

O pedido do dono, nas palavras dele: *"eu não quero que uma pessoa fique
avaliando cada produto"*, e *"como que a gente vai sempre conseguir achar o
menor preço possível de alguém confiável de fato"*.

Esta segunda frase é o eixo deste plano. Ela tem duas metades, e **as duas
estão furadas hoje** — de formas diferentes e por motivos diferentes.

---

## Parte 1 — O que o banco diz, em 01/08/2026 às 15h

Medido, não estimado. Contra `fcdkcz…supabase.co`.

| O quê | Número |
|---|---|
| Produtos | 695 |
| Anúncios | 708 |
| Pontos de preço (`preco_ponto`) | 543, em **2 dias** |
| Anúncios com 1 leitura diária | 467 |
| Anúncios com 2 leituras diárias | 38 |
| Anúncios sem ponto nenhum | 203 |
| Ofertas detectadas | 129 |
| Ofertas por gatilho | `declarado` 103 · `queda` 26 · **`serie` 0** |
| Ofertas rejeitadas | 109 |
| Publicações enviadas | 11 (7 sem link, 4 com) |
| Publicações pendentes | 9, todas sem link |
| Canais ativos | 1 (pet) |
| `publicacao_automatica` | **0 — freio de mão puxado** |

E os motivos de rejeição, que são o mapa do desperdício:

| Motivo | Quantas | Fatia |
|---|---|---|
| `nenhum_canal_do_nicho` | 61 | 56% |
| `sem_nicho` | 16 | 15% |
| `produto_mal_avaliado` | 14 | 13% |
| `vendedor_novato` | 10 | 9% |
| `vendedor_fraco` | 8 | 7% |

**71% das rejeições são de nicho, não de qualidade.** O motor de curadoria
está funcionando; o que falta é onde publicar e como classificar.

E a distribuição de produto por nicho explica o resto:

```
141 pet   ·   132 eletronico   ·   98 casa   ·   61 suplemento   ·   1 beleza
262 SEM NICHO
```

**262 produtos sem nicho, que é 38% do catálogo.** O `docs/onde-paramos.md`
diz "Zero produtos sem nicho hoje". Não é mais verdade, e provavelmente
deixou de ser assim que a descoberta ampliou para 28 raízes.

**Só o nicho `pet` tem canal.** Os 291 produtos de eletrônico, casa e
suplemento não têm para onde ir.

---

## Parte 2 — As duas metades da pergunta do dono, e os dois furos

### Metade 1: "o menor preço possível"

**Não está furada, está jovem.** A série de preço é o ativo do projeto, e ela
tem dois dias. `por_serie: 0` não é defeito: `dias_minimos_de_serie = 7`, a
coleta começou em 31/07, e o gatilho `serie` passa a existir por volta de
07/08 sozinho. Nada a consertar, e **nada a antecipar**.

O que preocupa é o que sustenta o canal enquanto isso: **103 das 129 ofertas
vieram do gatilho `declarado`**, que é o `original_price` do Mercado Livre —
o mesmo número que o próprio `AGENTS.md` chama de "frequentemente inflado".
Hoje, na prática, o Radar está fazendo o que a pesquisa descreve como o
comportamento médio do mercado: repassar o desconto que a loja alega.

Isso é aceitável como ponte, e as amarras existentes são boas (teto de 70%,
mensagem atribui à loja, nunca afirma mínimo). **Não é aceitável como
destino**, e a diferença entre os dois é só o calendário.

### Metade 2: "de alguém confiável de fato"

**Esta está furada, e o furo é de correção, não de opinião.**

`relePrecos` roda de hora em hora sobre a base inteira. Para cada anúncio ele
chama `melhorOferta(produtoId)`, que **reordena os vendedores do catálogo a
cada execução** — loja oficial primeiro, depois reputação, depois preço, com
5% de tolerância (D-033). Ele grava o preço novo.

**E não grava o vendedor novo.** `vendedor`, `reputacao_vendedor`,
`vendas_estimadas`, `loja_oficial`, `avaliacao` e `avaliacao_qtd` ficam como
estavam **no momento da descoberta**.

O resultado é que o sistema pode publicar **o preço do vendedor B com a
reputação do vendedor A**. As comportas de confiança do `publica-automatico`
aprovam olhando dado velho, de outra pessoa.

A ironia é que o código já sabe disso. O caminho de descoberta tem o
comentário certo, na linha 777:

> *"Reputação e nota mudam com o tempo, e a curadoria decide com a de agora:
> vendedor que caiu de nível precisa parar de passar hoje."*

A intenção está escrita. Ela só não foi aplicada no caminho que roda de hora
em hora sobre tudo.

**E tem um agravante barato de resolver:** `melhorOferta` **já busca** a
reputação de cada candidato para poder ordenar. O dado está na mão e é
descartado. Consertar não custa nenhuma chamada nova de API.

### O furo de trás: nulo não reprova

`reprova()` tem a regra, documentada e defensável: *"Dado que não medimos não
é dado ruim: a loja pode simplesmente não informar avaliação."*

Só que o banco diz:

| Campo | Nulos | Fatia |
|---|---|---|
| `reputacao_vendedor` | 288 | 41% |
| `avaliacao` | 207 | 29% |
| `vendas_estimadas` | 207 | 29% |

**A comporta de vendedor está aberta para 4 em cada 10 anúncios.** Não porque
o vendedor é bom, mas porque nunca foi perguntado. E a pesquisa de campo
(`docs/pesquisa/sintese.md` §5) põe desconfiança como o **terceiro motivo**
de alguém sair de um canal, atrás só de volume e de entrada não consentida.

A correção do furo principal derruba boa parte desses nulos sozinha. O que
sobrar precisa de uma decisão, e ela está no P1.

---

## Parte 3 — Dois defeitos que a pesquisa achou e o código confirma

Estes não vieram de medir o banco, vieram de cruzar `docs/pesquisa/` com o
laço. Os dois atacam exatamente o **motivo número um** de alguém sair de um
canal, que a pesquisa mediu: **volume, não qualidade da oferta**.

### 3.1 O teto diário do canal não existe

A D-033 diz, com todas as letras: *"O teto diário do canal
(`posts_por_dia_max`) continua valendo por cima — é o combinado com o
parceiro."*

Ele **não vale**. `posts_por_dia_max` é lido na consulta de canais em
`publica-automatico.mjs` e nunca é usado. O único freio é o intervalo do
ritmo.

Fazendo a conta com os parâmetros que estão no banco agora (pico 10 min,
normal 30, madrugada 90):

| Faixa | Horas | Posts |
|---|---|---|
| Pico (07–09, 12–13, 19–22) | 6 h | 36 |
| Normal (09–19, 22–00) | 12 h | 24 |
| Madrugada (00–07) | 7 h | 4 |
| **Total teórico** | | **~64/dia** |

O canal tem `posts_por_dia_max = 50`. O teto é ultrapassado em ~28% e
ninguém é avisado. E 64/dia está acima da faixa de 20 a 50 que a própria
D-033 adotou para canal de nicho no Telegram.

### 3.2 A variedade não entra no laço automático

`lib/variedade.ts` existe, tem teste, e o comentário dele descreve com
precisão o problema que ele resolve:

> *"as melhores notas do dia tendem a ser oito variações da mesma coisa,
> publicadas em sequência."*

Ele é usado em **uma tela** (`app/(painel)/publicar/page.tsx`), que é o
caminho manual. O laço automático faz `order("nota", { ascending: false })` e
publica nessa ordem — que é literalmente o comportamento que `variedade.ts`
foi escrito para corrigir.

A pesquisa confirma que isso não é preciosismo: *"repetir a mesma categoria
de produto em sequência"* aparece como ponto de ruptura **separado** do
volume total.

---

## Parte 4 — Os planos, em ordem de retorno sobre esforço

Cada um diz o que muda, por que agora, e como se sabe que funcionou.

### P1 · A confiança acompanha o preço `EXECUTAR AGORA`

**Problema:** o preço é relido de hora em hora, a reputação não. O sistema
aprova com dado de outro vendedor.

**O que muda:**
1. `melhorOferta` passa a devolver o vendedor escolhido junto do item, em vez
   de só o item. O dado já é buscado.
2. `relePrecos` grava `vendedor`, `reputacao_vendedor`, `vendas_estimadas`,
   `loja_oficial`, `avaliacao` e `avaliacao_qtd` junto do preço.
3. Nasce o parâmetro `reputacao_nula_reprova` (padrão **1 = reprova**), com
   dispensa para loja oficial. Publicar vendedor sobre quem não se sabe nada
   é o oposto do que o dono pediu.
4. Motivo de rejeição novo: `vendedor_desconhecido`, para o furo ficar
   visível na view em vez de virar silêncio.

**Como se sabe que funcionou:** `reputacao_vendedor` nula cai de 288 para
perto de zero entre os anúncios relidos, e `motivo_de_rejeicao` passa a ter
`vendedor_desconhecido` em vez de aprovações cegas.

**Risco:** volume cai no curto prazo. É o lado certo de errar, e é
reversível por parâmetro sem publicar versão.

### P2 · O canal para de cansar `EXECUTAR AGORA`

**Problema:** o teto diário não é aplicado (~64 posts/dia contra 50
combinados) e a fila sai ordenada por nota, o que agrupa o parecido.

**O que muda:**
1. `posts_por_dia_max` passa a ser contado e respeitado, por canal, por dia
   de São Paulo (regra 3.9). Quem estoura fica pendente, não sai.
2. O laço passa a usar `intercalaPorVariedade` antes de publicar, como a tela
   manual já faz.
3. Motivo visível quando o teto trava, em vez de silêncio.

**Como se sabe que funcionou:** nenhum canal passa do teto num dia, e duas
publicações seguidas do mesmo nicho e faixa de preço deixam de acontecer.

### P3 · O nicho `EXECUTADO — e a premissa estava errada`

> **Correção registrada de propósito.** A primeira versão deste plano dizia
> "262 produtos sem nicho, rodar `reclassifica-nichos.mjs` e preencher os
> buracos de mapeamento". **Medi antes de rodar, e não havia buraco
> nenhum.** Fica escrito porque o erro é do tipo que o
> `docs/onde-paramos.md` já listou uma vez: *afirmar antes de medir*.

Os 262 produtos sem nicho decompõem em três coisas, e **nenhuma é defeito**:

| Quantos | O que são | Veredito |
|---|---|---|
| **203** | Anúncios de **Amazon e Shopee** vindos da colheita de canais | Inertes por dependência |
| **59** | Anúncios do ML cujo **domínio tem regra de bloqueio** | Decisão tomada |
| **0** | Regra que roteia e produto sem nicho | **Não existe** |

Os 203 não têm domínio, não têm preço, não têm reputação e nunca são
relidos: `relePrecos` só alcança URL de catálogo `/p/MLB…`, e as deles são
`amazon.com.br/dp/…` e `shopee.com.br/…`. São 29% do catálogo esperando
credencial de marketplace, não classificação.

Os 59 batem em uma das 27 regras de bloqueio de `nicho_dominio`. O sistema
está fazendo exatamente o que foi mandado fazer.

**Então a perda real é uma só, e é inteira do outro lado:** as **61 ofertas
por rodada** que morrem em `nenhum_canal_do_nicho`. Isso não se conserta com
código, se conserta abrindo canal.

**O que foi feito, já que o problema era outro:**

1. **A descoberta passou a olhar primeiro onde existe canal.** O teto de 600
   produtos por rodada era cortado na ordem em que as 28 categorias aparecem
   na lista, sem saber que só existe canal de pet. Agora as categorias cuja
   raiz roteia para um nicho com canal ativo vêm primeiro, e o resto vem
   depois. O conjunto não muda, a ordem sim: o que fica de fora do teto passa
   a ser o que não tinha onde ser publicado. **Ela lê os canais do banco**,
   então se reconfigura sozinha quando o dono abrir o próximo.
2. **A view `demanda_por_nicho`** (migration 33), que responde "abrir canal de
   quê?" com número: produtos no catálogo, ofertas detectadas e quantas se
   perderam por falta de canal, ordenada pela perda.

**Como se sabe que funcionou:** a linha de `descoberta —` no log passa a
dizer quantos dos escolhidos são de nicho com canal, e
`demanda_por_nicho` mostra a fila de espera por nicho.

---

### P4 · Horário: decidir em vez de deixar em pé duas verdades

`lib/horarios.ts` usa 07–09, 12–13, 19–22, e chama as 18h de "provavelmente o
pior horário do dia útil". A pesquisa nova consolidou 8–11 e 17–20.

**Nenhuma das duas fontes é estudo primário.** As duas são consenso de blog
de ferramenta de disparo. Trocar uma pela outra não é progresso.

**Recomendação, como dono de produto:** não mexer agora, e medir depois. A
medida honesta é clique por horário, e ela só existe com o redirecionador da
Fase 2. Enquanto isso, o que dá para fazer sem apostar é **acrescentar o dia
da semana**, que as duas fontes concordam e o código ignora: terça a quinta
convertem melhor que segunda e sexta.

### P5 · Cupom do Mercado Livre como conteúdo próprio

A pesquisa achou que os cupons do ML seguem `<CATEGORIA><DDMM>`, são criados
em lote todo dia, e são públicos. `docs/pesquisa/cupons-de-onde-vem.md` tem
seis hipóteses e os testes.

**Recomendação:** rodar os dois testes baratos (monitorar quem posta
primeiro; ver se a Central emite cupom próprio) **antes** de escrever
qualquer código. E se o atalho de extrair cupom por regex da colheita for
adiante, **a Shopee fica de fora** — o termo dela trata repasse de cupom de
terceiro como violação, com rescisão imediata.

### P6 · Webhook `items_prices`: deixar de perguntar

O ML notifica mudança de preço. Hoje o coletor varre. Webhook troca a
varredura pelo aviso, e é o que permite ser primeiro em vez de derivativo.

Depende de endpoint público, que a Edge Function já resolve.

### P7 · Descoberta por subcategoria `EXECUTADO E PROVADO`

D-037 propunha largura antes de frequência. O gargalo era mais simples do que
a proposta imaginava: `highlights` **satura**. Pedir os mais vendidos de "Pet
Shop" traz o topo de uma categoria de 4,2 milhões de itens — sempre os mesmos,
e justamente os de preço mais estável, que é o pior insumo possível para
detectar queda.

Pet Shop tem **28 filhas**. O topo de "Coleiras" nunca aparece no topo de
"Pet Shop".

**O que mudou:** para as raízes que têm canal ativo, a descoberta desce um
nível e pede os destaques de cada filha. Onde não há canal, continua sendo
uma chamada na raiz — a base cresce devagar, que é o certo enquanto não há
onde publicar. `ML_SUBCATEGORIAS=0` desliga.

**Medido rodando contra produção em 01/08**, com orçamento de 25 descobertas:

```
prioridade de descoberta: 1 categoria(s) com canal ativo (MLB1071)
desceu para 28 subcategorias das raízes com canal
descoberta — 25 produtos de 1338 achados (25 de nicho com canal)
17 produtos novos · 18 anúncios novos · 25 pontos de preço
```

**1.338 candidatos** contra os ~900 de antes, todos os 25 escolhidos de pet, e
**68% deles inéditos** — o que mostra que a base estava longe de saturada. E o
que apareceu é visivelmente mais fundo: Bravecto, NexGard e Simparic
(farmácia), chocadeira, néctar de beija-flor, suplemento equino. Nada disso
sai do topo da raiz.

**A releitura, na mesma rodada, provou o P1:** dos anúncios tocados, todos
ganharam `vendas_estimadas` e 87% ganharam reputação. Os 13% restantes são
vendedores sem nível de reputação no ML — nulo legítimo, e exatamente quem a
comporta nova barra.

### P8 · Amazon: nascer na Creators API

A PA-API 5 está descontinuada — conferido na fonte oficial: quem continuar
chamando recebe `403 AccessDeniedException`. Quando a Amazon entrar, entra na
Creators API. E o limite de entrada (1 TPS, 8.640/dia) obriga escolher quais
ASINs monitorar.

### P9 · A janela de cookie entra na nota

Amazon 24 h, Shopee 7 dias, ML ~30 dias, AliExpress 3 dias. A mesma
publicação vale coisas diferentes por loja. Isso é insumo da nota, e a nota
mora em `avalia_anuncios`.

**Não antes de calibrar com dado real.** Mexer na fórmula agora é adivinhar.

### P10 · Soltar o freio, com medição

`publicacao_automatica = 0`. O motivo que o levou a ser puxado (fusões
erradas de identidade) já foi desfeito. **É decisão do dono**, e a
recomendação é soltar depois de P1 e P2 estarem de pé — porque são eles que
impedem o canal de cansar quem já está lá.

---

## Parte 4b — O que foi executado em 01/08, e o que falta aplicar

P1, P2 e P3 estão no código e passam em `pnpm verifica` (28 casos, tipos e
lint limpos). As consultas novas foram testadas contra o banco da nuvem.

**Duas migrations foram escritas e NÃO foram aplicadas:**

| Migration | O que traz |
|---|---|
| 32 · `confianca_do_vendedor` | parâmetro `reputacao_nula_reprova` e a view de impacto |
| 33 · `demanda_por_canal` | view `demanda_por_nicho` |

Não apliquei porque mexer no banco de produção é a seção 8 do `AGENTS.md`
("pare e pergunte antes de fazer deploy"). O Docker não sobe nesta máquina,
então o caminho é `pnpm db:publica` contra a nuvem, e isso é decisão do dono.

**Nada disso quebra sem as migrations.** O código lê
`par.reputacao_nula_reprova ?? 1`, então a comporta nasce ligada mesmo sem a
linha existir. As views são consulta, não dependência.

**A sequência protege sozinha, e vale explicar:** hoje 287 anúncios (41%)
seriam barrados por `vendedor_desconhecido`. Esse número desaba assim que o
coletor corrigido rodar, porque `coleta-horaria.yml` executa **coleta →
detecta → publica na mesma job**, nessa ordem: quando a publicação for
avaliada, a reputação já foi preenchida na mesma execução. E o freio de mão
(`publicacao_automatica = 0`) continua puxado, então nada sai enquanto o dono
não mandar.

---

## Parte 5 — O que eu recomendo que o dono decida

Nenhuma destas é trabalho de código, e todas valem mais que qualquer uma das
que são:

1. **Abrir canal de eletrônico e de casa.** 61 ofertas por rodada morrem por
   falta de canal, e a pesquisa diz que nicho converte quase o dobro.
2. **Soltar o freio**, depois de P1 e P2.
3. **Calibrar a projeção de receita da Fase 2.** O roadmap projeta R$800/mês
   em 90 dias, que é a faixa de vitrine dos vendedores de ferramenta. O único
   relato de campo auditável que a pesquisa achou (grupo de ~250 membros) fez
   R$8.060 em sete meses, oscilando.
4. **Rodar os dois testes de cupom** de `docs/pesquisa/cupons-de-onde-vem.md`.
