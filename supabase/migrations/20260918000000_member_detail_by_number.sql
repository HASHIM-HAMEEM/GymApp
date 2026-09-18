-- Resolve the admin member profile by its public APX/MRD member number in the
-- same RPC that returns the detail. This replaces search_members +
-- member_detail (and the removed-member fallback search) with one round trip.
-- member_detail remains the single source of truth for the returned shape.

create or replace function public.member_detail_by_number(p_member_number text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  select m.id into v_member_id
  from public.members as m
  where m.member_number = pg_catalog.upper(pg_catalog.btrim(coalesce(p_member_number, '')))
  limit 1;

  if v_member_id is null then
    return null;
  end if;
  return public.member_detail(v_member_id);
end;
$$;

revoke all on function public.member_detail_by_number(text) from public, anon, authenticated, service_role;
grant execute on function public.member_detail_by_number(text) to authenticated;
