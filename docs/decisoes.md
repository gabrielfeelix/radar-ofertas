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

## Pendências que ainda não são decisões

**Extração automática de título e preço.** Hoje o cadastro é manual: o operador cola o link e digita título e preço. O sistema só lê a URL para descobrir a loja e o código do anúncio — nenhuma requisição sai para o site. Antes de automatizar a coleta é preciso decidir, por marketplace, qual é a via permitida: API oficial, feed de afiliado ou leitura da página. **Isso bloqueia o coletor diário da Fase 1** e cai na regra da seção 8 do `AGENTS.md` — não colete de um site sem confirmar que os termos permitem.

**Nicho.** Não definido. Determina categoria de comissão, ticket médio e perfil de parceiro. Precisa ser resolvido antes da Fase 1.

**Enquadramento fiscal.** Há divergência entre fontes sobre se afiliado digital cabe no MEI — o CNAE 7490-1/04 apareceria fora da lista permitida, empurrando para Microempresa no Simples Nacional. Precisa de confirmação de um contador antes de repassar dinheiro a terceiros. **Não trate como resolvido.**

**Resultado do teste de subid (Fase 0).** Registrar aqui, por marketplace: suporta subid, tamanho máximo, formato aceito, prazo de aparecimento no relatório.

**Domínio.** Não registrado. Precisa de um curto para o redirecionador.
