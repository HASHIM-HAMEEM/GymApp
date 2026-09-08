-- Apex account lifecycle, Aadhaar validation, UPI payment requests, and expiry reminders.
begin;

create or replace function public.valid_aadhaar(p_value text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_digits text := pg_catalog.regexp_replace(p_value, '[^0-9]', '', 'g');
  v_d integer[][] := array[
    [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]
  ];
  v_p integer[][] := array[
    [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]
  ];
  v_checksum integer := 0;
  v_digit integer;
  v_index integer;
begin
  if v_digits !~ '^[0-9]{12}$' or v_digits = '000000000000' then return false; end if;
  for v_index in 0..11 loop
    v_digit := pg_catalog.substr(v_digits, 12 - v_index, 1)::integer;
    v_checksum := v_d[v_checksum + 1][v_p[(v_index % 8) + 1][v_digit + 1] + 1];
  end loop;
  return v_checksum = 0;
end;
$$;

alter table public.members drop constraint if exists members_aadhaar_required_check;
-- Validate new members and identity changes without blocking the archival of
-- legacy test accounts whose old National ID was never an Aadhaar number.
create or replace function public.enforce_member_aadhaar()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' or new.national_id is distinct from old.national_id then
    new.national_id := pg_catalog.regexp_replace(new.national_id, '[[:space:]]', '', 'g');
    if public.valid_aadhaar(new.national_id) is not true then
      raise exception 'A valid 12-digit Aadhaar number is required' using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger members_enforce_aadhaar before insert or update on public.members
  for each row execute function public.enforce_member_aadhaar();

alter table public.members add column if not exists removed_at timestamptz;
alter table public.members add column if not exists removed_by uuid references public.profiles(id) on delete set null;
alter table public.members add column if not exists removal_reason text;

alter table public.profiles drop constraint if exists profiles_account_state_check;
alter table public.profiles add constraint profiles_account_state_check
  check (account_state in ('active', 'invited', 'suspended', 'removed'));

alter table public.club_config add column if not exists upi_id text;
alter table public.club_config add column if not exists upi_payee_name text;

create table if not exists public.upi_payment_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  reference text not null unique default ('APX-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(extensions.gen_random_uuid()::text, '-', ''), 1, 12))),
  member_id uuid not null references public.members(id) on delete restrict,
  membership_id uuid references public.memberships(id) on delete restrict,
  plan_id uuid references public.plans(id) on delete restrict,
  kind text not null check (kind in ('balance', 'renewal')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created' check (status in ('created', 'submitted', 'confirmed', 'rejected')),
  utr text,
  member_note text,
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  confirmed_membership_id uuid references public.memberships(id) on delete restrict,
  confirmed_payment_id uuid references public.payments(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint upi_payment_request_target_check check (
    (kind = 'balance' and membership_id is not null and plan_id is null)
    or (kind = 'renewal' and plan_id is not null and membership_id is null)
  ),
  constraint upi_payment_request_utr_check check (utr is null or pg_catalog.char_length(pg_catalog.btrim(utr)) between 6 and 64)
);

create index if not exists upi_payment_requests_member_idx on public.upi_payment_requests(member_id, created_at desc);
create index if not exists upi_payment_requests_pending_idx on public.upi_payment_requests(status, created_at) where status in ('created','submitted');
alter table public.upi_payment_requests enable row level security;
drop policy if exists upi_payment_requests_member_read on public.upi_payment_requests;
create policy upi_payment_requests_member_read on public.upi_payment_requests for select to authenticated
using (member_id = public.current_member_id());
drop policy if exists upi_payment_requests_admin_read on public.upi_payment_requests;
create policy upi_payment_requests_admin_read on public.upi_payment_requests for select to authenticated
using (public.current_user_is_admin());

create table if not exists public.expiry_reminders (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  target_expiry date not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique(membership_id, target_expiry)
);
alter table public.expiry_reminders enable row level security;

create or replace function public.get_upi_config()
returns table (upi_id text, payee_name text, club_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.current_user_is_admin() and public.current_member_id() is null then
    raise exception 'Active account required' using errcode='42501';
  end if;
  return query select c.upi_id, c.upi_payee_name, c.name from public.club_config c where c.id=1;
end;
$$;

create or replace function public.update_upi_config(p_upi_id text, p_payee_name text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.current_user_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_upi_id,''))) not between 5 and 255
    or pg_catalog.btrim(coalesce(p_upi_id,'')) !~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$' then
    raise exception 'Enter a valid UPI ID' using errcode='22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_payee_name,''))) not between 2 and 120 then
    raise exception 'Payee name is required' using errcode='22023';
  end if;
  update public.club_config set upi_id=pg_catalog.lower(pg_catalog.btrim(p_upi_id)), upi_payee_name=pg_catalog.btrim(p_payee_name), updated_at=pg_catalog.now() where id=1;
end;
$$;

create or replace function public.create_upi_payment_request(p_membership_id uuid default null, p_plan_id uuid default null)
returns public.upi_payment_requests language plpgsql volatile security definer set search_path = '' as $$
declare
  v_member_id uuid := public.current_member_id();
  v_membership public.memberships%rowtype;
  v_plan public.plans%rowtype;
  v_result public.upi_payment_requests%rowtype;
begin
  if v_member_id is null then raise exception 'Active member required' using errcode='42501'; end if;
  if (p_membership_id is null) = (p_plan_id is null) then raise exception 'Choose a balance or renewal' using errcode='22023'; end if;
  if not exists(select 1 from public.club_config where id=1 and upi_id is not null) then raise exception 'UPI payments are not configured' using errcode='22023'; end if;
  if p_membership_id is not null then
    select * into v_membership from public.memberships where id=p_membership_id and member_id=v_member_id for update;
    if not found or v_membership.amount_due <= 0 then raise exception 'No payable balance found' using errcode='22023'; end if;
    insert into public.upi_payment_requests(member_id,membership_id,kind,amount,currency)
      values(v_member_id,v_membership.id,'balance',v_membership.amount_due,v_membership.currency_snapshot) returning * into v_result;
  else
    select * into v_plan from public.plans where id=p_plan_id and is_active;
    if not found or v_plan.price <= 0 then raise exception 'Plan is not available for UPI payment' using errcode='22023'; end if;
    insert into public.upi_payment_requests(member_id,plan_id,kind,amount,currency)
      values(v_member_id,v_plan.id,'renewal',v_plan.price,v_plan.currency) returning * into v_result;
  end if;
  return v_result;
end;
$$;

create or replace function public.submit_upi_payment(p_request_id uuid, p_utr text, p_note text default null)
returns public.upi_payment_requests language plpgsql volatile security definer set search_path = '' as $$
declare v_result public.upi_payment_requests%rowtype;
begin
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_utr,''))) not between 6 and 64 or p_utr !~ '^[A-Za-z0-9-]+$' then
    raise exception 'Enter a valid UPI transaction reference' using errcode='22023';
  end if;
  update public.upi_payment_requests set status='submitted',utr=pg_catalog.btrim(p_utr),member_note=nullif(pg_catalog.btrim(p_note),''),updated_at=pg_catalog.now()
    where id=p_request_id and member_id=public.current_member_id() and status in ('created','rejected') returning * into v_result;
  if v_result.id is null then raise exception 'Payment request not found' using errcode='P0002'; end if;
  return v_result;
end;
$$;

create or replace function public.review_upi_payment_request(p_request_id uuid, p_approve boolean, p_note text default null)
returns public.upi_payment_requests language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_request public.upi_payment_requests%rowtype;
  v_result record;
  v_confirmed_membership_id uuid;
  v_confirmed_payment_id uuid;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  select * into v_request from public.upi_payment_requests where id=p_request_id for update;
  if not found then raise exception 'Payment request not found' using errcode='P0002'; end if;
  if v_request.status in ('confirmed','rejected') then return v_request; end if;
  if v_request.status <> 'submitted' or v_request.utr is null then raise exception 'Payment has not been submitted' using errcode='22023'; end if;
  if p_approve is null then raise exception 'Choose confirm or reject' using errcode='22023'; end if;
  if not exists(select 1 from public.members where id=v_request.member_id and removed_at is null) then
    raise exception 'Member has been removed' using errcode='22023';
  end if;
  if not p_approve then
    update public.upi_payment_requests set status='rejected',review_note=nullif(pg_catalog.btrim(p_note),''),reviewed_by=v_actor,reviewed_at=pg_catalog.now(),updated_at=pg_catalog.now()
      where id=v_request.id returning * into v_request;
    return v_request;
  end if;
  if v_request.kind='balance' then
    select * into v_result from public.settle_membership_balance(v_request.membership_id,v_request.amount,'upi',v_request.id::text);
    v_confirmed_membership_id := v_request.membership_id;
    v_confirmed_payment_id := v_result.payment_id;
  else
    select * into v_result from public.renew_membership(v_request.member_id,v_request.plan_id,null,v_request.amount,'upi',v_request.id::text,v_request.amount,'UPI request price snapshot');
    v_confirmed_membership_id := v_result.membership_id;
    v_confirmed_payment_id := v_result.payment_id;
  end if;
  update public.upi_payment_requests set status='confirmed',review_note=nullif(pg_catalog.btrim(p_note),''),reviewed_by=v_actor,reviewed_at=pg_catalog.now(),
    confirmed_membership_id=v_confirmed_membership_id,confirmed_payment_id=v_confirmed_payment_id,updated_at=pg_catalog.now()
    where id=v_request.id returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.remove_member(p_member_id uuid, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_auth_user uuid;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  update public.members set removed_at=pg_catalog.now(),removed_by=v_actor,removal_reason=nullif(pg_catalog.btrim(p_reason),''),updated_at=pg_catalog.now()
    where id=p_member_id and removed_at is null returning auth_user_id into v_auth_user;
  if not found then raise exception 'Member not found' using errcode='P0002'; end if;
  update public.memberships set state='cancelled',updated_at=pg_catalog.now() where member_id=p_member_id and state in ('active','paused');
  update public.member_invitations set status='cancelled',updated_at=pg_catalog.now() where member_id=p_member_id and status not in ('accepted','cancelled');
  update public.qr_passes set revoked_at=coalesce(revoked_at,pg_catalog.now()) where member_id=p_member_id and revoked_at is null;
  if v_auth_user is not null then
    update public.profiles set account_state='removed',updated_at=pg_catalog.now() where id=v_auth_user;
    update public.push_devices set disabled_at=coalesce(disabled_at,pg_catalog.now()),updated_at=pg_catalog.now() where profile_id=v_auth_user and disabled_at is null;
  end if;
  insert into public.activity_log(member_id,actor_profile_id,kind,description,metadata)
    values(p_member_id,v_actor,'member_removed','Member access removed',pg_catalog.jsonb_build_object('reason',nullif(pg_catalog.btrim(p_reason),'')));
end;
$$;

alter table public.activity_log drop constraint if exists activity_log_kind_check;
alter table public.activity_log add constraint activity_log_kind_check check (kind in (
  'member_created','invitation_sent','invitation_failed','onboarding_completed','membership_started','membership_renewed',
  'membership_state_changed','check_in','notice_published','profile_updated','balance_settled','balance_waived','member_removed'
));

create or replace function public.claim_expiry_reminders()
returns table(reminder_id uuid,membership_id uuid,email text,member_name text,expiry_date date,club_name text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.expiry_reminders r set status='failed',updated_at=pg_catalog.now()
    where r.status='processing' and r.claimed_at < pg_catalog.now()-interval '15 minutes';
  insert into public.expiry_reminders(membership_id,target_expiry)
  select ms.id, public.effective_membership_end(ms.end_date,ms.frozen_days,ms.state,ms.pause_started_on,ms.pause_until,public.club_today())
  from public.memberships ms join public.members m on m.id=ms.member_id join public.profiles p on p.id=m.auth_user_id
  where ms.state in ('active','paused') and m.removed_at is null and p.account_state='active'
    and public.effective_membership_end(ms.end_date,ms.frozen_days,ms.state,ms.pause_started_on,ms.pause_until,public.club_today()) = public.club_today()+5
    and not exists (
      select 1 from public.memberships next_ms
      where next_ms.member_id=ms.member_id and next_ms.state in ('active','paused') and next_ms.start_date > ms.start_date
    )
  on conflict on constraint expiry_reminders_membership_id_target_expiry_key do nothing;
  return query
  with claimed as (
    update public.expiry_reminders r set status='processing',attempts=attempts+1,claimed_at=pg_catalog.now(),updated_at=pg_catalog.now()
    where r.id in (
      select pending.id from public.expiry_reminders pending
      join public.memberships ms on ms.id=pending.membership_id
      join public.members m on m.id=ms.member_id
      join public.profiles p on p.id=m.auth_user_id
      where pending.status in ('pending','failed') and pending.attempts<5 and m.removed_at is null and p.account_state='active'
        and ms.state in ('active','paused') and pending.target_expiry = public.club_today()+5
        and not exists (select 1 from public.memberships next_ms where next_ms.member_id=ms.member_id and next_ms.state in ('active','paused') and next_ms.start_date > ms.start_date)
      order by pending.created_at for update of pending skip locked limit 100
    )
    returning r.*
  )
  select c.id,c.membership_id,m.email::text,(m.first_name||' '||m.last_name),c.target_expiry,cc.name
  from claimed c join public.memberships ms on ms.id=c.membership_id join public.members m on m.id=ms.member_id cross join public.club_config cc
  where m.removed_at is null and ms.state in ('active','paused');
end;
$$;

create or replace function public.record_expiry_reminder(p_reminder_id uuid,p_sent boolean,p_error text default null)
returns void language sql volatile security definer set search_path = '' as $$
  update public.expiry_reminders set status=case when p_sent then 'sent' else 'failed' end,sent_at=case when p_sent then pg_catalog.now() else null end,
    last_error=case when p_sent then null else pg_catalog.left(p_error,1000) end,updated_at=pg_catalog.now() where id=p_reminder_id and status='processing';
$$;

revoke all on table public.upi_payment_requests, public.expiry_reminders from public,anon,authenticated;
grant select on table public.upi_payment_requests to authenticated;
revoke all on function public.valid_aadhaar(text),public.get_upi_config(),public.update_upi_config(text,text),public.create_upi_payment_request(uuid,uuid),public.submit_upi_payment(uuid,text,text),public.review_upi_payment_request(uuid,boolean,text),public.remove_member(uuid,text),public.claim_expiry_reminders(),public.record_expiry_reminder(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.valid_aadhaar(text),public.get_upi_config(),public.update_upi_config(text,text),public.create_upi_payment_request(uuid,uuid),public.submit_upi_payment(uuid,text,text),public.review_upi_payment_request(uuid,boolean,text),public.remove_member(uuid,text) to authenticated;
grant execute on function public.claim_expiry_reminders(),public.record_expiry_reminder(uuid,boolean,text) to service_role;

create or replace function public.search_members(
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_status text default null
)
returns table (
  member_id uuid,
  member_number text,
  first_name text,
  last_name text,
  email text,
  phone text,
  account_state text,
  membership_status text,
  membership_plan_name text,
  membership_end_date date,
  last_check_in timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_query, '')));
  v_limit integer := least(100, greatest(1, coalesce(p_limit, 25)));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_today date := public.club_today();
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('active', 'expiring', 'expired', 'paused', 'due', 'none') then
    raise exception 'Invalid membership status filter' using errcode = '22023';
  end if;

  return query
  select
    m.id,
    m.member_number,
    m.first_name,
    m.last_name,
    m.email::text,
    m.phone,
    coalesce(p.account_state, 'invited'),
    coalesce(current_membership.status, 'none'),
    current_membership.plan_name,
    current_membership.end_date,
    last_visit.checked_in_at
  from public.members as m
  left join public.profiles as p on p.id = m.auth_user_id
  left join lateral (
    select
      ms.end_date,
      ms.plan_name_snapshot as plan_name,
      public.membership_status(
        ms.state,
        ms.start_date,
        public.effective_membership_end(ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until, v_today),
        ms.amount_due,
        ms.pause_until,
        v_today
      ) as status
    from public.memberships as ms
    where ms.member_id = m.id
    order by
      case
        when ms.state = 'cancelled' then 3
        when ms.state in ('active', 'paused')
          and ms.start_date <= v_today
          and public.effective_membership_end(ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until, v_today) >= v_today
          then 0
        when ms.state in ('active', 'paused') and ms.start_date > v_today then 1
        else 2
      end,
      case when ms.state in ('active', 'paused') and ms.start_date > v_today then ms.start_date end asc,
      ms.end_date desc,
      ms.created_at desc
    limit 1
  ) as current_membership on true
  left join lateral (
    select ci.checked_in_at
    from public.check_ins as ci
    where ci.member_id = m.id and ci.admitted
    order by ci.checked_in_at desc
    limit 1
  ) as last_visit on true
  where m.removed_at is null and (
      v_query = ''
      or pg_catalog.lower(m.first_name || ' ' || m.last_name || ' ' || m.member_number || ' ' || m.email::text) like '%' || v_query || '%'
    )
    and (p_status is null or coalesce(current_membership.status, 'none') = p_status)
  order by m.last_name, m.first_name, m.member_number
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_dashboard(p_as_of date default public.club_today())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_currency text;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  select c.currency into v_currency from public.club_config as c where c.id = 1;

  with member_statuses as (
    select
      m.id,
      m.member_number,
      m.first_name,
      m.last_name,
      current_membership.status,
      current_membership.plan_name,
      current_membership.end_date
    from public.members as m
    left join lateral (
      select
        ms.end_date,
        ms.plan_name_snapshot as plan_name,
        public.membership_status(
          ms.state,
          ms.start_date,
          public.effective_membership_end(ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until, p_as_of),
          ms.amount_due,
          ms.pause_until,
          p_as_of
        ) as status
      from public.memberships as ms
      where ms.member_id = m.id
      order by
        case
          when ms.state = 'cancelled' then 3
          when ms.state in ('active', 'paused')
            and ms.start_date <= p_as_of
            and public.effective_membership_end(ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until, p_as_of) >= p_as_of
            then 0
          when ms.state in ('active', 'paused') and ms.start_date > p_as_of then 1
          else 2
        end,
        case when ms.state in ('active', 'paused') and ms.start_date > p_as_of then ms.start_date end asc,
        ms.end_date desc,
        ms.created_at desc
      limit 1
    ) as current_membership on true
    where m.removed_at is null
  )
  select pg_catalog.jsonb_build_object(
    'as_of', p_as_of,
    'total_members', (select pg_catalog.count(*) from public.members where removed_at is null),
    'active_members', (select pg_catalog.count(*) from member_statuses where status in ('active', 'expiring')),
    'expiring_soon', (select pg_catalog.count(*) from member_statuses where status = 'expiring'),
    'amount_due_members', (select pg_catalog.count(*) from member_statuses where status = 'due'),
    'expired_members', (select pg_catalog.count(*) from member_statuses where status = 'expired'),
    'check_ins_today', (
      select pg_catalog.count(*)
      from public.check_ins as ci
      where ci.admitted and ci.checked_in_at >= p_as_of::timestamptz and ci.checked_in_at < (p_as_of + 1)::timestamptz
    ),
    'pending_invitations', (
      select pg_catalog.count(*) from public.member_invitations as i where i.status in ('pending', 'failed')
    ),
    'payments_this_month', (
      select coalesce(pg_catalog.sum(pay.amount), 0)
      from public.payments as pay
      where pay.currency = v_currency
        and pay.paid_at >= pg_catalog.date_trunc('month', p_as_of::timestamptz)
        and pay.paid_at < pg_catalog.date_trunc('month', p_as_of::timestamptz) + interval '1 month'
    ),
    'payments_this_month_egp', (
      select coalesce(pg_catalog.sum(pay.amount), 0)
      from public.payments as pay
      where pay.currency = v_currency
        and pay.paid_at >= pg_catalog.date_trunc('month', p_as_of::timestamptz)
        and pay.paid_at < pg_catalog.date_trunc('month', p_as_of::timestamptz) + interval '1 month'
    ),
    'currency', v_currency,
    'expiring_list', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'member_id', ms.id,
          'member_number', ms.member_number,
          'first_name', ms.first_name,
          'last_name', ms.last_name,
          'plan_name', ms.plan_name,
          'end_date', ms.end_date
        ) order by ms.end_date nulls last, ms.last_name
      )
      from (
        select * from member_statuses where status = 'expiring' limit 12
      ) as ms
    ), '[]'::jsonb),
    'recent_check_ins', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'member_number', ci_row.member_number,
          'first_name', ci_row.first_name,
          'last_name', ci_row.last_name,
          'checked_in_at', ci_row.checked_in_at,
          'reception', ci_row.reception,
          'source', ci_row.source
        ) order by ci_row.checked_in_at desc
      )
      from (
        select
          m.member_number,
          m.first_name,
          m.last_name,
          ci.checked_in_at,
          ci.reception,
          ci.source
        from public.check_ins as ci
        inner join public.members as m on m.id = ci.member_id
        where ci.admitted and ci.checked_in_at >= p_as_of::timestamptz and ci.checked_in_at < (p_as_of + 1)::timestamptz
        order by ci.checked_in_at desc
        limit 8
      ) as ci_row
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

commit;
