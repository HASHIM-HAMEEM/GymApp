-- Future catalogue prices and per-member agreed prices. Historic snapshots stay unchanged.
alter table public.memberships add column if not exists list_price_snapshot numeric(12,2);
alter table public.memberships add column if not exists pricing_note text;

create or replace function public.save_membership_plan(
  p_plan_id uuid default null,
  p_name text default null,
  p_months integer default 1,
  p_price numeric default 0,
  p_active boolean default true
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_currency text;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;
  if p_name is null or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 120
    or p_months is null or p_months not between 1 and 120 or p_price is null
    or p_price::text in ('NaN','Infinity','-Infinity') or p_price < 0 or p_price > 9999999999.99
    or p_price <> pg_catalog.round(p_price,2) or p_active is null then
    raise exception 'Enter a valid name, term and price with at most two decimals' using errcode='22023';
  end if;
  if p_plan_id is null then
    select currency into v_currency from public.club_config where id=1;
    insert into public.plans(slug,name,duration_months,price,currency,is_active)
      values ('custom-' || extensions.gen_random_uuid()::text, pg_catalog.btrim(p_name), p_months, p_price, v_currency, p_active)
      returning id into v_id;
  else
    update public.plans set name=pg_catalog.btrim(p_name),duration_months=p_months,price=p_price,is_active=p_active,updated_at=pg_catalog.now()
      where id=p_plan_id returning id into v_id;
    if v_id is null then raise exception 'Plan not found' using errcode='P0002'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_membership_plan(uuid,text,integer,numeric,boolean) from public, anon, authenticated, service_role;
grant execute on function public.save_membership_plan(uuid,text,integer,numeric,boolean) to authenticated;

drop function public.create_member_invitation(text,text,text,text,date,text,text,text,text,uuid,date,numeric,text);
drop function public.renew_membership(uuid,uuid,date,numeric,text,text);
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

create function public.renew_membership(
  p_member_id uuid,
  p_plan_id uuid,
  p_start_date date default null,
  p_amount_paid numeric default null,
  p_payment_method text default null,
  p_request_id text default null,
  p_agreed_price numeric default null,
  p_price_note text default null
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
  v_list_price numeric;
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

    if p_agreed_price is not null then
      v_payload := v_payload || pg_catalog.jsonb_build_object('agreed_price', p_agreed_price, 'price_note', p_price_note);
    end if;

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
      list_price_snapshot,
      pricing_note,
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
      v_list_price,
      nullif(pg_catalog.btrim(p_price_note), ''),
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
revoke all on function public.create_member_invitation(text,text,text,text,date,text,text,text,text,uuid,date,numeric,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.create_member_invitation(text,text,text,text,date,text,text,text,text,uuid,date,numeric,text,numeric,text) to authenticated;
revoke all on function public.renew_membership(uuid,uuid,date,numeric,text,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.renew_membership(uuid,uuid,date,numeric,text,text,numeric,text) to authenticated;
notify pgrst, 'reload schema';
