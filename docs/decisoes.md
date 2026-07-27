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
