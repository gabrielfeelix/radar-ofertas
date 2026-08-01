# Pesquisa de campo — como o mercado de canais de promoção funciona por dentro

Rodada de pesquisa de **01/08/2026**. Oito frentes em paralelo, 521 URLs distintas registradas, 2.849 linhas de nota bruta.

Esta pasta é **independente do resto de `docs/`**. Ela não substitui `docs/pesquisa-tecnica.md` nem `docs/pesquisa-operacao.md`, que são de 28/07 e continuam valendo. Onde esta rodada contradiz aquelas, a contradição está anotada explicitamente em `o-que-muda-no-radar.md` — não corrigi os arquivos antigos por conta própria.

## Ordem de leitura

| Arquivo | O que é |
|---|---|
| `sintese.md` | O retrato do mercado que emergiu das oito frentes juntas. Comece aqui. |
| `o-que-muda-no-radar.md` | O que esta pesquisa cobra do projeto: o que valida, o que contradiz, o que vira trabalho. Com o que ficou **em aberto para o dono decidir**. |
| `cupons-de-onde-vem.md` | A resposta à pergunta que originou a pesquisa, com seis hipóteses ordenadas e teste executável para cada uma. |
| `bruto/01` a `bruto/08` | As notas de campo cruas, com URL e citação em cada achado. Consulte quando quiser conferir a fonte de uma afirmação da síntese. |

## As oito frentes

| # | Frente | Fontes |
|---|---|---|
| 01 | Stack de automação: n8n, scripts, bibliotecas, SaaS brasileiro, GitHub | 226 |
| 02 | Descoberta de ofertas: APIs oficiais, feeds, agregadores, erro de preço | 104 |
| 03 | Cupons: de onde sai `FULL3107` | 64 |
| 04 | Relatos de comunidade: fóruns, cursos, depoimentos, fracassos | 42 |
| 05 | Operação diária: cadência, horário, formato, limites de plataforma | 37 |
| 06 | Cena internacional: Slickdeals, Pepper, bots de erro de preço | 70 |
| 07 | Dinheiro: comissão, cookie, prazo, suporte a subid | 39 |
| 08 | Risco: termos literais, banimento, CONAR, LGPD, scraping | 37 |

## Como as fontes estão marcadas

Cada achado nas notas brutas carrega um selo, e ele importa mais do que o normal neste nicho, porque **quase toda a literatura pública sobre canais de promoção é escrita por quem vende a ferramenta**:

- `[OFICIAL]` — documentação, termo de uso ou política da própria empresa. É o que vale.
- `[RELATO]` — depoimento de alguém que executou, ou observação direta de campo.
- `[VENDEDOR]` — quem vende curso ou ferramenta. Viés comercial explícito. Números de receita vindos daqui são propaganda, não estatística.
- `[BLOG]` — conteúdo de SEO, possivelmente reciclado, sem fonte primária.
- `[JURÍDICO]` — decisão, parecer ou posição de autoridade.

## Limitações desta rodada, e elas são reais

Os agentes registraram cada bloqueio em vez de contornar inventando. Vale saber:

- **Reddit não é onde essa conversa acontece em português.** Três frentes tentaram; a busca indexada não devolveu discussão brasileira relevante e a leitura direta foi recusada. A conversa real do nicho no Brasil está em Hardmob, Reclame Aqui, canais públicos de Telegram e blogs de ferramenta.
- **Reclame Aqui, Hardmob, BlackHatWorld e WarriorForum devolveram HTTP 403** para leitura direta na maior parte das tentativas. Onde só o título ficou disponível, isso está dito na nota. No Reclame Aqui o título é a frase literal do reclamante, então ele foi preservado como citação; o corpo não.
- **O orçamento de busca do ambiente (200 chamadas) esgotou** durante a rodada. As frentes 02, 05, 06, 07 e 08 marcaram, cada uma, o que ficou sem cobrir. As lacunas estão listadas ao fim de cada arquivo bruto e consolidadas em `o-que-muda-no-radar.md`.
- **A voz do operador anônimo está sub-representada**, como consequência dos dois pontos acima. Boa parte do que se sabe sobre "como eles fazem" vem de quem vende a solução. Desconte de acordo.

## Duas coisas que conferi eu mesmo, na fonte

Porque eram graves demais para propagar de segunda mão:

1. **A PA-API 5 da Amazon está descontinuada.** A página oficial diz que ela *"is no longer the recommended way to access Amazon's product catalog"*, que a **Creators API** é a sucessora suportada, e que aplicações que continuarem chamando a PA-API 5 recebem `HTTP 403 AccessDeniedException`. Não há data exata publicada na página.
2. **A cláusula de imagem da Amazon, inteira, em português:** *"Você não irá armazenar nem armazenar em cache o Conteúdo de Anúncio de Produtos que consista em uma imagem, mas você poderá salvar um link para o Conteúdo de Anúncio de Produtos que consista em uma imagem por até 24 horas."* Uma das frentes citou só a primeira metade e concluiu que cache de imagem é proibido em absoluto. Não é: **a regra 3.3 do `AGENTS.md` está correta como está** — link sim, por 24h; arquivo nunca.
