-- A renewal remains its own immutable term/payment for audit, but member
-- entitlement is the last day covered by every non-cancelled current/queued
-- term. Member UI uses this date for the days-left ring and card validity, so
-- buying another month immediately adds those days without rewriting history.

create or replace function public.member_access_through(p_member_id uuid, p_as_of date default public.club_today())
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max(public.effective_membership_end(
    ms.end_date,
    ms.frozen_days,
    ms.state,
    ms.pause_started_on,
    ms.pause_until,
    p_as_of
  ))
  from public.memberships as ms
  where ms.member_id = p_member_id
    and ms.state in ('active','paused')
    and public.effective_membership_end(
      ms.end_date,
      ms.frozen_days,
      ms.state,
      ms.pause_started_on,
      ms.pause_until,
      p_as_of
    ) >= p_as_of;
$$;
revoke all on function public.member_access_through(uuid,date) from public,anon,authenticated,service_role;

create or replace function public.my_member_detail()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.current_member_id();
  v_gender text;
begin
  if v_member_id is null then
    raise exception 'A member account is required' using errcode = '42501';
  end if;
  select m.gender into v_gender from public.members as m where m.id = v_member_id;
  return public.member_detail(v_member_id) || pg_catalog.jsonb_build_object(
    'gender', v_gender,
    'access_through', public.member_access_through(v_member_id, public.club_today())
  );
end;
$$;
revoke all on function public.my_member_detail() from public,anon,authenticated,service_role;
grant execute on function public.my_member_detail() to authenticated;

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
  if not found then return null; end if;

  select m.member_number into v_replacement from public.members as m where m.id = v_member.reenrolled_as;
  return public.member_detail(v_member.id) || pg_catalog.jsonb_build_object(
    'gender', v_member.gender,
    'reenrolled_as_member_number', v_replacement,
    'access_through', public.member_access_through(v_member.id, public.club_today())
  );
end;
$$;
revoke all on function public.member_detail_by_number(text) from public,anon,authenticated,service_role;
grant execute on function public.member_detail_by_number(text) to authenticated;
