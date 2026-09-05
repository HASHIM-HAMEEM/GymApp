-- Mark all unread notice deliveries as read for the current member.
-- Persists across logins/refreshes because read_at is stored in notice_deliveries.
-- SECURITY DEFINER so the member only touches their own deliveries.

create or replace function public.mark_all_notices_read()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.current_member_id();
  v_count integer;
begin
  if v_member_id is null then
    raise exception 'A member account is required' using errcode = '42501';
  end if;

  update public.notice_deliveries as nd
  set read_at = coalesce(nd.read_at, pg_catalog.now())
  where nd.member_id = v_member_id
    and nd.read_at is null
    and exists (
      select 1 from public.notices as n
      where n.id = nd.notice_id and n.deleted_at is null
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_all_notices_read() to authenticated;
