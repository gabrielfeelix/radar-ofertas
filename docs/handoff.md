# Handoff — o que falta, e como trabalhar aqui

Escrito em 04/08/2026, ao fim de uma sessão longa. Você está pegando um
sistema que **funciona e publica sozinho em sete canais**. Não é
greenfield: cada coisa estranha que você achar provavelmente tem um
motivo escrito em `docs/decisoes.md`.

**Ordem de leitura antes de tocar em qualquer coisa:** `AGENTS.md`
inteiro → `docs/onde-paramos.md` → `docs/revisao-04-08.md` (traz o
método de conferência de cada achado) → este arquivo.

---

## Parte 1 · Como trabalhar aqui

Isto vem primeiro de propósito. O maior risco deste repositório não é
escrever código errado, é **afirmar coisa não medida** — e a
`onde-paramos` tem uma seção inteira de erros passados que são todos do
mesmo tipo.

### Meça antes de afirmar. Sempre.

Você tem acesso de leitura ao banco de produção. Use antes de opinar:

```bash
export SUPABASE_ACCESS_TOKEN=$(grep "^SUPABASE_ACCESS_TOKEN=" \
  ~/dev/gabriel/4yu-apps/.secrets/4yu.env | cut -d= -f2- | tr -d '"'"'" ')
ref=$(grep "^SUPABASE_PROJECT_REF=" .env.producao | cut -d= -f2-)
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" -d '{"query":"select 1"}' \
     "https://api.supabase.com/v1/projects/$ref/database/query"
```

E o log de produção responde mais que o código:

```bash
gh run list --workflow=publica.yml --limit 30 --json databaseId,conclusion
gh run view <id> --log | grep -E "publicadas ·|✗ |⤫ "
```

**Em 04/08 eu escrevi quatro afirmações com confiança e as quatro
caíram quando fui testar.** Estão listadas no topo de
`docs/revisao-04-08.md`, de propósito. Se as suas não caírem nenhuma
vez, provavelmente você não está testando.

### O que este projeto exige de uma mudança

1. **Rodar `pnpm verifica`** — tipos, lint e ~380 asserções.
2. **`node --check` nos `scripts/*.mjs`** — `pnpm verifica` **não olha
   essa pasta**, nem tipo nem lint. Foi por isso que a lógica nova de
   classificação foi para `lib/`.
3. **Migration testada contra Postgres de verdade**, não só lida.
4. **Comparar antes e depois em produção**, com número.

### As armadilhas que me pegaram hoje

Cada uma custou tempo. Nenhuma é óbvia.

**O banco local está vazio, e isso esconde constraint.** Escrevi um
`insert ... select` sem `operacao_id`. Passou no local, porque o select
não retornou linha e a constraint nunca foi exercitada. Quebrou na
nuvem. **Migration que insere: teste com dado semeado, não com banco
vazio.**

**Migration que casa por emoji não se aplica.** As migrations 28 e 49
procuravam `🛒` e o banco local tinha `👉` — nunca rodaram, e ninguém
viu porque na nuvem alguém tinha editado o modelo à mão. Sempre case por
**variável** (`{link}`, `{frete}`), nunca por enfeite editável.

**Heurística de título gera falso positivo em produto-alvo.** Marquei
"Lip Gloss Seringa" como insumo de clínica e "Kit 13 Pçs Pincéis" como
atacado. Os dois são exatamente o que o canal de beleza existe para
publicar. **Depois de escrever a regra, rode contra o catálogo real e
olhe uma amostra do que ela pegou.**

**Um sinal só vale dentro de um contexto.** "1,5L" quer dizer revenda em
shampoo e quer dizer o produto em panela. A mesma regex, dois
significados opostos.

**`pnpm db:reset` apaga tudo.** Nunca use para aplicar migration. Use
`npx supabase migration up --local`.

### O que nunca muda sem conversa

As regras 3.1 (segredo), 3.2 (WhatsApp), 3.3 (Amazon), 3.4 (mentir sobre
preço) e 3.10 (`#publi`) do `AGENTS.md`. O resto é decisão que valeu até
ser contrariada pela realidade, e o dono autorizou mudar — registrando
em `decisoes.md`.

**E peça antes de:** deploy, mexer em variável de produção, criar tabela,
ou construir algo de fase futura.

---

## Bloco 1 · Segurança — é o único urgente

### 1.1 O que o dono precisa fazer, e você não pode

Dois artefatos do backup semanal estão baixáveis por **qualquer conta do
GitHub**, e carregam o cookie da Central de Afiliados e o refresh token
do Mercado Livre. Diagnóstico completo em `docs/revisao-04-08.md`, S-01.

- apagar `radar-ofertas-2026-08-02.dump` e `radar-ofertas-2026-07-31.dump`
- rotacionar cookie, csrf e refresh token

**Não faça a rotação antes do 1.2.** Rotacionar agora escreve o segredo
novo no mesmo lugar que vazou.

### 1.2 Tirar os segredos do schema `public`

**Plano completo, com as quatro fases, em `docs/plano-vault.md`.** Ele já
tem o inventário (5 credenciais), os 6 leitores, os 2 escritores e a
restrição de desenho.

**O risco número um não é o cookie, é o refresh token.** O Mercado Livre
invalida o anterior a cada renovação. Se você quebrar a gravação, o
coletor seguinte morre com `invalid_grant` e alguém tem que reautorizar
a aplicação à mão. Toda a cautela do plano existe por isso.

**Não pule a Fase 3 do plano**, que é ver uma renovação de token
acontecer em produção antes de apagar a tabela.

### 1.3 Cifrar o artefato do backup

Independente do 1.2, e barato: `--exclude-table` das duas tabelas e
`gpg --symmetric` antes do upload, com a senha em secret. Mesmo sem
segredo, o dump leva o catálogo e os e-mails da tabela `usuario`.

**Fechar o repositório não é opção**, e o número decide: 1.063 minutos de
Actions num dia contra 2.000/mês do plano privado — uns US$ 180/mês.

---

## Bloco 2 · A Shopee híbrida (D-064)

**Leia a D-064 antes de começar.** Eu recusei trocar o feed CSV pela
Open API, e o motivo é que a API **não tem `shop_rating`** — que vira
`reputacao_vendedor`, cuja falta foi um dos três defeitos de 03/08.
Trocar reintroduziria isso.

O CSV continua sendo a fonte de catálogo. A API entra em três lugares.

### 2.1 Validar o preço na hora de publicar ← comece por aqui

**Maior retorno, menor risco.** Hoje o publicador manda post sobre o
feed da noite anterior, e desconto some sem avisar.

`productOfferV2(itemId:)` devolve preço, desconto, vendas, nota e
comissão **de agora**. `lib/shopee-api.ts` já tem `itemDaShopee()`
pronto e testado contra a API real.

Onde: `scripts/publica-automatico.mjs`, em `enviaComAnuncio`, antes de
montar a mensagem.

**Cuidados:**
- A chamada é de rede, dentro do laço que dorme. `lib/shopee-api.ts` já
  põe timeout — não remova.
- **Falha da API não pode virar canal mudo.** Se não responder, publique
  com o dado do feed, como hoje. É a mesma lógica da queda do
  `an_redir`.
- Se o preço mudou, decida: republicar com o novo, ou cancelar. Note que
  já existe `preco_na_fila_centavos` e o conceito de publicação
  `bloqueada` — leia `lib/publicacoes.ts` antes de inventar um terceiro.

**Como provar que funcionou:** compare `oferta.preco_atual_centavos` com
o preço da API numa amostra, e conte quantas divergem. Se for perto de
zero, o item não vale o trabalho — e isso também é resultado.

### 2.2 `global_item_attributes` como fonte de atributo

O feed da API tem esse campo; o CSV não. Se ele trouxer gênero, ele é
**melhor que a heurística de título** que a D-063 precisou inventar.

**Confira primeiro se ele traz `GENDER`.** Se trouxer, a leitura de
título (`lib/genero-pelo-titulo.ts`) vira rede de segurança em vez de
fonte — e a ordem de precedência tem que ser: atributo da loja > título.
O módulo já não sobrescreve atributo existente, então a mudança é de
quem escreve primeiro.

### 2.3 `conversionReport` — é isto que fecha a Fase 0

`conversionReport` e `validatedReport` devolvem a comissão com `orderId`
e `checkoutId`. Com o link curto já carregando o subid (conferido:
`utm_content=radarteste----`), o ciclo fecha **sem depender do relatório
do Mercado Livre**.

Falta o passo que não é código: **uma compra real, feita por outra
pessoa**. Autocompra é violação de termo nos três programas. Está no
`docs/roadmap.md`, Fase 0.

---

## Bloco 3 · Os canais

### 3.1 Medir se o perfume destravou

Em 04/08 os masculinos publicáveis foram de 17 para 26, e **18 termos de
busca novos entraram** — mas eles só aparecem na descoberta seguinte.

**Meça de novo depois de uma rodada da rotina diária:**

```sql
select n.slug, count(*) produtos,
       count(*) filter (where p.atributos->>'GENDER'='Masculino') masculinos
  from produto p join nicho n on n.id=p.nicho_id
 where n.slug in ('perfume','beleza') group by 1;
```

Se não subiu, o problema não eram os termos, e a D-063 precisa ser
revisitada.

### 3.2 Beauty — o que ficou aberto é editorial, não técnico

O filtro de suprimento profissional está no ar (migrations 55 a 57). O
que **não** está resolvido, e é decisão do dono:

- **Produto que não é beleza** chega no canal: cinta modeladora (é
  `moda`), escova de dente (higiene), barbeador masculino.
- **Título que aponta defeito no corpo de quem lê:** "Diminui Barriga",
  "Pálpebra Flácida". Isso não expulsa por irrelevância, expulsa por
  desconforto — e a pessoa não reclama, ela silencia o canal.

**Não resolva isso com regex sem falar com o dono.** É escolha
editorial, e o custo de errar é barrar produto que faz a pessoa ficar.

### 3.3 Voz por canal — precisa de decisão antes de código

Hoje existe **um `modelo_mensagem` para os sete canais**. Dar emoji e
tom próprios ao Beauty significa modelo por canal: mudança de schema, de
`lib/mensagem.ts` e da tela `/ajustes/modelos`.

O dono levantou isso e **não decidiu**. Pergunte antes de construir.

---

## Avulsos, todos com diagnóstico pronto em `docs/revisao-04-08.md`

- **F-07** — o botão "publicar todas" da tela `/publicar` ignora o ritmo.
  Zero referências a `podePublicarAgora` ali. É decisão, não defeito.
- **F-08** — nenhuma Server Action confere papel. Não morde hoje (só
  existe uma conta); o gatilho é o primeiro operador de verdade
  receber acesso, junto com a D-027.
- **`next` 16.2.12 → 16.3.0** — resolve quatro avisos de `postcss`.
- **A troca de prateleira** deixa `publicacao.oferta_id` apontando para o
  anúncio velho. O texto publicado fica em `publicacao.mensagem`, então
  dá para auditar, mas análise que vá de publicação para anúncio lê o
  errado.

---

## Três coisas que eu faria diferente se recomeçasse

1. **Teria medido antes de escrever o diagnóstico**, não depois. Quatro
   afirmações minhas caíram, e todas cairiam mais barato se eu tivesse
   consultado o banco primeiro.
2. **Teria rodado cada heurística de título contra o catálogo real antes
   de aplicar.** Os três falsos positivos do Beauty apareceram em
   produção, e apareceriam numa consulta de trinta segundos.
3. **Teria semeado dado no banco local antes de testar migration que
   insere.** O banco vazio deu falsa confiança e o erro só apareceu na
   nuvem.
