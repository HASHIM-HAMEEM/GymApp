-- Scratch harness stubs mirroring the Supabase platform (per AGENTS.md).
create schema if not exists auth;
create schema if not exists extensions;

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create schema if not exists harness;

-- Supabase platform roles.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

-- Supabase platform utility stub (revoke target in migration 4).
create or replace function public.rls_auto_enable()
returns void language plpgsql as $$ begin end; $$;

grant usage on schema harness to authenticated;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

-- Test helper: act as a given auth user (and role) for the current txn.
create or replace function harness.set_user(p_user uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', p_role)::text, false);
  perform set_config('request.jwt.claim.role', p_role, false);
end;
$$;
