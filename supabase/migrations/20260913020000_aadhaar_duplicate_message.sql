-- A duplicate Aadhaar used to surface as a bare unique-index violation
-- (members_national_id_key), which the Edge Function and the app could not
-- tell apart from a duplicate email — the admin saw "An account already uses
-- this email" for the wrong field. Raise a precise message first; the unique
-- index remains as the backstop.

create or replace function public.guard_member_national_id_unique()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_other public.members%rowtype;
begin
  if new.national_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.national_id is not distinct from old.national_id then
    return new;
  end if;

  select * into v_other
  from public.members as m
  where m.national_id = new.national_id
    and m.id is distinct from new.id
  limit 1;

  if found then
    raise exception '%',
      'This Aadhaar number is already registered to member ' || v_other.member_number
        || case when v_other.removed_at is not null then ' (removed — restore them instead of re-registering)' else '' end
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists members_national_id_unique_message on public.members;
create trigger members_national_id_unique_message
  before insert or update on public.members
  for each row execute function public.guard_member_national_id_unique();

-- ---------------------------------------------------------------------------
-- Correcting a typo'd email before onboarding.
-- Without this an admin who mistypes the email is stuck: the invitation can
-- never be accepted, and the (correct, unique) Aadhaar blocks creating the
-- member again. Only allowed while the member has NOT completed onboarding
-- and is not removed. The invitation row is retargeted and reset so the
-- normal Resend path delivers to the corrected address. Returns the auth user
-- currently linked to the invitation (if any) so the Edge Function can move
-- the auth account's email as well; the sign-in email itself stays
-- immutable once the member has onboarded.
-- ---------------------------------------------------------------------------
create or replace function public.update_member_email(p_member_id uuid, p_email text)
returns table (member_id uuid, invitation_id uuid, old_email text, new_email text, auth_user_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_member public.members%rowtype;
  v_other public.members%rowtype;
  v_invitation public.member_invitations%rowtype;
  v_email extensions.citext;
  v_state text;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  select * into v_member from public.members as m where m.id = p_member_id for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_member.removed_at is not null then
    raise exception 'Member has been removed' using errcode = '22023';
  end if;

  select p.account_state into v_state
  from public.profiles as p where p.id = v_member.auth_user_id;
  if v_state = 'active' or exists (
    select 1 from public.member_invitations as i
    where i.member_id = v_member.id and i.status = 'accepted'
  ) then
    raise exception 'The sign-in email cannot be changed after the member has activated their account'
      using errcode = '22023';
  end if;

  v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')))::extensions.citext;
  if v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;
  if v_email = v_member.email then
    raise exception 'That is already the member''s email' using errcode = '22023';
  end if;

  select * into v_other from public.members as m where m.email = v_email and m.id <> v_member.id;
  if found then
    if v_other.removed_at is not null then
      raise exception 'This email belongs to removed member %. Restore them instead.', v_other.member_number
        using errcode = '23505';
    end if;
    raise exception 'A member already uses this email' using errcode = '23505';
  end if;

  select * into v_invitation
  from public.member_invitations as i
  where i.member_id = v_member.id
  order by i.created_at desc
  limit 1
  for update;

  old_email := v_member.email::text;
  new_email := v_email::text;
  member_id := v_member.id;
  invitation_id := v_invitation.id;
  auth_user_id := v_invitation.auth_user_id;

  update public.members set email = v_email where id = v_member.id;

  if v_invitation.id is not null then
    update public.member_invitations
    set email = v_email,
        status = 'pending',
        last_error = null,
        failed_at = null,
        sent_at = null,
        last_attempt_at = null,
        expires_at = greatest(expires_at, pg_catalog.now() + interval '7 days')
    where id = v_invitation.id;
  end if;

  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (v_member.id, v_actor, 'profile_updated',
          'Sign-in email corrected before activation',
          pg_catalog.jsonb_build_object('old_email', old_email, 'new_email', new_email));

  return next;
end;
$$;

revoke all on function public.update_member_email(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.update_member_email(uuid, text) to authenticated;
