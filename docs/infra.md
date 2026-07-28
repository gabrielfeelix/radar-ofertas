# Infraestrutura

O que roda onde, quanto custa, e o que ainda falta. Para montar o ambiente numa máquina, veja `docs/ambiente.md`.

---

## Desenho

```
GitHub Actions                    Supabase (Postgres 17)
├── Verifica ......... a cada push      ├── tabelas e RLS
├── Rotina diária .... 06:00 SP  ──────►├── Edge Function: coleta-diaria
└── Backup ........... domingo   ──────►└── funções de manutenção e curadoria
                                                   ▲
                                                   │
Cloudflare Workers ────────────────────────────────┘
└── Painel (Next.js via OpenNext)

Domínio próprio
└── Redirecionador (Edge Function) → grava clique, carrega subid
```

Cada peça está numa fronteira diferente de propósito: o banco guarda a regra, o agendador só dispara, e o painel só mostra. Se o painel cair, a coleta continua; se o agendador falhar um dia, nada se perde além daquele dia.

---

## Estado

| Peça | Situação |
|---|---|
| Repositório privado | **No ar** |
| Banco local em Docker | **No ar**, 9 migrations |
| Painel local | **No ar**, `localhost:3001` |
| Coletor com fontes plugáveis | **Pronto**, esperando credencial |
| Motor de curadoria | **Pronto e testado** |
| Rotinas de manutenção | **Prontas e testadas** |
| CI, rotina diária e backup | **Escritos**, esperando os segredos no GitHub |
| Projeto Supabase na nuvem | **Falta** |
| Domínio e redirecionador | **Falta** |
| Painel publicado | **Falta** |
| Colheita de canais | **Falta** |

---

## Por que o agendador é o GitHub Actions, e não o pg_cron

Três motivos, em ordem de peso:

1. **Não dá para confiar no pg_cron no plano gratuito.** As fontes divergem sobre a disponibilidade dele fora do Pro, e ele depende de um processo de fundo — exatamente o tipo de recurso que plano gratuito corta. Descobrir isso em produção seria caro.
2. **Projeto gratuito do Supabase é pausado após uma semana sem atividade.** A rotina diária, batendo no banco todo dia, mantém o projeto de pé sem gambiarra.
3. **Falha visível.** No GitHub fica o histórico de execução, com log e e-mail quando quebra. `pg_cron` falha em silêncio.

Quando o projeto for para o Pro, dá para mover a rotina para o `pg_cron` sem tocar no banco: as duas rotas chamam as mesmas funções.

**Pegadinha para lembrar:** o GitHub desativa workflow agendado depois de 60 dias sem commit no repositório. Se o projeto ficar dois meses parado, a coleta para calada e a série ganha um buraco. O painel mostra "anúncios parados" justamente para isso aparecer.

---

## Backup

O plano gratuito do Supabase **não faz backup nenhum** — está escrito na página de preços. Backup diário só a partir do Pro, com retenção de 7 dias.

Aqui isso pesa mais que num projeto comum: o ativo é a série histórica, ela leva meses para se formar e **não pode ser refeita**, porque o preço da terça passada não existe mais em lugar nenhum. Perder o banco é perder o produto.

Por isso o `backup-semanal.yml`: `pg_dump` semanal guardado como artefato do repositório privado, com 90 dias de retenção. Não é solução de nível empresarial — é o que transforma "perdi tudo" em "perdi no máximo uma semana", de graça.

Para restaurar:

```bash
pg_restore --no-owner --no-privileges --schema=public \
           --dbname="<string de conexão>" radar-ofertas-AAAA-MM-DD.dump
```

---

## Retenção da série

Cada ponto de preço custa **187 bytes**, medido neste banco com índices incluídos. Sem política de retenção:

| Catálogo | Crescimento | Estoura os 500 MB em |
|---|---|---|
| 5.000 anúncios | 341 MB/ano | ~1 ano e meio |
| 10.000 anúncios | 682 MB/ano | ~8 meses |

Com a colheita (D-012) enchendo o catálogo, o segundo cenário é o realista.

A `compacta_serie_antiga()` guarda um ponto por dia nos últimos 120 dias e **um ponto por semana** antes disso, sempre o de menor preço da semana — o mesmo critério do "menor do dia". A curadoria usa uma janela de 30 dias, então nada na regra perde precisão. Os mesmos 10 mil anúncios passam a caber em 290 MB por ano.

Medido: 600 mil pontos viraram 399 mil em 1 segundo, sem perder nenhum anúncio da série longa.

**Detalhe que engana:** apagar linha no Postgres não encolhe o arquivo na hora. O espaço fica marcado para reuso e o `autovacuum` cuida do resto. Na prática o banco **para de crescer**, mas o número em disco só cai depois. Não se assuste ao ver o tamanho igual logo após a compactação.

---

## Custos

**Hoje: R$ 0.** Tudo local, e GitHub Actions em repositório privado dá 2.000 minutos por mês — a rotina diária gasta uns 30.

**Ao publicar:**

| Item | Custo |
|---|---|
| Supabase Free | R$ 0 — 500 MB, 2 projetos, sem backup |
| Cloudflare Workers | R$ 0 no plano gratuito |
| Domínio `.com.br` | ~R$ 40/ano |
| GitHub Actions | R$ 0 |

**Quando o Pro vira obrigatório:** ao passar de 500 MB, ou quando a perda de uma semana de dados deixar de ser aceitável. US$ 25/mês, com 8 GB e backup diário. Com a retenção ligada, isso demora mais de um ano.

---

## Desempenho medido

Com 3.000 anúncios e 600 mil pontos de preço, no Docker de uma máquina de trabalho:

| Rotina | Tempo |
|---|---|
| Detecção de ofertas (catálogo inteiro) | **1,5 s** |
| Compactação de 200 mil pontos | **1,0 s** |

A primeira versão do detector chamava uma função por anúncio e teria levado minutos, estourando o tempo limite. A reescrita em conjunto mantém a regra numa implementação só — `avalia_anuncios` — com a versão por anúncio como casca fina para a tela explicar o veredito.

---

## Segurança

**Nenhum papel ganha permissão por herança.** Duas correções foram necessárias, e a segunda é a que mais se repete em projeto Supabase:

1. O padrão deixava `service_role` sem `SELECT` e `anon` com `TRUNCATE`.
2. **Função no Postgres nasce com `EXECUTE` concedido a PUBLIC** — e PUBLIC não é um papel, é todo mundo, inclusive `anon`. Revogar de `anon` não adianta. Como as funções são `SECURITY DEFINER`, qualquer pessoa com a chave anônima poderia chamá-las com o poder do dono do banco.

Hoje o padrão do schema revoga `EXECUTE` de PUBLIC, e cada migration reconcede explicitamente a `service_role`. Se alguém esquecer, a função não é chamável pelo servidor — falha barulhenta, que é o modo certo de falhar.

Verificado pela API real: `anon` recebe 401 tanto na leitura quanto no RPC.

**A service role nunca chega ao navegador.** `lib/supabase/servidor.ts` importa `server-only`, então o build quebra se um componente de cliente tentar usá-la.

---

## Segredos

Nada de segredo no Git. Onde cada um mora:

| Onde | O quê |
|---|---|
| `.env` local | Chaves do Supabase, credenciais de marketplace, sessão do Telegram |
| Segredos do GitHub | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COLETA_SEGREDO`, `SUPABASE_DB_URL` |
| Segredos da Edge Function | `COLETA_SEGREDO`, credenciais de marketplace |

A **string de sessão do Telegram** merece nota à parte: ela equivale à conta inteira. Quem tem a string entra no Telegram como se fosse você. Vive só no `.env` e nos segredos da função — nunca em arquivo, nunca em mensagem, nunca em captura de tela.

---

## Dependências de temporizador de terceiro — decidir ao fim das telas

**Anotado em 28/07/2026, para resolver de uma vez quando as telas estiverem prontas.** São todos o mesmo problema com roupas diferentes: alguma coisa fora do nosso controle expira, e o sintoma é o sistema parar em silêncio.

| O quê | O que expira | Sintoma quando expira |
|---|---|---|
| **Agendador do GitHub Actions** | workflow agendado é desativado após **60 dias sem commit** no repositório | a coleta simplesmente não roda. Nenhum erro, nenhum aviso, e a série ganha um buraco por dia |
| **Projeto gratuito do Supabase** | pausa após **7 dias sem requisição** | o painel e as funções param de responder. Foi por isso que o agendador ficou no GitHub e não no `pg_cron` (D-015) |
| **Token de afiliado do Mercado Livre** | `ML_REFRESH_TOKEN` tem validade e precisa ser renovado | o coletor pula a loja e informa — visível, mas só para quem olha |
| **Sessão de usuário do Telegram** | a string de sessão pode ser invalidada pelo próprio Telegram | a colheita de grupo fechado para de trazer link |
| **Credencial da Open API da Shopee** | chave com validade a confirmar quando ela existir | idem |

Hoje existe **um remendo e uma superfície**: a tela `/atencao` conta os dias que faltam para o agendador dormir, lendo a data do último commit do próprio `.git`. Isso avisa, mas não resolve — e não cobre os outros quatro.

**Não decidir agora, de propósito.** Cada caminho possível — segundo agendador externo, commit automático de manutenção, monitor que pinga de fora, renovação automática de token — muda o desenho da infraestrutura, e desenhar isso no meio das telas é trocar duas coisas ao mesmo tempo. **Rever quando as telas terminarem**, junto, como um problema só: *como o sistema percebe que uma dependência externa venceu, e como ele avisa antes de parar.*

---

## O que falta, na ordem

1. **Projeto Supabase na nuvem** — `pnpm db:publica` aplica as 9 migrations.
2. **Segredos no GitHub** — destrava a rotina diária e o backup.
3. **Credencial de marketplace** — sem ela o coletor roda e não coleta nada.
4. **Domínio** — precede o redirecionador, que precede qualquer publicação.
5. **Publicar o painel** — só faz sentido quando houver oferta na fila.
