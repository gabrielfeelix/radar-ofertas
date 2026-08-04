# Os sete canais vistos por quem está dentro deles

Auditoria feita em 04/08/2026 a pedido do dono: entrar em cada grupo como
membro, não como operador, e responder três perguntas. **O que essa pessoa
compraria? O que ela está recebendo? A distância entre as duas coisas é
grande?**

Tudo aqui saiu do banco de produção, das publicações com `estado =
'enviada'`. A amostra é de 02 a 04/08: **1.000 publicações**, distribuídas
assim.

| Canal | Nichos | Publicações | Mediana | Faixa dominante |
|---|---|---|---|---|
| Radar Tech | eletronico, games | 293 | R$ 129,00 | espalhada, sem centro |
| Radar Kids | bebe, brinquedo | 292 | R$ 64,90 | R$ 30 a 80 (46%) |
| Radar Beauty | beleza, perfume | 196 | R$ 59,78 | R$ 30 a 80 (32%) |
| Radar Pet | pet | 98 | R$ 59,45 | R$ 30 a 80 (35%) |
| Radar Geek | geek, games | 61 | R$ 98,36 | R$ 30 a 80 (31%) |
| Radar Fitness | fitness, suplemento | 58 | R$ 63,40 | R$ 30 a 80 (50%) |
| Radar Perfumes (masc) | perfume | 2 | R$ 176,65 | não há amostra |

As personas são inventadas. Os produtos citados como problema não são: cada
um é título real, com o preço com que saiu.

---

## Antes dos canais: os três problemas que atingem todos

Eles pesam mais que qualquer erro de curadoria individual, porque nenhum
acerto de produto sobrevive a eles.

### G-01 · O volume é o problema número um, e não é perto

Radar Tech e Radar Kids publicaram **155 e 156 vezes em 04/08**. Isso é uma
mensagem a cada nove minutos, das sete da manhã à meia-noite, em dois grupos
diferentes, na mesma pessoa se ela estiver nos dois.

E não para de madrugada. Distribuição por hora de São Paulo, no Radar Tech:

```
00h: 3   01h: 3   02h: 2   03h: 2   04h: 3   05h: 3   06h: 2
07h: 12  08h: 21  09h: 16  10h: 27  11h: 21  12h: 32  13h: 23
```

**O banco discorda do que está acontecendo.** Os sete canais têm
`horarios_permitidos = [7, 12, 20]` gravado, que é exatamente a
recomendação de `lib/horarios.ts`, e o publicador nunca lê essa coluna: uma
busca por `horarios_permitidos` em `scripts/` não devolve nada. O que
governa hoje é `posts_por_dia_max`, que está em **150 nos sete canais**, e
o ritmo entre envios.

Nenhuma persona deste documento aguenta 150 mensagens por dia. A reação não
é sair do grupo, é pior: **silenciar**. Quem silencia continua no contador
de membros e nunca mais volta, e não há como saber quantos já fizeram isso.

### G-02 · Em 1.000 publicações, zero notas do curador

O template tem `{nota}`. A tabela tem `produto.nota_curador`. O `AGENTS.md`
diz que o diferencial do projeto "não é disparar mensagem, é saber o que
vale publicar". **A mensagem publicada não contém uma única linha de opinião
humana em nenhum dos sete canais.**

O efeito é direto: para quem está dentro do grupo, o Radar é indistinguível
de qualquer bot que repassa oferta. Todo o trabalho de curadoria fica
invisível justamente no lugar onde ele seria visto.

### G-03 · O lastro mais comum não afirma nada

A linha que mais aparece nas mensagens é esta:

```
⚡ Caiu nas últimas horas: vimos o preço mudar.
```

O comentário do próprio `lib/mensagem.ts` já diz por que isso é fraco:
*"'baixou 18%' se confere, 'vimos o preço mudar' não diz nada"*. A frase sem
número é ruído com emoji. Quando o `{queda}` não existe, a linha inteira
deveria sumir, como já acontece com nota e frete.

---

## Radar Tech

**Nichos:** eletronico, games · **293 publicações** · mediana R$ 129,00

### As personas

**Rafael, 27, analista de suporte, São Paulo.** Trocou de celular ano
passado, o notebook é do trabalho. Compra online quase tudo. Ticket típico:
R$ 80 a R$ 600. O que ele efetivamente compra num ano: fone bluetooth,
carregador rápido, SSD, monitor, cadeira, mouse, um smartwatch. Ele **sabe**
quanto custa um SSD de 240 GB, e é por isso que "20% off" não convence ele:
convence "abaixo de R$ 300".

**Thiago, 34, tem home office montado.** Ticket maior, frequência menor.
Compra o que resolve um problema específico: suporte de monitor, nobreak,
roteador mesh, webcam. Ele lê especificação antes de comprar e desconfia de
marca que nunca viu.

### O que está chegando

- **19% do canal (56 de 293) é acessório de menos de R$ 35.** Cabo, pilha,
  pasta térmica, adaptador. "Cabo" é a primeira palavra de **25 títulos**.
- **13 rádios comunicadores Baofeng** (4,4%), em kit de 2, 4 e 5 unidades.
- **Nada a ver, e são produtos reais:**
  - `Terminais Elétricos Ilhós Importados 1200 Unidades` (R$ 29,82) — insumo
    de eletricista, comprado por caixa.
  - `Leitor Código De Barras 2d C/ Pedestal El 250 Elgin` (R$ 429,00) —
    equipamento de caixa de loja.
  - `Telefone Gôndola Com Fio Tc 20 Intelbras` (R$ 48,86) — telefone de
    corredor de empresa.
  - `Telefone Intelbras C/som Aumentado P/ Defic.auditivos/idosos`
    (R$ 199,90) — persona completamente diferente.
  - `Mochila Masculina Bolsa Impermeável Faculdade` (R$ 37,73) — não é tech.
  - `Placa Mãe Bluecase Bmbh61 Ddr3 Lga 1155` (R$ 142,00) — soquete de 2011.
    Quem monta PC hoje não olha, e quem não monta não sabe o que é.

### O diagnóstico

O canal não tem um centro. A média de preço é R$ 484 e a mediana é R$ 129,
o que quer dizer que ele oscila entre álcool isopropílico de R$ 9,37 e
iPhone 16 de R$ 5.110,00 no mesmo dia. Rafael não sabe para que serve esse
grupo, e é essa a pergunta que decide se ele silencia.

### O que dá para fazer

1. **Teto de acessório barato.** Cabo, pilha e adaptador no máximo um a cada
   cinco posts. Eles não são erro de nicho, são erro de proporção.
2. **Cortar equipamento comercial e telefonia fixa.** Leitor de código de
   barras, telefone de mesa e terminal elétrico são compra de empresa. É a
   mesma regra do `USO = profissional` que o Beauty acabou de ganhar.
3. **O que Rafael quer e não recebe:** preço por GB no SSD, "é o mais barato
   que já vi nesse modelo", cupom de loja de tech, e um post por semana do
   tipo "os três fones abaixo de R$ 150 que valem".

---

## Radar Kids

**Nichos:** bebe, brinquedo · **292 publicações** · mediana R$ 64,90

### As personas

**Fernanda, 34, mãe de dois (3 e 7 anos), Guarulhos.** Compra online por
economia de tempo, não de dinheiro. Ticket R$ 40 a R$ 150. O que ela compra
de verdade: roupa por tamanho, tênis escolar, fralda, brinquedo que já foi
pedido, presente de festa. **A decisão dela depende de duas informações que
nenhuma mensagem do canal traz: tamanho disponível e faixa etária.** Vestido
lindo a R$ 59,95 sem dizer se tem tamanho 6 é post que ela rola sem parar.

**Patrícia, 29, primeira filha de 8 meses.** Compra por medo de errar. Lê
avaliação, prefere marca conhecida, e compra em quantidade quando é consumo
(fralda, lenço, sabonete). Ticket menor por item, frequência maior.

### O que está chegando

Proporção decente na superfície: 28% brinquedo, 27% bebê, 21% roupa.
O problema é a mistura de idades dentro do mesmo minuto.

- **10 bonecas Reborn** (3,4%), de R$ 79,98 a R$ 239,06. Reborn é produto de
  **colecionadora adulta**, não de mãe comprando para filho. É a mesma
  natureza do erro que o Beauty teve com microcânula: taxonomia certa,
  pessoa errada.
- `Bateria elétrica com 4 pads silenciosos` (R$ 1.409,99) — o post mais caro
  do canal, e não é infantil.
- `Capa Roupa Chuva Conjunto Jaqueta Calça Motoqueiro Reforçada` (R$ 62,49)
  — roupa de motoboy adulto.
- `Bota Texana Feminina GiGiL Teen Country` e `Blusa Cropped Juvenil` num
  canal que no post anterior mostrou macacão de bebê.
- `Kit` é a primeira palavra de **31 títulos**, quase sempre "kit 4 ou 5
  bermudas sortidas" — que é compra às cegas: a mãe não escolhe cor nem
  estampa.

### O diagnóstico

Kids é o canal com o melhor material bruto e a pior apresentação. Roupa
infantil sem tamanho e brinquedo sem faixa etária são anúncios incompletos,
e o defeito não está no produto escolhido, está na mensagem.

### O que dá para fazer

1. **Faixa etária na mensagem, sempre.** "0 a 2 anos", "3 a 6", "7+". É a
   informação que decide a compra e ela já está no título na maioria dos
   casos.
2. **Separar reborn.** Ou marca como colecionável (vai para o Geek), ou some.
3. **Tamanho disponível quando for roupa e calçado**, mesmo que seja só a
   grade ("do 23 ao 34", que já aparece em vários títulos).
4. **O que Fernanda quer e não recebe:** volta às aulas por semana temática,
   fralda e consumo recorrente com preço por unidade, e "presente até R$ 50".

---

## Radar Geek

**Nichos:** geek, games · **61 publicações** · mediana R$ 98,36

### A persona

**Diego, 30, dev, mora sozinho.** Joga PS5, coleciona Funko, joga Pokémon
TCG com os amigos de sexta. Ticket R$ 50 a R$ 400, e compra por impulso
quando é item que ele reconhece. Ele **sabe** quanto custa uma booster box e
quanto vale um Funko exclusivo. É a persona mais fácil de agradar dos sete
canais, porque o gatilho dele é reconhecimento, não preço.

### O que está chegando

Este é o canal com o erro de roteamento mais grave da operação.

- **31% do canal (19 de 61) é instrumento musical.** Violão Alpha, violino
  4/4, clarinete Blackwinds R$ 619, bateria eletrônica Alesis R$ 2.890, seis
  pedais de guitarra M-VAVE, banco de piano, tarraxa de violão, kazoo,
  ovinho de percussão. **Instrumento musical não é geek em nenhuma leitura.**
  Vale a pena rastrear de onde saiu esse roteamento: é volume grande demais
  para ser acidente de um domínio só.
- **26% é controle de videogame**, e boa parte é o mesmo produto repetido:
  Dualshock 4 preto R$ 98,36, Dualshock 4 Berry Blue R$ 93,27, genérico
  Redfin R$ 47,43, genérico Bluetooth R$ 52,75, com fio Crowley R$ 28,90.
  Cinco controles de PS4 numa amostra de 61.
- `CHAVEIROS DIVERSOS OFICIAL FLUMINENSE OURO` e `CHAVEIRO SANTOS OFICIAL`
  (R$ 21,00) — futebol não é o recorte deste canal.
- `Máquina de Fichas Para Máquina De Bolinha Vending Machine` (R$ 1.999,99)
  — equipamento comercial.

E o que está certo está bom: Booster Box Copag Megaevolução, Box Mega
Venusaur, Lego 43019, Jogo War da Grow, Gran Turismo 7, Resident Evil 4
Remake, Funko de Um Sonho de Liberdade. **Esse canal já sabe o que fazer.
Ele só está afogado.**

### O diagnóstico

Tirando instrumento musical e controle genérico, sobram cerca de 25
publicações de qualidade alta em três dias. Isso é ritmo saudável para um
canal geek. O canal também parou: 57 posts em 03/08 e 3 em 04/08.

### O que dá para fazer

1. **Achar e cortar a origem dos instrumentos musicais.** É um terço do
   canal e é o conserto de maior retorno da operação inteira.
2. **Deduplicar por categoria no dia.** Um controle de PS4 por dia, não cinco.
3. **O que Diego quer e não recebe:** data de lançamento, "é o preço mais
   baixo desde o lançamento", pré-venda, e nota sobre estado do item.

---

## Radar Perfumes (masc)

**Nicho:** perfume · **2 publicações em três dias** · filtro `GENDER = Masculino`

### A persona

**Marcelo, 31, vendedor.** Tem dois perfumes e quer um terceiro. Ele não sabe
nomes de notas olfativas, sabe que "aquele do amigo dura o dia todo". Compra
por indicação, quase nunca por marca. Ticket R$ 90 a R$ 300. Desconfia de
preço muito baixo, porque falsificação é o assunto número um desse mercado.

### O diagnóstico

**O canal não existe na prática.** Duas publicações em três dias: Azzaro Pour
Homme R$ 256,90 e Eudora Club 6 Voyage R$ 96,40. As duas são boas escolhas, e
duas por três dias é canal morto.

E é o canal que **mais** depende da nota do curador, que é justamente o
campo que está zerado em toda a operação. O que faz alguém comprar perfume
por indicação é a descrição do cheiro, e nenhuma API do mundo devolve isso.
O próprio código de `lib/mensagem.ts` usa como exemplo de nota exatamente
uma frase de perfume: *"amadeirado clássico, ideal pra fumante de Malboro"*.

### O que dá para fazer

1. **Este canal não deveria ser automático.** Três posts por semana, escritos
   à mão, valem mais que trinta automáticos.
2. **Verificar quantos perfumes chegam e são barrados pelo filtro `GENDER`.**
   Se o Mercado Livre não preencher o atributo, o produto passa (por
   desenho), então o problema provável é falta de oferta na origem, não o
   filtro.
3. **O que Marcelo quer e não recebe:** "dura quanto tempo", "parece com
   qual", tamanho em ml comparado, e garantia de originalidade do vendedor.

---

## Radar Beauty

**Nichos:** beleza, perfume · **196 publicações** · mediana R$ 59,78

### As personas

**Bia, 24, estudante e estagiária.** Skincare e maquiagem. Ticket R$ 30 a
R$ 90. Conhece Creamy, Principia, Sallve, Quem Disse Berenice. Compra
influenciada por vídeo e por antes/depois. **Ela não sabe para que serve
ácido glicólico**, e o post não explica.

**Camila, 31, cacheada, cabelo é rotina.** Ticket R$ 50 a R$ 150. Compra
Widi Care, Salon Line, Braé, bn.Cachos. Compra o mesmo produto de novo
quando acaba, então preço por ml importa mais que desconto.

**Jéssica, 36, cabeleireira.** Ela **não é** persona deste canal, e é
justamente ela que o canal estava atendendo por engano.

### O que está chegando

- **24% do canal (47 de 196) é produto profissional ou de atacado.** Shampoo
  Expert Pro Longer 1,5L da L'Oréal (R$ 316,42), Kit Absolut Repair Shampoo
  e Condicionador 1,5L (R$ 605,50), Kit 12 Spray Liso Obrigatório
  (R$ 171,90), microcânula (R$ 289,87), cílios em tufo de 200 unidades.
  *A migration de 04/08 já corrige daqui para a frente; o número está aqui
  para dimensionar o estrago.*
- `Kit` é a primeira palavra de **46 títulos**, quase um quarto do canal.
  Kit de quatro produtos de R$ 400 é decisão grande demais para post de
  oferta.
- **"New Show" abre 14 títulos** — é fornecedor de insumo de extensão de
  cílios dominando o canal.
- **Não é beleza:** escova de dente elétrica Oral-B (R$ 81,90), suporte de
  celular com espelho (R$ 12,74), cera depilatória Tutti Depil.

### O diagnóstico

Bia e Camila estão num canal que fala com Jéssica. O preço não é o problema
(a mediana é R$ 59,78, exatamente a faixa delas): o problema é que os posts
grandes, caros e repetidos são de outra pessoa, e são eles que ocupam a tela.

Fica em aberto, e o `AGENTS.md` já registra: o canal também recebe título
que aponta defeito no corpo de quem lê ("diminui barriga", "pálpebra
flácida"). Isso não expulsa por irrelevância, expulsa por desconforto.

### O que dá para fazer

1. **Um pote, não um kit.** Kit acima de R$ 200 vira exceção rara.
2. **Preço por ml em cabelo**, que é onde a compra é recorrente.
3. **A nota do curador aqui vale mais que em qualquer outro canal depois do
   perfume:** "esse é o que segura o cacho no dia de chuva" não sai de API.
4. **O que Bia quer e não recebe:** para que serve, para qual tipo de pele,
   e ordem de uso. Uma linha resolve.

---

## Radar Pet

**Nicho:** pet · **98 publicações** · mediana R$ 59,45

### A persona

**Duda, 29, um gato e um cachorro pequeno, apartamento.** Ticket R$ 40 a
R$ 180. O que ela compra de verdade, em ordem de frequência: ração, areia,
petisco, antipulgas, brinquedo. **Ração é compra mensal e é o produto-âncora
do nicho inteiro** — quem acerta o preço da ração que a pessoa já usa ganha
a compra sem discussão. Ela compara preço por quilo sem precisar pensar.

### O que está chegando

- **Só 14% é ração ou petisco.** O produto que traz a pessoa ao grupo é a
  minoria do grupo.
- **22% é medicamento veterinário:** Apoquel, Simparic, NexGard, Drontal,
  Advocate, Frontline, Meloxivet, antibiótico Coveli. Converte bem e é
  legítimo, mas **é conteúdo que pede cuidado**: alguns são de prescrição, e
  post de oferta sem "consulte o veterinário" é problema esperando data.
- **14% não é de cão nem de gato:**
  - `Vitagold 1 Litro Suplemento Vitamínico Cavalo Boi Vaca Porco` (R$ 121,25)
  - `Comedouro 1,5kg Bebedouro 2l Aves Galinhas Frango Automático` (R$ 24,90)
  - `Kit 4 Nectar Para Beija Flor Refil 400g` (R$ 76,00)
  - `Bomba Submersa 2000l/h Lagos Recalque Fontes Cascata Chafariz` (R$ 66,00)
    — isso é bomba de jardim, não de aquário.
- **O pior post do canal:** `K-Othrine SC 25 Envu 30 mL` (R$ 12,99).
  K-Othrine é **inseticida de dedetização**. Num canal de pet, onde metade
  do público tem gato dentro de casa, isso é o oposto do que o grupo é.
- `Kit` abre 17 títulos, e `Newpet` abre 6. Repetição de fornecedor de novo.

### O diagnóstico

O canal está tratando "pet" como a taxonomia do marketplace trata: tudo que
é bicho. Duda tem gato e cachorro. Cavalo, boi, porco, galinha e beija-flor
não são o grupo dela, e a bomba de cascata muito menos.

### O que dá para fazer

1. **Restringir a cão e gato**, com aves e aquarismo como secundário raro. É
   exatamente o mecanismo de `ramo_secundario` que o Fitness já usa.
2. **Barrar inseticida e produto de dedetização.**
3. **Puxar ração para o centro do canal** e mostrar preço por quilo.
4. **Linha padrão de responsabilidade nos medicamentos.**

---

## Radar Fitness

**Nichos:** fitness, suplemento · **58 publicações** · mediana R$ 63,40

### As personas

**Lucas, 26, treina cinco vezes por semana.** Ticket R$ 40 a R$ 200. Compra
whey, creatina e pré-treino, e compra por **preço por quilo**, não por
desconto. Ele sabe de cor que creatina boa fica entre R$ 60 e R$ 90 o quilo,
e é por isso que "Creatina 300g por R$ 39,90" não diz nada para ele até ele
fazer a conta que o post não faz.

**Marina, 30, treina, corre no fim de semana.** Ticket R$ 60 a R$ 250.
Compra legging, top, tênis, garrafa, faixa elástica, snack proteico. **Ela
não recebe nada:** o canal tem **zero equipamentos e zero roupas** em 58
publicações.

### O que está chegando

- **34% do canal é creatina.** Vinte publicações de creatina em 58, e várias
  são a mesma coisa com marca diferente: FTW aparece seis vezes, em 150 g,
  300 g, 500 g, 1 kg e três kits.
- **28% é whey.** Somando, **62% do canal são dois produtos.**
- **26% é vitamina e saúde geral, e não é de treino:** `Cabelos e Unhas
  VIDNUTRI`, `Beleza Mulher c/ Biotina`, `Óleo De Prímula`, `Cúrcuma Yoha
  Camila Loures`, `Lavitan Super Fórmula A-Z Homem`, `Psyllium Fibra
  Solúvel`, `Detox em Pó Espirulina`.
- `TESTO ESSENCIAL Feno Grego + Boro + Arginina + ZMA` (R$ 56,77) — categoria
  de promessa hormonal. Não é ilegal e é risco de credibilidade puro, que é
  o ativo que a regra 3.4 protege em outro contexto.
- **0 de 58 é equipamento ou roupa.** Nada de halter, colchonete, corda,
  luva, legging, tênis, garrafa, caneleira.

### O diagnóstico

Não é um canal de fitness, é um canal de pote de pó. Lucas se serve com o
que tem, mas cansa de ver a décima creatina. Marina não tem por que ficar.

### O que dá para fazer

1. **Preço por quilo em todo suplemento.** É a única métrica que essa
   persona usa, e ela é calculável a partir do título na maioria dos casos.
2. **Teto por categoria no dia:** duas creatinas por dia, no máximo.
3. **Abrir o nicho para equipamento e vestuário esportivo**, que hoje
   provavelmente está classificado em moda ou em esporte secundário.
4. **Tirar vitamina de beleza do Fitness.** `Cabelos e Unhas` e `Beleza
   Mulher` são do Beauty, e no Beauty seriam ótimos posts.

---

## A comunicação e o tom de voz

O modelo é **um só, global, para os sete canais** (`canal_id` nulo, nenhum
modelo específico existe). Ou seja: o canal de bebê e o canal de perfume
masculino falam exatamente igual.

O template atual:

```
#publi · Mercado Livre

🔥 <b>Creme Para Pentear Hipoalergico</b>

❌ De <s>R$ 63,65</s>
✅ <b>Por R$ 44,90</b>  <b>(−29%)</b>

⚡ Caiu nas últimas horas: vimos o preço mudar.
🏪 BEAUTY__RB

🚚 Frete grátis

🛒 <a href="https://meli.la/1QU5nyS">Compre aqui</a>
```

### O que está certo, e é bastante

- `#publi` na primeira linha, antes de qualquer coisa. Cumpre a regra 3.10
  do jeito que ela pede, e a maioria do mercado não cumpre.
- De/Por com o preço antigo riscado. É o padrão que o público brasileiro lê
  sem esforço.
- Link como texto clicável em vez de URL crua.
- A linha de frete só aparece quando existe.
- Foto do produto junto, quando há.

### O que está errado

1. **O nome do vendedor cru.** `BEAUTY__RB`, `RPPET`, `mypetone`, `Atentu`.
   Isso não gera confiança, gera dúvida: parece código de sistema. Onde há
   `Loja oficial` a linha funciona; onde há código de seller da Shopee, ela
   trabalha contra. **Trocar por reputação e volume** ("4,8 ★ · 2 mil
   vendas") usa dado que já está em `anuncio.avaliacao` e
   `anuncio.reputacao_vendedor` e diz o que a pessoa quer saber. Quando não
   houver nada disso, a linha some, como a do frete.

2. **🔥 em 100% dos posts.** Emoji de urgência em tudo deixa de significar
   urgência. Reservar o 🔥 para nota alta e usar um marcador neutro no resto
   devolve o significado dele.

3. **A linha de queda sem número** (G-03). Ou traz o "baixou 18%", ou não
   sai.

4. **Não há voz.** Nenhuma frase no canal foi escrita por uma pessoa. Todo
   post é dado formatado. Um canal de oferta brasileiro que funciona tem
   alguém dentro dele, e a estrutura para isso já existe (`nota_curador`,
   `{nota}`, modelo por canal), sem uso.

5. **Não há chamada nem contexto de urgência real.** "Compre aqui" é neutro
   e não diz nada sobre a oferta acabar. Onde houver dado de estoque ou de
   validade de cupom, é a informação mais útil que a mensagem pode carregar.

6. **Sete canais, uma personalidade.** O Kids poderia falar com mãe cansada,
   o Geek com quem entende a referência, o Perfumes em primeira pessoa. O
   modelo por canal já existe no schema desde 28/07 e nunca foi usado.

---

## As cinco coisas, em ordem

Ordenado por dano evitado, não por esforço.

1. **Derrubar o teto de 150 e fazer o publicador respeitar
   `horarios_permitidos`.** Nenhum outro conserto importa se a pessoa
   silenciou o grupo. (G-01)
2. **Achar a origem dos instrumentos musicais no Geek.** Um terço de um
   canal inteiro, num roteamento só. (Geek)
3. **Escrever nota do curador nos produtos que forem publicar hoje**, mesmo
   que em cinco por dia. É o diferencial declarado do projeto e ele está
   invisível. (G-02)
4. **Restringir o Pet a cão e gato, e barrar inseticida.** (Pet)
5. **Faixa etária no Kids e preço por quilo no Fitness.** As duas
   informações que decidem a compra dessas duas personas, e as duas saem do
   título. (Kids, Fitness)

Fica registrado o que **não** foi mexido aqui: este documento é diagnóstico,
não conserto. Nenhuma linha de código ou de dado de produção foi alterada
para escrevê-lo.
