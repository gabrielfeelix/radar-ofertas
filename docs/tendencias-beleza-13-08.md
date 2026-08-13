# O que está em alta em beleza no Brasil, lido em 13/08/2026

Pesquisa pedida pelo dono na noite de 13/08, depois de o revezamento e a
lista de marca boa entrarem:

> *"se coloque no lugar de uma mulher e pesquise na internet. Produtos
> que estão mais falados, achados do momento, coisa que está em alta. Não
> aqueles que influenciador é pago pra falar. Esses produtinhos coreanos.
> E se for algo coreano, é legal a gente destacar que é coreano."*

**O que ela virou:** 27 termos novos de busca em
`scripts/coleta-mercado-livre.mjs`, a família `k-beauty` em
`lib/familia-de-beleza.ts`, e o campo `destaque` em `lib/gancho.ts`.

---

## O critério: formato dura mais que marca

A decisão que organizou o resto. Marca viral morre rápido e o catálogo
do Mercado Livre demora a ter; **formato** dura anos e o catálogo já tem.
Por isso a lista de busca acabou com três blocos, nesta ordem de aposta:

| Bloco | Aposta | Risco |
|---|---|---|
| Formato em alta | lip tint, blush líquido, protetor em bastão | baixo, o catálogo já tem |
| Ingrediente | mucina de caracol, centella, cica | baixo, é como quem não conhece a marca procura |
| Marca | Sheglam, Medicube, TIRTIR | alto, pode não existir no ML ainda |

## 1. K-beauty, e ela é a aposta principal

A imprensa de beleza brasileira trata 2026 como o ano em que a K-beauty
deixou de ser importação de nicho. As marcas citadas como já presentes
aqui: **COSRX** (a mais acessível, foco em pele acneica), **Beauty of
Joseon**, **SKIN1004**, **Medicube**, **Innisfree**, **Abib**, **Round
Lab**, **Anua**.

**A maquiagem coreana era um buraco inteiro nosso.** A lista da manhã só
tinha marca de skincare. As de make citadas: **TIRTIR** (a cushion),
**3CE**, **CLIO**.

**O ingrediente vale mais que a marca na busca**, e é a descoberta
prática da pesquisa: quem não conhece K-beauty não procura "COSRX",
procura "sérum de mucina de caracol". Os três ingredientes que a
cobertura repete são **mucina de caracol**, **centella asiática** e
**própolis**, mais o **adesivo de espinha**, que é achado de menos de
R$ 20 e é exatamente o tipo de compra por impulso que o grupo converte.

## 2. A marca viral brasileira do momento

**Sheglam desembarcou no Brasil em 2026**, com preços a partir de
R$ 29,90, mirando a Geração Z. O produto dela é o **Color Bloom Liquid
Blush**, com mais de 2,5 bilhões de visualizações. É o nome que mais
aparece em conteúdo espontâneo, que é justamente o filtro que o dono
pediu.

**ELF** aparece junto, pelo **Power Grip Primer** e pelo **Halo Glow
Beauty Wand**.

E entre as nacionais que já publicamos, a linha **Lip Juice da Mari
Maria** foi ampliada e é a que a cobertura cita por nome.

## 3. Os formatos que o Brasil está comprando

- **Lip tint e lip stain.** O acabamento natural substituiu o batom
  matte. Some-se a isso o **lip balm com cor** e o **gloss volumoso**.
- **Blush líquido e em bastão.** A técnica de blush puxado até a
  mandíbula é a make mais replicada de 2026, e ela exige produto cremoso
  ou líquido de boa pigmentação.
- **Protetor solar em bastão e com cor.** É o formato que cresce, e a
  cobertura de skincare de 2026 é toda sobre uso diário e barreira
  cutânea, não sobre ácido.
- **Maquiagem que trata.** Base e primer com ácido hialurônico e
  niacinamida. É o cruzamento de skincare com make, e é o que a imprensa
  chama de tendência dominante do ano.

## 4. O que ficou de fora, de propósito

**K-wellness** (suplemento e bebida de beleza) apareceu em alta e não
entrou: é nicho `saude`, não `beleza`, e cairia em canal nenhum.

**Marca de dermocosmético de alto ticket** (Skinceuticals e afins) ficou
de fora da busca porque preço alto sem desconto real não vira post, e o
catálogo já traz La Roche, Vichy e Eucerin pelas buscas genéricas.

---

## O que isso pede da fila, e por que virou código

**K-beauty precisava de família própria.** Dentro de `skincare` ela nunca
ganharia vez: o revezamento dá uma vaga por família por volta, e um COSRX
competindo com 145 séruns brasileiros sai por sorteio. Com família
própria, ele tem a própria vaga. É o mesmo mecanismo que tirou o secador
da monocultura, aplicado ao contrário: em vez de conter quem domina,
garantir espaço a quem nunca aparece.

**"Coreano" precisava ser dito no texto**, e a IA não podia. A instrução
do gancho proíbe inventar característica que o título não garanta, e
nenhum título de COSRX contém a palavra. Quem sabe que a marca é coreana
é a nossa lista. Então o fato passou a ser apurado do nosso lado e
entregue ao modelo como **conferido**, pelo campo `destaque` — mesma
disciplina da regra 3.4 com preço: a IA só afirma o que nós medimos.

Ele entra como **permissão, não ordem**. Mandar dizer "coreano" em todo
post coreano criaria o carimbo que a lista de ganchos recentes existe
para evitar.

---

## Fontes

- [K-Beauty em 2026: marcas coreanas e tendências — Hypnotique](https://hypnotique.com.br/selfcare/k-beauty-em-2026-marcas-coreanas/)
- [Produtos de beleza que bombaram no TikTok e onde comprar mais barato — Lista Secreta](https://listasecreta.com.br/produtos-de-beleza-que-bombaram-no-tiktok-e-onde-comprar-mais-barato-no-brasil/)
- [Sheglam desembarca no Brasil com foco na Gen Z — Consumidor Moderno](https://consumidormoderno.com.br/sheglam-desembarca-brasil-genz/)
- [Sheglam chega ao Brasil com maquiagens virais e preços acessíveis — Estado de Minas](https://www.em.com.br/feminino-e-masculino/2026/05/7419690-sheglam-chega-ao-brasil-com-maquiagens-virais-e-precos-acessiveis.html)
- [Tendências de maquiagem que estão dominando 2026 — Folha Vitória](https://www.folhavitoria.com.br/beleza/tendencias-de-maquiagem-que-estao-dominando-2026-viral/)
- [Tendências de skincare para 2026 — Blog Dermage](https://blog.dermage.com.br/tendencias-de-skincare-para-2026/)
- [Lançamentos de beleza de junho, 2026 — ELLE Brasil](https://elle.com.br/beleza/lancamentos-de-beleza-de-junho-2026)
- [Tendências de beleza para 2026 — Beleza na Web](https://www.belezanaweb.com.br/loucas-por-beleza/tendencias-de-beleza-para-2026/)
