create or replace function public.claim_member_invitation_resend(p_invitation_id uuid)
returns table (
  outcome text,
  invitation_id uuid,
  email text,
  auth_user_id uuid,
  send_attempts integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation public.member_invitations%rowtype;
begin
  if not public.current_user_is_admin() then
    outcome := 'not_authorized';
    invitation_id := p_invitation_id;
    send_attempts := 0;
    return next;
    return;
  end if;

  select * into v_invitation
  from public.member_invitations as i
  where i.id = p_invitation_id
  for update;

  if not found then
    outcome := 'not_found';
    invitation_id := p_invitation_id;
    send_attempts := 0;
    return next;
    return;
  end if;

  if v_invitation.status not in ('pending', 'failed', 'sent') then
    outcome := 'not_eligible';
    invitation_id := v_invitation.id;
    send_attempts := v_invitation.attempts;
    return next;
    return;
  end if;

  if v_invitation.last_attempt_at is not null
    and v_invitation.last_attempt_at > pg_catalog.now() - interval '60 seconds' then
    outcome := 'retry_too_soon';
    invitation_id := v_invitation.id;
    send_attempts := v_invitation.attempts;
    return next;
    return;
  end if;

  if v_invitation.attempts >= 10 then
    outcome := 'attempt_limit';
    invitation_id := v_invitation.id;
    send_attempts := v_invitation.attempts;
    return next;
    return;
  end if;

  update public.member_invitations
  set
    attempts = public.member_invitations.attempts + 1,
    last_attempt_at = pg_catalog.now(),
    expires_at = greatest(public.member_invitations.expires_at, pg_catalog.now() + interval '24 hours'),
    last_error = null
  where id = v_invitation.id
  returning public.member_invitations.attempts into send_attempts;

  outcome := 'claimed';
  invitation_id := v_invitation.id;
  email := v_invitation.email::text;
  auth_user_id := v_invitation.auth_user_id;
  return next;
end;
$$;

revoke all on function public.claim_member_invitation_resend(uuid) from public, anon, authenticated, service_role;
grant execute on function public.claim_member_invitation_resend(uuid) to authenticated;
