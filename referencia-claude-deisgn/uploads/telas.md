# Telas — especificação funcional

O que cada tela resolve, o que ela mostra, o que dá para fazer nela e para onde ela leva.

**Este documento não fala de interface.** Sem layout, sem cor, sem componente, sem posição na página. Ele descreve função, prioridade e fluxo. O desenho visual é trabalho à parte e tem liberdade total sobre a forma, desde que a função abaixo seja atendida.

Ele é **autocontido de propósito**: dá para desenhar a partir dele sem ler mais nada do repositório. Quem quiser ir fundo encontra o modelo de dados em `docs/dados.md`, o contexto comercial em `docs/negocio.md`, a pesquisa de concorrentes em `docs/mercado.md` e o faseamento em `docs/roadmap.md`.

---

# O que é este sistema

O **Radar de Ofertas** monitora o preço de produtos em marketplaces brasileiros (Mercado Livre, Shopee, Amazon), detecta quando algo **ficou realmente barato**, e distribui essas ofertas para canais de WhatsApp e Telegram com link de afiliado. Quando alguém compra pelo link, o sistema recebe comissão.

Tudo em português do Brasil. Valores em reais, datas no fuso de São Paulo.

## O diferencial, e por que ele define as telas

Não é um disparador de mensagens. Existem dezenas deles.

O padrão do mercado é: um robô vigia o canal de oferta de outra pessoa, pega o que já foi publicado, troca o link de afiliado pelo próprio e reenvia. Não há conferência de preço nenhuma. Quando alguém no topo da cadeia publica uma promoção falsa, ela se propaga por dezenas de canais em minutos.

Este sistema faz o contrário: mantém **série histórica de preço própria**, coletada todo dia, e usa ela para decidir se o desconto é verdadeiro. O "preço de R$ 299, por R$ 199" que o marketplace exibe é inflado e não é usado em lugar nenhum — a comparação é sempre contra o que **nós observamos** ao longo do tempo.

Isso tem consequência direta em quase toda tela deste documento: elas existem para tornar essa decisão **visível, explicável e auditável**. Uma tela que esconde o porquê de uma oferta ter sido aprovada destrói o único diferencial do produto.

## O vocabulário

Quatro conceitos que parecem o mesmo e não são. Confundi-los quebra o sistema inteiro, então as telas precisam manter a distinção visível:

| Termo | O que é |
|---|---|
| **produto** | A identidade da coisa. "Tapete higiênico SuperSecão 80×60". |
| **anúncio** | Esse produto **numa loja específica**. O mesmo tapete na Amazon, na Shopee e no Mercado Livre são **três anúncios do mesmo produto**, com três preços e três históricos. |
| **oferta** | Um anúncio que **ficou barato agora**. Tem começo, fim e uma nota de 0 a 100. |
| **publicação** | Uma oferta **enviada para um canal**. É o que gera link, clique e comissão. |

E mais cinco:

| Termo | O que é |
|---|---|
| **nicho** | O assunto do produto: pet, alimentação, eletrônico. Um produto tem **um** nicho; um canal aceita **vários**. É o que roteia oferta para canal. |
| **canal** | Um canal de WhatsApp ou de Telegram onde as ofertas são publicadas. Cada um tem seus nichos, seu horário e seu operador. |
| **parceiro** | Quem traz a audiência — um amigo com um canal, um youtuber. A comissão gerada pelo canal dele é dividida. |
| **subid** | Um código único carimbado em cada publicação. É ele que, quando a venda aparece no relatório do marketplace, diz **de qual canal veio**. Sem subid não existe divisão de receita. |
| **nota** | Pontuação de 0 a 100 que resume a qualidade da oferta: desconto real, comissão em reais, qualidade do vendedor. As parcelas ficam gravadas separadas para que a nota seja sempre explicável. |

## Quem opera

Uma pessoa só, no começo: o dono. Ele não é desenvolvedor — é designer de UX que entende de produto e o suficiente de banco de dados. O sistema roda na máquina dele e, mais tarde, num endereço privado na internet.

Com o tempo entram **operadores** (amigos que publicam num canal) e **parceiros** (que só conferem quanto renderam). A operação planejada chega à ordem de vinte e cinco canais.

## As cinco restrições que moldam tudo

Não são preferências. Cada uma tem uma consequência prática, e violá-las quebra algo real.

1. **O WhatsApp nunca é automatizado.** Não existe via oficial para publicar em massa no WhatsApp — quem promete isso usa ferramenta não oficial, que viola os termos e derruba o número. O número é o ativo do parceiro. O sistema monta o texto e abre o aplicativo; **um humano aperta enviar**. No Telegram, sim, o robô publica sozinho pela API oficial.

2. **Por causa disso, o celular é obrigatório.** O envio acontece no telefone porque é manual. O painel é uma web app responsiva instalável na tela inicial — um código só, servindo celular e desktop.

3. **Nunca afirmar desconto histórico sem lastro.** Enquanto um anúncio tiver menos de 14 dias de série coletada, nenhuma tela e nenhuma mensagem pode dizer "menor preço histórico". Usa-se a redação honesta, com a data em que a observação começou. Mentir sobre preço é o erro que mata os concorrentes.

4. **A curadoria mora no banco de dados**, numa implementação só. As telas leem o veredito e os motivos que o banco produz; nenhuma delas recalcula a regra por conta própria. Uma tela que explicasse a decisão com lógica própria acabaria explicando uma coisa enquanto o sistema faz outra — e seria acreditada.

5. **Nenhum dado pessoal de quem consome.** Não há cadastro de membro de canal. De cliques guarda-se o hash do endereço de rede, nunca o endereço. Sem nome, sem telefone, sem e-mail.

## O ritmo real da operação

Importa para o desenho porque define o que as telas mostram na maior parte do tempo:

- O sistema aprova algo em torno de **5 a 30 ofertas por dia** — não centenas. Os concorrentes repassam de 50 a 100 porque não conferem nada; curadoria custa, repasse não.
- **Nas primeiras semanas quase não há oferta nenhuma**, porque cada produto novo só se torna avaliável depois de acumular série de preço. Poucas na primeira semana, algo entre dez e quinze na terceira, trinta a partir da sexta.
- Portanto **estado vazio não é caso de borda: é o estado normal no começo**, e por isso ele aparece descrito em cada tela abaixo.
- O trabalho diário de publicar precisa caber em **dez minutos**. Se passar disso, o operador desiste em três semanas e o canal morre junto — é o modo de morte mais provável do sistema, mais provável do que falta de oferta.

---

## Como ler

Cada tela traz:

| Campo | Significa |
|---|---|
| **Pergunta** | A única pergunta que a tela existe para responder. Se ela responde duas, provavelmente são duas telas. |
| **Quem usa** | Papel que alcança a tela. |
| **Importância** | Crítica, alta, média ou baixa. Ver a régua abaixo. |
| **Fase** | Quando é construída, conforme `docs/roadmap.md`. |
| **Mostra** | Os dados exibidos. |
| **Faz** | As ações disponíveis. |
| **Leva para** | Para onde o usuário segue a partir dali. |
| **Regras** | Restrições que não podem ser violadas pela interface. |
| **Quando está vazia** | O que a tela comunica antes de existir dado. Estado vazio não é detalhe: nas primeiras semanas ele *é* a tela. |

### A régua de importância

- **Crítica** — se esta tela for ruim, o sistema é abandonado. Não é sobre perder uma funcionalidade; é sobre a operação parar.
- **Alta** — usada toda semana. Ruim aqui gera retrabalho constante.
- **Média** — usada quando algo muda. Ruim aqui incomoda, não mata.
- **Baixa** — usada raramente, muitas vezes uma vez só.

---

## Os três papéis

O sistema não é um painel com permissões diferentes. São **três produtos diferentes** atrás da mesma porta.

| Papel | Trabalho | Quantas telas alcança |
|---|---|---|
| **dono** | Decide o que vale publicar, configura o sistema, presta contas | Todas |
| **operador** | Publica, todo dia, no canal sob responsabilidade dele | Duas |
| **parceiro** | Confere quanto rendeu e quando recebe | Uma, somente leitura |

O operador enxerga duas telas porque **enxergar mais é o que faz ele desistir**. O `docs/roadmap.md` é explícito: se o trabalho diário não couber em dez minutos, o operador para de postar em três semanas e o canal morre junto. Toda decisão nas telas dele se subordina a isso.

---

# Autenticação

## Login

- **Pergunta:** quem é você?
- **Quem usa:** todos
- **Importância:** alta
- **Fase:** 1

**Mostra:** campos de e-mail e senha. Nada mais — nem cadastro, nem preços, nem descrição do produto. Este painel é interno e não é indexado.

**Faz:** entrar; pedir redefinição de senha.

**Leva para:** a casa do papel de quem entrou — dono vai para Hoje, operador para Minha fila, parceiro para Resultado.

**Regras:**
- **Não existe cadastro público.** Conta nasce de convite do dono. Uma tela de "criar conta" aberta seria porta para dentro do sistema que controla o dinheiro.
- Erro de login nunca diz se o e-mail existe. "E-mail ou senha incorretos", sempre — dizer "este e-mail não está cadastrado" entrega quem é usuário do sistema.
- A sessão precisa sobreviver ao aplicativo ser fechado e reaberto. Operador que faz login toda manhã abandona.

**Quando está vazia:** não se aplica.

## Convite e primeiro acesso

- **Pergunta:** como alguém que o dono convidou entra pela primeira vez?
- **Quem usa:** operador e parceiro convidados
- **Importância:** baixa
- **Fase:** 3

**Mostra:** o nome de quem convidou, para qual operação, e o campo de definir senha.

**Faz:** definir a senha e entrar.

**Regras:** o convite expira. Convite eterno em e-mail é credencial eterna em e-mail.

---

# Hoje — a casa do dono

Esta área responde a única pergunta que o dono faz ao abrir o sistema: **o que precisa de mim agora?** Ela reúne três coisas em ordem de urgência.

## Fila de aprovação

- **Pergunta:** quais ofertas detectadas hoje merecem ir para os canais?
- **Quem usa:** dono
- **Importância:** **crítica**
- **Fase:** 1 (a partir do momento em que houver série de preço)

Esta é a tela onde o produto acontece. Todo o resto do sistema — coleta, série histórica, motor de curadoria — existe para alimentar esta lista. E é aqui que o projeto se separa dos concorrentes: eles repassam oferta alheia sem conferir preço, e por isso não precisam desta tela.

**Mostra**, por oferta com status `nova`:

- O produto e a loja onde está.
- O preço agora e o preço de referência que o sistema calculou a partir da série própria — **nunca o "preço de" do marketplace**, que é inflado e é a mentira que queima grupo.
- O desconto real contra essa referência.
- Sobre quantos dias de série a comparação foi feita.
- A nota, e as parcelas que a compõem separadas: desconto, comissão, qualidade. As parcelas ficam gravadas justamente para que a nota seja explicável depois sem recalcular.
- A comissão estimada em reais, marcada como estimativa.
- Para quais canais essa oferta iria, derivado do nicho do produto.
- Se este produto já foi publicado recentemente, e quando.

**Faz:**

- **Aprovar** — a oferta passa a `aprovada` e o sistema gera uma publicação para cada canal que aceita o nicho do produto.
- **Rejeitar, com motivo.** O motivo é obrigatório e fica gravado.
- **Aprovar só para alguns canais** — quando a oferta serve a parte dos canais elegíveis.
- **Adiar** — sai da fila de hoje sem virar rejeição, volta amanhã se ainda estiver válida.
- Abrir o anúncio no marketplace, para conferir com os próprios olhos.

**Leva para:** o detalhe do produto (série completa, outras lojas, histórico de ofertas); o diálogo "por que essa oferta apareceu"; a fila de envio, depois de aprovar.

**Regras:**

- **Aprovar é um ato, não quinze.** Uma oferta aprovada vira publicação em todos os canais elegíveis de uma vez. Se o dono tiver que aprovar a mesma oferta canal por canal, a operação não sobrevive a dez canais — é aritmética, não preferência.
- **Com menos de 14 dias de série, a tela não pode falar em desconto histórico.** Ela mostra a redação honesta, com a data em que a observação começou. Esta regra existe porque mentir sobre preço é o erro que mata os concorrentes.
- Rejeição sem motivo é proibida. Sem o motivo gravado não há como calibrar o motor depois, e o dono vira o próprio gargalo sem saber por quê.
- A ordem padrão é por nota, maior primeiro. Mas o dono precisa poder ordenar por comissão estimada — desconto de 60% num produto de doze reais não paga o post.
- Rejeitar precisa ser tão rápido quanto aprovar. Fila de curadoria em que dizer "não" custa mais que dizer "sim" produz curadoria que vira carimbo.

**Quando está vazia:** dizer *por que* está vazia, com o número que falta. "Nenhuma oferta hoje" é inútil. "Nenhuma oferta hoje: 340 anúncios monitorados, 12 com série suficiente, 0 abaixo do limiar" é diagnóstico. Nas primeiras semanas do projeto esta tela fica vazia quase todo dia, e é normal — o `docs/roadmap.md` prevê poucas ofertas na primeira semana e trinta só a partir da sexta. A tela precisa comunicar isso, senão o dono conclui que o sistema está quebrado e mexe nos parâmetros até a curadoria virar carimbo.

## Fila de envio

- **Pergunta:** o que eu preciso publicar agora, e em qual canal?
- **Quem usa:** dono no começo; operador quando existir
- **Importância:** **crítica**
- **Fase:** 2

É a mesma tela que o operador vê em "Minha fila". Muda o dono do dado, não o componente. Ela aparece aqui porque no início o dono acumula os dois papéis.

**Mostra:** as publicações com status `fila`, agrupadas por canal, na ordem em que devem sair. Por publicação: a mensagem já montada pelo template, o preço no momento em que entrou na fila, e o canal de destino.

**Faz:**

- **Publicar no WhatsApp** — abre o WhatsApp com a mensagem pronta, para envio humano.
- **Publicar no Telegram** — o bot posta sozinho pela API oficial.
- Editar a mensagem antes de enviar.
- Marcar como enviada, para o caso de o envio ter acontecido fora do fluxo.
- Cancelar a publicação.

**Leva para:** o WhatsApp ou o Telegram, fora do sistema; o histórico, depois de enviar.

**Regras:**

- **O sistema nunca envia sozinho no WhatsApp.** Ele monta o texto e abre o aplicativo; um humano aperta enviar. Automação não oficial derruba o número, que é o ativo do parceiro. Nenhuma pressa de produto justifica isso.
- **Cada publicação carrega um subid único.** É o campo que liga a venda ao canal, e sem ele não existe divisão de receita. Nunca reaproveitar subid entre publicações.
- **O preço precisa ser reconferido antes do envio.** Oferta que entrou na fila às 6h e é publicada às 20h pode não existir mais. Publicar preço morto queima o canal na mesma proporção que publicar preço falso. Se o preço mudou, a tela avisa antes de deixar enviar.
- **Esta tela é usada em pé, com uma mão, de manhã.** É a única do sistema com essa restrição, e ela é inegociável: o envio no WhatsApp acontece obrigatoriamente no telefone, porque é manual por decisão de projeto.
- Publicação enviada some da fila e não volta.

**Quando está vazia:** "Nada para publicar agora" é resposta boa, e o operador deve poder fechar o aplicativo em paz. Fila vazia é sucesso, não erro.

## Precisa de atenção

- **Pergunta:** tem alguma coisa quebrada que eu não vi?
- **Quem usa:** dono
- **Importância:** alta
- **Fase:** 1

Esta tela existe porque as falhas deste sistema são **silenciosas**. A coleta para e nada acontece: nenhum erro na tela, nenhuma oferta a menos hoje — só um buraco na série histórica que aparece semanas depois, quando já não dá para consertar. O preço da terça passada não existe mais em lugar nenhum.

**Mostra:**

- Anúncios sem coleta há mais dias que o aceitável.
- A última execução da rotina diária e se ela falhou.
- Canais sem publicação há tempo demais.
- Produtos sem nicho, que por isso não chegam a canal nenhum.
- Quantos dias faltam para o agendador ser desativado por inatividade do repositório — uma armadilha conhecida do GitHub Actions, que desliga workflow agendado após 60 dias sem commit e faz a coleta parar calada.

**Faz:** ir direto ao item com problema. Nada é resolvido nesta tela; ela aponta.

**Leva para:** o anúncio, o canal ou o registro de execução correspondente.

**Regras:** só aparece aqui o que exige ação humana. Aviso que não pede ação nenhuma treina o dono a ignorar a área inteira, e aí o aviso que importa passa junto.

**Quando está vazia:** dizer que está tudo em dia, com a hora da última verificação. Ausência de alerta só tranquiliza se for possível distinguir "nada quebrado" de "a verificação não rodou".

---

# Catálogo

O catálogo é o ativo do projeto. A série histórica de preços leva meses para se formar, **não pode ser refeita**, e é ela que sustenta a tese de que o desconto é real. Perder o catálogo é perder o produto.

## Produtos

- **Pergunta:** o que o sistema está monitorando?
- **Quem usa:** dono
- **Importância:** média
- **Fase:** 1

**Mostra:** os produtos, com nicho, categoria, em quantas lojas estão anunciados, o menor preço observado e quantos dias de série já existem. Filtro por nicho e busca por texto.

**Faz:** buscar, filtrar, classificar produto sem nicho, abrir o detalhe.

**Leva para:** o detalhe do produto.

**Regras:** produto e anúncio são coisas diferentes, e a tela precisa manter essa separação visível. O mesmo tapete higiênico na Shopee, no Mercado Livre e na Amazon é **um** produto com **três** anúncios. Achatar isso duplica o catálogo e torna a nota da oferta impossível de calcular.

**Quando está vazia:** levar para o cadastro por link.

## Produto

- **Pergunta:** como o preço deste produto se comportou, e onde ele está mais barato?
- **Quem usa:** dono
- **Importância:** alta
- **Fase:** 1

**Mostra:** o produto, seu nicho, e cada anúncio dele em cada loja com o preço atual. A série histórica de cada anúncio. As ofertas que este produto já gerou, aprovadas e rejeitadas, com o motivo de cada rejeição. Onde ele já foi publicado e quando.

**Faz:** trocar o nicho; ativar e desativar um anúncio; adicionar outra loja para o mesmo produto; abrir o diagnóstico de curadoria.

**Leva para:** o anúncio no marketplace; o diálogo "por que não virou oferta".

**Regras:**

- **Anúncio da Amazon não exibe série histórica.** A política de associados limita a retenção de preço a 24 horas, então essa linha nunca acumula histórico e a tela precisa dizer isso em vez de mostrar um espaço vazio que parece defeito.
- O histórico de rejeições é tão importante quanto o de aprovações. É onde se descobre que um limiar está apertado demais.

## Anúncios

- **Pergunta:** a coleta está funcionando?
- **Quem usa:** dono
- **Importância:** média
- **Fase:** 1

Visão achatada, por anúncio em vez de por produto. Existe para uma finalidade operacional: encontrar depressa o que parou de coletar.

**Mostra:** anúncio, loja, dias de série, menor e mediana de preço, e quando foi a última coleta. Ordenável pela última coleta.

**Faz:** desativar anúncio morto; forçar uma coleta.

**Leva para:** o produto correspondente.

## Cadastrar por link

- **Pergunta:** como coloco este produto no radar?
- **Quem usa:** dono
- **Importância:** média
- **Fase:** 1 (já existe, ganha o campo de nicho)

**Mostra:** um campo para colar o endereço. O sistema lê a loja e o código do anúncio sem fazer requisição ao site.

**Faz:** colar o link, escolher o nicho, confirmar.

**Regras:**

- Link encurtado é recusado com explicação — precisa ser resolvido antes.
- Loja fora das que o sistema conhece é recusada com explicação.
- Se o anúncio já existir, a tela leva ao existente em vez de duplicar. Existe índice único por loja e código externo justamente para isso.
- **Nicho é obrigatório.** Produto sem nicho não chega a canal nenhum e some silenciosamente do fluxo.

## Nichos

- **Pergunta:** que assuntos a operação cobre, e com que rigor cada um?
- **Quem usa:** dono
- **Importância:** média
- **Fase:** 1

Nicho é o eixo que liga produto a canal. Produto tem **um** nicho; canal aceita **vários**. É isso que faz "oferta de pet vai para os canais de pet" ser uma consulta ao banco em vez de uma regra escrita à mão em algum lugar do código.

**Mostra:** os nichos, quantos produtos e quantos canais cada um tem, e quais limiares de curadoria estão diferentes do padrão global.

**Faz:** criar e renomear nicho; ajustar os limiares daquele nicho; desativar.

**Leva para:** os produtos daquele nicho; os canais que o aceitam.

**Regras:**

- **Os limiares por nicho herdam do global.** Configura-se apenas o que foge do padrão. Vinte por cento de desconto em ração é oferta excelente; vinte por cento em eletrônico é terça-feira comum — um limiar único ou reprova tudo de um lado ou carimba tudo do outro.
- Nicho com produto vinculado não é apagado, é desativado. Apagar quebraria o histórico.

---

# Canais

## Canais

- **Pergunta:** para onde as ofertas vão?
- **Quem usa:** dono
- **Importância:** alta
- **Fase:** 2

**Mostra:** os canais, com plataforma, nichos aceitos, tamanho estimado da audiência, quem opera, quantos posts por dia o canal aceita e quando foi a última publicação.

**Faz:** criar canal; ativar e desativar; abrir o detalhe.

**Leva para:** o detalhe do canal; o parceiro dono da audiência.

**Regras:** canal desativado para de receber publicação imediatamente, mas o histórico dele continua existindo — é o que sustenta a prestação de contas ao parceiro depois.

## Canal

- **Pergunta:** como este canal se comporta?
- **Quem usa:** dono
- **Importância:** média
- **Fase:** 2

**Mostra:** os nichos que o canal aceita, o template de mensagem, os horários permitidos de publicação, o teto de posts por dia, quem é o parceiro e quem é o operador, a divisão de receita, e o histórico de publicações do canal.

**Faz:** editar tudo acima; ver o desempenho recente.

**Regras:**

- **A divisão de receita é guardada em duas parcelas separadas**, audiência e operação, nunca um número só. Um parceiro pode trazer a audiência e operar, ou só trazer a audiência. O que sobra das duas é a parte do dono, e arranjos diferentes convivem no mesmo sistema.
- Os horários permitidos são no fuso de São Paulo, ainda que tudo seja gravado em UTC.
- O teto de posts por dia é limite real: a fila respeita, não avisa depois de estourar.

## Parceiros

- **Pergunta:** quem traz audiência, e o que cada um recebe?
- **Quem usa:** dono
- **Importância:** média
- **Fase:** 2 como cadastro; 3 com extrato

**Mostra:** os parceiros, o tipo de arranjo, quais canais são deles, e — a partir da Fase 3 — quanto foi gerado e quanto já foi repassado.

**Faz:** cadastrar; editar contato e chave de pagamento; ativar e desativar.

**Leva para:** os canais do parceiro; o extrato de repasses.

**Regras:**

- **A chave de pagamento de um parceiro nunca é visível para outro parceiro.** Nem por acidente, nem numa listagem, nem numa resposta de API.
- A partir do quarto canal, a tela precisa mostrar quanto da receita total cada parceiro concentra. Parceiro que passa de 40% dita o split, e isso precisa ser visível antes de virar fato consumado.

## Templates

- **Pergunta:** como a mensagem publicada é escrita?
- **Quem usa:** dono
- **Importância:** média
- **Fase:** 2

**Mostra:** os templates, com as variáveis disponíveis e uma prévia com dados reais de uma oferta.

**Faz:** criar template global ou específico de um canal; editar; pré-visualizar.

**Regras:**

- **Sem inteligência artificial escrevendo mensagem.** Template resolve a maioria dos casos, e texto gerado é texto que ninguém conferiu antes de ir para milhares de pessoas com o nome do canal em cima.
- O template não pode produzir afirmação de desconto histórico quando a série tiver menos de 14 dias. A prévia precisa mostrar as duas redações — a completa e a honesta reduzida — para que a diferença seja escolhida conscientemente e não descoberta em produção.
- Toda mensagem sai com o link do redirecionador próprio, nunca o link do marketplace direto. É o redirecionador que grava o clique e carrega o subid, e é ele que faz os links pararem se a parceria acabar.

---

# Dinheiro

## Conversões

- **Pergunta:** quais vendas realmente aconteceram, e vindas de qual canal?
- **Quem usa:** dono
- **Importância:** alta
- **Fase:** 2

**Mostra:** as conversões importadas, com o subid, o canal que o subid resolve, o valor do pedido, a comissão e em qual dos cinco estados ela está.

**Faz:** importar o relatório de comissão do marketplace por arquivo; conferir o que casou e o que não casou; avançar o estado de uma conversão.

**Leva para:** a publicação que originou a venda.

**Regras:**

- **Os cinco estados nunca se misturam num número só.** Estimada, registrada, confirmada, recebida e repassada aparecem separados. Somar estimado com confirmado é exatamente como se perde a confiança de um parceiro, e a confiança é o que sustenta o modelo inteiro, já que a comissão cai toda na conta do dono antes de ser repartida.
- Subid que não casa com publicação nenhuma **não é descartado**. Fica visível como pendência. Se o subid vier corrompido, é aqui que se descobre — e a `docs/dados.md` guarda subid e publicação separados justamente para permitir essa investigação.
- Importação é sempre manual nesta fase. Sem API de marketplace.

**Quando está vazia:** explicar que a primeira comissão demora — uma venda de março só vira dinheiro na conta lá pelo fim de maio nos programas principais. Esta é uma das telas onde o estado vazio dura meses e precisa ser honesto sobre isso, senão parece defeito.

## Repasses

- **Pergunta:** quanto eu devo a cada parceiro, e quando pago?
- **Quem usa:** dono
- **Importância:** alta
- **Fase:** 3

**Mostra:** por parceiro e período, a base de comissão efetivamente recebida, o percentual do arranjo, o valor devido e se já foi pago.

**Faz:** fechar um período; registrar pagamento com comprovante.

**Regras:**

- **O cálculo considera apenas comissão no estado `recebida`.** Repassar sobre estimativa significa financiar a operação com dinheiro próprio e absorver cada cancelamento sozinho.
- Repasse pago não é editado. Correção entra como novo lançamento, para que o histórico continue auditável.

---

# Ajustes

## Curadoria

- **Pergunta:** com que rigor o sistema aprova?
- **Quem usa:** dono
- **Importância:** média
- **Fase:** 1

Os limiares vivem em dados e não em código exatamente para poderem ser ajustados sem publicar uma nova versão do sistema.

**Mostra:** cada limiar, o valor global, quais nichos o sobrescrevem, e o efeito recente de cada um — quantas ofertas ele aprovou e reprovou.

**Faz:** ajustar valor global ou por nicho; ver a taxa de aprovação ao longo do tempo.

**Regras:**

- **Mostrar a taxa de aprovação junto do controle que a altera.** Aprovação perto de zero com catálogo grande significa parâmetro apertado demais; aprovação alta demais significa que a curadoria virou carimbo. Sem esse número ao lado, o ajuste é chute — e é assim que se afrouxa o motor até ele não filtrar mais nada.
- Alterar limiar não reprocessa oferta já decidida. Vale da próxima detecção em diante, e a tela precisa dizer isso.

## Marketplaces

- **Pergunta:** com quais lojas o sistema trabalha, e quanto cada categoria paga?
- **Quem usa:** dono
- **Importância:** baixa
- **Fase:** 1

**Mostra:** as lojas ativas, o identificador de afiliado de cada uma, o percentual de comissão por categoria com o período de vigência, e por quanto tempo o preço daquela loja pode ser guardado.

**Faz:** ativar e desativar loja; manter a tabela de comissão por categoria.

**Regras:**

- **Percentual de comissão nunca é fixado em código.** Ele muda a cada campanha sazonal, e a comissão calculada é sempre marcada como estimativa.
- O limite de retenção de preço é configurado **por loja**, não por regra fixa. É o que faz a Amazon ser tratada diferente sem espalhar exceção pelo sistema todo.
- O identificador de afiliado é dinheiro. Se vazar, outra pessoa usa os links. Nunca aparece para papel que não seja o dono.

## Usuários

- **Pergunta:** quem tem acesso, e a quê?
- **Quem usa:** dono
- **Importância:** baixa
- **Fase:** 3

**Mostra:** as pessoas com acesso, o papel de cada uma e, para operador, quais canais.

**Faz:** convidar; trocar papel; revogar acesso.

**Regras:** revogar tem efeito imediato, inclusive em sessão já aberta. Acesso revogado que continua funcionando até a sessão expirar não é revogação.

---

# Operador

O operador alcança duas telas. Essa escassez é a funcionalidade.

## Minha fila

- **Pergunta:** o que eu publico agora?
- **Quem usa:** operador
- **Importância:** **crítica**
- **Fase:** 3 (a tela existe desde a Fase 2, sob o dono)

É a mesma tela da fila de envio descrita acima, restrita aos canais do operador. Repetida aqui porque, para ele, ela é o sistema inteiro.

**Regras adicionais:**

- **O operador não vê nota, comissão, split nem qualquer valor de receita.** Não é sigilo por sigilo: é foco. O trabalho dele é publicar o que já foi decidido.
- Ele não aprova nem rejeita oferta. Se puder, a curadoria deixa de ter uma dona só e a régua se dissolve.
- Precisa funcionar com internet ruim e ser óbvio sem treinamento. Toda fricção aqui é churn de operador, que é o modo de morte mais provável do sistema — mais provável que falta de oferta.

## Histórico

- **Pergunta:** o que eu já publiquei?
- **Quem usa:** operador
- **Importância:** baixa
- **Fase:** 3

**Mostra:** as publicações enviadas pelo operador, com data e canal.

**Faz:** conferir. Serve para responder "será que já mandei essa?" sem precisar rolar o canal.

---

# Parceiro

## Resultado

- **Pergunta:** quanto o meu canal rendeu, e quando eu recebo?
- **Quem usa:** parceiro
- **Importância:** alta
- **Fase:** 3

Esta tela é uma peça de **defesa do negócio**, não uma cortesia. Opacidade é o que faz parceiro querer montar o próprio sistema; transparência real é mais barata que perder um canal.

**Mostra:** por canal e por período — publicações, cliques, vendas, e a comissão **separada nos cinco estados**, com data prevista de pagamento.

**Faz:** olhar. Somente leitura, sem exceção.

**Regras:**

- **A data prevista precisa ser realista, incluindo o ciclo do marketplace.** Somando o prazo dos programas de afiliado e o repasse, o parceiro recebe por volta de noventa dias depois da venda. Parceiro que acha que recebe em trinta e recebe em noventa abandona no segundo mês — e terá abandonado por causa desta tela, não por causa do resultado.
- **Um parceiro nunca enxerga dado de outro.** Nem agregados, nem comparações, nem "você está em terceiro lugar".
- Identificador de afiliado e chave de pagamento alheia jamais aparecem aqui.

---

# Elementos que atravessam telas

## Diagnóstico: por que esta oferta apareceu, ou não apareceu

- **Pergunta:** por que o sistema decidiu isso?
- **Quem usa:** dono
- **Importância:** alta
- **Fase:** 1
- **Onde:** acessível de qualquer anúncio ou oferta.

Não é uma tela de menu; é uma resposta sob demanda. O motor de curadoria já devolve o veredito com os motivos em texto, e hoje nada na interface usa isso — provavelmente o maior ganho por linha de código do projeto.

**Mostra:** cada comporta que o anúncio passou ou não passou, com o valor observado e o limiar aplicado, e o cálculo de cada parcela da nota.

**Por que importa:** sem isso a curadoria é caixa-preta, e caixa-preta se ajusta no chute. Com isso, "por que essa oferta não apareceu?" tem resposta em cinco segundos, e os limiares passam a ser calibrados com evidência.

**Regra:** os motivos vêm da mesma implementação que decide de verdade. Reescrever a explicação em outro lugar produziria uma tela que explica uma coisa enquanto o sistema faz outra — e a tela seria acreditada.

## Busca

- **Importância:** média
- **Fase:** 2

Buscar produto, anúncio ou canal de qualquer lugar. Compensa o fato de a navegação ser organizada por tarefa e não por entidade: quem sabe o nome do que procura não deveria precisar saber em que área ele mora.

## Estados de erro

- **Importância:** alta

O sistema é operado por quem não é desenvolvedor. Erro precisa dizer o que aconteceu, o que fazer, e nunca despejar detalhe técnico como resposta.

Três erros merecem tratamento próprio por serem os que de fato ocorrem:

1. **Banco inacessível** — dizer o que verificar, não mostrar a falha crua.
2. **Coleta falhou** — dizer qual loja, desde quando, e que a série está com buraco.
3. **Preço mudou entre a fila e o envio** — bloquear o envio e explicar, em vez de deixar publicar um preço que não existe mais.

---

# Ordem de construção

A ordem abaixo segue uma regra: cada passo precisa ser útil sozinho, sem depender do seguinte.

| Ordem | Tela | Por que aqui |
|---|---|---|
| 1 | Login | Sem porta, nada pode ir para a internet |
| 2 | Diagnóstico de curadoria | Usa o que já existe e está sem interface; torna o motor auditável antes de haver o que auditar |
| 3 | Nichos | Bloqueia o cadastro de produto, que passa a exigir nicho |
| 4 | Catálogo (produtos, produto, anúncios, cadastro) | Sem catálogo não há série; sem série não há oferta |
| 5 | Precisa de atenção | As falhas são silenciosas desde o primeiro dia de coleta |
| 6 | Fila de aprovação | Só faz sentido quando houver série suficiente para gerar oferta |
| 7 | Parceiros (só o cadastro), canais e templates | Todo canal aponta para um parceiro desde a primeira linha — e no começo esse parceiro é o próprio dono. Pré-requisito de qualquer publicação |
| 8 | Fila de envio | Fecha o ciclo até a publicação |
| 9 | Conversões | Fecha o ciclo até o dinheiro |
| 10 | Ajustes de curadoria | Só é ajustável com taxa de aprovação real para observar |

Parceiros com extrato, repasses, painel do parceiro, usuários e convite ficam para a Fase 3, quando existir um parceiro de verdade.

---

# O que não vai existir

Registrado para que não volte como ideia nova a cada conversa:

- Gráfico elaborado de histórico de preço — a série importa para a decisão do motor, não como peça de contemplação.
- Inteligência artificial escrevendo mensagem.
- Extensão de navegador.
- Aplicativo nativo. O painel é web e instalável.
- Cadastro de membros de grupo. Não se guarda dado pessoal de quem consome; de clique grava-se hash do endereço, nunca o endereço.
- Envio automático no WhatsApp, em qualquer forma, sob qualquer justificativa.
- Tela de assinatura, plano ou cobrança.
