-- =============================================================
-- 66 · Eletrônico sai do canal de beleza
--
-- Em 11/08 o Radar Delas, que é grupo de mulheres sobre beleza e
-- autocuidado, publicou isto:
--
--     Limpador De fone AirPods Higienizador        R$ 24,83
--
-- E a curadoria NÃO ERROU. O caminho inteiro está correto:
--
--     Shopee diz         Beauty > Beauty Tools
--     nicho_dominio diz  SHOPEE-100663 -> beleza
--     canal aceita       Radar Delas cobre beleza
--
-- Quem classifica limpador de AirPods como ferramenta de beleza é a
-- **Shopee**, e o nosso mapeamento obedece porque obedecer é o certo na
-- imensa maioria dos casos: `Beauty Tools` também é pincel, esponja,
-- pinça e espelho, que são o produto-alvo do canal.
--
-- POR ISSO O CORTE É POR TÍTULO E NÃO POR DOMÍNIO (decisão do dono em
-- 11/08). Rebaixar `SHOPEE-100663` a ramo secundário foi a alternativa
-- oferecida e recusada: derrubaria o pincel junto com o fone.
--
-- O MECANISMO É O QUE JÁ EXISTE, e nada de tabela nova: o atributo sai
-- do título (`lib/eletronico-em-beleza.ts`), grava em
-- `produto.atributos.TIPO`, e o canal decide por `canal_atributo`. É o
-- mesmo desenho do `USO` (migration 55) e do `GENDER` (migration 37).
--
-- A MARCAÇÃO É GLOBAL, A EXCLUSÃO É DO CANAL. Um fone marcado como
-- eletrônico no catálogo inteiro não atrapalha ninguém: só Delas e
-- Beauty excluem, e o Radar Tech continua recebendo fone normalmente.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Os dois canais de beleza passam a recusar eletrônico
--
-- O Beauty entra junto e não por precaução: o diagnóstico de 04/08 já
-- tinha listado "escova de dente elétrica Oral-B" e "suporte de celular
-- com espelho" entre os produtos que não são beleza e chegaram lá.
-- -------------------------------------------------------------
insert into public.canal_atributo (operacao_id, canal_id, atributo, valores, modo)
select c.operacao_id, c.id, 'TIPO', array['eletronico'], 'exclui'
  from public.canal c
 where c.nome in ('Radar Delas', 'Radar Beauty')
   and not exists (
     select 1 from public.canal_atributo a
      where a.canal_id = c.id and a.atributo = 'TIPO'
   );


-- -------------------------------------------------------------
-- 2. O catálogo que já está no banco
--
-- Sem isto, o conserto só vale para o que o coletor trouxer daqui para
-- a frente, e a fila de hoje continuaria publicando fone no grupo de
-- beleza pelas próximas horas.
--
-- SÓ EM BELEZA E PERFUME, de propósito. Marcar o catálogo inteiro não
-- mudaria nada hoje (nenhum outro canal exclui `TIPO`) e faria esta
-- migration tocar dezenas de milhares de linhas sem necessidade. Os
-- coletores marcam o resto com o tempo, pela mesma regra.
--
-- A lista repete `lib/eletronico-em-beleza.ts`, e a duplicação é
-- consciente: aqui é um remendo de uma vez, lá é a regra viva. Se
-- divergirem, a do TypeScript é a que vale.
-- -------------------------------------------------------------
update public.produto p
   set atributos = coalesce(p.atributos, '{}'::jsonb) || '{"TIPO":"eletronico"}'::jsonb,
       atualizado_em = now()
  from public.nicho n
 where n.id = p.nicho_id
   and n.slug in ('beleza', 'perfume')
   -- Quem já tem TIPO marcado à mão não é sobrescrito.
   and (p.atributos ->> 'TIPO') is null
   -- O produto de beleza que só MENCIONA eletrônico é resgatado antes
   -- de tudo: secador com cabo USB continua sendo secador.
   and lower(p.titulo_canonico) !~ '\m(secador|chapinha|prancha de cabelo|modelador de cachos|babyliss|depilador|barbeador|aparador de pelos|escova secadora|escova alisadora|escova rotativa)\M'
   and lower(p.titulo_canonico) ~ '\m(fone|fones|airpods|air pods|headset|headphone|earbud|celular|smartphone|iphone|tablet|notebook|laptop|teclado|mouse|monitor|computador|impressora|roteador|pendrive|ssd|hd externo|cabo usb|carregador|power bank|caixa de som|smartwatch|controle remoto|videogame|playstation|xbox|nintendo|drone)\M';
