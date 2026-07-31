# Refino visual — o que separa o painel de "correto" de "bonito"

Escrito em 31/07/2026, depois da **primeira vez que alguém viu as telas**. Até
aqui o painel tinha sido revisado lendo código; agora existe `pnpm telas`, que
fotografa as treze telas logadas, e o diagnóstico abaixo é feito em cima das
fotos, não de suposição.

O ponto de partida foram cinco referências trazidas pelo dono — painéis de
tarefa, de receita, de gente e de faturamento. A pergunta não é "como copiar
aquilo", é: **o que aquelas telas têm que a nossa não tem, e qual delas serve a
uma operação de curadoria?**

---

## 1. O diagnóstico, em uma frase

O painel está **correto, honesto e plano**. Ele acerta o conteúdo — cada tela diz
a regra que obedece, cada número tem legenda, nenhum estado vazio é mudo — e erra
a **forma**: tudo vive na mesma camada, alinhado à esquerda, com um terço da tela
sobrando à direita.

Isso não é falta de talento visual. É consequência direta de três decisões
tomadas por bons motivos, que hoje cobram um preço que não cobravam antes.

---

## 2. O que as referências têm

Separando o que é moda do que é ofício:

| O que elas fazem | Por que funciona | Temos? |
|---|---|---|
| **Elevação em repouso** — o cartão flutua um pouco sobre um fundo levemente cinza | separa camadas sem desenhar borda; o olho lê "objeto", não "retângulo" | **não** |
| **Coluna de contexto à direita** — a lista à esquerda, o resumo do item selecionado à direita | mata o vazio e dá lugar fixo para número e gráfico | **não** |
| **Micro-gráfico dentro da linha** — sparkline, anel, barra empilhada | o número diz *quanto*; o desenho diz *para onde vai* | só o anel da nota |
| **Números grandes com rótulo pequeno** | hierarquia de leitura: o olho pousa no valor, depois entende o que é | parcialmente |
| **Cor como dado, não como marca de terceiro** — tint suave, texto escuro | dois verdes saturados numa tela brigam; tint não briga | **não** |
| **Ação que aparece no hover da linha** | doze linhas × três botões = trinta e seis alvos competindo | **não** |
| **Densidade confortável** — linha baixa, respiro no lugar certo | cabe mais decisão na dobra sem virar planilha | **não** |

E o que elas **não** fazem, e nós também não devemos: gráfico que não responde
pergunta, ícone decorativo, gradiente em texto, sombra dura.

---

## 3. As três decisões que cobram o preço

Nenhuma delas foi erro. Todas foram registradas com motivo, e é por isso que
mudá-las exige argumento novo, não gosto.

**"Só elevação real. Nada de sombra em elemento que não flutua"** (`design.md`).
Nasceu contra sombra decorativa espalhada sem critério. O efeito colateral é que
**cartão, tabela, KPI e faixa vivem todos na mesma camada**, separados por uma
borda de 1px quase invisível (`#e9eaee`). O que a regra queria evitar era sombra
*aleatória*, não elevação *sistemática*.

**Os KPIs têm largura mínima e não crescem** (`design.md`). Nasceu de três
retângulos de 500px com um número perdido no meio — problema real. Mas a
correção resolveu o número perdido criando **um vazio de 40% à direita** em toda
tela que tem KPI.

**`Pagina` declara uma medida** (`estreita`/`media`/`larga`/`cheia`). Resolveu as
cinco larguras diferentes, e é uma boa peça. Só que ela **não centraliza**: em
`/ajustes/curadoria` o conteúdo para em 1.115px de 1.449, e os 330px restantes
ficam vazios — não como respiro, como sobra.

---

## 4. As seis frentes

Em ordem de quanto mudam a percepção por unidade de trabalho.

### F1 · Camada e elevação — *a que muda tudo, e é a mais barata*

Trocar a regra "nada de sombra em repouso" por **duas elevações nomeadas**:

| Token | Uso | Valor proposto |
|---|---|---|
| `--shadow-repouso` | cartão, faixa de KPI, tabela | `0 1px 2px rgba(20,22,26,.04), 0 1px 3px rgba(20,22,26,.06)` |
| `--shadow-erguido` | item em hover, item selecionado, popover | `0 4px 12px rgba(20,22,26,.08)` |

Junto: borda cai para `--borda-sutil` onde há sombra (borda **e** sombra fortes
juntas é o que deixa aparência de wireframe), e o fundo da página escurece um
tom para o branco do cartão ter contra o quê flutuar.

**Custo:** dois tokens e uma passada no `Cartao`. **Efeito:** todas as treze
telas ao mesmo tempo.

### F2 · Coluna de contexto — *a que mata o vazio*

`Pagina` ganha uma variante de duas colunas: conteúdo à esquerda, **coluna de
contexto de ~320px à direita**, colada no rolar. É exatamente o que a referência
azul faz com o painel "Design Team".

O que vai em cada tela — e nenhum deles é enfeite, todos já são pergunta que a
tela responde mal hoje:

- **`/aprovar`** — capacidade por canal (a barra que hoje é só o número "18
  vagas"), distribuição por nicho da fila de hoje, e o que as comportas
  barraram. Hoje isso ou não existe ou está espremido no topo.
- **`/publicar`** — o canal da vez, quanto já saiu hoje, e a variedade da fila.
- **`/canais`** — o canal selecionado, com série de publicação e split.
- **`/ajustes/curadoria`** — o efeito do limiar que está sendo mexido: quantas
  ofertas ele barrou nos últimos 7 dias. A tela promete isso no subtítulo e
  entrega um "—" perdido no topo.

**Custo:** uma variante de layout, e uma peça de contexto por tela.

### F3 · A fila deixa de ser tabela e vira lista de decisão

A tela mais importante do produto é `/aprovar`, e hoje ela é uma tabela com
**três botões repetidos em cada uma das doze linhas** — trinta e seis alvos
laranja e brancos formando uma faixa vertical que puxa o olho para a direita,
longe do produto.

- Ações **aparecem no hover** e no foco do teclado, com atalho de teclado
  visível (`A` aprovar, `R` rejeitar, `D` adiar). O alvo permanente vira um só.
- A linha ganha **sparkline da série de preço** — 30 dias em 80px. É a informação
  que decide a oferta e hoje exige abrir o painel.
- Preço, desconto e comissão viram **um bloco numérico alinhado à direita**, com
  `tabular-nums`, em vez de três colunas soltas com 200px de vazio entre elas.
- Altura da linha cai de ~116px para ~76px: mais decisão acima da dobra.

### F4 · Micro-gráfico como parte do sistema

Nada de biblioteca. **SVG escrito à mão**, três peças, todas alimentadas por dado
que já existe:

- `Sparkline` — série de preço na linha e no cartão de produto
- `BarraDeCapacidade` — vagas usadas/restantes por canal, empilhada
- `Anel` — já existe na nota; vira componente e passa a servir taxa de aprovação

Motivo de não instalar biblioteca: as três somam menos de 200 linhas, e uma
dependência de gráfico entra pesada no limite de 3 MiB do Worker (D-016).

### F5 · Cor e chip

O verde do WhatsApp e o azul do Telegram entram hoje **saturados e cheios**, ao
lado do laranja da marca. Três marcas brigando na mesma linha.

- Chip de plataforma vira **tint**: fundo claro da cor, texto escuro dela, e um
  ponto de 6px na cor cheia. A identidade se mantém, a briga acaba.
- Nota ganha **escala de cor** própria (vermelho→âmbar→verde), hoje é só laranja
  e verde.
- A marca laranja fica reservada para **uma ação por bloco** — hoje ela aparece
  doze vezes na mesma tela, e o que aparece doze vezes não destaca nada.

### F6 · Tipografia dos números

A escala está boa para texto e **pequena para dado**: o KPI usa 24px, e nas
referências o número-chave vive entre 32 e 40px. Proposta: um `--text-3xl` de
32px só para número de KPI e valor de contexto, com o rótulo caindo para 11px em
`tracking-eyebrow`. Contraste de tamanho é o que faz o olho pousar no valor.

---

## 5. O que também apareceu nas fotos, e é conserto pontual

- **Duas buscas na mesma tela.** `/produtos` tem "Buscar no catálogo" na barra
  superior e outro campo idêntico no corpo. Um dos dois sai.
- **A barra lateral tem um buraco vertical de ~400px** entre "Modelos de
  mensagem" e "Colheita de hoje". O bloco de colheita deve subir e virar rodapé
  fixo da barra, ou o buraco vira algo — o próximo passo da trilha de arranque,
  por exemplo.
- **`/ajustes/curadoria` são doze cartões idênticos empilhados**, cada um com seu
  próprio botão "salvar". Doze botões de salvar numa tela é o sintoma. Agrupar em
  três famílias (*o que é oferta*, *o que é repetição*, *o que é prazo*) e salvar
  por família.
- **KPI vazio mostra "—" três vezes.** Quando não há dado, o lugar certo é uma
  frase, não três traços.

---

## 6. O que NÃO muda

- **Nenhuma tela nova, nenhuma fase antecipada.** Isto é forma do que já existe.
- **Nenhum gráfico sem pergunta.** Todo desenho proposto responde a algo que a
  tela já tenta responder com texto.
- **A honestidade continua acima da beleza.** A faixa de operação simulada, os
  avisos de lastro, a identificação publicitária e os estados vazios explicativos
  não saem, não encolhem e não viram ícone.
- **Monoespaçado continua só para texto literal.** Dinheiro é `tabular-nums`.

---

## 6b. O que já foi feito

**F1, F6 e os consertos da seção 5 — 31/07.** Duas elevações nomeadas pelo
estado (`repouso`, `erguido`), fundo um tom mais escuro para a sombra existir,
borda sutil onde há sombra. Rótulo de indicador virou sobrescrito e o valor
subiu para 32px; indicador sem dado mostra a frase, não o traço. Busca duplicada
de `/produtos`, rodapé da barra lateral e as três famílias de limiar.

**F3 — 31/07.** A fila virou lista de decisão:

- **Sparkline de 30 dias na linha** (`app/componentes/Sparkline.tsx`), com a
  mediana tracejada. A informação que decide a oferta estava só dentro do painel.
- **Preço, desconto e comissão viraram um bloco só**, alinhado à direita. Eram
  três colunas soltas com ~200px de vazio entre números que só se leem juntos.
- **O laranja saiu de doze botões cheios.** "Aprovar" fica em tinta da marca em
  repouso e vira laranja cheio na linha sob o cursor ou com foco de teclado.
- **Altura da linha caiu de ~116px para ~79px**, o que põe as doze ofertas na
  mesma tela.

**F2 e F5 — 31/07.** `Pagina` ganhou `mx-auto` (a medida empurrava tudo para a
esquerda, e o resto virava vazio de um lado só) e a propriedade `contexto`, que
abre a coluna de 320px colada no rolar. Duas telas já a usam, e nas duas ela
resolve uma promessa que o topo não cumpria:

- **`/ajustes/curadoria`** — o subtítulo diz que o efeito fica *ao lado* do
  controle, e ele era uma faixa que rolava para fora da tela no primeiro limiar.
- **`/publicar`** — "faltam 5 de 8" existe para dar noção de fim no meio do
  trabalho, e sumia da vista no terceiro item.

O chip de plataforma virou **tinta com ponto de cor** (`ChipDePlataforma`), com
tokens próprios de fundo e texto. Verde e azul cheios ao lado do laranja eram
três marcas competindo, e a que perdia era a nossa. O texto escurece porque o
verde da marca do WhatsApp sobre fundo claro dá 3,0:1 — abaixo do mínimo. A cor
cheia continua no botão de publicar, onde ela **é** a informação.

**Ficou de fora, de propósito:** os atalhos de teclado (`A`, `R`, `D`). Eles
exigem componente de cliente com noção de "linha ativa" e gestão de foco, e isso
é trabalho de outra ordem de grandeza — a linha hoje é HTML puro com formulários
de servidor, e vale manter assim até haver quem use a tela todo dia para dizer
se o atalho faz falta.

---

## 7. Ordem sugerida

1. **F1 (elevação)** — duas linhas de token, efeito nas treze telas
2. **F6 (números)** + os consertos pontuais da seção 5 — baratos, visíveis
3. **F3 (fila de decisão)** — a tela que mais importa
4. **F2 (coluna de contexto)** — a maior mudança estrutural
5. **F4 (micro-gráfico)** — depende de F2 e F3 para ter onde morar
6. **F5 (cor e chip)** — última porque é a mais fácil de refazer depois

Depois de cada frente: `pnpm telas` e olhar. É para isso que ele existe.
