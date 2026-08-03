-- =============================================================
-- 46 · O banco passa a disparar a publicação, de 5 em 5 minutos
--
-- ISTO NÃO REVOGA A D-015, e a diferença é o que torna aceitável.
--
-- A D-015 recusou o `pg_cron` como AGENDADOR DE ROTINA, por três
-- motivos: dúvida se existia no plano gratuito, falha silenciosa, e o
-- efeito colateral bom de o GitHub manter o projeto acordado.
--
-- Aqui ele não é agendador, é GATILHO. Ele não coleta, não publica e
-- não expurga: ele faz uma chamada HTTP que manda o GitHub Actions
-- rodar. Todo o trabalho, todo o log e toda a falha continuam lá,
-- visíveis, como a D-015 queria. E o primeiro motivo caiu: o `pg_cron`
-- está disponível neste projeto, conferido em 03/08 (1.6.4).
--
-- POR QUE ISTO EXISTE
--
-- O agendamento do GitHub é melhor esforço e entrega uma fração do que
-- se pede. Medido em 03/08: com o cron pedindo de 15 em 15 minutos, o
-- `publica.yml` rodou duas vezes onde deveriam ter sido oito (D-052).
--
-- `workflow_dispatch` pela API não passa pelo agendador: entra na fila
-- como um push, e roda. Então em vez de pedir ao GitHub que lembre,
-- o banco manda.
--
-- POR QUE 5 MINUTOS, E O QUE ISSO NÃO FAZ
--
-- É o mesmo intervalo do ritmo de publicação em pico e normal
-- (`intervalo_pico_min`, `intervalo_normal_min`). Disparar mais vezes
-- que o ritmo não faz o canal falar mais: a execução que chega e
-- encontra a trava tomada sai na hora, sem publicar. O que isto compra
-- é o canal **nunca ficar mudo esperando execução**, que é o problema
-- de verdade.
--
-- O TOKEN NÃO ESTÁ AQUI
--
-- Ele vive no Vault do Supabase, com o nome `github_dispatch_token`, e
-- é inserido fora desta migration — este repositório é público. A
-- função lê de lá a cada disparo, então trocar o token é trocar o
-- segredo, sem publicar versão.
--
-- É um token de escopo mínimo, conferido em 03/08: dispara workflow
-- neste repositório e mais nada. Não lê segredo, não apaga repositório,
-- não alcança repositório privado.
-- =============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.dispara_publicacao()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
    from vault.decrypted_secrets
   where name = 'github_dispatch_token';

  -- Sem token não adianta chamar: a API responderia 401 e a falha
  -- ficaria enterrada na tabela do pg_net. Melhor um aviso no log do
  -- Postgres, que é onde alguém procura quando o canal fica mudo.
  if v_token is null then
    raise warning 'dispara_publicacao: falta o segredo github_dispatch_token no Vault';
    return;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/gabrielfeelix/radar-ofertas/actions/workflows/publica.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || v_token,
      'X-GitHub-Api-Version', '2022-11-28',
      'Content-Type', 'application/json',
      -- A API do GitHub recusa requisição sem User-Agent.
      'User-Agent', 'radar-ofertas-pg-cron'
    )
  );
end;
$$;

comment on function public.dispara_publicacao is
  'Manda o GitHub Actions rodar o publica.yml. Gatilho, não agendador: o trabalho acontece lá (D-015, D-052).';

revoke all on function public.dispara_publicacao() from public, anon, authenticated;

-- Reagendar é seguro: `unschedule` só reclama se o nome não existir, e
-- o bloco engole isso. Sem ele, rodar a migration duas vezes deixaria
-- dois gatilhos com o mesmo nome.
do $$
begin
  perform cron.unschedule('dispara-publicacao');
exception when others then
  null;
end;
$$;

select cron.schedule('dispara-publicacao', '*/5 * * * *', 'select public.dispara_publicacao()');
