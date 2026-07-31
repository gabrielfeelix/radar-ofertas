# Roadmap por fases

O projeto avança por fases com critério de conclusão explícito. **Não construa nada de uma fase futura.** Se o usuário pedir, avise de qual fase é e pergunte se ele quer mesmo antecipar.

O motivo é concreto: o desenho original deste sistema tinha oito seções de painel, radar automático, integrações e relatórios. Construir aquilo antes do primeiro clique é decorar apartamento sem parede. A ordem abaixo existe para que o primeiro real entre o mais cedo possível.

---

## Fase 0 — Prova de rastreio

**Nenhuma linha de código de painel.**

O modelo comercial inteiro depende de o subid voltar íntegro no relatório de comissão. Se a venda não puder ser rastreada até o grupo de origem, não existe divisão de receita — existe confiança e planilha, que é o que apodrece parceria.

O que fazer:

1. Criar conta de afiliado no Mercado Livre, na Shopee e na Amazon.
2. Gerar um link de afiliado com subid manual em cada programa.
3. Fazer uma compra real barata por cada link.
4. Esperar o relatório e conferir se o subid aparece, íntegro, ligado ao pedido.
5. Anotar em `docs/decisoes.md` o resultado por marketplace: suporta subid, tamanho máximo, formato aceito, em quantos dias apareceu no relatório.

**Concluída quando:** existe pelo menos um marketplace com subid comprovadamente rastreável de ponta a ponta.

**Se falhar em todos:** pare e reavalie o modelo com o usuário. Não construa o sistema.

Custo: cerca de R$20 e uma semana de espera.

---

## Fase 1 — Radar silencioso e motor de curadoria

Ainda sem canal nenhum. O objetivo é acumular série de preços antes de precisar dela, resolvendo o arranque a frio que quebra os concorrentes — e, agora, encher o catálogo depressa o bastante para sustentar 30 ofertas por dia.

O que construir:

- Migrations de `marketplace`, `produto`, `anuncio` e `preco_ponto`. **Feito.**
- Página de cadastro por link colado. **Feito.**
- Motor de validação: `oferta`, `parametro`, `comissao_categoria`, as duas comportas e a nota. **Feito.**
- Coletor diário de preço, com fontes plugáveis por marketplace. **Feito, esperando credencial.**
- Colheita de canais de terceiros, alimentando o catálogo (D-012).
- Agendamento por GitHub Actions: coleta, detecção de ofertas e expurgo. **Feito.** (Era `pg_cron` neste plano; a D-015 trocou, e a pesquisa de 28/07 confirmou o motivo — projeto pausado pausa `pg_cron` em silêncio.)
- Nada de design elaborado. Uma tabela feia serve.

Meta operacional: **catálogo na casa de alguns milhares de anúncios de pet, coletando preço diariamente**, e a taxa de aprovação da curadoria estabilizada num patamar que sustente 30 ofertas por dia.

**Concluída quando:** a detecção automática aprova 30 ou mais ofertas por dia, por uma semana seguida, sem afrouxar nenhum parâmetro.

> **30 ofertas aprovadas ≠ 30 publicações num grupo.** A confusão é fácil e cara, porque a pesquisa de operação diz o oposto com os mesmos números: *"postar 30+ ofertas por dia mata o engajamento em uma semana"*.
>
> Não há contradição. A aprovação alimenta **todos** os canais elegíveis, e cada um tem o próprio teto — 5 a 8 por dia no WhatsApp é o consenso do mercado. Trinta ofertas aprovadas com quatro canais de teto 8 são 32 vagas somadas, não 30 posts num grupo.
>
> O teto por canal (`canal.teto_diario`) e a capacidade visível na tela de aprovação existem exatamente para essa distinção não depender de ninguém lembrar dela.

Custo: R$0 até o Supabase passar de 500 MB.

O rampe é o que precisa de paciência: o catálogo enche rápido pela colheita, mas cada produto novo só fica validável depois de acumular série. Poucas ofertas na primeira semana, algo em torno de dez a quinze na terceira, trinta a partir da sexta.

Ponto de atenção: acompanhe a **taxa de aprovação** que `detecta_ofertas` devolve. Aprovação perto de zero com catálogo grande significa parâmetro apertado demais; aprovação alta demais significa que a curadoria virou carimbo.

---

## Fase 2 — Primeiro grupo, do próprio dono

### O que esperar de dinheiro, e em quanto tempo

Referência levantada em 28/07 (`docs/pesquisa-operacao.md`), para calibrar expectativa antes de a frustração aparecer:

| Marco | Membros | Resultado |
|---|---|---|
| 90 dias | 300+ ativos | clique de **15–25% por post**, comissão a partir de **R$ 800/mês** |
| 12 meses | 800+ | **20–40 vendas/dia**, **R$ 5 mil a R$ 15 mil/mês** |

Afiliado Shopee iniciante, nos três primeiros meses: **R$ 200 a R$ 1.500/mês**.

**O primeiro dinheiro relevante leva cerca de 90 dias** — e isso corre junto com a rampa da série de preço, não depois dela. As duas esperas se sobrepõem, o que é sorte nossa.

A taxa de clique de 15–25% é muito acima de e-mail ou rede social. É o argumento do canal fechado: quem está lá pediu para estar.

---

O grupo é do dono, com 50 a 100 conhecidos. **Não é para dar lucro.** É para atravessar o ciclo completo uma vez e ter a primeira comissão confirmada na mão, com dado real para negociar com parceiro depois.

O que construir:

- Redirecionador de link em domínio próprio, gravando clique.
- Cálculo da nota da oferta (fórmula em `docs/negocio.md`).
- Fila de publicação com mensagem montada por template. **Sem IA.**
- Botão que abre o WhatsApp com a mensagem pronta, para envio manual.
- Bot de Telegram publicando sozinho pela API oficial.
- Importação manual de relatório de comissão por CSV. **Sem API de marketplace.**

**Concluída quando:** uma comissão confirmada foi rastreada da publicação até o relatório, passando pelo clique.

---

## Fase 3 — Multi-parceiro

Agora o sistema deixa de ser de uso próprio.

O que construir:

- Autenticação com papéis: dono, operador, parceiro.
- RLS completo conforme `docs/dados.md`.
- Canal com parceiro, split e template próprios.
- Painel só-leitura do parceiro, com os estados da comissão separados e data prevista de pagamento.
- Cálculo e registro de repasse.

**Chame um amigo, não três.** O primeiro parceiro serve para descobrir onde o fluxo diário trava.

**Concluída quando:** um parceiro real operou um canal por 30 dias e recebeu um repasse calculado pelo sistema.

Ponto crítico desta fase: **o fluxo diário do operador precisa caber em 10 minutos.** Se for chato, o operador para de postar em três semanas e o canal morre — e o sistema morre junto, por churn de operador, não por falta de oferta. Otimize essa tela acima de qualquer outra.

---

## Fase 4 — Parceria com youtuber

Só depois de ter número real para mostrar.

Chegar num youtuber sem dado é pedir favor. Chegar com "meu grupo de 200 pessoas gerou R$X em 30 dias, com a sua audiência daria Y" é negociar — e a diferença no percentual que se consegue é enorme.

Antes desta fase, prepare: histórico de resultado por canal, receita por 100 membros, e o painel de transparência funcionando de verdade.

---

## Fora de escopo até a Fase 4, sem exceção

Extensão de navegador, IA escrevendo as mensagens, integração com APIs oficiais dos marketplaces, aplicativo mobile, cadastro de membros de grupo, gráfico bonito de histórico de preço, arquitetura multi-workspace de SaaS.

Tudo isso é bom. Nada disso traz a primeira venda.

---

## Expectativa de tempo

Somando construção e ciclo de pagamento dos marketplaces, **o primeiro dinheiro entra na conta por volta do quarto mês.** Se em quatro meses o primeiro grupo não gerou comissão confirmada, o problema não é o sistema — é o nicho, a audiência ou a curadoria. Reavalie antes de construir mais software.
