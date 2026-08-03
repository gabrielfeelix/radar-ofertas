-- =============================================================
-- 47 · O intervalo entre posts ganha folga sorteada
--
-- Até aqui o canal publicava de 5 em 5 minutos, cravado. Isso é o
-- carimbo mais óbvio de robô: nenhuma pessoa posta em horário exato,
-- hora após hora.
--
-- O dono notou observando os concorrentes: os horários deles são
-- irregulares. E levantou a hipótese de por quê — eles disparam mais
-- rápido do que conseguem encher, então às vezes sai com 2 minutos,
-- às vezes com 4, conforme haja oferta pronta. O efeito visível é o
-- mesmo, e é ele que queremos.
--
-- É a mesma preocupação da regra 3.11, que proíbe travessão no que vai
-- para o canal: o leitor não sabe explicar por que sente que é robô,
-- mas sente, e desconfiança em canal de oferta custa a venda.
--
-- A FOLGA ENCURTA E NUNCA ALONGA
--
-- Com `intervalo_pico_min` em 5 e folga 2, o intervalo sorteado é 3, 4
-- ou 5. Nunca 6 ou 7.
--
-- O motivo é que o intervalo configurado é o **teto de frequência que o
-- parceiro aceitou**, não uma média em torno da qual variar. Alongar
-- deixaria o canal mais lento que o combinado sem ninguém pedir; e a
-- variação só para cima seria pior ainda, porque publicaria mais que o
-- acertado.
--
-- Na madrugada, com intervalo de 30, a folga de 2 quase não aparece.
-- Está certo assim: de madrugada o problema não é parecer robô, é não
-- acordar ninguém.
-- =============================================================

insert into public.parametro (operacao_id, chave, valor, descricao)
select o.id, 'intervalo_jitter_min', 2,
       'Quantos minutos o intervalo entre posts pode ENCURTAR por sorteio. Zero desliga. Existe para o canal não publicar em horário exato, que é carimbo de robô.'
  from public.operacao o
 where not exists (
   select 1 from public.parametro p
    where p.operacao_id = o.id and p.chave = 'intervalo_jitter_min' and p.nicho_id is null
 );
