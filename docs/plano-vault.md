# Plano · Tirar os segredos do schema `public` e pôr no Vault

Escrito em 04/08/2026. **Não executado ainda** — este arquivo é o plano,
e a Fase 1 é o próximo passo quando o dono mandar.

## Por que, e por que não é "fechar o repositório"

O backup semanal (`backup-semanal.yml`) roda `pg_dump --schema=public` e
sobe o resultado como artefato do Actions. O repositório é público
(D-038), e artefato de repositório público é baixável por **qualquer
conta logada do GitHub**. Como `credencial_rotativa` mora no schema
`public`, o dump carrega o cookie da Central, o csrf e o refresh token do
Mercado Livre.

**Fechar o repositório não é opção, e o número decide.** Medido em
04/08: 1.063 minutos de Actions num dia (897 só do publicador, que dorme
50 min por rodada). São ~32.000 min/mês contra os 2.000 que o plano Free
dá a repositório privado, com excedente a US$ 0,006/min — uns US$ 180 por
mês. O plano Pro, com 3.000, não muda nada.

Então o conserto é o segredo não estar no dump, e não o dump ser
privado.

**O Vault não custa nada, e este projeto já o usa.** A migration 46
guardou o `github_dispatch_token` nele exatamente por este motivo, e o
`dispara_publicacao` o lê de 5 em 5 minutos desde 03/08. É extensão do
Postgres, incluída em todos os planos, sem cobrança por operação.

## O que existe hoje

Cinco credenciais, todas em `public.credencial_rotativa`:

| Loja | Chave | Tamanho | Observação |
|---|---|---|---|
| mercado_livre | `afiliados_cookie` | 288 | sessão da Central. Expira sozinha |
| mercado_livre | `afiliados_csrf` | 36 | par do anterior |
| mercado_livre | `refresh_token` | 37 | **rotaciona** a cada renovação |
| shopee | `feed_oficial` | 124 | URL de feed, provavelmente assinada |
| shopee | `feed_brasil` | 124 | idem |

**Seis leitores:** `publica-automatico.mjs`, `coleta-mercado-livre.mjs`,
`coleta-shopee.mjs`, `funde-identidades.mjs`, `reclassifica-nichos.mjs`,
`preenche-atributos.mjs`, `entra-no-catalogo.mjs`.

**Dois escritores, e os dois gravam a mesma coisa:**
`coleta-mercado-livre.mjs` (`guardaRefresh`) e `preenche-atributos.mjs`.
A duplicação entra junto no conserto.

## A restrição de desenho

O schema `vault` **não é exposto pelo PostgREST**, então o supabase-js
não fala com ele direto. Toda leitura e escrita precisa passar por
função em `public`, com `security definer`, liberada só para
`service_role`.

## O risco número um

**Não é o cookie, é o refresh token.** O Mercado Livre invalida o
anterior a cada renovação. Se a gravação quebrar, o coletor seguinte
morre com `invalid_grant` e a aplicação precisa ser reautorizada à mão.
Toda a cautela do plano existe por causa disso.

---

## Fase 1 · Migration 52, a porta com rede

Duas funções `security definer`, `revoke` de `public`/`anon`/
`authenticated`, `grant` só para `service_role`:

- `le_credencial(p_slug, p_chave) returns text` — lê do Vault e, **não
  achando, cai para `credencial_rotativa`**
- `guarda_credencial(p_slug, p_chave, p_valor)` — escreve no Vault **e**
  na tabela, enquanto durar a transição

Copia os cinco valores para o Vault. **Não apaga nada.**

A rede é o que torna isso reversível: com leitura em cascata e escrita
dupla, código velho e código novo convivem. A ordem do deploy deixa de
importar, e desfazer é `git revert`, sem migration de volta.

## Fase 2 · `lib/credenciais.ts`, um lugar só

Módulo com `leCredencial` e `guardaCredencial`, trocando os seis
leitores e os dois escritores. Mata a duplicação da gravação do refresh
token. Com teste, e em `lib/` para entrar no `tsc` — que hoje não olha
`scripts/`.

## Fase 3 · Provar antes de apagar

Não avança sem ver, em produção:

1. **uma renovação do refresh token**, conferindo que o `updated_at` do
   segredo no Vault andou
2. uma rodada de publicação usando o cookie da Central
3. uma coleta da Shopee pelas URLs de feed

## Fase 4 · Migration 53, apaga da tabela

Só depois da Fase 3. A partir daí `pg_dump --schema=public` deixa de
conter segredo na origem.

---

## O que isso reordena

**A rotação das credenciais fica por ÚLTIMO.** Rotacionando depois da
Fase 4, os valores novos nascem direto no Vault e nunca encostam no
schema `public`. Rotacionar antes seria escrever o segredo novo no mesmo
lugar que vazou.

**Cifrar o artefato do backup continua valendo.** Mesmo sem segredo, o
dump leva o catálogo e os e-mails da tabela `usuario`. Só o
`--exclude-table` é que perde a razão de ser.

**O backup deixa de restaurar as credenciais**, e isso é de propósito.
Restaurar o banco passa a exigir recolocá-las à mão. Merece uma linha em
`docs/infra.md` quando a Fase 4 entrar.

## Independente disto, e continua pendente do dono

Apagar os dois artefatos que já existem (`radar-ofertas-2026-08-02.dump`
e `radar-ofertas-2026-07-31.dump`) e rotacionar cookie, csrf e refresh
token. Nenhuma fase deste plano desfaz o que já foi exposto.
