# Quatro canais concorrentes, lidos por dentro

Leitura feita em 04/08/2026 pela página pública `t.me/s/<canal>`, que é a
mesma fonte que `scripts/descobre-fontes.mjs` já usa. Nada aqui precisou de
login, de bot ou de permissão.

| Canal | Inscritos | Recorte | Preview |
|---|---|---|---|
| BenchPromos | 116.000 | hardware e periférico | lido |
| Esser Perfumaria | 10.422 | perfume | **desligado**, só o cartão |
| Esser Moda | 1.800 | moda masculina de marca | lido |
| Em Análise | 1.160 | generalista | lido |

O quinto link (`web.telegram.org/k/#-3335132281`) é id numérico de chat sem
nome público. Não tem página pública, então não dá para ler por fora.

---

## 1. O dado que muda a conversa: alcance medido

O `t.me/s/` mostra a contagem de visualizações por post. Isso é alcance
real, não estimativa.

| Canal | Inscritos | Views por post | Alcance |
|---|---|---|---|
| BenchPromos | 116.000 | 271 a 484 | **0,3%** |
| Em Análise | 1.160 | 3 a 11 | **0,6%** |
| Esser Moda | 1.800 | 114 a 147 | **7%** |

**Ressalva que muda a leitura, então vem antes da conclusão:** view acumula
com o tempo. A amostra do BenchPromos e do Em Análise tem entre zero e duas
horas; a do Esser Moda tem mais de três. Os números baixos estão
subestimados. Mesmo assim o post do Em Análise das 15h55, com duas horas de
vida, tem **11 views para 1.160 inscritos**.

E os três postam no mesmo ritmo: **um post a cada 4 a 5 minutos**. O
BenchPromos publicou 20 posts em 13 minutos (17h12 às 17h25).

### O que isso desmonta

Se ritmo fosse a variável, os três teriam alcance parecido. Não têm: o Esser
Moda faz **dez vezes** o alcance do Em Análise postando no mesmo ritmo, com
apenas 55% mais inscritos.

A diferença entre os dois não é cadência, é **foco**. O Esser Moda publica
moda masculina de marca reconhecível: Lacoste, Levi's, New Balance, Reserva,
Lupo. O Em Análise publica, na mesma hora: meia masculina, câmera Intelbras,
cafeteira Dolce Gusto, creme La Roche-Posay, perfume árabe, liquidificador,
**perfurador de solo a gasolina**, notebook gamer, lava e seca, carrinho de
bebê, iPhone, fogão, guarda-roupa e ômega 3.

Ninguém é a persona do Em Análise, e o alcance dele diz isso.

### Correção do que eu propus

No `docs/plano-dos-canais.md` eu propus teto de 12 posts por dia usando
"volume mata alcance" como argumento. **O argumento caiu e o número caiu
junto.** A seção 1 daquele arquivo foi reescrita.

O que estes três canais mostram é que o que separa 0,6% de 7% é o foco, não
o ritmo. Fixar teto novo agora seria trocar uma opinião por outra, e o
número certo só sai com clique medido, que é Fase 2.

O que sobrevive não depende de teto: o publicador ignora
`horarios_permitidos`, que está gravado nos sete canais, e configuração que
mente é defeito qualquer que seja o número certo. A madrugada continua sem
defesa medida, e dá para medir lendo um concorrente ao longo de 24 horas.

---

## 2. O que eles fazem e nós não

Em ordem de quanto custa copiar.

**Cupom colado no post da oferta.** Está em todos os três.

```
🏷 CUPONS: FASHIONML ou PIPOCA ou AMODESCONTO
```

O BenchPromos põe o código junto do preço já com desconto (`LOFREE20`,
`15NOPERI`, `BORA`). Nós temos `cupom_vivo` e post de cupom separado desde a
migration 21, e **não colamos o cupom no post da oferta**. É o item de maior
retorno desta lista.

**Preço no Pix e parcelamento.** Em todo post do Em Análise:

```
💵 R$ 337,41 15% OFF no Pix ou Saldo no Mercado Pago | Frete Grátis
💳 7x R$ 53,56 sem juros
```

Em ticket acima de R$ 300 é isso que decide a compra. Nós mostramos um preço
só.

**Especificação técnica no corpo.** É o diferencial do BenchPromos, e é o
que justifica 116 mil inscritos: sensor PAW3950, 8000Hz, switch Kailh
Linear, 485g, vendido e entregue pela KaBuM com 1 ano de garantia. É a nota
do curador deles, e boa parte sai de atributo, não de opinião.

**Ressalva de responsabilidade**, em todo post do Em Análise:

```
⚠️ Preço e estoque sujeitos a alteração.
```

Custa uma linha no modelo e protege exatamente o risco que o Bloco 2.1 do
handoff está atacando por código.

**Link fixo para a lista de cupons** e **"📦 Compra Nacional"**, que responde
prazo e importação sem ninguém perguntar.

---

## 3. O que eles fazem pior que nós

Vale registrar, porque é onde já estamos à frente.

**Nenhum dos quatro identifica publicidade.** O Em Análise publica link
Amazon com `tag=emanalise-20` e link `meli.la` de afiliado, sem `#publi`,
sem `#publicidade`, sem nada. Nossa regra 3.10 nos deixa em conformidade
onde o mercado inteiro está fora.

**Repetição que o nosso código já evita.** O BenchPromos publicou três posts
seguidos do mesmo teclado Lofree Flow Lite84 em rosa, cinza e branco, e
depois cinco mouses Attack Shark em sequência. Isso é exatamente o que
`intercalaPorVariedade` existe para impedir.

**"De" inventado, e é o pior deles.** Em Análise, com 20 minutos de
diferença:

```
16:56  iPhone 16 (128 GB)   De R$ 8.650,50 por R$ 4.599,00   46% OFF
17:18  iPhone 16 (256 GB)   De R$ 8.599,00 por R$ 5.129,00   40% OFF
```

O modelo de 128 GB aparece com preço "de" **maior** que o de 256 GB. É o
`original_price` inflado do Mercado Livre repassado sem crítica, que é
literalmente o que a regra 3.4 nos proíbe de fazer, e o que a D-064 e o
lastro declarado resolveram atribuindo a alegação à loja.

**Nenhum tem lastro de preço.** Nenhum dos quatro diz "menor preço em X
dias". A série de preço continua sendo a coisa que temos e eles não.

---

## 4. O que fazer com isso

Entra na fila do `docs/plano-dos-canais.md`, sem desmontar o que já está
lá:

1. **Cupom no post da oferta.** Dado já existe, é montagem de mensagem.
2. **Linha de ressalva no modelo.** Uma linha, custo zero.
3. **Parcelamento e preço no Pix**, quando a loja devolver. Verificar
   primeiro se vem na API, e medir antes de prometer.
4. **Reordenar a fila do plano:** roteamento antes de teto, pelo motivo do
   item 1 deste arquivo.
5. **Não copiar** o "de" sem crítica, a repetição em sequência, nem a
   ausência de identificação publicitária.

E fica um alvo de leitura em aberto: **Esser Perfumaria, 10.422 inscritos,
só de perfume.** É o análogo direto do nosso canal mais fraco, e é o único
dos quatro com preview desligado. Ler ele exige entrar como membro.

---

## 5. Os preços deles são melhores que os nossos?

Pergunta do dono. **Resposta curta: não dá para afirmar que sim, e o pouco
que dá para comparar sugere o contrário.** O que é claramente pior é o preço
que nós *mostramos*, não o que nós *achamos*.

### O único par comparável que a amostra deu

Mesmo produto, mesma loja, mesmo dia:

| | Produto | Preço publicado |
|---|---|---|
| Radar Tech | iPhone 16 **128 GB**, Distribuidor Autorizado | R$ 5.110,00 |
| Em Análise | iPhone 16 **128 GB**, Distribuidor Autorizado | R$ 4.599,00 **no Pix** |
| Em Análise | iPhone 16 **256 GB**, Distribuidor Autorizado | R$ 5.129,00 **no Pix** |

Na leitura crua eles estão R$ 511 mais baratos, 11%. Mas o preço deles é
**no Pix**, e o nosso é o de tabela. Desfazendo os 15% de Pix do Mercado
Livre, o de tabela deles seria da ordem de **R$ 5.410**, acima dos nossos
R$ 5.110.

**Isso é uma conta, não uma medição**, e está aqui como hipótese: pode ser
que a nossa oferta seja igual ou melhor, e pareça pior porque publicamos o
número errado. O que decide é abrir o mesmo anúncio e ler os dois preços, e
isso ainda não foi feito.

### O que é medição, e não hipótese

**Nós não coletamos o preço de método de pagamento.** O coletor lê `price` e
`original_price` do item, e nada mais (`scripts/coleta-mercado-livre.mjs`).
O desconto de Pix e de saldo do Mercado Pago vive em outro lugar da API, e a
consequência é aritmética: em todo anúncio que tem Pix, **nós publicamos um
preço 10 a 15% acima do que o comprador paga**, e o concorrente publica o
que ele paga.

Some a isso o cupom, que eles colam no post e nós não, e a diferença
aparente cresce de novo.

### A conclusão honesta

Três coisas diferentes estavam embrulhadas na pergunta:

1. **A oferta que encontramos** pode estar boa. O único par comparável
   sugere que está.
2. **O preço que publicamos** está sistematicamente alto, porque falta Pix
   e falta cupom. Isso é medível e tem conserto.
3. **A leitura de quem está no grupo** é a do item 2, não a do item 1. Ela
   compara o número do nosso post com o número do post do concorrente, e
   perdemos essa comparação todo dia.

**O teste que fecha isso**, e que ainda não rodou: pegar 20 anúncios que nós
publicamos, abrir o mesmo item e anotar preço de tabela, preço no Pix e
cupom disponível. Se a diferença for consistente, o problema é de coleta e
de mensagem, não de curadoria.

### Dá para coletar o preço promocional? Sim, e existe endpoint próprio

Levantado em 04/08. **O que é certo:**

- O Mercado Livre tem **dois endpoints de preço** além do `/items`:
  `GET /items/{id}/sale_price`, que devolve `amount` (o preço de venda),
  `regular_amount` (o preço cheio quando há promoção) e `metadata` da
  promoção; e `GET /items/{id}/prices`, com os preços por contexto
  (canal de venda e nível do comprador).
- **Nós não chamamos nenhum dos dois.** O coletor lê `price` e
  `original_price` do próprio item e para aí.
- **E há um prazo nisso:** a documentação do Mercado Livre diz que os campos
  `price`, `base_price` e `original_price` do `/items` **estão sendo
  descontinuados**, e manda consultar preço pelas APIs de preço. O coletor
  inteiro depende do campo que vai sair.

**O que NÃO é certo, e não vou afirmar:** se o desconto do Pix aparece nesses
endpoints. O "15% no Pix" do Mercado Livre pode ser promoção do anúncio
(apareceria em `sale_price`) ou benefício de meio de pagamento aplicado no
checkout (não apareceria). A documentação que li não separa os dois casos, e
a página oficial de preços devolveu 403 para leitura automatizada.

**Por que não testei ao vivo.** A API pública sem token responde 403
(`PolicyAgent`), e a única credencial do Mercado Livre que temos guardada é
o **refresh token, que o próprio Mercado Livre rotaciona a cada uso**. Fazer
a renovação para um teste poderia derrubar a coleta em produção, e isso é
decisão do dono (AGENTS §8).

**O teste, para quem já estiver com o token na mão.** Dentro do
`scripts/coleta-mercado-livre.mjs`, que já autentica, para 20 itens:

```
GET /items/{id}/sale_price   →  amount, regular_amount, metadata
compare `amount` com o `price` que já lemos
```

Sem gravar nada. Se `amount` vier consistentemente abaixo de `price`, achamos
o número que os concorrentes publicam e nós não.

**Onde a chamada deve morar, se der certo:** na publicação, não na coleta.
Uma chamada por item coletado multiplica por milhares; uma chamada por item
prestes a ser publicado são dezenas, e é exatamente o desenho que o Bloco
2.1 do handoff já está adotando para a Shopee.

---

## 6. Prospecção de cupom dos concorrentes — anotado, não feito

Decisão do dono em 04/08: **fazer depois que o outro agente fechar a frente
dele.** Fica registrado aqui para não se perder.

A ideia é ler o cupom que os concorrentes publicam e usá-lo, que é o item de
maior retorno da seção 2 deste arquivo. O material observado:

```
🏷 CUPONS: FASHIONML ou PIPOCA ou AMODESCONTO     (Esser Moda, Mercado Livre)
LOFREE20 · 15NOPERI · BORA                        (BenchPromos, KaBuM)
📌 Lista de Cupons: https://bit.ly/4dPZ9Oo         (Em Análise, lista fixa)
```

O que já existe e serve: `cupom_vivo` com escopo (migration 26),
`scripts/colhe-cupons.mjs`, e `scripts/descobre-fontes.mjs`, que já lê canal
alheio pela mesma página pública `t.me/s/` usada nesta auditoria. Ou seja,
**a colheita de cupom de canal público não precisa de bot nem de
permissão.**

Três cuidados que a leitura de hoje já mostrou:

- **Cupom tem escopo.** O do Mercado Livre é por categoria, e colar num
  produto de outra categoria faz o desconto falhar no carrinho. O
  `lib/mensagem.ts` já documenta isso como a armadilha mais comum.
- **Cupom vence.** A lista fixa do Em Análise é um `bit.ly` que eles
  atualizam; copiar o código sem a validade publica desconto morto.
- **Cupom de terceiro pode ser exclusivo do afiliado dele.** Alguns cupons
  de canal são atrelados à conta de quem publica. Verificar antes de tratar
  como geral.
