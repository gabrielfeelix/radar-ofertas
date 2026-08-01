-- =============================================================
-- 17 · Cadência, queda agora e cupom
--
-- Três coisas que só fazem sentido juntas, porque respondem à
-- mesma descoberta: o canal de oferta é operação de TEMPO REAL, e
-- este sistema estava desenhado como fotografia diária.
--
-- O comprador entra no Telegram e vê promoção o dia inteiro. Quem
-- administra não busca de manhã e posta o dia todo — posta quando
-- aparece. Coletar uma vez por dia perde tudo que cai à tarde.
--
-- 1. `credencial_rotativa` destrava rodar de hora em hora.
-- 2. `oferta.gatilho` permite publicar no dia 1 sem mentir.
-- 3. `cupom` é o segundo motivo de publicar, e não existia.
-- =============================================================


-- -------------------------------------------------------------
-- credencial_rotativa — o token que se troca sozinho
--
-- O Mercado Livre TROCA o refresh token a cada renovação e invalida
-- o anterior. Enquanto o coletor rodava à mão, gravar no `.env`
-- resolvia. Para rodar de hora em hora no agendador não resolve:
-- GitHub Actions começa de um clone limpo toda vez, então o token
-- gravado em arquivo morre com o processo — a primeira execução
-- funciona e a segunda falha calada, dizendo só que "pulei a loja".
--
-- Por isso ele vira linha de banco. É a única coisa aqui que o
-- sistema escreve em si mesmo, e é de propósito: token rotativo não
-- é configuração, é estado.
-- -------------------------------------------------------------
create table public.credencial_rotativa (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references public.operacao(id) on delete cascade,
  marketplace_id uuid not null references public.marketplace(id) on delete cascade,
  chave          text not null,
  valor          text not null,
  -- Quando o valor foi trocado pela última vez. Sem isto não há como
  -- saber se o coletor parou de renovar — que é a falha silenciosa
  -- mais provável deste sistema.
  atualizado_em  timestamptz not null default now(),
  criado_em      timestamptz not null default now(),

  constraint credencial_rotativa_unica unique (marketplace_id, chave)
);

comment on table public.credencial_rotativa is
  'Segredo que a própria aplicação troca — hoje só o refresh token do ML, que rotaciona a cada renovação.';

alter table public.credencial_rotativa enable row level security;

-- Ninguém lê isto pelo painel. Só a chave de serviço, que é quem
-- roda o coletor. Sem policy para `authenticated`: RLS ligado e
-- nenhuma permissão é a leitura correta de "isto não é da tela".
grant select, insert, update on public.credencial_rotativa to service_role;


-- -------------------------------------------------------------
-- oferta.gatilho — o que autoriza a mensagem a dizer
--
-- O motor só chamava algo de oferta com 7 dias de série própria, e
-- isso é o diferencial do projeto: mede o desconto contra o que NÓS
-- observamos, não contra o "de/por" que a loja inventou.
--
-- Mas isso responde "está barato em relação ao histórico". A
-- operação também precisa de "caiu agora", que é o que o canal
-- concorrente publica e o que funciona no dia 1.
--
-- São duas perguntas diferentes, então viram dois gatilhos — e a
-- coluna existe para que a MENSAGEM saiba qual dos dois é. Sem ela,
-- uma queda de 3 horas viraria "menor preço que observamos", que é
-- a mentira que a regra 3.4 existe para impedir.
-- -------------------------------------------------------------
alter table public.oferta
  add column gatilho text not null default 'serie';

alter table public.oferta
  add constraint oferta_gatilho_valido check (gatilho in ('serie', 'queda'));

comment on column public.oferta.gatilho is
  'serie = barata contra a mediana que observamos. queda = caiu desde a leitura anterior. Decide o que a mensagem pode afirmar.';

-- Preço da leitura anterior, para a queda ter contra o que comparar.
alter table public.oferta
  add column preco_anterior_centavos integer;

comment on column public.oferta.preco_anterior_centavos is
  'Só em oferta de gatilho "queda": o preço da leitura anterior. É contra ele que a queda é medida.';


-- -------------------------------------------------------------
-- cupom — o segundo motivo de publicar
--
-- A API do Mercado Livre NÃO expõe cupom. Testado em 31/07: os
-- endpoints `coupons`, `deals` e `marketplace/coupons` devolvem 404
-- — não existem, não é permissão. Amazon e Shopee ainda não foram
-- testadas, e por isso a tabela já nasce por marketplace.
--
-- Então cupom é cadastro à mão, e o que se automatiza é a VALIDADE.
-- Esgotamento não dá para detectar: cupom que acabou antes da data
-- só se descobre usando. Por isso `esgotado_em` é separado de
-- `vigente_ate` — um é fato observado, o outro é promessa da loja.
-- -------------------------------------------------------------
create table public.cupom (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references public.operacao(id) on delete cascade,
  marketplace_id uuid not null references public.marketplace(id) on delete cascade,
  -- Nulo = vale para qualquer nicho. Preenchido = só naquele.
  nicho_id       uuid references public.nicho(id) on delete set null,

  codigo         text not null,
  descricao      text,

  tipo           text not null,
  -- Percentual (12 = 12%) ou centavos, conforme o tipo.
  valor          integer not null,
  -- Compra mínima para o cupom valer. Zero = sem mínimo.
  valor_minimo_centavos  integer not null default 0,
  -- Teto do desconto em cupom percentual. Nulo = sem teto.
  teto_desconto_centavos integer,

  vigente_de     timestamptz not null default now(),
  -- Nulo = sem prazo declarado. A tela avisa, porque cupom sem prazo
  -- é o que fica publicado depois de morrer.
  vigente_ate    timestamptz,
  -- Marcado à mão quando o cupom acaba antes da data. É fato
  -- observado, e mata o cupom na hora, independente do prazo.
  esgotado_em    timestamptz,

  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  constraint cupom_codigo_unico unique (operacao_id, marketplace_id, codigo),
  constraint cupom_tipo_valido check (tipo in ('percentual', 'valor')),
  constraint cupom_valor_positivo check (valor > 0),
  -- Percentual acima de 100 é erro de digitação, e o estrago é
  -- prometer no grupo um desconto que não existe.
  constraint cupom_percentual_ate_100
    check (tipo <> 'percentual' or valor <= 100),
  constraint cupom_prazo_coerente
    check (vigente_ate is null or vigente_ate > vigente_de)
);

comment on table public.cupom is
  'Cupom da loja, cadastrado à mão: nenhum marketplace expõe cupom por API (conferido em 31/07).';

create index cupom_vivo_idx on public.cupom (operacao_id, marketplace_id, ativo, vigente_ate);

create trigger cupom_atualizado_em
  before update on public.cupom
  for each row execute function public.marca_atualizado_em();

alter table public.cupom enable row level security;

create policy cupom_le on public.cupom
  for select to authenticated
  using (operacao_id = public.operacao_atual());

create policy cupom_dono on public.cupom
  for all to authenticated
  using (operacao_id = public.operacao_atual() and public.tem_papel('dono'))
  with check (operacao_id = public.operacao_atual() and public.tem_papel('dono'));

grant select, insert, update, delete on public.cupom to service_role;


-- -------------------------------------------------------------
-- cupons_vivos — os que podem entrar numa mensagem agora
--
-- View, e não consulta repetida na tela: "vivo" tem três condições
-- que precisam andar juntas, e cada lugar que as reescrevesse
-- acabaria discordando dos outros — o mais provável sendo a tela
-- oferecer um cupom que a mensagem já não usa.
-- -------------------------------------------------------------
create or replace view public.cupons_vivos as
  select c.*,
         m.slug as marketplace_slug,
         m.nome as marketplace_nome,
         n.slug as nicho_slug,
         case
           when c.vigente_ate is null then null
           else extract(epoch from (c.vigente_ate - now())) / 3600
         end as horas_restantes
  from public.cupom c
  join public.marketplace m on m.id = c.marketplace_id
  left join public.nicho n on n.id = c.nicho_id
  where c.ativo
    and c.esgotado_em is null
    and c.vigente_de <= now()
    and (c.vigente_ate is null or c.vigente_ate > now());

comment on view public.cupons_vivos is
  'Cupons que podem entrar numa mensagem AGORA. As três condições de "vivo" moram só aqui.';

grant select on public.cupons_vivos to authenticated, service_role;


-- -------------------------------------------------------------
-- desconto_com_cupom — quanto sobra depois do cupom
--
-- Mora no banco, junto do resto da regra de dinheiro. A tela nunca
-- recalcula: ela pergunta e recebe o número pronto, como faz com a
-- nota da curadoria.
--
-- Devolve o preço final em centavos. Cupom que não se aplica
-- devolve o preço original, e não erro: "não deu desconto" é uma
-- resposta, não uma falha.
-- -------------------------------------------------------------
create or replace function public.preco_com_cupom(
  p_preco_centavos integer,
  p_cupom_id       uuid
)
returns integer
language plpgsql
stable
as $$
declare
  v_cupom  public.cupom%rowtype;
  v_abate  integer;
begin
  select * into v_cupom from public.cupom where id = p_cupom_id;
  if not found then
    return p_preco_centavos;
  end if;

  -- Abaixo do mínimo o cupom simplesmente não vale.
  if p_preco_centavos < v_cupom.valor_minimo_centavos then
    return p_preco_centavos;
  end if;

  if v_cupom.tipo = 'percentual' then
    v_abate := (p_preco_centavos * v_cupom.valor) / 100;
    if v_cupom.teto_desconto_centavos is not null then
      v_abate := least(v_abate, v_cupom.teto_desconto_centavos);
    end if;
  else
    v_abate := v_cupom.valor;
  end if;

  -- Nunca abaixo de um centavo: preço zero publicado é o tipo de
  -- número que faz o grupo inteiro clicar e não encontrar nada.
  return greatest(1, p_preco_centavos - v_abate);
end;
$$;

comment on function public.preco_com_cupom is
  'Preço final depois do cupom, respeitando mínimo e teto. Cupom que não se aplica devolve o preço original.';

grant execute on function public.preco_com_cupom(integer, uuid) to authenticated, service_role;
