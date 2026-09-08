drop function if exists public.claim_pending_push_receipts(integer);

create function public.claim_pending_push_receipts(
  p_limit integer default 100
)
returns table (
  id uuid,
  expo_ticket_id text,
  expo_push_token text,
  notice_id uuid,
  attempts integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;

  return query
  select pr.id, pr.expo_ticket_id, pr.expo_push_token, pr.notice_id, pr.attempts
  from public.push_receipts as pr
  where pr.status = 'pending'
    and pr.expo_ticket_id is not null
    and pr.attempts < 6
    and (pr.last_checked_at is null or pr.last_checked_at <= pg_catalog.now() - interval '2 minutes')
  order by pr.created_at
  limit greatest(1, least(p_limit, 1000));
end;
$$;

revoke all on function public.claim_pending_push_receipts(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_pending_push_receipts(integer) to service_role;
