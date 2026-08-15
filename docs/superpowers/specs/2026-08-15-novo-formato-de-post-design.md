# Novo formato de post do Radar Delas

Decisão de conteúdo, para o dono aprovar antes de virar código. O plano de
execução está em `docs/superpowers/plans/2026-08-15-novo-formato-de-post.md`.

Nasceu do teste de 15/08/2026: cinco promos escritas à mão e mandadas ao
grupo, que o dono aprovou (*"AMEEEI essa nova versão, adorei essa versão de
ícones, mensagem"*). Este documento é a tentativa de dizer, com precisão
suficiente para virar código, o que aquelas cinco tinham que as nossas não
têm.

---

## 1. O formato, lado a lado

**Hoje** (modelo do canal `1b22b636`, o Radar Delas do WhatsApp):

```
{gancho}

{emoji} <b>{produto}</b>

{nota}

de <s>{preco_antes}</s> por <b>{preco}</b>
<b>{desconto}% off</b> 😮‍💨

{lastro}
{cupom}
{frete}
🏪 {vendedor}

🛒 {link}

#publi · {loja}
```

**Aprovado:**

```
{emoji} {produto_curto}

{descricao}

{lastro}
De ~{preco_antes}~ por *{preco}*
⭐ {nota} ({avaliacoes} avaliações)

🛒 {link}
```

O que saiu, e o motivo de cada um:

| Saiu | Por quê |
|---|---|
| `{gancho}` como primeira linha | virou a descrição, e ela desceu para baixo do produto |
| `{desconto}% off` | o de/por já mostra a diferença, e a linha custava espaço |
| `{frete}` | não é o que decide a compra em produto de beleza barato |
| `{vendedor}` | idem, e era a linha mais longa do post |
| `{cupom}` | continua existindo no post de cupom, que é outro tipo |
| `#publi · {loja}` | decisão do dono em 15/08, ver §6 |
| espaço entre lastro, preço e avaliação | os três viraram um bloco só, colados |

**O bloco colado é o achado visual.** Lastro, preço e avaliação são a mesma
informação (quanto custa e se vale), e separá-los em três parágrafos fazia o
post ocupar tela sem dizer mais nada.

---

## 2. A descrição, e o vício que ela precisa não ter

A descrição é uma ou duas frases, escritas por IA, logo abaixo do título.
Substitui o gancho, que hoje vive em `lib/gancho.ts` e fica acima do produto.

### A medição de 15/08, e ela é pior do que o dono descreveu

Rodamos o gerador de hoje em dez produtos de beleza do catálogo de produção,
com a voz do canal e a lista de `recentes` ligadas, como em produção:

| Título | O que a IA escreveu |
|---|---|
| Creme Para Pentear Natuhair Óleo De Rícino 1kg | `cabelo desembaraçado antes do café esfriar` |
| Aspa Sprayset Dry Clean Shampoo Sem Água 150ml | `cabelo limpo antes do primeiro alarme` |
| Desodorante Roll-On Avon Care Neutro 48ml | `pele seca o dia inteiro sem cheiro de nada` |
| Gel Creme Hidratante Facial Garnier | `pele sequinha o dia inteiro sem melancar` |
| Batom Líquido Longa Duração Efeito Gloss | `batom que sobrevive ao almoço` |
| Corretivo Líquido Matte Payot Tom 2.5 | `olheiras sumiram sem pesar no rosto` |
| Protetor Solar Facial com Cor FPS 70 L'Oréal | `maquiagem e protetor num passo só` |
| Aparador De Pelos Mondial BG-10 | `acertar a barba sem sair de casa` |
| Henna Creme Sobrancelha Indiana Beauty | `sobrancelha pronta pra semana toda` |
| Barbeador Elétrico Kemei KM-TX1 | `rosto lisinho antes do café esfriar` |

**Três defeitos, e o terceiro é o que ninguém tinha visto:**

1. **Seis das dez ancoram em relógio.** `antes do café esfriar` (duas vezes),
   `antes do primeiro alarme`, `o dia inteiro` (duas vezes), `sobrevive ao
   almoço`, `pra semana toda`. É o tique que o dono apontou.

2. **Duas são cópia literal dos nossos exemplos.** O prompt tem
   `batom que sobrevive ao almoço` e `cabelo seco antes do café esfriar`. A
   IA devolveu `batom que sobrevive ao almoço`, idêntico, e
   `cabelo desembaraçado antes do café esfriar`. Não é inspiração, é cópia.
   O arquivo já sabia disso desde 11/08: *"modelo de linguagem copia o
   REGISTRO dos exemplos muito antes de obedecer à instrução"*. Continua
   valendo, e agora com prova.

3. **As dez usam o mesmo modo.** O prompt oferece seis; a IA usou um, a "cena
   real". Nenhuma opinião, nenhuma confidência, nenhum exagero, nenhum soco.
   Nenhuma tem emoji. Nenhuma soa como a amiga que a voz do canal descreve.
   E **nenhuma foi reprovada pela validação** — o gargalo não é o filtro, é
   o prompt.

Numa rodada anterior, com produtos de música, o colapso foi o mesmo com outro
tema: `na sala`, `pela casa`, `em qualquer canto da sala`, `pela casa` em
quatro de dez. Troca o assunto, mantém a forma.

### A causa estrutural, e por que pedir variedade não resolve

O prompt diz, com todas as letras: *"1. A CENA REAL, e é o modo mais usado"*.
Depois oferece mais cinco e pede para variar. Um modelo de linguagem, lendo
isso, faz o que foi mandado: usa o mais usado, sempre.

A lista de `recentes` também não salva. Ela manda não repetir a abertura e a
piada, e o modelo obedece trocando as palavras enquanto mantém a forma:
`cabelo limpo antes do primeiro alarme` não repete `café`, e é a mesma frase.

**A correção é tirar a escolha do modelo.** O modo é sorteado no código,
antes da chamada, e o prompt recebe **um modo só**, com os exemplos daquele
modo e de mais nenhum. O modelo não escolhe entre cinquenta, ele executa um.
É a mesma lição da regra 3.4 e da 3.11 neste projeto: o que vira código é
regra, o que fica no prompt é pedido.

### Os cinquenta modos

Cinquenta porque oito não é variedade: uma pessoa escrevendo no grupo não
alterna entre oito formas, ela fala do que der na telha. Estão agrupados em
seis famílias, e a família serve à distribuição, não ao prompt: o prompt vê
um modo por vez.

**Distribuição alvo:** a família A (relato pessoal) soma no máximo **um post
em cada quatro**, o que responde à ressalva do dono (*"vai parecer que é
mentira, se a gente já usou tudo"*). As outras cinco dividem o resto.

#### Família A: quem fala usou (peso 25%)

1. **Uso recente** · `usei a semana toda e não larguei mais`
2. **Uso prolongado** · `tô no terceiro pote desse`
3. **Recompra** · `esse eu já repus duas vezes`
4. **Comprei pra alguém** · `comprei pra minha mãe e ela não devolveu`
5. **Tomaram de mim** · `deixei na pia e minha filha adotou`
6. **Indicação de quem entende** · `minha cabeleireira que mandou comprar`
7. **Descoberta acidental** · `entrei pra comprar outra coisa e saí com esse`
8. **Demorei demais** · `passei anos sem e não sei por quê`
9. **Cético convertido** · `comprei achando que era exagero, não era`
10. **Voltei pra ele** · `testei outros e voltei pra esse`

#### Família B: o que o produto é (peso 25%)

11. **Textura** · `a textura some na pele, não fica pegajoso`
12. **Cheiro** · `o cheiro é de chocolate com pimenta, sem enjoar`
13. **Formato** · `o bastão é fino, dá pra desenhar antes de esfumar`
14. **Rendimento** · `uma bisnaga dessas dura mais que parece`
15. **Como se aplica** · `esfuma com o dedo, não precisa de pincel`
16. **O que vem junto** · `vem com espátula, não precisa enfiar a mão no pote`
17. **Acabamento** · `seca fosco de verdade, não fica aquele brilho estranho`
18. **O ativo** · `é niacinamida de verdade, não é só o nome no rótulo`
19. **Faz duas coisas** · `substitui o primer e o protetor de uma vez`
20. **O que ele não faz** · `não marca poro e não craquela`

#### Família C: para quem serve (peso 15%)

21. **Tipo de pele** · `quem tem pele oleosa vai gostar desse`
22. **Tipo de cabelo** · `cacheada aqui, e esse não pesou`
23. **Iniciante** · `se você tá começando no skincare, é por aqui`
24. **Sensível** · `sem perfume, então pele sensível aguenta`
25. **Quem tem pressa** · `pra quem não tem paciência de fazer dez passos`
26. **Quem já tentou tudo** · `se nenhum funcionou até agora, tenta esse`
27. **Pele madura** · `funciona bem em pele madura, sem craquelar`
28. **Homem da casa** · `comprei achando que era pra mim, ele confiscou`

#### Família D: o que o mundo diz (peso 15%)

29. **Viral** · `esse é o que tá em todo vídeo agora`
30. **Esgotado** · `vive esgotado nas lojas grandes`
31. **Fila de espera** · `tem lista de espera nas farmácias`
32. **Todo mundo pergunta** · `todo mundo perguntando qual é o da foto`
33. **O dupe** · `faz o que o importado faz, custando o que custa`
34. **O que a profissional usa** · `é o que as maquiadoras usam no set`
35. **Queridinho antigo** · `esse é dos antigos, e continua funcionando`
36. **Recomendação de dermato** · `dermato vive indicando esse`

#### Família E: a cena, sem relógio (peso 10%)

37. **Cabe na bolsa** · `cabe no bolso da bolsa e resolve fora de casa`
38. **Viagem** · `dá pra levar na mala sem medo de vazar`
39. **Calor** · `no calor ele não escorre, que é o que importa`
40. **Chuva e umidade** · `segurou o cacho até na garoa`
41. **Academia** · `aguenta o treino sem virar borrão`
42. **Retoque** · `dá pra retocar sem tirar o resto da make`
43. **Problema resolvido** · `acabou a história de dormir de touca`

#### Família F: a forma da frase (peso 10%)

44. **Pergunta ao grupo** · `alguém aqui já testou esse?`
45. **Veredito seco** · `esse segura mesmo`
46. **Aviso curto** · `esse acaba rápido, é o aviso`
47. **Confissão** · `confesso que comprei pela embalagem`
48. **Exagero honesto** · `guardei os outros três e fiquei só com ele`
49. **Contraste** · `achei que ia ser mais um, não foi`
50. **O soco** · `esse é o BOM mesmo`

### O registro

- Minúscula, como quem digita rápido. Maiúscula só numa palavra, e raro.
- De 6 a 20 palavras. Uma frase, duas no máximo.
- No máximo um emoji, e a maioria não leva nenhum.
- Fala do que o produto **é** ou **faz**, nunca do preço.

### O que vira validação, não pedido

**O tique de relógio.** Reprova a linha:

```
/\b(caf[ée]|almo[çc]o|jantar|manh[ãa]|madrugada|alarme|dia inteiro|o dia todo|semana toda|\d+\s*h(oras?)?)\b/i
```

**A cópia do exemplo.** Se a linha devolvida for igual, ou quase, a um dos
exemplos que mandamos, ela é recusada. Foi o defeito mais gritante da
medição, e não havia nada olhando para ele.

**O carimbo de lugar**, que apareceu na rodada de música e vai voltar:
`na sala`, `pela casa`, `em qualquer canto` como fecho de frase. Entra na
mesma lista dos gastos.

### O que a blocklist atual barra e não deveria

As duas frases que o dono mais elogiou seriam **recusadas hoje**:

| Frase aprovada | Regra que barra | Onde |
|---|---|---|
| `Gente, esse gloss é viciante 😍` | `/^gente[,!\s]/i` | `lib/gancho.ts` |
| `Esse blush eu amei 🥰` | `/\bamei\b/i` | `lib/gancho.ts` |

Elas entraram na lista como vício de canal de promoção, e levaram junto o
jeito de falar que o dono quer. **Decidido em 15/08:** `amei` e `gente` saem
da lista. `amigas`, `meninas`, `corre`, `imperdível`, `socorro`, `arrasou` e
`top` ficam, porque são de locutor e não de pessoa.

## 3. O título curto

**Medido em 15/08, sobre 1.000 produtos de produção:**

| Medida | Caracteres |
|---|---|
| Mediana | 62 |
| p90 | 101 |
| Máximo | 200 |
| Acima de 60 | 51% dos produtos |

Metade do catálogo tem título que estoura uma linha e meia no celular. Caso
real:

```
Fone De Ouvido In ear Soundcore P20i Bluetooth 5.3 Grave Potente Drivers
10mm 30h Bateria Carregamento Rápido Personalização De Som Via App Ipx5 2
Mics Ia Para Chamadas Claras Case Compacto Cor Branco
```

### A regra: encurtar sem mentir

**Teto: 55 caracteres.** Acima disso, encurta; abaixo, passa direto.

**O que PRECISA sobreviver**, porque muda a decisão de compra:

- marca (`Sallve`, `Cosrx`, `Payot`)
- o que a coisa é (`protetor solar em bastão`, `blush cremoso`)
- especificação que diferencia a versão: **FPS, ml, g, tom, tamanho, quantidade**
- linha ou submarca quando é o nome pelo qual se conhece (`Boca Rosa Beauty`, `Creamy Cheeks`, `Snail 96`)

**O que sai:**

- adjetivo de vendedor (`potente`, `premium`, `original`, `promoção`)
- lista de compatibilidade (`para iPhone Xiaomi Motorola LG`)
- repetição da marca
- ficha técnica que não escolhe a versão (`drivers 10mm`, `bluetooth 5.3`)
- `Cor Branco` no fim, quando a cor não é o produto (em maquiagem, o tom **fica**)

**Exemplos, com o original ao lado:**

| Original | Curto |
|---|---|
| `Base matte Payot Boca Rosa Beauty 30ml tom 3 Francisca cobertura alta` | `Base Boca Rosa Beauty by Payot, tom 3 Francisca` |
| `Protetor Solar Em Bastão Com Cor 6 15g Sallve` | `Protetor Solar em Bastão Sallve FPS 90, 15g` |
| `Essência de Caracol Cosrx Advanced Snail 96 Mucin Power Essence 100ml` | `Cosrx Advanced Snail 96 Mucin Essence, 100ml` |
| `Blush Cremoso Ruby Rose Linha Rosa - Creamy Cheeks Tom Da Maquiagem Rosy Dawn` | `Blush Cremoso Ruby Rose Creamy Cheeks, Rosy Dawn` |
| `Chocochilli Gloss Fran By Franciny Ehlke Acabamento Brilhante 4g` | `Gloss Chocochilli, Fran by Franciny Ehlke` |

**A validação que impede mentira:** o título curto só é aceito se **todo
número e unidade que ele contém aparecer no original**. Inventar `FPS 70`
onde o original diz `FPS 90` é o mesmo erro da regra 3.4 aplicado a outro
campo, e já aconteceu com o gancho em 11/08 (36 pacotes viraram sessenta).
Falha na validação usa o título original truncado, e o post sai.

---

## 4. O lastro por faixa de tempo

Hoje a mensagem diz `👀 Menor preço que observamos desde 02/08`. O dono quer
tempo decorrido, não data: *"não precisa colocar exatamente desde o dia dois"*.

### O que existe no banco

`oferta.dias_de_serie` já é calculado e gravado. A distribuição real, medida
em 15/08 sobre as 1.000 ofertas mais recentes:

| Idade da série | Ofertas | % |
|---|---|---|
| mesmo dia | 0 | 0% |
| 1 dia | 308 | 30% |
| 2 a 6 dias | 566 | 56% |
| 7 a 13 dias | 126 | 12% |
| 14 a 29 dias | 0 | 0% |
| 30 ou mais | 0 | 0% |

### As faixas

O dono definiu 30 dias para "histórico", que é **mais conservador que a regra
3.4** (14 dias). Fica o dele.

| Idade | Linha |
|---|---|
| 30 dias ou mais | `🔥 *Menor valor histórico!*` |
| 14 a 29 dias | `🔥 *Menor preço do último mês*` |
| 7 a 13 dias | `📉 *Menor preço da semana*` |
| 2 a 6 dias | `📉 *Menor preço em dias*` |
| 1 dia | `👀 *Mais barato que ontem*` |
| mesmo dia, preço caiu de novo | `⚡ *Baixou de novo hoje*` |
| queda medida entre duas leituras | `⚡ *Baixou {queda}% desde ontem*` |

**Duas coisas que o dono precisa saber antes de aprovar:**

1. **`🔥 Menor valor histórico!` não vai aparecer em post nenhum até
   setembro.** Nenhuma oferta tem 30 dias de série, porque o sistema começou
   a ler em agosto. Hoje 98% dos posts cairiam em "menor preço em dias" ou
   "mais barato que ontem".
2. **`mesmo dia` é 0% hoje** porque a coleta roda uma vez por dia. A linha
   `⚡ Baixou de novo hoje` só passa a existir se houver releitura
   intradiária, que é trabalho separado e não está neste plano.

---

## 5. O link

Sempre o encurtado do gerador (`meli.la/...` no Mercado Livre,
`shortLink` na Shopee). Já é o que `lib/gerador-ml.ts` e `lib/shopee-api.ts`
devolvem, e o publicador já usa. **Nada a fazer aqui**, ficou registrado
porque o dono pediu e vale confirmar que já está certo.

Colado no `🛒`, mesma linha, sem quebra.

---

## 6. O rodapé de loja e o `#publi`

Os dois saem do post, por decisão do dono em 15/08.

**`#publi`:** a regra 3.10 do `AGENTS.md` o exige, citando CONAR e CDC. O
dono contestou a base: *"nenhum grupo faz, veremos depois pesquisando se
realmente é obrigatório, você tá enviesado porque a doc tá dizendo, mas
ninguém sabe se a doc tá certa"*. Ele tem razão em pelo menos um ponto: a
regra foi escrita por agentes a partir de `docs/pesquisa-operacao.md`, sem
verificação em fonte primária.

**Fica assim:** sai agora, e a pesquisa em fonte primária (CONAR, CDC art.
36, termos de afiliado da Shopee e da Amazon) entra como tarefa separada,
com citação, antes de a decisão virar definitiva. Este documento não a
resolve.

**`· {loja}`:** sai sem ressalva. O nome do marketplace não ajuda quem lê e
ocupava a última linha.

---

## Fora do escopo deste documento

- Releitura de preço intradiária (necessária para a faixa "mesmo dia")
- Pesquisa em fonte primária sobre `#publi`
- Aplicar o formato aos outros oito canais: começa só no Radar Delas
- Post de cupom, que tem molde próprio (`montaMensagemDeCupom`)
