# Plano de execução

Como saímos do estado atual até o primeiro canal publicando. Este documento existe para uma coisa só: **impedir que a gente construa em cascata** — terminar tudo de um jeito, desenhar depois, descobrir que estava errado, voltar.

Revisado em 27/07/2026, depois da revisão de arquitetura da informação, do fluxo diário e dos tokens.

---

## A regra que evita a cascata

**Nenhuma tela é construída com dado falso.**

Se a tela precisa de dado que o banco não tem, ou o banco ganha o dado primeiro, ou a tela sai da fila. Foi assim que descobrimos, antes de escrever uma linha de interface, que:

- a tela "Precisa de atenção" não tem tabela por trás,
- Ajustes → Curadoria promete um número que ninguém grava,
- a fila de aprovação precisa da capacidade dos canais, e canal não existe.

Três telas que teriam sido construídas bonitas e vazias.

### A exceção, aberta em 28/07 (D-026)

A regra continua valendo para **dado que o banco deveria ter e não tem** — foi assim que as três telas acima caíram da fila.

Ela **não** vale para dado que depende de coisa que ninguém controla aqui: credencial de marketplace, domínio, canal com audiência real. Esperar isso para só então descobrir se aprovar e publicar funcionam na mão de uma pessoa custaria semanas de espera para aprender algo que uma simulação ensina hoje.

Então as telas de decisão são construídas **com operação simulada**, em `lib/simulacao/`, e são o que vai à mão de testadores. Três condições, que são o que separa isso de dado falso:

1. **A simulação é um módulo só, e a tela nunca a chama direto** — ela chama uma ação, que hoje mexe na simulação e amanhã escreve no banco.
2. **A tela nunca recalcula regra**, nem quando a regra é de mentira. Nota, motivos e comportas chegam prontos, como chegariam de `avalia_anuncios`.
3. **A faixa "operação simulada" fica visível o tempo todo**, e não some depois de "entendi".

---

## As três trilhas

Correm em paralelo, com ritmos diferentes. Só se cruzam onde está escrito.

| Trilha | Ritmo | Regra |
|---|---|---|
| **Banco e motor** | rápido, sem interface | Só o que já está decidido em `decisoes.md` |
| **Design system** | por demanda | Componente entra quando a primeira tela pedir |
| **Telas** | uma por vez, ponta a ponta | Só com dado real por trás |

---

## Ordem, e por que ela mudou

A ordem intuitiva seria *aprovar → publicar → resto*. Está errada, e por **duas razões independentes**. Elas apontam para o mesmo lugar — as filas vêm depois — mas não são a mesma coisa, e confundi-las faz parecer que uma resolve a outra.

**Canal → filas: capacidade.**

- Aprovar sem canal nenhum é ato sem efeito, silencioso — a aprovação gera uma publicação por canal que aceita o nicho, e não há nenhum.
- O número mais importante da tela de aprovação é a capacidade: *"30 ofertas → 87 publicações → 18 vagas hoje"*. Sem canal esse número não existe, e a tela nasce cega.

**Colheita → filas: volume.**

- A colheita enche o **catálogo**, não a fila. A fila é o que o motor aprova do catálogo, depois que cada anúncio acumulou série.
- Sem catálogo cheio, a tela de aprovação seria testada com três itens — exatamente o erro do protótipo, que foi desenhado para quatro publicações e quebra em trinta.

**Canal não depende de colheita, e colheita não depende de canal.** A ordem 3 → 4 abaixo é conveniência, não dependência: as duas poderiam ser construídas em qualquer ordem, ou em paralelo.

### Ordem definitiva

```
1. Fundação do banco        ── reescrita, banco vazio
2. Motor reconciliado       ── comportas e nota batendo com o design
3. Colheita: tela           ── o subsistema pronto que não tem superfície
4. Canal: o mínimo          ── nicho, plataforma, teto diário
5. Aprovar                  ── decidir da linha, com capacidade visível
6. Publicar                 ── modo foco, Telegram em lote, desfazer
7. Calibragem               ── reprovadas por comporta, rigor da curadoria
8. Trilha de arranque       ── o próximo passo num sistema vazio
```

Dinheiro, Parceiros e Repasses só depois da primeira comissão. Antes disso são telas de dado que não existe.

---

## Trilha 1 — Banco e motor

### 1.1 Fundação (reescreve as migrations existentes)

O banco está vazio, nada publicado, ninguém mais no projeto. Empilhar correção em dez migrations deixaria o schema ilegível para sempre, para economizar um risco que só existe depois que houver produção.

**A porta fechou em 31/07/2026**, quando o Supabase da nuvem subiu com as 15 migrations aplicadas. Vale a regra normal de `AGENTS.md`: migration aplicada não se altera — cria-se outra.

- `operacao_id` em toda tabela, RLS por ela (D-021)
- `nicho` como entidade; `produto.nicho_id`, `canal` aceita vários (D-019)
- `parametro` com nicho opcional, herdando do global (D-023)
- `usuario.papel` deixa de ser valor único — **a mesma pessoa pode trazer a audiência e operar**, e `canal` já tem os dois splits separados justamente por isso. Hoje ela perderia o extrato ou perderia a fila.
- `fonte_descoberta.nicho` vira `nicho_id` — a D-019 matou nicho como texto no resto do sistema e sobreviveu aqui
- `oferta` ganha `motivo_rejeicao` e o status `adiada`
- `execucao_rotina` — nova. Sem ela a tela "Precisa de atenção" não existe, e a falha da coleta continua invisível
- `comporta_dia` — contador diário por comporta. É o que responde "qual limiar está matando tudo". Uma linha por anúncio avaliado daria um milhão de linhas por ano para responder uma pergunta agregada

### 1.2 Motor

- Nota na escala do design: desconto 50 · comissão 30 · vendedor 20 = **100**. Os 20 pontos que eu tinha reservado para fadiga somem, e por um motivo melhor do que parece: **fadiga já é comporta** — produto repetido é bloqueado, não recebe nota menor. Repetição não é oferta pior, é oferta que não deve sair.
- Série mínima **7 dias para avaliar**, 14 para afirmar mínimo histórico. Estavam juntos, e separar ganha uma semana de canal vivo sem afrouxar honestidade nenhuma.
- Comporta nova: **é o menor preço da janela?**
- Comporta nova: **preço recorrente** (D-024). Hoje um produto que passa 25 dias por mês "com desconto" passa por aprovado.
- Reputação do vendedor e nota do produto seguem separadas no banco, juntas na tela: produto ruim de vendedor bom e produto bom de vendedor ruim pedem decisões diferentes.
- A colheita passa a **herdar o nicho da fonte**. Canal de pet só traz produto de pet, então sobra só exceção para triar à mão. Sem isso, a colheita produz milhares de produtos sem nicho que nunca chegam a canal nenhum.

---

## Trilha 2 — Design system

`docs/design.md` e `app/globals.css` já existem: cor, tipografia, espaçamento, raio, sombra, botão.

**Card não entra ainda.** É o componente que mais carrega decisão de produto, e o que a oferta mostra ainda vai mudar. Cada componente novo entra quando a primeira tela pedir, com a forma que a tela pedir.

---

## Trilha 3 — Telas

### Navegação revisada

```
Hoje
├── Aprovar                 [verbo, não "fila de aprovação"]
├── Publicar                [mesma tela do operador, duas abas]
├── Precisa de atenção      [agrega, não lista]
└── Trilha de arranque      [só enquanto a operação estiver incompleta]

Catálogo
├── Produtos                [busca na Fase 1; alterna grão produto/anúncio]
├── Sem classificação       [triagem de nicho em lote]
└── Colheita
    ├── Fontes              [rendimento por canal; preço alegado × observado]
    └── Menções             [pendente, não reconhecido, erro]

Canais → Canal

Dinheiro
├── Conversões
├── Parceiros → extrato     [veio de Canais: parceiro é entidade de dinheiro]
└── Repasses

Ajustes
├── Rigor da curadoria      [único lugar dos limiares, com taxa de aprovação ao lado]
├── Reprovadas              [agregado pela comporta que barrou]
├── Nichos                  [só identidade e roteamento]
├── Marketplaces            [importância sobe: é o bloqueio do dia 1]
├── Modelos de mensagem     [era Templates, saiu de Canais]
└── Usuários

OPERADOR → Publicar
PARCEIRO → Seu canal
```

Mudanças e o motivo de cada uma:

- **"Aprovar" e "Publicar".** Duas "filas" na mesma casa se confundem justo na hora de pressa. Verbo separa sem esforço e nomeia o ato que a D-020 separou.
- **Fila de envio, Minha fila e Histórico viram uma tela com duas abas.** A especificação já admitia que são a mesma; manter separadas é como se produz duas implementações. O operador cai de duas telas para uma, o que fortalece o argumento da escassez em vez de enfraquecê-lo.
- **Anúncios deixa de ser tela.** A pergunta declarada dela é "a coleta está funcionando?", que é pergunta de *Precisa de atenção*. O grão anúncio vira alternância dentro de Produtos.
- **Parceiros vai para Dinheiro.** Chave PIX, split, extrato, e a regra de concentração de 40% — tudo financeiro.
- **Limiares só em Ajustes.** Eram editáveis em dois lugares, e nenhum mostrava o que o outro fez.
- **Cadastrar por link vira botão**, não item de menu. Com a colheita ligada, deixa de ser o caminho principal de entrada.
- **Busca sobe para a Fase 1.** O catálogo já nasce com milhares de itens de título ruim vindo de canal alheio.

### Regras de fluxo que valem para as telas de operação

**Decidir da linha, não do painel.** A linha da lista já mostra quase tudo que a decisão precisa. Obrigar a abrir o painel custa 60 rolagens puras em 30 ofertas. O painel vira o caso de exceção — "esta aqui eu quero olhar".

**Telegram em lote.** Ele publica sozinho e hoje custa um toque por item, misturado com o WhatsApp. Um bloco *"12 no Telegram — publicar todas"* é 1 toque, e tira 12 itens do caminho do polegar. Não fere a D-002, que restringe só o WhatsApp.

**Desfazer no envio, não confirmação.** Diálogo custa um toque em 100% dos casos para proteger 2%. Ao voltar do WhatsApp, o card anterior aparece colapsado: *"marcada como enviada · desfazer"*. Zero toque a mais no caminho feliz.

Isso corrige uma inversão: hoje aprovar — ato interno e reversível — tem desfazer, e publicar — ato externo, público e irreversível — não tem.

**"Já enviei" desce para o menu secundário.** Hoje é o atalho mais barato da tela (1 toque contra 4 e uma troca de app) e silencia o único alerta de supervisão sobre operador remoto. A ação honesta precisa ser mais barata que a auto-declarada. A origem fica gravada separada — `fluxo` ou `auto-declarada`, nunca somadas num contador só — e publicação auto-declarada sem nenhum clique em 24h vira item em *Precisa de atenção*. Não é prova, é o sinal certo no lugar certo.

**Capacidade visível na aprovação.** *"30 ofertas → 87 publicações → 18 vagas hoje"*. É o número que muda comportamento: sem ele o dono aprova de graça e descobre o custo depois, em pé, no telefone.

**Publicação bloqueada por preço volta sozinha para a aprovação.** O operador não aprova nem rejeita — deixá-lo com um item bloqueado e só "cancelar" como saída é dar a ele um veto de curadoria disfarçado.

---

## O que ficou escrito para não virar frustração

Os **dez minutos são alcançáveis para um operador** com cerca de 18 publicações. Para o dono, acumulando aprovar e publicar, é aritmeticamente impossível. É consequência direta da D-020, e precisa estar dito — senão a conclusão errada é "o sistema é ruim", quando o problema é a meta.

---

## Fora deste plano, e continua fora

Extensão de navegador, IA escrevendo mensagem, aplicativo nativo, cadastro de membros, gráfico elaborado de histórico de preço, cobrança e assinatura.

`operacao_id` **não é escopo de SaaS**: é uma coluna e uma cláusula por policy, feita agora porque é a única decisão da lista que é cara de retroagir.
