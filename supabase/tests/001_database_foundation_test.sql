begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, auth, pg_catalog;

select plan(53);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.apex.local', '', pg_catalog.now(), '{"provider":"email","providers":["email"]}', '{}', pg_catalog.now(), pg_catalog.now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member.one@test.apex.local', '', pg_catalog.now(), '{"provider":"email","providers":["email"]}', '{}', pg_catalog.now(), pg_catalog.now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member.two@test.apex.local', '', pg_catalog.now(), '{"provider":"email","providers":["email"]}', '{}', pg_catalog.now(), pg_catalog.now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spoofed.admin@test.apex.local', '', pg_catalog.now(), '{"provider":"email","providers":["email"]}', '{"role":"admin"}', pg_catalog.now(), pg_catalog.now());

insert into public.profiles (id, role, account_state, must_set_password, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'admin', 'active', false, 'Test Administrator'),
  ('10000000-0000-0000-0000-000000000002', 'member', 'active', false, 'Member One'),
  ('10000000-0000-0000-0000-000000000003', 'member', 'active', false, 'Member Two');

insert into public.members (
  id,
  member_number,
  first_name,
  last_name,
  email,
  auth_user_id,
  created_by
)
values
  ('20000000-0000-0000-0000-000000000001', 'MRD-9001', 'Member', 'One', 'member.one@test.apex.local', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'MRD-9002', 'Member', 'Two', 'member.two@test.apex.local', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001');

insert into public.memberships (
  id,
  member_id,
  plan_id,
  state,
  start_date,
  end_date,
  amount_due,
  plan_name_snapshot,
  duration_months_snapshot,
  price_snapshot,
  created_by
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    (select id from public.plans where slug = 'premium-monthly'),
    'active',
    current_date - 10,
    current_date + 6,
    0,
    'Premium Monthly',
    1,
    1500,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    (select id from public.plans where slug = 'premium-monthly'),
    'active',
    current_date - 31,
    current_date - 1,
    0,
    'Premium Monthly',
    1,
    1500,
    '10000000-0000-0000-0000-000000000001'
  );

insert into public.payments (membership_id, amount, method, kind, recorded_by)
values ('30000000-0000-0000-0000-000000000001', 1500, 'cash', 'initial', '10000000-0000-0000-0000-000000000001');

create temporary table apex_test_capture (
  key text primary key,
  object_id uuid,
  token text,
  count_value integer
);
grant select, insert, update on table pg_temp.apex_test_capture to authenticated;

select is(
  (
    select pg_catalog.count(*)::integer
    from pg_catalog.pg_class as c
    inner join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'profiles',
        'members',
        'plans',
        'club_config',
        'memberships',
        'payments',
        'member_invitations',
        'qr_passes',
        'check_ins',
        'notices',
        'notice_deliveries',
        'activity_log'
      ])
      and c.relrowsecurity
  ),
  12,
  'RLS is enabled on every application table'
);

select is(
  (
    select pg_catalog.bool_and(not pg_catalog.has_table_privilege('anon', c.oid, 'SELECT'))
    from pg_catalog.pg_class as c
    inner join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'profiles', 'members', 'plans', 'club_config', 'memberships', 'payments',
        'member_invitations', 'qr_passes', 'check_ins', 'notices', 'notice_deliveries', 'activity_log'
      ])
  ),
  true,
  'anon has no table read privileges'
);

select is(
  (
    select pg_catalog.bool_and(
      not pg_catalog.has_table_privilege('authenticated', c.oid, 'INSERT')
      and not pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE')
      and not pg_catalog.has_table_privilege('authenticated', c.oid, 'DELETE')
    )
    from pg_catalog.pg_class as c
    inner join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'profiles', 'members', 'plans', 'club_config', 'memberships', 'payments',
        'member_invitations', 'qr_passes', 'check_ins', 'notices', 'notice_deliveries', 'activity_log'
      ])
  ),
  true,
  'authenticated users have no direct table writes'
);

select is(
  pg_catalog.has_table_privilege('authenticated', 'public.qr_passes', 'SELECT'),
  false,
  'QR pass hashes have no authenticated table read grant'
);

select is(
  pg_catalog.has_function_privilege('authenticated', 'public.finalize_member_invitation(uuid,uuid)', 'EXECUTE'),
  false,
  'authenticated users cannot finalize invitations'
);

select is(
  pg_catalog.has_function_privilege('service_role', 'public.finalize_member_invitation(uuid,uuid)', 'EXECUTE'),
  true,
  'service role can finalize invitations'
);

select is(
  (select pg_catalog.count(*)::integer from public.profiles where id = '10000000-0000-0000-0000-000000000004'),
  0,
  'creating an auth user does not auto-provision a profile'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated","user_metadata":{"role":"admin"}}';

select is(public.current_user_is_admin(), false, 'user metadata cannot grant the admin role');

select throws_ok(
  $$select * from public.create_member_invitation('No', 'Access', 'no.access@test.apex.local')$$,
  '42501',
  'An active administrator is required',
  'an unprovisioned signup cannot use an admin RPC'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(public.current_user_is_admin(), false, 'a member is not an administrator');

select is(
  public.current_member_id(),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'current_member_id resolves the authenticated member'
);

select is(
  (select pg_catalog.count(m.member_number)::integer from public.members as m),
  1,
  'a member reads only their own member row'
);

select is(
  (select pg_catalog.count(ms.id)::integer from public.memberships as ms),
  1,
  'a member reads only their own memberships'
);

select is(
  (select pg_catalog.count(pay.id)::integer from public.payments as pay),
  1,
  'a member reads only their own payments'
);

select throws_ok(
  $$select public.member_detail('20000000-0000-0000-0000-000000000002')$$,
  '42501',
  'Member access is required',
  'a member cannot request another member detail'
);

select throws_ok(
  $$update public.members set first_name = 'Changed' where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table members',
  'a member cannot directly update their member row'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(public.current_user_is_admin(), true, 'an active database profile grants admin access');

select is(
  (select pg_catalog.count(m.member_number)::integer from public.members as m),
  2,
  'an administrator reads all member rows'
);

select throws_ok(
  $$select * from public.create_member_invitation('Invalid', 'Email', 'not-an-email')$$,
  '22023',
  'A valid email address is required',
  'member invitation validates email before writing'
);

select is(
  (select pg_catalog.count(m.email)::integer from public.members as m where m.email = 'not-an-email'),
  0,
  'invalid invitation input writes no member'
);

select throws_ok(
  $$
    select *
    from public.create_member_invitation(
      'Bad',
      'Payment',
      'bad.payment@test.apex.local',
      p_plan_id => (select id from public.plans where slug = 'premium-monthly'),
      p_amount_paid => 9000,
      p_payment_method => 'cash'
    )
  $$,
  '22023',
  'Payment amount must be greater than zero and no more than the plan price',
  'member invitation rejects an overpayment'
);

select is(
  (select pg_catalog.count(m.email)::integer from public.members as m where m.email = 'bad.payment@test.apex.local'),
  0,
  'a failed transactional invitation leaves no partial member'
);

select lives_ok(
  $$
    select *
    from public.create_member_invitation(
      'Pending',
      'Member',
      'pending.member@test.apex.local',
      p_plan_id => (select id from public.plans where slug = 'premium-monthly'),
      p_amount_paid => 1500,
      p_payment_method => 'upi'
    )
  $$,
  'a valid member invitation creates its transaction'
);

select is(
  (select pg_catalog.count(m.email)::integer from public.members as m where m.email = 'pending.member@test.apex.local'),
  1,
  'valid invitation creates one pending member'
);

select is(
  (
    select pg_catalog.count(ms.id)::integer
    from public.memberships as ms
    inner join public.members as m on m.id = ms.member_id
    where m.email = 'pending.member@test.apex.local'
  ),
  1,
  'valid invitation creates the optional initial membership'
);

select matches(
  (
    select pay.receipt_number
    from public.payments as pay
    inner join public.memberships as ms on ms.id = pay.membership_id
    inner join public.members as m on m.id = ms.member_id
    where m.email = 'pending.member@test.apex.local'
  ),
  '^MRD-R-[0-9]{4}-[0-9]{6}$',
  'initial payment receives a server-generated receipt number'
);

select is(
  (select ci.admitted from public.check_in_member('20000000-0000-0000-0000-000000000001', 'A') as ci),
  true,
  'an administrator can manually check in an eligible member'
);

select throws_ok(
  $$select * from public.check_in_member('20000000-0000-0000-0000-000000000001', 'A')$$,
  '23505',
  'Member has already checked in within the duplicate window',
  'manual check-in rejects a duplicate within the configured window'
);

select is(
  (
    select pg_catalog.count(ci.id)::integer
    from public.check_ins as ci
    where ci.member_id = '20000000-0000-0000-0000-000000000001' and ci.admitted
  ),
  1,
  'duplicate protection leaves one admitted check-in'
);

select lives_ok(
  $$
    insert into pg_temp.apex_test_capture (key, object_id, count_value)
    select 'notice', n.notice_id, n.recipient_count
    from public.publish_notice('schedule', 'Test notice', 'Snapshot this audience.', 'active_only', false) as n
  $$,
  'an administrator can publish a notice'
);

select is(
  (select count_value from pg_temp.apex_test_capture where key = 'notice'),
  1,
  'active-only notice snapshots one eligible recipient'
);

select is(
  (
    select pg_catalog.count(nd.id)::integer
    from public.notice_deliveries as nd
    where nd.notice_id = (select object_id from pg_temp.apex_test_capture where key = 'notice')
      and nd.member_id = '20000000-0000-0000-0000-000000000001'
  ),
  1,
  'eligible member is included in the notice snapshot'
);

select is(
  (
    select pg_catalog.count(nd.id)::integer
    from public.notice_deliveries as nd
    where nd.notice_id = (select object_id from pg_temp.apex_test_capture where key = 'notice')
      and nd.member_id = '20000000-0000-0000-0000-000000000002'
  ),
  0,
  'expired member is excluded from the notice snapshot'
);

select lives_ok(
  $$
    select *
    from public.renew_membership(
      '20000000-0000-0000-0000-000000000002',
      (select id from public.plans where slug = 'premium-monthly'),
      null,
      1500,
      'card'
    )
  $$,
  'an administrator can renew an expired membership'
);

select is(
  (
    select pg_catalog.count(nd.id)::integer
    from public.notice_deliveries as nd
    where nd.notice_id = (select object_id from pg_temp.apex_test_capture where key = 'notice')
      and nd.member_id = '20000000-0000-0000-0000-000000000002'
  ),
  0,
  'later eligibility does not mutate a notice audience snapshot'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (
    select pg_catalog.count(n.id)::integer
    from public.notices as n
    where n.id = (select object_id from pg_temp.apex_test_capture where key = 'notice')
  ),
  1,
  'a snapshotted member can read the delivered notice'
);

select ok(
  public.mark_notice_read((select object_id from pg_temp.apex_test_capture where key = 'notice')) is not null,
  'a member can mark their delivered notice read'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (
    select pg_catalog.count(n.id)::integer
    from public.notices as n
    where n.id = (select object_id from pg_temp.apex_test_capture where key = 'notice')
  ),
  0,
  'a member outside the snapshot cannot read the notice'
);

select throws_ok(
  $$select public.mark_notice_read((select object_id from pg_temp.apex_test_capture where key = 'notice'))$$,
  'P0002',
  'Notice delivery not found',
  'a member outside the snapshot cannot mark the notice read'
);

select lives_ok(
  $$
    insert into pg_temp.apex_test_capture (key, object_id, token)
    select 'qr-live', q.qr_pass_id, q.token
    from public.issue_qr_pass() as q
  $$,
  'an eligible member can issue a QR pass'
);

select is(
  (select pg_catalog.char_length(token) from pg_temp.apex_test_capture where key = 'qr-live'),
  64,
  'issued QR value is a 256-bit opaque token'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (
    select q.admitted
    from public.check_in_by_qr(
      (select token from pg_temp.apex_test_capture where key = 'qr-live'),
      'B'
    ) as q
  ),
  true,
  'an administrator can admit an eligible QR pass'
);

select is(
  (
    select q.verdict
    from public.check_in_by_qr(
      (select token from pg_temp.apex_test_capture where key = 'qr-live'),
      'B'
    ) as q
  ),
  'replayed',
  'a consumed QR pass is rejected as replayed'
);

select is(
  (
    select pg_catalog.count(ci.id)::integer
    from public.check_ins as ci
    where ci.member_id = '20000000-0000-0000-0000-000000000002' and ci.source = 'qr'
  ),
  1,
  'QR replay creates no second check-in record'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    insert into pg_temp.apex_test_capture (key, object_id, token)
    select 'qr-expired', q.qr_pass_id, q.token
    from public.issue_qr_pass() as q
  $$,
  'a member can issue another QR pass after the first is consumed'
);

reset role;

update public.qr_passes
set created_at = pg_catalog.now() - interval '2 minutes', expires_at = pg_catalog.now() - interval '1 minute'
where id = (select object_id from pg_temp.apex_test_capture where key = 'qr-expired');

select is(
  (
    select pg_catalog.count(*)::integer
    from information_schema.columns
    where table_schema = 'public' and table_name = 'qr_passes' and column_name = 'token'
  ),
  0,
  'raw QR tokens are never stored'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (
    select q.verdict
    from public.check_in_by_qr(
      (select token from pg_temp.apex_test_capture where key = 'qr-expired'),
      'A'
    ) as q
  ),
  'expired',
  'an expired QR pass is rejected'
);

reset role;

select ok(
  (select qp.used_at is null from public.qr_passes as qp where qp.id = (select object_id from pg_temp.apex_test_capture where key = 'qr-expired')),
  'an expired QR pass is not consumed as a valid pass'
);

select throws_ok(
  $$update public.payments set amount = amount where membership_id = '30000000-0000-0000-0000-000000000001'$$,
  '55000',
  'payments is append-only',
  'payment rows are append-only even for privileged sessions'
);

select throws_ok(
  $$update public.activity_log set description = description where member_id = '20000000-0000-0000-0000-000000000001'$$,
  '55000',
  'activity_log is append-only',
  'activity rows are append-only even for privileged sessions'
);

select is(
  (
    select pg_catalog.count(*)::integer
    from information_schema.columns
    where table_schema = 'public' and table_name = 'memberships' and column_name = 'status'
  ),
  0,
  'membership status is not persisted'
);

select is(
  public.membership_status('active', current_date - 10, current_date + 6, 0, null, current_date),
  'expiring',
  'membership status is derived from state, dates, and amount due'
);

select is(
  public.membership_status('paused', current_date - 30, current_date - 1, 0, current_date + 7, current_date),
  'expired',
  'an elapsed membership is expired even if its stored state is paused'
);

select * from finish();
rollback;
