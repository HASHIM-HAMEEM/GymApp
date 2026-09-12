-- 1. Plans: admins can delete a plan only while nothing references it.
--    A plan with memberships or UPI requests behind it must be turned off
--    instead — the FK (on delete restrict) stays as the backstop.
-- 2. App releases are published from the release script (git-derived notes),
--    not from the admin UI, so publish_app_release also accepts the
--    service role. Admin execution stays allowed for emergencies.

create or replace function public.admin_plans()
returns table (
  id uuid, slug text, name text, duration_months integer, price numeric,
  currency text, blurb text, is_active boolean, membership_count bigint,
  upi_request_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.name, p.duration_months, p.price, p.currency, p.blurb, p.is_active,
         (select count(*) from public.memberships ms where ms.plan_id = p.id),
         (select count(*) from public.upi_payment_requests u where u.plan_id = p.id)
  from public.plans p
  where public.current_user_is_admin()
  order by p.duration_months, p.price;
$$;
revoke all on function public.admin_plans() from public, anon, authenticated, service_role;
grant execute on function public.admin_plans() to authenticated;

create or replace function public.delete_membership_plan(p_plan_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_terms bigint;
  v_upi bigint;
begin
  if not public.current_user_is_admin() then
    raise exception 'An active administrator is required' using errcode = '42501';
  end if;
  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'Plan not found' using errcode = 'P0002';
  end if;
  select count(*) into v_terms from public.memberships where plan_id = p_plan_id;
  select count(*) into v_upi from public.upi_payment_requests where plan_id = p_plan_id;
  if v_terms > 0 or v_upi > 0 then
    raise exception '%',
      'This plan is used by ' || v_terms || ' membership(s)'
        || case when v_upi > 0 then ' and ' || v_upi || ' payment request(s)' else '' end
        || '. Turn it off instead of deleting it so their records stay intact.'
      using errcode = '22023';
  end if;
  delete from public.plans where id = p_plan_id;
  insert into public.activity_log (member_id, actor_profile_id, kind, description, metadata)
  values (null, (select auth.uid()), 'profile_updated',
          pg_catalog.format('Plan "%s" deleted', v_plan.name),
          pg_catalog.jsonb_build_object('plan_id', v_plan.id, 'plan_name', v_plan.name, 'price', v_plan.price));
end;
$$;
revoke all on function public.delete_membership_plan(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_membership_plan(uuid) to authenticated;

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
  v_actor uuid := (select auth.uid());
begin
  if not (public.current_user_is_admin() or (select auth.role()) = 'service_role') then
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
  if exists (select 1 from public.app_releases r where r.version_code >= p_version_code) then
    raise exception 'A release with version code % or higher is already published', p_version_code using errcode = '22023';
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
    v_actor
  )
  returning id into v_id;

  insert into public.activity_log (member_id, actor_profile_id, kind, description)
  values (null, v_actor, 'app_release_published',
          pg_catalog.format('App release v%s (build %s) published', pg_catalog.btrim(p_version_name), p_version_code));

  return v_id;
end;
$$;
revoke all on function public.publish_app_release(integer, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.publish_app_release(integer, text, text, integer, text, text) to authenticated, service_role;
