-- Club config (name, address, phone, hours) is public information shown on the
-- pre-auth welcome screen. Allow anon + authenticated SELECT so the landing
-- page can render club details before the user signs in.
grant select on public.club_config to anon;
create policy club_config_public_read
  on public.club_config
  for select to anon, authenticated
  using (true);
