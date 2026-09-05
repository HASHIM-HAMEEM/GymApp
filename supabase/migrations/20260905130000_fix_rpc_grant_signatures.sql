-- ---------------------------------------------------------------------
-- Grant signature corrections.
--
-- Bug 1: the foundation migration's grant for create_member_invitation
-- listed 14 argument types (extra `text` between p_address and p_plan_id),
-- which matched no overload — authenticated could not call the RPC.
-- The final function signature (recreated in the India migration) is
-- (text, text, text, text, date, text, text, text, text, uuid, date, numeric, text).
--
-- Bug 2: renew_membership was recreated with a 6th parameter (p_request_id)
-- in the India migration, but the earlier 5-parameter grant statements
-- do not match the final signature. The DROP FUNCTION in the India
-- migration removes the old overload, so those grants are inert — but
-- we re-grant explicitly here with the correct 6-type signature so the
-- permission is unambiguous and survives future migrations.
--
-- These corrections are idempotent: REVOKE first, then GRANT.
-- ---------------------------------------------------------------------

-- create_member_invitation: the foundation migration's grant listed 14
-- argument types (an extra `text`), which matched no overload.  The
-- corrected 13-type grant is applied here.  The malformed grant is
-- harmless (it targets a non-existent overload) so we do not need to
-- revoke it — but we revoke the correct signature first to make the
-- grant idempotent across re-runs.
revoke all on function public.create_member_invitation(
  text, text, text, text, date, text, text, text, text, uuid, date, numeric, text
) from authenticated;

grant execute on function public.create_member_invitation(
  text, text, text, text, date, text, text, text, text, uuid, date, numeric, text
) to authenticated;

-- renew_membership: the India migration already dropped the old 5-param
-- overload and granted the final 6-param signature.  We re-grant here
-- to make the permission explicit and idempotent across re-runs.
revoke all on function public.renew_membership(uuid, uuid, date, numeric, text, text) from authenticated;

grant execute on function public.renew_membership(uuid, uuid, date, numeric, text, text) to authenticated;
