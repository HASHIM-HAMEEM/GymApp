drop function if exists public.activate_admin_profile(uuid);

revoke all on function public.mark_all_notices_read() from public, anon;
grant execute on function public.mark_all_notices_read() to authenticated;

alter function public.effective_membership_end(date, integer, text, date, date, date)
  set search_path = '';
alter function public.planned_membership_end(date, integer, text, date, date)
  set search_path = '';

drop policy if exists club_config_authenticated_read on public.club_config;

drop policy if exists upi_payment_requests_member_read on public.upi_payment_requests;
drop policy if exists upi_payment_requests_admin_read on public.upi_payment_requests;
drop policy if exists upi_payment_requests_authenticated_read on public.upi_payment_requests;
create policy upi_payment_requests_authenticated_read
on public.upi_payment_requests
for select
to authenticated
using (
  public.current_user_is_admin()
  or member_id = public.current_member_id()
);

create index if not exists members_removed_by_idx
  on public.members(removed_by)
  where removed_by is not null;
create index if not exists membership_freezes_created_by_idx
  on public.membership_freezes(created_by);
create index if not exists upi_payment_requests_membership_idx
  on public.upi_payment_requests(membership_id)
  where membership_id is not null;
create index if not exists upi_payment_requests_plan_idx
  on public.upi_payment_requests(plan_id)
  where plan_id is not null;
create index if not exists upi_payment_requests_reviewed_by_idx
  on public.upi_payment_requests(reviewed_by)
  where reviewed_by is not null;
create index if not exists upi_payment_requests_confirmed_membership_idx
  on public.upi_payment_requests(confirmed_membership_id)
  where confirmed_membership_id is not null;
create index if not exists upi_payment_requests_confirmed_payment_idx
  on public.upi_payment_requests(confirmed_payment_id)
  where confirmed_payment_id is not null;
