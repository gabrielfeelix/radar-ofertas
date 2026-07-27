# Radar de Ofertas

Sistema de curadoria e distribuição de ofertas de marketplace com link de afiliado, para grupos de WhatsApp e canais de Telegram.

Não é um disparador de mensagens. O diferencial é decidir **o que vale publicar, em qual grupo e se realmente está barato** — usando série histórica de preço própria em vez do "preço de" inflado do marketplace.

## Como está agora

Fase 0 — prova de rastreio. Nada implementado, só documentação.

## Onde está cada coisa

| Arquivo | Para quê |
|---|---|
| `SETUP.md` | Passo a passo humano: pasta, GitHub, Supabase, primeiro commit |
| `AGENTS.md` | Contexto e regras para o agente de IA. Leia antes de mexer em qualquer coisa |
| `docs/negocio.md` | Modelo comercial, divisão de receita, fluxo do dinheiro, restrições legais |
| `docs/dados.md` | Schema do banco, campos, índices e RLS |
| `docs/roadmap.md` | As cinco fases e o critério de conclusão de cada uma |
| `docs/decisoes.md` | Decisões já tomadas e o motivo. Consulte antes de propor mudança |

## Stack

Supabase (Postgres, Edge Functions, pg_cron), Next.js com TypeScript, Cloudflare Pages ou Netlify para o painel, API oficial do Telegram.

## Regra que não se negocia

Nenhum segredo entra no Git. Chaves do Supabase, tokens de bot e IDs de afiliado ficam em `.env`, que está no `.gitignore`. Variável nova entra no `.env.example` com valor falso.

## Licença

Privado. Uso pessoal.
