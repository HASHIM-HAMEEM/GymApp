create or replace function public.verify_cron_secret(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' or p_secret is null then
    return false;
  end if;

  return exists (
    select 1
    from vault.decrypted_secrets as secret
    where secret.name = 'apex_cron_secret'
      and extensions.digest(pg_catalog.convert_to(secret.decrypted_secret, 'UTF8'), 'sha256')
        = extensions.digest(pg_catalog.convert_to(p_secret, 'UTF8'), 'sha256')
  );
end;
$$;

revoke all on function public.verify_cron_secret(text) from public, anon, authenticated, service_role;
grant execute on function public.verify_cron_secret(text) to service_role;
