-- record_push_receipts receives a JSON array from send-notice-push.
-- FOREACH only accepts a PostgreSQL array, so the prior implementation
-- failed at runtime with "FOREACH expression must yield an array".

create or replace function public.record_push_receipts(
  p_notice_id uuid,
  p_receipts jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_item jsonb;
  v_token text;
  v_ticket text;
  v_status text;
  v_error_code text;
  v_error_message text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_receipts) <> 'array' then
    raise exception 'Push receipts must be a JSON array' using errcode = '22023';
  end if;

  for v_item in
    select item.value
    from pg_catalog.jsonb_array_elements(p_receipts) as item(value)
  loop
    v_token := v_item ->> 'expo_push_token';
    v_ticket := v_item ->> 'expo_ticket_id';
    v_status := coalesce(v_item ->> 'status', 'pending');
    v_error_code := v_item ->> 'error_code';
    v_error_message := v_item ->> 'error_message';

    if v_token is null or v_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
      raise exception 'Invalid Expo push token in receipt' using errcode = '22023';
    end if;
    if v_status not in ('pending', 'delivered', 'failed', 'unknown') then
      raise exception 'Invalid push receipt status' using errcode = '22023';
    end if;

    insert into public.push_receipts (
      notice_id,
      expo_push_token,
      expo_ticket_id,
      status,
      error_code,
      error_message
    ) values (
      p_notice_id,
      v_token,
      v_ticket,
      v_status,
      v_error_code,
      v_error_message
    )
    on conflict (notice_id, expo_push_token) do update
    set
      expo_ticket_id = excluded.expo_ticket_id,
      status = excluded.status,
      error_code = excluded.error_code,
      error_message = excluded.error_message,
      last_checked_at = case
        when excluded.status in ('delivered', 'failed') then pg_catalog.now()
        else push_receipts.last_checked_at
      end
    where push_receipts.status not in ('delivered', 'failed')
      or excluded.status in ('delivered', 'failed');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.record_push_receipts(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_push_receipts(uuid, jsonb) to service_role;
