begin;

drop function if exists public.search_members(text, integer, integer);

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

create or replace function public.claim_member_invitation_resend(p_invitation_id uuid)
returns table (
  outcome text,
  invitation_id uuid,
  email text,
  auth_user_id uuid,
  send_attempts integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation public.member_invitations%rowtype;
begin
  if not public.current_user_is_admin() then
    outcome := 'not_authorized';
    invitation_id := p_invitation_id;
    email := null;
    auth_user_id := null;
    send_attempts := 0;
    return next;
    return;
  end if;

  select * into v_invitation
  from public.member_invitations as i
  where i.id = p_invitation_id
  for update;

  if not found then
    outcome := 'not_found';
    invitation_id := p_invitation_id;
    email := null;
    auth_user_id := null;
    send_attempts := 0;
    return next;
    return;
  end if;

  if v_invitation.status not in ('pending', 'failed', 'sent') or v_invitation.expires_at <= pg_catalog.now() then
    outcome := 'not_eligible';
    invitation_id := v_invitation.id;
    email := null;
    auth_user_id := null;
    send_attempts := v_invitation.attempts;
    return next;
    return;
  end if;

  if v_invitation.last_attempt_at is not null
    and v_invitation.last_attempt_at > pg_catalog.now() - pg_catalog.make_interval(secs => 60) then
    outcome := 'retry_too_soon';
    invitation_id := v_invitation.id;
    email := null;
    auth_user_id := null;
    send_attempts := v_invitation.attempts;
    return next;
    return;
  end if;

  if v_invitation.attempts >= 5 then
    outcome := 'attempt_limit';
    invitation_id := v_invitation.id;
    email := null;
    auth_user_id := null;
    send_attempts := v_invitation.attempts;
    return next;
    return;
  end if;

  update public.member_invitations
  set
    attempts = public.member_invitations.attempts + 1,
    last_attempt_at = pg_catalog.now(),
    last_error = null
  where id = v_invitation.id
  returning public.member_invitations.attempts into send_attempts;

  outcome := 'claimed';
  invitation_id := v_invitation.id;
  email := v_invitation.email::text;
  auth_user_id := v_invitation.auth_user_id;
  return next;
end;
$$;

create or replace function public.member_invitation_auth_user(p_invitation_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'The service role is required' using errcode = '42501';
  end if;

  select i.auth_user_id into v_auth_user_id
  from public.member_invitations as i
  where i.id = p_invitation_id;

  return v_auth_user_id;
end;
$$;

create or replace function public.active_admin_profiles()
returns table (id uuid, display_name text, must_set_password boolean, account_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.must_set_password, p.account_state
  from public.profiles as p
  where p.role = 'admin' and p.account_state = 'active';
$$;

create or replace function public.bootstrap_admin_profile(
  p_auth_user_id uuid,
  p_display_name text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_app_role text;
  v_other_active_admins integer;
  v_profile public.profiles%rowtype;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'The service role is required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_display_name, ''))) not between 1 and 120 then
    raise exception 'A display name between 1 and 120 characters is required' using errcode = '22023';
  end if;

  select u.raw_app_meta_data ->> 'role'
  into v_app_role
  from auth.users as u
  where u.id = p_auth_user_id;

  if v_app_role is null then
    raise exception 'Auth user not found' using errcode = 'P0002';
  end if;

  select * into v_profile from public.profiles as p where p.id = p_auth_user_id for update;

  if v_profile.id is not null and v_profile.role <> 'admin' then
    return 'conflict_role';
  end if;

  if v_app_role <> 'admin' and (v_profile.id is null or v_profile.account_state <> 'active') then
    return 'conflict_role';
  end if;

  select pg_catalog.count(*) into v_other_active_admins
  from public.profiles as p
  where p.role = 'admin' and p.account_state = 'active' and p.id <> p_auth_user_id;

  if v_other_active_admins > 0 then
    return 'conflict_other_admin';
  end if;

  if v_profile.id is not null
    and v_profile.role = 'admin'
    and v_profile.account_state = 'active'
    and v_profile.must_set_password = false then
    return 'already_active';
  end if;

  insert into public.profiles (id, role, account_state, must_set_password, display_name)
  values (p_auth_user_id, 'admin', 'invited', true, pg_catalog.btrim(p_display_name))
  on conflict (id) do update
  set
    role = 'admin',
    account_state = case when public.profiles.account_state = 'suspended' then 'suspended' else 'invited' end,
    must_set_password = true,
    display_name = excluded.display_name;

  return 'created';
end;
$$;

alter table public.activity_log drop constraint if exists activity_log_kind_check;
alter table public.activity_log
  add constraint activity_log_kind_check check (
    kind in (
      'member_created', 'invitation_sent', 'invitation_failed', 'onboarding_completed',
      'membership_started', 'membership_renewed', 'membership_state_changed',
      'check_in', 'notice_published', 'profile_updated'
    )
  );

create or replace function public.update_member_profile(
  p_first_name text,
  p_phone text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_national_id text default null,
  p_address text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.current_member_id();
begin
  if v_member_id is null then
    raise exception 'A member account is required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_first_name, ''))) not between 1 and 80 then
    raise exception 'First name is required' using errcode = '22023';
  end if;
  if p_phone is not null and pg_catalog.char_length(pg_catalog.btrim(p_phone)) not between 7 and 32 then
    raise exception 'Phone must be between 7 and 32 characters' using errcode = '22023';
  end if;
  if p_emergency_contact_name is not null
    and pg_catalog.char_length(pg_catalog.btrim(p_emergency_contact_name)) not between 1 and 160 then
    raise exception 'Emergency contact name must be between 1 and 160 characters' using errcode = '22023';
  end if;
  if p_emergency_contact_phone is not null
    and pg_catalog.char_length(pg_catalog.btrim(p_emergency_contact_phone)) not between 7 and 32 then
    raise exception 'Emergency contact phone must be between 7 and 32 characters' using errcode = '22023';
  end if;
  if p_national_id is not null
    and pg_catalog.char_length(pg_catalog.btrim(p_national_id)) not between 4 and 64 then
    raise exception 'National ID must be between 4 and 64 characters' using errcode = '22023';
  end if;
  if p_address is not null and pg_catalog.char_length(pg_catalog.btrim(p_address)) not between 1 and 500 then
    raise exception 'Address must be between 1 and 500 characters' using errcode = '22023';
  end if;

  update public.members
  set
    first_name = pg_catalog.btrim(p_first_name),
    phone = nullif(pg_catalog.btrim(p_phone), ''),
    emergency_contact_name = nullif(pg_catalog.btrim(p_emergency_contact_name), ''),
    emergency_contact_phone = nullif(pg_catalog.btrim(p_emergency_contact_phone), ''),
    national_id = nullif(pg_catalog.btrim(p_national_id), ''),
    address = nullif(pg_catalog.btrim(p_address), '')
  where id = v_member_id;

  insert into public.activity_log (member_id, actor_profile_id, kind, description)
  values (v_member_id, (select auth.uid()), 'profile_updated', 'Member profile details updated');

  return v_member_id;
end;
$$;

create or replace function public.my_member_detail()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.current_member_id();
begin
  if v_member_id is null then
    raise exception 'A member account is required' using errcode = '42501';
  end if;

  return public.member_detail(v_member_id);
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
    'expired_members', (select pg_catalog.count(*) from member_statuses where status = 'expired'),
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
    ),
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

drop function if exists public.renew_membership(uuid, uuid, date, numeric, text);

create function public.renew_membership(
  p_member_id uuid,
  p_plan_id uuid,
  p_start_date date default null,
  p_amount_paid numeric default null,
  p_payment_method text default null
)
returns table (
  membership_id uuid,
  payment_id uuid,
  receipt_number text,
  start_date date,
  end_date date,
  amount_due numeric,
  status text
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
  v_start_date date;
  v_end_date date;
  v_amount_due numeric(12, 2);
  v_membership_id uuid;
  v_payment_id uuid;
  v_receipt_number text;
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
    returning id, public.payments.receipt_number into v_payment_id, v_receipt_number;
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
  receipt_number := v_receipt_number;
  start_date := v_start_date;
  end_date := v_end_date;
  amount_due := v_amount_due;
  status := public.membership_status('active', v_start_date, v_end_date, v_amount_due, null, current_date);
  return next;
end;
$$;

drop function if exists public.check_in_by_qr(text, text);

create function public.check_in_by_qr(
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
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if p_reception not in ('A', 'B') then
    raise exception 'Reception must be A or B' using errcode = '22023';
  end if;

  v_as_of := pg_catalog.timezone('Africa/Cairo', v_now)::date;

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

  select m.member_number, m.first_name, m.last_name
  into member_number, first_name, last_name
  from public.members as m
  where m.id = v_resolved_member_id;

  if v_membership_id is not null then
    select ms.plan_name_snapshot, ms.end_date
    into plan_name, end_date
    from public.memberships as ms
    where ms.id = v_membership_id;
  end if;

  if end_date is not null then
    days_left := case
      when end_date < v_as_of then 0
      else (end_date - v_as_of)
    end;
  else
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

create or replace function public.sync_member_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email is distinct from new.email then
    update public.members as m
    set email = pg_catalog.lower(pg_catalog.btrim(new.email))::extensions.citext
    where m.auth_user_id = new.id
      and not exists (
        select 1
        from public.members as other
        where other.id <> m.id
          and other.email = pg_catalog.lower(pg_catalog.btrim(new.email))::extensions.citext
      );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_member_email();

revoke all on function public.claim_member_invitation_resend(uuid) from public, anon, authenticated, service_role;
revoke all on function public.member_invitation_auth_user(uuid) from public, anon, authenticated, service_role;
revoke all on function public.active_admin_profiles() from public, anon, authenticated, service_role;
revoke all on function public.bootstrap_admin_profile(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.update_member_profile(text, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.my_member_detail() from public, anon, authenticated, service_role;
revoke all on function public.member_detail(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_dashboard(date) from public, anon, authenticated, service_role;
revoke all on function public.renew_membership(uuid, uuid, date, numeric, text) from public, anon, authenticated, service_role;
revoke all on function public.check_in_by_qr(text, text) from public, anon, authenticated, service_role;
revoke all on function public.sync_member_email() from public, anon, authenticated, service_role;

grant execute on function public.search_members(text, integer, integer, text) to authenticated;
grant execute on function public.claim_member_invitation_resend(uuid) to authenticated;
grant execute on function public.update_member_profile(text, text, text, text, text, text) to authenticated;
grant execute on function public.my_member_detail() to authenticated;
grant execute on function public.member_detail(uuid) to authenticated;
grant execute on function public.admin_dashboard(date) to authenticated;
grant execute on function public.renew_membership(uuid, uuid, date, numeric, text) to authenticated;
grant execute on function public.check_in_by_qr(text, text) to authenticated;

grant execute on function public.member_invitation_auth_user(uuid) to service_role;
grant execute on function public.active_admin_profiles() to service_role;
grant execute on function public.bootstrap_admin_profile(uuid, text) to service_role;

commit;
