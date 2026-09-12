-- Plans: make the member-facing description ("blurb") editable by admins and
-- clear the seeded descriptions that still quoted an Egyptian-pound saving.
-- Plan edits never touch existing memberships — every term keeps its
-- plan_name_snapshot / price_snapshot / dates; changes apply to renewals only.

drop function if exists public.save_membership_plan(uuid, text, integer, numeric, boolean);

create or replace function public.save_membership_plan(
  p_plan_id uuid default null,
  p_name text default null,
  p_months integer default 1,
  p_price numeric default 0,
  p_active boolean default true,
  p_blurb text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_currency text;
  v_blurb text := pg_catalog.btrim(coalesce(p_blurb, ''));
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;
  if p_name is null or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 120
    or p_months is null or p_months not between 1 and 120 or p_price is null
    or p_price::text in ('NaN','Infinity','-Infinity') or p_price < 0 or p_price > 9999999999.99
    or p_price <> pg_catalog.round(p_price,2) or p_active is null then
    raise exception 'Enter a valid name, term and price with at most two decimals' using errcode='22023';
  end if;
  if pg_catalog.char_length(v_blurb) > 160 then
    raise exception 'Keep the description under 160 characters' using errcode='22023';
  end if;
  if p_plan_id is null then
    select currency into v_currency from public.club_config where id=1;
    insert into public.plans(slug,name,duration_months,price,currency,blurb,is_active)
      values ('custom-' || extensions.gen_random_uuid()::text, pg_catalog.btrim(p_name), p_months, p_price, v_currency, v_blurb, p_active)
      returning id into v_id;
  else
    update public.plans
    set name=pg_catalog.btrim(p_name), duration_months=p_months, price=p_price,
        blurb = case when p_blurb is null then blurb else v_blurb end,
        is_active=p_active, updated_at=pg_catalog.now()
      where id=p_plan_id returning id into v_id;
    if v_id is null then raise exception 'Plan not found' using errcode='P0002'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_membership_plan(uuid,text,integer,numeric,boolean,text) from public, anon, authenticated, service_role;
grant execute on function public.save_membership_plan(uuid,text,integer,numeric,boolean,text) to authenticated;

-- Seeded copy quoted the wrong currency; leave the owner to write their own.
update public.plans set blurb = '' where blurb ilike '%EGP%';
