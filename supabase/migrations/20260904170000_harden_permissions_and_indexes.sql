begin;

revoke all on function public.search_members(text, integer, integer, text)
from public, anon, service_role;
grant execute on function public.search_members(text, integer, integer, text)
to authenticated;

revoke all on function public.rls_auto_enable()
from public, anon, authenticated, service_role;

create index if not exists activity_log_actor_profile_id_idx
  on public.activity_log (actor_profile_id);
create index if not exists check_ins_checked_in_by_idx
  on public.check_ins (checked_in_by);
create index if not exists check_ins_membership_id_idx
  on public.check_ins (membership_id);
create index if not exists member_invitations_invited_by_idx
  on public.member_invitations (invited_by);
create index if not exists memberships_created_by_idx
  on public.memberships (created_by);
create index if not exists memberships_supersedes_membership_id_idx
  on public.memberships (supersedes_membership_id);
create index if not exists notices_author_id_idx
  on public.notices (author_id);
create index if not exists payments_recorded_by_idx
  on public.payments (recorded_by);

drop policy if exists activity_log_admin_read on public.activity_log;
drop policy if exists activity_log_own_read on public.activity_log;
create policy activity_log_read on public.activity_log
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or member_id = (select public.current_member_id())
  );

drop policy if exists check_ins_admin_read on public.check_ins;
drop policy if exists check_ins_own_read on public.check_ins;
create policy check_ins_read on public.check_ins
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or member_id = (select public.current_member_id())
  );

drop policy if exists member_invitations_admin_read on public.member_invitations;
drop policy if exists member_invitations_own_read on public.member_invitations;
create policy member_invitations_read on public.member_invitations
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or member_id = (select public.current_member_id())
  );

drop policy if exists members_admin_read on public.members;
drop policy if exists members_own_read on public.members;
create policy members_read on public.members
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or auth_user_id = (select auth.uid())
  );

drop policy if exists memberships_admin_read on public.memberships;
drop policy if exists memberships_own_read on public.memberships;
create policy memberships_read on public.memberships
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or member_id = (select public.current_member_id())
  );

drop policy if exists notice_deliveries_admin_read on public.notice_deliveries;
drop policy if exists notice_deliveries_own_read on public.notice_deliveries;
create policy notice_deliveries_read on public.notice_deliveries
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or member_id = (select public.current_member_id())
  );

drop policy if exists notices_admin_read on public.notices;
drop policy if exists notices_delivered_read on public.notices;
create policy notices_read on public.notices
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or exists (
      select 1
      from public.notice_deliveries as nd
      where nd.notice_id = notices.id
        and nd.member_id = (select public.current_member_id())
    )
  );

drop policy if exists payments_admin_read on public.payments;
drop policy if exists payments_own_read on public.payments;
create policy payments_read on public.payments
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or exists (
      select 1
      from public.memberships as ms
      where ms.id = payments.membership_id
        and ms.member_id = (select public.current_member_id())
    )
  );

drop policy if exists plans_active_read on public.plans;
drop policy if exists plans_admin_read on public.plans;
create policy plans_read on public.plans
  for select to authenticated
  using (is_active or (select public.current_user_is_admin()));

drop policy if exists profiles_admin_read on public.profiles;
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or id = (select auth.uid())
  );

create policy qr_passes_no_direct_access on public.qr_passes
  as restrictive
  for all to authenticated
  using (false)
  with check (false);

commit;
