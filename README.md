# Radar de Ofertas

Sistema de curadoria e distribuição de ofertas de marketplace com link de afiliado, para canais de WhatsApp e Telegram.

Não é um disparador de mensagens. O diferencial é decidir **o que vale publicar, em qual canal e se realmente está barato** — usando série histórica de preço própria, em vez do "preço de" inflado do marketplace.

A pesquisa de mercado (`docs/mercado.md`) confirmou que isso é raro: o padrão dos concorrentes é monitorar canal alheio, trocar o link de afiliado e republicar sem conferir preço nenhum.

---

## Como está agora

**Fase 0** (prova de rastreio, trabalho manual do dono) em andamento, com a **base da Fase 1** construída em paralelo.

### Pronto e testado

- **Banco** — 12 migrations, reescritas do zero em 27/07. `operacao_id` em toda tabela, papel como lista, nicho como entidade, limiar por nicho, contador de reprovação por comporta e registro de execução das rotinas. RLS e permissões explícitas: nada nasce aberto.
- **Motor de curadoria** — as comportas e a nota (0 a 100), dentro do banco. Treze casos verificados. Detecta 3.000 anúncios em 1,4 segundo.
- **Manutenção** — expurgo da Amazon, expiração de oferta, compactação da série antiga.
- **Coletor diário** — fontes plugáveis por marketplace, esperando credencial.
- **Colheita de canais** — lê canais públicos do Telegram, resolve os links encurtados e cadastra no catálogo o que ainda não conhecemos. Testada contra canal real: 18 anúncios novos em 8 segundos.
- **Painel** — três telas: cadastro de anúncio por link colado com acompanhamento da série, rendimento por canal de colheita, e menções com problema. As duas de colheita foram verificadas contra três canais reais: 60 posts, 35 links, 6 anúncios novos e 29 descartes, cada um com o motivo à vista.
- **Telas de decisão** — aprovar, publicar e canais, sobre uma **operação simulada** (D-026). Servem para testar o fluxo com gente de verdade antes de existir credencial, domínio e canal; o backend é plugado depois, ação por ação. A faixa "operação simulada" fica visível o tempo todo.
- **Automação** — CI a cada push, rotina diária e backup semanal.
- **Testes** — `pnpm testa` cobre o leitor de link, o de identificador de canal e a máquina de estados da operação simulada. Sem banco, sem rede.

### Falta

| O quê | Depende de |
|---|---|
| Precisa de atenção, trilha de arranque, catálogo | nada — é o próximo trabalho |
| Plugar o backend nas telas de decisão | série de preço real |
| Colheita por conta de usuário (grupo fechado) | número dedicado e sessão |
| Coleta de preço real | **credencial de marketplace** |
| Projeto Supabase na nuvem | conta criada |
| Segredos no GitHub | projeto na nuvem existir |
| Redirecionador e link de afiliado | **domínio registrado** |
| Painel publicado | haver oferta na fila |

Estado detalhado em `docs/infra.md`, e o que fazer em cada fase em `docs/roadmap.md`.

---

## Rodando na sua máquina

Pré-requisitos e passo a passo completo em `docs/ambiente.md`. O resumo:

```bash
nvm use                 # Node 24, lido do .nvmrc
pnpm install
cp .env.example .env    # preencha com o que o db:status imprimir
pnpm db:sobe            # banco local em Docker
pnpm dev                # painel em http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `pnpm dev` | Painel em modo desenvolvimento |
| `pnpm verifica` | Tipos, lint e testes. Rode antes de commitar |
| `pnpm testa` | Testes do leitor de link. Não precisa de banco nem rede |
| `pnpm db:sobe` / `db:desce` | Liga e desliga o banco local |
| `pnpm db:reset` | Recria o banco do zero e reaplica todas as migrations |
| `pnpm db:publica` | Aplica as migrations no Supabase da nuvem |
| `pnpm db:tipos` | Regera os tipos do TypeScript a partir do banco |

---

## Onde está cada coisa

| Arquivo | Para quê |
|---|---|
| `AGENTS.md` | Contexto e regras para o agente de IA. **Leia antes de mexer em qualquer coisa** |
| `docs/negocio.md` | Modelo comercial, divisão de receita, fluxo do dinheiro, restrições legais |
| `docs/mercado.md` | Como os concorrentes operam de fato, e onde eles ganham dinheiro |
| `docs/dados.md` | Schema do banco, campos, índices e RLS |
| `docs/infra.md` | O que roda onde, quanto custa, o que falta |
| `docs/ambiente.md` | Montar o projeto numa máquina nova |
| `docs/roadmap.md` | As fases e o critério de conclusão de cada uma |
| `docs/decisoes.md` | Decisões tomadas e o motivo. **Consulte antes de propor mudança** |
| `docs/plano.md` | A ordem de execução e a regra que evita cascata |
| `docs/design.md` | Tokens de cor, tipografia, espaçamento e botão |
| `docs/telas.md` | Especificação funcional das telas |
| `SETUP.md` | Guia original de criação do repositório. Histórico |

**O protótipo não está neste repositório.** Ele vive no projeto de design do Claude, em
`claude.ai/design/p/8a12d079-d3de-4ed0-b8b4-f5f427a1c97e` ("Fila de aprovação e sistema"),
como `Radar de Ofertas.dc.html` — é dele que saíram todos os números de `docs/design.md`,
e é lá que estão as capturas das telas e a versão de `telas.md` que originou a
especificação. Quem for mexer em interface abre o protótipo antes.

---

## Stack

Supabase (Postgres 17, Edge Functions), Next.js 16 com TypeScript, Cloudflare Workers via OpenNext para o painel, GitHub Actions para agendamento, API oficial de bots do Telegram.

Versões travadas em `.nvmrc`, `package.json` e `supabase/config.toml` — os dois PCs rodam idêntico.

---

## Regras que não se negociam

**Nenhum segredo entra no Git.** Chaves, tokens e IDs de afiliado ficam no `.env`, que está no `.gitignore`. Variável nova entra no `.env.example` com valor falso.

**Nunca automatizar envio no WhatsApp.** Não existe via oficial para distribuição em massa, e ferramenta não oficial derruba o número. O sistema monta o texto; um humano aperta enviar.

**A curadoria mora no banco.** A regra vive em `avalia_anuncios`, uma implementação só. Duplicá-la em TypeScript faria a tela explicar uma coisa e o sistema fazer outra.

**Dinheiro é inteiro, em centavos.** Sempre.

As nove regras completas estão na seção 3 do `AGENTS.md`.

---

## Licença

Privado. Uso pessoal.
