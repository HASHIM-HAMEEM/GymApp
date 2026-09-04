begin;

alter table public.profiles
  add column if not exists reception text
  constraint profiles_reception_check check (reception is null or reception in ('A', 'B'));

revoke select on table public.profiles from authenticated;
grant select (id, role, account_state, must_set_password, display_name, reception, created_at, updated_at)
  on public.profiles to authenticated;

commit;
