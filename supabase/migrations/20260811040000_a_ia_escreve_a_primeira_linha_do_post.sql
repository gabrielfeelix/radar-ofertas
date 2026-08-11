-- =============================================================
-- 64 · A IA escreve a primeira linha do post
--
-- O dono comparou o nosso post com o dos concorrentes em 10/08 e viu o
-- que falta: eles abrem com uma linha que faz parar de rolar a tela.
--
--   ORGANIZAAAA ESSES SAPATO             (sapateira organizadora)
--   PRA NÃO TER MAIS BRIGA NO SOFÁ       (kit de cobertores)
--   CHEIROSO PAGANDO POUCO               (perfume masculino)
--
-- Pedido dele: *"a gente consegue ligar uma IA nesses posts? pra ela
-- analisar o item e falar algo super criativo e condizente com grupo
-- feminino"*.
--
-- ISTO ERA FORA DE ESCOPO ATÉ A FASE 4, e está escrito assim no
-- `AGENTS.md` em dois lugares: *"IA para mensagens: fora do escopo
-- inicial, template resolve a maioria dos casos"* e a lista de proibidos
-- até a Fase 4. **O dono derrubou as duas em 10/08**, com a chave do
-- Gemini na mão. A seção 9 autoriza: só 3.1, 3.2, 3.3, 3.4 e 3.10 são
-- intocáveis sem conversa, e nenhuma delas é esta. As que ENCOSTAM
-- nisto continuam valendo inteiras, e viraram validação em código:
-- o gancho não fala de preço (3.4), não usa travessão (3.11) e não
-- substitui o `#publi` (3.10).
--
-- O QUE A IA LÊ: só o título. Os quatro exemplos acima saem todos do
-- título, sem olhar foto. Ler imagem custaria mais, seria mais lento e
-- esbarraria na 3.3 no caso da Amazon.
--
-- TRÊS COISAS ENTRAM AQUI
--
--   1. `publicacao.gancho` guarda o que a IA escreveu. Não é só
--      auditoria: a fila é relida a cada rodada, e sem guardar, a mesma
--      publicação pagaria uma chamada por tentativa. Guardado, a
--      segunda rodada reaproveita.
--   2. `modelo_mensagem.instrucao_gancho` é a VOZ do canal. Nula
--      significa canal sem gancho, e é assim que se escolhe onde ligar:
--      o Radar Delas e o Radar Geek não falam igual, e um texto só para
--      os dois seria pior que texto nenhum. Nasce preenchida só no
--      Delas, que é o canal do pedido.
--   3. O parâmetro `ia_gancho` é o freio de mão. Zerado, nenhuma
--      chamada é feita e todo post volta a sair como hoje.
--
-- E o `{gancho}` entra no corpo do modelo do Delas, acima do produto.
-- Vazio ele some junto com a quebra, como a nota e o frete já fazem.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Onde o gancho fica guardado
-- -------------------------------------------------------------
alter table public.publicacao
  add column if not exists gancho text;

comment on column public.publicacao.gancho is
  'A primeira linha do post, escrita pela IA (migration 64). Guardada para auditoria e para a rodada seguinte não pagar outra chamada pela mesma publicação. Nula = canal sem gancho, IA fora do ar, ou resposta reprovada na validação.';


-- -------------------------------------------------------------
-- 2. A voz do canal
--
-- É instrução de tom, não modelo de texto: o que ela descreve é COMO
-- falar, e quem escreve é a IA. Fica em `modelo_mensagem` porque é ali
-- que a voz de cada canal já mora desde 10/08.
-- -------------------------------------------------------------
alter table public.modelo_mensagem
  add column if not exists instrucao_gancho text;

comment on column public.modelo_mensagem.instrucao_gancho is
  'A voz do canal para a IA do gancho (migration 64). NULA = este canal não usa gancho, e nenhuma chamada é feita por ele. Descreve quem lê e o tom, nunca o texto pronto.';


-- -------------------------------------------------------------
-- 3. O freio de mão
-- -------------------------------------------------------------
insert into public.parametro (operacao_id, chave, valor, descricao)
select o.id, v.chave, v.valor, v.descricao from public.operacao o,
(values
  ('ia_gancho', 1,
   'A IA escreve a primeira linha do post (migration 64). 1 liga, 0 desliga toda chamada e todo canal volta a publicar sem gancho. Onde ela vale é decidido por modelo_mensagem.instrucao_gancho, que nulo significa canal sem gancho.')
) as v(chave, valor, descricao)
where not exists (
  select 1 from public.parametro p
  where p.operacao_id = o.id and p.chave = v.chave and p.nicho_id is null
);


-- -------------------------------------------------------------
-- 4. O Radar Delas ganha voz e lugar para o gancho
--
-- A voz descreve QUEM LÊ, e não o que escrever: o que sai de "mulher
-- adulta falando de beleza com as amigas" é diferente do que sai de
-- "escreva engraçado", e a segunda forma é a que produz piada genérica.
--
-- O `{gancho}` entra ACIMA do produto e ABAIXO do `#publi`: a regra 3.10
-- manda a identificação aparecer de imediato, e ela continua sendo a
-- primeira linha da mensagem. O gancho é a primeira linha do CONTEÚDO.
-- -------------------------------------------------------------
update public.modelo_mensagem
   set instrucao_gancho =
         'Quem lê são mulheres adultas, brasileiras, falando de beleza, autocuidado, cabelo, perfume e casa. O tom é o de uma amiga animada que achou a coisa e veio contar no grupo: espontânea, calorosa, um pouco exagerada, com humor do cotidiano. Nada de linguagem de loja, nada de deboche sobre o corpo de quem lê.',
       corpo = '#publi · {loja}

{gancho}

{emoji} <b>{produto}</b>

{nota}

de <s>{preco_antes}</s> por <b>{preco}</b>
<b>{desconto}% off</b> 😮‍💨

{lastro}
{cupom}
{frete}
🏪 {vendedor}

🛒 {link}',
       atualizado_em = now()
 where canal_id = (select id from public.canal where nome = 'Radar Delas')
   and ativo;
