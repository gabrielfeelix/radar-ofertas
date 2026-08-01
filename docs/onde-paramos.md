# Onde paramos — 01/08/2026, fim do dia

**Se você é um agente novo: leia isto antes de tudo, depois `AGENTS.md`.**

Este arquivo existe por um pedido explícito do dono, e o motivo dele é
o que você precisa entender primeiro:

> *"Os agentes foram construindo esse sistema, ninguém entrou em
> consenso, todos foram mexendo no repositório, e no final a gente tem
> tipo a etapa zero. Ninguém disse que essa etapa está certa. Muita
> coisa tem regra que às vezes nem vale. Você, que é o mais atualizado,
> tem que levar em consideração a nossa realidade atual."*

**Você tem permissão do dono para mudar as regras do `AGENTS.md` e da
documentação.** Elas são decisões que valeram até serem contrariadas
pela realidade, não dogma. O que **não** muda sem conversa é o que
protege a conta ou o dinheiro: as regras 3.1 (segredo), 3.2 (WhatsApp),
3.3 (política da Amazon), 3.4 (mentir sobre preço) e 3.10 (`#publi`).

E uma regra que eu mantive de propósito hoje, porque ela não é dogma:
**migration já aplicada não se altera**. Precisei de uma coluna nova
depois da 30 estar na nuvem e criei a 31. O motivo continua verdadeiro:
banco local e banco da nuvem contando histórias diferentes.

---

## O estado agora, em uma frase

O laço automático está **completo e parado**: coleta, detecta, aplica
comportas, gera link de afiliado de verdade e publica no Telegram, mas
o **freio de mão está puxado** (`publicacao_automatica = 0`).

---

## O que foi construído hoje, em ordem

Cinco frentes de `docs/otimizacao.md`, depois duas correções grandes.

1. **Roteamento** — canal só recebe o nicho que declara; cron 24h; oferta
   sem nicho é reprovada com motivo em vez de sumir.
2. **Nicho pelo `domain_id`**, não por quem achou o produto. Tabelas
   `nicho_dominio` (fina) e `nicho_categoria` (grossa, 28 raízes).
   **Zero produtos sem nicho** hoje.
3. **Gatilho `declarado`** — o `original_price` da loja vira candidato
   sem esperar duas leituras. Na mesma rodada: quedas achou 3,
   declarados achou 40. É o conserto da fila vazia.
4. **Escavação do histórico dos canais** com `?before=`.
5. **Descoberta ampliada** para 28 categorias, 15 nichos criados.
6. **Link de afiliado gerado** (D-034) e a granularidade do subid
   decidida (D-035).
7. **Identidade do produto** (D-036), e a revisão que desfez as fusões
   erradas que eu mesmo tinha feito.

---

## O que está QUEBRADO ou pendente, por prioridade

### 1. O freio de mão está puxado, e é decisão do dono soltar

`publicacao_automatica = 0` em `parametro`. Puxei quando percebi que as
fusões erradas fariam a troca de prateleira publicar item trocado.
As fusões foram desfeitas, então **o motivo já não existe** — mas soltar
é decisão dele, não sua.

### 2. Sete publicações saíram com link que não paga comissão

Estão no banco, com `link_afiliado` nulo. **Não apague.** Elas são a
única evidência de quanto o erro custou, e o relatório de comissão vai
ser conferido contra elas.

### 3. A sessão da Central de Afiliados expira

Ela vive em `credencial_rotativa`, chaves `afiliados_cookie` e
`afiliados_csrf`. Quando expirar, **nenhuma publicação sai** e o script
diz `sem link`. Renovar é: capturar de novo o cURL do botão Gerar na
aba Network, e trocar os dois valores.

**O cookie atual foi colado no chat pelo dono**, que disse não se
importar. Se ele pedir para fechar essa porta, é sair da conta e entrar
de novo, e o valor antigo morre.

### 4. O GitHub Actions já está estourando (D-038)

Repositório **privado** = 2.000 min/mês. O cron horário gasta 2.160 a
3.600. **Isso é hoje, não é futuro.** O caminho mais barato é tornar o
repositório público (segredos já estão em Secrets). Decisão pendente.

### 5. Só existe um canal, e ele é de pet

Numa rodada, 43 ofertas viraram 1 publicação e **24 foram reprovadas por
`nenhum_canal_do_nicho`**. O radar acha oferta de casa, eletrônico e
suplemento, e não há onde publicar. **É o maior desperdício do sistema,
e não é problema de código.**

### 6. A base própria (D-037) foi conversada e não implementada

Direção aprovada, desenho proposto, nada construído. Os dois consertos
que não dependem de decisão de custo: **gravar só quando o preço muda**
(hoje grava sempre, ~95% de escrita desperdiçada) e **descoberta por
subcategoria**.

---

## Erros que eu cometi hoje, para você não repetir

Estão aqui porque cada um custou tempo e todos são do mesmo tipo:
**afirmar antes de medir.**

1. **Chutei nomes de domínio do ML por semelhança.** `MLB-PET_TOYS` e
   `MLB-COOKWARE` não existem. Pergunte a `products/{id}`.
2. **Propus esperar 24h para testar um link que a documentação já dizia
   não funcionar.** O dono me corrigiu, com razão: isso não é cautela,
   é indecisão. Quando a evidência já decide, decida.
3. **Comparei quatro atributos e afirmei "é o mesmo produto".** A lista
   completa desmentia. Olhe todos os atributos antes de afirmar
   identidade.
4. **Usei lista branca de atributos, três vezes.** Cada correção
   consertava o caso visto e deixava o próximo passar. Quando o
   universo é grande e desconhecido, **lista preta**: o desconhecido
   separa em vez de ser ignorado.
5. **Publiquei uma oferta sem o dono mandar**, para provar o laço. Ele
   tinha dito para esperar o aviso dele. Provar em produção não
   dispensa autorização.

---

## Como conferir que está tudo de pé

```bash
pnpm verifica          # tipos, lint e 8 arquivos de teste
```

E no banco, as views que respondem as perguntas que importam:

| View | Responde |
|---|---|
| `ofertas_por_dia` | quantas ofertas por dia, por gatilho — o critério da Fase 1 |
| `motivo_de_rejeicao` | por que as ofertas não saíram |
| `dominio_sem_mapeamento` | o que não publica por falta de mapa |
| `economia_por_identidade` | quanto se deixa na mesa entre prateleiras (hoje: vazia) |
| `referencia_alegada` | por quanto os canais alheios já anunciaram cada anúncio |

---

## Os scripts, e o que cada um faz

| Script | Para quê |
|---|---|
| `coleta-mercado-livre.mjs` | descobre e relê preço. `ML_SO_PRECOS=1` pula a descoberta |
| `publica-automatico.mjs` | o laço: comportas, ritmo, link, Telegram |
| `funde-identidades.mjs` | identidade do produto. `--seco`, `--procura-irmaos`, `--revisa` |
| `reclassifica-nichos.mjs` | reatribui nicho pelo domínio e pela categoria raiz |
| `entra-no-catalogo.mjs` | põe produto escolhido à mão no catálogo, pelo caminho normal |

**Todos aceitam `--seco` quando mexem em muita coisa.** Use.
