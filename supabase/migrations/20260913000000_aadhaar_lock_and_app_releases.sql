-- Aadhaar immutability + in-house app update releases.
--
-- 1. members.national_id (Aadhaar) is write-once: it can be set at creation
--    or while still empty, but once a value exists it can never be changed or
--    cleared — same rule as the sign-in email. Enforced with a BEFORE UPDATE
--    trigger so no code path (member self-edit, admin RPC, direct SQL) can
--    bypass it.
--
-- 2. app_releases drives the in-house APK update flow (the app is not on
--    Play Store): admins publish a release row; every client reads the latest
--    row through latest_app_release() and compares it against the installed
--    versionCode. version_code > installed  -> update offered;
--    installed < min_supported_version_code -> update is mandatory
--    (blocking screen). Reads go through a security-definer RPC granted to
--    anon + authenticated so a mandatory update can gate even the sign-in
--    screen. The table itself has no RLS policies — all access via RPC.

-- 1. Aadhaar write-once guard ------------------------------------------------

create or replace function public.guard_member_national_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.national_id is not null
     and new.national_id is distinct from old.national_id then
    raise exception 'Aadhaar number cannot be changed once it is set'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists members_national_id_write_once on public.members;
create trigger members_national_id_write_once
  before update on public.members
  for each row execute function public.guard_member_national_id();

-- 2. App releases ------------------------------------------------------------

create table if not exists public.app_releases (
  id bigint generated always as identity primary key,
  version_code integer not null check (version_code > 0),
  version_name text not null check (pg_catalog.char_length(pg_catalog.btrim(version_name)) between 1 and 40),
  apk_url text not null check (apk_url ~ '^https://'),
  min_supported_version_code integer not null default 1 check (min_supported_version_code > 0),
  notes text not null default '',
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.app_releases enable row level security;
-- No policies: rows are read through latest_app_release() and written only
-- through publish_app_release().

alter table public.activity_log drop constraint if exists activity_log_kind_check;
alter table public.activity_log add constraint activity_log_kind_check check (kind in (
  'member_created','invitation_sent','invitation_failed','onboarding_completed','membership_started','membership_renewed',
  'membership_state_changed','check_in','notice_published','profile_updated','balance_settled','balance_waived','member_removed','member_restored',
  'app_release_published'
));

create or replace function public.latest_app_release()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce(
    (
      select pg_catalog.jsonb_build_object(
        'version_code', r.version_code,
        'version_name', r.version_name,
        'apk_url', r.apk_url,
        'min_supported_version_code', r.min_supported_version_code,
        'notes', r.notes,
        'sha256', r.sha256,
        'published_at', r.created_at
      )
      from public.app_releases r
      order by r.version_code desc, r.id desc
      limit 1
    ),
    '{}'::pg_catalog.jsonb
  );
end;
$$;

create or replace function public.publish_app_release(
  p_version_code integer,
  p_version_name text,
  p_apk_url text,
  p_min_supported_version_code integer default 1,
  p_notes text default '',
  p_sha256 text default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_version_code is null or p_version_code < 1 then
    raise exception 'Version code must be a positive integer' using errcode = '22023';
  end if;
  if p_version_name is null or pg_catalog.char_length(pg_catalog.btrim(p_version_name)) not between 1 and 40 then
    raise exception 'Version name is required' using errcode = '22023';
  end if;
  if p_apk_url is null or p_apk_url !~ '^https://' then
    raise exception 'APK URL must be a secure https link' using errcode = '22023';
  end if;
  if coalesce(p_min_supported_version_code, 1) > p_version_code then
    raise exception 'Minimum supported version cannot exceed the release version' using errcode = '22023';
  end if;

  insert into public.app_releases (
    version_code, version_name, apk_url,
    min_supported_version_code, notes, sha256, created_by
  ) values (
    p_version_code,
    pg_catalog.btrim(p_version_name),
    p_apk_url,
    greatest(1, coalesce(p_min_supported_version_code, 1)),
    coalesce(p_notes, ''),
    nullif(pg_catalog.btrim(coalesce(p_sha256, '')), ''),
    (select auth.uid())
  )
  returning id into v_id;

  insert into public.activity_log (member_id, actor_profile_id, kind, description)
  values (null, (select auth.uid()), 'app_release_published',
          pg_catalog.format('App release v%s (build %s) published', pg_catalog.btrim(p_version_name), p_version_code));

  return v_id;
end;
$$;

revoke all on function public.latest_app_release() from public, anon, authenticated, service_role;
revoke all on function public.publish_app_release(integer, text, text, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.latest_app_release() to anon, authenticated;
grant execute on function public.publish_app_release(integer, text, text, integer, text, text) to authenticated;
