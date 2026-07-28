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
- **Hospedagem do painel:** Cloudflare Workers, com o adaptador OpenNext (`@opennextjs/cloudflare`). **Não Cloudflare Pages** — a integração nativa não roda Next.js em modo servidor e o `next-on-pages` foi descontinuado (D-016). **Não Vercel Hobby** — o plano gratuito da Vercel não permite uso comercial, e este projeto gera receita.
- **Agendamento:** GitHub Actions, não `pg_cron` (D-015). Mantém o projeto gratuito do Supabase acordado e falha de forma visível.
- **Redirecionador de links:** Supabase Edge Function, domínio próprio.
- **Telegram:** Bot API oficial.
- **WhatsApp:** link de compartilhamento oficial (`wa.me`), envio manual por humano.
- **IA para mensagens:** fora do escopo inicial. Template resolve a maioria dos casos.

Se você acha que outra tecnologia é melhor, escreva a sugestão em `docs/decisoes.md` como proposta e **pergunte antes de trocar**. Não troque por conta própria.

---

## 3. Regras duras — violar qualquer uma destrói o projeto

**3.1 Nenhum segredo entra no Git.** Chaves do Supabase, tokens de bot e IDs de afiliado ficam em variáveis de ambiente. `.env` está no `.gitignore` e continua lá. Se precisar de uma variável nova, adicione ao `.env.example` com valor falso, nunca o real. Antes de qualquer commit, confira que nenhum segredo entrou.

**3.2 Nunca automatize o envio no WhatsApp.** Nada de biblioteca não oficial, leitura de QR Code ou simulação de WhatsApp Web. Isso viola os termos e derruba o número, que é o ativo do parceiro. O WhatsApp é sempre: gerar o texto, abrir `wa.me` com a mensagem pronta, humano aperta enviar. **Telegram sim, pode postar sozinho** pela API oficial.

**3.3 Preço da Amazon não vira histórico.** A política de associados da Amazon permite guardar preço em cache por no máximo 24 horas. Portanto: não construa série histórica de preço da Amazon, não exiba comparação histórica de Amazon, e descarte pontos de preço da Amazon com mais de 24 horas. Histórico de preço é construído em cima de **Mercado Livre e Shopee**. A Amazon entra como fonte de oferta pontual.

**3.4 Nunca afirme "menor preço histórico" sem lastro.** Enquanto a série de preços de um anúncio tiver menos de 14 dias, a mensagem não pode falar em desconto histórico. Use a redação honesta: *"menor preço que observamos desde DD/MM"*. Mentir sobre preço queima o grupo e é o erro que mata os concorrentes.

**3.5 Dinheiro é inteiro, em centavos.** Todo valor monetário no banco e no código é `INTEGER` representando centavos. Nunca `float`, nunca `REAL`. Formatação para reais só na camada de exibição.

**3.6 O subid é sagrado.** Toda publicação gera um subid único, curto e alfanumérico, gravado e indexado. Sem ele não existe divisão de receita. Nunca reaproveite subid entre publicações.

**3.7 Repasse só sobre dinheiro recebido.** O cálculo de repasse ao parceiro considera apenas comissões no estado `recebida`. Nunca calcule repasse sobre comissão estimada ou apenas registrada.

**3.8 LGPD: não guarde dado pessoal de membro.** Não existe cadastro de membros de grupo. Em cliques, grave **hash** do IP, nunca o IP em texto. Sem nome, telefone ou e-mail de quem clica.

**3.9 Datas em UTC, exibição em America/Sao_Paulo.** Todo `timestamptz` gravado em UTC. Conversão só na exibição. Horários de publicação configurados por canal são no fuso de São Paulo.

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
- Migrations versionadas em `supabase/migrations/`, nome com data e descrição. **Nunca altere migration já aplicada — crie outra.** A reescrita de 27/07/2026 foi exceção deliberada e aprovada, com o banco vazio e nada publicado; essa porta fecha quando o projeto Supabase da nuvem existir.
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

Atualizado em 28/07/2026. **Mantenha esta seção viva** — ela é o que uma sessão nova lê para saber onde parou. Atualize ao fim de cada bloco de trabalho.

**Fase 0 em andamento** (contas de afiliado e prova de subid: trabalho manual do dono), com a base da Fase 1 construída em paralelo. As duas não conflitam — o resultado da Fase 0 decide a granularidade do subid, que só aparece na Fase 2.

### Como este projeto trabalha hoje

**Interface primeiro, backend plugado depois (D-026, decisão do dono em 28/07).** O que falta para as telas de decisão terem dado real não é código: é credencial de marketplace, domínio e canal com audiência — nada disso sob controle de quem escreve o sistema. Então as telas são construídas sobre uma **operação simulada** em `lib/simulacao/loja.ts`, vão à mão de testadores nesse estado, e o backend entra ação por ação depois. Leia a D-026 antes de propor voltar à ordem antiga.

A tela nunca fala com a simulação: ela chama uma ação em `app/acoes/`, que hoje mexe na memória e amanhã escreve no banco. A assinatura não muda.

**Antes de construir tela nova, revise as que existem.** A revisão de 28/07 achou seis defeitos, e cinco eram de **costura entre telas** — aprovar mexe na capacidade que Canais mostra, publicar consome o teto que Aprovar usa para avisar, preço mudado devolve para quem decide. Tela revisada sozinha parece correta. Está em `docs/decisoes.md`, em "Revisão · O que a passada pelas telas achou".

### Pronto e verificado

**Banco** — 12 migrations em `supabase/migrations/`, reescritas do zero em 27/07 (exceção deliberada, com o banco vazio). `operacao_id` em toda tabela, papel como lista, nicho como entidade, limiar herdando por nicho, contador de reprovação por comporta e registro de execução das rotinas.

**Motor de curadoria** — `avalia_anuncios` é *a regra*, numa implementação só. 13 cenários verificados. 3.000 anúncios com 600 mil pontos em 1,4 s. Nenhuma tela recalcula regra.

**Coletor diário** — `supabase/functions/coleta-diaria`, fontes plugáveis por marketplace. Roda hoje; sem credencial, pula a loja e informa.

**Colheita** — `supabase/functions/colheita-canais`. Rodada contra três canais reais: 60 posts, 35 links, 6 anúncios novos, 29 descartes.

**Onze telas**, em `app/`:

| Área | Telas | Dado |
|---|---|---|
| Hoje | `/aprovar` (+ painel `?oferta=`), `/publicar`, `/atencao`, `/arranque` | simulado; atenção e arranque leem o banco também |
| Catálogo | `/produtos` (grão produto e anúncio, busca), `/produtos/[id]`, `/colheita/fontes`, `/colheita/mencoes` | **real** |
| Distribuição | `/canais`, `/canais/[id]` | simulado |
| Ajustes | `/ajustes/curadoria`, `/ajustes/nichos`, `/ajustes/marketplaces` | **real** |

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

**Testes** — `pnpm testa` cobre leitor de link (14), identificador de canal (15) e a máquina de estados da simulação (27). Sem banco, sem rede. `pnpm verifica` roda tipos, lint e testes.

**Automação** — CI a cada push, rotina diária e backup semanal em `.github/workflows/`.

### Próxima tarefa

Faltam da especificação, em ordem de utilidade:

1. **Modelos de mensagem** — com a prévia mostrando as duas redações lado a lado, a completa e a honesta reduzida, para a diferença ser escolhida e não descoberta em produção. É a última peça antes de a mensagem publicada deixar de ser texto fixo no código.
2. **Login** — a porta. É Fase 1 e continua sem existir; sem ela nada pode ir para a internet.
3. **Dinheiro** (Conversões, Repasses, Parceiros, painel do parceiro) — Fase 2 e 3. **Não construa antes de existir comissão**: são telas de dado que não existe nem simulado.

Depois disso, dois blocos que não são tela:

- **Plugar o backend** nas telas de decisão, uma ação por vez.
- **Dependências de temporizador de terceiro** — estão anotadas em `docs/infra.md`, para serem resolvidas juntas quando as telas terminarem. Agendador do GitHub, pausa do Supabase, token do Mercado Livre, sessão do Telegram, credencial da Shopee: todas o mesmo problema, algo fora do nosso controle expira e o sistema para em silêncio.

### Bloqueado, e por quem

- **Coleta de preço real** — falta credencial de marketplace. O dono resolve. A Shopee é a aposta melhor: a Open API de afiliado resolve dado e link na mesma chave.
- **Projeto Supabase na nuvem** — o dono cria; depois é `pnpm db:publica`. **Quando isso acontecer, a exceção da reescrita de migration fecha** e volta a valer a regra da seção 6.
- **Segredos no GitHub** — dependem da nuvem existir.
- **Redirecionador e subid** — dependem de domínio registrado.
- **Colheita por conta de usuário do Telegram** — o dono tem número dedicado; falta gerar a string de sessão. Ela nunca entra no Git nem em mensagem.
- **Links `shp.ee`** — o encurtador da Shopee devolve 404 para requisição de servidor, com ou sem User-Agent de navegador. Canal que só publica `shp.ee` rende zero, e a tela de menções mostra isso. Resolve junto com a credencial da Open API. **Não invente contorno** — simular navegador é raspagem com outro nome.

### Leia antes de opinar

| Arquivo | Quando |
|---|---|
| `docs/plano.md` | Antes de escolher o que construir. Tem a ordem, o porquê, e o limite da exceção da D-026 |
| `docs/decisoes.md` | Antes de propor qualquer mudança. D-001 a D-026, mais a revisão das telas e as pendências |
| `docs/telas.md` | Especificação funcional de cada tela |
| `docs/design.md` | Tokens, a casca, o sistema de botões e onde está o protótipo |
| `docs/dados.md` | Schema, comportas e o modelo de segurança |
| `docs/mercado.md` | Antes de falar de concorrência ou distribuição |
| `docs/infra.md` | O que roda onde, quanto custa, e as dependências que expiram |
| `referencia-claude-deisgn/` | O protótipo, com as quatorze telas desenhadas. Abra antes de mexer em interface |

### Como rodar

```
pnpm db:sobe     # banco local em Docker
pnpm dev         # painel em http://localhost:3000
pnpm verifica    # tipos, lint e testes — rode antes de commitar
```

**Commite ao fim de cada bloco de trabalho**, com mensagem em português explicando o porquê, não o quê.
