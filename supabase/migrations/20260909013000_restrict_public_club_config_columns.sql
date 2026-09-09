revoke select on table public.club_config from anon, authenticated;

grant select (
  name,
  address,
  city,
  phone,
  timezone,
  currency,
  hours
) on table public.club_config to anon, authenticated;
