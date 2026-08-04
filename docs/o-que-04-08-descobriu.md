# 04/08/2026, à noite: o que esta sessão descobriu e mudou

Sessão longa, e a maior parte do valor não está no código: está em
**números que ninguém tinha medido**. Este arquivo existe porque metade
das decisões deste projeto foi tomada sobre suposição, e sete delas
caíram hoje quando alguém foi conferir.

Ordem de leitura para quem chega: este arquivo → `docs/handoff.md` →
`docs/decisoes.md` (D-065 a D-068).

---

## 1. O que estava quebrado e ninguém sabia

### A cota diária da coleta ia dois terços para o lixo (D-066)

O coletor da Shopee gravava os 4.000 itens de maior desconto por dia. O
desconto era o único critério. Medido no feed real:

```
110.000 lidos · 20.082 passaram nas comportas
os 4.000 de maior desconto:
  em nicho com canal ........ 1.541  (39%)
  com reputação de vendedor . 3.049  (76%)
  aproveitáveis de fato ..... 1.231  (31%)
```

Enquanto isso o canal de perfume recebia **9 itens por dia** tendo 121
disponíveis, e o de pet recebia 113 tendo 812.

**Depois da correção, medido ao vivo na primeira coleta:**

| Nicho | Entraram numa coleta |
|---|---|
| pet | +284 |
| brinquedo | +219 |
| beleza | +206 |
| suplemento | +197 |
| perfume | +117 |
| geek | +78 |
| games | +72 |
| casa, moda, automotivo, esporte, papelaria, saúde, mercado | 0 |

Os sete nichos sem canal receberem zero é o desenho funcionando: eles só
pegam a sobra, e não sobrou.

### Duas frentes prontas nasceram desligadas em produção (D-067)

O link curto da Shopee e a revalidação de preço usam a mesma
credencial, e **`SHOPEE_APP_ID` e `SHOPEE_APP_SECRET` não existiam como
segredo do repositório**. Não era só o workflow não repassar: os valores
nunca foram cadastrados.

```
publicações da Shopee desde 12h UTC de 04/08:
  link curto  ..  0
  an_redir    .. 85
log do Actions: "Sem SHOPEE_APP_ID/SECRET: os links saem no formato longo"
```

Depois de cadastrar: os posts passaram a sair com
`s.shopee.com.br/3VjCrKZcd6`.

**A lição não é sobre a Shopee:** variável de ambiente que falta não
quebra nada. O código cai para o caminho de reserva, avisa uma vez no
começo da execução, e tudo parece funcionar. Duas frentes ficaram
prontas e inertes por um dia. **Variável nova entra no workflow no mesmo
commit que o código que a lê.**

### A detecção morria aos oito segundos, e derrubava três coisas juntas

Duas coletas horárias falharam em 04/08. As duas morreram **8,32 s e
8,29 s** depois de `detecta_quedas` responder. Oito segundos cravados não
é lentidão nossa, é limite de papel. Lido do banco de produção:

```
authenticator   statement_timeout=8s   ← o papel do PostgREST
authenticated   statement_timeout=8s
anon            statement_timeout=3s
postgres        (sem limite)           ← o da conexão direta
```

O passo roda com `set -e`, então o erro derrubava o job inteiro: **a
colheita de cupom e a reserva do publicador não rodaram nessas horas.**

**O conserto que parecia óbvio não funciona**, e o teste derrubou antes
de subir: `alter function ... set statement_timeout` foi testado contra
Postgres real, em `sql` e em `plpgsql`, e a função morreu igual nos dois.
O cronômetro é armado quando a consulta externa começa, e mudar o valor
no meio não o rearma. Isso virou a migration 63, que existe para
registrar o teste.

O conserto real foi trocar `curl` no PostgREST por `psql` sobre
`SUPABASE_DB_URL`. **E se provou na primeira rodada de verdade:**

```
detecta_declarados: 2.124 ofertas em 82 segundos
```

Oitenta e dois segundos. Pelo caminho antigo essa execução teria morrido.

### A colheita de cupom estava seca havia um dia

`15 canais lidos · 0 cupons distintos`, em toda rodada. O último cupom a
entrar no banco foi às 19h30 de 03/08.

A colheita não estava quebrada: `extraiCupons` só enxergava código com
`DDMM` dentro, que é o cupom de campanha do próprio Mercado Livre e só
existe em dia de campanha. O que os concorrentes publicam todo dia não
tem data: `FASHIONML`, `PIPOCA`, `AMODESCONTO`.

Depois do caminho novo, ancorado no rótulo: **0 → 8 cupons**.

E três falsos positivos apareceram na primeira rodada e viraram guarda.
Um deles é sério: **o cupom da Shopee voltou a ser capturado**, e
repassar cupom de terceiro dela é rescisão de contrato. O filtro de data
o excluía por acidente; agora ele é excluído por regra.

### O mapa de cupom nunca alcançava cupom sem data

A tabela se chama `cupom_prefixo` e a busca era **igualdade exata**.
Funcionava enquanto todo código trazia `DDMM`: o coletor cortava os
quatro dígitos e o resto casava. Sem data, o "prefixo" vira o código
inteiro e nada casa. Oito cupons colhidos, zero publicáveis, e o mapa não
tinha culpa.

### O horário do canal era interface mentindo

`canal.horarios_permitidos` existe desde a migration 6, o formulário de
canal **escreve** nele, o dono preenche na tela, e o publicador nunca
leu.

Os dois caminhos eram ruins sozinhos: só ligar o código derrubaria os
sete canais para três horas por dia (todos com `{7,12,20}`), e só apagar
a coluna quebraria o formulário. Os dois juntos, e nesta ordem: a
migration 65 abriu todos para o dia inteiro **antes** de a leitura
entrar.

### O selo do vendedor era jogado fora na gravação

O Mercado Livre devolve `power_seller_status` (`platinum`, `gold`,
`silver`) e o coletor o colapsava num número de 0 a 1 que fecha com
`Math.min(1, ...)`. Verde comum e verde platinum viravam **o mesmo 1,0**:
dos 3.739 anúncios com reputação, 917 estão em 1,0 e não havia como saber
quais eram platinum.

É a D-047 literal: *"o dado vem na resposta da API, alguém usa para uma
coisa só, e descarta o resto"*.

---

## 2. O que foi medido e mudou uma decisão

### O atributo da Shopee perde do título (D-068)

O handoff dizia que `global_item_attributes` deveria vencer a leitura de
título. Medido nas 10 mil linhas do feed:

```
o título resolve ............ 1.091
  e o atributo está calado ..   888  (81%)
  concordam .................   159
  DISCORDAM .................    44   ← e o título ganha nas 44
```

Nas 44, o atributo diz `Unisex` para título explícito ("Camiseta de
Compressão **Masculina**", "Tênis **Feminino**"). O vendedor preenche por
obrigação e escolhe a opção que dá menos trabalho.

**Item fechado sem código escrito.** Adotar a precedência sugerida
pioraria 44 casos para melhorar nenhum.

### O preço do Pix não existe em API nenhuma nossa

Testado com token real:

```
/items/{id}              →  403 access_denied
/items/{id}/prices       →  403
/items/{id}/sale_price    →  403
products/{id}/items       →  200   ← a rota que a coleta usa
```

A rota que funciona devolve `price`, `original_price`, `deal_ids`, frete,
garantia e vendedor. **Nenhum campo de meio de pagamento.** E a
documentação do ML diz que o `metadata` da promoção só vem para o token
do vendedor do anúncio, que não somos.

O feed da Shopee é igual: `price` e `sale_price`, e nada de Pix.

Então o "15% no Pix" que o concorrente publica não sai de API: é
benefício de checkout, ou ele copia da tela.

### A revalidação de preço da Shopee vale, mas não pelo motivo esperado (D-065)

A fila da Shopee esperava **19,9 horas** na mediana. Amostra aleatória de
120 pendentes, preço do banco contra a API de agora:

```
igual 113 (94%) · subiu 0 · caiu 7
caiu mais de 20%: 2   (maior: R$ 236,90 → R$ 119,90)
```

O item foi proposto como conserto de mentira de preço, e mentira de preço
é rara e pequena. **O ganho real é publicar o preço bom quando ele já
melhorou.**

---

## 3. O que os concorrentes ensinaram, e o que já foi copiado

Leitura de quatro canais por dentro, em `docs/concorrentes-lidos.md`.
Copiado em 04/08:

- **o vendedor descrito**, não só nomeado: `BAGATELLE (+10.000 vendas,
  MercadoLíder Platinum)`. Arredondamento sempre para baixo, porque
  mentira pequena sobre número verificável é a mais cara.
- **o cupom colado no post da oferta**, com três recusas para não
  prometer desconto que falha no carrinho.

Não copiado, de propósito: nenhum dos quatro identifica publicidade, e o
Em Análise publicou um iPhone 128 GB com "de" **maior** que o do 256 GB.

---

## 4. Onde o gargalo está agora

Medido às 20h de 04/08, com o teto ainda em 150:

```
canal                      teto   hoje   fila
Radar Kids                 150    150    232   ← travado no teto
Radar Tech                 150    150    259   ← travado no teto
Radar Beauty               150     57      0
Radar Geek                 150      2      0
Radar Fitness              150      2      0
Radar Perfumes (masc)      150      0      0
Radar Pet                  150      0      0
```

O teto foi para **300** por decisão do dono, e a coleta nova encheu os
cinco de baixo. O gargalo deixou de ser catálogo e voltou a ser
audiência, que é onde a D-056 já dizia que ele estava.

---

## 5. O estado das quatro fontes

| Fonte | Estado | Prova |
|---|---|---|
| Mercado Livre | ✅ | 999 anúncios novos em 24h, 783 preços relidos numa hora |
| Shopee, feed | ✅ | 8.010 anúncios, 3.827 novos em 24h |
| Shopee, Open API | ✅ | link curto no ar; preço revalidado na publicação |
| Colheita de canais | ✅ | 19 fontes ativas, 4 delas concorrentes lidos hoje |
| Amazon | ⚠️ | 99 anúncios, **1 oferta em toda a história** |

---

## 6. A Amazon, e por que ela não publica

Não é falta de código de publicação. Medido:

```
99 anúncios · 1 com preço nosso · 0 com nicho
208 menções colhidas de canais alheios · 206 com preço alegado
marketplace.base_de_historico = false   ← regra 3.3 no banco
```

Três bloqueios em série: sem preço nosso, sem nicho (e sem nicho não há
canal), e sem série a detecção reprova por `loja_sem_historico`.

**Decisão do dono em 04/08:** republicar o preço alegado pelos canais
concorrentes, aceitando furar a regra 3.4, até somar as 10 vendas que
liberam a Creators API. A regra 3.3 continua valendo porque ela protege a
conta, não a estética: **nenhuma série de preço da Amazon é construída**,
e só menção recente vale.

O bloqueio que sobra é o nicho, e o caminho fácil é o errado:
classificar pelo canal que achou é exatamente o que a otimização de
01/08 consertou (*"o nicho vem do `domain_id` do marketplace, não de quem
achou o produto"*). Canal de pet publica coisa que não é pet.

---

## 7. Erros meus nesta sessão, para não se repetirem

1. **Escrevi uma migration que não funciona** e quase a publiquei. A
   folga de `statement_timeout` na função não vence o cronômetro da
   consulta externa. Só não subiu porque o dono mandou testar antes.
2. **Escrevi a consulta da manutenção errada** (`select ... from f() t`
   numa função que devolve `jsonb`). O teste local pegou.
3. **Esperei que o atributo da Shopee fosse melhor que o título** porque
   o handoff dizia. Era o contrário, e o número mostrou.
4. **Não cobrei o item de segurança** durante o dia inteiro. Os dois
   artefatos do backup seguem baixáveis por qualquer conta do GitHub, com
   o cookie da Central e o refresh token do ML dentro. É o único item que
   o handoff marca como urgente.
5. **Mostrei horário em UTC sem dizer**, e o dono leu como Brasília. A
   regra 3.9 existe justamente para isso: gravar em UTC, exibir em São
   Paulo.
