begin;

create or replace function public.initialize_invitation_attempt()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.attempts = 0 then
    new.attempts := 1;
  end if;
  new.last_attempt_at := coalesce(new.last_attempt_at, pg_catalog.now());
  return new;
end;
$$;

revoke all on function public.initialize_invitation_attempt()
from public, anon, authenticated, service_role;

drop trigger if exists member_invitations_initialize_attempt
on public.member_invitations;
create trigger member_invitations_initialize_attempt
  before insert on public.member_invitations
  for each row execute function public.initialize_invitation_attempt();

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.members as m
  inner join public.profiles as p on p.id = m.auth_user_id
  where m.auth_user_id = (select auth.uid())
    and p.role = 'member'
    and p.account_state = 'active'
  limit 1;
$$;

create or replace function public.finalize_member_invitation(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns table (invitation_id uuid, member_id uuid, auth_user_id uuid, status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation public.member_invitations%rowtype;
  v_member public.members%rowtype;
  v_auth_email extensions.citext;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'The service role is required' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.member_invitations as i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if v_invitation.status = 'accepted' then
    if v_invitation.auth_user_id is distinct from p_auth_user_id then
      raise exception 'Invitation is already linked to another user' using errcode = '23505';
    end if;
    invitation_id := v_invitation.id;
    member_id := v_invitation.member_id;
    auth_user_id := v_invitation.auth_user_id;
    status := v_invitation.status;
    return next;
    return;
  end if;

  if v_invitation.status not in ('pending', 'failed', 'sent') then
    raise exception 'Invitation cannot be finalized from its current status' using errcode = '22023';
  end if;

  if v_invitation.expires_at <= pg_catalog.now() then
    raise exception 'Invitation has expired' using errcode = '22023';
  end if;

  select pg_catalog.lower(pg_catalog.btrim(u.email))::extensions.citext
  into v_auth_email
  from auth.users as u
  where u.id = p_auth_user_id;

  if not found then
    raise exception 'Auth user not found' using errcode = 'P0002';
  end if;

  if v_auth_email is distinct from v_invitation.email then
    raise exception 'Auth user email does not match the invitation' using errcode = '22023';
  end if;

  select * into v_member
  from public.members as m
  where m.id = v_invitation.member_id
  for update;

  if v_member.auth_user_id is not null
    and v_member.auth_user_id is distinct from p_auth_user_id then
    raise exception 'Member is already linked to another auth user' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.members as m
    where m.auth_user_id = p_auth_user_id
      and m.id <> v_member.id
  ) then
    raise exception 'Auth user is already linked to another member' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.profiles as p
    where p.id = p_auth_user_id
      and p.role <> 'member'
  ) then
    raise exception 'Auth user already has a non-member profile' using errcode = '23505';
  end if;

  insert into public.profiles (
    id,
    role,
    account_state,
    must_set_password,
    display_name
  )
  values (
    p_auth_user_id,
    'member',
    'invited',
    true,
    pg_catalog.btrim(v_member.first_name || ' ' || v_member.last_name)
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    must_set_password = true,
    account_state = case
      when public.profiles.account_state = 'suspended' then 'suspended'
      else 'invited'
    end;

  update public.members
  set auth_user_id = p_auth_user_id
  where id = v_member.id;

  update public.member_invitations
  set
    auth_user_id = p_auth_user_id,
    status = 'sent',
    sent_at = coalesce(sent_at, pg_catalog.now()),
    failed_at = null,
    last_error = null
  where id = v_invitation.id;

  insert into public.activity_log (
    member_id,
    kind,
    description,
    metadata
  )
  values (
    v_member.id,
    'invitation_sent',
    'Email invitation linked to the member auth account',
    pg_catalog.jsonb_build_object(
      'invitation_id',
      v_invitation.id,
      'auth_user_id',
      p_auth_user_id
    )
  );

  invitation_id := v_invitation.id;
  member_id := v_member.id;
  auth_user_id := p_auth_user_id;
  status := 'sent';
  return next;
end;
$$;

create or replace function public.mark_member_invitation_failed(
  p_invitation_id uuid,
  p_error text
)
returns table (invitation_id uuid, member_id uuid, status text, attempts integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation public.member_invitations%rowtype;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'The service role is required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_error, '')))
    not between 1 and 2000 then
    raise exception 'A concise failure reason is required' using errcode = '22023';
  end if;

  select * into v_invitation
  from public.member_invitations as i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if v_invitation.status in ('accepted', 'cancelled') then
    raise exception 'A completed invitation cannot be marked failed' using errcode = '22023';
  end if;

  update public.member_invitations
  set
    status = 'failed',
    failed_at = pg_catalog.now(),
    last_error = pg_catalog.left(pg_catalog.btrim(p_error), 2000)
  where id = v_invitation.id
  returning public.member_invitations.attempts into attempts;

  insert into public.activity_log (
    member_id,
    kind,
    description,
    metadata
  )
  values (
    v_invitation.member_id,
    'invitation_failed',
    'Email invitation delivery failed',
    pg_catalog.jsonb_build_object('invitation_id', v_invitation.id)
  );

  invitation_id := v_invitation.id;
  member_id := v_invitation.member_id;
  status := 'failed';
  return next;
end;
$$;

create or replace function public.complete_member_onboarding()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_member_id uuid;
  v_profile public.profiles%rowtype;
  v_email_confirmed_at timestamptz;
  v_should_log boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into v_profile
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception 'An application profile is required' using errcode = '42501';
  end if;

  if v_profile.account_state = 'suspended' then
    raise exception 'Suspended accounts cannot complete onboarding' using errcode = '42501';
  end if;

  select u.email_confirmed_at into v_email_confirmed_at
  from auth.users as u
  where u.id = v_user_id;

  if v_email_confirmed_at is null then
    raise exception 'Email confirmation is required' using errcode = '42501';
  end if;

  if v_profile.role = 'admin' then
    update public.profiles
    set account_state = 'active', must_set_password = false
    where id = v_user_id;
    return v_user_id;
  end if;

  if v_profile.role <> 'member' then
    raise exception 'A member or administrator profile is required' using errcode = '42501';
  end if;

  select m.id into v_member_id
  from public.members as m
  where m.auth_user_id = v_user_id
  for update;

  if not found then
    raise exception 'Member record not found' using errcode = 'P0002';
  end if;

  v_should_log := v_profile.must_set_password
    or v_profile.account_state = 'invited';

  update public.profiles
  set account_state = 'active', must_set_password = false
  where id = v_user_id;

  update public.member_invitations
  set
    status = 'accepted',
    accepted_at = coalesce(accepted_at, pg_catalog.now())
  where member_id = v_member_id
    and status = 'sent';

  if v_should_log then
    insert into public.activity_log (
      member_id,
      actor_profile_id,
      kind,
      description
    )
    values (
      v_member_id,
      v_user_id,
      'onboarding_completed',
      'Member completed account onboarding'
    );
  end if;

  return v_member_id;
end;
$$;

drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select to authenticated
  using (
    (select public.current_user_is_admin())
    or (
      auth_user_id = (select auth.uid())
      and exists (
        select 1
        from public.profiles as p
        where p.id = (select auth.uid())
          and p.account_state = 'active'
      )
    )
  );

commit;
