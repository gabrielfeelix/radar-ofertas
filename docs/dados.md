# Modelo de dados

Postgres via Supabase. Convenções: `snake_case`, português, tabela no singular, `id` + `criado_em` em toda tabela, RLS ligado desde a primeira migration.

**Dinheiro sempre em `INTEGER` de centavos.** Nunca `float` ou `numeric` para valor monetário nesta base — a conversão para reais acontece só na exibição.

**Datas sempre `timestamptz` em UTC.** Exibição em `America/Sao_Paulo`.

---

## A separação central

Quatro conceitos que costumam virar uma tabela só e depois viram um inferno de manutenção:

- **produto** — a identidade da coisa. "Tapete higiênico SuperSecão 80×60".
- **anuncio** — esse produto numa loja específica. O mesmo produto na Amazon, Shopee e Magalu são três anúncios com três preços.
- **oferta** — um anúncio que ficou barato agora. Tem começo, fim e nota.
- **publicacao** — uma oferta enviada para um canal. É o que gera link, clique e comissão.

Sem essa separação, o mesmo produto em três lojas vira três produtos duplicados e a nota da oferta fica impossível de calcular.

---

## Tabelas

### parceiro
Quem traz audiência.

`id`, `nome`, `contato`, `chave_pix`, `tipo` (`proprio` | `amigo` | `youtuber`), `ativo`, `criado_em`

### canal
Um grupo de WhatsApp ou canal de Telegram.

`id`, `parceiro_id`, `nome`, `plataforma` (`whatsapp` | `telegram`), `nicho`, `membros_estimados`, `posts_por_dia_max`, `horarios_permitidos` (array de hora local), `template_id`, `split_audiencia_pct`, `split_operacao_pct`, `operador_id`, `telegram_chat_id` (nullable), `ativo`, `criado_em`

Os dois percentuais ficam separados porque um parceiro pode ter só audiência ou audiência e operação. O que sobra dos dois é a parte do dono.

### marketplace
`id`, `nome`, `afiliado_id`, `comissao_padrao_pct`, `suporta_subid` (bool), `cache_preco_max_horas`, `ativo`

O campo `cache_preco_max_horas` existe por causa da Amazon, que permite guardar preço por no máximo 24 horas. O coletor e a exibição respeitam esse campo por marketplace, não por regra fixa no código.

### comissao_categoria
Percentual por categoria e marketplace. Nunca hardcode percentual no código — eles mudam por campanha.

`id`, `marketplace_id`, `categoria`, `percentual`, `vigente_desde`, `vigente_ate`

### produto
`id`, `titulo_canonico`, `categoria`, `imagem_url`, `criado_em`

### anuncio
`id`, `produto_id`, `marketplace_id`, `url_original`, `sku_externo`, `vendedor`, `avaliacao`, `ativo`, `ultima_coleta_em`, `criado_em`

Índice único em (`marketplace_id`, `sku_externo`) para não duplicar anúncio na mesma loja.

### preco_ponto
Série histórica. É a tabela que mais cresce.

`id`, `anuncio_id`, `preco_centavos`, `disponivel` (bool), `coletado_em`

Índice em (`anuncio_id`, `coletado_em desc`). Guarde no máximo um ponto por anúncio por dia; se coletar mais vezes, mantenha o menor do dia. Rotina de limpeza descarta pontos de marketplaces cujo `cache_preco_max_horas` seja menor que a idade do ponto — na prática, a Amazon.

### parametro
Limiares da curadoria, ajustáveis sem deploy (D-014).

`chave`, `valor`, `descricao`, `atualizado_em`

Lidos pela função `parametro(chave)`, que falha alto se a chave não existir — devolver um padrão silencioso esconderia erro de digitação e faria o sistema curar com limiar que ninguém escolheu.

### oferta
`id`, `anuncio_id`, `preco_atual_centavos`, `preco_referencia_centavos`, `referencia_janela_dias`, `dias_de_serie`, `desconto_pct`, `nota`, `nota_desconto`, `nota_comissao`, `nota_qualidade`, `comissao_estimada_centavos`, `status` (`nova` | `aprovada` | `rejeitada` | `expirada`), `detectada_em`, `expirada_em`, `criado_em`

`referencia_janela_dias` registra sobre quantos dias de série a comparação foi feita. Se for menor que 14, a mensagem não pode falar em desconto histórico.

As parcelas da nota ficam gravadas separadas para que se entenda depois por que uma oferta ficou com determinada nota, sem precisar recalcular.

**A nota vai de 0 a 100, mas o teto real hoje é 80.** Os 20 pontos de fadiga do canal e de desempenho histórico por categoria dependem de `canal`, que é da Fase 2. Ficam reservados de propósito, para que a nota de hoje continue comparável com a de amanhã em vez de sofrer inflação silenciosa.

Quem decide é a função `avalia_anuncio(anuncio_id)`, que devolve o veredito com os motivos em texto — é a mesma função que responde "por que essa oferta não apareceu?" na tela. `detecta_ofertas()` roda depois da coleta e grava as aprovadas.

### publicacao
`id`, `oferta_id`, `canal_id`, `subid`, `mensagem_enviada`, `preco_no_envio_centavos`, `link_afiliado`, `status` (`fila` | `enviada` | `cancelada`), `agendada_para`, `enviada_em`, `enviada_por`, `criado_em`

Índice único em `subid`. Este campo é o que liga o dinheiro ao grupo.

### clique
`id`, `publicacao_id`, `ocorrido_em`, `ip_hash`, `user_agent`, `referer`

**Hash do IP, nunca o IP.** Sem nome, telefone ou e-mail.

### conversao
`id`, `subid`, `publicacao_id`, `marketplace_id`, `pedido_externo_id`, `valor_pedido_centavos`, `comissao_centavos`, `estado` (`registrada` | `confirmada` | `cancelada` | `recebida`), `reportada_em`, `confirmada_em`, `recebida_em`, `ciclo_pagamento`

O `publicacao_id` é resolvido a partir do `subid` na importação. Guarde os dois — se o subid vier corrompido, ainda dá para investigar.

### repasse
`id`, `parceiro_id`, `periodo_inicio`, `periodo_fim`, `base_recebida_centavos`, `percentual`, `valor_centavos`, `status` (`aberto` | `pago`), `pago_em`, `comprovante_url`, `criado_em`

O cálculo só considera conversões no estado `recebida`.

### template
`id`, `nome`, `corpo`, `variaveis`, `canal_id` (nullable para template global), `criado_em`

### usuario
`id` (referencia `auth.users`), `nome`, `papel` (`dono` | `operador` | `parceiro`), `parceiro_id` (nullable), `criado_em`

---

## O subid

Curto, alfanumérico, único por publicação. Formato: o id da publicação em base36 com prefixo `p`. Exemplo: `p1a2b3`.

Se algum marketplace limitar o tamanho ou não devolver o campo no relatório, o plano B é um subid por canal (`c07`) em vez de por publicação. Perde-se saber qual oferta converteu, mantém-se a divisão de receita — que é o essencial.

**A Fase 0 existe justamente para descobrir isso antes de construir qualquer coisa em cima.**

---

## Row Level Security

Ligue RLS em todas as tabelas na primeira migration, não depois.

- `dono` enxerga tudo.
- `operador` enxerga os canais em que é operador, e as ofertas, publicações e cliques desses canais.
- `parceiro` enxerga apenas os próprios canais, publicações, conversões e repasses. **Somente leitura.**

Nunca exponha `afiliado_id` de marketplace nem `chave_pix` de outro parceiro em nenhuma policy.

---

## Ordem de criação

As migrations seguem a ordem de dependência: `marketplace` e `comissao_categoria` primeiro, depois `parceiro` e `canal`, depois `produto`, `anuncio` e `preco_ponto`, depois `oferta` e `publicacao`, e por último `clique`, `conversao` e `repasse`.

Na Fase 1 apenas `marketplace`, `produto`, `anuncio` e `preco_ponto` são necessários. Não crie o resto antes da hora.
