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

Atualizado em 31/07/2026. **Mantenha esta seção viva** — ela é o que uma sessão nova lê para saber onde parou. Atualize ao fim de cada bloco de trabalho.

**Fase 0 em andamento** (contas de afiliado e prova de subid: trabalho manual do dono), com a base da Fase 1 construída em paralelo. As duas não conflitam — o resultado da Fase 0 decide a granularidade do subid, que só aparece na Fase 2.

### O que a sessão de 31/07/2026 mudou

Dia longo, quatro frentes. Ordem de leitura para quem chega agora: esta lista, depois `docs/credenciais.md` (o que existe de conta e o que falta), depois `docs/refino-visual.md` (o estado da interface).

**1. O projeto passou a se ver.** `pnpm telas` fotografa as treze telas logadas em 2×, dentro de `.telas/` (fora do Git), e **falha se alguma soltar erro de execução no navegador**. Foi o que finalmente fechou o buraco de `pnpm verifica` não enxergar layout. Rode e **olhe as fotos** depois de mexer em interface.

**2. Refino visual, cinco frentes das seis planejadas** (`docs/refino-visual.md`). Duas elevações em repouso substituindo a regra antiga de "nada de sombra"; número de indicador em 32px com rótulo sobrescrito; a fila de `/aprovar` virou lista de decisão com série de preço na linha e o laranja aparecendo numa linha por vez; `Pagina` ganhou `mx-auto` e a coluna de contexto de 320px; chip de plataforma em tinta. Ficou de fora, de propósito: os atalhos de teclado da fila, e a F4 (micro-gráficos) por não haver pergunta esperando resposta.

**3. Seis agentes de QA usaram o painel como gente.** Trinta e poucos achados, quatro reais e corrigidos: horário de canal salvava vazio em silêncio, a tela prometia que o Telegram publica sozinho (não publica, é Fase 2), limiar de curadoria aceitava qualquer número, e o cancelar de publicação não dizia que é reversível. O resto foi rejeitado com motivo — vale ler o commit `1d015a1` antes de reabrir qualquer um deles.

**4. O sistema saiu da máquina local.** Projeto Supabase criado e migrations aplicadas, e o painel publicado. Ver "Bloqueado, e por quem" logo abaixo, que mudou bastante.

**5. A simulação saiu do painel, inteira.** Decisão do dono: *"agora estamos parando de brincar de mockup"*. Encerra a exceção da D-026. `lib/simulacao/loja.ts` foi apagado e as três telas — Canais, Aprovar e Publicar — leem o banco. A faixa `AvisoSimulacao` não existe mais, porque não há tela mentindo. **Nenhuma tela do painel mostra número inventado.** O que a travessia mudou está em `docs/tirar-a-simulacao.md`.

**6. A infraestrutura saiu do papel.** Segredos do GitHub subidos, Edge Functions publicadas na nuvem, variáveis da Vercel completadas em Preview e Development. As duas rotinas agendadas foram **disparadas à mão e passaram** — não estão só configuradas, estão comprovadas.

### Contas e credenciais — onde estamos

Detalhe, passo a passo e armadilhas de cada uma em `docs/credenciais.md`.

| O quê | Estado em 31/07 | Falta |
|---|---|---|
| **Supabase nuvem** | ✅ `radar-ofertas`, São Paulo, ref `fcdkczueohekmgaaacdr`, 15 migrations aplicadas | nada |
| **Mercado Livre — afiliado** | ✅ aprovado, `fega6031503`. **Etiquetas resolvidas em 01/08** | falta gerar um link com cada etiqueta, para extrair o número de rastreamento |
| **Amazon — associado** | ✅ ativo, `radar4yu-20`, fiscal enviado | **prazo: 3 vendas até 27/01/2027** ou a conta é revogada |
| **Shopee — afiliado** | ⏳ cadastro enviado, até 3 dias úteis | esperar e-mail |
| **Shopee — Open API** | ⛔ bloqueado | exige o ID de afiliado, que só existe depois de aprovar. **Depois disso, até 2 semanas** |
| **Mercado Livre — API de itens** | 🟡 aplicação criada em 31/07, `Radar de Ofertas 4YU`, Client ID `7618355784652588` | faltam **dois**: o `ML_CLIENT_SECRET`, que a versão anterior deste arquivo dava como presente no `.env` e **não está em lugar nenhum** (conferido no `.env`, no cofre da 4YU e nas variáveis da Vercel), e o `ML_REFRESH_TOKEN`. Passo a passo em `docs/credenciais.md` §4b |
| **Canais** | ✅ `t.me/radarpet` (público) e grupo de WhatsApp | audiência |

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

**Banco** — 15 migrations em `supabase/migrations/`, **todas aplicadas no local** (as 12 primeiras reescritas do zero em 27/07, exceção deliberada, com o banco vazio). `operacao_id` em toda tabela, papel como lista, nicho como entidade, limiar herdando por nicho, contador de reprovação por comporta e registro de execução das rotinas.

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

**São 16 migrations.** A 16 (`publicacao`) está aplicada no local e na nuvem, e as constraints dela foram conferidas contra a nuvem uma a uma, com dado de verdade criado e apagado depois. Conferido no banco, não só no log: o modelo `Padrão` começa com `#publi · {loja}` na primeira linha, `anuncio.imagem_url` e `imagem_obtida_em` existem, e `expurga_imagens_expiradas` roda.

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

### Bloqueado, e por quem

- **Coleta de preço real** — falta credencial de marketplace, e o caminho mais curto **mudou em 31/07**. A Shopee continua sendo a melhor chave (resolve dado e link de uma vez), mas ela está a cerca de três semanas de distância: cadastro em análise, e a API só pode ser pedida depois de aprovado, levando até duas semanas a mais. **O Mercado Livre virou o atalho, e ele andou:** a aplicação já existe e `ML_CLIENT_ID` e `ML_CLIENT_SECRET` já estão no `.env`. **Falta um único passo**, o `ML_REFRESH_TOKEN`, que sai de um fluxo de navegador descrito em `docs/credenciais.md` §4b. Quem retomar isto: é a primeira coisa da fila, e leva minutos.
- **Renovação do token do ML rasga o token guardado** — ⚠️ **defeito conhecido, não corrigido.** O Mercado Livre **troca o refresh token a cada renovação** e invalida o anterior. `pegaToken` em `supabase/functions/_compartilhado/fontes/mercado-livre.ts` lê só o `access_token` da resposta e descarta o `refresh_token` novo. Funciona na primeira renovação e quebra na próxima execução fria — o coletor passa a reportar "não consegui renovar o token" e pula a loja. **Tem que ser resolvido antes da primeira coleta agendada:** o token rotacionado precisa ser gravado em algum lugar que sobreviva à Edge Function, e variável de ambiente não é esse lugar.
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
| `referencia-claude-deisgn/` | O protótipo, com as quatorze telas desenhadas. Abra antes de mexer em interface |

### Como rodar

```
pnpm db:sobe     # banco local em Docker
pnpm dev         # painel em http://localhost:3000
pnpm verifica    # tipos, lint e testes — rode antes de commitar
```

**Commite ao fim de cada bloco de trabalho**, com mensagem em português explicando o porquê, não o quê.
