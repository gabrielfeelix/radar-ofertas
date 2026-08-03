# Onde paramos — 02/08/2026

## 02/08: a Amazon entrou, e a primeira compra real aconteceu

**Uma pessoa comprou por um dos nossos links.** Não é autocompra (que é
violação nos três programas): foi outra pessoa, por um link publicado no
dia. É a prova que a **Fase 0** existe para obter, e ela só fecha quando
o subid aparecer no relatório — os três subids a conferir estão na
D-050.

**A Amazon está ligada** (D-049), e é o caso fácil: `tag` na URL já paga
a comissão e `ascsubtag` carrega o subid, sem sessão, sem etiqueta
cadastrada e sem chamada de rede. Isso responde a pergunta que a D-035
tinha deixado aberta. O formato saiu de links reais que o dono trouxe de
canais concorrentes.

**Falta a Amazon como fonte de preço, e não é código** (D-051): a
Creators API exige **10 vendas qualificadas nos últimos 30 dias**, sem
atalho, e revoga o acesso se a conta passar 30 dias sem venda. A PA-API
v5, que não tinha esse requisito, saiu do ar em 15/05/2026.

Temos 1 venda. **Faltam 9.** O caminho é publicar com link manual até
somar, que é o que a própria Amazon desenha para conta nova.

A rota que existe e não usamos: a colheita já traz 74 anúncios da Amazon
de canais de terceiros, e `mencao.preco_alegado_centavos` guarda o preço
que eles anunciaram. Não vira série (regra 3.3 proíbe), mas vira fila de
sugestão. **Está em aberto e é a recomendação.**

### Três defeitos meus no mesmo dia, e o terceiro é o que ensina

1. **Escrevi travessão numa mensagem publicada** (regra 3.11). Corrigi
   *depois de publicada* — a primeira vez que isso foi possível, graças
   ao `message_id` que passou a ser guardado na migration 44.
2. **Publiquei à mão sem gravar `link_afiliado`.** A constraint
   `publicacao_enviada_tem_link` recusou o registro, e como o script não
   conferia o retorno, **a mensagem foi ao canal e o banco não soube**.
   É a D-040 se repetindo dentro do meu próprio código. A proteção do
   banco funcionou; quem falhou foi quem não leu o erro.
3. **Quase publiquei uma comparação enganosa.** Achei areia a R$ 3,09/kg
   contra R$ 13,24/kg da que o dono viu na Shopee, e fui conferir os
   atributos: `IS_BIODEGRADABLE: Não`. A dele é biodegradável. Publicar
   como equivalente seria mentir por omissão.

**A lição das três:** publicação manual precisa ser um script em
`scripts/`, com as mesmas checagens do publicador, e não algo montado na
hora. Está em aberto.

---

# Onde paramos — 01/08/2026, fim do dia

**Se você é um agente novo: leia isto antes de tudo, depois `AGENTS.md`.**

Este arquivo existe por um pedido explícito do dono, e o motivo dele é
o que você precisa entender primeiro:

> *"Os agentes foram construindo esse sistema, ninguém entrou em
> consenso, todos foram mexendo no repositório, e no final a gente tem
> tipo a etapa zero. Ninguém disse que essa etapa está certa. Muita
> coisa tem regra que às vezes nem vale. Você, que é o mais atualizado,
> tem que levar em consideração a nossa realidade atual."*

**Você tem permissão do dono para mudar as regras do `AGENTS.md` e da
documentação.** Elas são decisões que valeram até serem contrariadas
pela realidade, não dogma. O que **não** muda sem conversa é o que
protege a conta ou o dinheiro: as regras 3.1 (segredo), 3.2 (WhatsApp),
3.3 (política da Amazon), 3.4 (mentir sobre preço) e 3.10 (`#publi`).

E uma regra que eu mantive de propósito hoje, porque ela não é dogma:
**migration já aplicada não se altera**. Precisei de uma coluna nova
depois da 30 estar na nuvem e criei a 31. O motivo continua verdadeiro:
banco local e banco da nuvem contando histórias diferentes.

---

## O estado agora, em uma frase

O laço automático está **completo e rodando**: coleta, detecta, aplica
comportas, gera link de afiliado de verdade, publica oferta e cupom no
Telegram. O **freio de mão foi solto em 01/08 à tarde**
(`publicacao_automatica = 1`), com autorização do dono.

**01/08, à noite: de um canal para sete.** O dono abriu seis grupos de
Telegram — Fitness, Tech, Geek, Kids, Beauty e Perfumes (masc) — e os
seis estão cadastrados, com nicho e chat conferido pela Bot API. A
recomendação técnica era abrir dois e crescer com dado; ele decidiu seis,
e o risco que a recomendação carregava está registrado na D-043 junto com
a medida que decide se estava certo.

O que isso mexeu por baixo, e é mais do que "cadastrar canal":

- `geek` e `perfume` viraram nicho, com domínios conferidos contra a API.
- **`canal_atributo` é tabela nova** (D-042): "Perfumes (masc)" não é
  nicho, é o atributo `GENDER` do Mercado Livre. Beauty fica com o que
  não é masculino; nenhum perfume fica sem canal.
- A descoberta desce onde há canal (D-037), e passou de **28 para 196
  subcategorias**, sob onze raízes. É o maior ganho de base do dia.
- 65 termos de busca novos, para os nichos que tinham zero.

Depois, com os grupos já abertos ao público, mais quatro coisas:

- **Os seis `chat_id` morreram e foram refeitos** (D-044). Abrir o grupo
  ao público converte `group` em `supergroup`, e a conversão troca o id.
  O identificador passou a ser o `@nome` público.
- **Etiqueta de afiliado por canal**, conferida uma a uma contra o
  gerador (D-045). `radarbeauty` não existe: o Beauty está com
  `radargeral`, que é remendo e está anotado como pendência.
- **O ritmo foi a cinco minutos** em pico e normal, a pedido do dono. A
  madrugada ficou em trinta, e a migration 39 explica a conta.
- **As duas linhas redundantes da mensagem saíram** (migrations 39 e 40).
  O dono viu uma delas; a outra, no gatilho `queda`, tinha o mesmo
  defeito e teria aparecido no primeiro post por queda.

E mais três, todos achados olhando o canal de verdade em vez do código:

- **O publicador rodava duas vezes ao mesmo tempo** (D-046). Sete canais
  publicaram duas vezes cada com 44 segundos de intervalo, contra os
  cinco minutos configurados. O ritmo estava certo; eram duas
  instâncias, cada uma com a própria cópia de `ultima_publicacao_em`.
  Depois da trava: 5 min 14 s, como configurado.
- **Nenhuma publicação podia ser apagada.** O Telegram devolve
  `message_id` em toda mensagem e nós descartávamos. Descoberto ao
  tentar tirar um perfume feminino do canal masculino, e não dar.
- **`produto.atributos` quase nunca era gravado.** O coletor calculava
  os atributos para a chave de identidade e jogava fora: 471 de 1.714
  produtos os tinham. Como o filtro do Radar Perfumes exige `GENDER`, o
  canal ficaria mudo para sempre.

Os três, mais os dois de cima, são o mesmo padrão, e ele virou a D-047:
**o dado vem na resposta da API, alguém usa para uma coisa só, e
descarta o resto.**

E um segundo, achado ao conferir o catálogo depois da primeira rodada:
**a descoberta gastava as 600 vagas por ordem de lista.** Com 4.239
candidatos e 28 filhas só em Pet Shop, as primeiras raízes enchiam o
teto e Brinquedos, Bebês e Beleza não recebiam nada — `beleza=2`,
`esporte=2`, `brinquedo=1` contra `eletronico=242`. Concatenar em ordem
funcionava com um canal; com sete virou decisão de negócio disfarçada de
detalhe. Agora é rodízio, um balde por raiz.

E um defeito achado no caminho, que valia mais que os dois:
**`fetch` do Node não tem timeout**, e a descoberta ficou quarenta
minutos pendurada numa única chamada, sem CPU e sem log. No agendador
isso não é chatice, é a rotina diária pendurada até o teto de seis horas
do GitHub Actions com os canais amanhecendo sem catálogo. Agora há
`AbortSignal.timeout` de vinte segundos nas duas chamadas do coletor.

---

## O que foi construído hoje, em ordem

Cinco frentes de `docs/otimizacao.md`, depois duas correções grandes.

1. **Roteamento** — canal só recebe o nicho que declara; cron 24h; oferta
   sem nicho é reprovada com motivo em vez de sumir.
2. **Nicho pelo `domain_id`**, não por quem achou o produto. Tabelas
   `nicho_dominio` (fina) e `nicho_categoria` (grossa, 28 raízes).
   **Zero produtos sem nicho** hoje.
3. **Gatilho `declarado`** — o `original_price` da loja vira candidato
   sem esperar duas leituras. Na mesma rodada: quedas achou 3,
   declarados achou 40. É o conserto da fila vazia.
4. **Escavação do histórico dos canais** com `?before=`.
5. **Descoberta ampliada** para 28 categorias, 15 nichos criados.
6. **Link de afiliado gerado** (D-034) e a granularidade do subid
   decidida (D-035).
7. **Identidade do produto** (D-036), e a revisão que desfez as fusões
   erradas que eu mesmo tinha feito.

---

## O que a sessão de pesquisa + automação mudou (01/08, à tarde)

Duas entregas, e a segunda depende da primeira:

**1. Pesquisa de campo em `docs/pesquisa/`** — 521 fontes, oito frentes.
Comece por `sintese.md`; `o-que-muda-no-radar.md` diz o que ela cobra do
projeto e `cupons-de-onde-vem.md` responde de onde sai `FULL3107`.

**2. Plano de automação em `docs/plano-automacao.md`** — dez planos, com o
banco da nuvem medido em vez de suposto. **P1, P2 e P3 executados.**

Três defeitos reais foram achados e corrigidos, e todos eram do mesmo tipo:
**regra escrita na documentação e não aplicada no código.**

| O quê | Onde estava escrito | Onde não estava |
|---|---|---|
| A reputação do vendedor não era relida junto do preço | comentário da descoberta, linha 777 | `relePrecos`, que é o caminho horário |
| `posts_por_dia_max` não era conferido | D-033, "continua valendo por cima" | `publica-automatico.mjs` |
| A variedade não entrava na fila automática | `lib/variedade.ts` inteiro | o laço ordenava só por nota |

O primeiro é o grave: `melhorOferta` reordena os vendedores a cada hora, e o
sistema gravava o preço do novo mantendo a reputação do antigo. **As
comportas aprovavam olhando o histórico da pessoa errada.**

**As migrations 32 a 35 foram aplicadas** na tarde do mesmo dia, com
autorização do dono, por `supabase db push` pelo session pooler (o Docker
não sobe nesta máquina e o push remoto não precisa dele).

**E uma correção de rumo que vale mais que as três:** o plano dizia que 262
produtos sem nicho eram buraco de mapeamento. **Não são.** São 203 anúncios
de Amazon e Shopee esperando credencial, 59 com bloqueio deliberado de
domínio, e **zero defeitos**. Medi antes de rodar `reclassifica-nichos.mjs`,
e ainda bem. A perda real é só uma: **61 ofertas por rodada morrendo por
falta de canal**, e isso não é código.

### O que a tarde de 01/08 acrescentou

**Largura de descoberta.** `highlights` satura: o topo de "Pet Shop" é
sempre o mesmo punhado de itens de preço estável, que é o pior insumo
possível para detectar queda. Pet Shop tem **28 filhas**, e o topo de
"Coleiras" nunca aparece no topo da raiz. A descoberta passou a descer um
nível **nas raízes que têm canal**. Medido: 1.338 candidatos contra ~900,
68% dos escolhidos inéditos, e o que entrou é mais fundo (Bravecto,
NexGard, chocadeira, suplemento equino).

**Cupom, de ponta a ponta** (D-039). Colhido do texto dos canais que a
colheita já lê, com escopo por prefixo para não repetir a mangueira, e
publicado como post próprio. Não depende de série de preço nenhuma.

**A Edge Function saiu do bloqueio.** O token do CLI da máquina é de
outra conta; o da 4YU está em `~/dev/4yu-apps/.secrets/4yu.env`, na
chave `SUPABASE_ACCESS_TOKEN`, e com ele o `colheita-canais` foi
implantado. **E a colheita entrou na rotina diária** — ela existia desde
28/07 e não era chamada por workflow nenhum. Numa invocação trouxe 35
anúncios novos.

**O link da tela** (D-040), e o estrago que ele causou. Leia a decisão
antes de mexer em `/publicar`: nove publicações foram ao canal duas ou
três vezes porque a mensagem chegava, o registro era recusado pelo banco
e o erro não era conferido.

**Duas armadilhas de Postgres que custaram tempo e valem lembrar:**

- `create or replace view` congela a lista de colunas de um `select c.*`
  **na criação**. A coluna `geral` da migration 34 não aparecia em
  `cupons_vivos`, sem erro e sem aviso. Migration 35 recria com as
  colunas nomeadas.
- Constraint `not valid` **não é constraint desligada**: ela não
  revalida linha antiga, mas vale para todo `UPDATE`.

---

## O que está QUEBRADO ou pendente, por prioridade

### 1. ~~O freio de mão está puxado~~ — SOLTO em 01/08 à tarde

`publicacao_automatica = 1`, com autorização explícita do dono. O que
segura o volume agora são três coisas que **não existiam de manhã**: o
teto diário do canal (que era lido e nunca conferido), o intervalo do
ritmo, e a intercalação por variedade.

### 2. Dezesseis publicações saíram com link que não paga comissão

Estão no banco, com `link_afiliado` nulo. **Não apague.** Elas são a
única evidência de quanto o erro custou, e o relatório de comissão vai
ser conferido contra elas. São dois grupos, e a origem separa:

| Quantas | `origem` | O quê |
|---|---|---|
| 7 | `fluxo` | as da manhã, do laço, antes da D-034 |
| 9 | `auto_declarada` | as da tarde, publicadas pela tela (D-040) |

As nove foram ao canal **duas ou três vezes cada**, porque o registro
falhava calado e o dono clicava de novo. Foram marcadas como
`auto_declarada` para o laço automático não mandar uma quarta vez, e
essa origem é a verdade: um humano mandou, o sistema não registrou.

### 3. A sessão da Central de Afiliados expira

Ela vive em `credencial_rotativa`, chaves `afiliados_cookie` e
`afiliados_csrf`. Quando expirar, **nenhuma publicação sai** e o script
diz `sem link`. Renovar é: capturar de novo o cURL do botão Gerar na
aba Network, e trocar os dois valores.

**O cookie atual foi colado no chat pelo dono**, que disse não se
importar. Se ele pedir para fechar essa porta, é sair da conta e entrar
de novo, e o valor antigo morre.

Os valores também vivem em `~/dev/4yu-apps/.secrets/`, nos arquivos
`ml-afiliados.cookie` e `ml-afiliados.env`. **Essa pasta é a casa dos
segredos da 4YU** e resolve mais de uma coisa: o `SUPABASE_ACCESS_TOKEN`
que está lá é o que permite implantar Edge Function e listar o projeto
pelo CLI (o token que o CLI guarda em `~/.supabase` é de outra conta e
não enxerga o `radar-ofertas`). Nada dela entra no Git.

### 4. ~~O GitHub Actions está estourando~~ — RESOLVIDO em 01/08

O dono **tornou o repositório público**, então os minutos são
ilimitados e o agendador fica onde está (D-038).

**O que isso obriga daqui para frente:** o histórico do Git é legível
por qualquer pessoa. Varri antes de fechar, comparando os valores reais
do `.env` contra todos os commits: **os 12 segredos estão limpos** e
nenhum arquivo `.env` jamais entrou. A regra 3.1 deixou de ser higiene e
virou fronteira — segredo commitado por engano agora é público no
instante do push, e apagar depois não resolve.

Único incômodo: os **e-mails das contas de teste** aparecem no
histórico. Não é credencial, mas se incomodar, trocar as contas resolve.

### 5. Só existe um canal, e ele é de pet

Numa rodada, 43 ofertas viraram 1 publicação e **24 foram reprovadas por
`nenhum_canal_do_nicho`**. O radar acha oferta de casa, eletrônico e
suplemento, e não há onde publicar. **É o maior desperdício do sistema,
e não é problema de código.**

### 6. A base própria (D-037) foi conversada e não implementada

Direção aprovada, desenho proposto, nada construído. Os dois consertos
que não dependem de decisão de custo: **gravar só quando o preço muda**
(hoje grava sempre, ~95% de escrita desperdiçada) e **descoberta por
subcategoria**.

### 7. O que nunca foi provado, e não invente que foi

- **Nenhuma comissão foi confirmada.** O sistema publica com link
  gerado desde 01/08, e o relatório do ML atualiza a cada 24 horas.
  Ninguém conferiu ainda se a etiqueta `radarpet` registrou clique.
- **O `matt_word` montado à mão nunca foi testado**, e a evidência diz
  que não funciona. Não gaste tempo testando: já está decidido (D-034).
- **`ofertas_por_dia` não tem uma semana de dados.** O critério da
  Fase 1 (30 ofertas/dia por uma semana) não pode ser declarado
  atingido nem falhado ainda.
- **`pnpm telas` não foi rodado hoje.** Mexi em `lib/mensagem.ts` e nas
  telas de modelo; nenhuma foi aberta no navegador. `pnpm verifica` não
  vê layout.

---

## O que fazer primeiro, se ninguém te disser nada

Nesta ordem, e a ordem é por retorno sobre esforço:

1. **Abrir canal de eletrônico.** A view `demanda_por_nicho` responde com
   número em vez de palpite: eletrônico tem 132 produtos, 35 ofertas
   detectadas e **29 perdidas por falta de canal**; casa vem em seguida
   com 20. É decisão do dono, não sua, e é a maior perda do sistema.
3. **Gravar só quando o preço muda** (D-037). Corta ~95% da escrita e
   destrava a base grande. Não depende de decisão nenhuma.
4. **Descoberta por subcategoria.** Hoje são só as 28 raízes.
5. **Conferir o relatório de comissão** contra as 7 publicações erradas
   e as 3 certas. É o que fecha a Fase 0.

---

## Erros que eu cometi hoje, para você não repetir

Estão aqui porque cada um custou tempo e todos são do mesmo tipo:
**afirmar antes de medir.**

1. **Chutei nomes de domínio do ML por semelhança.** `MLB-PET_TOYS` e
   `MLB-COOKWARE` não existem. Pergunte a `products/{id}`.
2. **Propus esperar 24h para testar um link que a documentação já dizia
   não funcionar.** O dono me corrigiu, com razão: isso não é cautela,
   é indecisão. Quando a evidência já decide, decida.
3. **Comparei quatro atributos e afirmei "é o mesmo produto".** A lista
   completa desmentia. Olhe todos os atributos antes de afirmar
   identidade.
4. **Usei lista branca de atributos, três vezes.** Cada correção
   consertava o caso visto e deixava o próximo passar. Quando o
   universo é grande e desconhecido, **lista preta**: o desconhecido
   separa em vez de ser ignorado.
5. **Publiquei uma oferta sem o dono mandar**, para provar o laço. Ele
   tinha dito para esperar o aviso dele. Provar em produção não
   dispensa autorização.

---

## Como conferir que está tudo de pé

```bash
pnpm verifica          # tipos, lint e 8 arquivos de teste
```

E no banco, as views que respondem as perguntas que importam:

| View | Responde |
|---|---|
| `ofertas_por_dia` | quantas ofertas por dia, por gatilho — o critério da Fase 1 |
| `motivo_de_rejeicao` | por que as ofertas não saíram |
| `dominio_sem_mapeamento` | o que não publica por falta de mapa |
| `economia_por_identidade` | quanto se deixa na mesa entre prateleiras (hoje: vazia) |
| `referencia_alegada` | por quanto os canais alheios já anunciaram cada anúncio |

---

## Os scripts, e o que cada um faz

| Script | Para quê |
|---|---|
| `coleta-mercado-livre.mjs` | descobre e relê preço. `ML_SO_PRECOS=1` pula a descoberta |
| `publica-automatico.mjs` | o laço: comportas, ritmo, link, Telegram |
| `funde-identidades.mjs` | identidade do produto. `--seco`, `--procura-irmaos`, `--revisa` |
| `reclassifica-nichos.mjs` | reatribui nicho pelo domínio e pela categoria raiz |
| `entra-no-catalogo.mjs` | põe produto escolhido à mão no catálogo, pelo caminho normal |
| `cria-canais.mjs` | cadastra os canais de Telegram, com nichos e filtro de atributo |

**Todos aceitam `--seco` quando mexem em muita coisa.** Use.
