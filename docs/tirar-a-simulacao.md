# Tirar a simulação — feito em 31/07/2026

Decisão do dono em 31/07/2026: *"o painel tá cheio de mockup, tira eles, só deixa
se forem produtos de verdade — agora estamos parando de brincar de mockup."*

Isso encerra a exceção da **D-026**, que em 28/07 permitiu construir as telas de
decisão sobre uma operação simulada em `lib/simulacao/loja.ts`. A D-026 continua
certa pelo que fez — as telas foram desenhadas e revisadas sem esperar
credencial —, e agora cumpriu o papel dela.

Este documento existe para que a refatoração possa ser retomada por qualquer
sessão, sem depender de quem começou.

---

## ✅ Terminou em 31/07/2026

O `grep` abaixo volta vazio. `lib/simulacao/loja.ts` não existe mais, e nenhuma
tela do painel mostra número inventado.

```
grep -rln "simulacao/loja" app lib testes
```

Este documento fica como registro do que a travessia mudou — não como fila de
trabalho. O que vier depois disto é outra coisa.

### O que ficou diferente do plano, e por quê

Três pontos que o roteiro não previa e que valem mais que o próprio roteiro:

**Desfazer aprovação não apaga publicação já enviada.** O plano dizia "apaga as
publicações pendentes que ela gerou". Contra o banco isso precisou de ressalva:
publicação enviada tem subid circulando, e um dia ele volta no relatório de
comissão. Apagar a linha faria a venda chegar sem dono. Some só o que está
`pendente` ou `bloqueada`.

**"Decididas hoje" virou de hoje mesmo.** `todasAsOfertas()` funcionava numa
simulação que morria com o servidor. Contra o banco, "todas" cresce para sempre,
e a tela de trabalho do dia viraria o arquivo morto da operação.
`ofertasDecididasHoje()` filtra por `decidida_em`.

**O preço de agora vem da série, não da oferta.** O bloqueio por preço existe
justamente para pegar a diferença entre os dois — lê-lo de `oferta.preco_atual`
seria comparar o número com ele mesmo, e o bloqueio nunca dispararia.

E uma coisa que o roteiro acertou e vale sublinhar: **os 27 testes apagados não
foram substituídos por testes equivalentes.** O que os substitui é o banco. As
constraints da migration 16 foram conferidas contra o projeto da nuvem em 31/07,
uma a uma: subid de 8 caracteres sem `0/O/1/I/l`, subid diferente por canal, a
mesma oferta não indo duas vezes ao mesmo canal, enviada sem data recusada,
estado fora da lista recusado, e rejeição sem motivo recusada.

### O que a simulação deixou para trás

`Oferta` e `Publicacao` guardaram a forma que as telas já consumiam, então a
troca não redesenhou nada. Duas mudanças de forma, as duas por causa do custo de
consulta:

- A oferta chega **completa** — com nome e cor da loja, nome do nicho, série de
  preço e canais elegíveis dentro dela. A simulação deixava a tela chamar seis
  funções auxiliares por linha; contra o banco isso seria seis consultas por
  linha, numa fila de trinta.
- `canaisEscolhidos` deixou de ser campo e virou contagem das `publicacao` vivas
  daquela oferta. Guardado nos dois lugares, os dois discordariam na primeira vez
  que uma publicação fosse cancelada.

---

## O roteiro original, para consulta



## Como saber onde parou

```
grep -rln "simulacao/loja" app lib testes
```

Enquanto essa lista não estiver vazia (fora o comentário em
`lib/distribuicao.ts`), o trabalho não acabou.

---

## Feito

**Migration 16 — `publicacao`** (`20260731180000_publicacao.sql`), aplicada no
banco local e no da nuvem. Era o único dos quatro conceitos do modelo sem tabela.
O `subid` é `unique` no banco, e o gerador exclui `0`, `O`, `1`, `I` e `l`.

**Canais** (`fe404ff`). `lib/distribuicao.ts` substituiu a parte de canal da
simulação. Criar, editar, ligar e desligar gravam no banco. A tela ganhou o
estado vazio que a simulação escondia.

**Tipos.** `CanalLinha`, `CanalNichoLinha` e `PublicacaoLinha` entraram em
`lib/supabase/tipos.ts`, que é **escrito à mão** — não rode o gerador por cima.

---

## O que falta, em ordem

A ordem importa: cada passo destrava o seguinte, e o último só é seguro depois de
todos os outros.

### 1. `lib/ofertas.ts` — a fila de aprovação vinda do banco

**Quem depende:** `app/(painel)/aprovar/page.tsx`, `app/acoes/curadoria.ts`,
`app/componentes/PainelDaOferta.tsx`.

Funções a substituir, com o nome que elas têm hoje na simulação:

| Hoje | O que precisa fazer lendo `oferta` |
|---|---|
| `ofertasDaFila()` | `status = 'nova'`, com anúncio, produto, loja e nicho juntos |
| `todasAsOfertas()` | as decididas de hoje, para a seção "Decididas hoje" |
| `buscaOferta(id)` | uma, para o painel lateral |
| `decideOferta(...)` | grava `status`, `decidida_em`, `decidida_por`, `motivo_rejeicao` — e **cria as publicações** nos canais elegíveis quando for aprovação |
| `desfazDecisao(id)` | volta para `nova` e **apaga as publicações pendentes** que ela gerou |
| `serieDePrecos(oferta)` | lê `preco_ponto` de verdade, em vez de gerar número |
| `funilDeHoje()` | os números do estado vazio: monitorados, com série, abaixo do limiar |

**Cuidado que não pode ser esquecido:** aprovar é o que gera `publicacao`, uma por
canal elegível, cada uma com subid próprio. É aqui que a regra 3.6 acontece de
verdade pela primeira vez.

### 2. `lib/publicacoes.ts` — a fila de envio

Já existe, com só `publicacoesDoCanal()`. Falta o resto, usado por
`app/(painel)/publicar/page.tsx` e `app/acoes/publicacao.ts`:

`publicacoesDaFila`, `marcaEnviada`, `desfazEnvio`, `cancelaPublicacao`,
`desfazCancelamento`, `devolveParaAprovacao`.

**A regra que não pode se perder na tradução:** `origem` distingue `fluxo` de
`auto_declarada`, e os dois **nunca somam no mesmo contador** — é o único sinal
de supervisão sobre operador remoto que o sistema tem.

**E o bloqueio por preço:** publicação cujo preço de agora difere do
`preco_na_fila_centavos` vira `bloqueada` e volta para a aprovação. O operador não
aprova nem rejeita.

### 3. Os quatro arquivos de tabela

Menores, mas quebram se ficarem por último sem aviso:

- `app/componentes/Casca.tsx` — os contadores da barra lateral (`ofertasDaFila`, `publicacoesDaFila`)
- `lib/atencao.ts` — canais parados e fila travada
- `lib/arranque.ts` — o passo "existe canal?" da trilha
- `app/(painel)/ajustes/nichos/page.tsx` — quantos canais usam cada nicho

Todos passam a usar `lib/distribuicao.ts` e `lib/publicacoes.ts`.

### 4. Apagar a simulação

Só depois que o `grep` acima estiver limpo:

- apagar `lib/simulacao/loja.ts`
- apagar `testes/simulacao.mjs` (27 casos) e tirá-lo do script `testa`
- tirar `AvisoSimulacao` das telas restantes e apagar o componente
- atualizar a D-026 registrando que a exceção terminou, com a data

**Os 27 testes não se aproveitam.** Eles verificam a máquina de estados de um
módulo em memória. O que os substitui não é teste equivalente: é o banco, com as
constraints da migration 16 — `publicacao_oferta_canal_unico`,
`publicacao_enviada_tem_data`, `publicacao_estado_valido`. Regra que vive em
constraint não precisa de teste de unidade para não regredir.

---

## O que o painel mostra durante a travessia

Enquanto isso não termina, o painel fica **misturado**: Canais real, Aprovar e
Publicar simuladas. É estado transitório e desconfortável de propósito — a faixa
`AvisoSimulacao` continua nas telas que ainda mentem, que é exatamente o trabalho
dela.

**Não remova a faixa de uma tela antes de religá-la.** Tela simulada sem aviso é
pior que tela simulada com aviso.

---

## O que NÃO muda junto

- **Nenhuma tela nova.** Isto é trocar a fonte do dado, não redesenhar.
- **Nenhuma regra de negócio no TypeScript.** A curadoria mora em
  `avalia_anuncios`, no banco, e continua lá — a tela lê nota e motivos prontos.
- **Nada da Fase 2 além da tabela.** Sem redirecionador, sem clique, sem
  comissão. O subid é gravado; o link curto que o usa é outro trabalho.
