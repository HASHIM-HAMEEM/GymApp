-- Removed members may re-enrol from scratch with the same email and Aadhaar.
-- Historical rows remain removed and retain their memberships, payments,
-- visits and profile data for the audit trail; a brand-new member row, member
-- number, auth account and invitation are created. The removed auth account is
-- retired by the invitation Edge Function before the fresh invite is issued.
--
-- This migration also establishes the APX identifier prefix for new records,
-- stores registration gender and requires a mobile number for new members.

alter table public.members
  add column if not exists gender text not null default 'unspecified',
  add column if not exists reenrolled_as uuid references public.members(id) on delete restrict;

alter table public.members drop constraint if exists members_gender_check;
alter table public.members add constraint members_gender_check
  check (gender in ('male', 'female', 'other', 'prefer_not_to_say', 'unspecified'));

alter table public.members drop constraint if exists members_email_key;
drop index if exists public.members_national_id_key;
create unique index if not exists members_active_email_key
  on public.members (email) where removed_at is null;
create unique index if not exists members_active_national_id_key
  on public.members (national_id) where national_id is not null and removed_at is null;
create index if not exists members_reenrolled_as_idx
  on public.members (reenrolled_as) where reenrolled_as is not null;

alter table public.members drop constraint if exists members_member_number_check;
alter table public.members add constraint members_member_number_check
  check (member_number ~ '^(MRD-[0-9]{4}|APX-[0-9]{6})$');
alter table public.members alter column member_number set default (
  'APX-' || pg_catalog.lpad(
    pg_catalog.nextval('public.member_number_sequence'::pg_catalog.regclass)::text,
    6,
    '0'
  )
);

create or replace function public.next_receipt_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'APX-R-' || pg_catalog.to_char(pg_catalog.clock_timestamp(), 'YYYY') || '-' ||
    pg_catalog.lpad(
      pg_catalog.nextval('public.receipt_number_sequence'::pg_catalog.regclass)::text,
      6,
      '0'
    );
$$;

create or replace function public.guard_member_national_id_unique()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_other public.members%rowtype;
begin
  if new.national_id is null or new.removed_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and old.removed_at is null
    and new.national_id is not distinct from old.national_id then
    return new;
  end if;

  select * into v_other
  from public.members as m
  where m.national_id = new.national_id
    and m.id is distinct from new.id
    and m.removed_at is null
  limit 1;

  if found then
    raise exception '%', 'This Aadhaar number is already registered to member ' || v_other.member_number
      using errcode = '23505';
  end if;
  return new;
end;
$$;

create or replace function public.prepare_removed_member_reenrolment(p_invitation_id uuid)
returns table (auth_user_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_new public.members%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;

  select m.* into v_new
  from public.member_invitations as i
  join public.members as m on m.id = i.member_id
  where i.id = p_invitation_id and m.removed_at is null
  for update of m;
  if not found then
    raise exception 'Active invitation member not found' using errcode = 'P0002';
  end if;

  update public.members as old_member
  set reenrolled_as = v_new.id,
      updated_at = pg_catalog.now()
  where old_member.id <> v_new.id
    and old_member.removed_at is not null
    and old_member.reenrolled_as is null
    and (
      old_member.email = v_new.email
      or (v_new.national_id is not null and old_member.national_id = v_new.national_id)
    );

  return query
  select distinct old_member.auth_user_id
  from public.members as old_member
  where old_member.reenrolled_as = v_new.id
    and old_member.removed_at is not null
    and old_member.auth_user_id is not null;
end;
$$;
revoke all on function public.prepare_removed_member_reenrolment(uuid) from public, anon, authenticated, service_role;
grant execute on function public.prepare_removed_member_reenrolment(uuid) to service_role;

create or replace function public.restore_member(p_member_id uuid, p_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_member public.members%rowtype;
  v_auth_user uuid;
  v_replacement text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator required' using errcode = '42501';
  end if;

  select * into v_member
  from public.members as m
  where m.id = p_member_id and m.removed_at is not null
  for update;
  if not found then
    raise exception 'Removed member not found' using errcode = 'P0002';
  end if;

  if v_member.reenrolled_as is not null then
    select m.member_number into v_replacement from public.members as m where m.id = v_member.reenrolled_as;
    raise exception 'This historical member re-enrolled as % and cannot be restored', coalesce(v_replacement, 'a new account')
      using errcode = '22023';
  end if;
  if exists (select 1 from public.members m where m.id <> v_member.id and m.removed_at is null and m.email = v_member.email) then
    raise exception 'Another active member now uses this email' using errcode = '22023';
  end if;
  if v_member.national_id is not null and exists (
    select 1 from public.members m
    where m.id <> v_member.id and m.removed_at is null and m.national_id = v_member.national_id
  ) then
    raise exception 'Another active member now uses this Aadhaar number' using errcode = '22023';
  end if;

  update public.members
  set removed_at = null,
      removed_by = null,
      removal_reason = null,
      updated_at = pg_catalog.now()
  where id = p_member_id
  returning auth_user_id into v_auth_user;

  if v_auth_user is not null then
    update public.profiles
    set account_state = 'active', updated_at = pg_catalog.now()
    where id = v_auth_user and account_state = 'removed';
  else
    update public.member_invitations
    set status = 'pending',
        expires_at = pg_catalog.now() + interval '7 days',
        updated_at = pg_catalog.now()
    where member_id = p_member_id and status = 'cancelled' and accepted_at is null;
  end if;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (p_member_id, v_actor, 'member_restored', 'Member restored',
          pg_catalog.jsonb_build_object('reason', nullif(pg_catalog.btrim(p_reason), '')));
end;
$$;
revoke all on function public.restore_member(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.restore_member(uuid, text) to authenticated;

create or replace function public.member_detail_by_number(p_member_number text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
  v_replacement text;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  select * into v_member
  from public.members as m
  where m.member_number = pg_catalog.upper(pg_catalog.btrim(coalesce(p_member_number, '')))
  limit 1;
  if not found then
    return null;
  end if;

  select m.member_number into v_replacement
  from public.members as m where m.id = v_member.reenrolled_as;
  return public.member_detail(v_member.id) || pg_catalog.jsonb_build_object(
    'gender', v_member.gender,
    'reenrolled_as_member_number', v_replacement
  );
end;
$$;
revoke all on function public.member_detail_by_number(text) from public, anon, authenticated, service_role;
grant execute on function public.member_detail_by_number(text) to authenticated;

create or replace function public.update_member_email(p_member_id uuid, p_email text)
returns table (member_id uuid, invitation_id uuid, old_email text, new_email text, auth_user_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_member public.members%rowtype;
  v_other public.members%rowtype;
  v_invitation public.member_invitations%rowtype;
  v_email extensions.citext;
  v_state text;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  select * into v_member from public.members as m where m.id = p_member_id for update;
  if not found then raise exception 'Member not found' using errcode = 'P0002'; end if;
  if v_member.removed_at is not null then raise exception 'Member has been removed' using errcode = '22023'; end if;

  select p.account_state into v_state from public.profiles as p where p.id = v_member.auth_user_id;
  if v_state = 'active' or exists (
    select 1 from public.member_invitations as i where i.member_id = v_member.id and i.status = 'accepted'
  ) then
    raise exception 'The sign-in email cannot be changed after the member has activated their account'
      using errcode = '22023';
  end if;

  v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')))::extensions.citext;
  if v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;
  if v_email = v_member.email then
    raise exception 'That is already the member''s email' using errcode = '22023';
  end if;

  select * into v_other
  from public.members as m
  where m.email = v_email and m.id <> v_member.id and m.removed_at is null;
  if found then raise exception 'A member already uses this email' using errcode = '23505'; end if;

  select * into v_invitation
  from public.member_invitations as i
  where i.member_id = v_member.id
  order by i.created_at desc
  limit 1
  for update;

  old_email := v_member.email::text;
  new_email := v_email::text;
  member_id := v_member.id;
  invitation_id := v_invitation.id;
  auth_user_id := v_invitation.auth_user_id;

  update public.members set email = v_email where id = v_member.id;
  if v_invitation.id is not null then
    update public.member_invitations
    set email = v_email,
        status = 'pending',
        last_error = null,
        failed_at = null,
        sent_at = null,
        last_attempt_at = null,
        expires_at = greatest(expires_at, pg_catalog.now() + interval '7 days')
    where id = v_invitation.id;
  end if;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (v_member.id, v_actor, 'profile_updated', 'Sign-in email corrected before activation',
          pg_catalog.jsonb_build_object('old_email', old_email, 'new_email', new_email));
  return next;
end;
$$;
revoke all on function public.update_member_email(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.update_member_email(uuid, text) to authenticated;

drop function if exists public.create_member_invitation(text,text,text,text,date,text,text,text,text,uuid,date,numeric,text,numeric,text);
create function public.create_member_invitation(
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
  p_price_note text default null,
  p_gender text default 'unspecified'
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
  v_phone text;
  v_gender text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_gender, 'unspecified')));
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
  select * into v_existing from public.members as m where m.email = v_email and m.removed_at is null;
  if found then raise exception 'A member already uses this email' using errcode = '23505'; end if;

  v_phone := pg_catalog.btrim(coalesce(p_phone, ''));
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'A valid mobile number in international format is required' using errcode = '22023';
  end if;
  if v_gender not in ('male', 'female', 'other', 'prefer_not_to_say', 'unspecified') then
    raise exception 'Choose a valid gender option' using errcode = '22023';
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
    first_name, last_name, email, phone, gender, date_of_birth,
    emergency_contact_name, emergency_contact_phone, national_id, address, created_by
  ) values (
    pg_catalog.btrim(p_first_name), pg_catalog.btrim(p_last_name), v_email, v_phone, v_gender,
    p_date_of_birth, nullif(pg_catalog.btrim(p_emergency_contact_name), ''),
    nullif(pg_catalog.btrim(p_emergency_contact_phone), ''),
    nullif(pg_catalog.btrim(p_national_id), ''), nullif(pg_catalog.btrim(p_address), ''), v_actor
  )
  returning id, public.members.member_number into v_member_id, v_member_number;

  if p_plan_id is not null then
    select * into v_plan
    from public.plans as p
    where p.id = p_plan_id and p.is_active
    for share;
    if not found then raise exception 'The selected plan is not active' using errcode = '22023'; end if;

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
    if v_end_date is null then raise exception 'The selected plan duration is invalid' using errcode = '22023'; end if;

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
      member_id, plan_id, state, start_date, end_date, amount_due,
      plan_name_snapshot, duration_months_snapshot, price_snapshot,
      list_price_snapshot, pricing_note, currency_snapshot, created_by
    ) values (
      v_member_id, v_plan.id, 'active', v_start_date, v_end_date, v_amount_due,
      v_plan.name, v_plan.duration_months, v_plan.price, v_list_price,
      nullif(pg_catalog.btrim(p_price_note), ''), v_plan.currency, v_actor
    )
    returning id into v_membership_id;

    if p_amount_paid is not null or p_payment_method = 'complimentary' then
      insert into public.payments (membership_id, amount, currency, method, kind, recorded_by)
      values (
        v_membership_id,
        case when p_payment_method = 'complimentary' then 0 else p_amount_paid end,
        v_plan.currency, p_payment_method, 'initial', v_actor
      )
      returning id into v_payment_id;
    end if;
  end if;

  insert into public.member_invitations (member_id, email, invited_by)
  values (v_member_id, v_email, v_actor)
  returning id into v_invitation_id;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (
    v_member_id, v_actor, 'member_created', 'Member created and queued for an email invitation',
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
revoke all on function public.create_member_invitation(text,text,text,text,date,text,text,text,text,uuid,date,numeric,text,numeric,text,text) from public,anon,authenticated,service_role;
grant execute on function public.create_member_invitation(text,text,text,text,date,text,text,text,text,uuid,date,numeric,text,numeric,text,text) to authenticated;

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
  v_phone text := pg_catalog.btrim(coalesce(p_phone, ''));
begin
  if v_member_id is null then raise exception 'A member account is required' using errcode = '42501'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_first_name, ''))) not between 1 and 80 then
    raise exception 'First name is required' using errcode = '22023';
  end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'A valid mobile number in international format is required' using errcode = '22023';
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
  set first_name = pg_catalog.btrim(p_first_name),
      phone = v_phone,
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
revoke all on function public.update_member_profile(text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.update_member_profile(text,text,text,text,text,text) to authenticated;
