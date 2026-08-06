# Handoff — o que falta, e como trabalhar aqui

Reescrito em 04/08/2026, à noite, ao fim de uma sessão longa. A versão
anterior deste arquivo foi cumprida quase inteira e o que sobrou dela
está aqui embaixo, junto do que apareceu no caminho.

**Ordem de leitura antes de tocar em qualquer coisa:** `AGENTS.md`
inteiro → `docs/o-que-04-08-descobriu.md` (os números que mudaram sete
decisões) → `docs/onde-paramos.md` → este arquivo.

---

## Parte 1 · Como trabalhar aqui

Isto vem primeiro de propósito, e a lista cresceu hoje.

### Meça antes de afirmar. Sempre.

Você tem leitura do banco de produção e do log do Actions. Em 04/08,
**sete afirmações caíram quando alguém foi conferir** — incluindo três
minhas, e uma delas era uma migration pronta para subir.

```bash
# banco de produção, por SQL, com o token do cofre da 4YU
export SUPABASE_ACCESS_TOKEN=$(grep "^SUPABASE_ACCESS_TOKEN=" \
  ~/dev/gabriel/4yu-apps/.secrets/4yu.env | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
ref=$(grep "^SUPABASE_PROJECT_REF=" .env.producao | cut -d= -f2-)
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" -d '{"query":"select 1"}' \
     "https://api.supabase.com/v1/projects/$ref/database/query"

# log de produção
gh run list --workflow=publica.yml --limit 20 --json databaseId,conclusion,headSha
gh run view <id> --log | grep -E "publicadas ·|✗ |⤫ "
```

### O que este projeto exige de uma mudança

1. **`pnpm verifica`** — tipos, lint e ~450 asserções.
2. **`node --check` nos `scripts/*.mjs`** — `pnpm verifica` **não olha
   essa pasta**. É por isso que lógica nova vai para `lib/`.
3. **Migration testada contra Postgres de verdade.** O Docker sobe nesta
   máquina desde 04/08: `npx supabase migration up --local`.
4. **Antes e depois medidos em produção**, com número.

### As armadilhas, e as cinco de baixo são novas

**Variável de ambiente nova entra no workflow no MESMO commit que o
código que a lê.** Duas frentes prontas ficaram inertes um dia inteiro
porque `SHOPEE_APP_ID` não existia como segredo. Variável que falta não
quebra nada: o código cai para o caminho de reserva, avisa uma vez no
começo da execução, e tudo parece funcionar.

**A API do Supabase mata qualquer consulta aos 8 segundos.** É o
`statement_timeout` do papel `authenticator`, e vale para todo
`/rest/v1/`. O papel `postgres`, da conexão direta, não tem limite.
Operação pesada vai por `psql` sobre `SUPABASE_DB_URL`, com
`PGOPTIONS="-c statement_timeout=..."`.

**`alter function ... set statement_timeout` NÃO resolve isso.** Testado
contra Postgres real, em `sql` e em `plpgsql`: a função morre igual. O
cronômetro é armado quando a consulta externa começa e mudar o valor no
meio não o rearma. A migration 63 existe só para registrar esse teste,
porque a ideia parece óbvia e é recomendada por aí.

**Regra de título tem que rodar contra o catálogo real antes de
aplicar, e você tem que OLHAR a amostra.** Foi assim que apareceram os 12
"produtos" da Amazon que não são produto ("Se prepara cupom Amazon
16:30") e os falsos positivos do Beauty.

**Regra que exige casamento único descarta o caso fácil.** A primeira
versão do classificador de nicho devolvia nulo quando duas regras
casavam, e jogava fora "Ração para Gatos sabor Leite". Ordem por
especificidade resolve; "segurança" que perde o óbvio é desistência.

**Catálogo pequeno num nicho quase nunca é filtro, mapa ou comporta.
Vá ver quantos anúncios existem ANTES de investigar o funil.** O dono
cobrou que o pet não recebia brinquedo, casinha nem coleira. Os termos
de busca existiam, os domínios estavam mapeados, as comportas não
reprovavam — o catálogo é que tinha 6 brinquedos contra 275 antipulgas.
Três hipóteses boas, todas erradas, e a consulta que decidiu levou um
minuto.

**Busca paginada sem cursor congela em silêncio, e o filtro de
duplicados é o que esconde.** `porBusca` pedia `products/search` sem
`offset`: toda rodada perguntava a mesma coisa, recebia a mesma
resposta, e o filtro de "já conhecidos" descartava tudo sem erro e sem
aviso. Teto duro de 2.520 produtos na vida do projeto. Medido depois:
"brinquedo pet" tem `paging.total` de **10.000**. Toda paginação deste
projeto merece a pergunta "o que faz a janela andar?", e a resposta não
pode ser "nada".

**Marca não é categoria, e a conferência tem que ser contra o catálogo
INTEIRO, não contra a amostra que você está olhando.** Escrevendo a
regra de bebê em 04/08 eu ia usar "johnson", porque os três itens da
Amazon na minha frente eram todos Johnson's Baby. O catálogo completo
tinha "Cotonetes Johnson & Johnson" e "Fio Dental Reach Johnson's", que
não são de bebê e iriam para o canal Kids. Uma consulta de dez segundos
antes de escrever a regra. Amostra estreita mente com confiança.

**Comporta que procura o que NÃO pode estar lá precisa de controle
positivo.** A do backup procura `TABLE DATA credencial_rotativa` no
índice do dump. Se o formato do `pg_restore --list` mudar, a busca deixa
de casar com qualquer coisa e a comporta passa a **aprovar tudo,
calada** — o mesmo modo de falha que criou o problema. Por isso ela
exige achar os dados de `anuncio` antes de procurar o que não pode
existir. Toda comporta escrita como "se achar X, falhe" tem esse buraco.

**Quando não der para testar na sua máquina, faça o teste se provar no
lugar onde ele roda.** Não há Docker, `pg_dump` nem sudo aqui, então a
comporta do backup não podia ser rodada localmente. A saída não foi
"confiar na documentação", foi pôr o controle positivo dentro dela e
disparar o workflow à mão.

**NUNCA cite migration por número. Cite pelo nome do arquivo.** Em
04/08 dois agentes trabalharam em paralelo e os dois numeraram contando
os arquivos na hora de escrever. O resultado é que **"migration 64"
aparece em comentário significando três coisas diferentes**:

```
o que eu chamei de 64   →  20260805040000_selo_do_vendedor_e_cupom_no_post
o que o outro chamou    →  20260805060000_o_beauty_para_de_receber_aplique
a contagem de verdade   →  20260805030000_a_folga_na_funcao_nao_funciona
```

O número só existe na cabeça de quem escreveu; o carimbo de data no nome
do arquivo é único e não muda. Comentário antigo que diga "migration 55"
provavelmente está certo, porque foi escrito quando havia um agente só.
Comentário de 04/08 em diante, confira o nome antes de acreditar.

**Migration que casa por emoji não se aplica.** Case sempre por
variável (`{link}`, `{frete}`), nunca por enfeite que o painel edita.

**Hora: grave em UTC, mostre em São Paulo** (regra 3.9). Mostrei
`16:10Z` para o dono e ele leu como 16h de Brasília, com razão.

**`pnpm db:reset` apaga tudo.** Use `npx supabase migration up --local`.

### O que nunca muda sem conversa

Regras 3.1 (segredo), 3.2 (WhatsApp), 3.3 (Amazon), 3.4 (mentir sobre
preço) e 3.10 (`#publi`).

**A 3.4 foi flexibilizada pelo dono em 04/08**, e só para a Amazon: ele
autorizou republicar o preço que os canais concorrentes alegam. **A 3.3
continua inteira**, porque ela protege a conta e não a estética: nenhuma
série de preço da Amazon pode ser construída.

**E peça antes de:** deploy, mexer em variável de produção, criar tabela,
ou construir algo de fase futura.

---

## Bloco 1 · Segurança — fechado, menos a rotação

**Resolvido na noite de 04/08.** Ficou aberto o dia inteiro, e o que o
destravou foi medir em vez de planejar.

**O que foi feito:**

- **O dump parou de carregar a credencial.**
  `--exclude-table-data='public.credencial_rotativa'` no
  `backup-semanal.yml`. É `--exclude-table-data` e não
  `--exclude-table`: a tabela continua no dump e só o conteúdo fica de
  fora, senão o restore de um projeto novo quebraria nas views e funções
  que a referenciam.
- **Uma comporta antes do upload, com controle positivo.** Ela procura
  `TABLE DATA credencial_rotativa` no índice do dump, mas antes disso
  **exige achar os dados de `anuncio`**. Sem esse controle, uma mudança
  de formato do `pg_restore --list` faria a busca não casar com nada e a
  comporta passaria a aprovar tudo, calada — que é exatamente o modo de
  falha que criou este problema.
- **Provado num Postgres de verdade**, disparando o workflow à mão, e
  não nesta máquina (que não tem Docker, `pg_dump` nem sudo). Saída:
  `✓ dump tem dados, e credencial_rotativa entrou sem os dela`.
- **Backup limpo gerado antes de apagar os sujos**, para o projeto não
  ficar sem backup nenhum no meio do caminho.
- **Os dois artefatos vazados foram apagados**
  (`radar-ofertas-2026-08-02.dump` e `radar-ofertas-2026-07-31.dump`).
  Só resta `radar-ofertas-2026-08-04.dump`.
- **O comentário mentiroso no topo do workflow foi reescrito.** Ele
  dizia "artefato do repositório, que é privado", deixou de ser verdade
  em 01/08 (D-038) e continuou dizendo isso por três dias. Foi ele que
  fez o descuido parecer seguro.

### O que continua aberto, e é do dono

**Rotacionar o cookie e o csrf da Central.** O `afiliados_cookie` é de
01/08, está nos dois dumps que ficaram públicos por dois dias, e
**continua valendo**. Só o dono faz: sair da Central, entrar de novo, e
capturar o cURL do botão Gerar na aba Network.

O `refresh_token` do ML **não precisa**: ele rotacionou sozinho várias
vezes desde então, e o valor que vazou já morreu.

**Decisão do dono em 04/08: a rotação espera o Vault.** Vale registrar
que o motivo original de esperar caiu, e a medição é esta:

> O `plano-vault.md` dizia "não rotacione antes da Fase 4, senão o
> segredo novo é escrito no mesmo lugar que vazou". Mas o `public`
> vazava **pelo backup**, e o backup parou de carregá-lo. Conferido que
> não sobrou outro caminho: `credencial_rotativa` tem RLS ligado, zero
> policies, e `anon`/`authenticated` sem grant nenhum. Uma leitura real
> pela chave pública do painel devolve `permission denied`, HTTP 401.

Ou seja, rotacionar agora seria seguro. Esperar é decisão, não bloqueio.

---

## Bloco 2 · A Amazon, meia construída

**Decisão do dono em 04/08:** republicar o preço que os canais
concorrentes alegam, aceitando furar a 3.4, até somar as **10 vendas** que
liberam a Creators API (temos 1). Ele disse que não consegue rodar
script, então o caminho é automático.

### O que já está feito

`lib/nicho-pelo-titulo.ts`, com 27 casos de teste. Duas funções:

- `ehTituloDeProduto` — separa produto de conversa de canal. **12 dos 99
  anúncios da Amazon não são produto**: "Cupom Amazon #anuncio", "Se
  prepara cupom Amazon 16:30", "Novo brinde L'Oréal Elseve".
- `nichoPeloTitulo` — 69 classificados, 18 sem nicho. Os que têm canal
  somam 59: eletrônico 37, beleza 16, pet 5, suplemento 1.

### O que falta, em ordem

**1. ~~Aplicar o nicho aos anúncios.~~ FEITO em 04/08, à noite**, por
`scripts/nicho-da-amazon.mjs`. Medido em produção:

| | Antes | Depois |
|---|---|---|
| anúncios com nicho | 1 | **74** |
| anúncios ativos | 99 | **87** |

Dos 74, **63 estão em nicho que tem canal**: eletrônico 39, beleza 15,
pet 5, bebê 3, suplemento 1. Os outros 11 caem em casa, mercado e
automotivo, que não têm canal. Sobraram 13 sem nicho, e a maioria é
higiene e saúde (absorvente, enxaguante bucal), que **é certo continuar
sem**: o nicho `saude` não tem canal e a decisão sobre ele está no Bloco
3.

Os 12 desativados são a conversa de canal que virou linha de catálogo.
Foram para `ativo = false`, alavanca que já existia e que a detecção
inteira respeita.

**E olhar a amostra achou um defeito de verdade**, que é o motivo de a
regra ter mudado junto: produto de bebê é descrito com as palavras da
beleza, e `beleza` estava na frente de `bebe` na lista. "Loção
Hidratante Para Uso Diário Johnson's Baby" casava com `hidratante` e ia
para o canal de Beleza, tendo o Kids ali do lado. `bebe` subiu na ordem.

E "johnson" sozinho seria errado, o que só apareceu conferindo o
catálogo **inteiro** antes de escrever a regra: "Cotonetes Johnson &
Johnson" e "Fio Dental Reach Johnson's" são da marca e não são de bebê.
É o "Baby" que decide. São 36 casos de teste agora, todos com título
real.

**Isso não fez a Amazon publicar, e foi conferido em vez de suposto.**
São duas travas independentes: `avalia_anuncios` reprova por
`loja_sem_historico`, e a loja não tem dado nenhum de série (zero pontos
de preço, zero `preco_original_centavos`), então nem `detecta_quedas`
nem `detecta_declarados` têm o que ver. Depois de gravar, as ofertas da
Amazon continuam em 1.

**2. O caminho que transforma menção em oferta.** É o que falta de
verdade, é o próximo passo, e ele tem que nascer certo:

- a oferta nasce da `mencao` com `preco_alegado_centavos`, **não** de
  `preco_ponto` — construir série de preço da Amazon viola a 3.3 e
  custa a conta
- só menção **recente**. Medido: só 13 das 208 foram vistas em 24h, então
  o volume real é de alguns posts por dia, não uma enxurrada
- `marketplace.base_de_historico = false` faz `detecta_ofertas` reprovar
  a Amazon por `loja_sem_historico`, e **isso está certo**. O caminho
  novo é outro, não é afrouxar esse
- a mensagem não pode afirmar desconto que não medimos. O `{lastro}` da
  Amazon deve sair vazio, como já sai o `lastro_declarado`

**3. Quando somar 10 vendas:** Creators API, preço de verdade, e o
caminho acima vira redundante.

---

## Bloco 3 · Decisões que estão com o dono

- **Cupom sem mapa.** `BABIESPETSRELAMPAGO` cobre bebê e pet ao mesmo
  tempo e a tabela só aceita um nicho. `AGOSTOCHEGOU` não diz o escopo
  pelo nome. Sem mapa, não publicam — que é o desfecho seguro.
- **Saúde: 39% do nicho é sex shop.** Não abra o canal antes de decidir.
  Canal marcado como sensível no Telegram **some do iOS e do Android** por
  padrão, que é onde está toda a audiência. Detalhe em
  `docs/nichos-sem-canal.md`.
- **Casa fica com material de construção.** Decidido pelo dono em 04/08:
  não separar para `ferramenta`.
- **F-07** — o botão "publicar todas" ignora o ritmo.
- **F-08** — nenhuma Server Action confere papel. Gatilho: o primeiro
  operador de verdade receber acesso.

---

## Bloco 4 · Técnico, em aberto

**Por ordem de quanto dói.**

1. **A coleta da Shopee grava um item por vez.** 4.000 itens levam **48
   minutos**, com três chamadas ao banco cada. Sobraram **1.163
   candidatos de nicho com canal** que não couberam na cota, e subir
   `SHOPEE_MAX_ITENS` agora traz catálogo publicável de verdade — mas
   sem gravar em lote o passo passa de uma hora e meia. **Gravar em lote
   antes de subir o teto.**
2. **`BORA` é cupom da KaBuM e está sendo gravado como cupom do Mercado
   Livre.** O colhedor é ML-only e não confere de que loja o cupom é. Ele
   nasce sem mapa e não publica, então não morde hoje.
3. **`vendas_estimadas` é nulo em 100% dos anúncios da Shopee.** A
   comporta `vendedor_novato` é cega lá, e a linha "+N vendas" da
   mensagem nunca aparece em post da Shopee.
4. **`conversionReport` da Shopee** — é o que fecha a Fase 0 sem depender
   do relatório do ML. O link curto já carrega o subid.
5. **Gravar o preço revalidado** (D-065). Quando o publicador corrige o
   preço no último instante, o número novo não fica em coluna nenhuma.
   Acontece em ~6% dos posts da Shopee. **Sobe junto com a migration do
   item 4**, que é quando a pergunta "que preço nós anunciamos?" passa a
   ter dono.
6. **A troca de prateleira** deixa `publicacao.oferta_id` apontando para
   o anúncio velho. O texto publicado fica em `publicacao.mensagem`,
   então dá para auditar, mas análise que vá de publicação para anúncio
   lê o errado.
7. **`next` 16.2.12 → 16.3.0**, que resolve quatro avisos de `postcss`.
8. **O agendador do GitHub continua não entregando.** A coleta horária
   ficou das 18h26 às 20h22 sem rodar. A D-052 já sabia; o `pg_cron`
   cobre o publicador, não a coleta.

---

## O que NÃO fazer, com o motivo medido

- **Não troque a coleta da Shopee do CSV pela API** (D-064): a API não
  tem `shop_rating`, e a falta dele reprovava toda oferta da Shopee.
- **Não use `global_item_attributes` como fonte de gênero** (D-068):
  medido, o atributo perde do título em 44 casos e fica calado em 81%.
- **Não classifique nicho pelo canal que achou o produto.** Foi o defeito
  consertado em 01/08; canal de pet publica fone de ouvido.
- **Não tente ler preço de Pix pela API.** `/items/{id}`,
  `/items/{id}/prices` e `/items/{id}/sale_price` devolvem **403** para o
  nosso app, e a rota que funciona não tem campo de meio de pagamento.
- **Não afrouxe a comporta de reputação para reaproveitar o feed pequeno
  da Shopee.** Ele não tem `shop_rating` e por isso é descartado; o certo
  seria enriquecer a reputação, nunca baixar a régua.

---

## Três coisas que eu faria diferente

1. **Teria cobrado o Bloco 1 na primeira hora.** Ele é o único item
   urgente e foi o único que não andou.
2. **Teria testado a migration antes de escrevê-la com confiança.** A 62
   estava errada e só não subiu porque o dono mandou testar.
3. **Teria commitado os documentos assim que foram escritos.** Três
   arquivos de 652 linhas ficaram fora do Git por horas, e dois deles
   eram citados como fonte por commits meus.
