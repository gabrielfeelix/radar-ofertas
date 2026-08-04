-- =============================================================
-- 65 · O cursor da descoberta, para a busca parar de congelar
--
-- O DEFEITO, e ele e do tipo que nao da erro nenhum: `porBusca` no
-- `coleta-mercado-livre.mjs` pedia `products/search` SEM offset. Cada
-- rodada perguntava a mesma coisa e recebia a mesma resposta, e o
-- filtro de "ja conhecidos" descartava tudo em silencio. Com 126 termos
-- a 20 por termo, a busca tinha um teto duro de 2.520 produtos na vida
-- inteira do projeto. Alcancado o teto, ela passou a contribuir ZERO.
--
-- COMO APARECEU: o dono cobrou, em 04/08, que o canal de pet nao
-- recebia brinquedo, casinha, arranhador nem coleira. Medido antes de
-- mexer, e o diagnostico obvio estava errado tres vezes:
--
--   os termos existiam        "brinquedo pet", "casinha cachorro",
--                             "arranhador gato", "coleira cachorro"
--   os dominios estavam       MLB-DOG_TOY_BONES, MLB-DOG_HOUSES,
--   mapeados para pet         MLB-CAT_SCRATCHERS, MLB-PET_COLLARS
--   as comportas nao          6 anuncios de brinquedo no catalogo,
--   reprovavam                contra 275 de antipulgas
--
-- Nao era filtro, nao era mapa e nao era comporta. Era o catalogo, e o
-- catalogo era pequeno porque cada termo entregou seus 20 uma vez, em
-- 01/08, e nunca mais.
--
-- E O MESMO DEFEITO QUE O ARQUIVO JA DOCUMENTA um nivel acima, no
-- `slice` que pegava sempre os 600 primeiros do rodizio. La o conserto
-- foi o filtro de conhecidos; aqui o filtro e justamente o que esconde
-- o problema, porque ele descarta calado.
--
-- POR QUE UM CURSOR NO BANCO, e nao so uma janela maior. Janela fixa
-- maior (0 a 60) apenas adia o congelamento para 60. E o cursor precisa
-- sobreviver ao agendador: cada execucao do Actions comeca de um clone
-- limpo, entao cursor em memoria valeria zero toda rodada, que e o
-- estado que estamos consertando.
--
-- `parametro` e o lugar, e nao uma tabela nova: e onde os numeros que
-- se ajustam ja moram, `valor` e numeric, e o painel de curadoria ja
-- sabe listar. Uma coluna a menos para explicar.
-- =============================================================

insert into public.parametro (operacao_id, chave, nicho_id, valor, descricao)
select o.id,
       'descoberta_ml_offset',
       null,
       0,
       'Onde a busca por termo do Mercado Livre comeca, na proxima rodada. '
       'O coletor le, soma ML_PAGINAS_POR_BUSCA * ML_PRODUTOS_POR_BUSCA e grava de volta, '
       'dando a volta ao chegar em ML_OFFSET_MAX. Sem isto a busca pergunta sempre a '
       'mesma coisa e a descoberta congela sem erro nenhum.'
  from public.operacao o
 where not exists (
   select 1 from public.parametro p
    where p.operacao_id = o.id
      and p.chave = 'descoberta_ml_offset'
      and p.nicho_id is null
 );
