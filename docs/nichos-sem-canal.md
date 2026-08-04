# Os nichos sem canal, auditados antes de virarem grupo

Levantado em 04/08/2026, a pedido do dono: *"vc tá categorizando
certinho os produtos como casa, automotivo, esporte, saúde, mercado? pq
vou criar grupo tbm outra hora dessas."*

A resposta curta: **a classificação está certa em quatro dos cinco, e um
deles não pode virar grupo do jeito que está.**

O método foi ler o catálogo de produção agrupado pela categoria externa
que decidiu o nicho, com três títulos de amostra por categoria. Nada
aqui é opinião sobre o mapa: é o que está gravado.

---

## Resumo

| Nicho | Anúncios | Classificação | O que decidir antes de abrir |
|---|---|---|---|
| casa | 2.296 | boa, com uma ressalva grande | 21% é construção e hidráulica |
| automotivo | 551 | **limpa** | são duas audiências: carro e moto |
| esporte | 472 | boa, com uma ressalva | roupa esportiva traz lingerie |
| saúde | 108 | **não abra assim** | 39% é sex shop |
| mercado | 62 | limpa, mas pequena | volume não sustenta canal hoje |

---

## casa — 2.296 anúncios, 90 categorias

As sete maiores categorias são o que qualquer pessoa chamaria de casa:
iluminação, cozinha, móveis, decoração, mesa posta, banheiro,
eletrodoméstico de cozinha.

**A ressalva, e ela é 21% do nicho:** `SHOPEE-100715  Home & Living >
Tools & Home Improvement` tem **472 anúncios**, e a amostra é isto:

```
(5 Peças) Fixadores TPP (DM1, DM2, DM3, DN4) Para Acessório
Kit Com 10 Luva Esgoto 75mm 646 Krona
Torneira Cozinha Gourmet Inox 304 Monocomando Com Duo Spray
```

Luva de esgoto e fixador não são "casa" para quem entra num canal de
casa: são material de construção. É o mesmo defeito que a leitura do
Geek achou, onde instrumento musical caiu como geek.

**Duas saídas, e é decisão editorial:**

1. Separar `SHOPEE-100715` para o nicho `ferramenta`, que já existe e
   tem 71 anúncios. O canal de casa fica com 1.824 anúncios limpos.
2. Deixar como está e aceitar que um em cada cinco posts é material de
   construção.

A torneira, note, é caso de fronteira legítimo: ela é das duas coisas.

---

## automotivo — 551 anúncios, 25 categorias

**A mais limpa das cinco.** Peça de moto, peça de carro, acessório
interno, pneu e roda, cuidado veicular, ferramenta veicular. Nenhuma
amostra fora do lugar.

**O que decidir não é classificação, é audiência:** 242 dos 551 anúncios
(44%) são de **moto**, e os outros de carro. Quem quer escapamento de
Titan não quer palheta de limpador de Strada.

```
187  Spare Parts for Motorcycles      Escapamento Fortuna Titan, retrovisor Z400
156  Spare Parts for Automobiles      Palheta Strada, bobina de ignição Azera
 55  Accessories for Motorcycles      Baú 45 litros, suporte de bagageiro
```

Se abrir um canal só, o filtro de atributo do canal (`canal_atributo`,
D-042) é o mecanismo que separa os dois depois, do mesmo jeito que
separa perfume masculino de feminino.

---

## esporte — 472 anúncios, 60 categorias

O grosso está certo: equipamento de esporte e recreação (212), calçado
esportivo (27), acessórios (23), mais bola, patins e bicicleta vindos do
Mercado Livre com domínio próprio.

**A ressalva:** `SHOPEE-100727  Sports & Outdoor Apparels` tem 83
anúncios e a amostra traz isto:

```
Camisa Ciclismo Masculina TR4 Premium Black MTB      ← esporte
Z&D Lingerie Sungas Masculinas Cuecas Cavadas        ← moda
Z&D Lingerie Sutiã Top Casual Com Bojo               ← moda
```

Uma loja de lingerie cadastrou o catálogo dela em "roupa esportiva". Não
é erro do nosso mapa: é erro da loja, e nenhum mapa de categoria
conserta isso. Se o canal de esporte nascer, esta categoria pede
vigilância ou uma regra de título, no molde de `lib/uso-do-produto.ts`.

**E vale lembrar a decisão do dono de 04/08:** esporte **não** entra no
canal Fitness. Fitness é whey, suplemento e halteres.

---

## saúde — 108 anúncios, 10 categorias

**Este não pode virar grupo do jeito que está.**

```
42  SHOPEE-100020  Health > Sexual Wellness      ← 39% do nicho
25  SHOPEE-100019  Health > Personal Care
19  SHOPEE-100018  Health > Medical Supplies
 9  MLB-PERSONAL_LUBRICANTS_AND_GELS
 5  MLB-ADULT_DIAPERS
```

Quatro em cada dez anúncios do nicho `saude` são de sex shop, com
títulos explícitos. Somando os lubrificantes do Mercado Livre, são 51 de
108 — **quase metade**.

Isso não é erro de classificação: a Shopee põe mesmo em "Health", e nós
seguimos a Shopee. É um problema de canal, e de três tipos ao mesmo
tempo:

- **editorial** — canal de saúde que publica consolo perde o resto da
  audiência no primeiro post
- **de plataforma** — conteúdo adulto tem regra própria no Telegram, e
  canal marcado como sensível some da busca
- **de programa de afiliado** — vale conferir o que a Shopee e o Mercado
  Livre dizem sobre divulgar essa categoria antes de publicar uma linha

**O que fazer antes de abrir:** decidir se `Health > Sexual Wellness` e
`MLB-PERSONAL_LUBRICANTS_AND_GELS` saem do nicho `saude` (mapeados para
nicho próprio, ou para nicho nulo, que é o "olhamos e decidimos que não
roteia" já usado em Watches e Travel & Luggage). Sobrando 57 anúncios, o
canal fica pequeno demais para nascer.

---

## mercado — 62 anúncios, 18 categorias

Bebida, salgadinho, tempero, cereal. Classificação certa, e o problema é
outro: **62 anúncios não sustentam um canal.** No feed do dia havia 215
candidatos de mercado, então o teto é baixo mesmo.

Vale como categoria secundária dentro de outro canal, não como canal.

---

## O que isto mudou na coleta

Nada, de propósito. A D-066 fez a cota diária ir primeiro para nicho que
**tem** canal, e a sobra continua indo para estes cinco — que é o que
mantém o catálogo deles vivo até o dia em que o grupo abrir.

No dia em que um canal for cadastrado, o nicho dele entra na fila da
frente **na coleta seguinte**, sem ninguém publicar versão.
