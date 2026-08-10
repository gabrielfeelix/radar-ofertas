-- =============================================================
-- O Radar Delas recebe a fila que já existe
-- =============================================================
--
-- (Carimbo `20260810230000`.)
--
-- O CANAL NASCEU DEPOIS DA FILA, e isso o deixaria mudo.
--
-- `decideOferta` cria uma publicação por canal elegível **no momento da
-- aprovação** (`lib/ofertas.ts`). As 113 ofertas de beleza e perfume
-- aprovadas até agora foram roteadas quando o Radar Delas ainda não
-- existia: viraram publicação só para o Radar Beauty, do Telegram.
--
-- Consequência medida em 10/08, antes de ligar o interruptor: o canal
-- tinha **zero** publicações na fila. Virar `whatsapp_automatico` para
-- 1 não faria nada sair, e o silêncio pareceria defeito do chip ou da
-- Evolution, que são os dois lugares onde ninguém quer procurar.
--
-- Esta migration faz o roteamento retroativo, uma vez.
--
-- O FILTRO NÃO É REESCRITO AQUI. Quem decide se o canal aceita o
-- produto é `canal_aceita_atributos`, a mesma função que a aprovação
-- usa. Reimplementar a regra em SQL de migration é como as duas versões
-- começam a divergir, e a divergência só aparece no post errado.
--
-- Ela respeita, então, o que foi configurado hoje no canal:
--   GENDER exclui Masculino em perfume (exigindo o atributo)
--   GENDER exclui Masculino em beleza  (sem exigir)
--   USO    exclui profissional         (sem exigir)
--
-- O TETO NÃO ENTRA NA CONTA, e é de propósito: a fila pode ter mais do
-- que cabe num dia. Quem segura o volume é o publicador, com o teto do
-- canal e a rampa do chip. Uma fila de 100 com teto de 10 é uma fila de
-- dez dias, não um erro.

insert into public.publicacao (operacao_id, oferta_id, canal_id, preco_na_fila_centavos)
select
  o.operacao_id,
  o.id,
  c.id,
  o.preco_atual_centavos
from public.oferta o
join public.anuncio a on a.id = o.anuncio_id
join public.produto p on p.id = a.produto_id
join public.canal  c on c.nome = 'Radar Delas' and c.plataforma = 'whatsapp' and c.ativo
join public.canal_nicho cn on cn.canal_id = c.id and cn.nicho_id = p.nicho_id
where o.status = 'aprovada'
  and public.canal_aceita_atributos(c.id, p.atributos)
-- `do nothing` e não erro: a constraint `publicacao_oferta_canal_unico`
-- existe para a mesma oferta não ir duas vezes ao mesmo canal, e rodar
-- isto de novo não pode explodir.
on conflict (oferta_id, canal_id) do nothing;
