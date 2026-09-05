-- ---------------------------------------------------------------------
-- Grant minimization: member_invitations is RPC-only.
-- The broad SELECT grant to authenticated from the foundation migration
-- is revoked; access is already governed by RLS policies and the
-- service-role/admin RPCs (create_member_invitation, finalize_member_invitation,
-- claim_member_invitation_resend, mark_member_invitation_failed, etc.).
-- ---------------------------------------------------------------------
revoke select on public.member_invitations from authenticated;
