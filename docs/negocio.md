# Contexto de negócio

Este documento explica **por que** o sistema é como é. Leia antes de propor mudança de arquitetura.

---

## O modelo

Parceiros trazem audiência (grupos de WhatsApp e canais de Telegram). O dono do projeto fornece o sistema, a curadoria de ofertas e a operação de pagamento. A receita de comissão de afiliado é dividida.

**Todos os links usam um único ID de afiliado: o do dono.** A comissão cai inteira na conta dele, que depois repassa a parte do parceiro. Isso foi decidido conscientemente: dá o dado completo, permite mostrar transparência real e mantém o controle da operação. O custo é que exige confiança do parceiro e repasse manual.

## Divisão de receita por papel

A receita de cada canal é dividida conforme quem entrega o quê:

| Papel | Entrega | Peso |
|---|---|---|
| Audiência | Traz e detém os membros | 45% |
| Operação | Aprova ofertas e publica diariamente | 20% |
| Infra e curadoria | Sistema, coleta, nota, links, reconciliação | 35% |

Arranjos comuns: youtuber que só traz público fica com 45%; amigo que traz o grupo e opera fica com 65%; grupo do próprio dono fica 100%.

**Implicação para o banco:** o canal precisa guardar os percentuais separados (`split_audiencia_pct`, `split_operacao_pct`), não um único número. Arranjos diferentes convivem.

## Os cinco estados de uma comissão

1. **estimada** — calculada na publicação (preço × percentual da categoria). Previsão, não dinheiro.
2. **registrada** — o marketplace reportou o pedido. Ainda pode cancelar.
3. **confirmada** — passou o prazo de devolução e foi validada.
4. **recebida** — o dinheiro caiu na conta do dono.
5. **repassada** — o parceiro foi pago.

**Repasse só sobre `recebida`.** Pagar sobre estimada significa financiar a operação com dinheiro próprio e comer cada cancelamento sozinho.

No painel do parceiro, esses estados aparecem separados. Nunca some estimado com confirmado num número só — é assim que se perde a confiança do parceiro.

## Ciclo de caixa

Dados dos programas, verificados em julho de 2026:

- **Mercado Livre** — comissão validada em até 60 dias após o mês da venda, paga no Mercado Pago a partir de R$30 acumulados. Janela de atribuição do clique: 24 horas.
- **Amazon** — pagamento cerca de 60 dias após o fim do mês da comissão. Mínimo R$30.
- **Shopee** — pessoa física recebe até o dia 10 do mês seguinte via ShopeePay; pessoa jurídica até o dia 30, mediante nota fiscal enviada até o dia 5. Mínimo R$30.

Na prática: uma venda em 10 de março vira dinheiro na conta lá pelo fim de maio no ML e na Amazon. Somando o repasse, o parceiro recebe por volta de 90 dias depois da venda.

**Isso precisa estar visível no painel do parceiro com data prevista.** Parceiro que acha que recebe em 30 dias e recebe em 90 abandona no segundo mês.

## Percentuais de comissão (referência, mudam por campanha)

Mercado Livre, venda direta: beleza e cuidado pessoal, calçados e moda, e esporte na faixa de 16%; acessórios veiculares perto de 8%; smartphones perto de 7%; eletrônicos em geral de 7% a 9%. Venda indireta costuma ser metade.

Esses números mudam com campanha sazonal. O sistema guarda o percentual por categoria numa tabela configurável, nunca hardcoded, e a comissão estimada é sempre marcada como estimativa.

## O que protege o negócio

**O redirecionador roda em domínio próprio.** Todo link publicado em todo grupo passa por ele. Acabou a parceria, os links param. É a alavanca real — o contrato sozinho não protege nada.

**O banco de preços é do dono**, escrito no acordo. É o ativo que se acumula.

**Transparência total** num painel só-leitura para o parceiro. Opacidade é o que faz parceiro querer montar o próprio sistema.

**Teto de concentração:** a partir do quarto canal, nenhum parceiro deve passar de 40% da receita total. Parceiro que concentra dita o split.

## Restrições legais e de plataforma que moldam o produto

**Amazon** — permite cache de preço por no máximo 24 horas e exige que links em mensagem direta sejam solicitados pelo destinatário. Por isso a Amazon não é base de histórico de preço nem base do negócio.

**WhatsApp** — automação não oficial viola os termos e derruba o número. Envio é sempre manual, via link `wa.me`.

**Telegram** — API oficial de bots, canais com assinantes ilimitados. É o canal que escala sem custo humano.

**Fiscal** — há divergência entre fontes sobre se afiliado digital cabe no MEI (o CNAE 7490-1/04, de intermediação de negócios, apareceria fora da lista permitida, empurrando para Microempresa no Simples). O teto do MEI segue em R$81 mil anuais em 2026. **Isso precisa ser confirmado com um contador antes de repassar dinheiro a terceiros.** O agente não deve tratar isso como resolvido.

## A nota da oferta

É o diferencial do produto. Composição sugerida:

- Desconto real contra a mediana observada na janela disponível — peso 40. **Não usar o "preço de" do marketplace**, que é inflado.
- Comissão estimada em reais — peso 25. Desconto de 60% num produto de R$12 não paga o post.
- Qualidade do vendedor e avaliação — peso 15.
- Fadiga do canal (penaliza produto ou categoria publicada recentemente naquele canal) — peso 10.
- Desempenho histórico da categoria naquele canal — peso 10, só começa a valer no segundo mês.

Com menos de 14 dias de série, a nota não fala em desconto histórico. A mensagem usa a redação honesta com a data de início da observação.

## Custos de operação

Construção (meses 1 e 2): Supabase Free em R$0, hospedagem do painel em Cloudflare Pages ou Netlify em R$0, domínio a cerca de R$40 por ano. Perto de zero.

Operação (mês 3 em diante): Supabase Pro a US$25 quando passar de 500 MB ou precisar de backup. Total realista entre R$150 e R$300 por mês.

**Ponto de equilíbrio:** com comissão média de R$5 por venda, são necessárias de 50 a 60 vendas por mês só para pagar a infraestrutura — e a primeira comissão só cai na conta uns 60 dias depois da primeira venda.
