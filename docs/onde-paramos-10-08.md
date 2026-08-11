# Onde paramos — 10/08/2026

**Chegou agora? Leia `AGENTS.md` primeiro, depois este arquivo.** O de
04/08 (`docs/onde-paramos.md`) continua valendo para tudo que não está
aqui.

## Em uma frase

O WhatsApp saiu do papel: existe VPS, existe chip conectado, existe canal
de mulher com fila limpa, e o publicador roda de dois lugares. Falta a
primeira mensagem cair no grupo, e ela está agendada para a janela das
18h.

---

## O mapa: onde cada coisa mora

| Coisa | Onde | Como se alcança |
|---|---|---|
| VPS | Locaweb, `201.76.56.54` | `ssh -i ~/.ssh/radar_vps root@201.76.56.54` |
| Evolution API | `/opt/evolution` na VPS | `https://zap.4yu.com.br` |
| Publicador (cópia da VPS) | `/opt/radar` na VPS | cron `/etc/cron.d/radar-publica` |
| Log do publicador | `/var/log/radar/publica.log` | `tail -f` na VPS |
| Painel | Vercel, projeto `radar-ofertas` | `radar-ofertas.vercel.app` |
| Banco | Supabase `fcdkczueohekmgaaacdr` | painel do Supabase |
| DNS do `4yu.com.br` | **Hostinger**, não Vercel | hPanel → Zona DNS |

### A VPS

Locaweb, 2 vCPU, 2 GB, 60 GB, **mensal e sem fidelidade**, contratada em
10/08. Ubuntu 24.04. Cerca de R$45,90/mês.

Roda quatro contêineres: Evolution API, Postgres, Redis e Caddy. Consumo
medido: **226 MB dos 1,9 GB**, com 3 GB de swap atrás. O publicador soma
uns 200 MB quando roda. Cabe um segundo chip; o que pediria upgrade para
4 GB é rodar n8n junto.

O painel de administração da Evolution **não está na internet**:
`https://zap.4yu.com.br/manager/` devolve 403 de propósito. Ele se
alcança por túnel:

```bash
ssh -i ~/.ssh/radar_vps -L 8080:localhost:8080 root@201.76.56.54
# depois: http://localhost:8080/manager/
```

### O chip

Número dedicado, **primeiro dia 10/08/2026**. Instância `radar01`.
Aparece no banco como bot `Radar 01`.

Conferido pela API em 10/08: **todos os 10 grupos têm 3 admins**, então o
bot nunca é o único. Isso é a regra 3.2 e é o que separa perder um chip
de perder a audiência.

**O pareamento por QR Code falhou** repetidamente ("não foi possível
conectar o dispositivo"). O que funcionou foi o **código de pareamento
por número**:

```
GET /instance/connect/radar01?number=<o numero do chip, em E.164 sem +>
```

Se cair e o QR não voltar, tente esse caminho antes de suspeitar de
banimento. O número sai de `bot.identificador`, no banco — ele não é
escrito em arquivo nenhum, porque o repositório é público (D-038).

---

## As credenciais, e o que fazer em outra máquina

**A chave SSH é por máquina.** Se você estiver num computador que não
tem `~/.ssh/radar_vps` nem a cópia em `4yu-apps/.secrets/radar_vps`,
**não tente transferir a antiga**: gere uma nova e acrescente a pública
ao servidor.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/radar_vps -N "" -C "apelido-da-maquina"
cat ~/.ssh/radar_vps.pub
```

A pública entra em `~/.ssh/authorized_keys` do `root` na VPS, por uma
máquina que já tenha acesso.

Impressão digital da chave criada em 10/08:
`SHA256:E+5H2rYqCxySpeLjvYHbPXEn/oaT7a8vOMCPiF11PkM`

### Onde cada segredo vive

| Segredo | Vercel | GitHub | Cofre 4YU | VPS |
|---|---|---|---|---|
| `WHATSAPP_API_URL` | sim | sim | `RADAR_WHATSAPP_API_URL` | `/opt/radar/.env` |
| `WHATSAPP_API_KEY` | sim | sim | `RADAR_WHATSAPP_API_KEY` | `/opt/radar/.env` |
| apikey da Evolution (origem) | — | — | — | `/opt/evolution/.apikey` |
| senha do Postgres da Evolution | — | — | — | `/opt/evolution/.pgpass` |
| `SUPABASE_ACCESS_TOKEN` (conta) | — | — | `4yu.env` | — |
| `HOSTINGER_TOKEN` | — | — | — | **removido da VPS** |

O cofre é `~/dev/gabriel/4yu-apps/.secrets/4yu.env`. O `.env` do
repositório aponta para o **Supabase local**, não para produção: é o
normal de desenvolvimento, e explica painel vazio rodando na máquina.

---

## O que foi feito hoje

### Infraestrutura

VPS contratada, Evolution no ar com HTTPS por Caddy, firewall em 22/80/443,
swap de 2 GB somado ao 1 GB da imagem, `zap.4yu.com.br` criado na
Hostinger com `overwrite: false` (o site e o e-mail do domínio ficaram
intactos, conferido antes e depois).

**Histórico e contatos ficam desligados** no banco da Evolution. Dois
motivos que se somam: é o que faz a instância engordar sem limite, e
guardar isso encheria o banco de nome e telefone de membro de grupo,
contra a regra 3.8.

### Código

- `lib/aquecimento.ts` — a rampa do chip (10/15/20/25, e 30 do 5º ao 14º)
- `lib/ritmo.ts` — o intervalo de 4 a 10 min passou a valer **por chip**
  além de por canal
- Tabela `bot` — `canal.whatsapp_instancia` virou `canal.bot_id`
- Tela `/bots`, em Distribuição
- `lib/emoji-do-produto.ts` — o `{emoji}` da mensagem, lido pelo título
- Modelo de mensagem **por canal**, e o Radar Delas ganhou voz própria

### Curadoria do canal de mulher

Das 180 publicações de beleza já feitas, 12% não deviam estar num grupo
de consumidora: cinco barbeadores masculinos, água oxigenada 40 volumes,
lavatório de salão, carrinho auxiliar. E escova de dente Colgate, fio
dental e lenço umedecido Huggies estavam classificados como `beleza`.

Filtros ampliados, catálogo remarcado (259 produtos de beleza e perfume),
nichos corrigidos por migration. A fila do Delas ficou com **1693 itens,
zero com `GENDER=Masculino` e zero com `USO=profissional`**.

---

## Os erros de hoje, para não repetir

**O `grant` não vem com o `create table`.** A tabela `bot` nasceu com RLS
ligada e policies certas, e sem privilégio nenhum. RLS filtra LINHA; quem
decide se o papel pode encostar na tabela é o `grant`. O publicador teria
levado `permission denied` na primeira rodada, e nenhum teste pegaria.

**`canal_aceita_atributos` tem duas versões vivas**, uma de dois
argumentos e outra de três com `p_nicho_id default null`. Chamando a de
dois, a chamada resolve sem aviso e **todo filtro com escopo de nicho é
pulado**. Foi assim que barbeador entrou na fila do grupo de mulheres
mesmo já estando marcado como masculino. **Sempre passe o nicho.**

**O banco local pode aprovar migration errada.** A que devolvia oferta
para a fila usava `status = 'pendente'`, que não existe. O `db:reset`
passou porque não havia linha correspondente: o `UPDATE` afetou zero e a
constraint nunca foi exercitada. Quem pegou foi a produção. Para
migration que mexe em dado, **crie o caso numa transação e desfaça**, em
vez de confiar no reset.

**Secret gravado não é secret ligado.** `WHATSAPP_API_URL` e
`WHATSAPP_API_KEY` foram para os secrets do repositório e não para o
bloco `env:` do `publica.yml`, que é lista explícita. O Telegram
publicava normal e o canal de WhatsApp ficava mudo com a fila cheia.

**`\b` do JavaScript não funciona antes de letra acentuada.**
`/\b[áa]gua micelar/` não casa com "Água Micelar". As regras de emoji
usam lookaround com `\p{L}` por causa disso.

**Canal novo nasce com etiqueta que não existe na Central, e ele emudece
inteiro.** O Radar Delas ficou mudo até as 18:59 com 1.685 itens na fila,
e a causa não era o WhatsApp: era `radardelas` não estar cadastrada no
painel do Mercado Livre. O gerador responde
`Tag is not associated with this affiliate` (código 109),
`classificaFalhaDeLink` traduz isso para falha **do canal**, e o
publicador descarta a fila inteira dele na rodada — inclusive os itens de
Amazon e Shopee, que nem precisam da Central. Toda rodada morria no
primeiro item de Mercado Livre da fila.

O comportamento está certo e é deliberado, mas o sintoma engana: canal
mudo com fila cheia parece problema de envio, de ritmo ou de credencial
do WhatsApp, que foram os três primeiros lugares onde se procurou.
**Ao criar canal, teste a etiqueta antes de qualquer outra coisa** —
`geraLinks([url], etiqueta, sessao)` responde em um segundo e é a
conferência mais barata que existe. Conferidas em 10/08, as outras oito
(`radarbeauty`, `radarcasa`, `radarfitness`, `radargeek`, `radarkids`,
`radarperfumes`, `radarpet`, `radartech`) estão todas cadastradas: a
pendência do Beauty com `radargeral` que a D-045 registrava já foi
fechada.

---

## O que ficou pendente

~~**A primeira publicação no Radar Delas.**~~ **Caiu às 18:59 de 10/08**,
com foto, `#publi` e link `meli.la`, e o `whatsapp_message_id` ficou
gravado. Fecha o laço da D-071: da queda detectada até a mensagem no
grupo de WhatsApp, sem humano. Duas coisas travavam, e as duas eram de
configuração: o `publica.yml` não passava as variáveis da Evolution
(commit `4b72625`, 16:54) e a etiqueta `radardelas` não existia na
Central (criada pelo dono às 18:4x).

**Os horários do Delas ganharam a hora 19** no mesmo dia, para não
esperar até as 20h. A lista agora é `[8,10,12,14,16,18,19,20,21]`, e ela
continua pulando 22, que é hora de pico segundo `lib/horarios.ts` —
decisão a rever com o dono, não esquecimento.

**O card de link só está provado no papel, e há dois riscos conhecidos.**
A migration 63 fez o Mercado Livre sair como texto com card em vez de
foto anexada, para não encher a galeria de quem lê. As tags `og:` do
`meli.la` trazem foto e nome do produto, conferidas com `curl` inclusive
com user-agent de robô de preview. **O que não dá para conferir daqui é
quem monta o card: o Baileys, dentro da Evolution, na VPS.**

**TESTADO NA NOITE DE 10/08, E NÃO FUNCIONOU.** Um post de Mercado Livre
saiu com `linkPreview: true` e a imagem não apareceu. Palavras do dono:
*"nao subiu as imagens como pensavamos"*. O parâmetro
`whatsapp_link_preview` foi zerado na hora, então **o comportamento de
hoje é o de sempre: foto anexada em todas as lojas**. O código do
híbrido fica de pé e desligado, e religar é trocar o parâmetro para 1.

Falta saber QUAL dos dois problemas é, e a resposta muda o conserto: se
não veio card nenhum, é o bug da Evolution (issue #2262) e o caminho é
montar a miniatura do nosso lado, que é o que o concorrente faz. Se veio
card sem foto, é o WebP do `og:image` do ML, e aí tem conserto barato.
**Quem olhou o grupo sabe; está anotado aqui para quem chegar depois
perguntar isso primeiro.**

A tabela abaixo continua valendo para a próxima tentativa:

| O que você vê | Causa provável | O que fazer |
|---|---|---|
| Card com foto e nome | nada, funcionou | nada |
| Texto puro, sem card | bug aberto da Evolution no `linkPreview` (issue #2262, relatada na 2.3.6; a VPS roda 2.3.7) | `whatsapp_link_preview = 0` |
| Card com título e sem foto | o `og:image` do ML é `.webp`, que o WhatsApp lê mal | dá para consertar: a mesma URL com `.jpg` responde 200 |

Zerar o parâmetro devolve o `sendMedia` na rodada seguinte, sem deploy.

**Shopee e Amazon não mudaram, e não é descuido.** A Shopee devolve
**403 com 160 bytes** para o robô de preview, e a Amazon responde 1 MB de
HTML sem nenhum `og:`, `twitter:` ou `image_src`. Card delas viria vazio,
que é pior que foto anexada. Isso muda na Fase 2, quando o `og:` passar a
ser do nosso redirecionador.

**A IA do gancho está ligada só no Radar Delas** (migration 64). Ela
escreve a primeira linha do post, lendo **só o título** do produto, e
custa uma chamada por publicação. Para ligar em outro canal, preencha
`modelo_mensagem.instrucao_gancho` daquele canal e ponha `{gancho}` no
corpo: nulo significa canal sem gancho e nenhuma chamada é feita. O
freio geral é o parâmetro `ia_gancho`. **Isto era fora de escopo até a
Fase 4** e foi derrubado pelo dono em 10/08, com a chave na mão.

Olhe o contador no fim do log: `N ganchos escritos, M recusados`.
Recusado alto quer dizer que a IA está escorregando para preço ou
travessão e a validação está segurando, o que é o certo, mas é sinal de
que o prompt precisa de ajuste. Zero escritos com zero recusados quer
dizer que a chave não chegou ao Actions.

**Peso de marca em beleza.** Só 4% do que o canal publica é marca que a
beauty tok reconhece. O mecanismo já existe para perfume (`pesoDaMarca`).

**Exigir loja oficial em maquiagem e perfume.** Hoje são 13% na base
histórica e 64% na fila atual. É a categoria em que falsificação mais
acontece.

**A VPS não alcança a Vercel.** `curl` de lá para os IPs da Vercel dá
timeout, enquanto Shopee, Mercado Livre e Google respondem em
milissegundos. Não atrapalha nada, porque as fotos vêm do CDN do
marketplace. Está anotado em `docs/instalacao-evolution.md` para ninguém
caçar firewall à toa.

---

## Comandos que você vai querer

```bash
# entrar na VPS
ssh -i ~/.ssh/radar_vps root@201.76.56.54

# ver o publicador rodando
tail -f /var/log/radar/publica.log

# rodar o publicador à mão
/opt/radar/publica.sh

# o chip está de pé?
curl -s -H "apikey: $(cat /opt/evolution/.apikey)" \
  https://zap.4yu.com.br/instance/connectionState/radar01

# consumo da máquina
docker stats --no-stream; free -h

# freio de mão: para tudo no WhatsApp sem tocar no Telegram
# (parametro whatsapp_automatico = 0, pelo painel ou pelo banco)
```
