# Plano de conserto dos canais

Continuação de `docs/personas-dos-canais.md`, que é o diagnóstico. Este
arquivo é o **como resolver**: cada item tem a prova, o mecanismo que já
existe no projeto, a mudança proposta, o custo e como conferir depois.

Nada aqui foi executado. Escrever plano é barato; mexer em canal que está
no ar não é, e o `AGENTS.md` §8 manda perguntar antes.

**Duas coisas mudaram de status depois do diagnóstico**, porque foram
rastreadas até a linha exata:

- O terço de instrumentos musicais no Geek tem endereço: **uma linha de
  mapa da Shopee**, e o conserto é um `update`.
- O "não é cão nem gato" do Pet tem três ramos do Mercado Livre com id,
  e o mecanismo para tratá-los já existe e já é usado pelo Fitness.

---

## 1. Ritmo: o teto de 12 caiu, e o que sobra dele

**Esta seção foi reescrita em 04/08, depois de ler quatro canais
concorrentes por dentro (`docs/concorrentes-lidos.md`). A proposta original
era teto de 12 posts por dia. Ela não sobreviveu à medição.**

### Por que caiu

Eu apoiei o teto em levantamentos de alcance no Telegram que dizem que
silenciamento sobe acima de 6 posts por dia. Esses levantamentos são de
blog de ferramenta de crescimento, sem amostra publicada, e falam de canal
de conteúdo. Canal de oferta tem outro contrato com o membro.

O que a leitura dos concorrentes mostrou, com view count na mão:

| Canal | Inscritos | Views/post | Alcance | Ritmo |
|---|---|---|---|---|
| BenchPromos | 116.000 | 271 a 484 | 0,3% | 20 posts em 13 minutos |
| Em Análise | 1.160 | 3 a 11 | 0,6% | um a cada 5 minutos |
| Esser Moda | 1.800 | 114 a 147 | **7%** | um a cada 4 minutos |

**Os três postam no mesmo ritmo e o alcance varia dez vezes.** Se cadência
fosse a variável, isso não aconteceria. O que separa o Esser Moda do Em
Análise é foco: um só publica moda masculina de marca reconhecível, o outro
publica meia, cafeteira, perfume árabe e perfurador de solo a gasolina na
mesma hora.

Então **volume não é o problema número um**, e eu afirmei que era. O
problema número um é o canal não ter recorte, que é o que os itens 2, 3 e 4
deste plano consertam.

### O que sobra, e não depende de teto nenhum

**O publicador ignora `horarios_permitidos`, e isso continua sendo um
defeito.** A coluna está gravada com `[7, 12, 20]` nos sete canais desde a
criação, e `grep -rn horarios_permitidos scripts/` não devolve nada. Não
importa qual número é o certo: **a configuração diz uma coisa e o
comportamento faz outra**, e alguém vai acreditar na configuração. Ou o
código passa a ler, ou a coluna sai. Os dois não podem conviver.

**A madrugada continua sem defesa.** Radar Tech publicou às 2h, 3h e 4h.
Não tenho medição própria disso e não vi os concorrentes de madrugada, então
é a parte mais fraca do que restou. **Dá para medir**: ler o feed de um
concorrente que funciona ao longo de 24 horas e ver se ele posta de
madrugada. Enquanto não medir, é opinião.

**A curadoria não está acontecendo, e isso é independente do número.** Com
teto de 150, quase tudo que é aprovado sai, então `oferta.nota` e
`intercalaPorVariedade` não estão selecionando nada. Se o volume alto ficar,
a curadoria tem que aparecer em outro lugar: roteamento e nota do curador.
É exatamente o que o BenchPromos faz com 116 mil inscritos, publicando
especificação técnica em cada post.

### O que eu proponho agora

1. **Não fixar teto novo por opinião.** O número certo só sai com clique
   medido, e isso é Fase 2.
2. **Resolver a contradição do `horarios_permitidos`**, de um jeito ou de
   outro. Isso é conserto, não escolha de estratégia.
3. **Tratar volume como assunto de depois do roteamento**, não de antes.

---

## 2. Geek: um terço do canal saiu de uma linha de mapa

**Prova, colhida do banco de produção:**

```
SHOPEE-100741 → geek   40 anúncios
    Bateria elétrica portátil com dois alto-falantes e 9 pads
    Pedal processador multiefeitos para guitarra e baixo VEDO
    Suporte para Teclado Musical Universal
    Banco Para Piano Teclado Saty BPD-20-C
```

`SHOPEE-100741` é **instrumento musical**, e está mapeado para `geek` na
migration 44, junto com oito categorias vizinhas. O mapa foi feito por
correspondência de nome sobre o feed inteiro (255 categorias, 240
mapeadas), e este bloco caiu errado.

Conferindo as nove uma a uma, com os anúncios que existem hoje:

| Categoria | Nicho hoje | Anúncios | O que realmente é |
|---|---|---|---|
| SHOPEE-100737 | geek | 31 | **certo.** Funko, action figure, miniatura |
| SHOPEE-100738 | geek | 10 | misto. Porta figurinhas convive com cofre e suporte de Alexa |
| SHOPEE-100739 | games | 38 | misto. Carta Pokémon convive com carrinho e vending machine |
| SHOPEE-100740 | geek | 0 | sem anúncio, não decide nada |
| SHOPEE-100741 | geek | **40** | **instrumento musical.** É o erro |
| SHOPEE-100742 | geek | 0 | sem anúncio |
| SHOPEE-100743 | geek | 1 | photocard de K-pop. Passa |
| SHOPEE-100744 | geek | **7** | **costura.** Kit de agulha, retrós de linha |
| SHOPEE-100745 | geek | 1 | massinha de modelar. É papelaria ou brinquedo |

**A mudança:** migration que remapeia 100741 e 100744, e revisa 100738,
100739 e 100745. Instrumento musical não tem canal e não deveria ter nicho
inventado só para isso; o certo é deixar sem nicho, que é estado válido e
significa "não roteia" (o `produto.nicho_id` é anulável de propósito).

**Como conferir:** rodar a mesma contagem por domínio depois e não achar
instrumento em canal nenhum. Os produtos já publicados continuam no
histórico, o que muda é o que sai daqui para frente.

**Sobra um pedaço menor:** violão e clarinete do Mercado Livre chegaram por
outro caminho, e alguns estão com `nicho_id` nulo. Esses já não roteiam.

---

## 3. Pet: cão e gato viram o canal, o resto vira secundário

**Prova, com os ids do Mercado Livre:**

```
MLB1071/MLB1117  Animais de Fazenda  → Vitagold 1 Litro Cavalo Boi Vaca Porco
MLB1071/MLB1100  Aves                → Nectar Beija Flor, Comedouro Galinhas
MLB1071/MLB1091  Peixes              → Bomba Submersa Lagos, Seachem Prime
```

Os três são filhos legítimos da raiz de Animais. É o mesmo problema que o
Fitness teve com "Esportes e Fitness", onde Windsurfe e Equitação moram na
mesma raiz de Musculação, e **o mecanismo de conserto já existe e já está em
uso**: `ramo_secundario`, com a proporção `primarios_por_secundario` (hoje
quatro por um).

**A mudança:** três linhas em `ramo_secundario` para MLB1117, MLB1100 e
MLB1091. O canal continua recebendo aquário de vez em quando, que é o
comportamento certo: existe dono de gato que também tem aquário.

**E um bloqueio à parte, que não é de ramo:**

```
SHOPEE-100672  raiz=Pets  folha=Pet Healthcare  →  K-Othrine SC 25 Envu
```

K-Othrine é **inseticida de dedetização**. Pela taxonomia da Shopee ele é
saúde animal, e é por isso que ramo não resolve. Resolve o mesmo mecanismo
do `USO = profissional` da migration 55: atributo derivado do título, canal
exclui. Lista literal e curta, como manda `lib/uso-do-produto.ts`:
dedetização, inseticida, raticida, cupinicida, larvicida.

**Como conferir:** o teste de `testes/uso.mjs` já tem a forma pronta para
copiar. E, no banco, contar quantos anúncios ficariam marcados antes de
ligar o filtro, para não descobrir o falso positivo em produção.

---

## 4. Beauty, Tech e Fitness: o mesmo mecanismo, alvos diferentes

O `USO = profissional` do Beauty resolveu 24% de um canal com uma migration
e nenhuma tabela nova. O mesmo desenho serve para dois casos que restaram.

**Tech, equipamento comercial** (6% do canal): leitor de código de barras
com pedestal, telefone gôndola, terminal elétrico em caixa de 1200. É
`USO = profissional` outra vez, com lista própria, e o Radar Tech passa a
excluir. Placa-mãe de soquete LGA 1155 é outro assunto: é produto morto, não
produto profissional, e isso é curadoria de nota, não de atributo.

**Fitness, vitamina de beleza** (26% do canal): `Cabelos e Unhas`, `Beleza
Mulher c/ Biotina`, `Óleo de Prímula`, `Cúrcuma`. Aqui não é filtro, é
roteamento: esses produtos são **do Beauty**, e no Beauty seriam bons posts.
O caminho é achar o domínio ou a categoria que os traz e apontar para
`beleza`, do mesmo jeito que o perfume saiu de beleza e virou nicho próprio.

**Fitness, o que falta:** zero equipamentos e zero roupas em 58
publicações. Isso não é filtro nenhum, é nicho que não está chegando.
Halter, colchonete, corda, luva, legging e tênis de corrida provavelmente
estão em `moda` ou em ramo secundário de esporte. Vale medir antes de mexer:
se o catálogo não tem, o problema é de coleta, não de roteamento.

---

## 4.5 O link curto da Shopee não está ligado em produção

**Medido em 04/08, e é achado de outra frente, não desta.** Fica aqui porque
`scripts/publica-automatico.mjs` está com o outro agente e eu não devo
encostar no arquivo.

**O sintoma:** o post da Shopee continua saindo com o `an_redir` de três
linhas, depois do commit `c22ed13` ("link curto da shopee pela open api"),
que entrou às 13h50 de 04/08.

**A medição, no banco de produção.** Publicações da Shopee enviadas a partir
das 12h00 UTC de 04/08:

```
link curto (s.shopee.com.br/AAxxxx) :   0
an_redir longo                      :  85
```

Inclui posts das 17h34, 17h38 e 17h41 UTC, muito depois do commit.

**A causa, e ela é estrutural, não de código.** O script lê as credenciais
assim:

```js
const credShopee = {
  appId: process.env.SHOPEE_APP_ID,
  appSecret: process.env.SHOPEE_APP_SECRET,
};
```

E `.github/workflows/publica.yml` **não passa nenhuma das duas**. O bloco de
`env` do step tem `AFILIADO_SHOPEE`, `AFILIADO_AMAZON`, `TELEGRAM_BOT_TOKEN`
e `ML_MATT_TOOL`, e para por aí. Sem as variáveis, a condição
`credShopee.appId && credShopee.appSecret` é falsa, a Open API nunca é
chamada, e o código cai para o `an_redir` exatamente como foi projetado.

**Não é bug do código do link curto.** O caminho de queda funcionou como
deveria; o que falta é a variável chegar ao processo.

**O que confirma de vez**, e não consegui ler porque as execuções recentes
estão sendo canceladas por concorrência: o script imprime
`Sem SHOPEE_APP_ID/SECRET: os links da Shopee saem no formato longo
(an_redir).` no começo da execução. Se essa linha estiver no log de uma
execução posterior a 16h50 UTC, fecha.

**O conserto** é adicionar as duas variáveis ao `env` do `publica.yml`, e
antes disso conferir se os segredos existem no repositório. **Isso mexe em
variável de produção, então é decisão do dono** (AGENTS §8), e o arquivo é
da frente do outro agente. Note que o mesmo vale para o Bloco 2.1 do
handoff: **validar preço da Shopee usa a mesma credencial**, então sem essa
variável aquela frente também nasce desligada.

---

## 5. A mensagem: quatro mudanças pequenas e uma grande

### 5.1 A linha de queda sem número some

Hoje sai `⚡ Caiu nas últimas horas: vimos o preço mudar.` na maioria dos
posts. O próprio `lib/mensagem.ts` já explica por que isso é ruim, e já tem
a lógica de sumir a linha inteira quando falta o número: a variável
`semNumeroDaQueda` existe e faz exatamente isso. O que está errado é o texto
padrão do `lastro_queda`, que não usa `{queda}`. Trocar o texto resolve, sem
tocar em código.

### 5.2 O vendedor cru vira reputação

`BEAUTY__RB`, `RPPET`, `mypetone`. Nome de seller da Shopee não convence
ninguém. Os dados para substituir já estão no banco desde a migration 30:
`anuncio.avaliacao`, `anuncio.avaliacao_qtd`, `anuncio.reputacao_vendedor`,
`anuncio.loja_oficial`.

Proposta: variável `{reputacao}` nova, que vira `4,8 ★ · 2 mil vendas`, ou
`Loja oficial` quando for, e **some quando não houver nada**, igual à linha
de frete. O nome do vendedor sai da mensagem.

### 5.3 O 🔥 volta a significar alguma coisa

Está em 100% dos posts. Reservar para `oferta.nota` alta e usar marcador
neutro no resto. É mudança de modelo, não de código, se o modelo ganhar uma
variável de destaque.

### 5.4 Cada canal ganha voz

`modelo_mensagem.canal_id` existe desde 28/07 e **nunca foi usado**: os sete
canais compartilham o modelo global. O Kids falando com mãe cansada e o Geek
falando com quem entende a referência são dois modelos, não duas features.

### 5.5 A grande: a nota do curador

Zero notas em 1.000 publicações. Isso não é um bug, é um hábito que não
existe. O caminho não é técnico:

- **Cinco notas por dia, escritas à mão**, nos produtos que vão sair. Com
  o volume de hoje, cinco notas por dia não cobrem o canal, mas são
  cinco posts que nenhum concorrente consegue copiar.
- A tela de aprovação precisa deixar escrever a nota **ali**, no momento da
  decisão, sem navegar até a ficha do produto. Se hoje já dá, é só usar; se
  não dá, é a mudança de painel de maior retorno da lista inteira.
- O canal de perfume é o caso extremo: **ele não deveria publicar sem
  nota**, porque o que vende perfume por indicação é a descrição do cheiro.

Vale como aposta declarada, não como certeza: a leitura dos guias de canal
brasileiro é que o público fica fiel quando confia na curadoria
([FluxoPromo](https://fluxopromo.com/blog/como-criar-canal-ofertas-telegram)),
e é isso que o projeto já dizia querer ser. A nota é a única parte da
mensagem que um concorrente com o mesmo bot não consegue copiar.

---

## 6. Faixa etária, tamanho e preço por medida

Três informações que decidem a compra das personas e não estão na mensagem.
As três saem do título, e as três usam o mesmo mecanismo do `GENDER` e do
`USO`: atributo derivado, guardado em `produto.atributos`, exibido pelo
modelo.

- **Kids, faixa etária.** "1 ao 14", "+3 anos", "6m+", "23 ao 34" já estão
  nos títulos. Vira `IDADE` e entra na mensagem.
- **Kids e moda, grade de tamanho.** Mesmo caso.
- **Fitness, Pet e Beauty, preço por medida.** `300g`, `1kg`, `500ml`,
  `15kg` estão no título. Com o preço em centavos, `{preco_por_medida}` sai
  de uma conta. É a métrica que Lucas usa para decidir creatina e a que Duda
  usa para decidir ração, e nenhum concorrente publica.

Ordem de valor: preço por medida primeiro (serve a três canais e é o mais
fácil de calcular), faixa etária depois.

---

## 7. O que este plano não faz, de propósito

- **Não cria canal novo.** Um canal de profissional de beleza atenderia a
  Jéssica e o atacado que o Beauty está barrando, e isso é conversa de
  audiência, não de código.
- **Não mexe em `avalia_anuncios` nem nos pesos da nota.** Está citado no
  item 1 como consequência a observar, não como mudança.
- **Não implementa recomendação por comportamento de membro.** Sem clique
  fechado (Fase 2), qualquer coisa nessa direção é chute com nome bonito.
- **Não toca em nada de Fase 3 ou 4.**

---

## 8. Ordem sugerida

Por dano evitado, não por esforço.

| # | O quê | Onde | Tamanho |
|---|---|---|---|
| 1 | Resolver a contradição do `horarios_permitidos` | `publica-automatico.mjs` ou `update` | pequeno |
| 2 | Remapear SHOPEE-100741 e 100744 | migration | pequeno |
| 3 | Pet: três ramos secundários e bloqueio de inseticida | migration + `lib/` | pequeno |
| 4 | Texto do `lastro_queda` com `{queda}` | `update` no modelo | mínimo |
| 5 | `{reputacao}` no lugar do vendedor cru | `lib/mensagem.ts` + modelo | médio |
| 6 | Hábito de cinco notas por dia | painel e rotina do dono | médio |
| 7 | Preço por medida | `lib/` novo, no molde do `uso-do-produto.ts` | médio |
| 8 | Tech e Fitness: filtro e roteamento | migration | médio |
| 9 | Modelo por canal | dados | médio |

Os quatro primeiros somam pouco código e resolvem, em ordem: a
contradição entre configuração e comportamento, um terço do Geek, um sexto
do Pet e a frase que não afirma nada.

A ordem mudou depois de ler os concorrentes: **roteamento passou na frente
de ritmo**, pelo motivo do item 1.
