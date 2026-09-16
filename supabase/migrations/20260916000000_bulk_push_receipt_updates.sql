-- Bulk equivalents of update_push_receipt_status / bump_push_receipt_attempt so
-- process-push-receipts settles a claimed batch in two round trips instead of
-- one per receipt.

create or replace function public.update_push_receipt_statuses(
  p_updates jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_updates) <> 'array' then
    raise exception 'Push receipt updates must be a JSON array' using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_updates) as item(value)
    where coalesce(item.value ->> 'status', '') not in ('delivered', 'failed', 'unknown')
  ) then
    raise exception 'Invalid receipt status' using errcode = '22023';
  end if;

  with input as (
    select *
    from pg_catalog.jsonb_to_recordset(p_updates) as entry(
      id uuid,
      status text,
      error_code text,
      error_message text
    )
  )
  update public.push_receipts as pr
  set
    status = input.status,
    error_code = input.error_code,
    error_message = input.error_message,
    last_checked_at = pg_catalog.now(),
    attempts = pr.attempts + 1
  from input
  where pr.id = input.id
    and pr.status = 'pending';
  get diagnostics v_updated = row_count;

  return v_updated;
end;
$$;

create or replace function public.bump_push_receipt_attempts(
  p_receipt_ids uuid[]
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;

  update public.push_receipts as pr
  set
    attempts = pr.attempts + 1,
    last_checked_at = pg_catalog.now()
  where pr.id = any(coalesce(p_receipt_ids, array[]::uuid[]))
    and pr.status = 'pending';
  get diagnostics v_updated = row_count;

  return v_updated;
end;
$$;

revoke all on function public.update_push_receipt_statuses(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.bump_push_receipt_attempts(uuid[]) from public, anon, authenticated, service_role;

grant execute on function public.update_push_receipt_statuses(jsonb) to service_role;
grant execute on function public.bump_push_receipt_attempts(uuid[]) to service_role;
