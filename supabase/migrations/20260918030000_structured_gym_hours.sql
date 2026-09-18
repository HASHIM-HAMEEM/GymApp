-- Seven-day structured gym schedule. Contact details and opening hours now
-- have separate admin RPCs so editing the address cannot overwrite the weekly
-- schedule. Each open day has a 24-hour HH:MM opening and closing time;
-- overnight ranges are allowed (for example 18:00–02:00).

update public.club_config
set hours = pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('day','monday','label','Monday','open','06:00','close','23:00','closed',false,'value','6:00 AM–11:00 PM'),
  pg_catalog.jsonb_build_object('day','tuesday','label','Tuesday','open','06:00','close','23:00','closed',false,'value','6:00 AM–11:00 PM'),
  pg_catalog.jsonb_build_object('day','wednesday','label','Wednesday','open','06:00','close','23:00','closed',false,'value','6:00 AM–11:00 PM'),
  pg_catalog.jsonb_build_object('day','thursday','label','Thursday','open','06:00','close','23:00','closed',false,'value','6:00 AM–11:00 PM'),
  pg_catalog.jsonb_build_object('day','friday','label','Friday','open','07:00','close','21:00','closed',false,'value','7:00 AM–9:00 PM'),
  pg_catalog.jsonb_build_object('day','saturday','label','Saturday','open','06:00','close','22:00','closed',false,'value','6:00 AM–10:00 PM'),
  pg_catalog.jsonb_build_object('day','sunday','label','Sunday','open',null,'close',null,'closed',true,'value','Closed')
)
where not exists (
  select 1 from pg_catalog.jsonb_array_elements(hours) item where item ? 'day'
);

create or replace function public.update_club_contact(
  p_name text,
  p_address text,
  p_city text,
  p_phone text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'Club name must be between 1 and 120 characters' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_address, ''))) not between 1 and 200 then
    raise exception 'Club address must be between 1 and 200 characters' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_city, ''))) not between 1 and 80 then
    raise exception 'Club city must be between 1 and 80 characters' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_phone, ''))) not between 7 and 32 then
    raise exception 'Club phone must be between 7 and 32 characters' using errcode = '22023';
  end if;

  update public.club_config
  set name = pg_catalog.btrim(p_name),
      address = pg_catalog.btrim(p_address),
      city = pg_catalog.btrim(p_city),
      phone = pg_catalog.btrim(p_phone),
      updated_at = pg_catalog.now()
  where id = 1;
end;
$$;
revoke all on function public.update_club_contact(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.update_club_contact(text,text,text,text) to authenticated;

create or replace function public.update_club_hours(p_hours jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_days constant text[] := array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  v_normalized jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;
  if p_hours is null or pg_catalog.jsonb_typeof(p_hours) <> 'array' then
    raise exception 'Enter one schedule row for every day of the week' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_hours) <> 7 then
    raise exception 'Enter one schedule row for every day of the week' using errcode = '22023';
  end if;
  if (select count(distinct item->>'day') from pg_catalog.jsonb_array_elements(p_hours) item) <> 7
    or exists (
      select 1 from pg_catalog.jsonb_array_elements(p_hours) item
      where not ((item->>'day') = any(v_days))
        or coalesce(pg_catalog.jsonb_typeof(item->'closed'), 'null') <> 'boolean'
        or (
          not (item->>'closed')::boolean
          and (
            coalesce(item->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            or coalesce(item->>'close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            or item->>'open' = item->>'close'
          )
        )
    ) then
    raise exception 'Use valid days and HH:MM opening/closing times' using errcode = '22023';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'day', item->>'day',
      'label', pg_catalog.initcap(item->>'day'),
      'open', case when (item->>'closed')::boolean then null else item->>'open' end,
      'close', case when (item->>'closed')::boolean then null else item->>'close' end,
      'closed', (item->>'closed')::boolean,
      'value', case
        when (item->>'closed')::boolean then 'Closed'
        else pg_catalog.to_char((item->>'open')::time, 'FMHH12:MI AM') || '–' ||
             pg_catalog.to_char((item->>'close')::time, 'FMHH12:MI AM')
      end
    ) order by pg_catalog.array_position(v_days, item->>'day')
  ) into v_normalized
  from pg_catalog.jsonb_array_elements(p_hours) item;

  update public.club_config set hours = v_normalized, updated_at = pg_catalog.now() where id = 1;
end;
$$;
revoke all on function public.update_club_hours(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.update_club_hours(jsonb) to authenticated;
