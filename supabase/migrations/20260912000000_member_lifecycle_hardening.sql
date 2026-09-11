-- Member lifecycle hardening
--
-- 1. Write guards: removed members must never receive new memberships,
--    payments, or check-ins. Triggers cover every code path (renewal RPC,
--    UPI approval, settle/waive, desk + QR check-in, direct inserts).
-- 2. remove_member: cancel memberships/invitations/QR BEFORE marking the
--    member removed so the new guards do not block the removal itself.
-- 3. restore_member: undo a removal — clears the removed flag, reactivates
--    the profile, and reopens the invitation when the member never onboarded.
-- 4. search_members: p_status='removed' lists removed members so admins can
--    find and restore them.
-- 5. member_detail: include removed_at so the admin UI can render a Removed
--    state instead of live action buttons.
-- 6. create_member_invitation: clear errors when the email already belongs to
--    an active or removed member instead of a raw unique-violation.

-- ---------------------------------------------------------------------
-- 1. Removed-member write guards
-- ---------------------------------------------------------------------
create or replace function public.guard_removed_member_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if tg_table_name = 'memberships' or tg_table_name = 'check_ins'
     or tg_table_name = 'member_invitations' or tg_table_name = 'qr_passes'
     or tg_table_name = 'notice_deliveries' or tg_table_name = 'upi_payment_requests' then
    v_member_id := new.member_id;
  elsif tg_table_name = 'payments' then
    select ms.member_id into v_member_id from public.memberships as ms where ms.id = new.membership_id;
  elsif tg_table_name = 'membership_freezes' then
    select ms.member_id into v_member_id from public.memberships as ms where ms.id = new.membership_id;
  end if;

  if v_member_id is not null
     and exists (select 1 from public.members as m where m.id = v_member_id and m.removed_at is not null) then
    raise exception 'Member has been removed' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_removed_member_guard on public.memberships;
create trigger memberships_removed_member_guard
  before insert or update on public.memberships
  for each row execute function public.guard_removed_member_write();

drop trigger if exists payments_removed_member_guard on public.payments;
create trigger payments_removed_member_guard
  before insert or update on public.payments
  for each row execute function public.guard_removed_member_write();

drop trigger if exists check_ins_removed_member_guard on public.check_ins;
create trigger check_ins_removed_member_guard
  before insert on public.check_ins
  for each row execute function public.guard_removed_member_write();

drop trigger if exists member_invitations_removed_member_guard on public.member_invitations;
create trigger member_invitations_removed_member_guard
  before insert on public.member_invitations
  for each row execute function public.guard_removed_member_write();

drop trigger if exists qr_passes_removed_member_guard on public.qr_passes;
create trigger qr_passes_removed_member_guard
  before insert on public.qr_passes
  for each row execute function public.guard_removed_member_write();

drop trigger if exists notice_deliveries_removed_member_guard on public.notice_deliveries;
create trigger notice_deliveries_removed_member_guard
  before insert on public.notice_deliveries
  for each row execute function public.guard_removed_member_write();

drop trigger if exists upi_payment_requests_removed_member_guard on public.upi_payment_requests;
create trigger upi_payment_requests_removed_member_guard
  before insert on public.upi_payment_requests
  for each row execute function public.guard_removed_member_write();

drop trigger if exists membership_freezes_removed_member_guard on public.membership_freezes;
create trigger membership_freezes_removed_member_guard
  before insert on public.membership_freezes
  for each row execute function public.guard_removed_member_write();

-- ---------------------------------------------------------------------
-- 2. remove_member: mark removed LAST so its own membership cancellation
--    passes the guard trigger.
-- ---------------------------------------------------------------------
create or replace function public.remove_member(p_member_id uuid, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_auth_user uuid;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if not exists(select 1 from public.members where id=p_member_id and removed_at is null) then
    raise exception 'Member not found' using errcode='P0002';
  end if;
  update public.memberships set state='cancelled',updated_at=pg_catalog.now() where member_id=p_member_id and state in ('active','paused');
  update public.member_invitations set status='cancelled',updated_at=pg_catalog.now() where member_id=p_member_id and status not in ('accepted','cancelled');
  update public.qr_passes set revoked_at=coalesce(revoked_at,pg_catalog.now()) where member_id=p_member_id and revoked_at is null;
  update public.members set removed_at=pg_catalog.now(),removed_by=v_actor,removal_reason=nullif(pg_catalog.btrim(p_reason),''),updated_at=pg_catalog.now()
    where id=p_member_id returning auth_user_id into v_auth_user;
  if v_auth_user is not null then
    update public.profiles set account_state='removed',updated_at=pg_catalog.now() where id=v_auth_user;
    update public.push_devices set disabled_at=coalesce(disabled_at,pg_catalog.now()),updated_at=pg_catalog.now() where profile_id=v_auth_user and disabled_at is null;
  end if;
  insert into public.activity_log(member_id,actor_profile_id,kind,description,metadata)
    values(p_member_id,v_actor,'member_removed','Member access removed',pg_catalog.jsonb_build_object('reason',nullif(pg_catalog.btrim(p_reason),'')));
end;
$$;

-- ---------------------------------------------------------------------
-- 3. restore_member
-- ---------------------------------------------------------------------
alter table public.activity_log drop constraint if exists activity_log_kind_check;
alter table public.activity_log add constraint activity_log_kind_check check (kind in (
  'member_created','invitation_sent','invitation_failed','onboarding_completed','membership_started','membership_renewed',
  'membership_state_changed','check_in','notice_published','profile_updated','balance_settled','balance_waived','member_removed','member_restored'
));

create or replace function public.restore_member(p_member_id uuid, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_auth_user uuid;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  update public.members set removed_at=null,removed_by=null,removal_reason=null,updated_at=pg_catalog.now()
    where id=p_member_id and removed_at is not null returning auth_user_id into v_auth_user;
  if not found then raise exception 'Removed member not found' using errcode='P0002'; end if;
  if v_auth_user is not null then
    update public.profiles set account_state='active',updated_at=pg_catalog.now() where id=v_auth_user and account_state='removed';
  else
    -- Never onboarded: reopen the invitation so it can be resent.
    update public.member_invitations
      set status='pending', expires_at=pg_catalog.now() + interval '7 days', updated_at=pg_catalog.now()
      where member_id=p_member_id and status='cancelled' and accepted_at is null;
  end if;
  insert into public.activity_log(member_id,actor_profile_id,kind,description,metadata)
    values(p_member_id,v_actor,'member_restored','Member restored',pg_catalog.jsonb_build_object('reason',nullif(pg_catalog.btrim(p_reason),'')));
end;
$$;
revoke all on function public.restore_member(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.restore_member(uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. search_members: 'removed' filter
-- ---------------------------------------------------------------------
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

  if p_status is not null and p_status not in ('active', 'expiring', 'expired', 'paused', 'due', 'none', 'removed') then
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
    case when m.removed_at is not null then 'removed' else coalesce(current_membership.status, 'none') end,
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
      case when p_status = 'removed' then m.removed_at is not null else m.removed_at is null end
    )
    and (
      v_query = ''
      or pg_catalog.lower(m.first_name || ' ' || m.last_name || ' ' || m.member_number || ' ' || m.email::text) like '%' || v_query || '%'
    )
    and (p_status is null or p_status = 'removed' or coalesce(current_membership.status, 'none') = p_status)
  order by m.last_name, m.first_name, m.member_number
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.search_members(text,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.search_members(text,integer,integer,text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. member_detail: expose removed_at
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
    'removed_at', m.removed_at,
    'removal_reason', m.removal_reason,
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
  )
  into v_result
  from public.members as m
  left join public.profiles as p on p.id = m.auth_user_id
  where m.id = p_member_id;

  if v_result is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;
revoke all on function public.member_detail(uuid) from public,anon,authenticated,service_role;
grant execute on function public.member_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. create_member_invitation: clear duplicate-email errors
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
  p_payment_method text default null,
  p_agreed_price numeric default null,
  p_price_note text default null
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
  v_list_price numeric;
  v_today date := public.club_today();
  v_start_date date;
  v_end_date date;
  v_amount_due numeric(12, 2);
  v_member_id uuid;
  v_member_number text;
  v_membership_id uuid;
  v_payment_id uuid;
  v_invitation_id uuid;
  v_existing public.members%rowtype;
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

  select * into v_existing from public.members as m where m.email = v_email;
  if found then
    if v_existing.removed_at is not null then
      raise exception 'This email belongs to removed member %. Restore them instead of re-inviting.', v_existing.member_number
        using errcode = '23505';
    end if;
    raise exception 'A member already uses this email' using errcode = '23505';
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
    v_list_price := v_plan.price;
    if p_agreed_price is not null then
      if p_agreed_price::text in ('NaN', 'Infinity', '-Infinity')
        or p_agreed_price < 0 or p_agreed_price > 9999999999.99
        or p_agreed_price <> pg_catalog.round(p_agreed_price, 2)
        or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_price_note, ''))) not between 1 and 240 then
        raise exception 'A valid agreed price and pricing reason are required' using errcode = '22023';
      end if;
      v_plan.price := p_agreed_price;
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
      list_price_snapshot,
      pricing_note,
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
      v_list_price,
      nullif(pg_catalog.btrim(p_price_note), ''),
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
revoke all on function public.create_member_invitation(text,text,text,text,date,text,text,text,text,uuid,date,numeric,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.create_member_invitation(text,text,text,text,date,text,text,text,text,uuid,date,numeric,text,numeric,text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. complete_member_onboarding: a removed member must not be able to
--    reactivate their own profile through the set-password flow. The
--    previous version only rejected 'suspended' profiles.
-- ---------------------------------------------------------------------
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

  select * into v_profile
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception 'An application profile is required' using errcode = '42501';
  end if;

  if v_profile.account_state in ('suspended', 'removed') then
    raise exception 'This account is not active. Contact the club administrator.' using errcode = '42501';
  end if;

  select u.email_confirmed_at into v_email_confirmed_at
  from auth.users as u
  where u.id = v_user_id;

  if v_email_confirmed_at is null then
    raise exception 'Email confirmation is required' using errcode = '42501';
  end if;

  if v_profile.role = 'admin' then
    update public.profiles
    set account_state = 'active', must_set_password = false
    where id = v_user_id;
    return v_user_id;
  end if;

  if v_profile.role <> 'member' then
    raise exception 'A member or administrator profile is required' using errcode = '42501';
  end if;

  select m.id into v_member_id
  from public.members as m
  where m.auth_user_id = v_user_id
  for update;

  if not found then
    raise exception 'Member record not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.members as m where m.id = v_member_id and m.removed_at is not null) then
    raise exception 'This account is not active. Contact the club administrator.' using errcode = '42501';
  end if;

  v_should_log := v_profile.must_set_password
    or v_profile.account_state = 'invited';

  update public.profiles
  set account_state = 'active', must_set_password = false
  where id = v_user_id;

  update public.member_invitations
  set
    status = 'accepted',
    accepted_at = coalesce(accepted_at, pg_catalog.now())
  where member_id = v_member_id
    and status = 'sent';

  if v_should_log then
    insert into public.activity_log (
      member_id,
      actor_profile_id,
      kind,
      description
    )
    values (
      v_member_id,
      v_user_id,
      'onboarding_completed',
      'Member completed account onboarding'
    );
  end if;

  return v_member_id;
end;
$$;
revoke all on function public.complete_member_onboarding() from public,anon,authenticated,service_role;
grant execute on function public.complete_member_onboarding() to authenticated;

notify pgrst, 'reload schema';
