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

---

## D-041 · Ramo secundário: o canal tem miolo e periferia
**Data:** 01/08/2026

A descida por subcategoria multiplicou a largura da descoberta e trouxe
junto um efeito que só apareceu lendo o canal: o "Pet Shop" do Mercado
Livre tem **28 filhas**, e entre elas estão Cavalos, Peixes, Aves,
Répteis, Roedores, Coelhos e Insetos. Um suplemento equino saiu no canal
e é legitimamente pet — e num canal de cão e gato é ruído.

A pesquisa de campo põe **irrelevância ao lado do volume** como motivo de
alguém sair de um canal (`docs/pesquisa/sintese.md` §5), então isso não é
preciosismo: é o mesmo risco do excesso de post, por outra porta.

Regra do dono: *"só pode postar água de equinos, peixes e afins depois de
4 de cachorros/gatos"*. E a ressalva dele veio junto, correta: *"é bem
específico pra esse nicho de pet"*.

### Por isso a regra não é de pet

O que se modela é **ramo secundário dentro de um nicho**, com proporção
configurável. Pet é o primeiro caso; eletrônico vai ter o dele (acessório
contra aparelho) e casa também.

**O ramo é a filha direta da raiz** na árvore do marketplace, e é a
granularidade certa entre as duas que já existiam:

| Camada | Quantas | Serve para |
|---|---|---|
| Raiz (`categoria_raiz`) | 28 | decidir o nicho |
| **Ramo (`categoria_ramo`)** | ~28 por raiz | **separar miolo de periferia** |
| Domínio (`dominio_externo`) | milhares | decidir o nicho quando tem opinião |

Ele sai de `path_from_root[1]`, na **mesma resposta** que o coletor já
pede para descobrir a raiz. Custo zero de chamada nova: o dado era
descartado.

### Presença marca, e o desconhecido passa

`ramo_secundario` lista os ramos que entram na proporção. Ramo sem linha
é primário.

**Isso é o contrário da D-036 de propósito**, e a diferença é o custo de
errar: lá, desconhecido separa porque o estrago seria publicar produto
errado; aqui, desconhecido passa porque o estrago seria **calar o canal
por falta de cadastro**.

### Como a comporta age

O secundário não é descartado: ele **fica na fila** e o laço pega o
próximo primário. Só quando sobra apenas secundário sem cota cumprida é
que o canal encerra a rodada — e eles voltam na seguinte.

A contagem vem do que o canal **realmente publicou hoje**, não zerada a
cada execução. Zerando, cada rodada horária teria direito a um secundário
logo de cara, e um para quatro viraria um para dois no fim do dia.

O cupom não conta como primário: ele não é de ramo nenhum.

### O que o catálogo diz hoje

```
103  MLB1072  Cães      primário
 41  MLB1081  Gatos     primário
 11  MLB1100  Aves      SECUNDÁRIO
  3  MLB1117  Cavalos   SECUNDÁRIO
  2  MLB1091  Peixes    SECUNDÁRIO
```

146 primários contra 16 secundários. A proporção de um para quatro não
aperta o canal: ela impede o agrupamento.

A view `ramos_do_catalogo` é o insumo para marcar os próximos, e
`primarios_por_secundario` (padrão 4) calibra sem publicar versão.

**Mudaria se:** a medida de clique por post mostrar que o secundário
performa igual ao primário — aí a periferia não é periferia, e o canal é
de pet mesmo, não de cão e gato.

---

## D-042 · O canal filtra por atributo, e "perfume masculino" não vira nicho
**Data:** 2026-08-01

O dono abriu seis canais de Telegram de uma vez — Fitness, Tech, Geek,
Kids, Beauty e Perfumes (masc). Cinco couberam no modelo existente. O
sexto não, e o motivo é instrutivo.

### Nicho responde de que prateleira é, e só isso

"Perfume" é nicho: existe como `MLB-PERFUMES` no Mercado Livre.
**"Masculino" não é.** O ML põe todo perfume na mesma prateleira e
distingue por um atributo, `GENDER`, cujos valores observados em 01/08
são Masculino, Feminino, Meninos, Meninas e Sem gênero.

Os dois caminhos sem tabela nova eram piores:

- **Nicho `perfume_masculino`** — obriga a decidir o gênero na hora de
  classificar, e a duplicar o nicho a cada recorte novo. Amanhã seria
  `perfume_feminino`, `tenis_infantil`, `moda_plus_size`.
- **Sem filtro** — um canal anunciado como masculino publica Floratta.

Então entra `canal_atributo`: canal, atributo, valores, e modo `inclui`
ou `exclui`. **O filtro é do canal, não do produto** — o produto continua
sendo um perfume, sempre; quem tem preferência é o canal. É a mesma
separação que já existe entre `produto` e `canal` no resto do modelo.

Os dois modos existem porque o par Beauty/Perfumes precisa dos dois
lados: um fica com o masculino, o outro com todo o resto. Assim nenhum
perfume fica sem canal e nenhum sai repetido nos dois.

### Ausência de linha é "aceita tudo", e produto sem o atributo passa

Canal sem filtro se comporta exatamente como antes desta decisão —
nenhum dos canais existentes muda por a tabela existir.

E **produto que não declara o atributo passa**. Boa parte do catálogo do
ML não preenche boa parte dos atributos, e reprovar por ausência calaria
o canal por causa do cadastro de um terceiro. Mesma escolha da D-041:
quando o custo de errar é "o canal fica mudo", o desconhecido passa.

### A reprova ganha motivo próprio

`filtro_de_atributo` é separado de `nenhum_canal_do_nicho` de propósito.
São coisas diferentes: nicho sem canal é buraco de cobertura e pede canal
novo; atributo que não passa é a preferência do canal funcionando e não
pede nada. Somados num motivo só, o primeiro ficaria invisível dentro do
segundo.

**Mudaria se:** o recorte passar a precisar de faixa numérica (preço
acima de X, peso abaixo de Y). `valores text[]` só compara igualdade, e
aí a tabela precisa de operador.

---

## D-043 · Seis canais de uma vez, e por que a recomendação de começar com dois foi vencida
**Data:** 2026-08-01

A recomendação técnica era abrir dois canais e crescer com dado. O dono
decidiu abrir seis, e a decisão é dele: *"eu não ligo sinceramente pra
isso, eu já estou decidido"*.

Fica registrado o risco que a recomendação carregava, porque ele não
some por a decisão ter sido tomada: **com a base de hoje, o gargalo é
oferta detectada, não canal**. Seis canais dividem o mesmo fluxo, e canal
que posta uma vez por dia o membro silencia na primeira semana. A
pesquisa de campo põe irrelevância ao lado do volume como motivo de saída
(`docs/pesquisa/sintese.md` §5).

O que a abertura mudou de concreto, e isso é ganho real:

- **A descoberta desce onde há canal** (D-037). Eram 28 subcategorias sob
  uma raiz; passaram a ser **196 sob onze raízes**. A base cresce em
  todos os nichos ao mesmo tempo, e é a base que produz oferta.
- **Nicho sem canal virou nicho com canal.** `esporte`, `bebe`,
  `brinquedo`, `games` e `beleza` foram criados vazios em 01/08
  justamente para o canal nascer com histórico. Nasceram.
- Três domínios voltaram a rotear (`MLB-FOOTBALL_BALLS`,
  `MLB-TOY_MICROWAVES`, `MLB-TELEPROMPTERS`), porque estavam fora só por
  falta de canal.

**A medida que decide se estava certo:** posts por canal por dia, ao fim
da primeira semana. Se algum canal ficar abaixo de dois, ele não é canal
— é uma lista de espera, e vale desligar até a base sustentar.

**Mudaria se:** a medida acima mostrar que sobra fila. Aí o freio era
imaginário e cabe abrir mais.

---

## D-044 · O canal é identificado pelo @nome público, não pelo id numérico
**Data:** 2026-08-01

Os seis canais novos foram cadastrados com o id numérico lido de
`getUpdates`. Horas depois o dono abriu os grupos ao público, e **todos
os seis ids morreram**:

```
Radar Tech   -5590063497  (group)  →  -1003978161593  (supergroup)
```

O Telegram converte grupo comum em supergrupo quando o grupo é aberto ao
público — e a conversão troca o identificador. O id velho **não dá erro
claro**: o post simplesmente não chega, e o sintoma é canal mudo sem
pista nenhuma.

Daqui em diante o identificador é o `@nome` público, que sobrevive à
conversão. O Radar Pet já usava `@radarpet` por acidente feliz, e foi o
único que não quebrou.

**O custo:** canal privado não tem @nome, e para ele o id numérico
continua sendo o único caminho — com este risco embutido. Se algum canal
precisar ser privado, o cadastro dele precisa ser reconferido a cada
mudança de configuração do grupo.

**Mudaria se:** o Telegram passar a manter o id na conversão, o que não
está anunciado em lugar nenhum.

---

## D-045 · A etiqueta de afiliado é por canal, e o Beauty não tem a dele
**Data:** 2026-08-01

`canal.etiqueta_afiliado` é o que atribui a comissão ao canal (D-035), e
**a etiqueta precisa existir na Central de Afiliados**: inventar uma
devolve `Tag is not associated with this affiliate` (código 109) e o
canal fica mudo, sem link.

As doze etiquetas criadas pelo dono foram conferidas uma a uma contra o
gerador em 01/08. Cinco dos seis canais novos casaram pelo nome:

| Canal | Etiqueta | Conferida |
|---|---|---|
| Radar Fitness | `radarfitness` | ✓ |
| Radar Tech | `radartech` | ✓ |
| Radar Geek | `radargeek` | ✓ |
| Radar Kids | `radarkids` | ✓ |
| Radar Perfumes (masc) | `radarperfumes` | ✓ |
| **Radar Beauty** | **`radargeral`** | ✓ — mas é remendo |

**`radarbeauty` não existe** (testada, código 109). O Beauty está usando
`radargeral` para não ficar mudo, e isso tem um custo real: a comissão
dele fica misturada com a de qualquer outro canal que use a mesma
etiqueta, e a atribuição por canal — que é o ponto inteiro da D-035 —
não vale para ele.

**Pendência para o dono:** criar `radarbeauty` na Central e rodar
`node --env-file=.env.producao scripts/cria-canais.mjs`. É uma linha no
script e trinta segundos no painel.

**Mudaria se:** a Central passar a aceitar criação de etiqueta por API,
que hoje não existe (a própria geração de link já é endpoint interno).

---

## D-046 · Uma execução do publicador por vez, com trava de prazo
**Data:** 2026-08-01

Observado no canal, não deduzido: às 19:36 e 19:41 os sete canais
publicaram duas vezes cada, com **44 segundos** de intervalo, contra os
cinco minutos configurados. Depois da trava, o mesmo canal passou a
publicar a cada 5 min 14 s.

**O ritmo não estava errado.** `podePublicarAgora` está correto e
testado. Eram duas instâncias do publicador no ar. Cada uma lê
`canal.ultima_publicacao_em` uma vez, no começo, e mantém a própria
cópia em memória — o que a outra grava, ela nunca vê. Com N processos o
canal fala N vezes mais.

**E o estrago pior não é o ritmo.** As duas leem a mesma fila de
`publicacao` com `estado = 'pendente'`, e nada impede as duas de
mandarem a MESMA mensagem. É a D-040 de novo, que custou nove
publicações repetidas.

Rodar à mão foi o que revelou, mas o agendador sozinho já corre o risco:
o cron dispara de hora em hora e a janela do publicador é de 50 minutos.
Um run que atrase dez minutos encontra o seguinte, e ninguém é avisado.

### Por que a trava é de tempo, e não de sessão

Advisory lock do Postgres seria o natural e **não serve**: cada chamada
via PostgREST é uma sessão nova, e o lock morre com ela. Então a trava é
uma linha com prazo. Quem toma escreve até quando; quem chega depois só
entra se o prazo venceu.

Prazo vencido destrava sozinho, e isso é o que impede um processo morto
de calar o sistema para sempre. A trava é solta no `finally`, não no fim
do `main`: erro no meio do laço deixaria o canal mudo por uma hora
depois de um problema que já passou.

**Mudaria se:** o publicador passar a rodar em processo único e
permanente, em vez de invocado pelo cron. Aí o problema não existe.

---

## D-047 · O padrão que se repetiu quatro vezes: o dado vem na resposta e é descartado
**Data:** 2026-08-01

Não é uma decisão nova, é o reconhecimento de um padrão — e ele merece
lugar próprio porque custou quatro defeitos no mesmo dia, todos com o
mesmo formato: **a informação estava na resposta da API, alguém a usou
para uma coisa só, e jogou o resto fora.**

| O dado | Vinha em | Era usado para | O que custou |
|---|---|---|---|
| `domain_id` | `products/{id}` | nada | whey no canal de pet (migration 24) |
| `shipping.free_shipping` | `products/{id}/items` | nada | a linha de frete que todo concorrente põe (migration 27) |
| `message_id` | resposta do `sendMessage` | dizer "deu certo" | nenhuma publicação podia ser apagada (migration 44) |
| `attributes` | `products/{id}` | montar a chave de identidade | Radar Perfumes mudo para sempre (01/08) |

O último é o mais instrutivo. `atributosDe(produto)` era chamado, o
resultado ia para `chaveDeIdentidade()`, e a variável morria ali. A
coluna `produto.atributos` existia desde a migration 31 e era preenchida
só por `funde-identidades.mjs`, que roda à parte: 471 de 1.714 produtos
a tinham. Quando o filtro de `GENDER` passou a exigir o atributo, os
sete perfumes do catálogo estavam todos sem ele.

**A regra que fica:** ao ler uma resposta de API, gravar o que ela traz
de estável e barato, mesmo sem uso imediato. O custo é uma coluna; o
custo de não gravar é descobrir meses depois que o dado nunca existiu no
banco, e que refazer o histórico é impossível.

Isso **não** vale para dado que a política de terceiro proíbe guardar —
preço e imagem da Amazon continuam com as 24 horas da regra 3.3.

**Mudaria se:** o custo de armazenamento passar a apertar. Hoje o
gargalo do plano gratuito é a série de preço, não a coluna de atributos.

---

## D-048 · O nicho ganha um terceiro nível, e o filtro de atributo ganha escopo
**Data:** 2026-08-01

Auditoria do dono, canal por canal, na primeira noite dos sete:
*"tem que revisar cada um pra estar CORRETOS"*. Ela achou dois buracos
de modelagem, e os dois são do mesmo tipo — uma regra que valia com um
canal e deixou de valer com sete.

### O ramo entra entre a raiz e o domínio

O Radar Fitness recebeu carabina de pressão, chumbinho de caça, lanterna
tática, perneira de equitação e taco de beisebol. **Tudo legitimamente
sob a raiz "Esportes e Fitness"**, que tem 40 filhas e só umas sete são
academia.

A regra de ramo secundário (D-041) não resolve isso porque ela é uma
**proporção**, não um filtro: quatro primários liberam um secundário.
Ela foi feita para "cavalo de vez em quando num canal de cão e gato",
que é dosagem. Aqui o problema é de pertencimento.

Faltava um nível:

| Camada | Quantas | Serve para |
|---|---|---|
| `nicho_categoria` (raiz) | 28 | cobre o site inteiro |
| **`nicho_ramo`** | ~30 por raiz | **separa o que a raiz mistura** |
| `nicho_dominio` | milhares | a exceção fina, e vence todas |

O ramo já era gravado em `anuncio.categoria_ramo` desde a D-041 e sai da
mesma resposta da API. Custo zero de chamada nova.

`esporte` continua existindo, agora sem canal: ele segue formando série
de preço para o dia em que houver um Radar Esportes. O Radar Fitness
passou a aceitar `fitness` + `suplemento`.

### Geek é cultura pop, não "colecionável"

O dono também corrigiu a definição do nicho: *"é coisa de NERD, star
wars, cultura pop, harry potter, RPG de mesa, controles de play, jogos
de play, não medalha acrílico cristal"*.

A migration 37 tinha montado `geek` como "colecionáveis e hobbies", e
colecionável é um guarda-chuva grande demais — cabe medalha, moeda,
selo, álbum de figurinha da Copa e aeromodelismo. Saíram para
`brinquedo` ou para fora: álbuns, figurinhas, miniatura de carro, cubo
mágico, aeromodelismo, medalha. "Antiguidades e Coleções" voltou a não
rotear.

**O que não dá para separar, e fica registrado:** `MLB-ACTION_FIGURES`
tem tanto action figure de colecionador quanto boneco infantil de
personagem, e o Mercado Livre não distingue os dois em nível nenhum da
árvore. O canal vai receber um carrinho da Patrulha Canina de vez em
quando.

### O filtro de atributo precisa de escopo

O filtro `GENDER exclui Masculino, exige` da D-042 valia para o canal
inteiro. O Radar Beauty aceita `beleza` **e** `perfume`, e shampoo,
protetor solar e absorvente não declaram gênero: caíam no `exige` e
seriam reprovados. **Doze produtos legítimos**, pegos na simulação de
`limpa-fila --seco` antes de chegarem ao canal.

`canal_atributo.nicho_id` resolve: o filtro só opina sobre o nicho dele.
Nulo continua valendo para o canal inteiro, que é o certo em canal de
nicho único.

**A lição geral:** quanto mais estreito o filtro, mais o escopo importa.
`exige_atributo` só faz sentido dentro do nicho onde aquele atributo é a
distinção; fora dele, exigir um atributo que a prateleira nem usa cala o
canal.

**Mudaria se:** aparecer um filtro que precise valer para dois nichos
mas não para o canal todo. Aí `nicho_id` vira lista.

---

## D-049 · A Amazon monta o link sozinha, e `ascsubtag` é o subid
**Data:** 2026-08-02

O dono trouxe links de afiliado que circulam em canais de oferta, e o
formato respondeu a pergunta que estava aberta desde a D-035: **onde vai
o subid na Amazon**. Vai em `ascsubtag`.

```
.../dp/B01I54ITP0?linkCode=sl2&tag=milena0fd-20&linkId=7e640a...
    &ref_=as_li_ss_tl&ascsubtag=srctok-116b638fd68bb173
    &btn_type=ss&btn_ref=srctok-116b638fd68bb173
```

### A Amazon é o caso fácil, e isso é contraintuitivo

Depois do trabalho que o Mercado Livre deu, a expectativa era que a
Amazon fosse pior. É o contrário:

| | Mercado Livre | Amazon |
|---|---|---|
| Link montado à mão paga? | **não** (D-034) | **sim** |
| Precisa de sessão logada? | sim | não |
| Etiqueta pré-cadastrada? | sim, por canal | não |
| Subid | `matt_word`, e o ML o descarta | `ascsubtag` |
| Falha por sessão expirada? | sim, é o motivo nº 1 de canal mudo | nunca |

O ML devolve um `ref=` cifrado e é obrigatório passar pelo gerador da
Central. A Amazon aceita a URL montada — é o mesmo formato que o
SiteStripe produz.

### O que fica de fora do link, e por quê

- **`linkId`** — o SiteStripe gera por link e não temos como criar.
- **`btn_type`, `btn_ref`, prefixo `srctok-`** — **não são da Amazon.**
  São da plataforma Button, que o autor daquele link usa como
  intermediária. Copiá-los atribuiria a venda a um terceiro.
- **O encurtador `link.amazon`** — não controlamos o destino, e o dono
  viu o risco sem querer: um dos links curtos que ele mandou levava a um
  headset em vez do perfume. O encurtador aponta para o que estava na
  tela na hora de gerar.

### Imagem da Amazon: preview, nunca `sendPhoto`

A regra 3.3 permite guardar o LINK da imagem por até 24h e proíbe
guardar a imagem. `sendPhoto` faz o **Telegram** baixar e hospedar o
arquivo por tempo indeterminado, o que é exatamente o que a política
veda.

A saída é o preview do Telegram: mandamos só a URL do produto, e quem
busca a imagem é ele, na hora — igual a qualquer pessoa colando um link.
`link_preview_options: { is_disabled: false, prefer_large_media: true }`.

**Mudaria se:** a Amazon liberar a Creators API para nós. Aí o link
continua igual, mas passa a haver preço, que é o que falta para a
Amazon virar fonte de oferta automática.

---

## D-050 · A primeira compra real de teste, e o que ela ainda precisa provar
**Data:** 2026-08-02

**Uma compra real foi feita por outra pessoa** (namorada do dono, não
autocompra — que é violação de termo nos três programas) por um dos
links publicados em 02/08. É a prova que a **Fase 0** existe para obter.

### O que conferir, e onde

A Fase 0 só fecha quando o subid aparecer no relatório. Os três links
publicados à mão em 02/08:

| subid | Canal | Loja | Produto |
|---|---|---|---|
| `vhzgpk65` | Radar Beauty | Amazon | Eudora Siàge Hair-Plastia |
| `68gbyqh7` | Radar Pet | Mercado Livre | Ração Golden Special Gatos 10,1kg |
| `mzd567xd` | Radar Pet | Mercado Livre | Areia Simple Cat 4kg |

Mais 166 publicações automáticas no Mercado Livre no mesmo dia.

- **Amazon** — Central de Associados, relatório de pedidos. O subid sai
  na coluna de *tracking ID / subtag*. Pedido costuma aparecer em 24h;
  a comissão só é confirmada depois do envio.
- **Mercado Livre** — Central de Afiliados. O subid vai em `matt_word`,
  e a granularidade é **por canal**, não por publicação (D-035).

### O que a compra NÃO prova ainda

Que o dinheiro chega. Comissão da Amazon só é paga com a situação
fiscal aceita, e em 31/07 ela estava como **"Enviado"**, ainda em
revisão. Se voltar pendente, a comissão acumula e não é paga.

**Enquanto o subid não for visto no relatório, a Fase 0 continua
aberta** — e com ela a decisão de granularidade que a D-035 tomou por
inferência.

---

## D-051 · A Creators API pede 10 vendas em 30 dias, e não há atalho
**Data:** 2026-08-02

Pesquisa feita a pedido do dono: *"ve ai como fazemos pra pegar a API da
Amazon creators, deve ter alguma forma q n sabemos"*.

**Não há.** A trava é dura e a documentação da Amazon é explícita: para
acessar a PA API através da Creators API é preciso ter **no mínimo 10
vendas qualificadas nos últimos 30 dias**.

E tem um detalhe pior, que muda o planejamento: se a conta ficar **30
dias consecutivos sem venda qualificada, o acesso é revogado**. Não é um
portão que se atravessa uma vez — é uma condição contínua.

A PA-API v5, que não tinha esse requisito, **já foi desligada**: virou
obsoleta em 30/04/2026 e o endpoint saiu do ar em 15/05/2026. Ela não
aceita cliente novo desde antes disso. Não há porta velha para usar.

### O caminho é o óbvio, e a própria Amazon o desenha assim

Publicar com link manual até somar 10 vendas, e só então pedir a API. É
o que a documentação dos plugins de afiliado recomenda para conta nova,
e é o que a nossa situação já é: **1 venda em 02/08** (D-050), faltam 9.

### As três rotas até lá, e por que a segunda é a certa

**1. Publicar Amazon à mão.** Funciona hoje: link e subid prontos desde
a D-049. É o que foi feito com o Eudora Siàge. Não escala.

**2. A colheita já traz Amazon, e nós ignorávamos.** Há 74 anúncios da
Amazon no banco, vindos de canais de terceiros, e `mencao` guarda
`preco_alegado_centavos` — o preço que o canal alheio anunciou. Esse
dado nunca foi usado para Amazon.

Ele não serve como série de preço (é alegação de terceiro, e a regra 3.3
proíbe histórico da Amazon de qualquer forma), mas serve como **fila de
sugestão**: o canal concorrente achou, nós conferimos e decidimos. É
exatamente onde eles são fortes e nós somos cegos.

**3. Ler o preço da página.** Foi como o preço do Eudora foi obtido em
02/08, com um `curl` único. Funciona, e **fica registrado como recusado
para rotina**: os termos do Programa de Associados proíbem scraping, e
aqui o que está em risco não é um coletor quebrado — é a conta que paga
a comissão. Diferente do Mercado Livre, onde raspar quebraria o dado; na
Amazon, raspar quebra o negócio.

**Mudaria se:** a Amazon abrir um nível da Creators API sem o requisito
de vendas, ou se as 10 vendas chegarem — que é o desfecho esperado e
depende de operação, não de código.

---

## D-052 · O agendamento do GitHub não é confiável, e a resposta é redundância
**Data:** 2026-08-03

O canal ficava mudo por horas e o ritmo levava a culpa. Não era ele.

**Medido em 03/08.** O cron pedia execução de hora em hora e o GitHub
entregou às **03:45, 07:23 e 11:21**. Buracos de quase quatro horas.
Dentro de cada execução o ritmo funcionava: 24 posts na rodada das
11:21, um a cada cinco minutos, e **180 publicações ficaram esperando**
quando a janela de 50 minutos fechou. O canal existia 50 minutos e
sumia por três.

**O agendamento do Actions é melhor esforço, não garantia.** Sob carga
ele atrasa e descarta, e repositório público espera mais.

### A primeira tentativa piorou, e vale registrar

A publicação saiu da "Coleta horária" e virou `publica.yml`, com cron
de 15 em 15 minutos. **Uma hora e quinze depois, o workflow novo tinha
rodado zero vezes** — o GitHub não ligou o agendamento novo — enquanto
a coleta rodou normal. Ou seja: a mudança feita para o canal falar mais
deixou o canal mudo.

**Cron novo não começa a valer só porque está no `main`.** Não descobri
o prazo, e não há como forçar.

**Correção do mesmo dia, às 19h:** ele acabou disparando — às 16:08 e às
18:04. Não é que nunca funcione: **é que funciona uma vez a cada oito**.
Entre aqueles dois horários deveriam ter acontecido oito execuções.

Isso é pior que não funcionar, porque parece configurado e não é
confiável. E leva à saída registrada em `docs/cron-externo.md`: **parar
de pedir e passar a mandar**, com um cron externo chamando a API de
`workflow_dispatch`. Esse caminho não passa pelo agendador do GitHub —
entra na fila como um push. Testado em 03/08, a execução começou em
segundos.

### O desenho que ficou

**Dois agendadores para a mesma tarefa**, e nenhum é dono:

1. **`pg_cron` dispara de 5 em 5 minutos** (acrescentado às 19h de 03/08, ver
   `docs/cron-externo.md`). É o caminho principal, e o único que de fato
   dispara na hora pedida.
2. `publica.yml` com cron do GitHub, de 15 em 15 minutos.
3. A "Coleta horária" publica no fim, como reserva de hora em hora.

Não duplica post porque a **trava de execução no banco (migration 45) é
única**: quem chega segundo encontra tomada e sai na hora. A trava tem
prazo, então execução que morrer no meio não trava o canal.

**A janela segue em 50 minutos, e não maior.** Aumentar faria o canal
depender de UMA execução dar certo. A cobertura vem da frequência.

**Mudaria se:** o sistema sair para um servidor com cron de verdade —
aí o publicador vira processo permanente e nada disto é necessário.

---

## D-053 · Não existe caminho oficial para publicar em grupo de WhatsApp
**Data:** 2026-08-03

Pesquisa a pedido do dono, que questionou a regra 3.2: *"essas regras
não ditam a verdade não, foi só o início do projeto"*. Justo. Então a
pergunta foi refeita do zero, sem assumir a regra como dada.

**A conclusão não mudou, e agora tem lastro.**

### A via oficial não cobre o nosso caso

- **Groups API** (lançada em 2026): teto de **8 participantes por
  grupo**. Grupo de ofertas tem centenas. Exige conta oficial verificada
  e bloqueia mensagem de comércio.
- **Broadcast com template de marketing**: cobra por conversa de 24
  horas, exige opt-in número a número, e é mensagem individual — não
  grupo.
- **Canais do WhatsApp**: não têm API de publicação. Só na mão.

Não é que não achamos. **Não existe.**

### O que o mercado usa, e o que custa

Bibliotecas que fazem engenharia reversa do WhatsApp Web: **Baileys**
(a dominante, as outras rodam por cima), **Evolution API** e **WAHA**
(camadas REST sobre ela), e **whatsapp-web.js** (automatiza um Chrome).

Prazo típico até a detecção: **2 a 8 semanas** — medido em quem dispara
para lista fria. **68%** das empresas pesquisadas que usaram ferramenta
não oficial relataram ao menos um banimento em 12 meses. A detecção é
automática: não depende de denúncia.

Isto explica a ementa dos cursos do nicho, que a pesquisa de 28/07 já
tinha achado e termina em *"gestão de múltiplos números para evitar
ban"*. Eles não resolveram o problema, distribuíram o prejuízo.

### Os números concretos, para quando isto for revisitado

**Aquecimento de número novo:** 20 a 50 mensagens/dia nos primeiros 3
dias; 100 a 200/dia entre os dias 8 e 14; volume de operação a partir
do dia 15. Aquecimento sério leva de 7 a 14 dias.

**Tetos de número maduro:** menos de 200 mensagens/dia e menos de 30
por hora.

**Sinais que derrubam:**
- bloqueio acima de **2%** derruba a qualidade; acima de **0,5%** já é
  zona de risco
- taxa de resposta abaixo de **15%** é zona de perigo
- ritmo mecânico é assinatura: intervalo fixo de 500 ms é sinal
  documentado
- mesma estrutura de mensagem para mais de **15 destinatários por
  hora** acumula marcação
- **o país do IP tem que bater com o do número** — número brasileiro
  conectado de servidor europeu é bandeira vermelha de primeira camada

### O nosso caso é mais leve que a média, e isto é inferência

Postar em grupo é **um envio**, não mil: o grupo distribui sozinho.
Espelhando o ritmo do Telegram, seriam ~30 publicações/dia por grupo, e
um número servindo os 7 grupos daria ~210 envios/dia — acima do teto.
**Dois números resolveriam.**

E os dois sinais mais fortes jogam a favor: membro insatisfeito de grupo
de ofertas **sai do grupo em vez de bloquear**, e grupo de ofertas tem
conversa, o que alimenta a taxa de resposta.

**Nenhuma fonte mediu postagem em grupo separadamente.** O 2 a 8 semanas
é de disparo frio. A leitura de que o nosso perfil é mais leve é
inferência, não dado.

**O que não some com bom comportamento:** a detecção também identifica o
cliente pelo protocolo, não só pelo comportamento. Cliente não oficial é
detectável por si.

### O que cai quando cai, e isto muda o medo

**Cai a conta do WhatsApp vinculada ao número. Não cai o chip, e não cai
o grupo.**

- A linha da operadora continua funcionando: liga, recebe SMS, tem
  internet.
- O número fica barrado do WhatsApp. Em banimento permanente, para
  sempre — reinstalar não adianta, e o recurso é dentro do app ou por
  e-mail da Meta. **Serviço pago de "desbanimento" é golpe.**
- **O grupo sobrevive.** Ele vive na infraestrutura do WhatsApp. Se a
  conta banida era admin, o WhatsApp passa o admin para outro membro. Só
  se perde o grupo se a conta banida for o único membro.

**Daí sai uma regra de arquitetura, para o dia em que isto for feito:**
o número do bot **nunca** pode ser o único admin. Um segundo número, do
dono, fica como titular e nunca roda bot. Assim o pior caso é perder um
chip e o tempo de aquecimento, não a audiência.

**E nunca o número pessoal nem o de trabalho.** Banimento permanente é
perda de identidade, não de ferramenta.

### Por que fica engavetado mesmo assim

Não é por princípio, é por conta. O custo real é **~R$30/mês de chip
com recarga obrigatória, mais VPS no Brasil** (o IP precisa ser
brasileiro), mais 14 dias de aquecimento antes do primeiro post. Isso
para automatizar um grupo que **ainda não tem audiência** — que é
justamente o que falta, segundo a própria tabela de contas.

O Telegram é gratuito, automatizado, já publica, e é onde os sete canais
estão. A energia vai para lá.

**A regra 3.2 continua valendo**, agora por decisão econômica com
lastro, e não por herança do começo do projeto.

**Mudaria se:** um grupo de WhatsApp ganhar audiência que justifique os
R$60/mês, ou a Meta abrir API de grupo com teto real. Quando mudar, o
plano é: um número dedicado, um grupo, 14 dias de aquecimento, VPS no
Brasil, ritmo com intervalo variável, e o titular do grupo sendo outro
número. Sobreviveu 60 dias, expande.

---

## D-054 · Como os concorrentes acham oferta, e por que ler canal alheio é a rota mais segura
**Data:** 2026-08-03

A D-051 já tinha decidido usar a colheita como fila de sugestão da
Amazon. Faltava saber **de onde os canais alheios tiram aquilo**, porque
disso depende quanto confiar no dado.

**São três origens, e a mais comum não é humana:**

1. **Redistribuição entre eles.** O *Feed Global P2P* do Pro Afiliados é
   uma rede onde afiliados concorrentes repassam ofertas uns aos outros
   automaticamente, cada um recebendo já com o próprio link convertido.
   A Afilira descreve o mesmo: *"monitora grupos e fontes de ofertas"* e
   *"ofertas detectadas pela rede de usuários abastecem o seu canal"*. É
   por isso que a mesma oferta aparece em três canais em minutos.
2. **Raspagem.** É o que os cursos do nicho ensinam.
3. **Na mão**, os menores.

**A consequência prática:** quando a nossa colheita lê o canal deles,
ela pega carona nas duas primeiras sem correr o risco de nenhuma. Eles
raspam, nós lemos o que já foi publicado. Não é gambiarra nossa — é o
padrão do mercado, e a nossa versão é a mais segura das três.

**Um detalhe que muda prioridade:** a Afilira vende *"velocidade que
garante a comissão na janela da Amazon"*. Quem opera isto trata **tempo
de resposta como o fator competitivo**. Enquanto a publicação depender
do agendador do GitHub (D-052), perdemos essa corrida por horas.

**Mudaria se:** algum marketplace abrir feed oficial de oferta para
afiliado. A Shopee é a única que promete isso, pela Open API.

---

## D-055 · Onde o sistema vai morar, e por que a decisão espera
**Data:** 2026-08-03

Levantamento feito quando o dono perguntou se valia pagar servidor para
escapar do agendador do GitHub (D-052).

**A Vercel não resolve, e não é questão de plano.** Ela tem cron, mas no
gratuito ele roda **uma vez por dia**, e função da Vercel morre em
minutos. O nosso publicador **fica vivo 50 minutos dormindo entre
posts** — não cabe em nenhum plano. O GitHub Actions serve justamente
porque o job pode durar até 6 horas.

**As opções levantadas:**

| Opção | Custo | Observação |
|---|---|---|
| **Oracle Cloud Always Free** | R$0 | Tem região em **São Paulo**. Melhor negócio da lista. |
| **Hetzner CX22** | ~R$27/mês | 2 vCPU, 4 GB. Melhor relação preço/qualidade paga. Fica na Europa. |
| **Contabo** | ~R$25/mês | Mais RAM pelo preço, CPU mais sobrevendida. |
| **Hostinger KVM1** | R$34,99, renova a R$59,99 | Mesmo painel do domínio. |

**Sobre a Oracle, dois números que os guias da internet erram:** o
Always Free era 4 OCPU e 24 GB até **15/06/2026**, quando a Oracle
cortou para **2 OCPU e 12 GB** sem anunciar — só editaram a
documentação. E existe **recuperação de instância ociosa**, que se
aplica a Always Free: a máquina é considerada ociosa se, em 7 dias, CPU,
rede **e** memória ficarem todas abaixo de 20%. São as três juntas, então
é evitável, mas é uma coisa a acompanhar. A fricção prática é o ARM viver
dando *"out of host capacity"*.

**Uma restrição que só aparece se o WhatsApp entrar (D-053):** o país do
IP tem que bater com o do número. Isso elimina Hetzner e Contabo para
aquele uso, e mantém Oracle São Paulo ou VPS brasileiro.

**O domínio já existe:** `4yu.com.br`, registrado na Hostinger, com o
site publicado na Vercel. O caminho natural é `radarofertas.4yu.com.br`
apontando para a máquina, e `go.4yu.com.br` para o redirecionador da
Fase 2 — **subdomínio, não subpasta**, para os dois não se amarrarem.

**Uma máquina e um domínio fechariam três pendências de uma vez:**
hospedagem sem violar termo (D-032), publicador contínuo (D-052) e a
base do redirecionador.

**Por que espera:** as duas mudanças gratuitas da D-052 podem resolver o
buraco de publicação. Se resolverem, a mudança de casa vira decisão
calma sobre hospedagem em vez de correria.

**Atenção ao mudar:** as URIs de redirect do OAuth do Mercado Livre
apontam para a Vercel. Mudando de endereço, tem que cadastrar as novas
no devcenter, senão o token para de renovar.

---

## D-056 · Anúncio no Telegram fica para depois da divulgação cruzada
**Data:** 2026-08-03

Os sete canais existem e a audiência é o que falta. A pergunta foi se
Telegram Ads resolve.

**A plataforma oficial tem porteiro:** conta direta exige depósito
mínimo de **€2 milhões**. Por agência revendedora cai para €3.000 a
€5.000, e alguns painéis self-serve começam em US$150.

**O CPM é barato no papel** — €1 a €4, contra US$15 a 20 do Meta — e a
segmentação joga a favor, porque o Telegram Ads mira **por canal e
tema**, não por pessoa: dá para anunciar dentro de canais de oferta e de
pet.

**A ressalva que desmonta o entusiasmo:** quase todo esse volume barato
é mercado russo, onde o Telegram é dominante. **Inventário brasileiro é
fino**, então o CPM real aqui é provavelmente bem pior. Casos de "2.400
inscritos por €42" são material de venda, não referência.

**O que o nicho brasileiro faz, e custa menos:**
- **Divulgação cruzada** entre canais, custo zero, com grupos
  organizados só para isso;
- **Comprar post em canal existente**, a partir de uns **R$200** em
  canal com 5 mil inscritos.

**A decisão:** não começar por Ads. Fazer cruzada com canais de pet e
oferta, e comprar **um** post pago para medir o custo real por inscrito.
Com esse número na mão, Ads vira conta; sem ele, é aposta.

**Mudaria se:** o custo por inscrito medido no post pago vier alto o
bastante para o CPM do Ads compensar mesmo com inventário fino.

---

## D-057 · O link da Shopee não depende da Open API, e o sub_id dela tem cinco campos
**Data:** 2026-08-03

A Shopee estava classificada como bloqueada esperando o chamado da Open
API. **Estava errado, e a distinção importa:** o chamado é necessário
para *ler produto*, não para *gerar link*.

### O formato, e ele é montável por URL

```
https://s.shopee.com.br/an_redir?origin_link=<URL_CODIFICADA>&affiliate_id=<ID>&sub_id=a-b-c-d-e
```

**Testado com a nossa conta em 03/08**, e a URL final voltou assim:

```
utm_source=an_18378371108     ← o nosso ID
utm_content=teste01----       ← o nosso sub_id, íntegro
utm_medium=affiliates
```

Não é inferência: é um link nosso, aberto no navegador, chegando com
atribuição. O formato saiu do Help Center da Shopee da Malásia e de
Singapura, e a dúvida era se o Brasil usava o mesmo. Usa.

### A confirmação veio antes, de um concorrente

Um link de canal alheio, resolvido à mão, trouxe `utm_content=gurubot----`.
Cinco campos separados por hífen, com só o primeiro preenchido. Foi o que
provou que a estrutura de cinco campos vale em `.com.br` antes mesmo do
nosso teste.

### O que isso muda

**A Shopee vira publicável hoje.** O catálogo dela já entra pela colheita
dos canais de terceiros, e agora o link sai montado, com comissão e
rastreio. Não depende de fila de aprovação nenhuma.

**O que continua faltando na Open API:** preço, título e estoque, e o
feed de ofertas. A Shopee segue fora da série histórica — mas deixa de
estar fora do canal.

### O sub_id de cinco campos reabre a D-035

A D-035 escolheu a granularidade do subid por inferência, quando o único
formato conhecido era o do Mercado Livre, que tem **um** campo e obriga a
espremer tudo numa string. A Shopee tem **cinco**, e isso permite canal,
publicação e origem em campos próprios, legíveis no relatório sem
precisar decodificar nada.

Isso não força uma decisão agora — a regra 3.6 continua exigindo subid
único por publicação, e ela é atendida nos dois formatos. Mas quem for
revisitar a granularidade deve saber que o teto não é mais o do ML.

**Atenção a uma confusão fácil:** em `shopee.com.br/product/{shop_id}/{item_id}`
os dois números têm 11 dígitos, e o ID de afiliado também. São três coisas
diferentes. O ID de afiliado só aparece no `utm_source`, como `an_<id>`.

**Mudaria se:** a Open API sair e passar a gerar link curto próprio com
o mesmo rastreio — aí vale comparar, porque link curto é mais bonito no
post. O rastreio, este já temos.

---

## D-058 · A Shopee entra pelo feed de produto, sem esperar a Open API
**Data:** 2026-08-03

A D-057 já tinha tirado o link da dependência da Open API. Faltava o
dado — preço, título, imagem —, e era por isso que a Shopee continuava
listada como bloqueada.

**Ela não está.** O painel de afiliado tem **Criativo → Feed de produto**,
e ele entrega dois CSV atualizados todo dia, sem credencial de API.

### O que vem nos arquivos

| | **Shopee Oficial BR** | **Shopee Brasil** |
|---|---|---|
| Produtos | 100.000 (184 MB) | 10.000 (19 MB) |
| Entre 25% e 70% de desconto | 15.375 | 3.441 |
| `shop_rating`, `shop_name`, `like`, `condition`, `cb_option` | ✅ | ❌ |
| `global_item_attributes` | ❌ | ✅ |

**A sobreposição entre eles é de 334 itens.** São catálogos praticamente
distintos, então os dois entram — ficar com um só jogaria fora a maior
parte.

Colunas que interessam: `price` (o "de"), `sale_price` (o "por"),
`discount_percentage` já calculado, `item_rating`, `image_link`,
`global_category1/2` com os ids, e `product_link` com loja e item.

### Uma confirmação da D-057 que veio de brinde

O `product_short link` do feed vem assim:

```
https://shope.ee/an_redir?origin_link=https%3A%2F%2Fshopee.com.br%2F...
```

É o **mesmo `an_redir`** que a D-057 tinha testado, gerado pela própria
Shopee. O formato não era engenharia reversa nossa: é o mecanismo dela.

### As URLs do feed são alças permanentes, não links de arquivo

Medido em 03/08: duas chamadas seguidas ao mesmo endereço devolveram o
mesmo `outer_feed_id` com `nonce` e `timestamp` diferentes. A Shopee
assina um endereço novo a cada chamada, então **guardar a URL uma vez
basta**.

Elas carregam um token no parâmetro `id`, e este repositório é público —
por isso vivem em `credencial_rotativa`, com as chaves `feed_oficial` e
`feed_brasil`. Se a Shopee trocar o `id`, o coletor **falha com a
mensagem dizendo onde pegar a nova**, em vez de pular calado.

### Ler tudo, escrever o melhor

Dos 110 mil itens lidos, **19.827 passam** nas comportas de desconto,
nota, condição e origem. Escrever todos custaria quase cem mil chamadas
ao banco por execução, para encher o catálogo de item que a curadoria
reprovaria depois.

Então a escrita é limitada por `SHOPEE_MAX_ITENS`, com o corte pelo
**maior desconto**. O catálogo cresce um pouco por dia, e entra primeiro
o que tem mais chance de virar post.

**Item sem nicho mapeado não entra**, e isso é decisão: sem nicho ele não
acha canal, e ficaria no banco para sempre sem virar nada. O coletor
imprime as categorias que faltam, com nome e contagem, e mapear é um
`insert` — o mesmo desenho da D-023.

### O mapa de categorias

As 255 categorias de segundo nível dos feeds viraram 240 linhas em
`nicho_dominio`, com a chave `SHOPEE-<catid2>`. A tabela é chaveada por
`(operacao, marketplace, dominio)`, então o prefixo não é necessário
para evitar colisão — ele existe porque `anuncio.dominio_externo` é
coluna compartilhada, e um número solto ali não diz de que loja é.

As 15 que sobraram não têm nicho nosso equivalente. As maiores que
apareceram na primeira execução: **Watches**, **Travel & Luggage** e
**Gaming & Consoles**. Viram nicho novo se algum canal quiser.

### O que a Open API ainda resolve

**Reler o preço de um item específico.** O feed é uma foto diária: se o
preço mudar às 15h, só sabemos amanhã. Por isso a oferta da Shopee é
sempre de gatilho `declarado`, nunca `queda`, e ela continua fora da
série histórica medida por nós.

O desenho final tem os dois, e é o mesmo do Mercado Livre: **descoberta
em lote uma vez ao dia, releitura de preço de hora em hora.** O feed
preenche a primeira coluna; a API, quando sair, preenche a segunda.
Nada do que foi feito aqui é refeito.

### O horário, e por que ele não é o ideal

A Shopee atualiza o feed no fim da tarde — visto em 02/08 às 19:55. O
certo seria coletar logo depois. A coleta ficou na **rotina diária**, que
roda às 09:00 UTC, então a foto tem até doze horas quando vira post.

É escolha consciente: a D-052 mostrou que cron novo no GitHub pode não
disparar, e a rotina diária é um agendamento que comprovadamente roda.
Dá para viver com o atraso porque o desconto do feed é declarado pela
loja, não uma queda medida por nós — ele muda menos ao longo do dia.

**Mudaria se:** o sistema sair para um servidor com cron de verdade
(D-055), aí a coleta vai para as 21h e a oferta sai no mesmo dia.

---

## D-059 · A Oracle é a saída, e o preço dela é atenção
**Data:** 2026-08-03

Pesquisa a pedido do dono, que quer trocar Vercel, GitHub Actions e
Supabase por uma máquina só na Oracle Cloud, tudo no gratuito, com os
três serviços virando reserva.

**O plano fecha**, e resolve três coisas de uma vez: a D-032 (Vercel
Hobby proíbe uso comercial), a D-052 (agendador do GitHub não dispara) e
o teto de 500 MB do Supabase gratuito. Mas a Oracle tem um histórico que
precisa estar escrito antes de alguém confiar dados a ela.

### O que dá errado, e é sério

Relatos de **onda de banimento em massa** de contas Always Free, entre
2025 e 2026:

- conta encerrada **sem aviso e sem motivo informado**, com o suporte
  dizendo que não pode explicar nem reverter;
- **nenhum caso de recuperação de dados** na discussão do Hacker News.
  A exclusão é definitiva;
- um caso disparado por uma cobrança de teste de **US$ 0,01 que falhou**
  num cartão virtual;
- um usuário perdeu um cluster inteiro e, nas palavras dele, *"significant
  losses, including the loss of some of my clients"*.

O comentário que resume: *"nunca construa algo que você queira manter"*.

### O que dá certo, e é o outro lado

Só ler reclamação é o viés que o próprio dono apontou antes, sobre o
Reclame Aqui: quem deu certo não volta para contar.

- um operador hospeda um serviço **há mais de 5 anos, zero problemas**,
  tudo dentro do Always Free;
- relatos de 2 anos sem incidente;
- *"a Oracle relaxou desde a purga de 2022; enquanto a instância não ficar
  meses ociosa e você não minerar nem abusar de tráfego, normalmente está
  tudo bem"*.

A metáfora da comunidade: **"é como um gato, amigável na maioria dos dias,
mas pode te arranhar sem aviso"**.

### A mitigação que muda a conta

**Subir a conta para Pay As You Go.** Põe-se um cartão, a conta deixa de
ser "free tier", **e os recursos Always Free continuam gratuitos** — a
fatura fica em R$0 enquanto não passar dos limites. Isso remove o motivo
de encerramento mais documentado, que é conta gratuita sendo recuperada
por política.

Duas regras a mais, achadas na documentação: conta **sem uso por 60 dias**
pode ser encerrada (não morde aqui, a máquina roda o dia todo), e a
recuperação de instância ociosa da D-055 exige CPU, rede **e** memória
abaixo de 20% — com banco, painel e publicador na mesma máquina, a
memória sozinha já passa disso. **O plano se protege desse risco
sozinho.**

### Backup no Supabase, que é ideia do dono e é melhor do que parece

O Supabase gratuito dá 500 MB de banco e **1 GB de storage**, e o
`backup-semanal.yml` já faz `pg_dump` — basta apontar o destino.

O ponto forte não é o espaço, é serem **empresas diferentes**: backup na
Oracle protege contra disco; backup no Supabase protege contra a Oracle
inteira sumir. E o projeto Supabase vira **reserva morna**, com o schema
já aplicado: se a Oracle cair, troca-se a URL no `.env` e o sistema volta
com o dado do último backup. Não é reconstrução, é chave girada.

Duas ressalvas: projeto gratuito do Supabase **hiberna após 7 dias sem
uso**, e o backup semanal já resolve isso porque escrever conta como uso;
e os 500 MB limitam até onde a reserva acompanha o banco principal.

**Mudaria se:** a Oracle encerrar a conta mesmo em Pay As You Go, ou o
banco passar dos 500 MB a ponto de a reserva no Supabase deixar de ser
retorno viável. Aí a discussão vira Hetzner paga, e o roteiro de
`docs/migracao-para-vps.md` continua valendo com outro provedor.

---

## D-060 · Relato de campo de quem opera há mais tempo, e o que ele contradiz
**Data:** 2026-08-03

Conversa do dono com um conhecido que opera grupos de promoção há mais
tempo. Vale registrar porque é a única fonte não comercial que apareceu
hoje: as outras eram página de venda ou fórum de reclamação.

### O que contradiz uma suposição nossa

**O grupo de Telegram dele foi banido. O WhatsApp dele não.**

Passamos o dia tratando o Telegram como a superfície segura e o
WhatsApp como a arriscada (D-053). Este relato inverte a experiência
dele: *"por algum motivo meu grupo tomou ban do nada"* no Telegram,
enquanto o WhatsApp, com chip separado, *"até hj tá de boa"*.

**Não é para reescrever a D-053 por causa disto.** Um relato não é
amostra, e "do nada" quase sempre teve motivo que o relator não viu —
adicionar em massa e denúncia acumulada são os candidatos óbvios. O que
muda é a leitura de que o risco no Telegram é zero. Ele não é, e a nossa
automação inteira mora lá, com sete canais.

**O que fazer com isso hoje: nada além de saber.** Se um canal cair, a
causa provável é volume ou denúncia, não a API do bot, que é oficial.

### Divergência sobre a API da Amazon

Ele diz que a API libera **depois de vender 2 produtos**. A documentação
lida na D-051 diz **10 vendas qualificadas em 30 dias**.

Pode ser porta antiga, memória imprecisa, ou nível diferente da mesma
API. **A D-051 fica como está**, porque ela cita documentação e este
relato é de segunda mão — mas quando as nossas vendas chegarem a 2, vale
pedir a API e descobrir na prática, em vez de esperar as 10.

### Duas coisas que confirmam o que já estava escrito

**A Amazon exigiu um site para aprovar.** Ele registrou um domínio só
para ter onde mostrar os links de afiliado. A nossa conta já está
aprovada, então não muda nada agora — mas vale para o **parceiro da
Fase 3**, que vai passar pelo mesmo funil, e o `4yu.com.br` já resolve
esse requisito do lado do dono.

**"Mano eu raspo tudo dos grupo".** É exatamente a D-054: o mercado se
alimenta de raspagem e redistribuição entre canais. A nossa colheita lê
o que eles já publicaram, sem correr o risco de nenhum dos dois.

**Mudaria se:** aparecer um segundo relato de canal de Telegram banido,
ou um dos nossos cair. Aí deixa de ser anedota e vira padrão a estudar.
