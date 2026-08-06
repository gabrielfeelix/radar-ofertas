# Migrations, por número e por nome

**Este arquivo existe porque o número não identifica nada.** Em 04/08
dois agentes trabalharam em paralelo e os dois numeraram contando os
arquivos na hora de escrever, sem saber dos arquivos do outro. O
resultado é que **"migration 64" aparece em comentário significando três
coisas diferentes**:

```
o que um agente chamou de 64  →  20260805040000_selo_do_vendedor_e_cupom_no_post
o que o outro chamou de 64    →  20260805060000_o_beauty_para_de_receber_aplique
a contagem de verdade          →  20260805030000_a_folga_na_funcao_nao_funciona
```

**A regra daqui pra frente: cite migration pelo carimbo do nome do
arquivo, nunca pelo número.** O carimbo é único, não muda, e não depende
de quem contou.

**Como ler um comentário antigo:** referência anterior a 04/08
provavelmente está certa, porque havia um agente só. De 04/08 em diante,
confira aqui antes de acreditar — e desconfie especialmente de qualquer
número entre 62 e 70.

Gerado a partir da ordem real dos arquivos.

| # | Carimbo | Dia | Nome |
|---|---|---|---|
| 1 | `20260727130000` | 27/07 | fundacao |
| 2 | `20260727130100` | 27/07 | usuario e papeis |
| 3 | `20260727130200` | 27/07 | nicho |
| 4 | `20260727130300` | 27/07 | marketplace |
| 5 | `20260727130400` | 27/07 | parametros |
| 6 | `20260727130500` | 27/07 | produto anuncio preco |
| 7 | `20260727130600` | 27/07 | parceiro e canal |
| 8 | `20260727130700` | 27/07 | colheita |
| 9 | `20260727130800` | 27/07 | oferta e motor |
| 10 | `20260727130900` | 27/07 | execucao rotina |
| 11 | `20260727131000` | 27/07 | rls |
| 12 | `20260727131100` | 27/07 | permissoes |
| 13 | `20260728120000` | 28/07 | modelo mensagem |
| 14 | `20260728140000` | 28/07 | identificacao publicitaria |
| 15 | `20260728150000` | 28/07 | expira imagem |
| 16 | `20260731180000` | 31/07 | publicacao |
| 17 | `20260731230000` | 31/07 | cupom e cadencia |
| 18 | `20260801030000` | 01/08 | detecta quedas |
| 19 | `20260801040000` | 01/08 | leitura anterior |
| 20 | `20260801060000` | 01/08 | fonte descricao |
| 21 | `20260801060500` | 01/08 | nota do curador |
| 22 | `20260801080000` | 01/08 | curadoria automatica |
| 23 | `20260801140000` | 01/08 | desconto declarado |
| 24 | `20260801150000` | 01/08 | nicho por dominio |
| 25 | `20260801160000` | 01/08 | escavacao de historico |
| 26 | `20260801170000` | 01/08 | nicho suplemento e medida |
| 27 | `20260801180000` | 01/08 | nicho por categoria raiz |
| 28 | `20260801190000` | 01/08 | conserta linha do frete |
| 29 | `20260801200000` | 01/08 | link de afiliado gerado |
| 30 | `20260801210000` | 01/08 | identidade do produto |
| 31 | `20260801220000` | 01/08 | atributos do produto |
| 32 | `20260801230000` | 01/08 | confianca do vendedor |
| 33 | `20260801240000` | 01/08 | demanda por canal |
| 34 | `20260801250000` | 01/08 | post de cupom |
| 35 | `20260801260000` | 01/08 | cupons vivos com escopo |
| 36 | `20260801270000` | 01/08 | ramo secundario |
| 37 | `20260801280000` | 01/08 | canal por atributo e nichos dos seis |
| 38 | `20260801290000` | 01/08 | dominios que ganharam canal |
| 39 | `20260801300000` | 01/08 | lastro sem redundancia e ritmo de cinco |
| 40 | `20260801310000` | 01/08 | o lastro de queda tambem repetia |
| 41 | `20260801320000` | 01/08 | lastro sem travessao |
| 42 | `20260801330000` | 01/08 | o banco recusa travessao |
| 43 | `20260801340000` | 01/08 | filtro pode exigir o atributo |
| 44 | `20260801350000` | 01/08 | guarda o id da mensagem |
| 45 | `20260801360000` | 01/08 | trava de execucao |
| 46 | `20260801370000` | 01/08 | nicho por ramo |
| 47 | `20260801380000` | 01/08 | filtro de atributo por nicho |
| 48 | `20260803150000` | 03/08 | lastro declarado sem ressalva |
| 49 | `20260803170000` | 03/08 | nicho das categorias da shopee |
| 50 | `20260803180000` | 03/08 | games para o tech e o que nao roteia |
| 51 | `20260803200000` | 03/08 | gatilho de publicacao por pg cron |
| 52 | `20260803210000` | 03/08 | ritmo com folga sorteada |
| 53 | `20260803220000` | 03/08 | teto diario de 150 |
| 54 | `20260803230000` | 03/08 | link clicavel em vez de url crua |
| 55 | `20260804120000` | 04/08 | gatilho da rotina diaria |
| 56 | `20260804140000` | 04/08 | o modelo para de depender de emoji |
| 57 | `20260804170000` | 04/08 | link curto dispensa a ancora |
| 58 | `20260804190000` | 04/08 | o de e da loja e a serie vira lastro |
| 59 | `20260804210000` | 04/08 | perfume o genero e a categoria errada |
| 60 | `20260804230000` | 04/08 | beauty sem suprimento de salao |
| 61 | `20260805000000` | 05/08 | o litro so vale para beleza |
| 62 | `20260805010000` | 05/08 | desmarca gloss e kit de pinceis |
| 63 | `20260805020000` | 05/08 | a deteccao nao morre no timeout de oito segundos |
| 64 | `20260805030000` | 05/08 | a folga na funcao nao funciona e sai |
| 65 | `20260805040000` | 05/08 | selo do vendedor e cupom no post |
| 66 | `20260805050000` | 05/08 | o horario do canal deixa de mentir |
| 67 | `20260805060000` | 05/08 | o beauty para de receber aplique de cabelo |
| 68 | `20260805070000` | 05/08 | a busca do ml para de perguntar sempre a mesma coisa |
| 69 | `20260805080000` | 05/08 | o uso profissional para de valer so uma vez |
| 70 | `20260805090000` | 05/08 | desfaz o que a 66 remarcou por usar a regra velha |
| 71 | `20260805100000` | 05/08 | kit de pincel volta para o beauty |
| 72 | `20260805110000` | 05/08 | a audiencia do canal vira serie |
| 73 | `20260805120000` | 05/08 | a serie de audiencia faltava grant |
| 74 | `20260805130000` | 05/08 | casa e eletronico entram em migration |
