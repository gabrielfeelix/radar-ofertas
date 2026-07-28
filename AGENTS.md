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

**Fase 0 em andamento** (contas de afiliado e prova de subid, trabalho manual do dono), com a base da Fase 1 sendo construída em paralelo. As duas não conflitam: o resultado da Fase 0 decide a granularidade do subid, que só aparece na Fase 2.

Já existe:

- Repositório privado em `gabrielfeelix/radar-ofertas`, versões travadas (`docs/ambiente.md`).
- Migrations da Fase 1: `marketplace`, `produto`, `anuncio`, `preco_ponto`, com RLS ligado, a view `anuncio_serie` e as funções `registra_preco` e `expurga_precos_expirados`.
- Painel da Fase 1: cadastro de anúncio por link colado e tabela de acompanhamento da série.
- `lib/marketplaces.ts` lê a URL e extrai loja e código do anúncio, sem fazer requisição.

- Coletor diário com fontes plugáveis por marketplace, testado sem credencial.
- Motor de validação: `oferta`, `parametro`, `comissao_categoria`, as duas comportas e a nota, com dez casos cobertos. Detecta 3.000 anúncios em 1,5 s.
- Rotinas de manutenção: expurgo, expiração de oferta e compactação da série.
- **Colheita de canais públicos do Telegram** (D-012), rodada contra um canal real: 20 posts, 37 links, 18 anúncios novos em 8 segundos.
- Testes do leitor de link em `testes/links.mjs`, rodados por `pnpm testa` e pelo CI.

Ainda não existe, e é o próximo bloco de trabalho:

- **Tela da fila de ofertas.** Não depende de nada — dá para construir com dados semeados.
- Colheita por conta de usuário do Telegram, para alcançar grupo fechado.
- Credencial de marketplace. Sem ela o coletor roda mas não coleta nada.
- Projeto Supabase na nuvem e segredos no GitHub.

Leia `docs/mercado.md` antes de propor qualquer coisa sobre distribuição ou concorrência — ele tem a pesquisa de como o mercado opera de fato, e corrige duas suposições do plano original.
