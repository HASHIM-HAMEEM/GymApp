-- Run AFTER deploying send-expiry-reminders and configuring its secrets.
-- In Supabase Vault create these secrets through the dashboard:
-- apex_function_url = https://<project-ref>.supabase.co/functions/v1/send-expiry-reminders
-- apex_cron_secret = the same strong random value as Edge Function CRON_SECRET.
-- Never put the Resend API key or service role key in this schedule.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare existing_job bigint;
begin
  if not exists(select 1 from vault.decrypted_secrets where name='apex_function_url')
    or not exists(select 1 from vault.decrypted_secrets where name='apex_cron_secret') then
    raise exception 'Configure apex_function_url and apex_cron_secret in Vault first';
  end if;
  for existing_job in select jobid from cron.job where jobname='apex-expiry-reminders' loop
    perform cron.unschedule(existing_job);
  end loop;
  perform cron.schedule(
    'apex-expiry-reminders',
    '30,45 3 * * *', -- 09:00 and a retry at 09:15 Asia/Kolkata (UTC+05:30)
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='apex_function_url' limit 1),
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

select jobname, schedule, active from cron.job where jobname='apex-expiry-reminders';
