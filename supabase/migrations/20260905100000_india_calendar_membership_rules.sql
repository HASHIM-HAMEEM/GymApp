begin;

-- =====================================================================
-- India business rules, calendar terms, freeze preservation, payments
-- =====================================================================
-- Owner-confirmed rules:
--   * Club context: India / INR / Asia/Kolkata / +91 / desk payments.
--   * Terms are calendar months with inclusive end dates. Ordinary
--     anniversaries end the previous day; when the anniversary day does
--     not exist, the term covers the target month's last day.
--   * First term starts on the club-local purchase date.
--   * Freezes preserve paid days: paused days are credited back and the
--     effective end (plus queued terms) shift accordingly.
--   * Balances can be settled later; waivers are audited; history stays
--     append-only.
-- Existing rows are E2E fixtures; plans are re-priced in INR.

-- ---------------------------------------------------------------------
-- 1. Club configuration: India context
-- ---------------------------------------------------------------------
alter table public.club_config
  drop constraint if exists club_config_currency_check;

alter table public.club_config
  add constraint club_config_currency_code_check check (currency ~ '^[A-Z]{3}$');

alter table public.club_config
  add column country_code text not null default 'IN'
    constraint club_config_country_check check (country_code ~ '^[A-Z]{2}$');

alter table public.club_config
  add column default_phone_prefix text not null default '+91'
    constraint club_config_phone_prefix_check check (default_phone_prefix ~ '^\+[0-9]{1,3}$');

alter table public.club_config
  add column supported_payment_methods text[] not null default '{cash,card,upi,wallet}'
    constraint club_config_payment_methods_check
    check (supported_payment_methods <@ '{cash,card,upi,wallet}');

update public.club_config
set currency = 'INR', timezone = 'Asia/Kolkata'
where id = 1;

-- ---------------------------------------------------------------------
-- 2. Currency-neutral money columns
-- ---------------------------------------------------------------------
-- Old deployed clients keep reading plans.price_egp through a generated
-- compatibility column; new clients read price + currency. RPC JSON
-- responses keep legacy keys alongside the new ones during rollout.
alter table public.plans rename column price_egp to price;

alter table public.plans
  add column currency text not null default 'INR'
    constraint plans_currency_check check (currency ~ '^[A-Z]{3}$');

alter table public.plans
  add column price_egp numeric(12, 2) generated always as (price) stored;

alter table public.memberships rename column price_egp_snapshot to price_snapshot;

alter table public.memberships
  add column currency_snapshot text not null default 'INR'
    constraint memberships_currency_snapshot_check check (currency_snapshot ~ '^[A-Z]{3}$');

alter table public.memberships
  add column frozen_days integer not null default 0
    constraint memberships_frozen_days_check check (frozen_days >= 0);

alter table public.memberships
  add column pause_started_on date;

alter table public.payments rename column amount_egp to amount;

alter table public.payments
  add column currency text not null default 'INR'
    constraint payments_currency_check check (currency ~ '^[A-Z]{3}$');

-- Historical fixture rows keep 'instapay'; new transactions use UPI.
alter table public.payments drop constraint payments_method_check;
alter table public.payments
  add constraint payments_method_check
  check (method in ('instapay', 'cash', 'card', 'wallet', 'upi', 'complimentary'));

alter table public.payments drop constraint payments_kind_check;
alter table public.payments
  add constraint payments_kind_check
  check (kind in ('initial', 'renewal', 'settlement', 'waiver', 'adjustment'));

alter table public.activity_log drop constraint if exists activity_log_kind_check;
alter table public.activity_log
  add constraint activity_log_kind_check check (
    kind in (
      'member_created', 'invitation_sent', 'invitation_failed', 'onboarding_completed',
      'membership_started', 'membership_renewed', 'membership_state_changed',
      'check_in', 'notice_published', 'profile_updated',
      'balance_settled', 'balance_waived'
    )
  );

-- ---------------------------------------------------------------------
-- 3. Freeze audit + idempotency tables (RPC-only; no direct client access)
-- ---------------------------------------------------------------------
create table if not exists public.membership_freezes (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  started_on date not null,
  resume_on date not null constraint membership_freezes_resume_check check (resume_on > started_on),
  resumed_on date,
  days_credited integer constraint membership_freezes_credit_check check (days_credited >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists membership_freezes_membership_idx
  on public.membership_freezes (membership_id);

alter table public.membership_freezes enable row level security;
revoke all on public.membership_freezes from public, anon, authenticated;

create table if not exists public.membership_operations (
  request_id text primary key
    constraint membership_operations_request_check
    check (request_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  member_id uuid not null references public.members(id) on delete restrict,
  kind text not null
    constraint membership_operations_kind_check
    check (kind in ('renewal', 'settlement', 'waiver')),
  request_payload jsonb not null,
  result jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists membership_operations_member_idx
  on public.membership_operations (member_id, kind);

alter table public.membership_operations enable row level security;
revoke all on public.membership_operations from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Clock and calendar helpers
-- ---------------------------------------------------------------------
create or replace function public.club_today(p_at timestamptz default pg_catalog.now())
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.timezone(
    coalesce((select c.timezone from public.club_config as c where c.id = 1), 'Asia/Kolkata'),
    p_at
  )::date;
$$;

-- Calendar-month-inclusive term end. Ordinary anniversaries end the
-- previous day (Sep 5 + 1 month -> Oct 4). When the anniversary day does
-- not exist, the term covers the target month's last day
-- (Jan 31 + 1 month -> Feb 28; Feb 29 2028 + 12 months -> Feb 28 2029).
create or replace function public.term_end_date(p_start date, p_months integer)
returns date
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_months < 1 or p_months > 240 then null
    when extract(day from p_start) = extract(day from (p_start + pg_catalog.make_interval(months => p_months))::date)
      then ((p_start + pg_catalog.make_interval(months => p_months))::date - 1)
    else ((pg_catalog.date_trunc('month', (p_start + pg_catalog.make_interval(months => p_months))::date)
      + pg_catalog.make_interval(months => 1))::date - 1)
  end;
$$;

-- Effective end with pending pause credit. Past pauses are already
-- physically credited into end_date when they close (frozen_days is the
-- audit counter, never added again). Auto-expired pauses whose credit has
-- not been persisted yet are credited on read so status/admission stay
-- correct until the next mutation persists them.
create or replace function public.effective_membership_end(
  p_end_date date,
  p_frozen_days integer,
  p_state text,
  p_pause_started_on date,
  p_pause_until date,
  p_as_of date
)
returns date
language sql
immutable
as $$
  select p_end_date
    + case
        when p_state = 'paused'
          and p_pause_until is not null
          and p_as_of >= p_pause_until
          then greatest(0, (p_pause_until - coalesce(p_pause_started_on, p_pause_until)))
        else 0
      end;
$$;

-- Worst-case (planned) end used when queuing a renewal behind a term
-- whose pause may still run to its scheduled resume day.
create or replace function public.planned_membership_end(
  p_end_date date,
  p_frozen_days integer,
  p_state text,
  p_pause_started_on date,
  p_pause_until date
)
returns date
language sql
immutable
as $$
  select p_end_date
    + case
        when p_state = 'paused' and p_pause_until is not null
          then greatest(0, (p_pause_until - coalesce(p_pause_started_on, p_pause_until)))
        else 0
      end;
$$;

-- Re-anchor queued future terms after a paused term is credited days.
-- The first queued term restarts the day after the new end; the whole
-- chain shifts by the same delta. This stays correct whether the queued
-- term was bought before the pause (scheduled after the physical end)
-- or during the pause (scheduled after the planned end), and whether the
-- pause is closed early (delta can be negative) or runs to schedule.
create or replace function public.shift_subsequent_terms(
  p_membership_id uuid,
  p_old_end date,
  p_new_end date
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  with queued as (
    select ms.id, ms.start_date
    from public.memberships as ms
    where ms.member_id = (select m.member_id from public.memberships as m where m.id = p_membership_id)
      and ms.id <> p_membership_id
      and ms.state <> 'cancelled'
      and ms.start_date > p_old_end
  ), anchor as (
    select (p_new_end + 1) - min(start_date) as delta from queued
  )
  update public.memberships as ms
  set start_date = ms.start_date + anchor.delta,
      end_date = ms.end_date + anchor.delta
  from queued, anchor
  where ms.id = queued.id and anchor.delta <> 0;
$$;

-- ---------------------------------------------------------------------
-- 5. Current membership selection (single source of truth)
-- ---------------------------------------------------------------------
create or replace function public.current_membership(p_member_id uuid, p_as_of date)
returns table (
  membership_id uuid,
  state text,
  start_date date,
  end_date date,
  physical_end_date date,
  amount_due numeric,
  grace_until date,
  pause_until date,
  frozen_days integer,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select
    ms.id, ms.state, ms.start_date, ms.end_date, ms.amount_due,
    ms.grace_until, ms.pause_until, ms.frozen_days, ms.pause_started_on
  into r
  from public.memberships as ms
  where ms.member_id = p_member_id
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
  limit 1;

  if r.id is null then
    membership_id := null;
    state := null;
    start_date := null;
    end_date := null;
    physical_end_date := null;
    amount_due := null;
    grace_until := null;
    pause_until := null;
    frozen_days := null;
    status := 'none';
    return next;
    return;
  end if;

  membership_id := r.id;
  state := r.state;
  start_date := r.start_date;
  physical_end_date := r.end_date;
  end_date := public.effective_membership_end(r.end_date, r.frozen_days, r.state, r.pause_started_on, r.pause_until, p_as_of);
  amount_due := r.amount_due;
  grace_until := r.grace_until;
  pause_until := r.pause_until;
  frozen_days := r.frozen_days;
  status := public.membership_status(r.state, r.start_date, end_date, r.amount_due, r.pause_until, p_as_of);
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Status: resume-day pause semantics + club-clock default
-- ---------------------------------------------------------------------
create or replace function public.membership_status(
  p_state text,
  p_start_date date,
  p_end_date date,
  p_amount_due numeric,
  p_pause_until date default null,
  p_as_of date default public.club_today()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_state = 'cancelled' then 'cancelled'
    when p_start_date > p_as_of then 'upcoming'
    when p_end_date < p_as_of then 'expired'
    when p_state = 'paused' and (p_pause_until is null or p_pause_until > p_as_of) then 'paused'
    when p_amount_due > 0 then 'due'
    when p_end_date <= p_as_of + 7 then 'expiring'
    else 'active'
  end;
$$;

-- ---------------------------------------------------------------------
-- 7. Admission: total boolean, no NULL verdicts
-- ---------------------------------------------------------------------
create or replace function public.member_admission(
  p_member_id uuid,
  p_at timestamptz default pg_catalog.now()
)
returns table (membership_id uuid, verdict text, admitted boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account_state text;
  v_today date;
  v_row record;
begin
  select p.account_state
  into v_account_state
  from public.members as m
  left join public.profiles as p on p.id = m.auth_user_id
  where m.id = p_member_id;

  if v_account_state is null or v_account_state = 'invited' then
    membership_id := null;
    verdict := 'invited';
    admitted := false;
    return next;
    return;
  end if;

  if v_account_state = 'suspended' then
    membership_id := null;
    verdict := 'suspended';
    admitted := false;
    return next;
    return;
  end if;

  v_today := public.club_today(p_at);
  select * into v_row from public.current_membership(p_member_id, v_today);

  membership_id := v_row.membership_id;
  verdict := coalesce(v_row.status, 'none');
  admitted := (verdict in ('active', 'expiring'))
    or (verdict = 'due' and v_row.grace_until is not null and v_row.grace_until >= v_today);
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Member creation: server-controlled dates, INR snapshots
-- ---------------------------------------------------------------------
create or replace function public.create_member_invitation(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text default null,
  p_date_of_birth date default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_national_id text default null,
  p_address text default null,
  p_plan_id uuid default null,
  p_membership_start_date date default null,
  p_amount_paid numeric default null,
  p_payment_method text default null
)
returns table (
  invitation_id uuid,
  member_id uuid,
  member_number text,
  membership_id uuid,
  payment_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email extensions.citext;
  v_plan public.plans%rowtype;
  v_today date := public.club_today();
  v_start_date date;
  v_end_date date;
  v_amount_due numeric(12, 2);
  v_member_id uuid;
  v_member_number text;
  v_membership_id uuid;
  v_payment_id uuid;
  v_invitation_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_first_name, ''))) not between 1 and 80
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_last_name, ''))) not between 1 and 80 then
    raise exception 'First and last name are required' using errcode = '22023';
  end if;

  v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')))::extensions.citext;
  if v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  if p_date_of_birth is not null and p_date_of_birth > v_today then
    raise exception 'Date of birth cannot be in the future' using errcode = '22023';
  end if;

  if p_membership_start_date is not null then
    raise exception 'Membership start dates are server-controlled' using errcode = '22023';
  end if;

  if p_plan_id is null and (p_amount_paid is not null or p_payment_method is not null) then
    raise exception 'A plan is required for membership or payment details' using errcode = '22023';
  end if;

  insert into public.members (
    first_name,
    last_name,
    email,
    phone,
    date_of_birth,
    emergency_contact_name,
    emergency_contact_phone,
    national_id,
    address,
    created_by
  )
  values (
    pg_catalog.btrim(p_first_name),
    pg_catalog.btrim(p_last_name),
    v_email,
    nullif(pg_catalog.btrim(p_phone), ''),
    p_date_of_birth,
    nullif(pg_catalog.btrim(p_emergency_contact_name), ''),
    nullif(pg_catalog.btrim(p_emergency_contact_phone), ''),
    nullif(pg_catalog.btrim(p_national_id), ''),
    nullif(pg_catalog.btrim(p_address), ''),
    v_actor
  )
  returning id, public.members.member_number into v_member_id, v_member_number;

  if p_plan_id is not null then
    select * into v_plan
    from public.plans as p
    where p.id = p_plan_id and p.is_active
    for share;

    if not found then
      raise exception 'The selected plan is not active' using errcode = '22023';
    end if;

    v_start_date := v_today;
    v_end_date := public.term_end_date(v_start_date, v_plan.duration_months);
    if v_end_date is null then
      raise exception 'The selected plan duration is invalid' using errcode = '22023';
    end if;

    if p_payment_method = 'complimentary' then
      if coalesce(p_amount_paid, 0) <> 0 then
        raise exception 'Complimentary payments must have a zero amount' using errcode = '22023';
      end if;
      v_amount_due := 0;
    elsif p_amount_paid is not null then
      if p_payment_method is null or p_payment_method not in ('cash', 'card', 'upi', 'wallet') then
        raise exception 'A valid payment method is required' using errcode = '22023';
      end if;
      if p_amount_paid <= 0 or p_amount_paid > v_plan.price then
        raise exception 'Payment amount must be greater than zero and no more than the plan price' using errcode = '22023';
      end if;
      v_amount_due := v_plan.price - p_amount_paid;
    else
      if p_payment_method is not null then
        raise exception 'A payment amount is required when a payment method is provided' using errcode = '22023';
      end if;
      v_amount_due := v_plan.price;
    end if;

    insert into public.memberships (
      member_id,
      plan_id,
      state,
      start_date,
      end_date,
      amount_due,
      plan_name_snapshot,
      duration_months_snapshot,
      price_snapshot,
      currency_snapshot,
      created_by
    )
    values (
      v_member_id,
      v_plan.id,
      'active',
      v_start_date,
      v_end_date,
      v_amount_due,
      v_plan.name,
      v_plan.duration_months,
      v_plan.price,
      v_plan.currency,
      v_actor
    )
    returning id into v_membership_id;

    if p_amount_paid is not null or p_payment_method = 'complimentary' then
      insert into public.payments (membership_id, amount, currency, method, kind, recorded_by)
      values (
        v_membership_id,
        case when p_payment_method = 'complimentary' then 0 else p_amount_paid end,
        v_plan.currency,
        p_payment_method,
        'initial',
        v_actor
      )
      returning id into v_payment_id;
    end if;
  end if;

  insert into public.member_invitations (member_id, email, invited_by)
  values (v_member_id, v_email, v_actor)
  returning id into v_invitation_id;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (
    v_member_id,
    v_actor,
    'member_created',
    'Member created and queued for an email invitation',
    pg_catalog.jsonb_build_object('invitation_id', v_invitation_id, 'membership_id', v_membership_id)
  );

  invitation_id := v_invitation_id;
  member_id := v_member_id;
  member_number := v_member_number;
  membership_id := v_membership_id;
  payment_id := v_payment_id;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Renewal: server dates, idempotency, planned-end queueing
-- ---------------------------------------------------------------------
drop function if exists public.renew_membership(uuid, uuid, date, numeric, text);

create function public.renew_membership(
  p_member_id uuid,
  p_plan_id uuid,
  p_start_date date default null,
  p_amount_paid numeric default null,
  p_payment_method text default null,
  p_request_id text default null
)
returns table (
  membership_id uuid,
  payment_id uuid,
  receipt_number text,
  start_date date,
  end_date date,
  amount_due numeric,
  status text,
  as_of date
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_plan public.plans%rowtype;
  v_previous public.memberships%rowtype;
  v_today date := public.club_today();
  v_planned_end date;
  v_start_date date;
  v_end_date date;
  v_amount_due numeric(12, 2);
  v_membership_id uuid;
  v_payment_id uuid;
  v_receipt_number text;
  v_request_id text;
  v_payload jsonb;
  v_op record;
  v_result jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_start_date is not null then
    raise exception 'Renewal start dates are server-controlled' using errcode = '22023';
  end if;

  if p_request_id is not null then
    v_request_id := pg_catalog.lower(p_request_id);
    v_payload := pg_catalog.jsonb_build_object(
      'member_id', p_member_id,
      'plan_id', p_plan_id,
      'amount_paid', p_amount_paid,
      'payment_method', p_payment_method
    );

    select mo.member_id, mo.request_payload, mo.result
    into v_op
    from public.membership_operations as mo
    where mo.request_id = v_request_id and mo.kind = 'renewal';

    if found then
      if v_op.member_id <> p_member_id or v_op.request_payload is distinct from v_payload then
        raise exception 'This request ID was already used with different details' using errcode = '23505';
      end if;
      if pg_catalog.jsonb_typeof(v_op.result) = 'object' and v_op.result ? 'membership_id' then
        membership_id := (v_op.result->>'membership_id')::uuid;
        payment_id := nullif(v_op.result->>'payment_id', '')::uuid;
        receipt_number := nullif(v_op.result->>'receipt_number', '');
        start_date := (v_op.result->>'start_date')::date;
        end_date := (v_op.result->>'end_date')::date;
        amount_due := (v_op.result->>'amount_due')::numeric;
        status := v_op.result->>'status';
        as_of := (v_op.result->>'as_of')::date;
        return next;
        return;
      end if;
      raise exception 'This request is already being processed' using errcode = '40001';
    end if;
  end if;

  perform 1 from public.members as m where m.id = p_member_id for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  select * into v_plan from public.plans as p where p.id = p_plan_id and p.is_active for share;
  if not found then
    raise exception 'The selected plan is not active' using errcode = '22023';
  end if;

  select * into v_previous
  from public.memberships as ms
  where ms.member_id = p_member_id and ms.state in ('active', 'paused')
  order by
    public.planned_membership_end(ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until) desc,
    ms.created_at desc
  limit 1
  for update;

  if v_previous.id is not null then
    v_planned_end := public.planned_membership_end(
      v_previous.end_date, v_previous.frozen_days, v_previous.state,
      v_previous.pause_started_on, v_previous.pause_until
    );
    v_start_date := case
      when v_planned_end >= v_today then v_planned_end + 1
      else v_today
    end;
  else
    v_start_date := v_today;
  end if;

  v_end_date := public.term_end_date(v_start_date, v_plan.duration_months);
  if v_end_date is null then
    raise exception 'The selected plan duration is invalid' using errcode = '22023';
  end if;

  if p_payment_method = 'complimentary' then
    if coalesce(p_amount_paid, 0) <> 0 then
      raise exception 'Complimentary payments must have a zero amount' using errcode = '22023';
    end if;
    v_amount_due := 0;
  elsif p_amount_paid is not null then
    if p_payment_method is null or p_payment_method not in ('cash', 'card', 'upi', 'wallet') then
      raise exception 'A valid payment method is required' using errcode = '22023';
    end if;
    if p_amount_paid <= 0 or p_amount_paid > v_plan.price then
      raise exception 'Payment amount must be greater than zero and no more than the plan price' using errcode = '22023';
    end if;
    v_amount_due := v_plan.price - p_amount_paid;
  else
    if p_payment_method is not null then
      raise exception 'A payment amount is required when a payment method is provided' using errcode = '22023';
    end if;
    v_amount_due := v_plan.price;
  end if;

  if v_request_id is not null then
    begin
      insert into public.membership_operations (request_id, member_id, kind, request_payload, result)
      values (v_request_id, p_member_id, 'renewal', v_payload, 'null'::jsonb);
    exception
      when unique_violation then
        select mo.result into v_result
        from public.membership_operations as mo
        where mo.request_id = v_request_id and mo.kind = 'renewal';
        if pg_catalog.jsonb_typeof(v_result) = 'object' and v_result ? 'membership_id' then
          membership_id := (v_result->>'membership_id')::uuid;
          payment_id := nullif(v_result->>'payment_id', '')::uuid;
          receipt_number := nullif(v_result->>'receipt_number', '');
          start_date := (v_result->>'start_date')::date;
          end_date := (v_result->>'end_date')::date;
          amount_due := (v_result->>'amount_due')::numeric;
          status := v_result->>'status';
          as_of := (v_result->>'as_of')::date;
          return next;
          return;
        end if;
        raise exception 'This request is already being processed' using errcode = '40001';
    end;
  end if;

  insert into public.memberships (
    member_id,
    plan_id,
    state,
    start_date,
    end_date,
    amount_due,
    plan_name_snapshot,
    duration_months_snapshot,
    price_snapshot,
    currency_snapshot,
    supersedes_membership_id,
    created_by
  )
  values (
    p_member_id,
    v_plan.id,
    'active',
    v_start_date,
    v_end_date,
    v_amount_due,
    v_plan.name,
    v_plan.duration_months,
    v_plan.price,
    v_plan.currency,
    v_previous.id,
    v_actor
  )
  returning id into v_membership_id;

  if p_amount_paid is not null or p_payment_method = 'complimentary' then
    insert into public.payments (membership_id, amount, currency, method, kind, recorded_by)
    values (
      v_membership_id,
      case when p_payment_method = 'complimentary' then 0 else p_amount_paid end,
      v_plan.currency,
      p_payment_method,
      'renewal',
      v_actor
    )
    returning id, public.payments.receipt_number into v_payment_id, v_receipt_number;
  end if;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (
    p_member_id,
    v_actor,
    'membership_renewed',
    'Membership renewed on ' || v_plan.name,
    pg_catalog.jsonb_build_object(
      'membership_id', v_membership_id,
      'payment_id', v_payment_id,
      'start_date', v_start_date,
      'end_date', v_end_date,
      'amount_due', v_amount_due,
      'request_id', v_request_id
    )
  );

  v_result := pg_catalog.jsonb_build_object(
    'membership_id', v_membership_id,
    'payment_id', coalesce(v_payment_id::text, ''),
    'receipt_number', coalesce(v_receipt_number, ''),
    'start_date', v_start_date,
    'end_date', v_end_date,
    'amount_due', v_amount_due,
    'status', public.membership_status('active', v_start_date, v_end_date, v_amount_due, null, v_today),
    'as_of', v_today
  );

  if v_request_id is not null then
    update public.membership_operations
    set result = v_result
    where request_id = v_request_id and kind = 'renewal';
  end if;

  membership_id := v_membership_id;
  payment_id := v_payment_id;
  receipt_number := v_receipt_number;
  start_date := v_start_date;
  end_date := v_end_date;
  amount_due := v_amount_due;
  status := public.membership_status('active', v_start_date, v_end_date, v_amount_due, null, v_today);
  as_of := v_today;
  return next;
end;
$$;

revoke all on function public.renew_membership(uuid, uuid, date, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.renew_membership(uuid, uuid, date, numeric, text, text)
  to authenticated;

-- Server quote so the admin UI previews the exact term the server will sell.
create or replace function public.renewal_quote(
  p_member_id uuid,
  p_plan_id uuid
)
returns table (start_date date, end_date date, price numeric, currency text, as_of date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_previous public.memberships%rowtype;
  v_today date := public.club_today();
  v_planned_end date;
  v_start_date date;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  select * into v_plan from public.plans as p where p.id = p_plan_id and p.is_active;
  if not found then
    raise exception 'The selected plan is not active' using errcode = '22023';
  end if;

  select * into v_previous
  from public.memberships as ms
  where ms.member_id = p_member_id and ms.state in ('active', 'paused')
  order by
    public.planned_membership_end(ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until) desc,
    ms.created_at desc
  limit 1;

  if v_previous.id is not null then
    v_planned_end := public.planned_membership_end(
      v_previous.end_date, v_previous.frozen_days, v_previous.state,
      v_previous.pause_started_on, v_previous.pause_until
    );
    v_start_date := case
      when v_planned_end >= v_today then v_planned_end + 1
      else v_today
    end;
  else
    v_start_date := v_today;
  end if;

  start_date := v_start_date;
  end_date := public.term_end_date(v_start_date, v_plan.duration_months);
  price := v_plan.price;
  currency := v_plan.currency;
  as_of := v_today;
  return next;
end;
$$;

revoke all on function public.renewal_quote(uuid, uuid) from public, anon;
grant execute on function public.renewal_quote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Freeze lifecycle: pauses preserve paid days
-- ---------------------------------------------------------------------
create or replace function public.set_membership_state(
  p_membership_id uuid,
  p_state text,
  p_pause_until date default null,
  p_reason text default null
)
returns table (membership_id uuid, state text, status text, pause_until date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_today date := public.club_today();
  v_membership public.memberships%rowtype;
  v_effective_end date;
  v_old_end date;
  v_planned_resume date;
  v_credit integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_state not in ('active', 'paused', 'cancelled') then
    raise exception 'Membership state must be active, paused, or cancelled' using errcode = '22023';
  end if;

  select * into v_membership
  from public.memberships as ms
  where ms.id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform 1 from public.members as m where m.id = v_membership.member_id for update;

  if v_membership.state = 'cancelled' and p_state <> 'cancelled' then
    raise exception 'A cancelled membership cannot be reactivated' using errcode = '22023';
  end if;

  -- Auto-close a pause whose resume day has been reached: credit the
  -- planned paused days, extend the term, shift queued future terms.
  if v_membership.state = 'paused'
    and v_membership.pause_until is not null
    and v_today >= v_membership.pause_until then
    v_credit := greatest(0, v_membership.pause_until - coalesce(v_membership.pause_started_on, v_membership.pause_until));
    v_old_end := v_membership.end_date;
    v_planned_resume := v_membership.pause_until;

    update public.memberships
    set end_date = end_date + v_credit,
        frozen_days = frozen_days + v_credit,
        state = 'active',
        paused_at = null,
        pause_until = null,
        pause_started_on = null
    where id = v_membership.id
    returning * into v_membership;

    if v_credit > 0 then
      perform public.shift_subsequent_terms(v_membership.id, v_old_end, v_membership.end_date);
      insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
      values (
        v_membership.member_id,
        v_actor,
        'membership_state_changed',
        'Pause ended on schedule; ' || v_credit::text || ' paid day(s) credited back',
        pg_catalog.jsonb_build_object(
          'membership_id', v_membership.id,
          'auto_resume', true,
          'days_credited', v_credit,
          'old_end_date', v_old_end,
          'new_end_date', v_membership.end_date
        )
      );
    end if;

    update public.membership_freezes as fz
    set resumed_on = v_planned_resume,
        days_credited = v_credit
    where fz.membership_id = v_membership.id and fz.resumed_on is null;
  end if;

  if p_state = 'paused' then
    v_effective_end := public.effective_membership_end(
      v_membership.end_date, v_membership.frozen_days, v_membership.state,
      v_membership.pause_started_on, v_membership.pause_until, v_today
    );

    if v_today < v_membership.start_date or v_today > v_effective_end then
      raise exception 'Only a membership inside its term can be paused' using errcode = '22023';
    end if;

    if p_pause_until is null or p_pause_until <= v_today or p_pause_until > v_effective_end + 1 then
      raise exception 'A resume date after today and within the term is required' using errcode = '22023';
    end if;

    update public.memberships
    set state = 'paused',
        paused_at = coalesce(paused_at, pg_catalog.now()),
        pause_started_on = coalesce(pause_started_on, v_today),
        pause_until = p_pause_until
    where id = v_membership.id
    returning * into v_membership;

    if exists (
      select 1 from public.membership_freezes as fz
      where fz.membership_id = v_membership.id and fz.resumed_on is null
    ) then
      update public.membership_freezes as fz
      set resume_on = p_pause_until
      where fz.membership_id = v_membership.id and fz.resumed_on is null;
    else
      insert into public.membership_freezes (membership_id, started_on, resume_on, created_by)
      values (v_membership.id, v_today, p_pause_until, v_actor);
    end if;

  elsif p_state = 'active' then
    if v_membership.state = 'paused' then
      -- Early resume: credit only the days actually consumed so far.
      v_credit := greatest(0, v_today - coalesce(v_membership.pause_started_on, v_today));
      v_old_end := v_membership.end_date;

      if v_credit > 0 then
        update public.memberships
        set end_date = end_date + v_credit,
            frozen_days = frozen_days + v_credit,
            state = 'active',
            paused_at = null,
            pause_until = null,
            pause_started_on = null
        where id = v_membership.id
        returning * into v_membership;

        perform public.shift_subsequent_terms(v_membership.id, v_old_end, v_membership.end_date);
      else
        update public.memberships
        set state = 'active',
            paused_at = null,
            pause_until = null,
            pause_started_on = null
        where id = v_membership.id
        returning * into v_membership;
      end if;

      update public.membership_freezes as fz
      set resumed_on = v_today,
          days_credited = v_credit
      where fz.membership_id = v_membership.id and fz.resumed_on is null;
    end if;

  else
    update public.memberships
    set state = 'cancelled',
        paused_at = null,
        pause_until = null,
        pause_started_on = null
    where id = v_membership.id
    returning * into v_membership;

    update public.membership_freezes as fz
    set resumed_on = v_today,
        days_credited = greatest(0, v_today - fz.started_on)
    where fz.membership_id = v_membership.id and fz.resumed_on is null;
  end if;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (
    v_membership.member_id,
    v_actor,
    'membership_state_changed',
    'Membership state changed to ' || p_state,
    pg_catalog.jsonb_build_object(
      'membership_id', p_membership_id,
      'pause_until', v_membership.pause_until,
      'reason', nullif(pg_catalog.btrim(p_reason), '')
    )
  );

  membership_id := v_membership.id;
  state := v_membership.state;
  status := public.membership_status(
    v_membership.state,
    v_membership.start_date,
    public.effective_membership_end(
      v_membership.end_date, v_membership.frozen_days, v_membership.state,
      v_membership.pause_started_on, v_membership.pause_until, v_today
    ),
    v_membership.amount_due,
    v_membership.pause_until,
    v_today
  );
  pause_until := v_membership.pause_until;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Balance settlement and waiver (append-only ledger)
-- ---------------------------------------------------------------------
create or replace function public.settle_membership_balance(
  p_membership_id uuid,
  p_amount numeric,
  p_method text,
  p_request_id text default null
)
returns table (
  payment_id uuid,
  receipt_number text,
  amount_paid numeric,
  amount_due numeric,
  currency text,
  as_of date
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_today date := public.club_today();
  v_membership public.memberships%rowtype;
  v_methods text[];
  v_payment_id uuid;
  v_receipt_number text;
  v_remaining numeric(12, 2);
  v_request_id text;
  v_payload jsonb;
  v_op record;
  v_result jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'A payment amount greater than zero is required' using errcode = '22023';
  end if;

  select c.supported_payment_methods into v_methods from public.club_config as c where c.id = 1;
  if p_method is null
    or coalesce(pg_catalog.array_position(coalesce(v_methods, '{cash,card,upi,wallet}'), p_method), 0) < 1 then
    raise exception 'A supported desk payment method is required' using errcode = '22023';
  end if;

  select * into v_membership from public.memberships as ms where ms.id = p_membership_id;
  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform 1 from public.members as m where m.id = v_membership.member_id for update;

  select * into v_membership from public.memberships as ms where ms.id = p_membership_id for update;

  -- Idempotency first: a replayed request must return its stored result
  -- even though the balance it settled is already zero.
  if p_request_id is not null then
    v_request_id := pg_catalog.lower(p_request_id);
    v_payload := pg_catalog.jsonb_build_object(
      'membership_id', p_membership_id,
      'amount', p_amount,
      'method', p_method
    );

    select mo.member_id, mo.request_payload, mo.result
    into v_op
    from public.membership_operations as mo
    where mo.request_id = v_request_id and mo.kind = 'settlement';

    if found then
      if v_op.member_id <> v_membership.member_id or v_op.request_payload is distinct from v_payload then
        raise exception 'This request ID was already used with different details' using errcode = '23505';
      end if;
      if pg_catalog.jsonb_typeof(v_op.result) = 'object' and v_op.result ? 'payment_id' then
        payment_id := (v_op.result->>'payment_id')::uuid;
        receipt_number := v_op.result->>'receipt_number';
        amount_paid := (v_op.result->>'amount_paid')::numeric;
        amount_due := (v_op.result->>'amount_due')::numeric;
        currency := v_op.result->>'currency';
        as_of := (v_op.result->>'as_of')::date;
        return next;
        return;
      end if;
      raise exception 'This request is already being processed' using errcode = '40001';
    end if;
  end if;

  if v_membership.state = 'cancelled' then
    raise exception 'A cancelled membership cannot be settled' using errcode = '22023';
  end if;

  if p_amount > v_membership.amount_due then
    raise exception 'The settlement exceeds the outstanding balance' using errcode = '22023';
  end if;

  if v_membership.amount_due <= 0 then
    raise exception 'There is no outstanding balance to settle' using errcode = '22023';
  end if;

  if v_request_id is not null then
    insert into public.membership_operations (request_id, member_id, kind, request_payload, result)
    values (v_request_id, v_membership.member_id, 'settlement', v_payload, 'null'::jsonb);
  end if;

  insert into public.payments (membership_id, amount, currency, method, kind, recorded_by)
  values (
    v_membership.id,
    p_amount,
    v_membership.currency_snapshot,
    p_method,
    'settlement',
    v_actor
  )
  returning id, public.payments.receipt_number into v_payment_id, v_receipt_number;

  update public.memberships
  set amount_due = public.memberships.amount_due - p_amount
  where id = v_membership.id
  returning public.memberships.amount_due into v_remaining;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (
    v_membership.member_id,
    v_actor,
    'balance_settled',
    'Outstanding balance payment recorded',
    pg_catalog.jsonb_build_object(
      'membership_id', v_membership.id,
      'payment_id', v_payment_id,
      'amount_paid', p_amount,
      'currency', v_membership.currency_snapshot,
      'amount_due_remaining', v_remaining,
      'request_id', v_request_id
    )
  );

  v_result := pg_catalog.jsonb_build_object(
    'payment_id', v_payment_id,
    'receipt_number', coalesce(v_receipt_number, ''),
    'amount_paid', p_amount,
    'amount_due', v_remaining,
    'currency', v_membership.currency_snapshot,
    'as_of', v_today
  );

  if v_request_id is not null then
    update public.membership_operations
    set result = v_result
    where request_id = v_request_id and kind = 'settlement';
  end if;

  payment_id := v_payment_id;
  receipt_number := v_receipt_number;
  amount_paid := p_amount;
  amount_due := v_remaining;
  currency := v_membership.currency_snapshot;
  as_of := v_today;
  return next;
end;
$$;

revoke all on function public.settle_membership_balance(uuid, numeric, text, text)
  from public, anon;
grant execute on function public.settle_membership_balance(uuid, numeric, text, text)
  to authenticated;

create or replace function public.waive_membership_balance(
  p_membership_id uuid,
  p_reason text,
  p_request_id text default null
)
returns table (
  payment_id uuid,
  receipt_number text,
  amount_due numeric,
  currency text,
  as_of date
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_today date := public.club_today();
  v_membership public.memberships%rowtype;
  v_payment_id uuid;
  v_receipt_number text;
  v_request_id text;
  v_payload jsonb;
  v_op record;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'A waiver reason between 1 and 500 characters is required' using errcode = '22023';
  end if;

  select * into v_membership from public.memberships as ms where ms.id = p_membership_id;
  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform 1 from public.members as m where m.id = v_membership.member_id for update;

  select * into v_membership from public.memberships as ms where ms.id = p_membership_id for update;

  -- Idempotency first: a replayed request must return its stored result
  -- even though the balance it waived is already zero.
  if p_request_id is not null then
    v_request_id := pg_catalog.lower(p_request_id);
    v_payload := pg_catalog.jsonb_build_object(
      'membership_id', p_membership_id,
      'reason', pg_catalog.btrim(p_reason)
    );

    select mo.member_id, mo.request_payload, mo.result
    into v_op
    from public.membership_operations as mo
    where mo.request_id = v_request_id and mo.kind = 'waiver';

    if found then
      if v_op.member_id <> v_membership.member_id or v_op.request_payload is distinct from v_payload then
        raise exception 'This request ID was already used with different details' using errcode = '23505';
      end if;
      if pg_catalog.jsonb_typeof(v_op.result) = 'object' and v_op.result ? 'payment_id' then
        payment_id := (v_op.result->>'payment_id')::uuid;
        receipt_number := v_op.result->>'receipt_number';
        amount_due := (v_op.result->>'amount_due')::numeric;
        currency := v_op.result->>'currency';
        as_of := (v_op.result->>'as_of')::date;
        return next;
        return;
      end if;
      raise exception 'This request is already being processed' using errcode = '40001';
    end if;
  end if;

  if v_membership.state = 'cancelled' then
    raise exception 'A cancelled membership cannot be waived' using errcode = '22023';
  end if;

  if v_membership.amount_due <= 0 then
    raise exception 'There is no outstanding balance to waive' using errcode = '22023';
  end if;

  if v_request_id is not null then
    insert into public.membership_operations (request_id, member_id, kind, request_payload, result)
    values (v_request_id, v_membership.member_id, 'waiver', v_payload, 'null'::jsonb);
  end if;

  insert into public.payments (membership_id, amount, currency, method, kind, recorded_by)
  values (
    v_membership.id,
    0,
    v_membership.currency_snapshot,
    'complimentary',
    'waiver',
    v_actor
  )
  returning id, public.payments.receipt_number into v_payment_id, v_receipt_number;

  update public.memberships
  set amount_due = 0
  where id = v_membership.id;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (
    v_membership.member_id,
    v_actor,
    'balance_waived',
    'Outstanding balance waived',
    pg_catalog.jsonb_build_object(
      'membership_id', v_membership.id,
      'payment_id', v_payment_id,
      'amount_due', v_membership.amount_due,
      'currency', v_membership.currency_snapshot,
      'reason', pg_catalog.btrim(p_reason),
      'request_id', v_request_id
    )
  );

  if v_request_id is not null then
    update public.membership_operations
    set result = pg_catalog.jsonb_build_object(
      'payment_id', v_payment_id,
      'receipt_number', coalesce(v_receipt_number, ''),
      'amount_due', 0,
      'currency', v_membership.currency_snapshot,
      'as_of', v_today
    )
    where request_id = v_request_id and kind = 'waiver';
  end if;

  payment_id := v_payment_id;
  receipt_number := v_receipt_number;
  amount_due := 0;
  currency := v_membership.currency_snapshot;
  as_of := v_today;
  return next;
end;
$$;

revoke all on function public.waive_membership_balance(uuid, text, text)
  from public, anon;
grant execute on function public.waive_membership_balance(uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 12. Check-ins: never trust a NULL admission
-- ---------------------------------------------------------------------
create or replace function public.check_in_member(
  p_member_id uuid,
  p_reception text default 'A'
)
returns table (check_in_id uuid, admitted boolean, verdict text, membership_id uuid, checked_in_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window integer;
  v_check_in_id uuid;
  v_membership_id uuid;
  v_verdict text;
  v_admitted boolean;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_reception not in ('A', 'B') then
    raise exception 'Reception must be A or B' using errcode = '22023';
  end if;

  perform 1 from public.members as m where m.id = p_member_id;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_member_id::text, 0));
  select c.duplicate_checkin_window_seconds into v_window from public.club_config as c where c.id = 1;
  v_window := coalesce(v_window, 300);

  select a.membership_id, a.verdict, a.admitted
  into v_membership_id, v_verdict, v_admitted
  from public.member_admission(p_member_id, v_now) as a;
  v_admitted := coalesce(v_admitted, false);

  if v_admitted is true and exists (
    select 1
    from public.check_ins as ci
    where ci.member_id = p_member_id
      and ci.admitted
      and ci.checked_in_at >= v_now - pg_catalog.make_interval(secs => v_window)
  ) then
    raise exception 'Member has already checked in within the duplicate window' using errcode = '23505';
  end if;

  insert into public.check_ins (
    member_id,
    membership_id,
    source,
    reception,
    admitted,
    verdict,
    checked_in_by,
    checked_in_at
  )
  values (p_member_id, v_membership_id, 'manual', p_reception, v_admitted, v_verdict, v_actor, v_now)
  returning id into v_check_in_id;

  if v_admitted is true then
    insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata, occurred_at)
    values (
      p_member_id,
      v_actor,
      'check_in',
      'Checked in at Reception ' || p_reception,
      pg_catalog.jsonb_build_object('check_in_id', v_check_in_id, 'source', 'manual'),
      v_now
    );
  end if;

  check_in_id := v_check_in_id;
  admitted := v_admitted;
  verdict := v_verdict;
  membership_id := v_membership_id;
  checked_in_at := v_now;
  return next;
end;
$$;

create or replace function public.check_in_by_qr(
  p_token text,
  p_reception text default 'A'
)
returns table (
  check_in_id uuid,
  admitted boolean,
  verdict text,
  membership_id uuid,
  qr_pass_id uuid,
  member_id uuid,
  member_number text,
  first_name text,
  last_name text,
  plan_name text,
  end_date date,
  days_left integer,
  checked_in_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_pass public.qr_passes%rowtype;
  v_window integer;
  v_membership_id uuid;
  v_verdict text;
  v_admitted boolean;
  v_check_in_id uuid;
  v_resolved_member_id uuid;
  v_as_of date;
  v_term record;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_reception not in ('A', 'B') then
    raise exception 'Reception must be A or B' using errcode = '22023';
  end if;

  v_as_of := public.club_today(v_now);

  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    check_in_id := null;
    admitted := false;
    verdict := 'invalid';
    membership_id := null;
    qr_pass_id := null;
    member_id := null;
    member_number := null;
    first_name := null;
    last_name := null;
    plan_name := null;
    end_date := null;
    days_left := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  -- Resolve the pass without locking first, then take the per-member
  -- advisory lock (same lock order as issuance), then re-lock and
  -- re-verify the pass so issuance and scanning cannot interleave.
  select * into v_pass
  from public.qr_passes as qp
  where qp.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256');

  if not found then
    check_in_id := null;
    admitted := false;
    verdict := 'invalid';
    membership_id := null;
    qr_pass_id := null;
    member_id := null;
    member_number := null;
    first_name := null;
    last_name := null;
    plan_name := null;
    end_date := null;
    days_left := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_pass.member_id::text, 0));

  select * into v_pass
  from public.qr_passes as qp
  where qp.id = v_pass.id
  for update;

  qr_pass_id := v_pass.id;
  v_resolved_member_id := v_pass.member_id;

  if v_pass.revoked_at is not null then
    verdict := 'revoked';
  elsif v_pass.used_at is not null then
    verdict := 'replayed';
  elsif v_pass.expires_at <= v_now then
    verdict := 'expired';
  end if;

  if verdict is not null then
    select m.member_number, m.first_name, m.last_name
    into member_number, first_name, last_name
    from public.members as m
    where m.id = v_resolved_member_id;

    member_id := v_resolved_member_id;
    admitted := false;
    membership_id := null;
    check_in_id := null;
    plan_name := null;
    end_date := null;
    days_left := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  update public.qr_passes set used_at = v_now where id = v_pass.id;

  select a.membership_id, a.verdict, a.admitted
  into v_membership_id, v_verdict, v_admitted
  from public.member_admission(v_pass.member_id, v_now) as a;
  v_admitted := coalesce(v_admitted, false);

  select c.duplicate_checkin_window_seconds into v_window from public.club_config as c where c.id = 1;
  v_window := coalesce(v_window, 300);

  if v_admitted is true and exists (
    select 1
    from public.check_ins as ci
    where ci.member_id = v_pass.member_id
      and ci.admitted
      and ci.checked_in_at >= v_now - pg_catalog.make_interval(secs => v_window)
  ) then
    select m.member_number, m.first_name, m.last_name
    into member_number, first_name, last_name
    from public.members as m
    where m.id = v_resolved_member_id;

    select ms.plan_name_snapshot, ms.end_date
    into plan_name, end_date
    from public.memberships as ms
    where ms.id = v_membership_id;

    check_in_id := null;
    admitted := false;
    verdict := 'duplicate';
    membership_id := v_membership_id;
    member_id := v_resolved_member_id;
    days_left := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  insert into public.check_ins (
    member_id,
    membership_id,
    qr_pass_id,
    source,
    reception,
    admitted,
    verdict,
    checked_in_by,
    checked_in_at
  )
  values (
    v_pass.member_id,
    v_membership_id,
    v_pass.id,
    'qr',
    p_reception,
    v_admitted,
    v_verdict,
    v_actor,
    v_now
  )
  returning id into v_check_in_id;

  if v_admitted is true then
    insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata, occurred_at)
    values (
      v_pass.member_id,
      v_actor,
      'check_in',
      'Checked in by QR at Reception ' || p_reception,
      pg_catalog.jsonb_build_object('check_in_id', v_check_in_id, 'qr_pass_id', v_pass.id, 'source', 'qr'),
      v_now
    );
  end if;

  select m.member_number, m.first_name, m.last_name
  into member_number, first_name, last_name
  from public.members as m
  where m.id = v_resolved_member_id;

  if v_membership_id is not null then
    select
      ms.plan_name_snapshot,
      public.effective_membership_end(
        ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until, v_as_of
      ) as effective_end
    into v_term
    from public.memberships as ms
    where ms.id = v_membership_id;

    plan_name := v_term.plan_name_snapshot;
    end_date := v_term.effective_end;
    -- Inclusive count: the final day is still a usable day.
    days_left := case
      when end_date is null then null
      when end_date < v_as_of then 0
      else (end_date - v_as_of) + 1
    end;
  else
    plan_name := null;
    end_date := null;
    days_left := null;
  end if;

  check_in_id := v_check_in_id;
  admitted := v_admitted;
  verdict := v_verdict;
  membership_id := v_membership_id;
  member_id := v_resolved_member_id;
  checked_in_at := v_now;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- 13. QR issuance: per-member serialization + abuse cap
-- ---------------------------------------------------------------------
create or replace function public.issue_qr_pass(p_revoke_existing boolean default false)
returns table (qr_pass_id uuid, token text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_member_id uuid;
  v_account_state text;
  v_must_set_password boolean;
  v_membership_id uuid;
  v_verdict text;
  v_admitted boolean;
  v_token text;
  v_ttl integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_expires_at timestamptz;
  v_qr_pass_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select m.id, p.account_state, p.must_set_password
  into v_member_id, v_account_state, v_must_set_password
  from public.members as m
  inner join public.profiles as p on p.id = m.auth_user_id
  where m.auth_user_id = v_user_id
    and p.role = 'member';

  if not found
    or v_account_state <> 'active'
    or v_must_set_password then
    raise exception 'An active, onboarded member account is required'
      using errcode = '42501';
  end if;

  -- Serialize issuance/revocation/scan per member (same lock as scans).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_member_id::text, 0));

  select a.membership_id, a.verdict, a.admitted
  into v_membership_id, v_verdict, v_admitted
  from public.member_admission(v_member_id, v_now) as a;
  v_admitted := coalesce(v_admitted, false);

  if v_admitted is not true then
    raise exception 'A QR pass is unavailable for membership status %', v_verdict
      using errcode = '22023';
  end if;

  if (
    select pg_catalog.count(*)
    from public.qr_passes as qp
    where qp.member_id = v_member_id
      and qp.created_at > v_now - pg_catalog.make_interval(secs => 60)
  ) >= 10 then
    raise exception 'Too many QR passes requested; try again shortly' using errcode = '22023';
  end if;

  select c.qr_ttl_seconds into v_ttl
  from public.club_config as c
  where c.id = 1;

  v_ttl := least(300, greatest(30, coalesce(v_ttl, 60)));
  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := v_now + pg_catalog.make_interval(secs => v_ttl);

  if p_revoke_existing then
    update public.qr_passes as qp
    set revoked_at = coalesce(qp.revoked_at, v_now)
    where qp.member_id = v_member_id
      and qp.used_at is null
      and qp.revoked_at is null
      and qp.expires_at > v_now;
  else
    update public.qr_passes as qp
    set revoked_at = coalesce(qp.revoked_at, v_now)
    where qp.member_id = v_member_id
      and qp.used_at is null
      and qp.revoked_at is null
      and qp.expires_at > v_now
      and qp.id not in (
        select keep.id
        from public.qr_passes as keep
        where keep.member_id = v_member_id
          and keep.used_at is null
          and keep.revoked_at is null
          and keep.expires_at > v_now
        order by keep.created_at desc
        limit 1
      );
  end if;

  insert into public.qr_passes (member_id, token_hash, expires_at)
  values (
    v_member_id,
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    v_expires_at
  )
  returning id into v_qr_pass_id;

  qr_pass_id := v_qr_pass_id;
  token := v_token;
  expires_at := v_expires_at;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- 14. Member detail: effective ends, currencies, server as-of date
-- ---------------------------------------------------------------------
create or replace function public.member_detail(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_today date := public.club_today();
begin
  if not public.current_user_is_admin() and public.current_member_id() is distinct from p_member_id then
    raise exception 'Member access is required' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
    'id', m.id,
    'member_number', m.member_number,
    'first_name', m.first_name,
    'last_name', m.last_name,
    'email', m.email::text,
    'phone', m.phone,
    'date_of_birth', m.date_of_birth,
    'emergency_contact_name', m.emergency_contact_name,
    'emergency_contact_phone', m.emergency_contact_phone,
    'national_id', m.national_id,
    'address', m.address,
    'account_state', coalesce(p.account_state, 'invited'),
    'created_at', m.created_at,
    'as_of', v_today,
    'invitation', coalesce((
      select pg_catalog.jsonb_build_object(
        'id', i.id,
        'status', i.status,
        'attempts', i.attempts,
        'email', i.email::text,
        'last_attempt_at', i.last_attempt_at,
        'sent_at', i.sent_at,
        'accepted_at', i.accepted_at,
        'expires_at', i.expires_at
      )
      from public.member_invitations as i
      where i.member_id = m.id
      order by i.created_at desc
      limit 1
    ), 'null'::jsonb),
    'memberships', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', ms.id,
          'plan_id', ms.plan_id,
          'plan_name', ms.plan_name_snapshot,
          'state', ms.state,
          'status', public.membership_status(
            ms.state,
            ms.start_date,
            public.effective_membership_end(ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until, v_today),
            ms.amount_due,
            ms.pause_until,
            v_today
          ),
          'start_date', ms.start_date,
          'end_date', public.effective_membership_end(ms.end_date, ms.frozen_days, ms.state, ms.pause_started_on, ms.pause_until, v_today),
          'physical_end_date', ms.end_date,
          'frozen_days', ms.frozen_days,
          'amount_due', ms.amount_due,
          'grace_until', ms.grace_until,
          'pause_until', ms.pause_until,
          'price', ms.price_snapshot,
          'currency', ms.currency_snapshot,
          'price_egp', ms.price_snapshot
        ) order by ms.start_date desc, ms.created_at desc
      )
      from public.memberships as ms
      where ms.member_id = m.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', pay.id,
          'receipt_number', pay.receipt_number,
          'membership_id', pay.membership_id,
          'amount', pay.amount,
          'currency', pay.currency,
          'amount_egp', pay.amount,
          'method', pay.method,
          'kind', pay.kind,
          'paid_at', pay.paid_at
        ) order by pay.paid_at desc
      )
      from public.payments as pay
      inner join public.memberships as ms on ms.id = pay.membership_id
      where ms.member_id = m.id
    ), '[]'::jsonb),
    'check_ins', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', ci.id,
          'source', ci.source,
          'reception', ci.reception,
          'admitted', ci.admitted,
          'verdict', ci.verdict,
          'checked_in_at', ci.checked_in_at
        ) order by ci.checked_in_at desc
      )
      from public.check_ins as ci
      where ci.member_id = m.id
    ), '[]'::jsonb),
    'activity', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', a.id,
          'kind', a.kind,
          'description', a.description,
          'metadata', a.metadata,
          'occurred_at', a.occurred_at,
          'author', actor.display_name
        ) order by a.occurred_at desc
      )
      from public.activity_log as a
      left join public.profiles as actor on actor.id = a.actor_profile_id
      where a.member_id = m.id
    ), '[]'::jsonb)
  ) into v_result
  from public.members as m
  left join public.profiles as p on p.id = m.auth_user_id
  where m.id = p_member_id;

  if v_result is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 15. Dashboard, search, notices: club clock + effective ends
-- ---------------------------------------------------------------------
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
  )
  select pg_catalog.jsonb_build_object(
    'as_of', p_as_of,
    'total_members', (select pg_catalog.count(*) from public.members),
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
  where (
      v_query = ''
      or pg_catalog.lower(m.first_name || ' ' || m.last_name || ' ' || m.member_number || ' ' || m.email::text) like '%' || v_query || '%'
    )
    and (p_status is null or coalesce(current_membership.status, 'none') = p_status)
  order by m.last_name, m.first_name, m.member_number
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.publish_notice(
  p_category text,
  p_title text,
  p_body text,
  p_audience text,
  p_urgent boolean default false
)
returns table (notice_id uuid, recipient_count integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_notice_id uuid;
  v_recipient_count integer;
  v_today date := public.club_today();
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_category not in ('urgent', 'schedule', 'hours', 'facilities', 'renewal') then
    raise exception 'Invalid notice category' using errcode = '22023';
  end if;
  if p_audience not in ('all_members', 'active_only', 'expiring_soon') then
    raise exception 'Invalid notice audience' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_title, ''))) not between 1 and 160 then
    raise exception 'Notice title is required and must not exceed 160 characters' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''))) not between 1 and 10000 then
    raise exception 'Notice body is required and must not exceed 10000 characters' using errcode = '22023';
  end if;

  insert into public.notices (category, title, body, audience, urgent, author_id)
  values (p_category, pg_catalog.btrim(p_title), pg_catalog.btrim(p_body), p_audience, p_urgent, v_actor)
  returning id into v_notice_id;

  insert into public.notice_deliveries (notice_id, member_id)
  select v_notice_id, m.id
  from public.members as m
  inner join public.profiles as p on p.id = m.auth_user_id and p.role = 'member' and p.account_state = 'active'
  left join lateral (
    select public.membership_status(
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
  where p_audience = 'all_members'
    or (p_audience = 'active_only' and current_membership.status in ('active', 'expiring'))
    or (p_audience = 'expiring_soon' and current_membership.status = 'expiring');

  get diagnostics v_recipient_count = row_count;

  insert into public.activity_log (actor_profile_id, kind, description, metadata)
  values (
    v_actor,
    'notice_published',
    'Notice published to ' || v_recipient_count::text || ' members',
    pg_catalog.jsonb_build_object('notice_id', v_notice_id, 'audience', p_audience, 'recipient_count', v_recipient_count)
  );

  notice_id := v_notice_id;
  recipient_count := v_recipient_count;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- 16. Advised FK index + fixture plan re-pricing (owner-confirmed INR)
-- ---------------------------------------------------------------------
create index if not exists notices_deleted_by_idx
  on public.notices (deleted_by)
  where deleted_by is not null;

update public.plans set price = 2499.00 where slug = 'premium-monthly';
update public.plans set price = 6999.00 where slug in ('three-month', 'premium-quarterly');
update public.plans set price = 23999.00 where slug = 'annual';

-- ---------------------------------------------------------------------
-- 17. Internal helpers stay RPC-only
-- ---------------------------------------------------------------------
revoke all on function public.club_today(timestamptz) from public, anon, authenticated;
revoke all on function public.term_end_date(date, integer) from public, anon, authenticated;
revoke all on function public.effective_membership_end(date, integer, text, date, date, date) from public, anon, authenticated;
revoke all on function public.planned_membership_end(date, integer, text, date, date) from public, anon, authenticated;
revoke all on function public.shift_subsequent_terms(uuid, date, date) from public, anon, authenticated;
revoke all on function public.current_membership(uuid, date) from public, anon, authenticated;

commit;
