begin;

update public.club_config
set qr_ttl_seconds = 60
where id = 1;

drop function if exists public.issue_qr_pass();

create function public.issue_qr_pass(p_revoke_existing boolean default false)
returns table (qr_pass_id uuid, token text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_member_id uuid;
  v_account_state text;
  v_must_set_password boolean;
  v_membership_id uuid;
  v_verdict text;
  v_admitted boolean;
  v_token text;
  v_ttl integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_expires_at timestamptz;
  v_qr_pass_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select m.id, p.account_state, p.must_set_password
  into v_member_id, v_account_state, v_must_set_password
  from public.members as m
  inner join public.profiles as p on p.id = m.auth_user_id
  where m.auth_user_id = v_user_id
    and p.role = 'member';

  if not found
    or v_account_state <> 'active'
    or v_must_set_password then
    raise exception 'An active, onboarded member account is required'
      using errcode = '42501';
  end if;

  select a.membership_id, a.verdict, a.admitted
  into v_membership_id, v_verdict, v_admitted
  from public.member_admission(v_member_id, v_now) as a;

  if not v_admitted then
    raise exception 'A QR pass is unavailable for membership status %', v_verdict
      using errcode = '22023';
  end if;

  select c.qr_ttl_seconds into v_ttl
  from public.club_config as c
  where c.id = 1;

  v_ttl := least(300, greatest(30, coalesce(v_ttl, 60)));
  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := v_now + pg_catalog.make_interval(secs => v_ttl);

  if p_revoke_existing then
    update public.qr_passes as qp
    set revoked_at = coalesce(qp.revoked_at, v_now)
    where qp.member_id = v_member_id
      and qp.used_at is null
      and qp.revoked_at is null
      and qp.expires_at > v_now;
  else
    update public.qr_passes as qp
    set revoked_at = coalesce(qp.revoked_at, v_now)
    where qp.member_id = v_member_id
      and qp.used_at is null
      and qp.revoked_at is null
      and qp.expires_at > v_now
      and qp.id not in (
        select keep.id
        from public.qr_passes as keep
        where keep.member_id = v_member_id
          and keep.used_at is null
          and keep.revoked_at is null
          and keep.expires_at > v_now
        order by keep.created_at desc
        limit 1
      );
  end if;

  insert into public.qr_passes (member_id, token_hash, expires_at)
  values (
    v_member_id,
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    v_expires_at
  )
  returning id into v_qr_pass_id;

  qr_pass_id := v_qr_pass_id;
  token := v_token;
  expires_at := v_expires_at;
  return next;
end;
$$;

revoke all on function public.issue_qr_pass(boolean)
from public, anon, authenticated, service_role;
grant execute on function public.issue_qr_pass(boolean)
to authenticated;

commit;
