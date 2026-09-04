begin;

create or replace function public.update_club_config(
  p_name text,
  p_address text,
  p_city text,
  p_phone text,
  p_mon_thu_hours text default null,
  p_fri_hours text default null,
  p_sat_hours text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'Club name must be between 1 and 120 characters' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_address, ''))) not between 1 and 200 then
    raise exception 'Club address must be between 1 and 200 characters' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_city, ''))) not between 1 and 80 then
    raise exception 'Club city must be between 1 and 80 characters' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_phone, ''))) not between 7 and 32 then
    raise exception 'Club phone must be between 7 and 32 characters' using errcode = '22023';
  end if;
  if coalesce(p_mon_thu_hours, '') = '' or coalesce(p_fri_hours, '') = '' or coalesce(p_sat_hours, '') = '' then
    raise exception 'All three opening-hours entries are required' using errcode = '22023';
  end if;

  update public.club_config
  set
    name = pg_catalog.btrim(p_name),
    address = pg_catalog.btrim(p_address),
    city = pg_catalog.btrim(p_city),
    phone = pg_catalog.btrim(p_phone),
    hours = pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('label', 'Mon–Thu', 'value', pg_catalog.btrim(p_mon_thu_hours)),
      pg_catalog.jsonb_build_object('label', 'Fri', 'value', pg_catalog.btrim(p_fri_hours)),
      pg_catalog.jsonb_build_object('label', 'Sat', 'value', pg_catalog.btrim(p_sat_hours))
    )
  where id = 1;

  if not found then
    raise exception 'Club configuration not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.update_admin_profile(
  p_display_name text,
  p_reception text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_display_name, ''))) not between 1 and 120 then
    raise exception 'Display name must be between 1 and 120 characters' using errcode = '22023';
  end if;

  if p_reception is not null and p_reception not in ('A', 'B') then
    raise exception 'Reception must be A or B' using errcode = '22023';
  end if;

  update public.profiles
  set
    display_name = pg_catalog.btrim(p_display_name),
    reception = p_reception
  where id = v_user_id
    and role = 'admin'
    and account_state = 'active';

  if not found then
    raise exception 'Active administrator profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_club_config(text, text, text, text, text, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.update_admin_profile(text, text)
from public, anon, authenticated, service_role;
grant execute on function public.update_club_config(text, text, text, text, text, text, text)
to authenticated;
grant execute on function public.update_admin_profile(text, text)
to authenticated;

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
      when ms.state = 'cancelled' then 3
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
          when ms.state = 'cancelled' then 3
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
        when ms.state = 'cancelled' then 3
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
        when ms.state = 'cancelled' then 3
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

commit;
