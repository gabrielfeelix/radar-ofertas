# Revisão do fluxo, e por que o canal não acha o mais barato

15/08/2026. Duas perguntas do dono, medidas contra o banco de produção:

1. *"Está organizado como uma linha de produção, ou está tudo meio junto?"*
2. *"Muitas vezes tem o mesmo produto bem mais barato. A gente não achou o
   mais barato, a gente só achou um produto com a comissão."*

A resposta curta da primeira é **sim, a linha existe e é bem separada**. A da
segunda é que **o sistema já foi construído para resolver isso e três defeitos
o impedem**, e os três são medíveis.

---

## Parte 1: a linha de produção que existe hoje

São oito etapas, e cada uma tem dono, entrada e saída definidos. Isto é o
chassi e as rodas na ordem certa.

| # | Etapa | Onde mora | Entrada → saída |
|---|---|---|---|
| 1 | **Coleta** | `coleta-mercado-livre.mjs`, `coleta-shopee.mjs`, Edge `coleta-diaria` | marketplace → `anuncio` + `registra_preco` |
| 2 | **Identidade** | `lib/identidade.ts` → `produto.chave_identidade` | vários `anuncio` → um `produto` |
| 3 | **Detecção** | `detecta_quedas`, `detecta_declarados` (banco) | preço → `oferta` |
| 4 | **Curadoria** | `avalia_anuncios` (banco) | `oferta` → nota e veredito |
| 5 | **Distribuição** | `lib/variedade.ts`, `lib/distribuicao.ts` | oferta aprovada → fila do canal |
| 6 | **Prateleira** | `melhor_anuncio_do_produto` (banco) | produto → o anúncio mais barato |
| 7 | **Mensagem** | `lib/mensagem.ts`, `lib/gancho.ts`, `lib/modelo.ts` | oferta → texto |
| 8 | **Ritmo e envio** | `lib/ritmo.ts`, `lib/telegram.ts`, `lib/whatsapp.ts` | texto → grupo |

**O que está bem resolvido, e vale dizer porque o medo era o contrário:**

- **A curadoria mora num lugar só**, em `avalia_anuncios`, no banco. Nenhuma
  tela e nenhum script recalculam a regra. É a decisão mais importante da
  arquitetura e ela está mantida.
- **As etapas se comunicam por tabela, não por chamada.** Dá para parar,
  reiniciar ou trocar qualquer uma sem tocar nas vizinhas. É literalmente a
  linha de montagem que o dono descreveu.
- **A trava do banco** (`toma_trava`) deixa o publicador rodar de três
  lugares sem publicar duas vezes.

### As três costuras que estão embaladas, e uma delas dói

**1. A etapa 6 acontece depois da 4, e por isso a 4 roda duas vezes.**

`avalia_anuncios` julga o anúncio da oferta. Depois, na hora de publicar,
`melhorPrateleira` troca por outro anúncio do mesmo produto, **que nunca
passou pela curadoria**. O código sabe disso e remenda, em
`scripts/publica-automatico.mjs:1131`: quando a prateleira troca, ele chama
`reprova()` de novo, em JavaScript, refazendo à mão parte do que o banco já
faz.

Isso é o oposto de "a regra mora num lugar só", e é a única violação real
desse princípio no sistema. **A ordem certa seria escolher a prateleira antes
de avaliar**, e aí a curadoria julga quem de fato vai ao ar, uma vez só.

**2. Duas versões vivas de `canal_aceita_atributos`.** A de dois argumentos
ignora todo filtro com escopo de nicho, sem erro nenhum. Já está no
`AGENTS.md` e continua de pé.

**3. `lib/modelo.ts` guarda uma cópia do texto que está no banco.** Ela já
divergiu uma vez, em 10/08, e uma linha morta voltou ao ar por causa disso.

---

## Parte 2: por que o canal não acha o mais barato

O sistema **já foi construído para isso**, em 01/08, depois de publicar uma
ração a R$ 130 que estava a R$ 119,90 na prateleira ao lado. Existe
`chave_identidade`, existe `melhor_anuncio_do_produto`, e existe até uma view
(`economia_por_identidade`) para provar que valeu a pena.

Só que ele quase não roda. Três defeitos, medidos hoje.

### Defeito 1: nenhum produto cruza marketplace. Nenhum.

Varredura completa dos anúncios ativos:

| Medida | Valor |
|---|---|
| Produtos com anúncio ativo | 7.938 |
| **Produtos presentes em mais de um marketplace** | **0** |
| Anúncios do Mercado Livre | 12.057 |
| Anúncios da Shopee | 27.977 |
| Anúncios da Amazon | 319 |

A Shopee é **69% do catálogo** e vive num universo paralelo. Quando o dono
abre a Shopee e acha o mesmo lápis de olho mais barato, o sistema não estava
"escolhendo errado": ele nunca teve os dois lado a lado.

A causa é de desenho: a identidade é montada a partir dos **atributos
estruturados do Mercado Livre**, e a coleta da Shopee vem de um CSV de feed,
que não traz atributo nenhum. Sem denominador comum, não há o que casar.

### Defeito 2: a trava contra "unidade versus kit" nunca funcionou

`lib/identidade.ts` lista `PACKAGE_UNITS` entre os atributos que compõem a
identidade. Numa amostra de 1.000 produtos com atributos:

| Atributo na nossa lista | Vezes que aparece no catálogo |
|---|---|
| `PACKAGE_UNITS` | **0** |
| `VOLUME` | **0** |

E o que o Mercado Livre usa de verdade:

| Atributo real | Vezes |
|---|---|
| `UNITS_PER_PACK` | 372 |
| `UNITS_PER_PACKAGE` | 128 |

**Os dois ids estão errados.** É exatamente a armadilha que o `AGENTS.md`
documenta para domínios (*"Não adivinhe nome de domínio do ML"*), acontecendo
de novo com atributo. E o efeito aparece na `economia_por_identidade`: de 681
identidades com mais de um catálogo, **47 (6%) têm o menor preço abaixo de 30%
do maior**, que é a assinatura de produtos fundidos por engano.

| Produto | Menor | Maior |
|---|---|---|
| Ração Úmida Friskies Cordeiro | R$ 2,49 | R$ 82,00 |
| Lâmpada Bulbo Led 9w E27 | R$ 2,99 | R$ 78,90 |
| Kit 5 Lâmpadas Led 70w | R$ 23,90 | R$ 525,87 |
| Máquina de Lavar 15kg Electrolux | R$ 60,00 | R$ 2.099,00 |

Sachê contra caixa, lâmpada contra kit. O último é pior: R$ 60 numa máquina de
lavar é um anúncio que não é o produto, de um vendedor pessoa física.

**E isso corrompe a escolha.** `melhor_anuncio_do_produto` ancora no `min()` e
aceita até 5% acima dele. Um outlier envenena o piso inteiro.

*O que segura hoje:* o publicador exige que a prateleira nova tenha lastro
(`preco_original` maior) e refaz as comportas. Foi isso que impediu o
prejuízo até agora. É uma rede, não uma solução.

### Defeito 3: 76% dos produtos não têm identidade

| Medida | Valor |
|---|---|
| Produtos | 42.269 |
| Com `chave_identidade` | 10.063 (24%) |

Três em cada quatro produtos não participam de comparação nenhuma, porque a
chave só é montada quando os atributos vêm do ML.

---

## Parte 3: os caminhos, e o que eu recomendo

### O que eu descartaria

**GTIN/EAN como chave canônica.** É o caminho tecnicamente correto: o código
de barras é o mesmo produto em qualquer loja do mundo, e o Mercado Livre tem
o atributo. Mas: ele não aparece em nenhum dos 1.000 produtos que varri, a
Shopee não publica GTIN no feed, e o preenchimento depende do vendedor. É
para **verificar com o token da API de itens**, não para apostar. Se o ML
entregar GTIN em parte relevante do catálogo, ele vira a primeira escolha.

**Casar por embedding ou IA sobre o título.** Resolve o caso difícil e traz o
risco caro na direção errada: fundir dois produtos parecidos faz o canal
anunciar o preço de um mostrando a foto do outro. O próprio
`lib/identidade.ts` escolheu errar para o lado de não fundir, e essa escolha
está certa. IA aqui inverteria isso.

### O que eu faria, nesta ordem

**Primeiro, consertar o que já existe.** É barato e o ganho é imediato:

1. Trocar `PACKAGE_UNITS` por `UNITS_PER_PACK` e `UNITS_PER_PACKAGE`, e
   `VOLUME` por `UNIT_VOLUME`. Uma linha, e ela desliga a fusão sachê/caixa.
2. Pôr uma **trava de outlier** em `melhor_anuncio_do_produto`: descartar do
   piso o anúncio que estiver abaixo de uma fração do mediano do grupo. Hoje
   o mínimo manda sozinho.
3. ~~Rodar a identidade sobre os 32 mil produtos que não têm chave.~~
   **Riscado na mesma tarde, e o motivo interessa.** Olhando só os
   anúncios ATIVOS sem identidade, eles são 5.714 da Shopee, 170 da
   Amazon e **116 do Mercado Livre**. Ou seja: o ML já está praticamente
   todo indexado, e os 32 mil são produtos velhos e inativos. Rodar a
   identidade neles não produziria comparação nenhuma, porque a Shopee
   não tem atributo para compor chave. **O trabalho real é dar atributo
   à Shopee** (a Open API, aprovada em 03/08, entrega o que o feed CSV
   não entrega), e aí a identidade passa a funcionar sozinha do outro
   lado. Isso é o item que destrava o cross-marketplace, e não a
   varredura.

**Depois, o cross-marketplace, e o caminho mais honesto é a busca ativa.**

Em vez de tentar casar 40 mil anúncios de catálogos que não conversam, inverter
a pergunta: **para cada oferta que já passou na curadoria, procurar aquele
produto nos outros marketplaces antes de publicar.** São dezenas de consultas
por dia, não milhares.

Isso cabe porque as duas portas existem e já estão pagas: a API de busca do
Mercado Livre e a Open API da Shopee, aprovada em 03/08. A consulta é o título
curto (que agora existe, de `lib/titulo-curto.ts`) mais a marca, e o resultado
só é aceito se marca e quantidade baterem, que é a mesma disciplina da
identidade de hoje.

O que se ganha é o que o dono descreveu: **antes de publicar, o sistema olha
se tem mais barato do outro lado da rua.** E o que se ganha de brinde é a
resposta honesta quando não tem: o post passa a poder dizer que conferimos.

### A medição, feita em 15/08, e ela corrige a recomendação acima

`scripts/mede-preco-cruzado.mjs` compara ofertas de beleza aprovadas do
Mercado Livre contra o catálogo da Shopee que **já está no nosso banco**.
Não precisou de API: os 27.977 anúncios estavam lá, o que nunca aconteceu
foi compará-los.

Sobre 60 ofertas, com casamento por marca, proporção de palavras e
quantidades idênticas:

| Medida | Valor |
|---|---|
| Ofertas lidas | 60 |
| Com par plausível na Shopee | 22 |
| Em que a Shopee estava mais barata | 14 (64% das comparáveis) |

**E o número não vale, e o motivo é o achado que importa.** Conferindo os
14 pares à mão:

| Nossa oferta | Par que o script achou | Real? |
|---|---|---|
| Secador Taiff Style 2000w | Secador Taiff Style Profissional | **sim** |
| Chapinha Lizze Extreme | Chapinha Titanium Care Lena | não, outra marca |
| Aparador Mondial Supergroom BG-10 | Aparador Mondial Classic TR-01 | não, outro modelo |
| Taiff Curves 25mm | MAIMEITE Modelador "Taiff Curves" | não, marca chinesa usando o nome |
| Kit Brae Stages 3 itens | Brae Stages leave-in avulso | não, kit contra unidade |

A primeira versão do script era pior e **eu quase reportei o número dela**:
ela dava 71% casando *"Protetor solar Sallve 90FPS"* com *"Arroz Prego
Quadro Óculos"*, e o comentário que eu mesmo escrevi afirmava que aquilo
era um piso conservador. Não era: era ruído. Ficou registrado no cabeçalho
do script.

**O que isso muda, e é uma correção do que recomendei acima:** casar
produto por TÍTULO não é confiável o suficiente para automatizar. Os dois
erros que sobram depois de todo aperto são os caros:

- **modelo diferente da mesma marca** (Supergroom BG-10 contra Classic TR-01)
- **oportunista usando o nome alheio** (a MAIMEITE vendendo "Modelador Taiff Curves")

Publicar qualquer um dos dois como "achamos mais barato" é pior do que não
comparar: o canal manda a pessoa comprar outra coisa.

**Então a busca ativa continua sendo o caminho, com uma trava a mais:** o
par só vale se **marca e modelo** baterem, e modelo é código
(`BG-10`, `TR-01`, `KM-TX1`), não palavra. Quando o título não tem código,
a comparação não acontece, e não acontecer é o desfecho certo.

**O número honesto ainda não existe.** Dos 60, um par confirmado à mão. A
amostra precisa ser maior e a conferência precisa ser humana, e é trabalho
do dono ou de quem operar: rodar `pnpm tsx scripts/mede-preco-cruzado.mjs 200`,
olhar a lista e riscar os falsos. **Nenhum código de cross-marketplace
merece ser escrito antes disso.**

---

## Ceticismo, como pedido

A pesquisa externa confirmou que o Mercado Livre expõe GTIN como atributo, com
EAN, UPC e ISBN dentro dele, e que em algumas categorias ele é obrigatório.
Isso é a documentação deles dizendo o que o sistema aceita, **não uma medida
do que o catálogo tem** — e no nosso catálogo, GTIN não apareceu nenhuma vez.
A doc está certa e não responde à nossa pergunta. Vale um teste com o token de
itens antes de qualquer decisão.

Fontes:
[Identificadores de produtos](https://developers.mercadolivre.com.br/pt_br/identificadores-de-produtos),
[O que é um atributo](https://developers.mercadolivre.com.br/en_us/attributes),
[Códigos universais de produto](https://vendedores.mercadolivre.com.br/nota/tudo-o-que-voce-precisa-saber-sobre-os-codigos-universais-de-produto).
