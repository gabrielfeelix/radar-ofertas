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

## Fase 1 — Radar silencioso

Ainda sem grupo nenhum. O objetivo é acumular série de preços antes de precisar dela, resolvendo o problema de arranque a frio que quebra os concorrentes.

O que construir:

- Projeto Supabase e migrations de `marketplace`, `produto`, `anuncio` e `preco_ponto`.
- Uma página simples com um campo para colar link de produto, que extrai título, preço, imagem e vendedor e cria produto e anúncio.
- Um coletor diário de preço via `pg_cron` chamando uma Edge Function.
- Nada de design elaborado. Uma tabela feia serve.

Meta operacional: **de 150 a 250 anúncios do nicho escolhido, coletando preço diariamente por três semanas.**

**Concluída quando:** existem 150 ou mais anúncios ativos com pelo menos 21 dias de série contínua.

Custo: R$0. Trabalho estimado: 15 horas.

Ponto de atenção: o nicho ainda não foi definido. Ele determina categoria de comissão, ticket médio e que tipo de parceiro faz sentido. Categoria de comissão alta com ticket baixo pode render menos por post que categoria de comissão baixa com ticket alto — faça essa conta com o usuário antes de cadastrar 200 anúncios do nicho errado.

---

## Fase 2 — Primeiro grupo, do próprio dono

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
