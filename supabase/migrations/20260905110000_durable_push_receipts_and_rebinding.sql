begin;

-- =====================================================================
-- Durable push delivery tracking + account rebinding
-- =====================================================================
-- N2: persist each Expo push attempt + ticket id so delivery can be
--     reconciled asynchronously via getPushNotificationReceipts.
-- N3: register_push_device now rebinds a token to the new active
--     account on the same installation (A → B) instead of refusing.

-- ---------------------------------------------------------------------
-- 1. push_receipts: one row per push attempt (notice × device token)
-- ---------------------------------------------------------------------
create table if not exists public.push_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete restrict,
  expo_push_token text not null,
  expo_ticket_id text,
  status text not null default 'pending'
    constraint push_receipts_status_check check (status in ('pending', 'delivered', 'failed', 'unknown')),
  error_code text,
  error_message text,
  attempts integer not null default 0,
  last_checked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint push_receipts_notice_token_key unique (notice_id, expo_push_token)
);

create index if not exists push_receipts_pending_idx
  on public.push_receipts (created_at)
  where status = 'pending' and expo_ticket_id is not null;
create index if not exists push_receipts_notice_idx
  on public.push_receipts (notice_id);

alter table public.push_receipts enable row level security;

drop trigger if exists push_receipts_set_updated_at on public.push_receipts;
create trigger push_receipts_set_updated_at
before update on public.push_receipts
for each row execute function public.set_updated_at();

-- Status may only advance: pending → delivered/failed/unknown.
-- Once terminal (delivered/failed) it cannot revert to pending.
create or replace function public.push_receipts_guard_status()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'UPDATE' then
    if old.status in ('delivered', 'failed') and new.status = 'pending' then
      raise exception 'Push receipt status cannot revert to pending' using errcode = '23001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists push_receipts_guard_status on public.push_receipts;
create trigger push_receipts_guard_status
before update on public.push_receipts
for each row execute function public.push_receipts_guard_status();

-- ---------------------------------------------------------------------
-- 2. push_receipt_events: append-only audit of every status transition
-- ---------------------------------------------------------------------
create table if not exists public.push_receipt_events (
  id uuid primary key default extensions.gen_random_uuid(),
  receipt_id uuid not null references public.push_receipts(id) on delete restrict,
  status text not null,
  error_code text,
  error_message text,
  occurred_at timestamptz not null default pg_catalog.now()
);

create index if not exists push_receipt_events_receipt_idx
  on public.push_receipt_events (receipt_id, occurred_at desc);

alter table public.push_receipt_events enable row level security;

create or replace function public.push_receipt_events_append()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.push_receipt_events (receipt_id, status, error_code, error_message)
  values (new.id, new.status, new.error_code, new.error_message);
  return new;
end;
$$;

drop trigger if exists push_receipts_log_event on public.push_receipts;
create trigger push_receipts_log_event
after insert or update of status on public.push_receipts
for each row execute function public.push_receipt_events_append();

create or replace function public.push_receipt_events_no_modify()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  raise exception 'push_receipt_events is append-only' using errcode = '23001';
end;
$$;

drop trigger if exists push_receipt_events_no_update on public.push_receipt_events;
create trigger push_receipt_events_no_update
before update on public.push_receipt_events
for each row execute function public.push_receipt_events_no_modify();

drop trigger if exists push_receipt_events_no_delete on public.push_receipt_events;
create trigger push_receipt_events_no_delete
before delete on public.push_receipt_events
for each row execute function public.push_receipt_events_no_modify();

-- ---------------------------------------------------------------------
-- 3. RPCs (service-role only)
-- ---------------------------------------------------------------------

-- Record push receipts after Expo accepts/rejects a send.
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

  foreach v_item in array pg_catalog.jsonb_array_elements(p_receipts)
  loop
    v_token := v_item ->> 'expo_push_token';
    v_ticket := v_item ->> 'expo_ticket_id';
    v_status := coalesce(v_item ->> 'status', 'pending');
    v_error_code := v_item ->> 'error_code';
    v_error_message := v_item ->> 'error_message';

    insert into public.push_receipts (
      notice_id, expo_push_token, expo_ticket_id, status, error_code, error_message
    ) values (
      p_notice_id, v_token, v_ticket, v_status, v_error_code, v_error_message
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

-- Claim a batch of pending receipts for receipt validation.
create or replace function public.claim_pending_push_receipts(
  p_limit integer default 100
)
returns table (
  id uuid,
  expo_ticket_id text,
  expo_push_token text,
  notice_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;

  return query
  select pr.id, pr.expo_ticket_id, pr.expo_push_token, pr.notice_id
  from public.push_receipts as pr
  where pr.status = 'pending'
    and pr.expo_ticket_id is not null
  order by pr.created_at
  limit greatest(1, least(p_limit, 1000));
end;
$$;

-- Update a receipt's status after Expo receipt validation.
create or replace function public.update_push_receipt_status(
  p_receipt_id uuid,
  p_status text,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
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
  if p_status not in ('delivered', 'failed', 'unknown') then
    raise exception 'Invalid receipt status' using errcode = '22023';
  end if;

  update public.push_receipts
  set
    status = p_status,
    error_code = p_error_code,
    error_message = p_error_message,
    last_checked_at = pg_catalog.now(),
    attempts = push_receipts.attempts + 1
  where id = p_receipt_id
    and status = 'pending';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Mark a receipt as still pending (transient retry — not a revert).
create or replace function public.bump_push_receipt_attempt(
  p_receipt_id uuid
)
returns boolean
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

  update public.push_receipts
  set
    attempts = push_receipts.attempts + 1,
    last_checked_at = pg_catalog.now()
  where id = p_receipt_id
    and status = 'pending';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. register_push_device: rebind token to the new active account
-- ---------------------------------------------------------------------
create or replace function public.register_push_device(
  p_expo_push_token text,
  p_platform text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_device_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles as p
    where p.id = v_user_id and p.account_state = 'active'
  ) then
    raise exception 'An active profile is required' using errcode = '42501';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'Unsupported push platform' using errcode = '22023';
  end if;
  if p_expo_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid Expo push token' using errcode = '22023';
  end if;

  insert into public.push_devices (
    profile_id,
    expo_push_token,
    platform,
    last_seen_at,
    disabled_at
  ) values (
    v_user_id,
    p_expo_push_token,
    p_platform,
    pg_catalog.now(),
    null
  )
  on conflict (expo_push_token) do update
  set
    profile_id = v_user_id,
    platform = excluded.platform,
    last_seen_at = pg_catalog.now(),
    disabled_at = null
  returning id into v_device_id;

  return v_device_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------
revoke all on table public.push_receipts from public, anon, authenticated, service_role;
revoke all on table public.push_receipt_events from public, anon, authenticated, service_role;
revoke all on function public.record_push_receipts(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.claim_pending_push_receipts(integer) from public, anon, authenticated, service_role;
revoke all on function public.update_push_receipt_status(uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.bump_push_receipt_attempt(uuid) from public, anon, authenticated, service_role;
revoke all on function public.push_receipts_guard_status() from public, anon, authenticated, service_role;
revoke all on function public.push_receipt_events_append() from public, anon, authenticated, service_role;
revoke all on function public.push_receipt_events_no_modify() from public, anon, authenticated, service_role;

grant execute on function public.record_push_receipts(uuid, jsonb) to service_role;
grant execute on function public.claim_pending_push_receipts(integer) to service_role;
grant execute on function public.update_push_receipt_status(uuid, text, text, text) to service_role;
grant execute on function public.bump_push_receipt_attempt(uuid) to service_role;

commit;
