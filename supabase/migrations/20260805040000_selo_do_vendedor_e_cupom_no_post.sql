-- =============================================================
-- 64 · O selo do vendedor, e o cupom colado no post da oferta
-- =============================================================
--
-- Duas coisas que os canais concorrentes fazem e nós não, levantadas em
-- `docs/concorrentes-lidos.md` a partir de posts reais:
--
--   🏪 Loja: BAGATELLE (+10.000 vendas, mercadolíder)
--   🏷 Cupom: AMODESCONTO
--
-- ---------------------------------------------------------------
-- 1. `anuncio.selo_vendedor`
-- ---------------------------------------------------------------
--
-- O Mercado Livre devolve `power_seller_status` (`platinum`, `gold`,
-- `silver`) junto da reputação, e o coletor **jogava fora**.
--
-- Não por descuido: `reputacaoDoVendedor` colapsa `level_id` e
-- `power_seller_status` num número de 0 a 1, porque é isso que a
-- comporta `reputacao_minima` compara. Só que ela fecha com
-- `Math.min(1, ...)`, e aí verde comum (1,0) e verde platinum
-- (1,0 + 0,05 → 1,0) viram o MESMO valor. Medido em produção: dos 3.739
-- anúncios do ML com reputação, 917 estão em 1,0 e não há como saber
-- quais são platinum.
--
-- É a D-047 de novo, literal: *"o dado vem na resposta da API, alguém
-- usa para uma coisa só, e descarta o resto"*.
--
-- Fica texto cru e não número: aqui ele é para LER, não para comparar.
-- Quem compara continua sendo `reputacao_vendedor`, que não muda.
--
-- Nulo é o esperado na Shopee e na Amazon: nenhuma das duas tem
-- equivalente, e a linha simplesmente não aparece.

alter table public.anuncio
  add column if not exists selo_vendedor text;

comment on column public.anuncio.selo_vendedor is
  'O `power_seller_status` cru do Mercado Livre (platinum/gold/silver). Existe para a mensagem dizer "MercadoLíder Platinum" — quem compara é `reputacao_vendedor` (migration 64).';

-- ---------------------------------------------------------------
-- 2. A linha do cupom na mensagem da oferta
-- ---------------------------------------------------------------
--
-- O cupom já existe desde a migration 21 e sai como POST PRÓPRIO
-- (D-039). Os concorrentes colam o código dentro do post da oferta, e
-- é o item de maior retorno da leitura de 04/08: o dado já é nosso, o
-- post já sai, e falta uma linha.
--
-- COMO A LINHA SOME QUANDO NÃO HÁ CUPOM: igual à do frete e à da nota
-- do curador. `{cupom}` vira string vazia e o `preenche` colapsa as
-- quebras que sobram. Rótulo órfão numa mensagem por dia é detalhe; em
-- trinta por dia é sujeira.

alter table public.modelo_mensagem
  add column if not exists linha_cupom text not null default '🎟 Cupom: <b>{codigo}</b>';

comment on column public.modelo_mensagem.linha_cupom is
  'A linha do cupom dentro do post da oferta. Some inteira quando não há cupom que sirva (migration 64).';

-- ---------------------------------------------------------------
-- 3. `{cupom}` entra no corpo, POR POSIÇÃO DE VARIÁVEL
-- ---------------------------------------------------------------
--
-- **NUNCA CASE POR EMOJI.** As migrations 28 e 49 procuravam `🛒` e
-- nunca se aplicaram, porque o corpo local tinha `👉` e o da nuvem
-- tinha sido editado à mão pelo painel. A F-06 existe por causa disso e
-- a migration 61 consertou casando por variável.
--
-- O cupom entra logo depois do frete, que é onde o leitor já está
-- olhando condição de compra, e antes do link, que é a última linha.

update public.modelo_mensagem
   set corpo = replace(corpo, '{frete}', '{frete}' || E'\n\n' || '{cupom}')
 where corpo like '%{frete}%'
   and corpo not like '%{cupom}%';

-- Modelo sem `{frete}` (nenhum hoje, mas o painel deixa editar) recebe
-- o cupom antes do link, que é a outra âncora estável.
update public.modelo_mensagem
   set corpo = replace(corpo, '{link}', '{cupom}' || E'\n\n' || '{link}')
 where corpo not like '%{frete}%'
   and corpo not like '%{cupom}%'
   and corpo like '%{link}%';

-- ---------------------------------------------------------------
-- 4. A coluna nova entra na regra do travessão
-- ---------------------------------------------------------------
--
-- A constraint da migration 43 nomeia coluna por coluna, de propósito:
-- `descricao` e comentário seguem com travessão à vontade, e varrer a
-- tabela inteira barraria os dois.
--
-- O efeito colateral é que coluna nova nasce FORA da regra, e o painel
-- deixa editar `linha_cupom`. Sem esta parte, a regra 3.11 teria um
-- buraco do tamanho de uma linha por post.

alter table public.modelo_mensagem
  drop constraint if exists modelo_mensagem_sem_travessao;

alter table public.modelo_mensagem
  add constraint modelo_mensagem_sem_travessao check (
    coalesce(corpo,            '') !~ '[—–]' and
    coalesce(corpo_cupom,      '') !~ '[—–]' and
    coalesce(lastro_com,       '') !~ '[—–]' and
    coalesce(lastro_sem,       '') !~ '[—–]' and
    coalesce(lastro_queda,     '') !~ '[—–]' and
    coalesce(lastro_declarado, '') !~ '[—–]' and
    coalesce(nota_prefixo,     '') !~ '[—–]' and
    coalesce(linha_frete,      '') !~ '[—–]' and
    coalesce(linha_cupom,      '') !~ '[—–]'
  );

comment on constraint modelo_mensagem_sem_travessao on public.modelo_mensagem is
  'Regra 3.11: travessão tem cara de texto de IA, e canal de oferta vive de parecer gente. Vale só para as colunas que o público lê. `linha_cupom` entrou na migration 64.';
