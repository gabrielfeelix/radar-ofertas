-- =============================================================
-- 32 · O vendedor desconhecido para de passar
--
-- O PROBLEMA, medido no banco da nuvem em 01/08/2026:
--
--   reputacao_vendedor nula ... 288 de 708 anúncios (41%)
--   avaliacao nula ........... 207 de 708 (29%)
--
-- E `reprova()` tem, desde a migration 22, a regra de que **nulo não
-- reprova**, com uma justificativa boa: *"dado que não medimos não é
-- dado ruim: a loja pode simplesmente não informar avaliação"*.
--
-- Ela continua certa para a AVALIAÇÃO do produto, que a loja pode
-- realmente não informar. Ela está errada para a REPUTAÇÃO DO
-- VENDEDOR, e a diferença é esta: reputação de vendedor no Mercado
-- Livre **sempre existe**. Se está nula no nosso banco, não é porque
-- a loja não informou, é porque nós não perguntamos.
--
-- Ou seja: os 41% não são vendedores sem nota. São vendedores sobre
-- quem o sistema aprovou sem olhar.
--
-- Isso contraria diretamente o que o dono pediu ao encerrar a
-- aprovação manual (D-033): ele tirou o humano da conferência de
-- vendedor **porque as comportas fariam o trabalho**. Comporta que
-- deixa passar 4 em cada 10 sem medir não está fazendo o trabalho.
--
-- E a pesquisa de campo (`docs/pesquisa/sintese.md` §5) põe
-- desconfiança como o terceiro motivo de alguém sair de um canal.
--
-- A CORREÇÃO PRINCIPAL NÃO É ESTA MIGRATION, e vale dizer: é a
-- releitura horária passar a gravar quem vende junto com o preço
-- (`scripts/coleta-mercado-livre.mjs`, `relePrecos`). Ela derruba
-- sozinha a maior parte dos 288. Esta migration é a rede embaixo,
-- para o que sobrar.
-- =============================================================

-- -------------------------------------------------------------
-- O parâmetro, e ele é desligável
--
-- Vive em `parametro` como todos os outros (D-023), para ser
-- calibrado sem publicar versão. Nasce ligado porque publicar
-- vendedor não medido é o oposto do que a curadoria automática
-- promete — mas se ele derrubar o volume a ponto de o canal ficar
-- mudo, desligar é um UPDATE, não um deploy.
-- -------------------------------------------------------------
insert into public.parametro (operacao_id, chave, valor, descricao)
select id, 'reputacao_nula_reprova', 1,
       'Reprova anúncio sem reputação de vendedor medida. Loja oficial dispensa: a confiança vem da marca. 0 desliga.'
  from public.operacao
on conflict do nothing;


-- -------------------------------------------------------------
-- A visão de quanto isso custa, ANTES de ligar
--
-- Sem ela, a única forma de saber o impacto é ligar e ver o canal
-- emudecer. Esta view responde a pergunta em SQL: quantos anúncios
-- ativos passariam hoje e quantos parariam, separando quem é
-- dispensado por ser loja oficial.
-- -------------------------------------------------------------
create or replace view public.confianca_do_vendedor as
select a.operacao_id,
       count(*)                                                     as anuncios_ativos,
       count(*) filter (where a.loja_oficial)                       as loja_oficial,
       count(*) filter (where a.reputacao_vendedor is not null)     as com_reputacao,
       count(*) filter (where a.reputacao_vendedor is null
                          and not coalesce(a.loja_oficial, false))   as sem_reputacao_e_sem_dispensa,
       count(*) filter (where a.vendas_estimadas is not null)       as com_vendas,
       count(*) filter (where a.avaliacao is not null)              as com_avaliacao
  from public.anuncio a
 where a.ativo
 group by a.operacao_id;

comment on view public.confianca_do_vendedor is
  'Quanto do catálogo tem confiança medida. `sem_reputacao_e_sem_dispensa` é exatamente quem para de passar com reputacao_nula_reprova = 1.';

grant select on public.confianca_do_vendedor to authenticated, service_role;
