# Modelo de dados

Postgres 17 via Supabase. Convenções: `snake_case`, português, tabela no singular, `id` e `criado_em` em toda tabela, RLS ligada desde a primeira migration.

**Dinheiro sempre `INTEGER` de centavos** (D-005). A conversão para reais acontece só na exibição.

**Datas sempre `timestamptz` em UTC.** Exibição em `America/Sao_Paulo`. A função `hoje()` devolve a data no fuso da operação — "hoje" é o dia de quem opera, não o dia UTC.

---

## A separação central

Quatro conceitos que costumam virar uma tabela só e depois viram um inferno:

- **produto** — a identidade da coisa
- **anuncio** — essa coisa numa loja específica. O mesmo tapete na Shopee, no Mercado Livre e na Amazon é **um** produto com **três** anúncios, três preços e três séries
- **oferta** — um anúncio que ficou barato agora, já validado
- **publicacao** — uma oferta enviada para um canal. É o que gera link, clique e comissão *(Fase 2)*

Sem essa separação, o mesmo produto em três lojas vira três produtos duplicados e a nota fica impossível de calcular.

---

## As doze migrations

| # | Arquivo | O que traz |
|---|---|---|
| 01 | `fundacao` | `operacao`, utilitários, e o padrão de permissão fechado |
| 02 | `usuario_e_papeis` | `usuario` e as funções de contexto do RLS |
| 03 | `nicho` | O eixo de roteamento |
| 04 | `marketplace` | Lojas e comissão por nicho |
| 05 | `parametros` | Limiares, com herança por nicho |
| 06 | `produto_anuncio_preco` | O catálogo e a série |
| 07 | `parceiro_e_canal` | Quem traz audiência e onde se publica |
| 08 | `colheita` | Fontes de descoberta e menções |
| 09 | `oferta_e_motor` | A curadoria |
| 10 | `execucao_rotina` | O que permite ver falha silenciosa |
| 11 | `rls` | Todas as policies, num arquivo só |
| 12 | `permissoes` | Grants, inclusive os de coluna |

---

## operacao — a coluna que não dá para adicionar depois

Toda tabela carrega `operacao_id`, e todo RLS passa por ela. Existe **uma** linha, e nada na interface menciona a palavra.

É a única decisão do projeto cara de retroagir: login, telas e nichos entram depois sem dor, mas separação por operação toca toda tabela, toda policy e toda consulta. Fazer depois é reescrever o banco **com a série histórica dentro** — e a série não se refaz, porque preço de terça passada não existe mais em lugar nenhum.

Isto não é escopo de SaaS: sem cadastro público, sem plano, sem cobrança. É deixar de fechar uma porta.

---

## Tabelas

### usuario
`id` (referencia `auth.users`), `operacao_id`, `nome`, `email`, **`papeis text[]`**, `parceiro_id`, `ativo`

**Papel é lista, não valor único.** `canal` guarda `split_audiencia_pct` e `split_operacao_pct` separados justamente porque a mesma pessoa pode trazer a audiência **e** operar — o arranjo mais provável entre amigos. Com papel único ela perderia o extrato ou perderia a fila, e nenhuma das duas daria erro: ela simplesmente não veria metade do que deveria.

### nicho
`id`, `operacao_id`, `nome`, `slug`, `ativo`

Produto tem um; canal aceita vários (D-019). É o roteamento **e** o nível onde os limiares são sobrescritos.

### marketplace
`id`, `operacao_id`, `slug`, `nome`, `afiliado_id`, `comissao_padrao_pct`, `suporta_subid`, `subid_tamanho_max`, `cache_preco_max_horas`, `base_de_historico`, `cor_texto`, `cor_fundo`, `ativo`

`comissao_padrao_pct` é **nulo quando não configurado**, e isso é diferente de zero: zero silencioso reprovaria todas as ofertas da loja por "comissão baixa", que é diagnóstico errado para um problema de configuração.

`afiliado_id` **não é concedido ao navegador** — permissão de coluna, migration 12. Quem precisa lê por `afiliado_id_do_marketplace()`, que confere o papel.

### comissao_categoria
`id`, `operacao_id`, `marketplace_id`, **`nicho_id`**, `percentual`, `vigente_desde`, `vigente_ate`

Chaveada por nicho, não por texto livre. A primeira modelagem usava `categoria text`, e o teste mostrou o efeito na hora: ninguém preenche texto livre, nenhuma linha casa, a comissão vira zero e **toda** oferta é reprovada.

### parametro
`id`, `operacao_id`, `chave`, `nicho_id` (nulo = global), `valor`, `descricao`

Linha sem nicho é o padrão; com nicho, sobrescreve (D-023). Lido por `parametro(chave, nicho)`, que cai no global quando não há sobrescrita. A view `limiar` entrega tudo pivotado, porque o motor lê como tabela, não como função escalar.

**Os dois números de série são distintos, e a distinção importa:**

| Chave | Padrão | O que trava |
|---|---|---|
| `dias_minimos_de_serie` | 7 | Abaixo disso não dá para **avaliar** |
| `dias_para_afirmar` | 14 | Abaixo disso não dá para **afirmar** mínimo histórico |

Entre 7 e 14 a oferta existe, mas a mensagem usa a redação honesta com a data de início da observação (regra 3.4).

### produto
`id`, `operacao_id`, `nicho_id`, `titulo_canonico`, `categoria`, `imagem_url`

`nicho_id` nulo é estado real: a colheita traz volume e nem todo canal lido tem nicho. Produto sem nicho não é roteado — é a fila da triagem em lote.

### anuncio
`id`, `operacao_id`, `produto_id`, `marketplace_id`, `url_original`, `sku_externo`, `vendedor`, `avaliacao`, `avaliacao_qtd`, `reputacao_vendedor`, `loja_oficial`, `vendas_estimadas`, `ativo`, `ultima_coleta_em`

Índice único em (`marketplace_id`, `sku_externo`). Sem ele, o mesmo link colado à mão e depois colhido de um canal cria dois anúncios e parte a série em duas, em silêncio.

**`avaliacao` e `reputacao_vendedor` são sinais diferentes**, de propósito separados: produto ruim de vendedor bom e produto bom de vendedor ruim pedem decisões distintas. A tela pode juntar; o limiar não.

### preco_ponto
`id`, `anuncio_id`, `preco_centavos`, `disponivel`, `coletado_em`, `dia_local`

A tabela que mais cresce. **187 bytes por ponto**, medido com índices.

Duas regras vivem no banco, não no coletor: um ponto por anúncio por dia mantendo o menor (índice único + `registra_preco`), e expurgo pelo teto de retenção da loja.

`compacta_serie_antiga()` guarda um ponto por dia nos últimos 120 e **um por semana** antes disso, sempre o menor da semana. Sem isso, dez mil anúncios estouram os 500 MB do plano gratuito em oito meses.

### parceiro
`id`, `operacao_id`, `nome`, `contato`, `chave_pix`, `tipo`, `ativo`

`chave_pix` **não é concedida ao navegador** — mesma proteção de coluna do `afiliado_id`. RLS filtra linha; a linha do parceiro é legitimamente visível para ele. O que não pode é a chave de **outro** aparecer numa listagem por acidente.

### canal e canal_nicho
`canal`: `id`, `operacao_id`, `parceiro_id`, `nome`, `plataforma`, `telegram_chat_id`, `membros_estimados`, **`posts_por_dia_max`**, `horarios_permitidos`, `split_audiencia_pct`, `split_operacao_pct`, `operador_id`, `ativo`

`posts_por_dia_max` é o **orçamento do dia**. Aprovar 30 ofertas em 3 canais gera 90 publicações contra a soma dos tetos — e sem esse número visível na aprovação, o dono aprova de graça e descobre o custo depois.

### fonte_descoberta e mencao
Colheita (D-012). A fonte tem `nicho_id`, e **o produto colhido herda esse nicho** — sem isso a colheita produz milhares de produtos não roteáveis.

`mencao.preco_alegado_centavos` é alegação de terceiro e **nunca entra em `preco_ponto`**. Serve para comparar com o que nós coletamos: é assim que se descobre canal que mente.

### oferta
`id`, `operacao_id`, `anuncio_id`, `preco_atual_centavos`, `preco_referencia_centavos`, `referencia_janela_dias`, `dias_de_serie`, `desconto_pct`, `comissao_estimada_centavos`, **`pode_afirmar_minimo`**, `nota`, `nota_desconto`, `nota_comissao`, `nota_vendedor`, `status`, **`motivo_rejeicao`**, `adiamentos`, `decidida_em`, `decidida_por`

Status: `nova` · `aprovada` · `rejeitada` · **`adiada`** · `expirada`.

`motivo_rejeicao` é obrigatório ao rejeitar, por *constraint*: é a matéria-prima da calibragem.

**A nota vai de 0 a 100, cheios:** desconto 50 (teto em 40% de queda) · comissão 30 (teto em R$ 10) · vendedor 20. Fadiga não gasta ponto de propósito — ela já é comporta. Produto repetido é **bloqueado**, não recebe nota menor: repetição não é oferta pior, é oferta que não deve sair.

### comporta_dia
`operacao_id`, `dia`, `comporta`, `reprovados`

Responde qual comporta está matando tudo. É contador, e não uma linha por anúncio avaliado: três mil anúncios por dia dariam mais de um milhão de linhas por ano para responder uma pergunta agregada.

### execucao_rotina
`id`, `operacao_id`, `tarefa`, `iniciada_em`, `terminada_em`, `sucesso`, `resumo` (jsonb), `erro`

Sem esta tabela, "a coleta parou há cinco dias" é impossível de mostrar — o resumo ia para o log do agendador e sumia. E buraco de série não se recupera.

---

## O motor

| Função | O que faz |
|---|---|
| `avalia_anuncios(ids?)` | **A regra.** Sem lista, o catálogo elegível; com lista, os ids dados |
| `avalia_anuncio(id)` | Casca fina para a tela. Não repete regra nenhuma |
| `detecta_ofertas()` | Uma passada, um INSERT, e os contadores por comporta |
| `expira_ofertas()` | Mata oferta por prazo ou porque o preço voltou a subir |
| `manutencao_diaria()` | Expurgo, expiração, compactação e detecção, nesta ordem |

**Uma implementação só.** Reescrever a regra em TypeScript para a tela explicar produziria uma tela que explica uma coisa enquanto o sistema faz outra — e a tela seria acreditada.

Medido: **1,4 s para 3.000 anúncios com 600 mil pontos.**

### As comportas

**Pré-condições** — anúncio inativo, loja sem histórico, sem preço coletado, indisponível, preço desatualizado, sem referência.

**Comporta de preço** — série curta · desconto insuficiente contra a **mediana que nós observamos** (nunca o "preço de" da loja) · não é o menor da janela longa · **preço recorrente** (D-024): se o anúncio passou mais que 40% dos dias neste preço, não é oferta — é o preço normal com etiqueta de promoção.

**Comporta de qualidade** — comissão não configurada · comissão baixa · produto mal avaliado (só com amostra suficiente) · vendedor fraco · publicado recentemente.

**Nunca reprova por informação ausente.** Se a loja não informa reputação, o anúncio não é punido — seria descartar anúncio bom por pobreza da API.

A mediana **exclui o dia de hoje**: incluir puxaria a referência para baixo junto com a promoção, e o desconto apareceria menor do que é.

---

## Segurança

**Duas camadas, e elas são diferentes.** RLS decide **quais linhas**; GRANT decide se o papel pode **tocar na tabela**. O Postgres checa o GRANT primeiro — RLS sem grant não protege, só esconde o erro.

O padrão do schema é fechado desde a migration 01: no Postgres, função nasce concedendo `EXECUTE` a PUBLIC, que não é papel — é todo mundo, inclusive `anon`, cuja chave viaja dentro do JavaScript da página. Com o padrão alterado, cada objeto novo nasce fechado e a concessão vira ato explícito. Esquecer significa o servidor não conseguir chamar: falha barulhenta, que é o modo certo de falhar.

| Papel | Enxerga |
|---|---|
| `dono` | Tudo, dentro da própria operação |
| `operador` | Os canais que opera, e o que pertence a eles. Sem nota, sem comissão |
| `parceiro` | Só o que é dele, e só leitura |
| `service_role` | Tudo, ignorando RLS. Só em código de servidor |

`operador` **não escreve em `oferta`**: a D-020 separou aprovar de publicar, e dar escrita ali devolveria a ele um veto de curadoria pela porta dos fundos.

---

## Ordem de criação

As migrations seguem a dependência: operação e utilitários, usuário, nicho, marketplace, parâmetros, catálogo e série, parceiro e canal, colheita, oferta e motor, execução, RLS, permissões.

**Migration aplicada não se altera — crie outra.** A reescrita de 27/07/2026 foi exceção deliberada e aprovada, com o banco vazio e nada publicado. Essa porta fecha quando o projeto Supabase da nuvem existir.
