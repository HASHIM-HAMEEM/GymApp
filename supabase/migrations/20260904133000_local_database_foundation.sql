begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create sequence if not exists public.member_number_sequence
  as bigint
  increment by 1
  minvalue 1
  maxvalue 9999
  start with 1
  no cycle;

create sequence if not exists public.receipt_number_sequence
  as bigint
  increment by 1
  minvalue 1
  start with 1
  no cycle;

create or replace function public.next_receipt_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'MRD-R-' || pg_catalog.to_char(pg_catalog.clock_timestamp(), 'YYYY') || '-' ||
    pg_catalog.lpad(
      pg_catalog.nextval('public.receipt_number_sequence'::pg_catalog.regclass)::text,
      6,
      '0'
    );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null constraint profiles_role_check check (role in ('admin', 'member')),
  account_state text not null default 'invited' constraint profiles_account_state_check check (account_state in ('active', 'invited', 'suspended')),
  must_set_password boolean not null default true,
  display_name text not null constraint profiles_display_name_check check (pg_catalog.char_length(pg_catalog.btrim(display_name)) between 1 and 120),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.members (
  id uuid primary key default extensions.gen_random_uuid(),
  member_number text not null default (
    'MRD-' || pg_catalog.lpad(
      pg_catalog.nextval('public.member_number_sequence'::pg_catalog.regclass)::text,
      4,
      '0'
    )
  ),
  first_name text not null constraint members_first_name_check check (pg_catalog.char_length(pg_catalog.btrim(first_name)) between 1 and 80),
  last_name text not null constraint members_last_name_check check (pg_catalog.char_length(pg_catalog.btrim(last_name)) between 1 and 80),
  email extensions.citext not null,
  phone text constraint members_phone_check check (phone is null or pg_catalog.char_length(pg_catalog.btrim(phone)) between 7 and 32),
  date_of_birth date,
  emergency_contact_name text constraint members_emergency_name_check check (emergency_contact_name is null or pg_catalog.char_length(pg_catalog.btrim(emergency_contact_name)) between 1 and 160),
  emergency_contact_phone text constraint members_emergency_phone_check check (emergency_contact_phone is null or pg_catalog.char_length(pg_catalog.btrim(emergency_contact_phone)) between 7 and 32),
  national_id text constraint members_national_id_check check (national_id is null or pg_catalog.char_length(pg_catalog.btrim(national_id)) between 4 and 64),
  address text constraint members_address_check check (address is null or pg_catalog.char_length(pg_catalog.btrim(address)) between 1 and 500),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint members_member_number_key unique (member_number),
  constraint members_member_number_check check (member_number ~ '^MRD-[0-9]{4}$'),
  constraint members_email_key unique (email),
  constraint members_email_normalized_check check (
    email::text = pg_catalog.lower(pg_catalog.btrim(email::text))
    and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create table if not exists public.plans (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique constraint plans_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null constraint plans_name_check check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 120),
  duration_months integer not null constraint plans_duration_check check (duration_months between 1 and 120),
  price_egp numeric(12, 2) not null constraint plans_price_check check (price_egp >= 0),
  blurb text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.club_config (
  id smallint primary key default 1 constraint club_config_singleton_check check (id = 1),
  name text not null,
  address text not null,
  city text not null,
  phone text not null,
  currency text not null default 'EGP' constraint club_config_currency_check check (currency = 'EGP'),
  timezone text not null default 'Africa/Cairo',
  hours jsonb not null default '[]'::jsonb constraint club_config_hours_check check (pg_catalog.jsonb_typeof(hours) = 'array'),
  qr_ttl_seconds integer not null default 90 constraint club_config_qr_ttl_check check (qr_ttl_seconds between 30 and 300),
  duplicate_checkin_window_seconds integer not null default 300 constraint club_config_duplicate_window_check check (duplicate_checkin_window_seconds between 30 and 3600),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  state text not null default 'active' constraint memberships_state_check check (state in ('active', 'paused', 'cancelled')),
  start_date date not null,
  end_date date not null,
  amount_due numeric(12, 2) not null default 0 constraint memberships_amount_due_check check (amount_due >= 0),
  grace_until date,
  paused_at timestamptz,
  pause_until date,
  plan_name_snapshot text not null,
  duration_months_snapshot integer not null constraint memberships_duration_snapshot_check check (duration_months_snapshot > 0),
  price_egp_snapshot numeric(12, 2) not null constraint memberships_price_snapshot_check check (price_egp_snapshot >= 0),
  supersedes_membership_id uuid references public.memberships(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint memberships_date_range_check check (end_date >= start_date),
  constraint memberships_due_not_above_price_check check (amount_due <= price_egp_snapshot),
  constraint memberships_pause_check check (
    (state = 'paused' and paused_at is not null)
    or state <> 'paused'
  )
);

create table if not exists public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  receipt_number text not null default public.next_receipt_number(),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  amount_egp numeric(12, 2) not null constraint payments_amount_check check (amount_egp >= 0),
  method text not null constraint payments_method_check check (method in ('instapay', 'cash', 'card', 'wallet', 'complimentary')),
  kind text not null constraint payments_kind_check check (kind in ('initial', 'renewal', 'adjustment')),
  paid_at timestamptz not null default pg_catalog.now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint payments_receipt_number_key unique (receipt_number),
  constraint payments_complimentary_amount_check check (method <> 'complimentary' or amount_egp = 0)
);

create table if not exists public.member_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  email extensions.citext not null,
  status text not null default 'pending' constraint member_invitations_status_check check (status in ('pending', 'sent', 'accepted', 'failed', 'cancelled')),
  attempts integer not null default 0 constraint member_invitations_attempts_check check (attempts >= 0),
  last_error text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default pg_catalog.now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  failed_at timestamptz,
  expires_at timestamptz not null default (pg_catalog.now() + interval '7 days'),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint member_invitations_email_normalized_check check (
    email::text = pg_catalog.lower(pg_catalog.btrim(email::text))
    and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint member_invitations_expiry_check check (expires_at > requested_at)
);

create table if not exists public.qr_passes (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint qr_passes_expiry_check check (expires_at > created_at)
);

create table if not exists public.check_ins (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  membership_id uuid references public.memberships(id) on delete restrict,
  qr_pass_id uuid unique references public.qr_passes(id) on delete restrict,
  source text not null constraint check_ins_source_check check (source in ('manual', 'qr')),
  reception text not null constraint check_ins_reception_check check (reception in ('A', 'B')),
  admitted boolean not null,
  verdict text not null constraint check_ins_verdict_check check (verdict in ('active', 'expiring', 'due', 'paused', 'expired', 'upcoming', 'cancelled', 'invited', 'suspended', 'none')),
  checked_in_by uuid not null references public.profiles(id) on delete restrict,
  checked_in_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.notices (
  id uuid primary key default extensions.gen_random_uuid(),
  category text not null constraint notices_category_check check (category in ('urgent', 'schedule', 'hours', 'facilities', 'renewal')),
  title text not null constraint notices_title_check check (pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 160),
  body text not null constraint notices_body_check check (pg_catalog.char_length(pg_catalog.btrim(body)) between 1 and 10000),
  audience text not null constraint notices_audience_check check (audience in ('all_members', 'active_only', 'expiring_soon')),
  urgent boolean not null default false,
  author_id uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.notice_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  delivered_at timestamptz not null default pg_catalog.now(),
  read_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint notice_deliveries_notice_member_key unique (notice_id, member_id)
);

create table if not exists public.activity_log (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid references public.members(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  kind text not null constraint activity_log_kind_check check (kind in ('member_created', 'invitation_sent', 'invitation_failed', 'onboarding_completed', 'membership_started', 'membership_renewed', 'membership_state_changed', 'check_in', 'notice_published')),
  description text not null constraint activity_log_description_check check (pg_catalog.char_length(pg_catalog.btrim(description)) between 1 and 1000),
  metadata jsonb not null default '{}'::jsonb constraint activity_log_metadata_check check (pg_catalog.jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now()
);

insert into public.plans (slug, name, duration_months, price_egp, blurb, is_active)
values
  ('premium-monthly', 'Premium Monthly', 1, 1500, 'Full floor, studio & recovery access', true),
  ('three-month', '3-Month Plan', 3, 4050, 'Same access · saves EGP 450', true),
  ('premium-quarterly', 'Premium Quarterly', 3, 4050, 'Same access · saves EGP 450', true),
  ('annual', 'Annual Membership', 12, 15000, 'Same access · two months free', true)
on conflict (slug) do update
set
  name = excluded.name,
  duration_months = excluded.duration_months,
  price_egp = excluded.price_egp,
  blurb = excluded.blurb,
  is_active = excluded.is_active,
  updated_at = pg_catalog.now();

insert into public.club_config (id, name, address, city, phone, currency, timezone, hours, qr_ttl_seconds, duplicate_checkin_window_seconds)
values (
  1,
  'Meridian Athletic Club',
  '14 El-Nakhil St., Nasser City',
  'Cairo',
  '+20 2 2619 4400',
  'EGP',
  'Africa/Cairo',
  '[{"label":"Mon–Thu","value":"6 AM–11 PM"},{"label":"Fri","value":"7 AM–9 PM"},{"label":"Sat","value":"6 AM–10 PM"}]'::jsonb,
  90,
  300
)
on conflict (id) do update
set
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  phone = excluded.phone,
  currency = excluded.currency,
  timezone = excluded.timezone,
  hours = excluded.hours,
  qr_ttl_seconds = excluded.qr_ttl_seconds,
  duplicate_checkin_window_seconds = excluded.duplicate_checkin_window_seconds,
  updated_at = pg_catalog.now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

create or replace function public.reject_append_only_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at before update on public.members for each row execute function public.set_updated_at();
drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at before update on public.plans for each row execute function public.set_updated_at();
drop trigger if exists club_config_set_updated_at on public.club_config;
create trigger club_config_set_updated_at before update on public.club_config for each row execute function public.set_updated_at();
drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at before update on public.memberships for each row execute function public.set_updated_at();
drop trigger if exists member_invitations_set_updated_at on public.member_invitations;
create trigger member_invitations_set_updated_at before update on public.member_invitations for each row execute function public.set_updated_at();
drop trigger if exists payments_append_only on public.payments;
create trigger payments_append_only before update or delete on public.payments for each row execute function public.reject_append_only_mutation();
drop trigger if exists check_ins_append_only on public.check_ins;
create trigger check_ins_append_only before update or delete on public.check_ins for each row execute function public.reject_append_only_mutation();
drop trigger if exists activity_log_append_only on public.activity_log;
create trigger activity_log_append_only before update or delete on public.activity_log for each row execute function public.reject_append_only_mutation();

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.account_state = 'active'
  );
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.members as m
  inner join public.profiles as p on p.id = m.auth_user_id
  where m.auth_user_id = (select auth.uid())
    and p.role = 'member'
  limit 1;
$$;

create or replace function public.membership_status(
  p_state text,
  p_start_date date,
  p_end_date date,
  p_amount_due numeric,
  p_pause_until date default null,
  p_as_of date default current_date
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
    when p_state = 'paused' and (p_pause_until is null or p_pause_until >= p_as_of) then 'paused'
    when p_amount_due > 0 then 'due'
    when p_end_date <= p_as_of + 7 then 'expiring'
    else 'active'
  end;
$$;

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
  v_state text;
  v_start_date date;
  v_end_date date;
  v_amount_due numeric;
  v_grace_until date;
  v_pause_until date;
  v_as_of date;
  v_timezone text;
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

  select c.timezone into v_timezone from public.club_config as c where c.id = 1;
  v_as_of := pg_catalog.timezone(coalesce(v_timezone, 'Africa/Cairo'), p_at)::date;

  select ms.id, ms.state, ms.start_date, ms.end_date, ms.amount_due, ms.grace_until, ms.pause_until
  into membership_id, v_state, v_start_date, v_end_date, v_amount_due, v_grace_until, v_pause_until
  from public.memberships as ms
  where ms.member_id = p_member_id
  order by
    case
      when ms.state in ('active', 'paused') and v_as_of between ms.start_date and ms.end_date then 0
      when ms.state in ('active', 'paused') and ms.start_date > v_as_of then 1
      else 2
    end,
    case when ms.start_date > v_as_of then ms.start_date end asc,
    ms.end_date desc,
    ms.created_at desc
  limit 1;

  if membership_id is null then
    verdict := 'none';
    admitted := false;
    return next;
    return;
  end if;

  verdict := public.membership_status(v_state, v_start_date, v_end_date, v_amount_due, v_pause_until, v_as_of);
  admitted := verdict in ('active', 'expiring') or (verdict = 'due' and v_grace_until >= v_as_of);
  return next;
end;
$$;

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

  if p_date_of_birth is not null and p_date_of_birth > current_date then
    raise exception 'Date of birth cannot be in the future' using errcode = '22023';
  end if;

  if p_plan_id is null and (p_amount_paid is not null or p_payment_method is not null or p_membership_start_date is not null) then
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

    v_start_date := coalesce(p_membership_start_date, current_date);
    v_end_date := (v_start_date + pg_catalog.make_interval(months => v_plan.duration_months))::date - 1;

    if p_payment_method = 'complimentary' then
      if coalesce(p_amount_paid, 0) <> 0 then
        raise exception 'Complimentary payments must have a zero amount' using errcode = '22023';
      end if;
      v_amount_due := 0;
    elsif p_amount_paid is not null then
      if p_payment_method is null or p_payment_method not in ('instapay', 'cash', 'card', 'wallet') then
        raise exception 'A valid payment method is required' using errcode = '22023';
      end if;
      if p_amount_paid <= 0 or p_amount_paid > v_plan.price_egp then
        raise exception 'Payment amount must be greater than zero and no more than the plan price' using errcode = '22023';
      end if;
      v_amount_due := v_plan.price_egp - p_amount_paid;
    else
      if p_payment_method is not null then
        raise exception 'A payment amount is required when a payment method is provided' using errcode = '22023';
      end if;
      v_amount_due := v_plan.price_egp;
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
      price_egp_snapshot,
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
      v_plan.price_egp,
      v_actor
    )
    returning id into v_membership_id;

    if p_amount_paid is not null or p_payment_method = 'complimentary' then
      insert into public.payments (membership_id, amount_egp, method, kind, recorded_by)
      values (
        v_membership_id,
        case when p_payment_method = 'complimentary' then 0 else p_amount_paid end,
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

create or replace function public.finalize_member_invitation(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns table (invitation_id uuid, member_id uuid, auth_user_id uuid, status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation public.member_invitations%rowtype;
  v_member public.members%rowtype;
  v_auth_email extensions.citext;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'The service role is required' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.member_invitations as i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if v_invitation.status = 'accepted' then
    if v_invitation.auth_user_id is distinct from p_auth_user_id then
      raise exception 'Invitation is already linked to another user' using errcode = '23505';
    end if;
    invitation_id := v_invitation.id;
    member_id := v_invitation.member_id;
    auth_user_id := v_invitation.auth_user_id;
    status := v_invitation.status;
    return next;
    return;
  end if;

  if v_invitation.status not in ('pending', 'failed', 'sent') then
    raise exception 'Invitation cannot be finalized from its current status' using errcode = '22023';
  end if;

  if v_invitation.expires_at <= pg_catalog.now() then
    raise exception 'Invitation has expired' using errcode = '22023';
  end if;

  select pg_catalog.lower(pg_catalog.btrim(u.email))::extensions.citext
  into v_auth_email
  from auth.users as u
  where u.id = p_auth_user_id;

  if not found then
    raise exception 'Auth user not found' using errcode = 'P0002';
  end if;

  if v_auth_email is distinct from v_invitation.email then
    raise exception 'Auth user email does not match the invitation' using errcode = '22023';
  end if;

  select * into v_member from public.members as m where m.id = v_invitation.member_id for update;

  if v_member.auth_user_id is not null and v_member.auth_user_id is distinct from p_auth_user_id then
    raise exception 'Member is already linked to another auth user' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.members as m
    where m.auth_user_id = p_auth_user_id and m.id <> v_member.id
  ) then
    raise exception 'Auth user is already linked to another member' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.profiles as p
    where p.id = p_auth_user_id and p.role <> 'member'
  ) then
    raise exception 'Auth user already has a non-member profile' using errcode = '23505';
  end if;

  insert into public.profiles (id, role, account_state, must_set_password, display_name)
  values (
    p_auth_user_id,
    'member',
    'invited',
    true,
    pg_catalog.btrim(v_member.first_name || ' ' || v_member.last_name)
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    must_set_password = true,
    account_state = case when public.profiles.account_state = 'suspended' then 'suspended' else 'invited' end;

  update public.members
  set auth_user_id = p_auth_user_id
  where id = v_member.id;

  update public.member_invitations
  set
    auth_user_id = p_auth_user_id,
    status = 'sent',
    attempts = attempts + 1,
    last_attempt_at = pg_catalog.now(),
    sent_at = coalesce(sent_at, pg_catalog.now()),
    failed_at = null,
    last_error = null
  where id = v_invitation.id;

  insert into public.activity_log (member_id, kind, description, metadata)
  values (
    v_member.id,
    'invitation_sent',
    'Email invitation linked to the member auth account',
    pg_catalog.jsonb_build_object('invitation_id', v_invitation.id, 'auth_user_id', p_auth_user_id)
  );

  invitation_id := v_invitation.id;
  member_id := v_member.id;
  auth_user_id := p_auth_user_id;
  status := 'sent';
  return next;
end;
$$;

create or replace function public.mark_member_invitation_failed(
  p_invitation_id uuid,
  p_error text
)
returns table (invitation_id uuid, member_id uuid, status text, attempts integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation public.member_invitations%rowtype;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'The service role is required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_error, ''))) not between 1 and 2000 then
    raise exception 'A concise failure reason is required' using errcode = '22023';
  end if;

  select * into v_invitation
  from public.member_invitations as i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if v_invitation.status in ('accepted', 'cancelled') then
    raise exception 'A completed invitation cannot be marked failed' using errcode = '22023';
  end if;

  update public.member_invitations
  set
    status = 'failed',
    attempts = public.member_invitations.attempts + 1,
    last_attempt_at = pg_catalog.now(),
    failed_at = pg_catalog.now(),
    last_error = pg_catalog.left(pg_catalog.btrim(p_error), 2000)
  where id = v_invitation.id
  returning public.member_invitations.attempts into attempts;

  insert into public.activity_log (member_id, kind, description, metadata)
  values (
    v_invitation.member_id,
    'invitation_failed',
    'Email invitation delivery failed',
    pg_catalog.jsonb_build_object('invitation_id', v_invitation.id)
  );

  invitation_id := v_invitation.id;
  member_id := v_invitation.member_id;
  status := 'failed';
  return next;
end;
$$;

create or replace function public.complete_member_onboarding()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_member_id uuid;
  v_profile public.profiles%rowtype;
  v_email_confirmed_at timestamptz;
  v_should_log boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles as p where p.id = v_user_id for update;
  if not found or v_profile.role <> 'member' then
    raise exception 'A member profile is required' using errcode = '42501';
  end if;

  if v_profile.account_state = 'suspended' then
    raise exception 'Suspended accounts cannot complete onboarding' using errcode = '42501';
  end if;

  select u.email_confirmed_at into v_email_confirmed_at from auth.users as u where u.id = v_user_id;
  if v_email_confirmed_at is null then
    raise exception 'Email confirmation is required' using errcode = '42501';
  end if;

  select m.id into v_member_id from public.members as m where m.auth_user_id = v_user_id for update;
  if not found then
    raise exception 'Member record not found' using errcode = 'P0002';
  end if;

  v_should_log := v_profile.must_set_password or v_profile.account_state = 'invited';

  update public.profiles
  set account_state = 'active', must_set_password = false
  where id = v_user_id;

  update public.member_invitations
  set
    status = 'accepted',
    accepted_at = coalesce(accepted_at, pg_catalog.now())
  where member_id = v_member_id and status = 'sent';

  if v_should_log then
    insert into public.activity_log (member_id, actor_profile_id, kind, description)
    values (v_member_id, v_user_id, 'onboarding_completed', 'Member completed account onboarding');
  end if;

  return v_member_id;
end;
$$;

create or replace function public.renew_membership(
  p_member_id uuid,
  p_plan_id uuid,
  p_start_date date default null,
  p_amount_paid numeric default null,
  p_payment_method text default null
)
returns table (membership_id uuid, payment_id uuid, start_date date, end_date date, amount_due numeric, status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_plan public.plans%rowtype;
  v_previous public.memberships%rowtype;
  v_start_date date;
  v_end_date date;
  v_amount_due numeric(12, 2);
  v_membership_id uuid;
  v_payment_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
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
  order by ms.end_date desc, ms.created_at desc
  limit 1
  for update;

  if p_start_date is null then
    v_start_date := case
      when v_previous.id is not null and v_previous.end_date >= current_date then v_previous.end_date + 1
      else current_date
    end;
  else
    v_start_date := p_start_date;
    if v_previous.id is not null and v_start_date <= v_previous.end_date then
      raise exception 'Renewal dates cannot overlap an existing membership' using errcode = '22023';
    end if;
  end if;

  v_end_date := (v_start_date + pg_catalog.make_interval(months => v_plan.duration_months))::date - 1;

  if p_payment_method = 'complimentary' then
    if coalesce(p_amount_paid, 0) <> 0 then
      raise exception 'Complimentary payments must have a zero amount' using errcode = '22023';
    end if;
    v_amount_due := 0;
  elsif p_amount_paid is not null then
    if p_payment_method is null or p_payment_method not in ('instapay', 'cash', 'card', 'wallet') then
      raise exception 'A valid payment method is required' using errcode = '22023';
    end if;
    if p_amount_paid <= 0 or p_amount_paid > v_plan.price_egp then
      raise exception 'Payment amount must be greater than zero and no more than the plan price' using errcode = '22023';
    end if;
    v_amount_due := v_plan.price_egp - p_amount_paid;
  else
    if p_payment_method is not null then
      raise exception 'A payment amount is required when a payment method is provided' using errcode = '22023';
    end if;
    v_amount_due := v_plan.price_egp;
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
    price_egp_snapshot,
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
    v_plan.price_egp,
    v_previous.id,
    v_actor
  )
  returning id into v_membership_id;

  if p_amount_paid is not null or p_payment_method = 'complimentary' then
    insert into public.payments (membership_id, amount_egp, method, kind, recorded_by)
    values (
      v_membership_id,
      case when p_payment_method = 'complimentary' then 0 else p_amount_paid end,
      p_payment_method,
      'renewal',
      v_actor
    )
    returning id into v_payment_id;
  end if;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (
    p_member_id,
    v_actor,
    'membership_renewed',
    'Membership renewed on ' || v_plan.name,
    pg_catalog.jsonb_build_object('membership_id', v_membership_id, 'payment_id', v_payment_id)
  );

  membership_id := v_membership_id;
  payment_id := v_payment_id;
  start_date := v_start_date;
  end_date := v_end_date;
  amount_due := v_amount_due;
  status := public.membership_status('active', v_start_date, v_end_date, v_amount_due, null, current_date);
  return next;
end;
$$;

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
  v_membership public.memberships%rowtype;
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

  if v_membership.state = 'cancelled' and p_state <> 'cancelled' then
    raise exception 'A cancelled membership cannot be reactivated' using errcode = '22023';
  end if;

  if p_state = 'paused' and (
    current_date not between v_membership.start_date and v_membership.end_date
    or p_pause_until is null
    or p_pause_until <= current_date
    or p_pause_until > v_membership.end_date
  ) then
    raise exception 'An active membership and a pause end date within its term are required' using errcode = '22023';
  end if;

  update public.memberships
  set
    state = p_state,
    paused_at = case when p_state = 'paused' then coalesce(paused_at, pg_catalog.now()) else null end,
    pause_until = case when p_state = 'paused' then p_pause_until else null end
  where id = p_membership_id
  returning * into v_membership;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (
    v_membership.member_id,
    v_actor,
    'membership_state_changed',
    'Membership state changed to ' || p_state,
    pg_catalog.jsonb_build_object(
      'membership_id', p_membership_id,
      'pause_until', p_pause_until,
      'reason', nullif(pg_catalog.btrim(p_reason), '')
    )
  );

  membership_id := v_membership.id;
  state := v_membership.state;
  status := public.membership_status(
    v_membership.state,
    v_membership.start_date,
    v_membership.end_date,
    v_membership.amount_due,
    v_membership.pause_until,
    current_date
  );
  pause_until := v_membership.pause_until;
  return next;
end;
$$;

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

  if v_admitted and exists (
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

  if v_admitted then
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

create or replace function public.issue_qr_pass()
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
  where m.auth_user_id = v_user_id and p.role = 'member';

  if not found or v_account_state <> 'active' or v_must_set_password then
    raise exception 'An active, onboarded member account is required' using errcode = '42501';
  end if;

  select a.membership_id, a.verdict, a.admitted
  into v_membership_id, v_verdict, v_admitted
  from public.member_admission(v_member_id, pg_catalog.now()) as a;

  if not v_admitted then
    raise exception 'A QR pass is unavailable for membership status %', v_verdict using errcode = '22023';
  end if;

  select c.qr_ttl_seconds into v_ttl from public.club_config as c where c.id = 1;
  v_ttl := least(300, greatest(30, coalesce(v_ttl, 90)));
  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => v_ttl);

  update public.qr_passes as qp
  set revoked_at = coalesce(qp.revoked_at, pg_catalog.now())
  where qp.member_id = v_member_id
    and qp.used_at is null
    and qp.revoked_at is null
    and qp.expires_at > pg_catalog.now();

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

create or replace function public.check_in_by_qr(
  p_token text,
  p_reception text default 'A'
)
returns table (check_in_id uuid, admitted boolean, verdict text, membership_id uuid, qr_pass_id uuid, checked_in_at timestamptz)
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
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_reception not in ('A', 'B') then
    raise exception 'Reception must be A or B' using errcode = '22023';
  end if;

  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    check_in_id := null;
    admitted := false;
    verdict := 'invalid';
    membership_id := null;
    qr_pass_id := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  select * into v_pass
  from public.qr_passes as qp
  where qp.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
  for update;

  if not found then
    check_in_id := null;
    admitted := false;
    verdict := 'invalid';
    membership_id := null;
    qr_pass_id := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  qr_pass_id := v_pass.id;

  if v_pass.revoked_at is not null then
    check_in_id := null;
    admitted := false;
    verdict := 'revoked';
    membership_id := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  if v_pass.used_at is not null then
    check_in_id := null;
    admitted := false;
    verdict := 'replayed';
    membership_id := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  if v_pass.expires_at <= v_now then
    check_in_id := null;
    admitted := false;
    verdict := 'expired';
    membership_id := null;
    checked_in_at := v_now;
    return next;
    return;
  end if;

  update public.qr_passes set used_at = v_now where id = v_pass.id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_pass.member_id::text, 0));

  select a.membership_id, a.verdict, a.admitted
  into v_membership_id, v_verdict, v_admitted
  from public.member_admission(v_pass.member_id, v_now) as a;

  select c.duplicate_checkin_window_seconds into v_window from public.club_config as c where c.id = 1;
  v_window := coalesce(v_window, 300);

  if v_admitted and exists (
    select 1
    from public.check_ins as ci
    where ci.member_id = v_pass.member_id
      and ci.admitted
      and ci.checked_in_at >= v_now - pg_catalog.make_interval(secs => v_window)
  ) then
    check_in_id := null;
    admitted := false;
    verdict := 'duplicate';
    membership_id := v_membership_id;
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

  if v_admitted then
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

  check_in_id := v_check_in_id;
  admitted := v_admitted;
  verdict := v_verdict;
  membership_id := v_membership_id;
  checked_in_at := v_now;
  return next;
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
  v_as_of date;
  v_timezone text;
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

  select c.timezone into v_timezone from public.club_config as c where c.id = 1;
  v_as_of := pg_catalog.timezone(coalesce(v_timezone, 'Africa/Cairo'), pg_catalog.now())::date;

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
      ms.end_date,
      ms.amount_due,
      ms.pause_until,
      v_as_of
    ) as status
    from public.memberships as ms
    where ms.member_id = m.id
    order by
      case
        when ms.state in ('active', 'paused') and v_as_of between ms.start_date and ms.end_date then 0
        when ms.state in ('active', 'paused') and ms.start_date > v_as_of then 1
        else 2
      end,
      case when ms.start_date > v_as_of then ms.start_date end asc,
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

create or replace function public.mark_notice_read(p_notice_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.current_member_id();
  v_read_at timestamptz;
begin
  if v_member_id is null then
    raise exception 'A member account is required' using errcode = '42501';
  end if;

  update public.notice_deliveries
  set read_at = coalesce(read_at, pg_catalog.now())
  where notice_id = p_notice_id and member_id = v_member_id
  returning read_at into v_read_at;

  if not found then
    raise exception 'Notice delivery not found' using errcode = 'P0002';
  end if;

  return v_read_at;
end;
$$;

create or replace function public.admin_dashboard(p_as_of date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  with member_statuses as (
    select
      m.id,
      current_membership.status
    from public.members as m
    left join lateral (
      select public.membership_status(
        ms.state,
        ms.start_date,
        ms.end_date,
        ms.amount_due,
        ms.pause_until,
        p_as_of
      ) as status
      from public.memberships as ms
      where ms.member_id = m.id
      order by
        case
          when ms.state in ('active', 'paused') and p_as_of between ms.start_date and ms.end_date then 0
          when ms.state in ('active', 'paused') and ms.start_date > p_as_of then 1
          else 2
        end,
        case when ms.start_date > p_as_of then ms.start_date end asc,
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
    'check_ins_today', (
      select pg_catalog.count(*)
      from public.check_ins as ci
      where ci.admitted and ci.checked_in_at >= p_as_of::timestamptz and ci.checked_in_at < (p_as_of + 1)::timestamptz
    ),
    'pending_invitations', (
      select pg_catalog.count(*) from public.member_invitations as i where i.status in ('pending', 'failed')
    ),
    'payments_this_month_egp', (
      select coalesce(pg_catalog.sum(pay.amount_egp), 0)
      from public.payments as pay
      where pay.paid_at >= pg_catalog.date_trunc('month', p_as_of::timestamptz)
        and pay.paid_at < pg_catalog.date_trunc('month', p_as_of::timestamptz) + interval '1 month'
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.search_members(
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
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
  membership_end_date date
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
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
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
    current_membership.end_date
  from public.members as m
  left join public.profiles as p on p.id = m.auth_user_id
  left join lateral (
    select
      ms.end_date,
      public.membership_status(ms.state, ms.start_date, ms.end_date, ms.amount_due, ms.pause_until, current_date) as status
    from public.memberships as ms
    where ms.member_id = m.id
    order by
      case
        when ms.state in ('active', 'paused') and current_date between ms.start_date and ms.end_date then 0
        when ms.state in ('active', 'paused') and ms.start_date > current_date then 1
        else 2
      end,
      case when ms.start_date > current_date then ms.start_date end asc,
      ms.end_date desc,
      ms.created_at desc
    limit 1
  ) as current_membership on true
  where v_query = ''
    or pg_catalog.lower(m.first_name || ' ' || m.last_name || ' ' || m.member_number || ' ' || m.email::text) like '%' || v_query || '%'
  order by m.last_name, m.first_name, m.member_number
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.member_detail(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
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
    'memberships', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', ms.id,
          'plan_id', ms.plan_id,
          'plan_name', ms.plan_name_snapshot,
          'state', ms.state,
          'status', public.membership_status(ms.state, ms.start_date, ms.end_date, ms.amount_due, ms.pause_until, current_date),
          'start_date', ms.start_date,
          'end_date', ms.end_date,
          'amount_due', ms.amount_due,
          'grace_until', ms.grace_until,
          'pause_until', ms.pause_until,
          'price_egp', ms.price_egp_snapshot
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
          'amount_egp', pay.amount_egp,
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
          'occurred_at', a.occurred_at
        ) order by a.occurred_at desc
      )
      from public.activity_log as a
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

create unique index if not exists members_national_id_key on public.members (national_id) where national_id is not null;
create index if not exists members_auth_user_id_idx on public.members (auth_user_id) where auth_user_id is not null;
create index if not exists members_created_by_idx on public.members (created_by);
create index if not exists members_search_trgm_idx on public.members using gin (
  (pg_catalog.lower(first_name || ' ' || last_name || ' ' || member_number || ' ' || email::text)) extensions.gin_trgm_ops
);
create index if not exists plans_active_idx on public.plans (is_active, name);
create index if not exists memberships_member_dates_idx on public.memberships (member_id, start_date desc, end_date desc);
create index if not exists memberships_member_state_dates_idx on public.memberships (member_id, state, start_date, end_date);
create index if not exists memberships_plan_id_idx on public.memberships (plan_id);
create index if not exists memberships_due_idx on public.memberships (amount_due) where amount_due > 0;
create index if not exists payments_membership_paid_at_idx on public.payments (membership_id, paid_at desc);
create index if not exists payments_paid_at_idx on public.payments (paid_at desc);
create unique index if not exists member_invitations_open_member_key on public.member_invitations (member_id) where status in ('pending', 'sent', 'failed');
create index if not exists member_invitations_status_requested_idx on public.member_invitations (status, requested_at desc);
create index if not exists member_invitations_email_idx on public.member_invitations (email);
create index if not exists qr_passes_member_expiry_idx on public.qr_passes (member_id, expires_at desc);
create index if not exists qr_passes_cleanup_idx on public.qr_passes (expires_at) where used_at is null and revoked_at is null;
create index if not exists check_ins_member_checked_at_idx on public.check_ins (member_id, checked_in_at desc);
create index if not exists check_ins_admitted_checked_at_idx on public.check_ins (checked_in_at desc) where admitted;
create index if not exists notices_published_at_idx on public.notices (published_at desc);
create index if not exists notice_deliveries_member_delivered_idx on public.notice_deliveries (member_id, delivered_at desc);
create index if not exists notice_deliveries_unread_idx on public.notice_deliveries (member_id, delivered_at desc) where read_at is null;
create index if not exists activity_log_member_occurred_idx on public.activity_log (member_id, occurred_at desc);
create index if not exists activity_log_occurred_idx on public.activity_log (occurred_at desc);

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.plans enable row level security;
alter table public.club_config enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.member_invitations enable row level security;
alter table public.qr_passes enable row level security;
alter table public.check_ins enable row level security;
alter table public.notices enable row level security;
alter table public.notice_deliveries enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists members_admin_read on public.members;
create policy members_admin_read on public.members for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists members_own_read on public.members;
create policy members_own_read on public.members for select to authenticated using ((select auth.uid()) = auth_user_id);

drop policy if exists plans_admin_read on public.plans;
create policy plans_admin_read on public.plans for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists plans_active_read on public.plans;
create policy plans_active_read on public.plans for select to authenticated using (is_active);

drop policy if exists club_config_authenticated_read on public.club_config;
create policy club_config_authenticated_read on public.club_config for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists memberships_admin_read on public.memberships;
create policy memberships_admin_read on public.memberships for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists memberships_own_read on public.memberships;
create policy memberships_own_read on public.memberships for select to authenticated using (member_id = (select public.current_member_id()));

drop policy if exists payments_admin_read on public.payments;
create policy payments_admin_read on public.payments for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists payments_own_read on public.payments;
create policy payments_own_read on public.payments for select to authenticated using (
  exists (
    select 1 from public.memberships as ms
    where ms.id = payments.membership_id and ms.member_id = (select public.current_member_id())
  )
);

drop policy if exists member_invitations_admin_read on public.member_invitations;
create policy member_invitations_admin_read on public.member_invitations for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists member_invitations_own_read on public.member_invitations;
create policy member_invitations_own_read on public.member_invitations for select to authenticated using (member_id = (select public.current_member_id()));

drop policy if exists check_ins_admin_read on public.check_ins;
create policy check_ins_admin_read on public.check_ins for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists check_ins_own_read on public.check_ins;
create policy check_ins_own_read on public.check_ins for select to authenticated using (member_id = (select public.current_member_id()));

drop policy if exists notices_admin_read on public.notices;
create policy notices_admin_read on public.notices for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists notices_delivered_read on public.notices;
create policy notices_delivered_read on public.notices for select to authenticated using (
  exists (
    select 1 from public.notice_deliveries as nd
    where nd.notice_id = notices.id and nd.member_id = (select public.current_member_id())
  )
);

drop policy if exists notice_deliveries_admin_read on public.notice_deliveries;
create policy notice_deliveries_admin_read on public.notice_deliveries for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists notice_deliveries_own_read on public.notice_deliveries;
create policy notice_deliveries_own_read on public.notice_deliveries for select to authenticated using (member_id = (select public.current_member_id()));

drop policy if exists activity_log_admin_read on public.activity_log;
create policy activity_log_admin_read on public.activity_log for select to authenticated using ((select public.current_user_is_admin()));
drop policy if exists activity_log_own_read on public.activity_log;
create policy activity_log_own_read on public.activity_log for select to authenticated using (member_id = (select public.current_member_id()));

revoke all on table
  public.profiles,
  public.members,
  public.plans,
  public.club_config,
  public.memberships,
  public.payments,
  public.member_invitations,
  public.qr_passes,
  public.check_ins,
  public.notices,
  public.notice_deliveries,
  public.activity_log
from public, anon, authenticated, service_role;

revoke all on sequence public.member_number_sequence, public.receipt_number_sequence from public, anon, authenticated, service_role;

alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::pg_catalog.regprocedure as signature
    from pg_catalog.pg_proc as p
    inner join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'next_receipt_number',
        'set_updated_at',
        'reject_append_only_mutation',
        'current_user_is_admin',
        'current_member_id',
        'membership_status',
        'member_admission',
        'create_member_invitation',
        'finalize_member_invitation',
        'mark_member_invitation_failed',
        'complete_member_onboarding',
        'renew_membership',
        'set_membership_state',
        'check_in_member',
        'issue_qr_pass',
        'check_in_by_qr',
        'publish_notice',
        'mark_notice_read',
        'admin_dashboard',
        'search_members',
        'member_detail'
      ])
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_function.signature
    );
  end loop;
end;
$$;

grant usage on schema public to authenticated, service_role;

grant select (id, role, account_state, must_set_password, display_name, created_at, updated_at)
on public.profiles to authenticated;
grant select (id, member_number, first_name, last_name, email, phone, auth_user_id, created_at, updated_at)
on public.members to authenticated;
grant select on public.plans, public.club_config, public.memberships, public.payments, public.member_invitations, public.check_ins, public.notices, public.notice_deliveries, public.activity_log
to authenticated;

grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_member_id() to authenticated;
grant execute on function public.membership_status(text, date, date, numeric, date, date) to authenticated;
grant execute on function public.create_member_invitation(text, text, text, text, date, text, text, text, text, uuid, date, numeric, text) to authenticated;
grant execute on function public.complete_member_onboarding() to authenticated;
grant execute on function public.renew_membership(uuid, uuid, date, numeric, text) to authenticated;
grant execute on function public.set_membership_state(uuid, text, date, text) to authenticated;
grant execute on function public.check_in_member(uuid, text) to authenticated;
grant execute on function public.issue_qr_pass() to authenticated;
grant execute on function public.check_in_by_qr(text, text) to authenticated;
grant execute on function public.publish_notice(text, text, text, text, boolean) to authenticated;
grant execute on function public.mark_notice_read(uuid) to authenticated;
grant execute on function public.admin_dashboard(date) to authenticated;
grant execute on function public.search_members(text, integer, integer) to authenticated;
grant execute on function public.member_detail(uuid) to authenticated;

grant execute on function public.finalize_member_invitation(uuid, uuid) to service_role;
grant execute on function public.mark_member_invitation_failed(uuid, text) to service_role;

commit;
