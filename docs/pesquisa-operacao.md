# Pesquisa de operação — como se toca um grupo de ofertas de verdade

Pesquisa de 28/07/2026, em blogs, guias e ferramentas do mercado brasileiro de afiliados. A pergunta era: **o que quem faz isso todo dia sabe que nós não sabíamos?**

`docs/mercado.md` olhou concorrência e modelo de negócio. `docs/pesquisa-tecnica.md` olhou stack e política de plataforma. Aqui é o **ofício**: cadência, horário, formato, o que faz o grupo crescer e o que faz ele morrer.

Fontes no fim.

---

## 1. Os números que faltavam

O projeto inteiro foi desenhado sem uma referência de quanto isso rende e em quanto tempo. Agora tem.

### Crescimento de um grupo saudável

| Marco | Membros | Resultado |
|---|---|---|
| 90 dias | 300+ ativos | taxa de clique de **15–25% por post**, comissão a partir de **R$ 800/mês** |
| 12 meses | 800+ | **20–40 vendas/dia** atribuídas, **R$ 5 mil a R$ 15 mil/mês** |

Afiliado Shopee iniciante, nos três primeiros meses: **R$ 200 a R$ 1.500/mês**. Entre seis e doze meses de operação: **R$ 2.000 a R$ 8.000/mês**.

Duas leituras importam:

**A taxa de clique de 15–25% por post é alta**, muito acima de e-mail ou rede social. É o argumento do canal fechado: quem está lá pediu para estar.

**O primeiro dinheiro relevante leva cerca de 90 dias.** Isso bate com a rampa que o roadmap já previa para a série de preço se formar — as duas esperas correm juntas, o que é sorte nossa.

### Comissão por loja

- **Shopee:** 3% a 30%. Beleza e skincare lideram com até 30%; moda feminina 15–25%; casa e decoração 12–20%. Categoria comum fica entre 3% e 15%, passando de 20% em campanha.
- **Mercado Livre:** 4% a 16%.

Isso valida `comissao_categoria` ter vigência: a diferença entre 3% e 30% **dentro da mesma loja** é o que decide se a oferta paga o espaço no canal. Um percentual único por loja seria erro grosseiro.

---

## 2. Cadência — e o número que contradiz o nosso alvo

**5 a 8 ofertas por dia** é o consenso para WhatsApp. Oito é teto, não meta.

E o contraponto, dito com todas as letras: **"postar 30+ ofertas por dia mata o engajamento em uma semana"** — os membros silenciam ou saem.

Isso **parece** contradizer o critério de conclusão da Fase 1 ("a detecção aprova 30 ou mais ofertas por dia"), e não contradiz — mas a confusão é fácil e cara:

> **30 ofertas aprovadas ≠ 30 publicações por canal.**
>
> A aprovação alimenta *todos* os canais elegíveis, cada um com o próprio teto. Trinta ofertas aprovadas com quatro canais de teto 8 são 32 vagas no total, não 30 posts num grupo.

O teto por canal já existe (`canal.teto_diario`, padrão 6) e a tela de aprovação já mostra a capacidade. O desenho está certo; o que falta é a frase acima escrita onde alguém a leia.

---

## 3. Horário — o padrão que sugerimos está errado

Os picos são **07h–09h, 12h–13h e 19h–22h**. Fora deles o engajamento cai bastante.

O `FormularioCanal` sugere `09:00 e 18:00` como exemplo. **As 18h estão fora de todos os três picos** — é o fim da tarde, entre o almoço e a noite, e provavelmente o pior horário do dia útil.

Correção barata e de efeito direto na conversão.

Também vale: **mais de uma publicação por dia ajuda**, porque a pessoa vê a notificação mais de uma vez. Concentrar tudo num disparo é desperdiçar dois dos três picos.

---

## 4. Formato — a imagem não é enfeite

> "Sempre acompanhe os links com foto do produto e preço destacado, pois **links soltos sem contexto visual têm taxa de clique muito mais baixa**."

Eu já sabia que faltava imagem no painel. O que essa pesquisa muda é a natureza do problema: **a foto do produto é item de conversão, não de acabamento.** Ela sobe de prioridade e passa a ter um custo mensurável enquanto não existe.

Vale para a mensagem publicada, não para a tela — mas as duas dependem do mesmo dado, que só chega com a credencial de marketplace.

---

## 5. O que mata o grupo

Cinco causas, em ordem de quanto aparecem:

1. **Ofertas ruins nos primeiros 30 dias.** Destroem a credibilidade antes de ela existir, e credibilidade queimada não volta. É o argumento mais forte a favor de curadoria rígida no começo — exatamente o contrário do instinto de "preciso de volume".
2. **Saturação.** Ver item 2.
3. **Falta de variedade.** *"Repetir cremes faciais quatro vezes seguidas vira ruído — varie cor, marca e faixa de preço."*
4. **Desconto falso, preço inflado.** É a regra 3.4 vista de fora: quem mente sobre preço perde o grupo.
5. **Silêncio.** Grupo parado morre. E membro que manda dúvida no privado e não recebe resposta sai.

**O item 3 é uma lacuna nossa.** A comporta de fadiga bloqueia *produto repetido*, mas nada impede que as oito publicações do dia sejam oito ofertas de eletrônico na mesma faixa de preço. O motor pontua cada oferta isoladamente e a fila as ordena por nota — o que **aumenta** a chance de monotonia, porque ofertas parecidas pontuam parecido.

---

## 6. Crescimento do zero

Sem mistério, e nada disso é software:

- Núcleo inicial de amigos e família
- Divulgação em Instagram, TikTok e Status do WhatsApp — vídeo curto de produto funciona bem
- Troca de divulgação com grupos parceiros
- Cupom exclusivo por indicação ("convide 5 amigos, ganhe cupom VIP")
- Presença em comunidades do nicho, entregando valor antes de divulgar

**Ritual funciona:** um "achado da semana" em horário fixo transforma esperar a oferta em hábito.

**Regras de moderação que aparecem em todo guia:** só admin publica; sem áudio, sem corrente, sem "bom dia"; teto de posts declarado no nome ou na descrição do grupo.

---

## 7. WhatsApp: grupo, canal ou os dois

O modelo de dados só conhece `whatsapp` e `telegram` como plataforma. O mercado usa **três** superfícies:

| Superfície | Limite | Natureza |
|---|---|---|
| Grupo do WhatsApp | 1.024 membros | bidirecional, conversa, alta conversão |
| **Canal do WhatsApp** | sem limite | unidirecional, vitrine, seguidor não vê seguidor |
| Canal do Telegram | sem limite | unidirecional, escala, conversão levemente menor |

> "Para afiliados de achadinhos, a operação mais madura costuma combinar grupos e canais com papéis diferentes."

E a regra prática: **começar no grupo do WhatsApp e migrar para o Telegram ao passar de 500 membros**, porque o grupo trava em 1.024.

O Canal do WhatsApp é o buraco no nosso modelo. Ele não é "grupo grande": muda o fluxo de publicação, e o `wa.me` que usamos hoje serve para grupo, não para canal.

**Não é para construir agora** — é para registrar antes que `plataforma` vire um booleano na cabeça de alguém.

---

## 8. Duas coisas que a pesquisa validou com força

### D-002 — nunca automatizar o WhatsApp

Em 2026 houve **onda de banimento de números comerciais** justamente por automação fora da API oficial. Os sistemas do WhatsApp detectam volume alto em pouco tempo, múltiplos destinatários simultâneos e cliente não oficial.

O detalhe que fecha o argumento: as ferramentas concorrentes vendem **"anti-ban"** como recurso — throttle e intervalo aleatório para "proteger o número". Vender proteção contra banimento é admitir que a prática causa banimento.

A D-002 não é conservadorismo. É a única postura que não terceiriza o risco para o número do parceiro.

### O que os concorrentes fazem que nós não fazemos

Levantado dos comparativos de ferramenta: garimpo por IA, deduplicação por IA, publicação automática de vídeo, espelhamento de canal, carrossel no Instagram, e o tal do anti-ban.

**Nada disso é curadoria.** É distribuição mais rápida do mesmo material. O diferencial declarado deste projeto continua sem concorrente direto — e agora com evidência, não com suposição.

---

## 9. O que muda aqui

| # | Achado | O que fazer |
|---|---|---|
| 1 | Link de afiliado é publicidade e **precisa ser identificado** (CONAR, CDC, e a própria Shopee) | Regra dura nova + `#publi` no modelo + validação na hora de salvar |
| 2 | Falta de variedade mata o grupo, e ordenar por nota piora isso | Diversidade na fila de publicação |
| 3 | Picos são 07–09, 12–13, 19–22; sugerimos 18h | Trocar o padrão e explicar o porquê |
| 4 | Foto do produto é conversão, não acabamento | Sobe de prioridade; depende de credencial |
| 5 | 30 aprovadas ≠ 30 publicadas | Escrever a distinção no roadmap |
| 6 | Canal do WhatsApp é uma terceira superfície | Registrar como pendência, não construir |
| 7 | Referência de receita e prazo | Anotar no roadmap para calibrar expectativa |

O achado 1 merece destaque porque é o único **legal**, e o único em que estávamos claramente errados.

### A identificação publicitária, em detalhe

O CONAR é direto: remuneração por performance não tira a natureza publicitária do conteúdo. Quem usa link rastreável ou cupom comissionado **está fazendo publicidade e precisa identificar**.

A Shopee repete no material dela, para os próprios afiliados:

> "Se o conteúdo gera comissão ou qualquer benefício financeiro, ele deve ser identificado como publicidade."

Detalhes que importam para o nosso modelo de mensagem:

- Expressões aceitas: `#publi`, `#publicidade`, `#parceriapaga`, `#conteúdopago`. **`#ad` não é recomendado** para público brasileiro.
- Precisa estar **visível de imediato** — não escondido no fim, em letra pequena, ou perdido entre hashtags.
- Marcar o perfil da loja **não basta**.
- A Shopee pode pedir ajuste, correção ou **suspensão do conteúdo** de quem não cumpre.

O modelo padrão que criamos não tem nada disso. É o mesmo tipo de risco da regra 3.4 — o que queima o grupo e a conta não é a curadoria, é a desonestidade percebida.

---

## Fontes

- [DivulgaNinja — como criar grupo de ofertas da Shopee](https://www.divulganinja.com.br/blog/como-criar-grupo-de-ofertas-shopee/) — os números de 90 dias e 12 meses, cadência, moderação
- [Shopee — Identificação de conteúdo publicitário: regras do CONAR para afiliados](https://help.shopee.com.br/portal/10/article/196794-Identifica%C3%A7%C3%A3o-de-Conte%C3%BAdo-Publicit%C3%A1rio:-Regras-do-CONAR-para-Afiliados)
- [CONAR — Guia de marketing e publicidade por influenciadores](http://www.conar.org.br/pdf/Guia-de-MKT-e-Publicidade-por-Influenciadores.pdf)
- [DivulgaNinja — automação para afiliados](https://www.divulganinja.com.br/blog/automacao-para-afiliados-no-instagram/) — horários de pico
- [BOTinho — grupo ou canal do WhatsApp para achadinhos](https://espelhagrupos.com.br/blog/grupo-ou-canal-whatsapp-achadinhos)
- [Canaltech — limite de grupos do WhatsApp](https://canaltech.com.br/apps/qual-o-limite-para-grupos-do-whatsapp/)
- [DivulgaNinja — quanto a Shopee paga para afiliados](https://www.divulganinja.com.br/en/blog/quanto-a-shopee-paga-para-afiliados/)
- [Rally de Vendas — comissão do afiliado Shopee](https://rallydevendas.com.br/blog/comissao-afiliado-shopee-quanto-por-cento)
- [AchadinhoPro — grupo VIP de ofertas que vende](https://achadinhopro.com.br/blog/grupo-vip-whatsapp-ofertas) — os erros que matam
- [AchadinhoPro — melhores ferramentas para afiliados Shopee](https://achadinhopro.com.br/blog/melhores-ferramentas-afiliados-shopee-2026) — o que a concorrência entrega
- [SocialHub — onda de banimentos no WhatsApp em 2026](https://www.socialhub.pro/blog/onda-banimentos-whatsapp-2026-apis-nao-oficiais-proteger/)
- [Clint — riscos do WhatsApp não oficial](https://www.clint.digital/blog/riscos-whatsapp-nao-oficial-2026/)
