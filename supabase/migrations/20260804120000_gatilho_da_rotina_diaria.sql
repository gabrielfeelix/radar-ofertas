-- =============================================================
-- 50 · A rotina diária também passa a ser disparada pelo banco
--
-- A migration 46 resolveu isso para a publicação e deixou a rotina
-- diária de fora. Ela cobrou o preço no dia seguinte: em 04/08 o cron
-- do GitHub pedia 09:00 UTC e, às 11:15, **não tinha rodado**. Sem ela,
-- não há descoberta no Mercado Livre, não há coleta da Shopee e não há
-- detecção de oferta — o dia inteiro depende de uma execução que o
-- GitHub decide se dispara.
--
-- É o mesmo remédio, pelo mesmo motivo (D-052): em vez de pedir ao
-- agendador que lembre, o banco manda. E a mesma ressalva vale — isto é
-- gatilho, não agendador: o trabalho e o log continuam no Actions.
--
-- POR QUE 21:00 EM SÃO PAULO, E NÃO DE MANHÃ
--
-- A Shopee atualiza o feed de produto no fim da tarde: visto em 02/08 às
-- 19:55 e em 03/08 às 20:09. A rotina rodava às 09:00 UTC, seis da
-- manhã aqui, então publicava sobre uma foto de até doze horas — e a
-- rodada de 03/08 chegou a coletar o feed VELHO por ter rodado às
-- 19:31, quarenta minutos antes de o novo sair.
--
-- `0 0 * * *` em UTC é **21:00 em São Paulo**, com quase uma hora de
-- folga depois do horário observado. A oferta passa a sair no mesmo dia
-- em que a Shopee a publicou.
--
-- O CRON DO GITHUB CONTINUA LIGADO, e de propósito: são dois caminhos
-- para a mesma tarefa, como na publicação. O do GitHub tenta às 09:00,
-- este manda às 00:00 UTC. Rodar as duas não faz mal — a coleta é
-- idempotente, ela atualiza o que já existe.
-- =============================================================

create or replace function public.dispara_rotina_diaria()
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
    raise warning 'dispara_rotina_diaria: falta o segredo github_dispatch_token no Vault';
    return;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/gabrielfeelix/radar-ofertas/actions/workflows/rotina-diaria.yml/dispatches',
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

comment on function public.dispara_rotina_diaria is
  'Manda o GitHub Actions rodar a rotina-diaria.yml, as 21h de Sao Paulo, depois de a Shopee atualizar o feed.';

revoke all on function public.dispara_rotina_diaria() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('dispara-rotina-diaria');
exception when others then
  null;
end;
$$;

-- 00:00 UTC = 21:00 em São Paulo. O Brasil não tem horário de verão
-- desde 2019; se voltar, esta é a linha que muda.
select cron.schedule('dispara-rotina-diaria', '0 0 * * *', 'select public.dispara_rotina_diaria()');
