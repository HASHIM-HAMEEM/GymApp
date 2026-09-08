create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare existing_job bigint;
begin
  if not exists(select 1 from vault.decrypted_secrets where name='apex_push_receipt_function_url')
    or not exists(select 1 from vault.decrypted_secrets where name='apex_cron_secret') then
    raise exception 'Configure apex_push_receipt_function_url and apex_cron_secret in Vault first';
  end if;
  for existing_job in select jobid from cron.job where jobname='apex-push-receipts' loop
    perform cron.unschedule(existing_job);
  end loop;
  perform cron.schedule(
    'apex-push-receipts',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='apex_push_receipt_function_url' limit 1),
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='apex_cron_secret' limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );
end;
$$;

select jobname, schedule, active from cron.job where jobname='apex-push-receipts';
