begin;

alter table public.profiles
  add column if not exists preferred_language text not null default 'en'
  constraint profiles_preferred_language_check check (preferred_language in ('en', 'ur'));

alter table public.notices
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

alter table public.activity_log drop constraint if exists activity_log_kind_check;
alter table public.activity_log
  add constraint activity_log_kind_check check (
    kind in (
      'member_created', 'invitation_sent', 'invitation_failed', 'onboarding_completed',
      'membership_started', 'membership_renewed', 'membership_state_changed',
      'check_in', 'notice_published', 'notice_deleted', 'profile_updated'
    )
  );

create table if not exists public.push_devices (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null constraint push_devices_platform_check check (platform in ('android', 'ios')),
  last_seen_at timestamptz not null default pg_catalog.now(),
  disabled_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint push_devices_token_check check (
    expo_push_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'
  )
);

create index if not exists push_devices_profile_id_idx
  on public.push_devices (profile_id);
create index if not exists push_devices_active_profile_idx
  on public.push_devices (profile_id, last_seen_at desc)
  where disabled_at is null;
create index if not exists notices_active_published_at_idx
  on public.notices (published_at desc)
  where deleted_at is null;

alter table public.push_devices enable row level security;

drop trigger if exists push_devices_set_updated_at on public.push_devices;
create trigger push_devices_set_updated_at
before update on public.push_devices
for each row execute function public.set_updated_at();

create or replace function public.set_preferred_language(p_language text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_language not in ('en', 'ur') then
    raise exception 'Language must be English or Urdu' using errcode = '22023';
  end if;

  update public.profiles
  set preferred_language = p_language
  where id = v_user_id
    and account_state = 'active';

  if not found then
    raise exception 'An active profile is required' using errcode = '42501';
  end if;
  return p_language;
end;
$$;

create or replace function public.register_push_device(
  p_expo_push_token text,
  p_platform text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_device_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles as p
    where p.id = v_user_id and p.account_state = 'active'
  ) then
    raise exception 'An active profile is required' using errcode = '42501';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'Unsupported push platform' using errcode = '22023';
  end if;
  if p_expo_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid Expo push token' using errcode = '22023';
  end if;

  insert into public.push_devices (
    profile_id,
    expo_push_token,
    platform,
    last_seen_at,
    disabled_at
  ) values (
    v_user_id,
    p_expo_push_token,
    p_platform,
    pg_catalog.now(),
    null
  )
  on conflict (expo_push_token) do update
  set
    platform = excluded.platform,
    last_seen_at = pg_catalog.now(),
    disabled_at = null
  where push_devices.profile_id = v_user_id
  returning id into v_device_id;

  if v_device_id is null then
    raise exception 'This push token belongs to another account' using errcode = '23505';
  end if;
  return v_device_id;
end;
$$;

create or replace function public.unregister_push_device(p_expo_push_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  update public.push_devices
  set disabled_at = coalesce(disabled_at, pg_catalog.now())
  where profile_id = (select auth.uid())
    and expo_push_token = p_expo_push_token;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.delete_notice(p_notice_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_deleted_at timestamptz := pg_catalog.now();
  v_title text;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;

  update public.notices
  set deleted_at = v_deleted_at, deleted_by = v_actor
  where id = p_notice_id and deleted_at is null
  returning title into v_title;

  if not found then
    raise exception 'Active notice not found' using errcode = 'P0002';
  end if;

  insert into public.activity_log (actor_profile_id, kind, description, metadata)
  values (
    v_actor,
    'notice_deleted',
    'Notice removed from member feeds',
    pg_catalog.jsonb_build_object('notice_id', p_notice_id, 'title', v_title)
  );

  return v_deleted_at;
end;
$$;

create or replace function public.mark_notice_read(p_notice_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.current_member_id();
  v_read_at timestamptz;
begin
  if v_member_id is null then
    raise exception 'A member account is required' using errcode = '42501';
  end if;

  update public.notice_deliveries as nd
  set read_at = coalesce(nd.read_at, pg_catalog.now())
  where nd.notice_id = p_notice_id
    and nd.member_id = v_member_id
    and exists (
      select 1 from public.notices as n
      where n.id = nd.notice_id and n.deleted_at is null
    )
  returning nd.read_at into v_read_at;

  if not found then
    raise exception 'Active notice delivery not found' using errcode = 'P0002';
  end if;
  return v_read_at;
end;
$$;

create or replace function public.notice_push_messages(p_notice_id uuid)
returns table (
  expo_push_token text,
  notice_id uuid,
  title text,
  body text,
  urgent boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;

  return query
  select distinct
    pd.expo_push_token,
    n.id,
    n.title,
    n.body,
    n.urgent
  from public.notices as n
  inner join public.notice_deliveries as nd on nd.notice_id = n.id
  inner join public.members as m on m.id = nd.member_id
  inner join public.push_devices as pd on pd.profile_id = m.auth_user_id
  where n.id = p_notice_id
    and n.deleted_at is null
    and pd.disabled_at is null;
end;
$$;

create or replace function public.disable_push_devices(p_expo_push_tokens text[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;

  update public.push_devices
  set disabled_at = coalesce(disabled_at, pg_catalog.now())
  where expo_push_token = any(p_expo_push_tokens)
    and disabled_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select public.current_user_is_admin())
      or exists (
        select 1
        from public.notice_deliveries as nd
        where nd.notice_id = notices.id
          and nd.member_id = (select public.current_member_id())
      )
    )
  );

revoke all on table public.push_devices from public, anon, authenticated, service_role;
revoke all on function public.set_preferred_language(text) from public, anon, authenticated, service_role;
revoke all on function public.register_push_device(text, text) from public, anon, authenticated, service_role;
revoke all on function public.unregister_push_device(text) from public, anon, authenticated, service_role;
revoke all on function public.delete_notice(uuid) from public, anon, authenticated, service_role;
revoke all on function public.notice_push_messages(uuid) from public, anon, authenticated, service_role;
revoke all on function public.disable_push_devices(text[]) from public, anon, authenticated, service_role;

grant select (preferred_language) on public.profiles to authenticated;
grant execute on function public.set_preferred_language(text) to authenticated;
grant execute on function public.register_push_device(text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;
grant execute on function public.delete_notice(uuid) to authenticated;
grant execute on function public.notice_push_messages(uuid) to service_role;
grant execute on function public.disable_push_devices(text[]) to service_role;

commit;
