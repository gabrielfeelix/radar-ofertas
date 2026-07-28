# Design system

O que existe hoje, e por quê. Os valores aqui vieram do protótipo — não foram inventados. O que mudou em relação a ele está marcado, com o motivo.

**Escopo deliberado:** cor, tipografia, espaçamento, raio, sombra e botão. **Card não entra ainda**, e isso é decisão: card de oferta é o componente que mais carrega decisão de produto, e o que a oferta mostra ainda vai mudar. Congelar o card agora é congelar a discussão errada.

A fonte de verdade é `app/globals.css`. Este documento explica; o CSS executa.

---

## O que o protótipo revelou

Levantamento do `Radar de Ofertas.dc.html`, que **não está neste repositório** — ele vive no projeto de design do Claude, `claude.ai/design/p/8a12d079-d3de-4ed0-b8b4-f5f427a1c97e` ("Fila de aprovação e sistema"), junto com as capturas de tela. Abra o protótipo antes de mexer em interface: este documento tem os valores, ele tem a intenção.

Uma limitação a saber antes de tentar: aquele projeto é do tipo comum, **não é design system**. O `/design-sync` só escreve em projeto criado como design system, e o tipo é definido na criação e não muda. Sincronizar componente daqui para lá exige um projeto novo — decisão que ainda não foi tomada.

| | Encontrado | Proposto |
|---|---|---|
| Cores | 88 hexes, **44 usados uma vez só** | 28 tokens |
| Tamanhos de fonte | 26, com passos de 0,5 px | 7 |
| Espaçamento | 718 valores, **34% na grade de 4** | 8 degraus, grade de 4 |
| Raio de borda | 18 valores | 5 |
| Botão primário | **9 formas para 10 botões** | 1 forma, 3 tamanhos |

O botão primário é o caso que mais importa: é o elemento mais visível do produto e não tinha forma. A sombra laranja aparecia em 2 dos 10 — quem abrisse duas telas via dois botões primários diferentes.

Nada disso é crítica ao protótipo. Protótipo serve para descobrir o que o produto quer parecer, e ele descobriu. Sistematizar é a etapa seguinte, não a correção de um erro.

---

## Contraste — a única mudança que não é consolidação

O cinza mais usado do protótipo **reprova em legibilidade**, e por margem larga:

| Cinza | Usos | Contraste | Veredito |
|---|---|---|---|
| `#14161A` | 47 | 18,1:1 | passa |
| `#4B5563` | 37 | 7,6:1 | passa |
| `#6B7280` | 83 | 4,8:1 | passa |
| **`#9AA0AA`** | **104** | **2,6:1** | **reprova** |
| `#A3A8B0` | 44 | 2,4:1 | reprova |
| `#8A9099` | 13 | 3,2:1 | só texto grande |
| `#B6BBC3` | 3 | 1,9:1 | reprova |

Texto normal exige 4,5:1 (WCAG AA). O `#9AA0AA` é o cinza dos eyebrows e das legendas — ou seja, **exatamente o texto que o operador lê de manhã, no celular, possivelmente na rua, com a tela no brilho automático.**

Não existe conserto que mantenha quatro níveis: para chegar a 4,5:1 o terciário teria que virar `#6F7783`, indistinguível do secundário. Então são **três níveis de texto**, todos legíveis, e o cinza claro é rebaixado a uso não textual — borda, ícone decorativo, estado desabilitado.

Isso é perda real de sutileza visual. Vale mesmo assim: uma ferramenta usada todo dia, com pressa, precisa ser lida sem esforço.

---

## Cores

### Superfície e borda

| Token | Valor | Uso |
|---|---|---|
| `--cor-fundo` | `#F5F6F8` | Fundo do aplicativo |
| `--cor-superficie` | `#FFFFFF` | Card, painel, botão secundário |
| `--cor-superficie-alt` | `#FAFAFB` | Cabeçalho de tabela, subcard |
| `--cor-preenchimento` | `#F3F4F6` | Espaço de imagem, chip neutro |
| `--cor-borda-sutil` | `#EDEEF1` | Divisória interna, linha de tabela |
| `--cor-borda` | `#E9EAEE` | Borda padrão de card e de botão |
| `--cor-borda-forte` | `#DDE0E6` | Campo de formulário, borda em foco |

### Texto — três níveis, todos legíveis

| Token | Valor | Contraste | Uso |
|---|---|---|---|
| `--cor-texto` | `#14161A` | 18,1:1 | Conteúdo, números, títulos |
| `--cor-texto-medio` | `#4B5563` | 7,6:1 | Rótulo, botão secundário |
| `--cor-texto-fraco` | `#6B7280` | 4,8:1 | Legenda, eyebrow, texto de apoio |
| `--cor-texto-apagado` | `#9AA0AA` | 2,6:1 | **Nunca em texto.** Só ícone decorativo e estado desabilitado |

### Laranja da marca

De 15 tons para 5. Os sete laranjas pálidos quase idênticos viram um.

| Token | Valor | Uso |
|---|---|---|
| `--cor-marca` | `#F16A0D` | Botão primário, ação, seleção |
| `--cor-marca-hover` | `#C9540A` | Estado sobre |
| `--cor-marca-texto` | `#D2590A` | Texto laranja sobre fundo claro |
| `--cor-marca-fundo` | `#FFF1E6` | Fundo de destaque, etiqueta |
| `--cor-marca-borda` | `#FBE0C9` | Borda de destaque |

Os gradientes `#FF9147` e `#FFC79A` continuam, como exceção documentada: só logo e avatar.

### Estados

Três tokens por estado. O protótipo tinha mais de trinta hexes fazendo esse trabalho — seis bordas vermelhas diferentes, nove âmbares de uso único.

| Estado | Texto | Fundo | Borda |
|---|---|---|---|
| Sucesso | `#1B8A4E` | `#EDF9F2` | `#BFE6D2` |
| Perigo | `#C13232` | `#FEF2F2` | `#F3D9D9` |
| Atenção | `#B4740A` | `#FFF9EC` | `#F0DFBB` |
| Informação | `#1B76B8` | `#EAF4FD` | `#CFE4F7` |

### Fora do sistema, de propósito

Cor de terceiro não se consolida — ela pertence a outra pessoa:

- **WhatsApp** `#1FA855` · **Telegram** `#2AABEE`
- **Mercado Livre**, **Shopee**, **Amazon** — o par de cada loja vive no banco, não aqui
- **Roxo** `#7A4FBF` / `#F3EEFC` — papel "parceiro" e estado "confirmada"

Esses vêm como dado. Se um dia a Shopee mudar de laranja, muda uma linha no banco.

---

## Tipografia

**Manrope** para tudo. **JetBrains Mono** para número, preço e identificador — dinheiro alinhado em coluna precisa de largura fixa, senão a leitura de uma tabela de preços vira um exercício de foco.

Sete degraus, no lugar de 26. O corte mais importante é o do meio: `11,5`, `12` e `12,5` px somavam 185 usos fazendo o mesmo trabalho.

| Token | Valor | Absorve | Uso |
|---|---|---|---|
| `--texto-xs` | 11px | 9,5 · 10 · 10,5 | Eyebrow, etiqueta |
| `--texto-sm` | 12px | 11,5 · 12 · 12,5 | Apoio, chip, botão pequeno |
| `--texto-base` | 13px | 13 · 13,5 | Corpo, botão |
| `--texto-md` | 15px | 14 · 14,5 · 15 · 15,5 | Botão grande, título de card |
| `--texto-lg` | 17px | 16 · 17 · 18 | Título de seção |
| `--texto-xl` | 20px | 19 · 20 · 21 | Título de tela |
| `--texto-2xl` | 24px | 22 a 27 | Métrica em destaque |

**Pesos:** 400, 600, 700, 800. O 500 sai (4 usos residuais).

**Entrelinha:** 1,2 em título · 1,45 padrão · 1,6 em texto longo. Eram doze.

**Espaçamento entre letras:** −0,03em em títulos de 17px para cima · 0 no corpo · 0,08em em eyebrow maiúsculo. Eram onze.

---

## Espaçamento

Grade de 4, oito degraus: **2 · 4 · 8 · 12 · 16 · 24 · 32 · 40**.

O protótipo tinha 718 valores, e os campeões de uso eram justamente os fora de grade: 14, 13, 10, 9, 11. Isso não é escolha, é a consequência natural de ajustar no olho — e cada ajuste desses vira uma decisão que ninguém consegue repetir na tela seguinte.

Padding de card cai de cinco variantes (`18`, `17`, `16 18`, `15 18`, `13 16`) para **`16px`** ou **`16px 20px`**.

O padding de seção do protótipo, `16px 24px 40px`, já estava na grade e fica como está.

---

## Raio de borda

| Token | Valor | Absorve | Uso |
|---|---|---|---|
| `--raio-xs` | 4px | 2 · 3 · 5 | Barra, marcador |
| `--raio-sm` | 6px | 5 · 6 · 7 | Etiqueta |
| `--raio-md` | 10px | 8 · 9 · 10 · 11 | Botão, campo, chip |
| `--raio-lg` | 14px | 12 · 13 · 14 · 16 | Card, painel |
| `--raio-pilula` | 999px | — | Pílula |
| `--raio-circulo` | 50% | — | Avatar, ponto de estado |

---

## Sombra

Três, e são de elevação real — nada de sombra decorativa em elemento que não flutua.

| Token | Valor | Uso |
|---|---|---|
| `--sombra-marca` | `0 1px 2px rgba(241,106,13,.35)` | Botão primário, **sempre** |
| `--sombra-gaveta` | `-20px 0 60px rgba(20,22,26,.18)` | Painel lateral |
| `--sombra-modal` | `0 30px 70px rgba(20,22,26,.28)` | Diálogo |

A sombra do primário estava em 2 dos 10 botões. Ou em todos, ou em nenhum — escolhi todos, porque ela é o que separa a ação principal do resto num fundo claro.

---

## Botões

Três tamanhos, quatro variantes. O protótipo tinha cerca de cinquenta combinações.

### Tamanhos

| | Padding | Raio | Tamanho | Peso |
|---|---|---|---|---|
| `sm` | 8px 12px | md | sm (12px) | 600 |
| `md` | 12px 16px | md | base (13px) | 700 |
| `lg` | 16px 20px | lg | md (15px) | 700 |

**Alvo mínimo de toque: 44px de altura.** O `sm` só existe no desktop. No celular, qualquer coisa clicável usa `md` ou `lg` — o protótipo tinha ações de 11px sem padding, coladas umas nas outras, com consequências opostas.

### Variantes

| Variante | Fundo | Texto | Borda |
|---|---|---|---|
| Primária | marca | branco | nenhuma, com sombra da marca |
| Secundária | superfície | texto-médio | 1px borda |
| Fantasma | transparente | marca ou texto-fraco | nenhuma |
| Perigo | superfície | perigo-texto | 1px perigo-borda |
| Marca | cor da plataforma | branco | nenhuma |

A variante **marca** é o botão de publicar: verde do WhatsApp, azul do Telegram. Só existe na fila de publicação, e a cor vem da plataforma do canal.

### Regras que não são estilo

**Elemento clicável é `<button>`.** O protótipo tem 75 elementos com `cursor: pointer` e nenhuma tag `<button>` — natural num protótipo, inaceitável no código: sem foco de teclado, sem papel semântico, sem leitor de tela.

**Ação destrutiva nunca fica ao lado da ação principal.** No protótipo, "Já enviei" e "Cancelar" são vizinhos de 11px que produzem o mesmo efeito visual e efeitos opostos no dado.

**Hover do primário usa um valor só.** Eram quatro `brightness` diferentes, dois clareando e dois escurecendo.

---

## A casca, construída em 28/07

O protótipo tem uma casca, e ela é a maior parte do que faz o produto parecer um produto. Ela agora existe em código, em `app/componentes/`:

| Componente | O que é |
|---|---|
| `BarraLateral` | 236px fixos, grupos com rótulo em maiúsculas, item com ponto de cor e contagem à direita, resumo da colheita no rodapé |
| `BarraInferior` | a mesma navegação em faixa rolável, abaixo de `lg` — a fila de publicação é usada em pé, e menu sanduíche cobra um toque de quem tem dez minutos |
| `BarraSuperior` | busca, estado da rotina e usuário |
| `CabecalhoDaPagina` | trilha, título, subtítulo e ações da tela |
| `Kpis` | a faixa de indicadores logo abaixo |

**Duas diferenças deliberadas em relação ao protótipo**, ambas pelo mesmo motivo — não mostrar o que não existe:

1. **A busca aparece desabilitada**, dizendo que chega na Fase 2. Campo que aceita texto e não busca nada é pior que campo nenhum: a pessoa digita, não acontece nada, e conclui que o catálogo está vazio.
2. **O estado da rotina é o de verdade.** O protótipo mostra "Rotina 06:08" sempre em verde. Aqui, sem execução registrada, a faixa diz "rotina ainda não rodou", e com o banco fora do ar diz isso também — ausência de alerta só tranquiliza se der para distinguir "nada quebrado" de "a verificação não rodou".

E uma diferença de fluxo, que vem de `docs/plano.md`: na fila de aprovação, **as ações ficam na linha**. No protótipo a decisão morava no painel lateral, o que custa cerca de 60 rolagens em 30 ofertas. O painel continua fazendo sentido para "esta aqui eu quero olhar".

---

## O que ainda não é componente

Card, tabela, etiqueta de estado, campo de formulário e barra de navegação **já existem no protótipo com forma consistente o bastante para reconhecer**, mas ainda não viram componente aqui. Entram quando a primeira tela real for construída, com a forma que a tela pedir — não antes.

Duas coisas do protótipo que já são boas e vão sobreviver inteiras:

- **Os dicionários de estado** (`estimada`/`registrada`/`confirmada`/`recebida`/`repassada`) e de papel (`dono`/`operador`/`parceiro`), com par de fundo e texto por valor. Já são token semântico bem feito.
- **O cabeçalho de tabela**, que é o elemento mais consistente do protótipo inteiro: cinco instâncias, uma única divergência.
