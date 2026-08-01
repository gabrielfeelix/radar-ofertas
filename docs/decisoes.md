# Registro de decisões

Toda decisão de arquitetura ou de negócio que já foi tomada fica aqui, com o motivo. Serve para não rediscutir a mesma coisa a cada sessão.

**Formato:** data, decisão, motivo, e o que mudaria a decisão. Adicione novas ao final. Não apague as antigas — se uma decisão for revertida, escreva uma nova registrando a reversão.

---

## D-001 · Um único ID de afiliado, o do dono
**Data:** 2026-07-27

Todos os links de todos os canais usam o ID de afiliado do dono, com subid por publicação. A comissão cai inteira na conta dele, que repassa a parte do parceiro.

**Motivo:** dá o dado completo de performance, permite mostrar transparência real ao parceiro e mantém o controle da operação. A alternativa (cada parceiro com o próprio ID) elimina o repasse manual, mas cega o sistema e impossibilita cobrar a parte da infraestrutura.

**Mudaria se:** um parceiro grande recusar a estrutura e o volume dele justificar um arranjo híbrido. Nesse caso, o schema já precisa suportar os dois modos.

---

## D-002 · WhatsApp manual, Telegram automático
**Data:** 2026-07-27

Nada de automação não oficial no WhatsApp. O sistema gera o texto e abre `wa.me` com a mensagem pronta; um humano aperta enviar. No Telegram, o bot publica sozinho pela API oficial.

**Motivo:** automação não oficial viola os termos do WhatsApp e derruba o número, que é o ativo do parceiro. O custo assimétrico não compensa economizar dez minutos por dia.

**Mudaria se:** surgir uma via oficial viável para grupos. A API oficial de grupos atual exige conta comercial e tem limite de participantes que não serve ao caso.

---

## D-003 · Histórico de preço em cima de Mercado Livre e Shopee, não Amazon
**Data:** 2026-07-27

A Amazon entra como fonte de oferta pontual, não como fonte de inteligência de preço.

**Motivo:** a política de associados da Amazon permite guardar preço em cache por no máximo 24 horas, o que inviabiliza série histórica exibível. A Amazon também exige que links em mensagem direta sejam solicitados pelo destinatário, o que deixa grupo em área cinzenta.

**Mudaria se:** a política mudar, ou se o uso via API de Divulgação de Produtos com atualização em tempo real cobrir o caso.

---

## D-004 · Sem Vercel no plano gratuito
**Data:** 2026-07-27

O painel vai para Cloudflare Pages ou Netlify. Se for Vercel, tem que ser o plano Pro pago.

**Motivo:** o plano Hobby da Vercel não permite uso comercial, e este projeto gera receita. O redirecionador e os crons rodam no próprio Supabase, o que reduz o custo a perto de zero nos primeiros meses.

**Mudaria se:** o projeto passar a faturar o suficiente para o Pro ser irrelevante e algum recurso específico da Vercel fizer falta.

---

## D-005 · Dinheiro em centavos inteiros
**Data:** 2026-07-27

Todo valor monetário é `INTEGER` de centavos no banco e no código.

**Motivo:** aritmética de ponto flutuante com dinheiro produz erro de arredondamento que aparece justamente no cálculo de repasse, que é onde a confiança do parceiro está em jogo.

**Mudaria se:** nada. Isso não se reverte.

---

## D-006 · Sem cadastro de membros
**Data:** 2026-07-27

O sistema não guarda nome, telefone ou e-mail de quem está nos grupos. Cliques gravam hash do IP.

**Motivo:** aumenta complexidade e exposição sob a LGPD sem melhorar as primeiras vendas. Métrica de audiência se resolve com contagem agregada por canal.

**Mudaria se:** houver necessidade real de segmentação, e mesmo assim com base legal definida e consentimento explícito.

---

## D-007 · RLS ligado sem policy na Fase 1, acesso pelo servidor
**Data:** 2026-07-27

Todas as tabelas nascem com Row Level Security ligado e **nenhuma policy**. Efeito prático: a chave anônima não lê nada. O painel da Fase 1 acessa o banco só pelo servidor, com a service role, que ignora RLS por desenho do Postgres.

**Motivo:** a Fase 1 não tem login nem a tabela `usuario` — ela é da Fase 3. Escrever policy agora seria adivinhar. Ligar RLS desde a primeira migration, por outro lado, precisa ser feito agora: o erro clássico é criar a tabela aberta e só ligar RLS meses depois, quando já vazou.

O arquivo `lib/supabase/servidor.ts` importa `server-only`, então se algum componente de navegador tentar usar a service role, o build quebra em vez de mandar a chave mestra para dentro da página.

**Mudaria se:** nada até a Fase 3, quando as policies por papel entram e o painel passa a usar a chave do usuário.

---

## D-008 · Versões travadas, Docker só para o banco
**Data:** 2026-07-27

Node no `.nvmrc`, pnpm em `packageManager`, Supabase CLI como dependência do projeto e Postgres 17 no `supabase/config.toml`. O banco local sobe em Docker via `supabase start`. A aplicação roda direto no sistema, sem container próprio.

**Motivo:** o banco é onde a diferença entre máquinas realmente aparece, e o Supabase já o entrega containerizado com versões fixas no Git. Já o Next.js dentro de container no WSL sofre com hot reload, porque evento de alteração de arquivo não atravessa a fronteira Windows/container — a saída seria polling, que come CPU e deixa o ciclo lento. O ganho que sobraria (paridade de versão do Node) o `.nvmrc` já dá de graça.

**Mudaria se:** entrar uma terceira máquina ou outra pessoa no projeto, quando um devcontainer passa a valer o custo de manutenção. Detalhes em `docs/ambiente.md`.

---

## D-009 · Nicho inicial: pet
**Data:** 2026-07-27

O nicho de arranque é **pet**. O grupo inicial é do próprio dono, com audiência comprada por tráfego pago, tanto no WhatsApp quanto no Telegram. Parcerias com amigos e youtubers só depois que esse grupo mostrar número.

**Motivo:** pet tem recompra alta, o que é a característica que mais importa para grupo de promoção — o membro não sai depois de comprar uma vez. É também um nicho com público identificável em tráfego pago, o que torna o teste viável sem depender de parceiro.

**Consequência prática:** os 150 anúncios da Fase 1 são de pet — ração, tapete higiênico, petisco, brinquedo, areia, coleira, comedouro, farmácia veterinária. Categoria de comissão e ticket médio precisam ser conferidos no programa do Mercado Livre antes de fechar a lista, porque ração tem ticket bom e comissão baixa, enquanto acessório costuma ser o contrário.

**Mudaria se:** o teste de tráfego pago mostrar custo por membro alto demais para o ticket do nicho.

---

## D-010 · Fontes de preço plugáveis, sistema pronto antes da credencial
**Data:** 2026-07-27

O coletor não sabe como o preço de cada loja chega. Ele conhece um contrato — `FonteDePreco`, em `supabase/functions/_compartilhado/tipos.ts` — e cada loja implementa esse contrato do jeito que a API dela permitir. Loja sem credencial se declara não configurada e é pulada, sem erro.

**Motivo:** deixa a estrutura inteira pronta e testada antes de qualquer credencial existir — fila, agendamento, gravação, tratamento de erro e painel. Quando a chave de um marketplace sair, muda um arquivo e nada mais.

**Estado por loja:**

- **Mercado Livre** — implementado contra a API oficial de itens, com renovação de token. Falta `ML_CLIENT_ID`, `ML_CLIENT_SECRET` e `ML_REFRESH_TOKEN`. O formato da resposta segue a documentação e ainda não foi conferido contra a API real.
- **Shopee** — parado de propósito. A API de afiliados exige assinatura calculada por requisição, e escrever isso sem credencial para testar produz código que falha silenciosamente. Implementar junto com a credencial.
- **Amazon** — fora do coletor diário, e não é esquecimento. Pela D-003 ela nunca forma série histórica, então coletar todo dia gastaria requisição para produzir dado que o expurgo apaga no dia seguinte. Volta na Fase 2, como fonte de oferta pontual.

**Mudaria se:** algum marketplace só oferecer feed de arquivo em vez de API. Nesse caso a fonte lê o feed em vez de consultar item a item, e o contrato continua o mesmo.

---

## D-012 · Colher de canais de terceiros como sinal, nunca como verdade
**Data:** 2026-07-27

O sistema lê canais de oferta de terceiros e trata cada oferta vista lá como **candidata**, não como oferta. A candidata passa pelas mesmas duas comportas de qualquer outra antes de virar publicação.

**Motivo:** a pesquisa de mercado mostrou que o padrão dos concorrentes é pegar oferta de grupo alheio, trocar o link de afiliado e republicar sem conferir nada. A diferença aqui é onde a oferta entra: para eles o canal alheio é fonte da verdade, para nós é fonte de descoberta. A verdade continua sendo a nossa série de preços.

**O ganho maior não é a oferta, é o catálogo.** Todo produto avistado num canal alheio entra no nosso catálogo e começa a coletar preço. Isso resolve o arranque a frio: em vez de cadastrar 150 anúncios à mão, o sistema cadastra milhares sozinho, e o volume de ofertas validáveis cresce junto com a série.

**Como colher, decidido:** canais públicos pela web (`t.me/s/<canal>`), que é conteúdo público sem conta envolvida, **e** leitura por conta de usuário do Telegram, com número dedicado já adquirido, para alcançar grupo fechado.

**Riscos aceitos conscientemente:** automatizar conta de usuário é área cinzenta nos termos do Telegram e a conta pode ser banida. Por isso: número dedicado, nunca o pessoal; leitura somente, nada de publicar ou responder pela conta de usuário; ritmo baixo. A leitura por web pública não tem esse risco e é o caminho preferido sempre que o canal for público.

**O que não se copia:** o texto da mensagem alheia. Aproveitamos o fato — produto, preço, link — e a mensagem é montada pelo nosso template.

**Mudaria se:** a conta de usuário for banida com frequência, restando só a via web pública.

---

## D-013 · Escala alvo: 30 ofertas por dia, com rampe honesto
**Data:** 2026-07-27

A meta operacional é **30 ofertas validadas por dia**, não 5 a 10. O canal precisa parecer vivo.

**Motivo:** o limite nunca foi a curadoria, era o tamanho do catálogo. Cinco ofertas por dia é o que sai de 150 anúncios monitorados. Com alguns milhares de anúncios, 30 validadas por dia é consequência aritmética, sem afrouxar nenhum critério.

**O rampe é real e precisa ser dito:** o primeiro dia de colheita valida quase nada, porque produto recém-descoberto não tem série. A capacidade cresce com a série — poucas na primeira semana, algo em torno de dez a quinze na terceira, trinta a partir da sexta. Quem promete trinta validadas no dia um não está validando nada.

**Consequência para o produto:** o concorrente publica de 50 a 100 por dia repassando oferta alheia. Somos outro produto, e isso precisa estar escrito na descrição do canal — senão o membro compara pelo volume e acha que o canal está parado.

**Mudaria se:** a taxa de aprovação mostrar que os limiares estão apertados demais para o nicho. Por isso `detecta_ofertas` devolve avaliados e aprovados: a taxa de aprovação é a métrica que diz se o parâmetro está certo.

---

## D-014 · Limiares da curadoria são dado, não código
**Data:** 2026-07-27

Todo limiar da curadoria vive na tabela `parametro`: dias mínimos de série, janela da mediana, desconto mínimo, comissão mínima, nota e reputação mínimas, intervalo de recompra.

**Motivo:** esses números vão ser ajustados toda semana no começo, olhando o que passou e o que foi publicado. Se cada ajuste exigir deploy, o ajuste vira raro — e limiar que não se ajusta é limiar errado.

**Mudaria se:** nada. Percentual de comissão já seguia essa regra pelo mesmo motivo.

---

## D-015 · Agendador no GitHub Actions, não no pg_cron
**Data:** 2026-07-27

A rotina diária — coleta, expurgo, expiração, compactação e detecção — é disparada por workflow agendado do GitHub Actions, que chama a Edge Function e a função `manutencao_diaria`.

**Motivo:** as fontes divergem sobre o `pg_cron` estar disponível fora do plano Pro, e ele depende de processo de fundo, que é o que planos gratuitos costumam cortar. Além disso, projeto gratuito do Supabase é pausado após uma semana de inatividade — a rotina diária mantém o projeto de pé como efeito colateral. E falha no GitHub é visível, com log e e-mail; no `pg_cron` a falha é silenciosa.

**Pegadinha registrada:** o GitHub desativa workflow agendado após 60 dias sem commit no repositório.

**Mudaria se:** o projeto for para o plano Pro. A troca é indolor, porque as duas rotas chamam as mesmas funções do banco.

---

**Revisado em 28/07/2026, depois da pesquisa técnica.** O argumento de disponibilidade **caducou**: em 2026 o `pg_cron` vem habilitado em todos os planos do Supabase, inclusive o gratuito. Não é mais preciso pedir nada a ninguém.

O motivo que sobra é o que sempre importou, e é mais forte do que estava escrito aqui: **com `pg_cron`, projeto pausado ou fora do ar pausa todo agendamento em silêncio.** É a mesma falha silenciosa que a tela "Precisa de atenção" existe para combater — e o agendador é justamente o lugar onde ela custa mais caro, porque um dia sem coleta é um buraco permanente na série de preço.

Agendador externo falha visível: o GitHub Actions manda e-mail. A decisão continua de pé, com o motivo certo.


## D-016 · Painel na Cloudflare via OpenNext, não Cloudflare Pages — corrige a D-004
**Data:** 2026-07-27

A D-004 dizia "Cloudflare Pages ou Netlify". A parte do Cloudflare Pages está **errada** e fica revogada aqui.

**Motivo:** o pacote `@cloudflare/next-on-pages` foi descontinuado, e a integração nativa do Cloudflare Pages não roda Next.js em modo servidor. A própria Cloudflare passou a recomendar o adaptador **OpenNext** sobre **Cloudflare Workers**, que chegou a 1.0 em fevereiro de 2026 e suporta Next.js 16. A diferença prática é grande: o OpenNext roda no runtime Node, enquanto o caminho antigo só suportava o runtime Edge — e Server Actions com acesso ao banco precisam do Node.

**Segue valendo da D-004:** nada de Vercel no plano gratuito, porque o plano Hobby não permite uso comercial.

**Mudaria se:** o OpenNext se mostrar instável no deploy real. A alternativa é Netlify, que suporta Next.js em modo servidor sem adaptador.

---

## D-017 · A série antiga perde resolução, não desaparece
**Data:** 2026-07-27

A série guarda um ponto por dia nos últimos 120 dias e um ponto por semana antes disso — sempre o de menor preço da semana.

**Motivo:** medido neste banco, cada ponto custa 187 bytes com índices. Com dez mil anúncios a série cresce 682 MB por ano e estoura os 500 MB do plano gratuito em oito meses, em produção e com o canal no ar. A curadoria usa janela de 30 dias, então nada na regra perde precisão com a compactação, e a tendência de longo prazo continua legível. Os mesmos dez mil anúncios passam a caber em 290 MB por ano.

Guardar o **menor** da semana, e não a média, é decisão de produto: a série existe para responder "quão barato isso já esteve", e média esconde justamente o vale que interessa.

**Mudaria se:** o projeto for para um plano com disco folgado, e mesmo assim o ganho seria pequeno.

---

## Pendências que ainda não são decisões

**Ordem de `shopid` e `itemid` no link de vitrine da Shopee.** A colheita real mostrou que os encurtadores da Shopee entregam com mais frequência o formato `shopee.com.br/{vendedor}/{numero1}/{numero2}`. Implementamos lendo como (loja, item), seguindo o formato documentado `/product/{shopid}/{itemid}`, que usa a mesma sequência. **Não foi possível confirmar contra uma página real** — a Shopee recusa requisição sem navegador. Confirmar quando a credencial da API de afiliado chegar, porque ela devolve os dois campos separados. Se estiver invertido, o mesmo produto vira dois anúncios e parte a série de preço em duas.

**Falha intermitente de TLS ao resolver link no runtime local.** Na colheita de teste, parte dos links falhou com erro de certificado e o link seguinte, para o mesmo domínio, funcionou. Contornado com uma repetição em `resolveLink`, e resolvido no ambiente local com `DENO_TLS_CA_STORE` e `SSL_CERT_FILE`. **Não foi verificado no runtime de produção da Supabase**, que tem outra configuração de certificados. Conferir na primeira execução real.

**Extração automática de título e preço.** Hoje o cadastro é manual: o operador cola o link e digita título e preço. O sistema só lê a URL para descobrir a loja e o código do anúncio — nenhuma requisição sai para o site. **Isso bloqueia o coletor diário da Fase 1.**

A pesquisa de mercado (`docs/mercado.md`) encontrou três vias oficiais, todas melhores que raspagem: a **Open API de afiliado da Shopee**, que resolve dado de produto e link curto na mesma credencial; a **API de itens do Mercado Livre**, já implementada e esperando credencial; e o **feed de rede de afiliados** (Lomadee, Awin, Afilio), que é dado fornecido pela rede exatamente para este uso.

Falta escolher por onde começar e obter a credencial. A regra da seção 8 do `AGENTS.md` continua valendo — nada de raspar página sem confirmar os termos.

---

## D-011 · Canal do WhatsApp, não grupo
**Data:** 2026-07-27

A distribuição no WhatsApp usa **Canal**, não grupo.

**Motivo:** grupo tem teto de 1.024 membros, que é teto de receita — cheio, obriga a criar um segundo e publicar duas vezes à mão. Além disso, em grupo o telefone de cada membro fica visível para todos os outros, o que é exposição desnecessária sob a LGPD e desconforto para quem entra. Canal não tem limite de seguidores, não expõe telefone e é unidirecional, então o operador não vira moderador.

A pesquisa também fechou a porta da alternativa: **não existe via oficial e automatizada de distribuição em massa no WhatsApp.** A API do Business não publica em grupo, a Groups API restrita serve a punhados de participantes, e lista de transmissão exige que o destinatário tenha o número salvo. Quem promete automação de grupo está usando ferramenta não oficial, que é o vetor de banimento número um. A D-002 deixa de ser cautela e passa a ser a única via legítima.

**Custo:** perde-se a conversa entre membros. Em grupo de oferta, isso costuma ser mais ruído que comunidade.

**Mudaria se:** o WhatsApp abrir API oficial de publicação em canal, o que tornaria o envio automático e mudaria o desenho da fila.

**Custo de aquisição por membro.** O grupo inicial de pet será crescido com tráfego pago, o que troca "esperar a audiência aparecer" por "comprar audiência". Isso põe um custo novo na conta que não existia no plano original: se o membro custa mais do que a comissão que ele gera na vida dele dentro do grupo, o modelo não fecha por mais bem construído que o sistema esteja. Medir isso é a primeira métrica real do projeto — e ela só existe depois da primeira comissão confirmada.

**Enquadramento fiscal.** Há divergência entre fontes sobre se afiliado digital cabe no MEI — o CNAE 7490-1/04 apareceria fora da lista permitida, empurrando para Microempresa no Simples Nacional. Precisa de confirmação de um contador antes de repassar dinheiro a terceiros. **Não trate como resolvido.**

**Resultado do teste de subid (Fase 0).** Registrar aqui, por marketplace: suporta subid, tamanho máximo, formato aceito, prazo de aparecimento no relatório.

**Domínio.** Não registrado. Precisa de um curto para o redirecionador.

---

## D-018 · O painel é uma web app responsiva instalável, não um app nativo
**Data:** 2026-07-27

Um código só, servindo celular e desktop, instalável na tela inicial como PWA. Sem app nativo, sem loja de aplicativo, sem segundo frontend.

**Motivo:** o envio no WhatsApp é manual por decisão de projeto (D-002), e envio manual acontece no telefone. Isso torna o celular obrigatório para nós — enquanto os concorrentes, que automatizam o disparo por QR Code, conseguem viver só de desktop. A restrição que escolhemos por integridade é justamente a que nos obriga ao mobile.

A pesquisa confirma o caminho: o **Divulgador Inteligente**, a maior ferramenta do mercado, não é app nativo. A central de ajuda deles só ensina "adicionar à tela inicial" no Android e no iPhone. É PWA.

**Custo:** nenhuma capacidade nativa (notificação push confiável no iOS, acesso a hardware). Nenhuma delas é necessária aqui.

**Mudaria se:** surgir necessidade real de notificação push no iOS para avisar o operador da fila do dia.

---

## D-019 · Nicho é entidade; produto tem um, canal aceita vários
**Data:** 2026-07-27

`nicho` vira tabela. `produto` ganha `nicho_id` — um só. A relação entre canal e nicho é muitos-para-muitos: um canal aceita a lista de nichos que quiser.

**Motivo:** a operação planejada tem dezenas de canais agrupados por assunto — na ordem de quinze de pet, dez de alimentação. Com `nicho` como texto livre, cada cadastro produz uma grafia (`pet`, `Pet`, `PET`, `pets`), e a regra "manda oferta de pet para os canais de pet" passa a não encontrar metade dos canais, em silêncio. Chave estrangeira elimina a classe inteira de erro.

A tag fica no **produto** e não no anúncio porque o nicho é da coisa, não da loja: o mesmo produto em três marketplaces são três anúncios e uma classificação só.

Muitos-para-muitos dos dois lados foi recusado. Produto com vários nichos custa complexidade em toda tela e resolve pouco — a flexibilidade real (um canal de "Casa e Cozinha" que aceita dois nichos) vive no lado do canal, que é onde ela é barata.

**Custo:** classificar produto passa a ser obrigatório no cadastro. Produto sem nicho não alcança canal nenhum.

**Mudaria se:** aparecer categoria genuinamente ambígua em volume — ração de cachorro sendo `pet` e `alimentação` ao mesmo tempo, com canais dos dois querendo recebê-la.

---

## D-020 · Aprovar e publicar são atos de papéis diferentes
**Data:** 2026-07-27

O dono aprova uma oferta **uma vez**, e ela vira uma publicação por canal elegível. Cada operador vê apenas a fila do canal dele.

**Motivo:** é aritmética, não preferência. Dez ofertas de pet por dia em quinze canais de pet são 150 envios manuais diários — perto de cinquenta minutos, contra os dez minutos que o `docs/roadmap.md` estabelece como limite antes de o operador desistir. Distribuído entre quinze operadores, são três minutos cada.

Nenhum concorrente pesquisado separa os dois atos, porque todos automatizam o envio e nunca encontram esse limite.

**Custo:** a fila de envio precisa existir mesmo na Fase 2, quando dono e operador são a mesma pessoa.

**Mudaria se:** o WhatsApp abrir via oficial de publicação automatizada, o que dissolveria o gargalo humano.

---

## D-021 · Coluna de operação e RLS por ela desde a primeira migration
**Data:** 2026-07-27

Toda tabela recebe `operacao_id`, e todo RLS passa por essa coluna. Existe **uma** linha em `operacao`. Nada na interface menciona a palavra.

**Motivo:** é a única decisão desta lista que é cara de retroagir. Login, telas e nichos entram depois sem dor; separação de tenant toca toda tabela, toda policy e toda consulta — fazer depois é reescrever o banco com série histórica dentro, e a série não pode ser refeita.

O `docs/mercado.md` já concluiu que vender a ferramenta é mercado real, com preço estabelecido entre R$ 29 e R$ 247 por mês. O concorrente **HypeFlow** anuncia "workspace isolado" na própria tela de login. Não estamos construindo isso — estamos deixando de fechar a porta.

**Custo:** hoje, uma coluna e uma cláusula por policy. Praticamente zero com o banco vazio.

**Isto não é escopo de SaaS.** Sem cadastro público, sem plano, sem cobrança, sem tela de assinatura. O `AGENTS.md` continua valendo: arquitetura multi-workspace é da Fase 4.

**Mudaria se:** nada. O custo de manter é menor que o de remover.

---

## D-022 · Autenticação por e-mail e senha, construída agora
**Data:** 2026-07-27

Login com e-mail e senha, contas criadas por convite do dono. Sem cadastro público. Construído na Fase 1, não na Fase 3.

**Motivo do método:** link mágico por e-mail quebra dentro de PWA — o link abre no navegador e a sessão nasce lá, não no aplicativo instalado, e o usuário volta ao ícone ainda deslogado. Com a D-018 escolhendo PWA, isso desqualifica o link mágico. Login social exigiria configurar OAuth e depender de domínio verificado, que ainda não existe. Senha não depende de nada externo e o gerenciador do celular preenche sozinho.

**Motivo da antecipação:** o `docs/roadmap.md` põe autenticação na Fase 3, mas o painel da Fase 2 vai para a internet. Painel publicado sem porta, com `service_role` atrás, é buraco de segurança e não simplificação. Login é infraestrutura, não funcionalidade de fase.

Os papéis `operador` e `parceiro` nascem no enum e nas policies desde já; as telas próprias deles continuam na Fase 3.

**Mudaria se:** o domínio for registrado cedo — aí o login social entra como opção adicional, convivendo com a senha na mesma conta.

---

## D-023 · Limiares de curadoria por nicho, herdando do global
**Data:** 2026-07-27

`parametro` passa a aceitar um nicho. A busca tenta o valor do nicho e, não achando, cai no global. Configura-se apenas o que foge do padrão.

**Motivo:** consequência direta da D-019. Vinte por cento de desconto em ração é oferta excelente; vinte por cento em eletrônico é terça-feira comum. Um limiar único ou reprova tudo de um lado ou carimba tudo do outro — e "curadoria virou carimbo" é exatamente o risco que o `docs/roadmap.md` manda vigiar.

**Custo:** muda a assinatura da função lida pelo motor e obriga a reexecutar os dez casos de teste de `avalia_anuncios`. Barato agora, com o banco vazio.

**Mudaria se:** a operação permanecer de um nicho só, quando a herança seria peso morto — mas ela é invisível nesse caso.

---

## D-024 · Terceira comporta: preço recorrente
**Data:** 2026-07-27

O motor ganha uma comporta: se o anúncio esteve neste preço em mais que uma fração X dos dias da janela, não é oferta — é o preço normal com etiqueta de promoção.

**Motivo:** os critérios públicos de moderação do **Promobit** reprovam explicitamente "preços recorrentes", além de reprovar preço mais de 10% acima da média histórica. Eles chegaram a isso operando 200 a 300 ofertas por dia. Hoje o nosso motor não detecta esse caso: um produto que passa 25 dias por mês "com desconto" passaria por aprovado.

É a comporta que mais reforça a tese central do projeto, e o dado para calculá-la já é nosso — a série histórica é própria, não emprestada do marketplace.

**Custo:** um parâmetro novo a calibrar, e ele só se calibra com semanas de série real acumulada. Até lá, o valor inicial é chute informado.

**Mudaria se:** a comporta se mostrar redundante com a comparação contra a mediana, o que só o dado real dirá.

---

## D-025 · Navegação por tarefa, moldada por papel
**Data:** 2026-07-27

A navegação espelha o trabalho, não as tabelas. A tela inicial é sempre "o que precisa de mim agora", e o conjunto de áreas muda conforme quem entrou: cinco para o dono, duas para o operador, uma para o parceiro.

**Motivo:** um item de menu por entidade produziria onze itens com o trabalho diário enterrado em um deles — que é literalmente o desenho que o `docs/roadmap.md` identifica como o erro original do projeto, "oito seções de painel... decorar apartamento sem parede".

A moldagem por papel entrega de graça o benefício de ter dois aplicativos separados: quando existir operador de verdade, ele já estará usando uma interface mínima, sem que um segundo frontend tenha sido construído.

**Custo:** entidades de baixa frequência (nicho, parceiro, template) ficam a dois níveis de navegação. Compensado por busca global.

**Mudaria se:** a operação crescer a ponto de o app do operador merecer otimização que atrapalhe o do dono.

---

## Pendência · Hospedagem do painel está sem caminho real
**Data:** 2026-07-27

A D-016 decidiu Cloudflare Workers via OpenNext, **e isso nunca foi implementado**: o `package.json` não tem `@opennextjs/cloudflare` nem script de deploy. Hoje não existe caminho de publicação nenhum.

O dono pediu para trocar por Vercel. O impedimento da D-004 continua de pé e é contratual, não técnico: **o plano Hobby da Vercel não permite uso comercial**, e este projeto gera receita de afiliado. Na prática seria Vercel Pro a US$ 20 por mês — sozinho mais caro que todo o resto da infraestrutura somada.

Alternativas gratuitas e comercialmente livres a avaliar: Netlify, Railway, Render, Fly.

**Não bloqueia nada agora** — o painel só vai ao ar junto com o domínio, que também não existe. Decidir quando chegar lá, e registrar aqui como decisão.

---

## D-026 · Telas primeiro, com operação simulada
**Data:** 2026-07-28

As telas de decisão — aprovar e publicar — são construídas **antes** do dado real, sobre uma operação simulada em `lib/simulacao/`, e vão à mão de testadores nesse estado. O backend é plugado depois, ação por ação.

**Motivo:** o que falta para essas telas terem dado real não é trabalho de código — é credencial de marketplace, domínio registrado e canal com audiência. Nada disso está sob controle de quem escreve o sistema, e nenhum tem data. Esperar significaria descobrir só daqui a semanas se o fluxo de decidir trinta ofertas e publicar dezoito cabe na mão de uma pessoa em dez minutos — que é a pergunta mais cara do projeto, e a que mata o sistema se a resposta for não.

Simulação responde essa pergunta hoje, com testador de verdade, por um custo baixo.

**Isto abre exceção à regra "nenhuma tela é construída com dado falso"**, e a exceção tem limite escrito: ela vale para dado que depende de terceiro, não para dado que o banco deveria ter e não tem. Foi a regra original que derrubou três telas da fila por não terem tabela por trás, e essa parte continua de pé.

**Custo, dito antes de aparecer:** dado simulado é bem-comportado. Título curto, preço redondo, canal com nome curto. O real traz título de 180 caracteres vindo de canal alheio e nome de canal com emoji. Quando plugar, algum layout aperta. É esperado, é barato, e é muito menor que o custo de descobrir tarde que o fluxo não cabe em dez minutos.

**Três condições que separam isso de dado falso:**

1. A simulação é um módulo só, e nenhuma tela a chama direto — a tela chama uma ação, que hoje mexe na memória e amanhã escreve no banco. A assinatura não muda.
2. A tela nunca recalcula regra, nem quando a regra é de mentira. Nota, comportas e motivos chegam prontos, como chegariam de `avalia_anuncios` (restrição 4 de `docs/telas.md`).
3. A faixa "operação simulada" fica visível o tempo todo. Testador que esquece que o dado é inventado tira conclusão sobre volume e capacidade a partir de número inventado — e é essa conclusão que fica no relatório.

**Mudaria se:** a credencial chegar antes de as telas ficarem prontas. Aí o plugue acontece na hora, e a simulação vira material de teste.

### ✅ A exceção terminou em 31/07/2026

O dono encerrou: *"agora estamos parando de brincar de mockup"*. `lib/simulacao/loja.ts` foi apagado, e as três telas que dependiam dele — Canais, Aprovar e Publicar — passaram a ler o banco. A faixa `AvisoSimulacao` não existe mais, porque não há mais tela mentindo.

**A D-026 fez o que prometeu, e vale registrar por quê:** a assinatura das ações não mudou em nenhuma das três. `aprovaOferta(form)` continua sendo `aprovaOferta(form)`; o que mudou foi o corpo, que antes mexia num objeto em memória e agora grava `oferta` e `publicacao`. A condição 1 da lista acima — "nenhuma tela chama a simulação direto" — foi o que tornou a troca um trabalho de uma sessão em vez de uma reescrita.

**O custo previsto não apareceu do jeito esperado**, e isso é informação: o parágrafo acima avisava que "algum layout aperta" com dado real. Não deu para saber ainda, porque o banco da nuvem está vazio — o que se viu foram os estados vazios, que ficaram corretos. O aperto de layout continua esperando o primeiro título de 180 caracteres.

O roteiro da travessia, com o que cada passo destravava, está em `docs/tirar-a-simulacao.md`.

---

## Revisão · O que a passada pelas telas achou
**Data:** 2026-07-28

Revisão das sete telas construídas, contra `docs/telas.md`, o protótipo e a operação real. Seis achados, três deles defeito e não gosto. Todos corrigidos na mesma passada.

**1. A capacidade parava de contar assim que o trabalho começava.** `publicadasHoje` era um número guardado: publicar seis num canal deixava "vagas restantes" intacto. É o número que a tela de aprovar usa para mudar comportamento, e ele apontava para o lugar errado justamente depois do primeiro envio. Agora é calculado — o que o canal já tinha mais o que saiu nesta sessão.

**2. A tela dizia que a publicação travada voltava para a aprovação, e nada voltava.** O item ficava travado para sempre. O operador não pode resolver, porque a decisão é de curadoria e não é dele — então ele ficava com um item morto e "cancelar" como única saída, que é veto de curadoria disfarçado. Agora existe o botão que devolve de verdade, **com o preço de agora**, que é sobre o que a decisão nova precisa acontecer.

**3. A lista de motivos da rejeição era cortada pela borda da tabela.** O contêiner tinha `overflow-hidden` para arredondar o canto, e o menu abria dentro dele. A ação mais sensível da tela aparecia pela metade.

**4. Desfazer a aprovação esquecia as publicações que ela tinha gerado.** Uma publicação já marcada como enviada continuava contando no teto do canal, e reaprovar a mesma oferta a trazia de volta "já enviada" sem que nada tivesse sido enviado. Achado pelo teste, não por revisão de código.

**5. A fila de publicação estava agrupada por plataforma, não por canal.** Publicar é um ato por canal: quem está no telefone abre um aplicativo, cola, volta. Agrupar por plataforma obriga a pular de canal em canal dentro do mesmo bloco. Também entraram o "faltam 5 de 8" — sem ele uma fila de oito parece infinita no terceiro item — e o subid à vista, que é o primeiro lugar onde se olha quando uma comissão não casa.

**6. O teto do canal não era respeitado por quem publica.** O botão de lote publicaria tudo, inclusive o que passa do combinado com o parceiro. Agora o teto vale no lote e no item, e a tela diz quantas cabem hoje e quantas ficam para amanhã — antes de o dono aprovar, não depois.

Duas coisas menores na mesma passada: o painel de anúncios ainda usava as cores antigas, anteriores ao design system; e cada tela abria o próprio `<main>`, com o `h1` fora dele.

**A lição, para a próxima tela:** cinco dos seis achados são de *fluxo entre telas*, não de tela. Aprovar mexe na capacidade que Canais mostra, publicar consome o teto que Aprovar usa para avisar, preço mudado volta para quem decide. Tela revisada sozinha parece correta; o defeito mora na costura.

---

## Pendência · Encurtador da Shopee não resolve por requisição de servidor
**Data:** 2026-07-28

A primeira colheita rodada contra a tela de menções mostrou o quadro real: **13 de 13 links de um canal de Shopee foram descartados**, todos `shp.ee`, todos com a mesma mensagem — link curto que precisa ser aberto no navegador.

Conferido fora do sistema: `curl https://shp.ee/<código>` devolve **404 com e sem User-Agent de navegador**. Não é o nosso leitor errando formato; é a Shopee recusando expandir o link para quem não é aplicativo dela. O mesmo motivo já registrado na pendência da ordem de `shopid`/`itemid`.

**Consequência prática:** canal que publica só `shp.ee` rende zero, e o rendimento por canal mostra isso corretamente — 13 menções, 13 descartadas, nenhum anúncio.

**Some quando a credencial da Open API de afiliado da Shopee chegar:** ela devolve o link de produto e os dois identificadores separados, sem depender de expandir encurtador. Ou seja, é mais um item que espera o dono, não trabalho de código.

**Não invente contorno:** simular navegador para expandir link da Shopee é raspagem com outro nome, e cai na regra da seção 8 do AGENTS.md.

---

## Correção · A colheita perdia todo descarte, em silêncio
**Data:** 2026-07-28

Achado ao construir a tela de menções e rodar a colheita contra três canais reais: o resumo dizia **29 descartes** e o banco tinha **zero**.

Causa: as duas inserções diretas em `mencao` dentro de `colheita-canais` não mandavam `operacao_id`, que a reescrita de 27/07 tornou obrigatório — e **nenhuma das duas conferia o `error` da resposta**. O caminho feliz passava, porque `registra_mencao` é `security definer` e resolve a operação sozinha.

O efeito seria o pior tipo de falha: a colheita informando sucesso, a tela de menções vazia justamente quando mais teria o que mostrar, e a conclusão errada de que o leitor de link está ótimo. O único sintoma seria catálogo crescendo mais devagar do que devia.

**Corrigido** com uma função só de inserção de descarte, que carrega a operação da fonte e confere o erro — conflito de índice único continua sendo silêncio, porque link repetido no mesmo post não é falha.

**A regra que achou isso** está em `docs/plano.md`: teste com dado real. Nenhuma revisão de código teria pego, porque o código estava sintaticamente correto e o resumo da execução parecia bom.

## D-027 · Login construído; a leitura de dado continua na service role, por enquanto
**Data:** 2026-07-28

A porta existe: middleware, sessão em cookie, `/entrar` com e-mail e senha, papel decidindo a casa, e `sair`. Segue a D-022 — senha e não link mágico, sem cadastro público.

**O que ficou de fora, e está dito para não ser confundido com pronto:** as telas continuam lendo o banco pela `service_role`, que ignora RLS por desenho. As policies existem desde a migration 11 e ainda não são o que protege — quem protege hoje é o middleware.

**Motivo de separar:** trocar as leituras pela chave da pessoa é mexer em todas as telas ao mesmo tempo. Feito junto com o login, o primeiro erro apareceria como "não devolve linha" sem dizer se a culpa é da sessão ou da policy — e são dois lugares muito diferentes para procurar.

**Consequência honesta:** hoje qualquer conta com papel `dono` ou `operador` enxerga tudo da operação, porque o servidor lê como serviço. Isso é aceitável enquanto o painel roda na máquina do dono e a única conta é a dele. **Deixa de ser aceitável no dia em que o primeiro operador de verdade receber acesso** — e esse é o gatilho para fazer a troca, não uma data.

**Parceiro puro não entra.** Quem tem só o papel `parceiro` recebe uma mensagem dizendo que o painel dele é da Fase 3, em vez de cair no painel do dono. Mandá-lo para dentro hoje, com a service role atrás, mostraria a ele a operação inteira — inclusive quanto os outros parceiros ganham. É a mesma razão do parágrafo acima, vista do outro lado.

**A mensagem de erro do login é sempre a mesma** — senha errada, e-mail inexistente, conta sem convite e conta desativada devolvem "E-mail ou senha incorretos". Distinguir transformaria a tela num verificador de quem usa o sistema. A exceção é o parceiro: ele já provou a identidade, então não há o que vazar, e "senha incorreta" o faria trocar a senha para sempre tentando resolver o que não é problema dele.

**Conta nasce por script**, `pnpm usuario:cria`, enquanto a tela de convite não existe (Fase 3). Ele cria as duas metades — a identidade em `auth.users` e o acesso em `public.usuario` — e desfaz a primeira se a segunda falhar. Identidade sem linha em `usuario` não entra em lugar nenhum, e é isso que mantém "sem convite não há entrada" verdadeiro mesmo se alguém criar conta pela API por fora.

---

## D-028 · Fonte de colheita pode ser misto, e a triagem ganha tela
**Data:** 2026-07-28

O cadastro de fonte exigia um nicho de verdade. Agora aceita **misto**, que é uma escolha explícita — não o campo em branco. E os produtos de fonte mista caem em **Sem classificação**, `/produtos/sem-nicho`, que classifica em lote.

**Motivo:** a regra antiga tinha um argumento correto para canal de um assunto só — o produto herda o nicho da fonte e já nasce roteável, sem trabalho manual por item. O argumento se inverte para canal genérico de ofertas, que é a maioria dos que valem a leitura.

Foi o que aconteceu: as três fontes cadastradas ficaram como "pet", e placa de vídeo RTX 5060 Ti entrou no catálogo com o nicho de ração. A tela não permitia outra coisa.

**A diferença entre os dois erros é o ponto inteiro:**

| | o que acontece |
|---|---|
| sem nicho | falha **visível** — o produto para na triagem e nada errado é publicado |
| nicho errado | falha **silenciosa** — a oferta é roteada, aprovada e publicada no canal errado, e o grupo de pet recebe uma placa de vídeo |

Forçar a escolha produzia o segundo. Um aviso âmbar ao lado de "sem nicho" piorava: ensinava a marcar qualquer nicho para o aviso sumir.

**Não precisou de migration.** `fonte_descoberta.nicho_id` e `produto.nicho_id` já eram nulos, e já existia o índice `produto_sem_nicho_idx`. O modelo de dados sempre previu a triagem; só a interface não deixava chegar nela.

**Classificar é em lote, e isso não é conforto.** É o único trabalho manual por item do sistema. Um canal genérico entrega dezenas de produtos por dia — de um em um, ninguém faz na segunda semana, e o catálogo para de crescer sem ninguém ter decidido isso.

**Os 6 produtos hoje marcados como "pet" continuam marcados.** Corrigir dado existente é decisão do dono, não efeito colateral de mudança de tela.

---

## D-029 · Imagem de produto: link, nunca arquivo, e com prazo
**Data:** 2026-07-28

`anuncio.imagem_url` guarda o **link** para a imagem na loja, com `imagem_obtida_em` ao lado, e `expurga_imagens_expiradas` o apaga quando passa da retenção daquela loja. Nunca se guarda o arquivo da imagem.

**Motivo:** a política da Amazon é mais dura com imagem do que com preço, e nós aplicávamos metade dela.

> "You will not store or cache Product Advertising Content consisting of an image, but you may store a link to Product Advertising Content consisting of an image for up to 24 hours."

O preço tinha `expurga_precos_expirados` desde a primeira migration. A imagem não tinha nada — `produto.imagem_url`, sem prazo e sem regra por loja.

**Por que no anúncio e não no produto:** a política é da loja, e loja é atributo do anúncio. O mesmo produto pode ter anúncio na Shopee (imagem pode ficar) e na Amazon (não pode). Com a URL no produto, não há como expirar uma sem apagar a outra.

**Reusa `cache_preco_max_horas` de propósito.** É a mesma política que limita os dois. Duas colunas separadas conviveriam com valores diferentes, e a divergência só apareceria numa notificação da Amazon.

**Era inofensivo hoje e deixaria de ser amanhã:** não existe coleta de imagem ainda, mas o componente de interface já está pronto para receber a foto, e a pesquisa de operação mostrou que **imagem é item de conversão** — *"links soltos sem contexto visual têm taxa de clique muito mais baixa"*. Ou seja, ela vai ser construída, e cedo.

---

## D-030 · O PWA não pode cachear tela com preço de marketplace
**Data:** 2026-07-28

Quando existir service worker (D-018), ele **exclui as telas que mostram preço**. Cache offline vale para casca, navegação e telas de configuração, não para oferta.

**Motivo:** cláusula da política da Amazon que não estava anotada em lugar nenhum.

> "If your application includes a client application, the client application may not store or cache Product Advertising Content."

Cache offline é exatamente o tipo de coisa que alguém liga achando que é melhoria, meses depois, sem reler política de afiliado. Está escrito **antes** de existir service worker para que a decisão já esteja tomada quando a tentação aparecer.

**Mudaria se:** a Amazon sair do sistema. Para Mercado Livre e Shopee a restrição não existe.

---

## D-031 · Canal do WhatsApp é uma terceira superfície — registrada, não construída
**Data:** 2026-07-31

`canal.plataforma` aceita hoje dois valores, e a restrição está escrita na migration:

```sql
constraint canal_plataforma_valida check (plataforma in ('whatsapp', 'telegram'))
```

O mercado usa **três** superfícies, não duas:

| Superfície | Limite | Natureza |
|---|---|---|
| Grupo do WhatsApp | 1.024 membros | bidirecional, conversa, alta conversão |
| **Canal do WhatsApp** | sem limite | unidirecional, vitrine, seguidor não vê seguidor |
| Canal do Telegram | sem limite | unidirecional, escala |

**A decisão agora é só esta: quando o terceiro valor entrar, ele é um valor novo em `plataforma` — nunca um booleano `é_canal` pendurado no lado.** Booleano parece mais barato e é onde a modelagem apodrece: `plataforma` deixa de responder "para onde isto vai" e passa a exigir que quem lê saiba combinar duas colunas.

**Por que não construir agora:** é Fase 2, e não é renomear valor. Três coisas mudam junto:

- **O fluxo de publicação.** `BotaoWhatsApp` abre `https://wa.me/?text=…`, que é a folha de compartilhamento — ela lista conversas e grupos, **não** lista canais. Postar em Canal é ação dentro do painel de administrador do próprio canal. O botão que temos não serve, e não existe substituto oficial equivalente.
- **O que `membros_estimados` significa.** Seguidor de canal não é membro de grupo: não conversa, não é contável do mesmo jeito, e o teto de 1.024 some.
- **A cadência.** Sem conversa no meio, o ruído percebido por post é outro, e o teto de 5–8 do grupo não é transferível sem observação.

**Relação com a D-011,** que decidiu "Canal, não grupo" em 27/07: a intenção continua de pé — o teto de 1.024 é teto de receita, e grupo expõe telefone de membro. O que a pesquisa de 28/07 acrescentou é que a operação madura costuma rodar **as duas** com papéis diferentes, começando no grupo e migrando ao passar de ~500 membros. Então a D-011 não vira "erramos": vira "o destino é canal, o começo provavelmente é grupo, e o banco precisa saber dizer qual dos dois".

**O que já está certo e não precisa mexer:** `posts_por_dia_max`, `horarios_permitidos` e os splits são iguais nas três superfícies.

**Mudaria se:** o WhatsApp abrir API oficial de publicação em Canal — aí o Canal vira o caso automatizado, como o Telegram, e sobe na fila.

---

## D-032 · Vercel Hobby agora, com prazo para sair
**Data:** 2026-07-31

O painel está publicado na **Vercel, plano Hobby**, na conta `4-yu`, projeto
`radar-ofertas`. O deploy de 31/07 responde em
**https://radar-ofertas.vercel.app** — este é o alias estável, e é o endereço a
usar. O `radar-ofertas-hvmdkorj6-4-yu...` que estava aqui antes é a URL **do
deploy**, que muda a cada publicação. Fica escrito porque dívida sem endereço é dívida difícil de cobrar, e
porque as URIs de redirect do OAuth do Mercado Livre apontam para ele. Isso
**contraria a seção 2 do `AGENTS.md`**, que manda hospedar em Cloudflare Workers
com OpenNext (D-016) e diz, com todas as letras, para não usar o plano gratuito
da Vercel.

**Motivo da exceção:** ver o sistema no ar hoje, sem gastar a sessão configurando
adaptador. Decisão do dono, tomada com o conflito explicado na tela.

**O que exatamente é o problema:** o termo do plano Hobby proíbe uso comercial, e
um painel que opera links de afiliado é uso comercial. O risco não é multa — é
**suspensão da conta**, e a conta é a mesma dos outros aplicativos da 4YU.

**O que reduziria o risco, e NÃO está no lugar.** Esta decisão dizia, em 31/07,
que a *Deployment Protection* estava ligada e que por isso o painel só abriria
para quem tem acesso à conta. **Conferido na mesma noite: está desligada.** As
três URLs servem a tela de login com 200 para qualquer pessoa na internet, e a
API do projeto confirma (`ssoProtection: null`, `passwordProtection: null`).

O dono foi avisado e **decidiu deixar aberto por enquanto**, com o argumento de
que não há publicação real saindo dali. A decisão é dele e está registrada; o que
não pode continuar é esta página afirmando uma proteção que não existe — mitigação
escrita e não aplicada é pior que mitigação nenhuma, porque a próxima pessoa lê e
para de procurar.

**Para religar**, quando for a hora: *Vercel → radar-ofertas → Settings →
Deployment Protection → Vercel Authentication*.

**Prazo, e é o que faz disto dívida e não desleixo:** sair da Vercel Hobby **antes
da primeira publicação real em canal com audiência**. Nesse dia, uma de duas:

1. **Cloudflare Workers com OpenNext**, como a D-016 decidiu — gratuito, permite
   uso comercial, e o limite de 3 MiB do Worker precisa ser medido antes.
2. **Vercel Pro**, US$ 20/mês, se a fricção do adaptador custar mais que isso.

**Mudaria se:** a Vercel passar a permitir uso comercial no plano gratuito, o que
não deve acontecer.

---

## D-033 · Curadoria automática e ritmo de publicação
**Data:** 2026-08-01

O dono encerrou a aprovação manual: *"ninguém vai ficar na minha equipe
vasculhando sobre o vendedor. Isso tem que ser automático."* Está certo:
aprovação a mão não sobrevive a trinta ofertas por dia, e muito menos a
sete canais.

Isso substitui o desenho anterior, em que `/aprovar` era a casa do dono.
**A tela continua existindo e deixa de ser obrigatória** — vira conferência
e correção, não porta.

### Os critérios que substituem o olho humano

Aprovados pelo dono em 01/08. Todos vivem em `parametro`, para calibrar
sem publicar versão (D-023).

| Critério | Valor | Por quê |
|---|---|---|
| Nota do produto | ≥ 3,5 | do dono. Produto ruim queima o canal igual a preço falso |
| Avaliações do produto | ≥ 20 | 5,0 com duas avaliações é ruído, não sinal |
| Reputação do vendedor | ≥ 0,6 | corta vermelho e laranja, deixa amarelo para cima |
| Vendas do vendedor | ≥ 100 | verde com 16 vendas é novato sortudo, não histórico |
| Produto novo | sim | desconto em usado não é a mesma oferta |

**A dispensa que o dono pediu, e ela é sólida:** loja oficial ou vendedor
platinum **dispensa a exigência de avaliações do produto**. Se a Anker está
vendendo, produto lançado ontem com zero avaliação pode ir. A confiança vem
da marca, não do histórico do item.

### O que foi recusado, e por quê

O dono propôs: se o mesmo produto tem um vendedor ótimo e um mediano,
publicar o mediano também, porque o produto já se provou.

**Não.** A nota é do **produto de catálogo**, agregada entre todos os
vendedores — o mediano está pegando emprestada a reputação dos outros. E o
risco que o vendedor carrega não é o produto ser bom: é **chegar**, ser
**original** e ter **troca**. Produto comprovadamente bom vendido por gente
duvidosa é a descrição de falsificação e de não entrega, e a nota alta é
justamente o que dá confiança falsa.

**A intuição estava certa apontada para o outro lado:** publique o anúncio
do vendedor bom, não o do mediano. Não se perde a oferta, troca-se de
vendedor.

Isso expôs um defeito: `melhorOferta` escolhe **o menor preço**, ponto. Hoje
o vendedor de nível vermelho com 16 vendas ganharia por dois reais de
diferença. Passa a escolher a melhor combinação de preço e vendedor, com
tolerância de até 5% mais caro para ficar com o vendedor bom.

### O ritmo

A pesquisa de 28/07 fixou **5 a 8 por dia**, e isso era sobre **WhatsApp**.
Canal de Telegram é outra coisa: não notifica como grupo, o membro não vê
badge de não lido do mesmo jeito, e a referência de mercado para canal de
nicho é **20 a 50 por dia**. Aplicar o número do WhatsApp ao Telegram
desperdiçaria o canal; aplicar o do Telegram ao WhatsApp mataria o grupo.

**Então o ritmo é por plataforma e por faixa do dia**, e o que ele controla
é o **intervalo mínimo entre posts**, não uma cota:

| Faixa (São Paulo) | Telegram | Por quê |
|---|---|---|
| Pico (07–09, 12–13, 19–22) | 1 a cada 10 min | é quando a pessoa está no celular |
| Normal (09–19, 22–00) | 1 a cada 30 min | mantém vivo sem cansar |
| Madrugada (00–07) | 1 a cada 90 min | o dono confirmou que os concorrentes publicam de madrugada e ele mesmo vê |

Intervalo, e não cota diária, porque cota gasta tudo de manhã e deixa a
tarde muda. O teto diário do canal (`posts_por_dia_max`) continua valendo
por cima — é o combinado com o parceiro.

**Dia de pico** (Black Friday, 8.8, Dia das Mães) é a exceção que o dono
levantou: *"é o dia que a galera está maluca"*. Vira um multiplicador ligado
à mão, que divide os intervalos por três. Ligado à mão de propósito: sistema
que decide sozinho que hoje é dia especial vai errar no dia comum.

**O WhatsApp continua manual e continua em 5 a 8 por dia.** A regra 3.2 não
muda, e o número da pesquisa de 28/07 segue valendo para ele.

**Mudaria se:** os números do Telegram derrubarem engajamento na prática. A
medida honesta é a taxa de clique por post, e ela só existe depois do
redirecionador.

---

## D-034 · O link de afiliado é gerado, nunca montado
**Data:** 01/08/2026

Nós montávamos o link colando `?matt_word=<subid>&matt_tool=66367903`
numa URL comum de produto. **Isso não atribui comissão.** Três
evidências independentes:

1. O material do próprio programa diz que link comum, sem passar pelo
   gerador, não paga.
2. Passando o NOSSO link pelo gerador, ele **descartou** o nosso
   `matt_word` e criou um `ref=` cifrado. Se os parâmetros bastassem,
   esse token não precisaria existir.
3. A resposta traz `type_url: SOCIAL_PROFILE_ENCRYPTED` — a atribuição
   vive dentro do `ref`, não na query.

**Sete publicações saíram com o link errado** antes disso ficar claro.
Elas ficam no banco: a constraint `publicacao_enviada_tem_link` entrou
`not valid` de propósito, porque apagá-las esconderia a evidência de
quanto o erro custou.

**Não existe API oficial de afiliados.** 15 rotas varridas em
`api.mercadolibre.com`, todas 404, e nada no portal do desenvolvedor. O
caminho é o endpoint interno da Central:

```
POST /affiliate-program/api/v2/affiliates/createLink
{"urls": ["..."], "tag": "radarpet"}
```

Aceita lote (4 testados numa chamada). Repetir a mesma URL com a mesma
etiqueta devolve o mesmo `meli.la`, então não duplica. A sessão vive em
`credencial_rotativa`, **expira sozinha**, e quando expirar nada é
publicado — que é o desfecho certo.

**O link é gerado por ÚLTIMO**, só do que já passou nas comportas e
ganhou a vez no ritmo. São dezenas por dia, não milhares.

**Mudaria se:** o ML publicar uma API de afiliados, ou se a sessão
virar inviável de manter.

---

## D-035 · A granularidade do subid é por canal, não por publicação
**Data:** 01/08/2026

Esta era a pergunta que a Fase 0 devia responder, e ela ficou
respondida por teste, não por opinião. Chamando o gerador com uma
etiqueta inventada:

```
{"message":"Tag is not associated with this affiliate.","error_code":109}
```

A etiqueta precisa estar cadastrada na Central. Logo **o Mercado Livre
não oferece atribuição por publicação** — o mais fino que existe é por
etiqueta.

**Uma etiqueta por canal.** Isso entrega o que o negócio precisa: saber
qual grupo gerou qual venda, que é a base do split (`docs/negocio.md`).

**Saber qual POST vendeu vem do nosso lado**, com o redirecionador
próprio da Fase 2: o link do canal aponta para o nosso domínio com o
subid, contamos o clique, e redirecionamos para o link do ML com a
etiqueta do canal. Os dois níveis convivem.

A **regra 3.6 continua valendo**. O que muda é onde ela é cumprida.

---

## D-036 · O produto tem identidade, e o diagnóstico que a criou estava errado
**Data:** 01/08/2026

O dono perguntou por que o canal publicou uma ração a R$ 130,00 se
existia outra a R$ 119,90. Eu respondi que era o mesmo saco em dois
catálogos do ML. **Metade estava certo.**

**O que era verdade:** o `docs/dados.md` sempre disse que `produto` é
"a identidade da coisa", e o código chaveava `produto` pelo **título do
catálogo**. Cada título virava um produto nosso, e a comparação de
preço nunca atravessava entre eles. O modelo estava certo no papel e
errado na implementação.

**O que era falso:** aquela ração não é o mesmo produto. Eu comparei
quatro atributos e concluí "idênticos". A lista completa desmente:
`PACKAGING_TYPE` Saco contra Sachê, `NET_WEIGHT` 10 kg contra 10,1 kg,
e fórmulas diferentes em `NUTRIENTS_SUPPLY`.

### A lição, e ela é de método

A primeira versão da chave usava uma **lista branca** de atributos. Ela
errou três vezes contra o catálogo real:

| Casou errado | Faltava na lista |
|---|---|
| Galaxy A17 128GB com 256GB (R$ 925 vs R$ 1.877) | `INTERNAL_MEMORY` |
| Cabo HDMI 5m com 20m | o comprimento |
| Essência de Bambu com a de Lavanda | `FRAGRANCE` |

Cada correção consertava o caso visto e deixava o próximo passar,
porque cada domínio do ML tem o seu atributo discriminante e são
milhares. **A lista virou preta:** atributo desconhecido agora
**separa** em vez de ser ignorado.

Mais duas travas: as quantidades do título precisam bater, e a decisão
final é **aos pares**, olhando os atributos dos dois catálogos — o que
uma chave calculada com um produto por vez não consegue fazer.

### O resultado

A primeira fusão juntou 23 produtos. A revisão com as regras estritas
**separou 27 prateleiras de volta**, e sobrou **zero duplicata real** na
base. O mecanismo está construído e testado com 28 casos, e hoje não
encontra nada: é guarda para quando o caso aparecer, não economia em
curso. A view `economia_por_identidade` é onde ela apareceria.

**Mudaria se:** `economia_por_identidade` deixar de ser vazia.

---

## D-037 · A base própria substitui a dependência de canais alheios
**Data:** 01/08/2026 · **PROPOSTA, não implementada**

Decisão de direção do dono: *"faz mais sentido a gente puxar vários
produtos do Mercado Livre, e qualquer flutuação nesses produtos a gente
já manda no grupo. Daí a gente não fica à mercê de outros grupos."*

**Concordo, e o motivo mais forte não foi citado:** a colheita de canais
é **derivativa**. Republicamos o que outro canal já publicou, então
nunca somos os primeiros. Base própria é a única forma de ser primeiro.

E o `original_price` (D da migration 23) reforça: um produto vira
candidato **na primeira leitura**, sem esperar duas. Base grande paga no
mesmo dia em que entra.

### O que eu corrijo na proposta

*"Consultar a cada cinco minutos"* mistura duas coisas:

- **Largura** aumenta *quantas* ofertas existem.
- **Frequência** aumenta o *frescor*, a chance de a oferta ainda estar
  viva quando publicamos.

Ler 500 produtos a cada 5 minutos encontra menos que ler 10.000 a cada
meia hora. **Largura primeiro.**

### O que foi medido

**A API do ML aguenta muito mais do que usamos:**

```
 4 em paralelo:  19 chamadas/s
 8 em paralelo:  31 chamadas/s
16 em paralelo:  57 chamadas/s   ← zero bloqueio 429
```

A 57/s, **10.000 anúncios levam 3 minutos**. Largura é barata do lado
do ML.

**O gargalo é a nossa escrita**, e é defeito de desenho: o coletor grava
dois RPC por anúncio **toda vez**, mesmo com o preço parado. Com 10.000
a cada 5 minutos são 5,76 milhões de chamadas por dia para gravar quase
sempre o mesmo número. Medido nas rodadas de 01/08: **entre 0% e 5% dos
preços mexem** entre leituras. Gravar só o que mudou corta ~95%.

### O desenho proposto

| Ritmo | O quê | Quando |
|---|---|---|
| Varredura larga | a base inteira | a cada 30 min |
| Lista quente | o que mexeu em 24h e o de nota alta | a cada 10 min |

Com três consertos juntos: gravar só o que muda; descoberta por
subcategoria (hoje são só as 28 raízes); e expurgo mais agressivo do
`preco_ponto`.

**Mudaria se:** a medida de `ofertas_por_dia` mostrar que a base atual
já basta para as 30/dia da Fase 1. Hoje esse número não tem uma semana
de dados, e é ele que diz quantos produtos são necessários em vez de
chutar "muitos".

---

## D-038 · O repositório virou público, e o agendador fica
**Data:** 01/08/2026 · **RESOLVIDO no mesmo dia**

A D-015 escolheu GitHub Actions em vez de `pg_cron`, e os motivos dela
continuam válidos (mantém o Supabase acordado, falha de forma visível).
**O que mudou foi a escala.**

**O repositório é privado** (conferido: a API do GitHub responde 404 sem
autenticação). Isso dá **2.000 minutos/mês grátis**. O cron de hora em
hora, com coleta e publicação, gasta entre 3 e 5 minutos por execução:

```
24 execuções/dia × 3 a 5 min = 72 a 120 min/dia = 2.160 a 3.600 min/mês
```

**Já estamos no limite ou passando dele hoje**, antes de qualquer
ampliação de base. Um cron de 5 minutos seriam ~26.000 min/mês.

### Os caminhos, e o que cada um custa

| Caminho | Custo | Observação |
|---|---|---|
| **Tornar o repositório público** | zero | Minutos ilimitados. Os segredos já vivem em Secrets, não no código. É o mais barato de longe |
| Cloudflare Workers + Cron Triggers | US$ 5/mês | Combina com a stack (o painel já vai para Workers). Limite de CPU por invocação exige quebrar a varredura em fila |
| Máquina pequena sempre ligada | US$ 5 a 10/mês | Sem limite de duração, cron confiável no minuto |
| `pg_cron` no Supabase | incluso | Desfaz a D-015: falha silenciosa volta a ser o padrão |

**Uma coisa vale dita de qualquer jeito:** o cron do GitHub Actions
**não é confiável abaixo de uns 10 minutos** — agendamentos atrasam
rotineiramente. Se 5 minutos virar requisito de verdade, ele está fora
por razão técnica, não só por custo.

**A posição do dono sobre custo, registrada:** *"se em dois meses esse
grupo der resultado, a gente muda pro modo pago. Dando lucro, eu não
tenho problema de pagar ferramentas."* Então o critério aqui não é
economizar, é **não pagar antes de ter receita**.

### Como ficou

**O dono tornou o repositório público em 01/08.** Conferido: a API do
GitHub responde 200 e `visibility: public`. Com isso os minutos de
Actions são **ilimitados**, e a D-015 continua valendo inteira: o
agendador fica onde está, sem migração e sem custo.

Os outros caminhos ficam registrados para o dia em que um cron de 5
minutos virar requisito de verdade — aí o GitHub sai por **razão
técnica**, não por custo: agendamento dele atrasa rotineiramente abaixo
de uns 10 minutos.

### A varredura de segredos que isso obrigou

Repositório público significa **histórico legível por qualquer um**,
não só o código de hoje. Varri antes de anotar, comparando os valores
reais do `.env` contra todos os commits.

**Os 12 segredos de verdade estão limpos**, nenhum aparece em nenhum
commit:

`SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_DB_PASSWORD` ·
`NEXT_PUBLIC_SUPABASE_ANON_KEY` · `ML_CLIENT_SECRET` ·
`ML_REFRESH_TOKEN` · `TELEGRAM_BOT_TOKEN` · `COLETA_SEGREDO` ·
`SAL_HASH_IP` · `CONTA_PAINEL_SENHA` · `CONTA_DE_CAPTURA_SENHA` ·
`URL_BASE_REDIRECIONADOR` · `VERCEL_OIDC_TOKEN`

Nenhum arquivo `.env` jamais entrou no Git — só o `.env.example`. A
regra 3.1 foi cumprida desde o começo, e agora tem prova.

**O que aparece no histórico e não é segredo:** `ML_CLIENT_ID` (está no
AGENTS de propósito), `SUPABASE_PROJECT_REF` e `NEXT_PUBLIC_SUPABASE_URL`
(vão no navegador de qualquer jeito), `PAINEL_URL`, `TZ`, e os
**e-mails das contas de teste**. Os e-mails são o único incômodo real:
são endereços pessoais agora públicos. Não é vazamento de credencial,
mas se incomodar, trocar as contas de teste resolve.

**O que a mudança obriga daqui para frente:** com o repositório aberto,
qualquer segredo commitado por engano vira público no instante do push,
e apagar depois não resolve — o histórico fica. A regra 3.1 deixou de
ser higiene e virou fronteira.

---

## D-039 · O cupom é colhido do texto dos canais, e só sai com escopo conhecido
**Data:** 01/08/2026

A tabela `cupom`, a view `cupons_vivos` e a função `preco_com_cupom`
existem desde a migration 17. O que nunca existiu foi **quem alimenta**:
o comentário de `app/acoes/cupons.ts` explicava que *"cupom é digitado à
mão porque nenhum marketplace expõe cupom por API"*.

**Continua verdade sobre API.** A pesquisa varreu 15 rotas plausíveis do
Mercado Livre e todas deram 404: o único endpoint de cupom documentado é
o do **vendedor** gerenciando a própria campanha. Não é falta de
permissão, é ausência de recurso.

**Deixou de ser o único caminho.** O cupom é público, distribuído por
banner e push dentro do app, e chega de graça pelos canais que a colheita
já lê. O formato foi confirmado em campo, em dois dias e três canais:
`<CATEGORIA><DDMM>` — `FULL3107`, `LOJASOFICIAIS0108`, `MODAEBELEZA0108`.

### A âncora de extração é a data, e é ela que torna isto seguro

Procurar "palavra em maiúscula" acharia PROMOÇÃO, OFERTA, FRETE e metade
dos títulos de produto. Exigir quatro dígitos que formem **dia e mês
válidos** derruba quase todo falso positivo sem lista de exceção.

E o código traz a própria validade dentro dele, o que resolve o que o
comentário da tabela já avisava: *"cupom sem prazo é o que fica publicado
depois de morrer"*.

### O escopo, que é o que impede repetir o erro da mangueira

`cupom.nicho_id` tem a semântica "nulo = vale para qualquer nicho", e a
extração **não sabe o nicho**: ela lê o prefixo da campanha, não o nosso.
Tudo nascendo nulo faria `MODAEBELEZA0108` sair num canal de pet, que é a
mangueira de jardim de novo.

Então `cupom_prefixo` mapeia campanha para escopo, com a regra da D-036:
**desconhecido separa**. Prefixo sem linha entra no banco e não é
publicado até alguém olhar.

### Só Mercado Livre, e a exclusão da Shopee é contratual

Termo do Programa de Afiliados da Shopee: *"A divulgação ou
compartilhamento de cupons nominais de afiliados terceiros pelo Afiliado
será considerada violação"*, com rescisão imediata e retenção de comissão
já ganha. O filtro de data já exclui os códigos dela (são leetspeak, sem
data), mas a exclusão é deliberada e precisa continuar sendo.

### Por que o post de cupom vale agora

Ele **não depende de série de preço nenhuma**. Com a série tendo dois
dias, quase toda oferta de hoje vem do `original_price` declarado pela
loja. O cupom é verdade verificável no primeiro dia, e é o que os
concorrentes publicam de madrugada.

**A ingestão mora em `scripts/colhe-cupons.mjs`, no agendador horário**,
porque cupom que vale um dia não pode depender de alguém lembrar. A Edge
Function `colheita-canais` tem o mesmo código e foi implantada em 01/08 à
tarde, junto de um passo novo na rotina diária: ela existia desde 28/07 e
**não era chamada por workflow nenhum**. Numa invocação trouxe 35 anúncios
novos, catálogo que simplesmente não entrava.

### Os três formatos de canal, e o erro que eles pegaram

Ler canal de verdade derrubou a primeira versão da extração. Os canais
escrevem de três jeitos, e qualquer regra de direção fixa erra em um:

| Canal | Formato |
|---|---|
| `@canaldeofertasecupons` | valores **depois** do código |
| `@promotop` | valores **antes**, dois cupons na mesma mensagem |
| `@CupomDoGnu` | valores antes, com linha em branco no meio |

Procurando para a frente primeiro, o `@promotop` dava ao `MODAEBELEZA` os
15% do `LOJASOFICIAIS` — o percentual do bloco de baixo fica logo depois
do código de cima. **Isso publicaria desconto que não existe.** A busca
passou a ser por linha, saindo do código e alternando os lados, com o
mínimo e o teto saindo do mesmo bloco do percentual.

### Quando os canais discordam, vale o que promete menos

E eles discordam, no mesmo cupom e no mesmo dia:

```
@CupomDoGnu   MODAEBELEZA0108  20%  mínimo R$ 59  teto R$ 20
@promotop     MODAEBELEZA0108  20%  mínimo R$ 49  teto R$ 30
```

Não dá para saber qual está certo: lemos de terceiro, não do Mercado
Livre. Errar para o lado generoso custa a confiança do grupo, porque quem
chega no carrinho com R$ 50 esperando desconto não volta; errar para o
lado apertado custa uma surpresa boa. A agregação fica com o **maior
mínimo, o menor teto e o menor percentual**.

**Mudaria se:** o ML publicar uma rota de cupom para terceiros, ou se a
Central de Afiliados permitir gerar cupom próprio (a hipótese 4 de
`docs/pesquisa/cupons-de-onde-vem.md`, ainda não testada).

---

## D-040 · O link vem do gerador em todo caminho, e falha de registro não é silenciosa
**Data:** 01/08/2026

A D-034 estabeleceu que o link de afiliado é **gerado, nunca montado**.
Ela foi aplicada no laço automático e **não na tela** — `lib/publicacoes.ts`
continuou remontando o link à mão com `montaLinkDeAfiliado`, ignorando a
coluna `publicacao.link_afiliado`.

O dono publicou pela tela e viu o sintoma: os links abriam o produto
direto, sem passar pela página do afiliado. A diferença, conferida:

```
meli.la/1QPWrnS → 301 → mercadolivre.com.br/social/fega6031503
                        ?matt_word=radarpet&ref=BCVd2UBeH...
```

Essa página intermediária é onde a atribuição acontece.

### O segundo defeito, que era pior e ninguém via

A constraint `publicacao_enviada_tem_link` é `not valid`, e **isso não
quer dizer desligada**: ela não revalida linha antiga, mas vale para todo
`UPDATE`. Então a cadeia era:

1. a tela mandava a mensagem, e ela **chegava no grupo**
2. o `UPDATE` para `enviada` era recusado pela constraint
3. o erro não era conferido, a linha continuava `pendente`
4. a tela mostrava "não enviada", e o dono clicava de novo
5. **o grupo recebia a mesma oferta duas, três vezes**

Nove publicações foram ao canal assim. O canal viu; o sistema não.

### O que passou a valer

- A tela usa `publicacao.link_afiliado`. Sem ele, devolve
  `rastreado: false` com o motivo, e **não cai de volta na URL crua**:
  publicar sem rastreio parece que funcionou e entrega a audiência de
  graça.
- `publicaLoteTelegram` recusa publicar quando o link não é rastreado.
- `marcaEnviada` **confere o erro e lança**. Falha silenciosa aqui foi o
  que multiplicou o estrago de uma mensagem para três.
- As nove linhas ficaram como `enviada` com origem `auto_declarada`, que
  é a verdade: um humano mandou, o sistema não registrou. Sem isso o laço
  automático as mandaria uma quarta vez.

**Duas imprecisões conhecidas, anotadas e não corrigidas:**

- `desfazEnvio` volta a publicação para `pendente` mas **não desfaz**
  `canal.ultima_publicacao_em`. O ritmo passa a achar que o canal acabou
  de falar. Some sozinho no próximo intervalo.
- O comentário da migration 29 diz que o WhatsApp fica de fora da
  constraint, e **a constraint não tem cláusula de plataforma**. Envio de
  WhatsApp sem link cai na mesma recusa. Agora ela é visível em vez de
  silenciosa.

**Mudaria se:** o gerador do ML deixar de existir, ou se aparecer uma API
oficial de afiliados que dispense a sessão da Central.
