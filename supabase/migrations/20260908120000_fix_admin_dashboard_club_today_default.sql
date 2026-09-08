-- ---------------------------------------------------------------------
-- admin_dashboard: evaluate club_today() inside the SECURITY DEFINER
-- body instead of a default argument.
--
-- Default argument expressions are evaluated with the CALLER's
-- permissions. The India migration revoked EXECUTE on club_today()
-- from authenticated ("internal helpers stay RPC-only"), so the
-- `p_as_of date default public.club_today()` signature made every
-- no-argument admin_dashboard() call fail with
-- `permission denied for function club_today`.
--
-- Computing the date inside the body runs with the function owner's
-- permissions, so no extra grant on club_today is needed.
-- ---------------------------------------------------------------------

create or replace function public.admin_dashboard(p_as_of date default null)
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

  p_as_of := coalesce(p_as_of, public.club_today());

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

revoke all on function public.admin_dashboard(date) from public, anon, authenticated;
grant execute on function public.admin_dashboard(date) to authenticated;
