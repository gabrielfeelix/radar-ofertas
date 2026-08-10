-- =============================================================
-- 62 · O lastro declarado voltou a repetir os preços, e agora não volta
--
-- O QUE O DONO VIU, no grupo, em 10/08:
--
--   de ~R$ 69,21~ por *R$ 22,76*
--   *67% off* 😮‍💨
--
--   a loja marcou de R$ 69,21 por R$ 22,76      ← esta linha
--
-- Palavras dele: *"FODASE qq tem a ver, ja tem ali de tanto por tanto,
-- pq repetir?"*. São os mesmos dois valores, duas linhas acima.
--
-- E ELE JÁ TINHA DITO ISSO DUAS VEZES. A migration 39 tirou a repetição
-- em 01/08 com quase as mesmas palavras dele, e a 43 apagou a linha
-- inteira em 03/08 (*"não precisa dizer isso"*). Mesmo defeito, terceira
-- aparição. Quando uma decisão volta três vezes, o problema não é a
-- decisão: é não haver nada impedindo a volta.
--
-- POR QUE ELA VOLTOU, e são três buracos que se somaram:
--
--   1. A migration 43 fez `update` nas LINHAS e não mexeu no DEFAULT da
--      coluna. Quem apaga dado e esquece o default conserta o presente e
--      deixa o futuro igual.
--   2. `lib/modelo.ts` guarda um modelo de reserva com o texto antigo, e
--      o comentário dele promete, com todas as letras, ser *"o mesmo que
--      a migration insere, para que os dois não divirjam em silêncio"*.
--      Divergiu em silêncio, que é exatamente o que ele prometia não
--      fazer. Corrigido no mesmo commit desta migration.
--   3. O modelo do Radar Delas nasceu em 10/08 digitado à mão na tela
--      `/ajustes/modelos`, e o texto foi escrito de novo por quem não
--      sabia das duas migrations. Nada no banco recusou.
--
-- O QUE ISTO NÃO É: censura à atribuição. O "de" da Shopee e do Mercado
-- Livre é alegação da LOJA, não medição nossa, e a migration 39 registra
-- por que ele não pode ser afirmado como nosso (regra 3.4). O que a 43
-- decidiu, e continua valendo, é que o corpo já mostra "de X por Y" sem
-- nunca dizer que a série é nossa: as três linhas que carregam a regra
-- são `lastro_com`, `lastro_sem` e `lastro_queda`, e elas ficam intactas.
--
-- A linha some sem deixar buraco: `montaMensagem` colapsa três ou mais
-- quebras em duas, então o `{lastro}` vazio leva junto o par que o
-- cercava. É o mesmo caminho da nota do curador e da linha de frete.
-- =============================================================


-- -------------------------------------------------------------
-- 1. As linhas de hoje
--
-- Vale para qualquer modelo, e não só o do Delas: se um segundo canal
-- ganhou voz própria hoje e ninguém percebeu, ele entra aqui junto.
-- -------------------------------------------------------------
update public.modelo_mensagem
   set lastro_declarado = '',
       atualizado_em = now()
 where lastro_declarado <> '';


-- -------------------------------------------------------------
-- 2. O DEFAULT, que é o buraco que a 43 deixou aberto
--
-- Canal novo com voz própria nasce sem a linha, em vez de nascer com o
-- texto de 03/08 que já tinha sido aposentado.
-- -------------------------------------------------------------
alter table public.modelo_mensagem
  alter column lastro_declarado
  set default '';


-- -------------------------------------------------------------
-- 3. A trava, que é o que impede a quarta aparição
--
-- Regra que vive em constraint não regride, e esta já regrediu duas
-- vezes vivendo só em comentário de migration. A tela `/ajustes/modelos`
-- passa a recusar o texto em vez de aceitar calada.
--
-- A constraint proíbe os PLACEHOLDERS, não a linha: `lastro_declarado`
-- continua podendo receber uma frase de atribuição, se um dia se decidir
-- que ela faz falta. O que ela não pode é repetir números que o corpo já
-- mostra, que é a queixa das três vezes.
--
-- VALIDADA, e não `not valid`: a D-040 é literalmente sobre uma
-- constraint `not valid` que não conferia nada e deixou nove publicações
-- saírem duplicadas. O passo 1 acima já deixou toda linha em branco,
-- então validar não recusa nada que exista.
-- -------------------------------------------------------------
alter table public.modelo_mensagem
  drop constraint if exists modelo_mensagem_lastro_declarado_sem_precos;

alter table public.modelo_mensagem
  add constraint modelo_mensagem_lastro_declarado_sem_precos
  check (
    coalesce(lastro_declarado, '') not like '%{antes}%' and
    coalesce(lastro_declarado, '') not like '%{agora}%'
  );

comment on column public.modelo_mensagem.lastro_declarado is
  'Usado quando oferta.gatilho = declarado, e VAZIO desde a migration 43 por decisão do dono. NUNCA repete {antes} nem {agora}: eles já estão no corpo, e a constraint recusa. Se um dia voltar a ter texto, ele atribui o "de" à loja sem citar os valores (regra 3.4).';
