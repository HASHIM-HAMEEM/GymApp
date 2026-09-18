-- Reconcile a claimed receipt batch in one service-role RPC. Expo receipt
-- lookup was already batched, but the Edge Function previously made one
-- database call per result (up to 1000 calls per cron run).

create or replace function public.apply_push_receipt_updates(p_updates jsonb)
returns table (delivered integer, failed integer, unknown integer, retried integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_action text;
  v_updated integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_updates) <> 'array'
    or pg_catalog.jsonb_array_length(p_updates) > 1000 then
    raise exception 'Receipt updates must be an array of at most 1000 items' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct item->>'receipt_id') from pg_catalog.jsonb_array_elements(p_updates) item) then
    raise exception 'Receipt update IDs must be unique' using errcode = '22023';
  end if;

  delivered := 0;
  failed := 0;
  unknown := 0;
  retried := 0;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_updates)
  loop
    begin
      v_id := (v_item->>'receipt_id')::uuid;
    exception when others then
      raise exception 'Every receipt update needs a valid receipt_id' using errcode = '22023';
    end;
    v_action := v_item->>'action';
    if v_action not in ('delivered', 'failed', 'unknown', 'retry') then
      raise exception 'Invalid receipt update action' using errcode = '22023';
    end if;

    if v_action = 'retry' then
      update public.push_receipts
      set attempts = attempts + 1,
          last_checked_at = pg_catalog.now()
      where id = v_id and status = 'pending';
    else
      update public.push_receipts
      set status = v_action,
          error_code = v_item->>'error_code',
          error_message = v_item->>'error_message',
          last_checked_at = pg_catalog.now(),
          attempts = attempts + 1
      where id = v_id and status = 'pending';
    end if;
    get diagnostics v_updated = row_count;
    if v_updated = 1 then
      if v_action = 'delivered' then delivered := delivered + 1;
      elsif v_action = 'failed' then failed := failed + 1;
      elsif v_action = 'unknown' then unknown := unknown + 1;
      else retried := retried + 1;
      end if;
    end if;
  end loop;

  return next;
end;
$$;

revoke all on function public.apply_push_receipt_updates(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.apply_push_receipt_updates(jsonb) to service_role;
