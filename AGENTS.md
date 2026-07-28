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

Atualizado em 28/07/2026. **Mantenha esta seção viva** — ela é o que uma sessão nova lê para saber onde parou.

**Fase 0 em andamento** (contas de afiliado e prova de subid: trabalho manual do dono), com a base da Fase 1 construída em paralelo. As duas não conflitam — o resultado da Fase 0 decide a granularidade do subid, que só aparece na Fase 2.

### Pronto e verificado

**Banco** — 12 migrations em `supabase/migrations/`, reescritas do zero em 27/07 (exceção deliberada e aprovada, com o banco vazio). `operacao_id` em toda tabela, papel como lista, nicho como entidade, limiar herdando por nicho, contador de reprovação por comporta e registro de execução das rotinas.

**Motor de curadoria** — `avalia_anuncios` é *a regra*, numa implementação só. 13 cenários verificados. 3.000 anúncios com 600 mil pontos em 1,4 s.

**Coletor diário** — fontes plugáveis por marketplace (`supabase/functions/coleta-diaria`). Roda hoje; sem credencial, pula a loja e informa.

**Colheita** — lê canais públicos do Telegram (`supabase/functions/colheita-canais`). Rodada contra canal real: 20 posts, 37 links, 18 anúncios novos em 8 s.

**Painel** — três telas: cadastro por link colado com acompanhamento da série (`/`), rendimento por canal (`/colheita/fontes`) e menções com problema (`/colheita/mencoes`). As duas de colheita foram construídas e verificadas contra três canais reais do Telegram: 60 posts, 35 links, 6 anúncios novos, 29 descartes — e os 29 aparecem na tela com o motivo de cada um.

**Automação** — CI a cada push, rotina diária e backup semanal em `.github/workflows/`.

**Design system** — tokens em `app/globals.css`, explicados em `docs/design.md`. Só cor, tipografia, espaçamento, raio e botão. Card fora de propósito.

**Telas de decisão, com operação simulada (D-026)** — `/aprovar` e `/publicar`, sobre `lib/simulacao/`. Decidir da linha, capacidade no topo, rejeitar com motivo de lista curta, diagnóstico por comporta, Telegram em lote, desfazer no envio, bloqueio por preço mudado. A máquina de estados tem teste próprio em `testes/simulacao.mjs`.

**A ordem de trabalho mudou em 28/07, por decisão do dono:** interface primeiro, backend plugado depois, ação por ação. O que falta para essas telas terem dado real não é código — é credencial, domínio e canal. Leia a D-026 antes de propor voltar à ordem antiga.

### Próxima tarefa

Continuar a interface, sempre com dado simulado, nesta ordem:

1. **Canal** — nicho, plataforma, teto diário, split. Hoje os canais da simulação são constantes num arquivo; esta tela é o que permite ao testador montar a própria operação e mexer na capacidade, que é o número que muda comportamento na aprovação.
2. **Precisa de atenção** — agrega, não lista. Só o que exige ação humana.
3. **Trilha de arranque** — o próximo passo num sistema vazio.

Depois, o plugue: cada ação de `app/acoes/` troca a chamada à simulação por escrita no banco, uma por vez, sem tocar na tela.

Antes de escrever tela, leia `docs/plano.md`: a ordem não é a do menu, e a regra que evita cascata continua valendo para dado que o banco deveria ter — com o limite que a D-026 escreveu.

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
| `docs/plano.md` | Antes de escolher o que construir. Tem a ordem e o porquê |
| `docs/decisoes.md` | Antes de propor qualquer mudança. D-001 a D-025 |
| `docs/mercado.md` | Antes de falar de concorrência ou distribuição |
| `docs/telas.md` | Especificação funcional das telas |
| `docs/dados.md` | Schema, comportas e o modelo de segurança |
| `docs/infra.md` | O que roda onde, quanto custa, o que falta |
| `docs/design.md` | Tokens, e o endereço do protótipo — que **não está no repositório** |

### Como este projeto trabalha

Três trilhas em paralelo, nunca em cascata: **banco e motor** (rápido, sem interface), **design system** (componente entra quando a tela pedir), **telas** (uma por vez, ponta a ponta).

A regra que sustenta isso: **nenhuma tela é construída com dado falso.** Se a tela precisa de dado que o banco não tem, ou o banco ganha o dado primeiro, ou a tela sai da fila. Foi ela que revelou, antes de qualquer interface, que três telas especificadas não tinham dado por trás.

E teste com dado real sempre que der. A colheita só começou a funcionar de verdade quando foi rodada contra um canal existente: a primeira versão trazia 3 anúncios de 38 links, e o dado real expôs três bugs que nenhuma revisão teria achado.
