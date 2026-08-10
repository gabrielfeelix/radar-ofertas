# Radar de Ofertas — Instruções para o agente

Leia este arquivo por inteiro antes da primeira tarefa. Ele é a fonte de verdade sobre stack, escopo e regras. Detalhamento fica em `docs/`.

**Idioma:** responda ao usuário em português do Brasil. Código, nomes de variáveis, tabelas e commits em português também — o dono do projeto não é desenvolvedor de carreira e precisa ler o código sem tradução mental.

---

## 1. O que é este projeto

Sistema de curadoria e distribuição de ofertas de marketplace com link de afiliado. Ele monitora preços de produtos, detecta quedas reais, pontua a qualidade da oferta, monta a mensagem e distribui para grupos de WhatsApp e canais de Telegram.

O negócio funciona assim: parceiros (amigos e youtubers) trazem a audiência, o dono do projeto fornece o sistema e a curadoria, e a receita de comissão é dividida. **Todos os links usam um único ID de afiliado — o do dono** — com um subid diferente por publicação, que é o que permite saber qual grupo gerou qual venda.

O diferencial não é disparar mensagem. É saber **o que vale publicar, em qual grupo e se realmente está barato**. Toda decisão técnica deve servir a isso.

Contexto completo de negócio, divisão de receita e fluxo do dinheiro: `docs/negocio.md`.

---

## 2. Stack — decidida, não rediscuta

- **Banco e auth:** Supabase (Postgres). Coletores em Edge Functions.
- **Painel:** Next.js (App Router) + TypeScript.
- **Hospedagem do painel:** **a Vercel, hoje e de fato** — o painel responde em `radar-ofertas.vercel.app` com `server: Vercel`, e `@opennextjs/cloudflare` não está no `package.json`. Cloudflare Workers com OpenNext continua sendo o **destino decidido**, e a linha abaixo é o porquê; enquanto a mudança não acontece, esta seção descrevia uma intenção como se fosse o estado, e isso confundiu mais de um agente. **Não Cloudflare Pages** — a integração nativa não roda Next.js em modo servidor e o `next-on-pages` foi descontinuado (D-016). **Não Vercel Hobby** — o plano gratuito da Vercel não permite uso comercial, e este projeto gera receita.
- **Agendamento:** GitHub Actions, não `pg_cron` (D-015). Mantém o projeto gratuito do Supabase acordado e falha de forma visível.
  **Duas exceções, abertas em 03/08 e 04/08:** o `pg_cron` dispara também a `rotina-diaria.yml`, às 21h de São Paulo (migration 50).
 o `pg_cron` dispara o `publica.yml` de 5 em 5 minutos, porque o agendamento do GitHub entrega cerca de uma execução a cada oito (D-052). Ele é **gatilho, não agendador** — não coleta, não publica, não expurga; manda o Actions rodar, e o trabalho e o log continuam lá. Detalhe e diagnóstico em `docs/cron-externo.md`.
- **Redirecionador de links:** Supabase Edge Function, domínio próprio.
- **Telegram:** Bot API oficial.
- **WhatsApp:** Evolution API (camada REST sobre o Baileys) em VPS brasileira, chip dedicado e descartável (D-071). O `wa.me` continua como caminho manual de contingência.
- **IA para mensagens:** fora do escopo inicial. Template resolve a maioria dos casos.

Se você acha que outra tecnologia é melhor, escreva a sugestão em `docs/decisoes.md` como proposta e **pergunte antes de trocar**. Não troque por conta própria.

---

## 3. Regras duras — violar qualquer uma destrói o projeto

**3.1 Nenhum segredo entra no Git.** Chaves do Supabase, tokens de bot e IDs de afiliado ficam em variáveis de ambiente. `.env` está no `.gitignore` e continua lá. Se precisar de uma variável nova, adicione ao `.env.example` com valor falso, nunca o real. Antes de qualquer commit, confira que nenhum segredo entrou.

**3.2 O WhatsApp publica sozinho, e o chip é descartável.** Desde 06/08 o sistema posta em grupo de WhatsApp pela Evolution API rodando na VPS (D-071). Não existe caminho oficial: a Groups API tem teto de 8 participantes, Canal não tem API de publicação, e broadcast é mensagem individual com opt-in. O que existe é cliente não oficial, que o WhatsApp detecta pelo protocolo, não só pelo comportamento. **Este número vai cair, e o desenho é para isso custar um chip, não a operação.**

O que não se negocia, porque é o que separa perder um chip de perder a audiência:

- **O número do bot nunca é o único admin do grupo.** Um segundo número, do dono, fica de titular e nunca roda bot. Quando a conta cai, o WhatsApp passa o admin para outro membro e o grupo sobrevive; sendo o bot o único lá dentro, morre o grupo junto.
- **Nunca o número pessoal nem o de trabalho.** Banimento permanente é perda de identidade, não de ferramenta.
- **O IP da VPS é brasileiro.** O país do IP tem que bater com o do número.
- **Um chip por instância, com teto próprio.** `whatsapp_envios_dia_max` conta por `canal.whatsapp_instancia` e não por canal, porque é o número que cai. Teto de número maduro: menos de 200 envios/dia, menos de 30 por hora.
- **De 4 a 10 minutos entre promos, sorteado, e esta é a primeira regra do WhatsApp.** Palavras do dono em 10/08: *"tem que ser aleatório entre 4 à 10 min cada promo, NAO PODEMOS SER MENOS OU MAIS QUE ISSO"*. Vale **acima da faixa do dia** — pico, normal e madrugada usam a mesma janela, ao contrário do Telegram. Menos que 4 é padrão de disparo em massa; mais que 10 não é o que foi combinado. O sorteio é estável por canal e por último post, senão o laço do publicador o refaz a cada volta e o intervalo real estoura o teto (`intervaloDoWhatsAppEmMinutos`, em `lib/ritmo.ts`). Quem impede o grupo de tocar de madrugada é o `horarios_permitidos` do canal, não o intervalo. **O intervalo vale por canal E por chip** (`podeChipFalarAgora`): só por canal, oito grupos no mesmo número teriam oito relógios independentes e sairiam em sequência, com segundos entre eles, cada um tendo respeitado a própria regra. E a conta que decorre disso precisa estar dita: **um chip não serve oito grupos a 30 posts/dia** — seriam 240 envios num número só, contra o teto de menos de 200. Um chip serve oito grupos a uns 12 posts/dia, ou são precisos mais chips.
- **Número novo aquece por 14 dias, e o sistema faz a conta.** A rampa é 10 promos no dia 1, 15 no 2, 20 no 3, 25 no 4, e 30 do 5º ao 14º; do 15º em diante vale o `bot.envios_dia_max`. A curva vive em `lib/aquecimento.ts` e o dia 1 é a data em `bot.aquecimento_inicio` — no código porque é política, não configuração: em parâmetro ela mudaria em produção sem commit, sem teste e sem ninguém lembrar por quê. **Ela não conta o que a pessoa manda do aparelho:** os 10 do dia 1 são de promo, e sem conversa humana junto eles são o dia inteiro do chip, o que deixa o padrão visível. Aquecer é falar como gente, e isso é trabalho de operação. `whatsapp_automatico` deixou de ser o freio do aquecimento e virou o freio de mão: mata todo o WhatsApp agora, sem tocar no Telegram.

O caminho manual continua existindo, e não é resto: `BotaoWhatsApp` abre o `wa.me` com a mensagem pronta, e é a operação enquanto o chip novo aquece.

> A regra era o contrário até 06/08: proibia automatizar em qualquer forma. Ela foi rediscutida do zero em 03/08 (D-053) e mantida **por conta, não por princípio** — R$30/mês de chip mais VPS não se pagavam num grupo sem audiência. O dono derrubou a conta: *"n ligo de derrubar conta do numero, vou ir comprando varios"*, *"vou pagar 30/mes chip e etc n ligo nao"*. A D-053 continua valendo como pesquisa: os números de aquecimento, os limiares de detecção e o que cai quando cai saíram todos dela.

**3.3 Preço da Amazon não vira histórico — e imagem é ainda mais restrita.** A política de associados permite guardar preço em cache por no máximo 24 horas. Portanto: não construa série histórica de preço da Amazon, não exiba comparação histórica de Amazon, e descarte pontos de preço da Amazon com mais de 24 horas. Histórico de preço é construído em cima de **Mercado Livre e Shopee**. A Amazon entra como fonte de oferta pontual.

**Imagem tem regra própria, e mais dura:** *"You will not store or cache Product Advertising Content consisting of an image, but you may store a link to it for up to 24 hours."* Ou seja: **nunca guarde o arquivo da imagem** — só o link, e ele expira igual ao preço (`anuncio.imagem_url`, expurgado por `expurga_imagens_expiradas`). ASIN e SKU, ao contrário, podem ficar para sempre: é o que permite reencontrar o produto depois de expurgar o resto.

**E o painel é PWA (D-018):** *"If your application includes a client application, the client application may not store or cache Product Advertising Content."* Service worker guardando tela com preço da Amazon viola isso. Cache offline, quando existir, exclui as telas que mostram preço.

**3.4 Nunca afirme "menor preço histórico" sem lastro.** Enquanto a série de preços de um anúncio tiver menos de 14 dias, a mensagem não pode falar em desconto histórico. Use a redação honesta: *"menor preço que observamos desde DD/MM"*. Mentir sobre preço queima o grupo e é o erro que mata os concorrentes.

**3.5 Dinheiro é inteiro, em centavos.** Todo valor monetário no banco e no código é `INTEGER` representando centavos. Nunca `float`, nunca `REAL`. Formatação para reais só na camada de exibição.

**3.6 O subid é sagrado.** Toda publicação gera um subid único, curto e alfanumérico, gravado e indexado. Sem ele não existe divisão de receita. Nunca reaproveite subid entre publicações.

**3.7 Repasse só sobre dinheiro recebido.** O cálculo de repasse ao parceiro considera apenas comissões no estado `recebida`. Nunca calcule repasse sobre comissão estimada ou apenas registrada.

**3.8 LGPD: não guarde dado pessoal de membro.** Não existe cadastro de membros de grupo. Em cliques, grave **hash** do IP, nunca o IP em texto. Sem nome, telefone ou e-mail de quem clica.

**3.9 Datas em UTC, exibição em America/Sao_Paulo.** Todo `timestamptz` gravado em UTC. Conversão só na exibição. Horários de publicação configurados por canal são no fuso de São Paulo.

**3.10 Toda mensagem publicada identifica que é publicidade.** Link de afiliado gera comissão, e conteúdo remunerado é publicidade — o CONAR, o CDC e a própria Shopee dizem isso com todas as letras. A identificação usa `#publi`, `#publicidade`, `#parceriapaga` ou `#conteúdopago`, **aparece de imediato** (nunca escondida no fim, em letra pequena ou perdida entre hashtags), e `#ad` não conta: não é reconhecida pelo público brasileiro. Marcar o perfil da loja também não basta. A Shopee pode pedir suspensão do conteúdo de quem não cumpre. Detalhe e fontes em `docs/pesquisa-operacao.md`.

**3.11 Nunca use travessão no que vai para o canal.** Nada de `—` nem `–` em mensagem publicada, nota do curador ou modelo. **Motivo: tem cara de texto de IA**, e canal de oferta vive de parecer gente. O leitor não sabe explicar por quê, mas sente, e desconfiança em canal de oferta custa a venda. Use vírgula, ponto ou dois-pontos. Vale só para o que o público lê: código, comentário e documentação seguem normais.

---

## 4. Fase atual e escopo

**Fase atual: 0 em andamento, com a base da Fase 1 em construção em paralelo.**

As duas não conflitam: o resultado da Fase 0 decide a granularidade do subid, que só aparece na Fase 2.

Este projeto avança por fases. Cada fase tem um critério de conclusão. **Não construa nada de uma fase futura, mesmo que pareça fácil e mesmo que o usuário peça de passagem.** Se ele pedir algo fora da fase atual, avise que é da Fase N, explique o custo de antecipar, e pergunte se quer mesmo. Escopo inflado é o principal risco deste projeto.

Resumo das fases (detalhe em `docs/roadmap.md`):

| Fase | Objetivo | Concluída quando |
|---|---|---|
| 0 | Provar que o subid volta no relatório de comissão | Uma compra real de teste aparece no relatório com o subid correto |
| 1 | Radar silencioso e motor de curadoria, sem canal | A detecção aprova 30+ ofertas por dia, por uma semana, sem afrouxar parâmetro |
| 2 | Primeiro canal, do próprio dono | Primeira comissão confirmada, rastreada até a publicação |
| 3 | Multi-parceiro | Um parceiro real operando com split e painel próprio |
| 4 | Parceria com youtuber | — |

**Fora do escopo até a Fase 4, sem exceção:** extensão de navegador, IA escrevendo mensagens, aplicativo mobile, cadastro de membros, gráfico bonito de histórico de preço, arquitetura multi-workspace de SaaS.

*Integração com API oficial de marketplace saiu desta lista.* Ela era considerada luxo de fase avançada, mas a pesquisa de mercado mostrou que é o contrário: a via oficial é a única que não depende de raspagem frágil, e a Shopee publica a dela abertamente. É trabalho de Fase 1 (D-010).

---

## 5. Modelo de dados

O núcleo é a separação entre quatro conceitos que costumam virar uma tabela só:

- **produto** — a identidade da coisa
- **anuncio** — esse produto numa loja específica (o mesmo produto em três lojas são três anúncios)
- **oferta** — um anúncio que ficou barato agora, com começo, fim e nota
- **publicacao** — uma oferta enviada para um canal, que é o que gera link, clique e comissão

A curadoria é a única coisa que separa este projeto de um repassador de oferta alheia. Ela mora **no banco**, em `avalia_anuncios` — nunca duplique essa regra em TypeScript. Detalhe em `docs/dados.md` e no porquê em `docs/mercado.md`.

Schema completo, campos e índices: `docs/dados.md`. Não crie tabela fora do que está lá sem registrar a decisão.

---

## 6. Convenções de código

- Tabelas e colunas em `snake_case`, português, singular para a tabela (`publicacao`, não `publicacoes`).
- Toda tabela tem `id` (uuid ou bigint identity), `criado_em` e, quando fizer sentido, `atualizado_em`.
- Migrations versionadas em `supabase/migrations/`, nome com data e descrição. **Nunca altere migration já aplicada — crie outra.** A reescrita de 27/07/2026 foi exceção deliberada e aprovada, com o banco vazio e nada publicado. **Essa porta fechou em 31/07/2026**, quando o projeto Supabase da nuvem passou a existir e as 15 migrations foram aplicadas nele: alterar uma migration já aplicada agora significa banco local e banco da nuvem contando histórias diferentes, e a diferença só aparece em produção.
- **Para aplicar migration na nuvem** (`pnpm db:publica`), o `SUPABASE_ACCESS_TOKEN` **não está no `.env` deste projeto** — é token de conta e vive no cofre da 4YU, em `4yu-apps/.secrets/4yu.env`. Sem ele o comando falha com *"Access token not provided"*. **Confira o ledger antes**, com `supabase migration list --linked`: se as colunas `local` e `remote` não baterem, pare em vez de empurrar. Detalhe em `docs/credenciais.md` §2.
- Row Level Security ligado em toda tabela desde a primeira migration. Parceiro só enxerga os próprios canais.
- Componentes React em `PascalCase`, funções em `camelCase`.
- Nada de `any` em TypeScript sem comentário justificando.
- Commits curtos e descritivos em português, no imperativo: `adiciona coletor de preco do mercado livre`.

---

## 7. Como trabalhar com este usuário

Ele é designer de UX, sabe o suficiente de banco de dados e produto, mas **não é desenvolvedor**. Isso muda como você responde:

- Explique o *porquê* das decisões técnicas em uma ou duas frases, sem jargão desnecessário.
- Quando gerar código, diga em que arquivo ele vai e o que ele faz. Não jogue um bloco solto.
- Quando um comando precisar rodar no terminal, escreva o comando exato e diga o que ele faz antes.
- Se algo der erro, explique a causa provável em português claro antes de propor a correção.
- Ele valoriza ser contrariado quando está errado. Se ele pedir algo que vai custar caro depois, diga.

---

## 8. Pare e pergunte antes de

- Instalar dependência pesada ou trocar qualquer item da stack da seção 2
- Criar tabela nova ou mudar tipo de coluna existente
- Escrever qualquer coisa que envie mensagem automaticamente no WhatsApp
- Coletar dados de um site sem confirmar que os termos daquele site permitem
- Construir algo de uma fase futura
- Fazer deploy ou alterar variável de ambiente em produção

---

## 9. Estado atual

> **Chegou agora? Leia `docs/onde-paramos-10-08.md` primeiro** — ele tem
> o estado mais recente, o mapa de onde cada coisa mora (VPS, chip,
> credenciais) e os erros de 10/08 anotados para não se repetirem.
> Depois `docs/onde-paramos.md`, que é o de 04/08 e continua valendo
> para tudo que o de 10/08 não cobre.
>
> **E leia isto:** o dono autorizou explicitamente mudar as regras deste
> arquivo e da documentação quando a realidade as contrariar. Elas
> foram escritas por vários agentes que não conversaram entre si.
> Continuam intocáveis sem conversa apenas as que protegem a conta ou o
> dinheiro: 3.1, 3.2, 3.3, 3.4 e 3.10.

Atualizado em 10/08/2026.

### 10/08/2026: o WhatsApp saiu do papel (D-071, D-072)

Existe VPS (Locaweb, `201.76.56.54`), existe Evolution em
`zap.4yu.com.br`, existe chip conectado (instância `radar01`, primeiro
dia 10/08) e existe canal `Radar Delas` com fila de 1693 itens limpa.
O publicador roda de dois lugares — GitHub Actions e cron da VPS — e a
trava do banco impede os dois publicarem juntos.

**O mapa completo de onde cada coisa mora está em
`docs/onde-paramos-10-08.md`.** Não reconstrua isso por tentativa: o
arquivo tem os caminhos, os comandos e os quatro erros que já custaram
tempo hoje.

Um deles vale repetir aqui porque é armadilha de código:
**`canal_aceita_atributos` tem duas versões vivas**, e a de dois
argumentos ignora todo filtro com escopo de nicho, sem erro nenhum.
Sempre passe o nicho como terceiro argumento. **Mantenha esta seção viva** — ela é o que uma sessão nova lê para saber onde parou. Atualize ao fim de cada bloco de trabalho.

### 05/08/2026: a primeira decisão de divulgação (D-069)

**Antes de dizer de novo que "o gargalo é audiência e ninguém está
atacando", leia a D-069.** Três sessões seguidas disseram isso porque o
trabalho de divulgação do dono acontece fora do repositório e não estava
escrito em lugar nenhum. Ele trocou títulos e descrições dos grupos,
divulga para amigos, vai colar cartaz em ponto de ônibus, e tem R$200
para gastar em 07/08.

O que ficou decidido: **empurrar o Beauty primeiro** (maior comissão por
venda, ~R$15 contra ~R$7 do Pet, porque beleza na Shopee paga até 30%),
**post pago em canal de Telegram e não Meta Ads** (63% de penetração do
Telegram no Brasil significa pagar por clique de quem não tem o app),
**um Instagram e não oito**, e **a LP não recebe tráfego pago** — ela
serve ao QR do cartaz e à bio, que é onde não cabem oito links.

**Os oito canais não são um problema a resolver.** Canal parado não
custa nada e o sistema enche os oito sozinho. O que é escasso é a
atenção do dono. Empurra-se um por vez.

**48 links de convite por origem foram criados** em 05/08
(`scripts/cria-links-de-convite.mjs`), seis origens por canal. O
Telegram conta quem entrou por cada um e mostra no aplicativo: é
atribuição de divulgação sem redirecionador e sem Fase 2. Os links vivem
em `.links-de-convite.json`, fora do Git, que é a memória do script — o
Bot API não lista links existentes, então **sem esse arquivo ele cria
tudo duplicado**.

**Os oito grupos ficam separados, e isso foi decidido, não esquecido.**
Pasta compartilhável e canal guarda-chuva foram propostos e recusados
(D-069). E não confunda: **canal do Telegram não é pasta, não dá para
"jogar os grupos dentro" de um.**

**O Instagram é um só e se chama `@radar4yu`** (D-069). "Radar de
Ofertas" tem dez perfis no Instagram, um deles com 27 mil seguidores;
entrar ali é virar cópia. `radar4yu` já é a etiqueta da Amazon e é o
nome que o domínio do redirecionador da Fase 2 vai ter que casar.

**Antes de comprar post pago, meça (D-070).** `scripts/mede-canal-alheio.mjs`
lê `t.me/s/<canal>` e devolve views ÷ inscritos. O mercado cobra por
inscrito e inscrito é a métrica errada: o `@pechinchou` tem 70 mil
inscritos e 644 views por post. O recomendado para os R$200 é o
`@promoemcasa`, com 6.190 inscritos e 24% de alcance.

**E a medição corrigiu um número que este repositório publicou:** o
BenchPromos não tem 0,3% de alcance, tem 3,1%. View acumula com o tempo,
`docs/concorrentes-lidos.md` avisava disso em texto ao lado do número, e
o número errado foi citado assim mesmo. A ressalva só parou de enganar
quando virou código.

### 04/08/2026: revisão, e o que ela consertou

Dia de conferir. **O registro completo, com o método de cada achado,
está em `docs/revisao-04-08.md`** — e ele abre com as quatro afirmações
minhas que não sobreviveram ao teste, de propósito.

**Um item de segurança continua ABERTO e é do dono:** o backup semanal
sobe um `pg_dump --schema=public` como artefato do Actions num
repositório público, e `credencial_rotativa` mora no `public`. Apagar os
dois artefatos e rotacionar as credenciais. Fechar o repositório não é
opção (1.063 min de Actions num dia contra 2.000/mês do plano privado).
O conserto estrutural está em `docs/plano-vault.md`.

**Consertado no publicador, tudo medido em produção:** publicação que
falhava voltava para sempre (fila presa 71 → 13), o rodapé culpava a
sessão da Central estando ela sadia, sessão do ML caída calava Amazon e
Shopee junto, a troca de prateleira pulava as comportas de confiança, e
nada era escapado antes de ir com `parse_mode: HTML`.

**A Open API da Shopee entrou** (D-061): link curto no ar, âncora
"Compre aqui" desfeita. **Ela não tem cupom** — isso fecha a pergunta
que voltava desde 01/08.

**O "de" passou a ser sempre do vendedor** (D-062). A nossa série virou
o lastro, que é onde ela vale: `⚡ Baixou 25% desde a leitura de ontem`.

**Diagnosticado e não consertado:** por que o canal de perfume masculino
quase não publica (D-063). Não é o filtro, é o catálogo — 81 produtos no
nicho e dois termos de busca em 109.

### 01/08/2026, à noite: de um canal para sete

O dono abriu seis grupos de Telegram — **Fitness, Tech, Geek, Kids,
Beauty e Perfumes (masc)** — e os seis estão no ar, com nicho, etiqueta
de afiliado e chat conferido. O que mudou por baixo:

| O quê | Onde |
|---|---|
| `canal_atributo`: o canal filtra por atributo do produto. "Perfume masculino" não é nicho, é o `GENDER` do ML | D-042, migration 37 |
| O canal é identificado pelo **`@nome` público**, não pelo id numérico — abrir o grupo ao público troca o id | D-044 |
| Etiqueta de afiliado por canal, conferida contra o gerador. `radarbeauty` não existe: o Beauty está com `radargeral`, e é pendência | D-045 |
| Nichos `geek` e `perfume`, e os 30 ramos de Esportes que não são fitness marcados como secundários | migration 37 |
| Ritmo a cinco minutos em pico e normal; madrugada em trinta | migration 39 |
| As duas linhas de lastro que repetiam o "de" e o "por" que já estavam no corpo | migrations 39 e 40 |
| **`fetch` do Node não tem timeout.** A descoberta ficou 40 min pendurada numa chamada. `AbortSignal.timeout` de 20s | `coleta-mercado-livre.mjs` |

**A recomendação técnica era abrir dois canais e crescer com dado; o
dono decidiu seis.** O risco e a medida que decide se estava certo estão
na D-043 — não é para rediscutir, é para medir na primeira semana.

### O que a sessão de 01/08/2026 mudou — leia isto primeiro

**O laço fechou: da queda detectada até a mensagem no canal, sem humano** (D-033). `scripts/publica-automatico.mjs` roda de hora em hora depois da coleta e da detecção. Quem aprova são as comportas, que são números em `parametro`. **A tela `/aprovar` continua existindo e não é mais o caminho** — virou conferência.

**O freio de mão foi solto na tarde de 01/08** (`publicacao_automatica = 1`), com autorização do dono. O que segura o volume são três coisas que passaram a existir no mesmo dia: o **teto diário do canal** (que a D-033 dizia valer e o código nunca conferia), o intervalo do ritmo, e a **intercalação por variedade** (que existia em `lib/variedade.ts` e só a tela manual usava).

**Quatro coisas mudaram na tarde de 01/08, e três delas eram regra escrita e não aplicada:**

| O quê | Onde |
|---|---|
| A reputação do vendedor é relida junto com o preço. `melhorOferta` troca de vendedor de hora em hora, e as comportas aprovavam com dado de outra pessoa | `relePrecos`, migration 32 |
| Teto diário e variedade entram no laço automático | `publica-automatico.mjs` |
| A descoberta desce por subcategoria **onde existe canal**. `highlights` satura na raiz | `coleta-mercado-livre.mjs` |
| Cupom colhido do texto dos canais e publicado como post próprio, com escopo por prefixo | D-039, migrations 33 a 35 |

**Leia a D-040 antes de mexer em `/publicar`.** O link da tela era montado à mão, e por cima disso o registro de envio falhava calado por causa de uma constraint `not valid` — que **não é constraint desligada**. Nove publicações foram ao canal duas ou três vezes.

**O WhatsApp entrou no laço automático em 06/08** (D-071). Ele passa pelas mesmas comportas, pelo mesmo ritmo e pelo mesmo teto de canal que o Telegram, e ganha um teto a mais, por chip.

**Depois da primeira madrugada automática, cinco frentes de conserto.** Saíram três posts e dois eram de outro nicho. O diagnóstico, a pesquisa e o que cada frente virou estão em **`docs/otimizacao.md`** — leia antes de mexer em coleta, colheita ou classificação. O resumo:

| O quê | Onde ficou |
|---|---|
| O nicho vem do `domain_id` do marketplace, não de quem achou o produto | tabela `nicho_dominio`, migration 24 |
| Segundo gatilho de oferta: o desconto que a **loja** declara | `detecta_declarados`, migration 23 |
| A colheita escava o histórico do canal com `?before=` | `telegram-web.ts`, migration 25 |
| A medida do critério da Fase 1 | views `ofertas_por_dia` e `motivo_de_rejeicao` |

**O link de afiliado é GERADO, nunca montado** (migration 29). Colar `?matt_word=X&matt_tool=Y` numa URL de produto **não paga comissão** — o gerador descarta o nosso parâmetro e cria um `ref=` cifrado, que é onde a atribuição mora. Sete publicações saíram assim antes disso ficar claro, e elas **ficam no banco** como evidência (a constraint é `not valid`).

Não existe API oficial de afiliados: 15 rotas varridas, todas 404. O caminho é `POST /affiliate-program/api/v2/affiliates/createLink`, com a sessão da Central guardada em `credencial_rotativa`. **Ela expira**, e quando expirar nada é publicado — que é o desfecho certo.

**A granularidade do subid ficou decidida, e era a pergunta da Fase 0:** o ML só atribui **por etiqueta**, e etiqueta tem que estar cadastrada (`error_code 109` para qualquer outra). Uma etiqueta por canal. Saber qual *post* vendeu volta com o redirecionador próprio, na Fase 2, e aí o subid vive do nosso lado.

**Três coisas que valem saber antes de tocar em qualquer uma delas:**

1. **`original_price` do ML é frequentemente inflado.** Ele é peneira de entrada, a mensagem **atribui a alegação à loja** (`lastro_declarado`), e desconto acima de 70% é recusado. Nunca o use como o "de" da mensagem por conta própria: é a regra 3.4.
2. **Domínio sem mapeamento dá nicho nulo, e nicho nulo não publica.** É deliberado. A fila de trabalho é a view `dominio_sem_mapeamento`, e o coletor lista os novos ao fim de cada rodada.
3. **Não adivinhe nome de domínio do ML.** `MLB-PET_TOYS` e `MLB-COOKWARE` não existem; são `MLB-DOG_TOY_BONES` e `MLB-KITCHEN_POTS`. Pergunte a `products/{id}`.

**O maior desperdício do sistema em 01/08 era não ter onde publicar:** só existia um canal, de pet. **Isso mudou na noite de 01/08**, com sete canais no ar. Numa rodada, 43 ofertas viraram 1 publicação e **24 foram reprovadas por `nenhum_canal_do_nicho`**. O radar acha oferta de casa, eletrônico e suplemento, e não há onde publicar.

**Fase 0 em andamento** (contas de afiliado e prova de subid: trabalho manual do dono), com a base da Fase 1 construída em paralelo. As duas não conflitam — o resultado da Fase 0 decide a granularidade do subid, que só aparece na Fase 2.

### O que a sessão de 31/07/2026 mudou

Dia longo, quatro frentes. Ordem de leitura para quem chega agora: esta lista, depois `docs/credenciais.md` (o que existe de conta e o que falta), depois `docs/refino-visual.md` (o estado da interface).

**1. O projeto passou a se ver.** `pnpm telas` fotografa as treze telas logadas em 2×, dentro de `.telas/` (fora do Git), e **falha se alguma soltar erro de execução no navegador**. Foi o que finalmente fechou o buraco de `pnpm verifica` não enxergar layout. Rode e **olhe as fotos** depois de mexer em interface.

**2. Refino visual, cinco frentes das seis planejadas** (`docs/refino-visual.md`). Duas elevações em repouso substituindo a regra antiga de "nada de sombra"; número de indicador em 32px com rótulo sobrescrito; a fila de `/aprovar` virou lista de decisão com série de preço na linha e o laranja aparecendo numa linha por vez; `Pagina` ganhou `mx-auto` e a coluna de contexto de 320px; chip de plataforma em tinta. Ficou de fora, de propósito: os atalhos de teclado da fila, e a F4 (micro-gráficos) por não haver pergunta esperando resposta.

**3. Seis agentes de QA usaram o painel como gente.** Trinta e poucos achados, quatro reais e corrigidos: horário de canal salvava vazio em silêncio, a tela prometia que o Telegram publica sozinho (não publica, é Fase 2), limiar de curadoria aceitava qualquer número, e o cancelar de publicação não dizia que é reversível. O resto foi rejeitado com motivo — vale ler o commit `1d015a1` antes de reabrir qualquer um deles.

**4. O sistema saiu da máquina local.** Projeto Supabase criado e migrations aplicadas, e o painel publicado. Ver "Bloqueado, e por quem" logo abaixo, que mudou bastante.

**5. A simulação saiu do painel, inteira.** Decisão do dono: *"agora estamos parando de brincar de mockup"*. Encerra a exceção da D-026. `lib/simulacao/loja.ts` foi apagado e as três telas — Canais, Aprovar e Publicar — leem o banco. A faixa `AvisoSimulacao` não existe mais, porque não há tela mentindo. **Nenhuma tela do painel mostra número inventado.** O que a travessia mudou está em `docs/tirar-a-simulacao.md`.

**6. A infraestrutura saiu do papel.** Segredos do GitHub subidos, Edge Functions publicadas na nuvem, variáveis da Vercel completadas em Preview e Development. As duas rotinas agendadas foram **disparadas à mão e passaram** — não estão só configuradas, estão comprovadas.

### O que a sessão de 03/08/2026 mudou

Dia de investigação, não de construção. Duas correções de código e quatro decisões que fecham perguntas que voltavam sempre.

**1. O canal tinha parado de publicar foto, e a culpa era nossa.** O prazo de 24 horas da imagem estava **cravado no código**, quando ele é da loja: `marketplace.cache_preco_max_horas` vale 24 na Amazon e é **nulo** no Mercado Livre e na Shopee. O banco sempre respeitou isso; o publicador não. Enquanto o catálogo era novo ninguém notou — quando 82% dos anúncios passaram de um dia, a foto sumiu de tudo. Corrigido no publicador e no painel.

**2. O canal ficava mudo por horas, e não era o ritmo (D-052).** O ritmo já é de 5 minutos e funciona: 24 posts numa rodada, 180 esperando quando a janela fechou. **O agendador do GitHub é que não dispara** — pediu de hora em hora e entregou às 03:45, 07:23 e 11:21. Agora são **três caminhos para a mesma tarefa**, e a trava do banco impede post duplicado: cron externo chamando a API (`docs/cron-externo.md`), o agendamento do GitHub, e a reserva de hora em hora dentro da coleta. Leia a D-052 antes de mexer nisso: a primeira tentativa piorou, porque cron novo pode simplesmente não ligar.

**3. WhatsApp automatizado: pesquisado a fundo, engavetado em 03/08 e ligado em 06/08 (D-053, depois D-071).** A regra 3.2 foi invertida a pedido do dono, que assumiu o custo dos chips e o risco de banimento. A pesquisa da D-053 continua valendo inteira e virou a lista de travas da 3.2: aquecimento, limiares de detecção, teto por número, e a descoberta que muda o medo — **quando cai, cai a conta do número, não o chip e não o grupo**.

**4. Onde o sistema vai morar (D-055 e D-059), com roteiro pronto em `docs/migracao-para-vps.md`.** A Vercel não pode hospedar o publicador, e não é questão de plano: função dela morre em minutos e o nosso publicador vive 50. Oracle Cloud (grátis, São Paulo) ou Hetzner (~R$27) são as saídas, e uma máquina fecharia três pendências de uma vez. **Espera de propósito** até saber se a D-052 resolveu sozinha.

**5. A Shopee saiu do papel inteira (D-057 e D-058).** Link de afiliado **não depende da Open API** — o `an_redir` é montável por URL, testado com a conta real. E a coleta também não: o painel de afiliado tem **Criativo → Feed de produto**, dois CSV diários com 110 mil itens, preço, desconto, nota e imagem. O catálogo dela saiu de 227 para mais de 4.100 no mesmo dia, e o primeiro post da loja foi ao ar. A Open API foi **aprovada em 03/08** e só melhora o que já funciona.

**6. Três defeitos que só apareceram publicando.** A foto sumiu de todo post porque o prazo de 24h da imagem estava cravado no código, quando ele é da Amazon e nulo nas outras lojas. O canal ficava mudo por horas porque o agendamento do GitHub entrega cerca de uma execução a cada oito — agora quem dispara é o `pg_cron`, de 5 em 5 minutos. E **toda oferta da Shopee era reprovada** porque o coletor não gravava `reputacao_vendedor`; a comporta estava certa, faltava o dado.

**7. O ritmo ganhou folga sorteada e o teto subiu.** Posts saem a cada 3, 4 ou 5 minutos em vez de 5 cravado, porque horário exato é carimbo de robô. E o teto diário foi de 50 para 150, decisão do dono depois de ver dois canais baterem o limite com oferta boa sobrando.

**8. O gargalo agora é audiência, não sistema (D-056).** Os sete canais publicam sozinhos. Telegram Ads foi avaliado e **não é por onde começar** — divulgação cruzada é grátis e um post pago em canal do nicho custa uns R$200 e dá o número que falta: o custo real por inscrito.

### Contas e credenciais — onde estamos

Detalhe, passo a passo e armadilhas de cada uma em `docs/credenciais.md`.

| O quê | Estado em 31/07 | Falta |
|---|---|---|
| **Supabase nuvem** | ✅ `radar-ofertas`, São Paulo, ref `fcdkczueohekmgaaacdr`, 57 migrations aplicadas | nada |
| **Mercado Livre — afiliado** | ✅ aprovado, `fega6031503`. **Etiquetas resolvidas em 01/08** | falta gerar um link com cada etiqueta, para extrair o número de rastreamento |
| **Amazon — associado** | ✅ ativo, `radar4yu-20`, fiscal enviado | **prazo: 3 vendas até 27/01/2027** ou a conta é revogada |
| **Shopee — afiliado** | ✅ aprovado em 03/08, ID `18378371108`, dados bancários e fiscais enviados | nada |
| **Shopee — coleta** | ✅ **pelo feed de produto**, dois CSV diários, 110 mil itens (D-058) | mapear as categorias que sobraram: Watches, Travel & Luggage, Gaming & Consoles |
| **Shopee — Open API** | ✅ **aprovada em 03/08**, no mesmo dia do chamado | a credencial aparece na página *Abrir API* em até 5 dias. Conferir e colar `SHOPEE_APP_ID` e `SHOPEE_APP_SECRET` no `.env` |
| **Shopee — link de afiliado** | ✅ **não depende da API**, testado em 03/08 | só implementar o gerador. Formato e teste na D-057 |
| **Mercado Livre — API de itens** | ✅ **no ar**, aplicação `Radar de Ofertas 4YU`, Client ID `7618355784652588` | nada. `ML_CLIENT_ID` e `ML_CLIENT_SECRET` existem no `.env` e nos secrets do GitHub; o refresh token vive em `credencial_rotativa` e **não** em variável de ambiente, porque ele é trocado a cada renovação |
| **Canais** | ✅ **sete** no Telegram: Pet, Tech, Geek, Kids, Beauty, Perfumes (masc) e Fitness | audiência |

**Duas correções que a prática impôs à pesquisa**, e que valem para quem for planejar prazo:

- As esperas da Shopee são **em série**, não em paralelo: cadastro, depois API. A pesquisa técnica dizia que a credencial saía do painel sem porteiro — não sai.
- A compra de teste da Fase 0 **não pode ser feita pelo dono**. Autocompra é violação de termo nos três programas, e o risco é encerramento de conta. Tem que ser outra pessoa, na conta dela. O roadmap já foi corrigido.

**Marca:** o dono adotou `radar4yu` como identificador na Amazon, ligando o produto (Radar) à empresa (4YU). Se isso virar marca guarda-chuva, encosta no domínio do redirecionador da Fase 2 — os dois precisam combinar.

**Fiscal, e não é detalhe:** as contas estão no **CPF**, porque não há CNPJ. A D-011 já registrava divergência sobre afiliado digital caber no MEI. **Precisa de contador antes da Fase 3**, que é quando o sistema repassa dinheiro a terceiro.

### Como este projeto trabalha hoje

**Interface primeiro, backend plugado depois (D-026, decisão do dono em 28/07 — exceção encerrada em 31/07).** As telas de decisão foram construídas sobre uma operação simulada, foram revisadas nesse estado, e o backend entrou depois. **Isso terminou:** a simulação não existe mais e todas as telas leem o banco.

A parte que continua valendo, e que fez a troca caber numa sessão: **a tela nunca fala com a fonte do dado.** Ela chama uma ação em `app/acoes/`, e a assinatura da ação não muda quando a fonte muda. `aprovaOferta(form)` era `aprovaOferta(form)` com a simulação e continua sendo com o banco — o que mudou foi só o corpo. Mantenha isso.

**Antes de construir tela nova, revise as que existem.** A revisão de 28/07 achou seis defeitos, e cinco eram de **costura entre telas** — aprovar mexe na capacidade que Canais mostra, publicar consome o teto que Aprovar usa para avisar, preço mudado devolve para quem decide. Tela revisada sozinha parece correta. Está em `docs/decisoes.md`, em "Revisão · O que a passada pelas telas achou".

### Pronto e verificado

**Banco** — 57 migrations em `supabase/migrations/`, **todas aplicadas no local** (as 12 primeiras reescritas do zero em 27/07, exceção deliberada, com o banco vazio). `operacao_id` em toda tabela, papel como lista, nicho como entidade, limiar herdando por nicho, contador de reprovação por comporta e registro de execução das rotinas.

**Motor de curadoria** — `avalia_anuncios` é *a regra*, numa implementação só. 13 cenários verificados. 3.000 anúncios com 600 mil pontos em 1,4 s. Nenhuma tela recalcula regra.

**Coletor diário** — `supabase/functions/coleta-diaria`, fontes plugáveis por marketplace. Roda hoje; sem credencial, pula a loja e informa.

**Colheita** — `supabase/functions/colheita-canais`. Rodada contra três canais reais: 60 posts, 35 links, 6 anúncios novos, 29 descartes.

**Quinze telas.** As de painel ficam no grupo `app/(painel)/`, que é o que dá ao Login uma tela sem barra lateral:

**Todas leem o banco desde 31/07.** Não há mais tela simulada, e a coluna "dado" saiu daqui porque a resposta virou a mesma para todas.

| Área | Telas |
|---|---|
| Hoje | `/aprovar` (+ painel `?oferta=`), `/publicar`, `/atencao`, `/arranque` |
| Catálogo | `/produtos` (grão produto e anúncio, busca), `/produtos/[id]`, `/produtos/sem-nicho`, `/colheita/fontes`, `/colheita/mencoes` |
| Distribuição | `/canais`, `/canais/[id]` |
| Ajustes | `/ajustes/curadoria`, `/ajustes/nichos`, `/ajustes/marketplaces`, `/ajustes/modelos` |
| Entrada | `/entrar` — fora da casca, sem barra lateral |

A raiz `/` leva para `/aprovar`: a casa do dono é o trabalho, não a consulta.

**Casca e design** — barra lateral, barra superior e cabeçalho de página seguem o protótipo (`referencia-claude-deisgn/Radar de Ofertas.dc.html`, no repositório). Manrope e JetBrains Mono, tokens em `app/globals.css`. O porquê de cada escolha está em `docs/design.md`.

**Sistema visual, refeito em 28/07 depois da comparação com o protótipo.** O painel estava correto e feio, e o defeito não era de token: era o que não tinha virado componente. Cinco peças, e **nenhuma tela escreve nada disso à mão**:

| Componente | Substitui |
|---|---|
| `Identidade` | a caixa cinza escrita "foto". Inicial sobre cor derivada do nome, estável por item |
| `Chip` (+ `EtiquetaDeLoja`) | quatro sistemas de etiqueta paralelos. Três papéis, no máximo um de cada por linha |
| `Cartao` | a mesma borda copiada à mão em cinco telas |
| `Pagina` | cinco larguras diferentes. A tela declara uma medida; cabeçalho, KPIs e conteúdo ficam dentro dela |
| `Botao` | laranja/vermelho/verde cheios competindo |
| `Modal` | formulário de criar solto no pé da página, e acordeão dentro do cartão |
| `Campo` | quatro estilos de campo diferentes, um deles com a paleta crua do Tailwind |

E uma regra mudou: **monoespaçado é para texto literal** (subid, slug, SKU, comando), nunca para dinheiro — alinhar coluna é trabalho do `tabular-nums`. Detalhe e motivo de cada uma em `docs/design.md`, em "A passada visual de 28/07".

**Login** — `/entrar`, e-mail e senha (D-022), sessão em cookie, `middleware.ts` barrando rota nova por padrão, papel decidindo a casa (dono → `/aprovar`, operador → `/publicar`). O banco já tinha tudo: `usuario`, `operacao_atual()`, `tem_papel()` e as policies existem desde 27/07.

**Atenção, e está na D-027:** as telas continuam lendo pela `service_role`, que ignora RLS. Quem protege hoje é o middleware, não as policies. Trocar as leituras pela chave da pessoa é o passo seguinte, e **o gatilho é o primeiro operador de verdade receber acesso** — não uma data.

Conta nasce por script enquanto a tela de convite (Fase 3) não existe:

```
pnpm usuario:cria "voce@exemplo.com" "Seu Nome" dono
```

**Auditoria de tela** — agora existe `pnpm telas`: ele entra com a conta local, fotografa as treze telas em 2× dentro de `.telas/` (fora do Git) e **falha se alguma soltar erro de execução no navegador**. Rode depois de mexer em interface e **olhe as fotos** — foi assim que o refino visual de 31/07 achou a busca duplicada em `/produtos` e o buraco na barra lateral. Ele não substitui clicar: estado que só aparece ao digitar continua precisando de gente.

`pnpm verifica` não vê layout. Dois defeitos desta rodada passaram por tipo, lint e teste e só apareceram abrindo o navegador: 97 botões sem `cursor: pointer`, e uma constante exportada de arquivo `"use server"`, que quebra em execução. **Antes de dizer que uma tela está pronta, abra e clique.**

**Pesquisa de 28/07, e o que ela mudou.** Duas pesquisas, em `docs/pesquisa-tecnica.md` e `docs/pesquisa-operacao.md`. Quatro decisões saíram validadas (regra das 24h, D-015, D-016, D-010) e cinco coisas viraram trabalho:

| O quê | Onde ficou |
|---|---|
| Link de afiliado é publicidade e precisa ser identificado | **regra 3.10**, validada no servidor, com teste |
| Imagem tem regra mais dura que preço, e não estava aplicada | migration 15, D-029 |
| PWA não pode cachear tela com preço | D-030 |
| Falta de variedade mata o grupo, e ordenar por nota piorava | `lib/variedade.ts`, com teste |
| Os horários que sugeríamos estavam fora dos picos | `lib/horarios.ts`, com teste |

**Fechado em 31/07:** o Canal do WhatsApp virou a **D-031** — terceira superfície, entra como terceiro valor de `canal.plataforma` e nunca como booleano ao lado, e é decisão de Fase 2 porque muda o fluxo de publicação junto (o `wa.me` não alcança Canal). A distinção **30 aprovadas ≠ 30 publicações por canal** e a referência de receita (90 dias → R$ 800/mês; 12 meses → R$ 5–15 mil/mês) já estão no `docs/roadmap.md`, nas Fases 1 e 2.

**Testes** — `pnpm testa` cobre leitor de link (14), identificador de canal (15), as regras da mensagem (35), a intercalação por variedade (14) e os horários de pico (30). Sem banco, sem rede. `pnpm verifica` roda tipos, lint e testes.

Os 27 casos da máquina de estados da simulação saíram em 31/07 junto com ela, e **não foram substituídos por testes equivalentes de propósito**: eles verificavam um módulo em memória. O que os substitui são as constraints da migration 16, conferidas uma a uma contra o banco da nuvem — subid de 8 caracteres sem `0/O/1/I/l`, subid diferente por canal, a mesma oferta não indo duas vezes ao mesmo canal, `enviada` sem data recusada, estado fora da lista recusado, rejeição sem motivo recusada. Regra que vive em constraint não regride.

**Automação** — CI a cada push, rotina diária e backup semanal em `.github/workflows/`, **com os segredos no lugar e as três comprovadas rodando**. Push na `main` também publica na Vercel, que está ligada ao repositório: commit em `main` vai ao ar sozinho.

### Próxima tarefa

Faltam da especificação, em ordem de utilidade:

1. **Dinheiro** (Conversões, Repasses, Parceiros, painel do parceiro) — Fase 2 e 3. **Não construa antes de existir comissão**: são telas de dado que não existe nem simulado.

Depois disso, um bloco que não é tela:

- **Dependências de temporizador de terceiro** — estão anotadas em `docs/infra.md`, para serem resolvidas juntas quando as telas terminarem. Agendador do GitHub, pausa do Supabase, token do Mercado Livre, sessão do Telegram, credencial da Shopee: todas o mesmo problema, algo fora do nosso controle expira e o sistema para em silêncio.

### Pendências desta sessão — leia antes de tocar em qualquer coisa

**São 57 migrations, todas aplicadas na nuvem** (conferido pelo ledger em 04/08). As de 01/08 foram conferidas contra o banco com dado real. As quatro da tarde (32 a 35) entraram por `supabase db push` pelo **session pooler**, pelo session pooler, porque na época o Docker não subia nesta máquina (**voltou a subir em 04/08**) e o push remoto não precisa dele:

```
npx supabase db push --db-url "postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

O aviso de Docker que aparece no fim é só o cache local do catálogo, não a aplicação.

Antes disso, e o histórico continua valendo: A 16 (`publicacao`) está aplicada no local e na nuvem, e as constraints dela foram conferidas contra a nuvem uma a uma, com dado de verdade criado e apagado depois. Conferido no banco, não só no log: o modelo `Padrão` começa com `#publi · {loja}` na primeira linha, `anuncio.imagem_url` e `imagem_obtida_em` existem, e `expurga_imagens_expiradas` roda.

**Nunca use `pnpm db:reset` para aplicar migration.** Ele não aplica — apaga e recria o banco inteiro. Foi assim que os dados colhidos se perderam em 28/07: 6 produtos, 6 anúncios, 3 fontes e 35 menções. O que aplica é:

```
pnpm db:sobe
npx supabase migration up --local
```

**`pnpm db:tipos` era uma armadilha e foi desarmado em 31/07.** `lib/supabase/tipos.ts` é **escrito à mão**, com comentário em cada campo explicando o porquê, e traz apelidos (`Banco`, `*Linha`) que a aplicação inteira importa. O script sobrescrevia esse arquivo com a saída crua do gerador — ~25 erros de tipo em cadeia, e a explicação de cada campo perdida. Agora ele escreve em `lib/supabase/tipos-gerados.ts`, que é referência descartável e está no `.gitignore`. **Coluna nova continua entrando no arquivo à mão**, até o projeto Supabase da nuvem existir.

**O navegador voltou a funcionar aqui.** A versão anterior deste arquivo dizia que não havia Chromium no WSL. Há: `npx playwright install chromium` baixa e roda (o `install-deps` pede sudo e falha, mas não faz falta). O `pnpm telas` deixou de estar bloqueado.

O que **está** verificado, com navegador de verdade e sessão real, contra o painel publicado:

- as 13 telas logadas respondem 200 e **nenhuma solta erro de execução no navegador**
- Aprovar e Publicar mostram os estados vazios corretos, sem faixa de simulação
- o caminho de aprovar → `publicacao` com subid, contra o banco da nuvem: 12 conferências, todas passaram

O que **não** está verificado, e é exatamente onde os defeitos das rodadas anteriores moraram: os avisos que só aparecem em condição ruim, que se produz digitando. E há agora um segundo buraco, maior: **o catálogo da nuvem está vazio**, então as telas foram vistas só nos estados vazios. O título de 180 caracteres que a D-026 avisou que apertaria algum layout ainda não passou por lá. Precisa de olho humano, uns dois minutos:

| Onde | Como fazer aparecer | O que tem de acontecer |
|---|---|---|
| `/ajustes/modelos` | apague o `#publi · {loja}` da primeira linha | faixa vermelha, e o salvar bloqueado |
| `/ajustes/modelos` | mova o `#publi` para a última linha | o outro texto: "a identificação está escondida" |
| formulário de canal (`/canais`) | troque um horário para `18:00` | aviso de fora de pico, citando 07–09, 12–13, 19–22 |
| `/publicar` | fila com dois itens seguidos do mesmo nicho | aviso de variedade no cabeçalho do canal |

E o de sempre: **97 botões sem `cursor: pointer`** foi achado assim. `pnpm verifica` não vê layout.

**Ambiente de conferência mudou em 31/07.** O Docker não sobe nesta máquina (pede sudo), então o banco local está fora do ar — mas **existe Chromium agora**: `npx playwright install chromium` funciona no WSL, e o `pnpm telas` roda. A conferência desta sessão foi feita contra o **painel publicado**, com a conta da nuvem, apontando `PAINEL_URL` para `https://radar-ofertas.vercel.app`. As treze telas responderam 200 sem erro de execução no navegador.

**Conta local de teste:** `gabriel@local.test`, papel `dono`. A senha foi redefinida em 31/07 e está fora do Git — se precisar, redefina de novo pelo Studio (`http://127.0.0.1:54323`) ou crie a sua com `pnpm usuario:cria`.

**Os dois catálogos estão vazios** — o local desde o `db:reset` de 28/07, e o da nuvem porque nunca teve dado. O catálogo se refaz rodando a colheita, e é o que destrava ver as telas cheias.

### Para testar depois — anotado em 01/08/2026

**1. `matt_word` numa URL normal, sem o gerador — JÁ IMPLEMENTADO, falta provar.**
`lib/afiliado.ts` monta o link nesse formato e a fila de publicação já o
usa. **Faça a compra de teste por um link saído dele**, não por um feito
à mão: assim a prova valida o código de produção. Colar
`?matt_word=radarpet&matt_tool=66367903` numa URL comum de produto do ML.
Se o Mercado Livre honrar, o sistema publica **100% sozinho**; se não,
cada lote de links passa pelo gerador do painel. É a diferença entre
automático e semiautomático, e **não há como verificar sem venda real** —
faça junto com a compra de teste da Fase 0.

**2. Geração em lote pelo painel**, que é o plano B do item 1. O gerador
aceita várias URLs de uma vez por etiqueta: o sistema monta a lista de
aprovados, alguém cola, e devolve os links. Funciona hoje, com um passo
manual por lote. Vale medir quanto tempo custa de verdade antes de
descartar.

**0. De onde os concorrentes tiram cupom.** Eles publicam cupom com
formato exato e repetido (`FULL3107`, `TODOSITE31072`, sempre com
percentual, mínimo e teto), o que sugere fonte estruturada e não
garimpo manual. **A API do Mercado Livre não é essa fonte:** varridos
9 endpoints plausíveis em 01/08 (`marketplace/coupons`,
`users/me/coupons`, `loyalty/coupons`, `sites/MLB/promotions`,
`affiliates/coupons` e outros), **todos 404**. Não é permissão, é
ausência.

O que ainda não foi olhado, e é onde eu procuraria: **a aba "Cupons" do
próprio site do ML** (existe no menu, ao lado de Ofertas) e a **página
de cupons da Central de Afiliados**. Se a lista vier de página pública,
lê-se como a colheita de canais lê `t.me/s/`. E a **Shopee Open API
documenta endpoint de cupom de afiliado**, o que resolveria o lado
dela quando o cadastro aprovar.

**Atalho que já funciona hoje, e é o mais barato:** os cupons aparecem
nos canais que a colheita já lê. Extrair código de cupom do texto
colhido é trabalho de regex, não de credencial.

**3. Configurar o bot do Telegram.** Criar no `@BotFather`, adicionar
como administrador do canal, e o sistema publica por `sendMessage`. A
regra 3.2 autoriza — as duas plataformas postam sozinhas desde 06/08. Meia
hora de trabalho, e **deixou de depender do redirecionador** desde que a
etiqueta provou carregar a atribuição. O que decide se ele publica
sozinho ou com um passo manual é o teste 1.

### Bloqueado, e por quem

- **Audiência** — é o gargalo de verdade desde 03/08. Os sete canais publicam sozinhos e quase ninguém lê. Isto não se resolve com código: o caminho decidido na D-056 é divulgação cruzada com canais de pet e oferta, mais **um** post pago (~R$200) para medir o custo real por inscrito. Sem esse número, qualquer decisão sobre anúncio é aposta.

- **Coleta de preço real** — falta credencial de marketplace, e o caminho mais curto **mudou em 31/07**. A Shopee continua sendo a melhor chave (resolve dado e link de uma vez) e **andou em 03/08**: conta aprovada, ID `18378371108`, e o chamado da Open API aberto. **Mas o prazo dela virou uma incógnita**, e a estimativa antiga de "até duas semanas" foi retirada de propósito — não há fonte confiável para prazo nenhum. Não conte com ela para planejar. **O Mercado Livre deixou de ser bloqueio: ele está no ar.** A aplicação existe, a autorização foi feita, e o refresh token vive em `credencial_rotativa`, rotacionado a cada renovação. A coleta roda de hora em hora e o catálogo passou de 3.300 anúncios. **Não procure `ML_REFRESH_TOKEN` no `.env`** — ele não está lá de propósito.
- ~~**Renovação do token do ML rasga o token guardado**~~ — **resolvido, e o registro anterior estava errado.** O Mercado Livre troca o refresh token a cada renovação, e o coletor **grava o token novo** em `credencial_rotativa` (`scripts/coleta-mercado-livre.mjs`, `guardaRefresh`). Foi por isso que o `.env` e os secrets **não têm** `ML_REFRESH_TOKEN`: variável de ambiente envelheceria na primeira renovação. O aviso de defeito olhava só o adaptador da Edge Function e não viu o caminho que roda de verdade.
- ~~**Segredos gerados**~~ — **resolvido em 31/07.** `COLETA_SEGREDO` e `SAL_HASH_IP` existem, os dois com 64 caracteres hex, no `.env` e nas três faixas da Vercel. O sal parecia ser o texto de exemplo porque o `.env` tinha **quatro arquivos colados num só** e a cópia antiga, mais abaixo, redefinia a variável — e no `dotenv` a última definição vence. O `.env` foi separado em `.env`, `.env.producao` e `.env.local`. O sal **nunca mais muda**: nenhum clique foi gravado ainda, e essa era a última janela para acertá-lo.
- ~~**Projeto Supabase na nuvem**~~ — **resolvido em 31/07/2026.** Projeto `radar-ofertas`, organização 4YU Systems, região São Paulo (`sa-east-1`), ref `fcdkczueohekmgaaacdr`. As 15 migrations foram aplicadas e conferidas contra o banco, tabela por tabela. As chaves vivem em `.env.producao`, fora do Git. **A exceção da reescrita de migration fechou junto** — vale a regra da seção 6.

  O `.env` continua apontando para o banco **local**, que é onde o desenvolvimento acontece; a nuvem tem o schema e nenhum dado. Trocar o painel para ler a nuvem é decisão separada, e o gatilho é existir dado real lá.
- ~~**Segredos no GitHub**~~ — **resolvido em 31/07.** Os quatro estão lá (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COLETA_SEGREDO`, `SUPABASE_DB_URL`), e as duas rotinas foram disparadas à mão para provar: a diária respondeu com o resumo zerado (banco vazio, e isso é a resposta certa) e o backup gerou artefato de 140 KB. O `SUPABASE_DB_URL` usa o **session pooler** na porta 5432, e não a conexão direta: o runner do GitHub é IPv4, e a conexão direta do plano gratuito não é.
- **Redirecionador e subid** — dependem de domínio registrado. Se `radar4yu` virar a marca, o domínio deve combinar.
- **Prova do subid (Fase 0)** — **já dá para começar**, sem esperar a Shopee: Mercado Livre e Amazon geram link com subid hoje. Falta gerar os links de teste e **pedir a outra pessoa que compre** (autocompra é violação de termo).
- **Colheita por conta de usuário do Telegram** — o dono tem número dedicado; falta gerar a string de sessão. Ela nunca entra no Git nem em mensagem.
- **Links `shp.ee`** — o encurtador da Shopee devolve 404 para requisição de servidor, com ou sem User-Agent de navegador. Canal que só publica `shp.ee` rende zero, e a tela de menções mostra isso. Resolve junto com a credencial da Open API. **Não invente contorno** — simular navegador é raspagem com outro nome.

### Leia antes de opinar

| Arquivo | Quando |
|---|---|
| `docs/plano.md` | Antes de escolher o que construir. Tem a ordem, o porquê, e o limite da exceção da D-026 |
| `docs/decisoes.md` | Antes de propor qualquer mudança. D-001 a D-031, mais a revisão das telas e as pendências |
| `docs/telas.md` | Especificação funcional de cada tela |
| `docs/design.md` | Tokens, a casca, o sistema de botões e onde está o protótipo |
| `docs/dados.md` | Schema, comportas e o modelo de segurança |
| `docs/mercado.md` | Antes de falar de concorrência ou distribuição |
| `docs/infra.md` | O que roda onde, quanto custa, e as dependências que expiram |
| `docs/credenciais.md` | O trabalho que só o dono faz: contas de afiliado, compra de teste, Supabase na nuvem, chaves de marketplace e Telegram |
| `docs/tirar-a-simulacao.md` | Registro da travessia, concluída em 31/07. Três coisas mudaram de comportamento contra o banco — vale ler antes de mexer em Aprovar ou Publicar |
| `docs/refino-visual.md` | Antes de mexer em interface. O diagnóstico visual e as frentes, com o que ficou de fora |
| `docs/pesquisa-tecnica.md` | Antes de mexer em stack ou política de plataforma. O que está validado e o que está errado |
| `docs/pesquisa-operacao.md` | Antes de mexer em cadência, horário, formato de mensagem ou canal. Como se toca um grupo de verdade |
| `docs/pesquisa/` | Pesquisa de campo de 01/08, 521 fontes, oito frentes. Comece por `sintese.md`. `cupons-de-onde-vem.md` responde de onde sai `FULL3107`, e `o-que-muda-no-radar.md` diz o que ela cobra do projeto |
| `docs/plano-automacao.md` | O plano de dez frentes que saiu da pesquisa, com o banco medido em vez de suposto. Diz o que foi executado, o que ficou de fora e por quê |
| `docs/otimizacao.md` | Antes de mexer em coleta, colheita ou classificação de nicho. O diagnóstico da primeira madrugada automática, o que a pesquisa achou e o que cada frente virou |
| `docs/handoff.md` | **O que falta e como trabalhar aqui.** Traz as armadilhas que pegaram a sessao de 04/08 e o roteiro dos tres blocos abertos: seguranca, Shopee hibrida e canais |
| `docs/onde-paramos.md` | **Primeiro de todos.** Estado de 01/08, o que está quebrado, o que está em aberto e os erros já cometidos |
| `docs/revisao-04-08.md` | Revisão de 04/08: um achado de segurança, oito de código e a lista do que a documentação diz e não é mais verdade. Cada item traz **como foi conferido** — produção, local, leitura ou em aberto |
| `referencia-claude-deisgn/` | O protótipo, com as quatorze telas desenhadas. Abra antes de mexer em interface |

### Como rodar

```
pnpm db:sobe     # banco local em Docker
pnpm dev         # painel em http://localhost:3000
pnpm verifica    # tipos, lint e testes — rode antes de commitar
```

**Commite ao fim de cada bloco de trabalho**, com mensagem em português explicando o porquê, não o quê.
