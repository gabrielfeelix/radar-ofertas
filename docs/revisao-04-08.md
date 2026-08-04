# Revisão de 04/08/2026 — achados, provas e consertos

Revisão pedida pelo dono: documentação, código e pesquisa. Este arquivo
é o registro dela, e serve como manual do que foi mexido.

**Leia a etiqueta de cada item antes de agir.** Ela existe porque a
primeira versão desta revisão tinha quatro afirmações que não
sobreviveram ao teste, e três delas eu tinha escrito com confiança. O
que separa achado de palpite é o método, não o tom.

| Etiqueta | Quer dizer |
|---|---|
| **produção** | medido no log do Actions ou lido do banco da nuvem, com o número transcrito |
| **banco local** | reproduzido contra Postgres real, com as 56 migrations aplicadas |
| **local** | reproduzido nesta máquina, sem banco |
| **leitura** | certo pela estrutura, sem execução que comprove |
| **em aberto** | levantado e não provado. Tem o teste que decide |

---

## O que eu afirmei e estava errado

Fica no topo de propósito.

1. **"O backup é baixável sem autenticação nenhuma."** Errado. Listar é
   anônimo (200), **baixar devolve 401**. O certo é: qualquer conta
   logada do GitHub baixa. Continua grave, conta é grátis, mas a frase
   era mais alarmante que o fato.

2. **"O `&` cru no link pode estar calando Shopee e Amazon desde
   03/08."** **Errado, e o banco decidiu.** Desde a migration 49 saíram
   **422 publicações, 212 delas da Shopee**, todas com `&` cru dentro do
   `href`, e **todas aceitas pelo Telegram**. Não há canal mudo por
   parse. Ver F-04, que mudou de gravidade e de conclusão.

3. **"O modelo nulo derruba o publicador."** Verdade no papel, quase
   inalcançável: o painel não cria nem desativa modelo. Virou item de
   robustez, não defeito, e não foi mexido.

4. **"Da ordem de noventa chamadas mortas por dia."** Exagerado como
   número de itens distintos. O certo: **71 publicações pendentes com
   mais de 24 horas**, e o log mostra as mesmas 7 a 11 sendo retentadas
   a cada rodada. O desperdício por rodada é real; o tamanho da fila
   presa é 71, não 686.

E uma hipótese que levantei e **desmenti antes de escrever**: achei que
`salvaModelo` gravava menos campos do que o formulário mostra. Não
grava: o formulário expõe exatamente os três campos que a ação salva.

---

## S-01 · O backup semanal está ao alcance de qualquer conta do GitHub

**produção · não consertado, é decisão do dono**

`backup-semanal.yml` roda `pg_dump --schema=public` e sobe o resultado
como artefato do Actions. O repositório é público desde 01/08 (D-038), e
o comentário do arquivo ainda diz que ele é privado.

Medido pela API, sem token:

```
total_count: 2
radar-ofertas-2026-08-02.dump   1.471.274 bytes   expired: false
radar-ofertas-2026-07-31.dump     140.472 bytes   expired: false
```

O de 02/08 é posterior ao repositório virar público.

O comando não tem `--exclude-table` nenhum, e `credencial_rotativa` é
tabela do schema `public` (migration 17). O dump carrega o refresh token
do Mercado Livre, o `afiliados_cookie` e o `afiliados_csrf` da Central,
a tabela `usuario` e o catálogo inteiro.

**O que não provei:** não abri o arquivo. A conclusão é estrutural. Para
fechar: `gh run download 30737819515` e `pg_restore --list | grep -i
credencial`.

**Não dá para saber se alguém baixou** — o GitHub não expõe log de
download de artefato.

**Encaminhamento:** apagar os dois artefatos; rotacionar cookie/csrf da
Central e revogar o refresh token do ML; e no workflow, excluir as duas
tabelas e cifrar o arquivo com `gpg --symmetric` antes do upload.
Artefato de repositório público não tem como ser fechado.

Nada disto foi feito aqui: mexe em credencial de produção, e a seção 8
do `AGENTS.md` manda parar e perguntar.

---

## F-01 · Publicação que falha ficava presa e era retentada para sempre

**produção + banco local · CONSERTADO**

Cinco caminhos de `enviaOferta` devolviam `false` sem tocar no estado da
`publicacao`. A fila da rodada seguinte é lida por `estado =
'pendente'`, e não havia estado terminal nem contador de tentativa.

A prova é a mesma linha em 4 de 4 execuções, uma hora separadas:

```
11:14  ⤫ Radar Tech: prateleira melhor sem lastro próprio (R$ 317.00)
10:21  ⤫ Radar Tech: prateleira melhor sem lastro próprio (R$ 317.00)
```

E o contador de "sem link" subindo ao longo do dia: 7 às 05:26, 8 às
08:48, 11 às 11:59. No banco da nuvem, em 04/08: **71 pendentes com mais
de 24 horas**, e **5** cuja oferta já está `rejeitada` — o par
inconsistente que este item cria.

Cada retentativa de link é uma chamada ao gerador da Central, feita com
a sessão do dono, no painel de outra empresa.

**O conserto separa o que tem conserto do que não tem**, porque tratar
tudo igual nos dois sentidos é errado:

| Caminho | Agora |
|---|---|
| Telegram recusou | continua `pendente`, é rede |
| Prateleira melhor sem lastro | `publicacao` → `cancelada`, junto com a oferta |
| URL recusada pelo programa | `cancelada` |
| Sessão da Central caiu | continua `pendente` |
| Etiqueta do canal errada | trava o canal **na rodada**, sem escrever no banco |

A classificação virou módulo próprio, `lib/falha-de-link.ts`, com 18
casos de teste — as mensagens são as reais, copiadas do log e da
resposta do gerador. **O padrão é `transitorio`**: mensagem que ninguém
previu volta a tentar, porque encerrar por engano some com oferta boa em
silêncio.

`cancelada` e não estado novo: já existe na migration 16, a tela já
mostra, e `desfazCancelamento` já volta atrás.

**Como foi conferido**, contra Postgres real com as migrations
aplicadas: semeei o caso do log (produto com duas prateleiras, a melhor
sem lastro próprio) e rodei o publicador de verdade.

```
⤫ Radar Teste: existe prateleira melhor sem lastro próprio (R$ 35.00)
  ↳ 1 publicação(ões) encerrada(s)

publicacao=cancelada  cancelada_em=2026-08-04 13:18:42+00
oferta=rejeitada      motivo=prateleira_melhor_sem_lastro
```

E a segunda rodada, que é o teste que importa: **nada**. O item não
voltou.

O `update` confere o erro de retorno, porque a D-040 é literalmente
sobre não conferir o retorno de um update de `publicacao`.

---

## F-02 · O log culpava a sessão da Central, e a sessão estava viva

**produção · CONSERTADO**

Toda execução terminava com *"Sem link é quase sempre sessão da Central
expirada"*, enquanto o motivo real estava três linhas acima: `URL not
allowed in affiliates program`. Na mesma rodada, 37 links foram gerados
— a sessão estava sadia. O aviso mandava renovar o que não estava
quebrado.

Agora o rodapé conta por causa medida e só sugere renovar a sessão
quando foi a sessão.

---

## F-03 · Sessão do ML expirada calava Amazon e Shopee junto

**banco local, com A/B · CONSERTADO**

A guarda encerrava a execução inteira quando faltavam
`afiliados_cookie` / `afiliados_csrf`, e contradizia o que o próprio
arquivo promete sobre a Amazon: *"nunca falha por sessão expirada, que é
o motivo número um de canal mudo aqui"*. Amazon e Shopee montam o link
por URL, sem sessão (D-049, D-057).

**A/B contra o mesmo banco, mesma semente**, com a tabela de credenciais
vazia:

| | resultado |
|---|---|
| código de `HEAD` | `Falta a sessão da Central. Nada sai sem link.` e encerra |
| com o conserto | gera e grava o link da Shopee, segue para o envio |

---

## F-04 · Falta escape de HTML, e o risco era menor do que eu disse

**produção decidiu · PARCIALMENTE consertado, e a parte que faltou é deliberada**

A regra do Telegram é literal: `<`, `>` e `&` que não sejam tag ou
entidade têm que virar `&lt;`, `&gt;` e `&amp;`.

**O que a produção respondeu, e derruba a minha hipótese:** desde a
migration 49 saíram 422 publicações, **212 delas de Shopee com `&` cru
dentro do `href`**, e todas foram aceitas. Existem hoje **173 produtos
com `&` no título**, publicados diariamente sem incidente. O `&` cru
funciona na prática, com centenas de casos.

E **zero produtos com `<` no título** — que é o caractere que quebraria
de verdade.

Então isto não é conserto de canal mudo. É higiene, com um caso futuro
plausível: título de marketplace muda todo dia, e `Cabo <2m>` derruba a
mensagem inteira.

**O que foi feito:** escapar título, vendedor, loja, nota do curador,
código e nome de loja do cupom. Os textos que o dono escreve no painel
passam inteiros, senão o `<a href>` e o `<b>` do modelo virariam
`&lt;a href&gt;` à vista de todo mundo.

**O que NÃO foi feito, de propósito: o link.** Escapá-lo seguiria a
especificação, mas ninguém provou que o Telegram decodifica `&amp;` de
volta dentro do atributo. Se ele passar a entidade literal, o destino lê
`amp;affiliate_id` e **a comissão não é atribuída** — post bonito, zero
real. Contra isso há 212 posts provando que o `&` cru funciona. Mexer no
campo que carrega o dinheiro sem medir seria apostar.

**O teste que decide**, e ele precisa do bot de verdade (o token do
`.env` está inválido; o bom só existe nos secrets): mandar as duas
formas para um canal de rascunho e comparar a URL que chega ao clicar.
Se `&amp;` chegar decodificado, escapa-se o link também e some a última
exceção.

Verificado por 45 casos de teste, incluindo o lado negativo — que as
tags do modelo sobrevivem e que o link atravessa intacto.

---

## F-05 · A troca de prateleira pulava as comportas de confiança

**banco local, com A/B · CONSERTADO**

`reprova()` avaliava o anúncio da oferta. Depois disso
`melhorPrateleira` podia trocar por outro anúncio, de outro vendedor, e
publicar sem passar pelas comportas de novo. A função do banco não
aplica comporta nenhuma, só ordena (migration 30):

```sql
order by v.loja_oficial desc nulls last,
         v.reputacao_vendedor desc nulls last,
         v.preco_leitura_centavos asc
```

**Reproduzido contra o banco real.** Semeei um produto com duas
prateleiras: a mais barata com avaliação **2.0**, abaixo do piso de 3.5.
A função do banco escolheu justamente ela:

```
melhor prateleira escolhida pelo banco: SKU-RUIM
```

E o A/B, mesma semente:

| | prateleira publicada | avaliação |
|---|---|---|
| código de `HEAD` | `product/9/2` — SKU-RUIM | **2.0** |
| com o conserto | `product/9/1` — SKU-OK | 4.8 |

O log do antigo diz `1 trocaram de prateleira` e grava o link do produto
mal avaliado. O novo diz `a prateleira melhor não passa nas comportas
(produto_mal_avaliado(2)), fica a original`.

**A oferta não é descartada:** a prateleira original passou nas
comportas e continua publicável. Só não se troca.

Frequência em produção: uma troca em onze execuções de 04/08. Acontece
pouco, e curadoria é o que separa este projeto de um repassador.

Fica uma observação menor **não consertada**: depois de uma troca
legítima, `publicacao.oferta_id` continua apontando para o anúncio
velho. O texto publicado fica em `publicacao.mensagem`, então dá para
auditar, mas análise que vá de publicação para anúncio lê o errado.

---

## F-06 · Duas migrations nunca se aplicavam num banco novo

**banco local, contra os dois bancos · CONSERTADO (migration escrita, não aplicada na nuvem)**

O corpo do modelo é construído por migrations encadeadas, e cada uma
procura o texto que a anterior deixou:

| Migration | Deixa |
|---|---|
| 14 identificação | `👉 {link}` |
| 27 frete | `👉 {frete}` + `{link}` |
| 28 conserta o frete | **não aplica** — procura `🛒 {frete}` |
| 49 link clicável | **não aplica** — procura `🛒 {link}` |

**Confirmado nos dois lados.** Local, com as 55 migrations aplicadas do
zero:

```
{vendedor}
👉 {frete}

{link}
```

Nuvem, lido em 04/08:

```
{frete}

🛒 <a href="{link}">Compre aqui</a>
```

O modelo da nuvem tem `🛒` porque foi editado à mão pelo painel, e as
duas migrations foram escritas contra esse texto editado. O local
produz um modelo **diferente e pior**: com o defeito que a 28 existe
para consertar, e sem link clicável.

Não quebra produção. Quebra a confiança em conferência local — `pnpm
telas` testa uma mensagem que não é a que sai — e reaparece inteiro numa
restauração de backup ou na mudança para VPS (D-055).

**Conserto:** `20260804140000_o_modelo_para_de_depender_de_emoji.sql`,
que casa por **posição de variável**, nunca por emoji. Aplicada e
conferida no banco local:

```
{vendedor}
{frete}

🛒 <a href="{link}">Compre aqui</a>
```

Duas conferências antes de ela poder subir:

- **idempotente** — rodar os mesmos `update` de novo não muda nada
- **no-op na nuvem** — simulei o corpo exato que está lá hoje e ele sai
  intacto, porque a segunda condição é `not like '%<a href%'`

**Não foi aplicada na nuvem.** Isso é `pnpm db:publica`, precisa do
`SUPABASE_ACCESS_TOKEN` do cofre da 4YU, e é decisão do dono.

---

## F-07 · O envio em lote pela tela não guardava o `message_id`

**leitura · consertado pela metade, e a metade que falta é decisão**

`telegram_message_id` só era gravado pelo laço automático.
`publicaLoteTelegram` recebia o id em `ResultadoDoEnvio.messageId` e o
descartava, então post saído pela tela não tinha como ser apagado — o
problema que criou a migration 44, resolvido só num dos dois caminhos.
**Consertado.**

**Não consertado, porque é decisão sua:** o botão "publicar todas"
ignora o ritmo. Zero referências a `podePublicarAgora` em
`app/acoes/publicacao.ts` e na tela. Ele despeja a fila do canal de uma
vez, que é o comportamento que `lib/ritmo.ts` existe para impedir. Pôr o
ritmo ali muda como você usa a tela, então não mexi.

---

## F-08 · Nenhuma Server Action confere papel

**leitura · não consertado, é decisão**

`middleware.ts` barra quem não tem sessão, mas não distingue `dono` de
`operador`. Nas ações, `usuarioAtual()` só registra autoria. Como o
painel lê com `service_role` (D-027), um `operador` autenticado alcança
as ações de ajustes: limiar de curadoria, modelo, cadastro de canal.

Hoje só existe uma conta, então é dívida, não vazamento. O gatilho é o
mesmo da D-027: **o primeiro operador de verdade receber acesso.** Não
mexi porque authz mal calibrada tranca o dono fora do próprio painel, e
isso precisa ser feito junto com a troca das leituras para a chave da
pessoa.

---

## O-01 · Observações que mudam a leitura, sem serem defeito

**produção, 04/08**

**88 execuções canceladas para 11 concluídas.** O `pg_cron` dispara de 5
em 5 minutos e a execução vive ~50. O comentário do workflow diz que as
extras *"encontram a trava tomada no banco e saem na hora"* — não é o
que acontece: elas são **canceladas pelo portão de `concurrency` do
GitHub** e nunca rodam. Efeito prático igual, mecanismo descrito errado,
e quem for depurar vai procurar a trava no lugar errado.

**`0 cupons` nas 11 execuções.** O post de cupom (D-039) não sai. Não
investiguei.

**Três canais mudos o dia inteiro:** Pet 0/150, Fitness 0/150, Perfumes
0/150. Beauty, Kids e Tech carregam tudo.

**Fila represada:** 389 esperando o ritmo às 10:19.

---

## D-01 · A documentação envelheceu mais rápido que o código

| Onde | Diz | É |
|---|---|---|
| `AGENTS.md` §2 | stack é Cloudflare Workers + OpenNext, "não Vercel" | está na **Vercel** — `curl` devolve `server: Vercel`, `x-vercel-id: gru1`. `@opennextjs/cloudflare` não está no `package.json` |
| `AGENTS.md` §2 | pg_cron é exceção "e só uma" | são **duas** desde 04/08 (migration 50) |
| `AGENTS.md` §9 | "só existe um canal, e ele é de pet" | **sete**, e o mesmo arquivo diz isso 60 linhas acima |
| `AGENTS.md` §9 | 15 migrations / 35 migrations | **56** |
| `AGENTS.md` §9 | "Atualizado em 01/08" e "`onde-paramos` tem o estado de 01/08" | tem seção de 03/08; o `onde-paramos` começa em 02/08 |
| `AGENTS.md` §4 | Fase 0 / base da Fase 1 | publica sozinho em sete canais próprios, que é a Fase 2 |
| `backup-semanal.yml` | "artefato do repositório, que é privado" | público desde 01/08. É o S-01 |
| `onde-paramos.md` §5 | "Só existe um canal" | idem |

**Ponto a favor:** os comentários **dentro** do código estão mais
corretos que os documentos. Nas duas vezes em que discordaram e fui
conferir, o comentário do código ganhou.

---

## O que mudou no repositório

| Arquivo | O quê |
|---|---|
| `lib/mensagem.ts` | `escapaHtml`, aplicado só a valor vindo de dado. O link fica cru, com o porquê escrito |
| `lib/falha-de-link.ts` | **novo.** Classifica falha de link em permanente / canal / transitório |
| `scripts/publica-automatico.mjs` | F-01, F-02, F-03, F-05. `enviaOferta` foi partida em duas para a comporta poder rodar depois da troca |
| `lib/publicacoes.ts`, `app/acoes/publicacao.ts` | `telegram_message_id` no caminho da tela |
| `testes/mensagem.mjs` | +10 casos de escape, com o lado negativo |
| `testes/falha-de-link.mjs` | **novo.** 18 casos, mensagens reais |
| `supabase/migrations/20260804140000_...` | **novo.** F-06. **Não aplicada na nuvem** |
| `package.json` | o teste novo entra no `pnpm testa` |

`pnpm verifica`: 325 asserções, 0 erros. Os 2 avisos de lint são
pré-existentes — conferido com o diff guardado.

**Nada foi commitado.** Push em `main` publica na Vercel e entra na
rodada de publicação em cinco minutos; a decisão é do dono.

---

## O que falta, em ordem

1. **S-01** — artefato e rotação de credencial. Só o dono faz.
2. **Aplicar a migration 51** na nuvem, se e quando ele quiser
   (`pnpm db:publica`, com o token do cofre da 4YU). Conferida como
   no-op no modelo que está lá.
3. **O teste do `&amp;` no href** com o bot de verdade, que fecha o F-04.
4. **F-07 (ritmo na tela) e F-08 (papel nas ações)** — decisões, não
   defeitos.
5. **D-01** — atualizar `AGENTS.md` e `onde-paramos.md`.
6. `next` 16.2.12 → 16.3.0, que resolve quatro avisos de `postcss`.
