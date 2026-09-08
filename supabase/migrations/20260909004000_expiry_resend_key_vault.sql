create or replace function public.set_expiry_resend_key(p_secret text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_secret is null or pg_catalog.char_length(p_secret) < 20 then
    raise exception 'A valid Resend key is required' using errcode = '22023';
  end if;

  select id into v_secret_id from vault.secrets where name = 'apex_resend_api_key';
  if v_secret_id is null then
    perform vault.create_secret(p_secret, 'apex_resend_api_key');
  else
    perform vault.update_secret(v_secret_id, p_secret);
  end if;
end;
$$;

create or replace function public.get_expiry_resend_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'apex_resend_api_key';
  return v_secret;
end;
$$;

revoke all on function public.set_expiry_resend_key(text) from public, anon, authenticated, service_role;
revoke all on function public.get_expiry_resend_key() from public, anon, authenticated, service_role;
grant execute on function public.set_expiry_resend_key(text) to service_role;
grant execute on function public.get_expiry_resend_key() to service_role;
