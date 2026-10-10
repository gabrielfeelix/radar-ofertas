-- Gatilho do monitor de celular do dono: o pg_cron manda o GitHub
-- Actions rodar o `monitor-celular.yml` de 15 em 15 minutos.
--
-- Mesmo desenho do `dispara_rotina_diaria` (migration 20260804120000) e
-- do `dispara_publicacao`: o banco é gatilho, não agendador. Ele não
-- consulta preço nem manda mensagem; o trabalho e o log ficam no
-- Actions (D-015).
--
-- Existe porque o agendador do GitHub entrega cerca de uma execução em
-- cada oito (D-052), e o monitor nasceu dentro da coleta horária, que em
-- 10/10 rodou às 06h26 e não rodou mais. Um aviso de preço que chega
-- horas depois não serve.
--
-- NÃO É PRODUTO: é o monitor pessoal pedido pelo dono em 10/10. Para
-- desligar sem publicar versão:
--   select cron.unschedule('dispara-monitor-celular');

create or replace function public.dispara_monitor_celular()
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

  if v_token is null then
    raise warning 'dispara_monitor_celular: falta o segredo github_dispatch_token no Vault';
    return;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/gabrielfeelix/radar-ofertas/actions/workflows/monitor-celular.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || v_token,
      'X-GitHub-Api-Version', '2022-11-28',
      'Content-Type', 'application/json',
      'User-Agent', 'radar-ofertas-pg-cron'
    )
  );
end;
$$;

comment on function public.dispara_monitor_celular is
  'Manda o GitHub Actions rodar o monitor-celular.yml (monitor pessoal de celular do dono), de 15 em 15 minutos.';

revoke all on function public.dispara_monitor_celular() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('dispara-monitor-celular');
exception when others then
  null;
end;
$$;

select cron.schedule('dispara-monitor-celular', '*/15 * * * *', 'select public.dispara_monitor_celular()');
