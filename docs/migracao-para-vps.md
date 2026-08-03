# Sair da nuvem alheia: roteiro de migração

**Escrito em 03/08/2026. Não é para esta semana** — é para existir pronto no dia
em que for. Quem retomar isto sem contexto: leia a **D-055** (por que sair) e a
**D-059** (por que a Oracle, e o que ela tem de perigoso) antes de começar.

## O que se ganha, e não é economia

Hoje o sistema mora em três casas alheias, e cada uma tem um problema:

| Onde | Problema |
|---|---|
| **Vercel** | plano Hobby proíbe uso comercial, e este projeto gera receita (**D-032**) |
| **GitHub Actions** | agendamento é melhor esforço. Em 03/08 pediu de hora em hora e entregou às 03:45, 07:23 e 11:21 (**D-052**) |
| **Supabase gratuito** | 500 MB, uns oito meses de coleta |

Uma máquina resolve os três. **A economia é consequência, não o motivo** — o
motivo é o painel estar irregular e o canal ficar mudo por horas.

## O desenho final

Uma máquina Oracle Always Free, região São Paulo, rodando:

- **Painel** Next.js, em `radarofertas.4yu.com.br`
- **Publicador** como serviço permanente, sem janela de 50 minutos
- **Supabase auto-hospedado** em Docker
- Na Fase 2, o **redirecionador** em `go.4yu.com.br`

Certificado sai automático com Caddy. O site `4yu.com.br` continua onde está.

**E os três serviços viram reserva**, o que é a melhor parte do plano:

- **Supabase gratuito** recebe o backup e fica de retorno morno
- **GitHub Actions** continua como agendador de reserva, que é a lição da D-052:
  não depender de um agendador só
- **Vercel** continua publicável enquanto o painel não sair de lá

## Antes de começar

**Suba a conta Oracle para Pay As You Go.** Põe-se um cartão e os recursos
Always Free continuam gratuitos, com fatura em R$0. Isso remove o motivo de
encerramento mais documentado na D-059. É o único item que não dá para deixar
para depois, porque ele protege tudo que vem a seguir.

## A ordem, e ela importa

Migrar tudo junto significa não saber qual peça quebrou. Os dois primeiros
passos se desfazem em minutos; o terceiro é o único irreversível.

### 1. Máquina de pé e painel no ar

Fecha a D-032, e **não há dado em risco** — se der errado, a Vercel ainda está
lá com o painel funcionando.

- criar a instância ARM em São Paulo (o `out of host capacity` é a fricção
  conhecida; insistir em outro *fault domain* costuma resolver)
- Docker, Caddy, Node 24
- `radarofertas.4yu.com.br` apontando para o IP, no painel da Hostinger
- subir o painel lendo **o Supabase de hoje**, sem mexer no banco
- conferir com `pnpm telas`, que fotografa as treze telas e falha se alguma
  soltar erro

⚠️ **As URIs de redirect do OAuth do Mercado Livre apontam para a Vercel.**
Cadastrar as novas em `developers.mercadolivre.com.br` **antes** de desligar o
painel de lá. Esquecer isso faz o token parar de renovar, e a falha aparece como
"pulei a loja" — não como erro de OAuth.

### 2. Publicador como serviço

Resolve o problema que existe hoje. O canal deixa de depender do humor do
agendador.

- serviço de sistema, com reinício automático
- cron do sistema para a rotina diária e a coleta horária
- **a coleta da Shopee vai para as 21h**, logo depois de a Shopee atualizar o
  feed. Hoje ela roda às 09:00 UTC e a foto tem até doze horas (D-058)
- **manter os workflows do GitHub ligados** por uma semana, em paralelo. A trava
  de execução no banco impede post duplicado — quem chega segundo sai na hora
- só depois de uma semana quieta, desligar o cron do GitHub e deixar o
  `workflow_dispatch` como reserva manual

### 3. Banco, por último

O único passo que não se desfaz.

**Pré-requisito, e não é negociável:** backup automático rodando **e restaurado
uma vez de verdade**. Backup que nunca foi testado não é backup, é esperança.

- subir o Supabase auto-hospedado em Docker (quer uns 4 GB; a máquina tem 12)
- aplicar as migrations do zero: elas são a fonte de verdade do schema
- `pg_dump` do Supabase de hoje, restaurar na máquina nova, **conferir tabela
  por tabela** — foi assim que a nuvem foi conferida em 31/07
- trocar as chaves no `.env` e nos secrets do GitHub
- **o projeto Supabase gratuito não é apagado.** Ele vira o destino do backup
  semanal e a reserva morna: schema já aplicado, e voltar é trocar uma URL

Depois de migrar, exercitar a volta **uma vez, de propósito**. Reserva que nunca
foi exercitada é esperança com outro nome.

## O que não muda

- **Migration aplicada não se altera**, nunca (seção 6 do `AGENTS.md`). Banco novo
  não reabre essa porta: ele nasce aplicando as mesmas migrations, na ordem.
- **Nenhum segredo entra no Git.** O repositório é público, e a máquina nova só
  aumenta a quantidade de segredo em circulação.
- O `SAL_HASH_IP` **não pode mudar** na migração. Ele viaja junto, igual. Sal
  diferente quebra a contagem de clique único para sempre.

## Quando isto vira urgente

Nenhum dos três problemas está pegando fogo hoje:

- a Vercel está com *Deployment Protection* ligada, então o painel é ambiente de
  teste — mas a D-032 tem prazo: **sair antes da primeira publicação real em
  canal com audiência**
- a publicação ganhou uma reserva de hora em hora, então o buraco de quatro
  horas não deve se repetir
- os 500 MB do Supabase dão uns oito meses

**O gatilho é a D-032.** No dia em que um canal tiver audiência de verdade, o
painel precisa estar fora da Vercel Hobby. É o único dos três com prazo, e o
prazo é de negócio, não de infraestrutura.
