-- member_detail is otherwise identical to 20260913010000, with bounded history
-- payloads and total counts for screens that need the complete totals.

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
        'expires_at', i.expires_at,
        'last_error', i.last_error
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
      from (
        select ci.id, ci.source, ci.reception, ci.admitted, ci.verdict, ci.checked_in_at
        from public.check_ins as ci
        where ci.member_id = m.id
        order by ci.checked_in_at desc
        limit 200
      ) as ci
    ), '[]'::jsonb),
    'check_ins_total', (select count(*) from public.check_ins as ci where ci.member_id = m.id),
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
      from (
        select a.id, a.kind, a.description, a.metadata, a.occurred_at, a.actor_profile_id
        from public.activity_log as a
        where a.member_id = m.id
        order by a.occurred_at desc
        limit 40
      ) as a
      left join public.profiles as actor on actor.id = a.actor_profile_id
    ), '[]'::jsonb),
    'activity_total', (select count(*) from public.activity_log as a where a.member_id = m.id)
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
