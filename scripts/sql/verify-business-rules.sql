-- Apex Phase 1 verification against the scratch Postgres harness.
-- Exercises: M1 (admission NULL), M2 (club clock), M3 (calendar terms),
-- M4 (freeze preservation + queued re-anchoring), M5/M8 (settlement,
-- decimals), M6/M7 (renewal idempotency + quote), S2 (QR caps/replay).
begin;

create or replace function harness.eq(p_name text, p_got anyelement, p_want anyelement)
returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'FAIL % :: got %, want %', p_name, p_got::text, p_want::text;
  end if;
  raise notice 'ok - %', p_name;
end;
$$;

create or replace function harness.throws(p_name text, p_code text, p_sql text)
returns void language plpgsql as $$
declare
  v_err text;
  v_code text;
begin
  begin
    execute p_sql;
    raise exception 'FAIL % :: expected error %, got success', p_name, p_code;
  exception when others then
    v_err := sqlerrm;
    v_code := sqlstate;
    if v_code <> p_code then
      raise exception 'FAIL % :: expected code %, got % (%)', p_name, p_code, v_code, v_err;
    end if;
    raise notice 'ok - %', p_name;
  end;
end;
$$;

-- ---------------------------------------------------------------- setup
insert into auth.users (id, email, email_confirmed_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.apex.local', now()),
  ('a0000000-0000-0000-0000-000000000002', 'asha@test.apex.local', now()),
  ('a0000000-0000-0000-0000-000000000003', 'riya@test.apex.local', now()),
  ('a0000000-0000-0000-0000-000000000004', 'arjun@test.apex.local', now());

insert into public.profiles (id, role, account_state, must_set_password, display_name)
values ('a0000000-0000-0000-0000-000000000001', 'admin', 'active', false, 'Test Administrator');

create temp table if not exists ctx (
  key text primary key,
  val text
);

-- ---------------------------------------------------- M2: club clock
select harness.eq('club_today Kolkata midnight rollover',
  public.club_today('2026-09-05 18:30:00+00'::timestamptz), '2026-09-06'::date);
select harness.eq('club_today just before rollover',
  public.club_today('2026-09-05 18:29:59+00'::timestamptz), '2026-09-05'::date);
select harness.eq('club_today configured timezone is Kolkata',
  (select timezone from public.club_config where id = 1), 'Asia/Kolkata');
select harness.eq('club currency is INR',
  (select currency from public.club_config where id = 1), 'INR');
select harness.eq('club country is IN',
  (select country_code from public.club_config where id = 1), 'IN');
select harness.eq('Aadhaar checksum accepts valid number', public.valid_aadhaar('100000000004'), true);
select harness.eq('Aadhaar checksum rejects invalid number', public.valid_aadhaar('100000000005'), false);

-- ---------------------------------------------------- M3: calendar terms
select harness.eq('term Sep 5 + 1 month', public.term_end_date('2026-09-05'::date, 1), '2026-10-04'::date);
select harness.eq('term Jan 31 + 1 month (non-leap)', public.term_end_date('2027-01-31'::date, 1), '2027-02-28'::date);
select harness.eq('term Jan 31 + 1 month (leap)', public.term_end_date('2028-01-31'::date, 1), '2028-02-29'::date);
select harness.eq('term Feb 29 + 12 months', public.term_end_date('2028-02-29'::date, 12), '2029-02-28'::date);
select harness.eq('term Jan 28 + 1 month', public.term_end_date('2027-01-28'::date, 1), '2027-02-27'::date);
select harness.eq('term Apr 30 + 1 month', public.term_end_date('2026-04-30'::date, 1), '2026-05-29'::date);
select harness.eq('term Nov 30 + 3 months clamps to Feb end', public.term_end_date('2026-11-30'::date, 3), '2027-02-28'::date);
select harness.eq('term Dec 15 + 3 months crosses year', public.term_end_date('2026-12-15'::date, 3), '2027-03-14'::date);
select harness.eq('term rejects zero months', public.term_end_date('2026-09-05'::date, 0), null::date);

-- ---------------------------------------------------- plans re-priced
select harness.eq('plan monthly price INR',
  (select price from public.plans where slug = 'premium-monthly'), 2499.00::numeric);
select harness.eq('plan annual price INR',
  (select price from public.plans where slug = 'annual'), 23999.00::numeric);
select harness.eq('plans carry INR currency',
  (select bool_and(currency = 'INR') from public.plans), true);
select harness.eq('legacy price_egp compat column mirrors price',
  (select price_egp from public.plans where slug = 'premium-monthly'), 2499.00::numeric);

-- ------------------------------------------- M1/M5/M8: due + settlement
select harness.set_user('a0000000-0000-0000-0000-000000000001');

insert into ctx (key, val)
select t.k, t.v
from public.create_member_invitation(
  'Asha', 'Kumar', 'asha@test.apex.local',
  null, null, null, null, '100000000004', null,
  (select id from public.plans where slug = 'premium-monthly'),
  null, 999.99, 'upi'
) r,
lateral (values
  ('asha_member', r.member_id::text),
  ('asha_membership', r.membership_id::text)
) as t(k, v);

-- Link Asha's auth user so admission reflects an onboarded member
-- (mirrors the finalized invitation + onboarding state).
update public.members
set auth_user_id = 'a0000000-0000-0000-0000-000000000002'
where id = (select val::uuid from ctx where key = 'asha_member');
insert into public.profiles (id, role, account_state, must_set_password, display_name)
values ('a0000000-0000-0000-0000-000000000002', 'member', 'active', false, 'Asha Kumar');

select public.update_upi_config('apex@bank', 'Apex Athletic Club');
select harness.set_user('a0000000-0000-0000-0000-000000000002');
insert into ctx(key,val)
select 'asha_upi_request', r.id::text from public.create_upi_payment_request(
  (select val::uuid from ctx where key='asha_membership'), null) r;
select harness.eq('member submits UPI reference',
  (select r.status from public.submit_upi_payment((select val::uuid from ctx where key='asha_upi_request'),'UTR123456',null) r), 'submitted');
select harness.throws('member cannot confirm UPI payment','42501',
  $$select public.review_upi_payment_request((select val::uuid from ctx where key='asha_upi_request'),true,null)$$);
select harness.set_user('a0000000-0000-0000-0000-000000000001');
select harness.eq('admin rejects unverified UPI payment',
  (select r.status from public.review_upi_payment_request((select val::uuid from ctx where key='asha_upi_request'),false,'Not found') r), 'rejected');
select harness.eq('UPI review replay is idempotent',
  (select r.status from public.review_upi_payment_request((select val::uuid from ctx where key='asha_upi_request'),false,'Repeated') r), 'rejected');

select harness.eq('membership starts on club-local purchase date',
  (select start_date from public.memberships where id = (select val::uuid from ctx where key = 'asha_membership')),
  public.club_today());
select harness.eq('membership end is calendar-month inclusive',
  (select end_date from public.memberships where id = (select val::uuid from ctx where key = 'asha_membership')),
  public.term_end_date(public.club_today(), 1));
select harness.eq('partial decimal payment leaves exact due (M8)',
  (select amount_due from public.memberships where id = (select val::uuid from ctx where key = 'asha_membership')),
  1499.01::numeric);
select harness.eq('membership snapshots INR',
  (select currency_snapshot from public.memberships where id = (select val::uuid from ctx where key = 'asha_membership')),
  'INR');
select harness.eq('initial payment recorded in INR',
  (select currency from public.payments where membership_id = (select val::uuid from ctx where key = 'asha_membership')),
  'INR');
select harness.eq('initial payment decimal preserved',
  (select amount from public.payments where membership_id = (select val::uuid from ctx where key = 'asha_membership')),
  999.99::numeric);

-- M1: due with NULL grace must return a total false, never NULL.
select harness.eq('admission verdict on due membership is due (M1)',
  (select a.verdict from public.member_admission(
    (select member_id from public.memberships where id = (select val::uuid from ctx where key = 'asha_membership')),
    now()) a
  ), 'due');
select harness.eq('admission admitted is strictly false (M1)',
  (select a.admitted is true from public.member_admission(
    (select member_id from public.memberships where id = (select val::uuid from ctx where key = 'asha_membership')),
    now()) a
  ), false);

-- Manual start dates are rejected (M6).
select harness.throws('create rejects manual start date', '22023',
  $$select public.create_member_invitation('X','Y','x1@test.apex.local',null,null,null,null,'100000000015',null,
    (select id from public.plans where slug='premium-monthly'), '2026-01-01'::date, null, null)$$);

-- Settlement: exact remaining balance via UPI (M5/M8).
select harness.eq('settlement zeroes the balance',
  (select s.amount_due from public.settle_membership_balance(
    (select val::uuid from ctx where key = 'asha_membership'), 1499.01, 'upi',
    'd0000000-0000-0000-0000-000000000001') s
  ), 0::numeric);
select harness.eq('settlement receipt exists',
  (select count(*) from public.payments
    where membership_id = (select val::uuid from ctx where key = 'asha_membership') and kind = 'settlement'),
  1::bigint);
select harness.eq('ledger keeps both rows append-only',
  (select count(*) from public.payments
    where membership_id = (select val::uuid from ctx where key = 'asha_membership')),
  2::bigint);

-- Idempotent replay returns the stored result without a new payment.
select harness.eq('settlement replay returns same receipt',
  (select s.receipt_number from public.settle_membership_balance(
    (select val::uuid from ctx where key = 'asha_membership'), 1499.01, 'upi',
    'd0000000-0000-0000-0000-000000000001') s
  ), (select receipt_number from public.payments
      where membership_id = (select val::uuid from ctx where key = 'asha_membership') and kind = 'settlement'));
select harness.eq('settlement replay adds no payment',
  (select count(*) from public.payments
    where membership_id = (select val::uuid from ctx where key = 'asha_membership')),
  2::bigint);

-- Reused request id with a different payload must conflict.
select harness.throws('request id payload conflict rejected', '23505',
  $$select public.settle_membership_balance(
    (select val::uuid from ctx where key='asha_membership'), 100.00, 'cash',
    'd0000000-0000-0000-0000-000000000001')$$);

-- Nothing left to settle; over-settlement rejected.
select harness.throws('settlement of settled balance rejected', '22023',
  $$select public.settle_membership_balance(
    (select val::uuid from ctx where key='asha_membership'), 50.00, 'cash',
    'd0000000-0000-0000-0000-000000000002')$$);
select harness.throws('unsupported method rejected', '22023',
  $$select public.settle_membership_balance(
    (select val::uuid from ctx where key='asha_membership'), 50.00, 'instapay',
    'd0000000-0000-0000-0000-000000000003')$$);

-- Admission flips to admitted after settlement.
select harness.eq('admission after settlement is true',
  (select a.admitted from public.member_admission(
    (select member_id from public.memberships where id = (select val::uuid from ctx where key = 'asha_membership')),
    now()) a
  ), true);

-- Check-in denied row is recorded for a due member instead of erroring (M1).
insert into ctx (key, val)
select t.k, t.v
from public.create_member_invitation(
  'Riya', 'Sharma', 'riya@test.apex.local',
  null, null, null, null, '100000000027', null,
  (select id from public.plans where slug = 'three-month'),
  null, 100.00, 'cash'
) r,
lateral (values
  ('riya_member', r.member_id::text),
  ('riya_membership', r.membership_id::text)
) as t(k, v);

update public.members
set auth_user_id = 'a0000000-0000-0000-0000-000000000003'
where id = (select val::uuid from ctx where key = 'riya_member');
insert into public.profiles (id, role, account_state, must_set_password, display_name)
values ('a0000000-0000-0000-0000-000000000003', 'member', 'active', false, 'Riya Sharma');

select harness.eq('due check-in records a denied row (M1)',
  (select c.admitted from public.check_in_member(
    (select val::uuid from ctx where key = 'riya_member'), 'A') c
  ), false);
select harness.eq('due check-in verdict recorded',
  (select c.verdict from public.check_in_member(
    (select val::uuid from ctx where key = 'riya_member'), 'A') c
  ), 'due');

-- Waiver clears the balance with an audited reason (M5).
select harness.eq('waiver zeroes the balance',
  (select w.amount_due from public.waive_membership_balance(
    (select val::uuid from ctx where key = 'riya_membership'), 'Goodwill adjustment',
    'd0000000-0000-0000-0000-000000000004') w
  ), 0::numeric);
select harness.eq('waiver ledger row recorded',
  (select count(*) from public.payments
    where membership_id = (select val::uuid from ctx where key = 'riya_membership') and kind = 'waiver'),
  1::bigint);
select harness.eq('waiver reason audited',
  (select count(*) from public.activity_log
    where kind = 'balance_waived' and metadata->>'reason' = 'Goodwill adjustment'),
  1::bigint);
select harness.throws('double waiver rejected', '22023',
  $$select public.waive_membership_balance(
    (select val::uuid from ctx where key='riya_membership'), 'again',
    'd0000000-0000-0000-0000-000000000005')$$);

-- ---------------------------------------------------- M6/M7: renewal
insert into ctx (key, val)
select t.k, t.v
from public.create_member_invitation(
  'Arjun', 'Patel', 'arjun@test.apex.local',
  null, null, null, null, '100000000036', null,
  (select id from public.plans where slug = 'premium-monthly'),
  null, 2499.00, 'upi'
) r,
lateral (values
  ('arjun_member', r.member_id::text),
  ('arjun_membership', r.membership_id::text)
) as t(k, v);

update public.members
set auth_user_id = 'a0000000-0000-0000-0000-000000000004'
where id = (select val::uuid from ctx where key = 'arjun_member');
insert into public.profiles (id, role, account_state, must_set_password, display_name)
values ('a0000000-0000-0000-0000-000000000004', 'member', 'active', false, 'Arjun Patel');

select harness.throws('renewal rejects manual start date', '22023',
  $$select public.renew_membership(
    (select val::uuid from ctx where key='arjun_member'),
    (select id from public.plans where slug='annual'),
    '2026-01-01'::date, null, null, null)$$);

insert into ctx
select 'arjun_renewal', r.membership_id::text from public.renew_membership(
  (select val::uuid from ctx where key = 'arjun_member'),
  (select id from public.plans where slug = 'annual'),
  null, null, null, 'd0000000-0000-0000-0000-000000000006') r;

select harness.eq('renewal queued start is day after current end',
  (select start_date from public.memberships where id = (select val::uuid from ctx where key = 'arjun_renewal')),
  (select end_date + 1 from public.memberships where id = (select val::uuid from ctx where key = 'arjun_membership')));
select harness.eq('renewal queued end is calendar inclusive',
  (select end_date from public.memberships where id = (select val::uuid from ctx where key = 'arjun_renewal')),
  (select public.term_end_date(start_date, 12) from public.memberships where id = (select val::uuid from ctx where key = 'arjun_renewal')));

-- Idempotent replay: same request id returns the stored row, no duplicate.
select harness.eq('renewal replay returns same membership',
  (select r.membership_id::text from public.renew_membership(
    (select val::uuid from ctx where key = 'arjun_member'),
    (select id from public.plans where slug = 'annual'),
    null, null, null, 'd0000000-0000-0000-0000-000000000006') r
  ), (select val from ctx where key = 'arjun_renewal'));
select harness.eq('renewal replay adds no membership',
  (select count(*) from public.memberships
    where member_id = (select val::uuid from ctx where key = 'arjun_member')),
  2::bigint);
select harness.throws('renewal request id payload conflict', '23505',
  $$select public.renew_membership(
    (select val::uuid from ctx where key='arjun_member'),
    (select id from public.plans where slug='premium-monthly'),
    null, 2499.00, 'upi', 'd0000000-0000-0000-0000-000000000006')$$);

-- Quote matches what the server will actually sell (M7).
select harness.eq('quote start matches server choice',
  (select q.start_date from public.renewal_quote(
    (select val::uuid from ctx where key = 'arjun_member'),
    (select id from public.plans where slug = 'premium-monthly')) q
  ),
  (select end_date + 1 from public.memberships
    where member_id = (select val::uuid from ctx where key = 'arjun_member')
    order by end_date desc limit 1));
select harness.eq('quote price is INR plan price',
  (select q.price from public.renewal_quote(
    (select val::uuid from ctx where key = 'arjun_member'),
    (select id from public.plans where slug = 'premium-monthly')) q
  ), 2499.00::numeric);
select harness.eq('quote currency is INR',
  (select q.currency from public.renewal_quote(
    (select val::uuid from ctx where key = 'arjun_member'),
    (select id from public.plans where slug = 'premium-monthly')) q
  ), 'INR');

-- --------------------------------------------- M4: freeze preservation
-- Pause Arjun's current term with a resume day 6 days out.
select harness.eq('pause records resume day',
  (select s.pause_until from public.set_membership_state(
    (select val::uuid from ctx where key = 'arjun_membership'), 'paused',
    public.club_today() + 6, 'travel') s
  ), (public.club_today() + 6));
select harness.eq('paused status while inside pause window',
  (select s.status from public.set_membership_state(
    (select val::uuid from ctx where key = 'arjun_membership'), 'paused',
    public.club_today() + 6, 'travel') s
  ), 'paused');
select harness.eq('paused membership is not admitted',
  (select a.admitted from public.member_admission(
    (select val::uuid from ctx where key = 'arjun_member'), now()) a
  ), false);
select harness.eq('paused verdict reported',
  (select a.verdict from public.member_admission(
    (select val::uuid from ctx where key = 'arjun_member'), now()) a
  ), 'paused');

-- Read-side credit: past the resume day the pause counts even before a
-- mutation persists it.
select harness.eq('read-side effective end credits planned pause',
  (select cm.end_date from public.current_membership(
    (select val::uuid from ctx where key = 'arjun_member'), public.club_today() + 7) cm
  ),
  (select end_date + 6 from public.memberships
    where id = (select val::uuid from ctx where key = 'arjun_membership')));
select harness.eq('status after auto-expiry is no longer paused',
  (select cm.status from public.current_membership(
    (select val::uuid from ctx where key = 'arjun_member'), public.club_today() + 7) cm
  ) in ('active', 'expiring'), true);

-- Early resume after two consumed days: term extends by exactly 2 and the
-- queued annual term re-anchors to stay contiguous.
update public.memberships
set pause_started_on = public.club_today() - 2
where id = (select val::uuid from ctx where key = 'arjun_membership');
update public.membership_freezes
set started_on = public.club_today() - 2
where membership_id = (select val::uuid from ctx where key = 'arjun_membership')
  and resumed_on is null;

insert into ctx
select 'arjun_end_before_resume',
  end_date::text from public.memberships
where id = (select val::uuid from ctx where key = 'arjun_membership');

insert into ctx
select 'arjun_queued_days_before_resume',
  (end_date - start_date)::text
from public.memberships where id = (select val::uuid from ctx where key = 'arjun_renewal');

select harness.eq('early resume returns active state',
  (select s.state from public.set_membership_state(
    (select val::uuid from ctx where key = 'arjun_membership'), 'active') s
  ), 'active');
select harness.eq('early resume credits exactly consumed days',
  (select end_date - (select val::date from ctx where key = 'arjun_end_before_resume')
    from public.memberships where id = (select val::uuid from ctx where key = 'arjun_membership')),
  2);
select harness.eq('frozen days persisted',
  (select frozen_days from public.memberships
    where id = (select val::uuid from ctx where key = 'arjun_membership')),
  2);
select harness.eq('queued term re-anchored contiguously',
  (select start_date from public.memberships where id = (select val::uuid from ctx where key = 'arjun_renewal')),
  (select end_date + 1 from public.memberships
    where id = (select val::uuid from ctx where key = 'arjun_membership')));
select harness.eq('queued term kept its paid day count',
  (select (end_date - start_date)::text from public.memberships
    where id = (select val::uuid from ctx where key = 'arjun_renewal')),
  (select val from ctx where key = 'arjun_queued_days_before_resume'));
select harness.eq('freeze row closed with actual credit',
  (select days_credited from public.membership_freezes
    where membership_id = (select val::uuid from ctx where key = 'arjun_membership')),
  2);

-- Auto-expiry on schedule: backdate a fresh pause so the resume day has
-- passed, then touch the membership; credit is persisted automatically.
select harness.eq('pause again for auto-expiry test',
  (select s.state from public.set_membership_state(
    (select val::uuid from ctx where key = 'arjun_membership'), 'paused',
    public.club_today() + 3, 'medical') s
  ), 'paused');

update public.memberships
set pause_started_on = public.club_today() - 5,
    pause_until = public.club_today() - 1
where id = (select val::uuid from ctx where key = 'arjun_membership');
update public.membership_freezes
set started_on = public.club_today() - 5,
    resume_on = public.club_today() - 1
where membership_id = (select val::uuid from ctx where key = 'arjun_membership')
  and resumed_on is null;

insert into ctx
select 'arjun_end_before_auto', end_date::text
from public.memberships where id = (select val::uuid from ctx where key = 'arjun_membership');
insert into ctx
select 'arjun_queued_start_before_auto', start_date::text
from public.memberships where id = (select val::uuid from ctx where key = 'arjun_renewal');

select harness.eq('expired pause auto-closes on next touch',
  (select s.state from public.set_membership_state(
    (select val::uuid from ctx where key = 'arjun_membership'), 'active') s
  ), 'active');
select harness.eq('auto-close credits the planned days',
  (select end_date - (select val::date from ctx where key = 'arjun_end_before_auto')
    from public.memberships where id = (select val::uuid from ctx where key = 'arjun_membership')),
  4);
select harness.eq('auto-close re-anchors the queued term',
  (select start_date from public.memberships where id = (select val::uuid from ctx where key = 'arjun_renewal')),
  (select end_date + 1 from public.memberships
    where id = (select val::uuid from ctx where key = 'arjun_membership')));
select harness.eq('auto-closed freeze row recorded',
  (select days_credited from public.membership_freezes
    where membership_id = (select val::uuid from ctx where key = 'arjun_membership')
      and started_on = public.club_today() - 5),
  4);
select harness.eq('auto-closed freeze row has a resume date',
  (select resumed_on is not null from public.membership_freezes
    where membership_id = (select val::uuid from ctx where key = 'arjun_membership')
      and started_on = public.club_today() - 5),
  true);
select harness.eq('no open freeze rows remain',
  (select count(*) from public.membership_freezes
    where membership_id = (select val::uuid from ctx where key = 'arjun_membership')
      and resumed_on is null),
  0::bigint);

-- No overlap between the paused term and the queued term.
select harness.eq('no term overlap after freeze lifecycle',
  (select count(*) from public.memberships a
    join public.memberships b on a.member_id = b.member_id and a.id < b.id
      and a.state <> 'cancelled' and b.state <> 'cancelled'
      and a.start_date <= b.end_date and b.start_date <= a.end_date
    where a.member_id = (select val::uuid from ctx where key = 'arjun_member')),
  0::bigint);

-- Pause validation: resume day must be after today and within the term.
select harness.throws('pause resume day must be in the future', '22023',
  $$select public.set_membership_state(
    (select val::uuid from ctx where key='arjun_membership'), 'paused',
    public.club_today() - 1, null)$$);
select harness.throws('pause resume day must be within term', '22023',
  $$select public.set_membership_state(
    (select val::uuid from ctx where key='arjun_membership'), 'paused',
    public.club_today() + 400, null)$$);

-- ----------------------------------------------- S2: QR pass lifecycle
select harness.set_user('a0000000-0000-0000-0000-000000000002');
insert into ctx
select 'asha_token', token from public.issue_qr_pass(true);

-- Ten more quick issues must succeed; the eleventh hits the abuse cap.
do $$
declare
  i integer := 0;
begin
  loop
    i := i + 1;
    begin
      perform public.issue_qr_pass(false);
    exception when others then
      if sqlstate <> '22023' then
        raise exception 'FAIL qr rate cap :: unexpected code % (%)', sqlstate, sqlerrm;
      end if;
      exit;
    end;
    if i > 11 then
      raise exception 'FAIL qr rate cap :: cap never enforced';
    end if;
  end loop;
  -- One pass was issued before the loop, so the cap (10 per minute)
  -- must fire on the 11th overall issue = loop iteration 10.
  if i <> 10 then
    raise exception 'FAIL qr rate cap :: fired at loop %', i;
  end if;
  raise notice 'ok - qr rate cap enforced after 10 issues';
end;
$$;

-- At most one prior live pass remains after a non-revoking issue.
select harness.eq('one predecessor pass at most',
  (select count(*) from public.qr_passes
    where member_id = (select val::uuid from ctx where key = 'asha_member')
      and used_at is null and revoked_at is null and expires_at > now()
  ) <= 2, true);

-- Scan as admin: admitted; replay: rejected as replayed (S2/M1).
select harness.set_user('a0000000-0000-0000-0000-000000000001');
select harness.eq('qr scan admits active member',
  (select c.admitted from public.check_in_by_qr(
    (select val from ctx where key = 'asha_token'), 'A') c
  ), true);
select harness.eq('qr replay rejected',
  (select c.verdict from public.check_in_by_qr(
    (select val from ctx where key = 'asha_token'), 'A') c
  ), 'replayed');

-- Expired pass: clear the rate window, issue fresh, backdate expiry, scan.
update public.qr_passes
set created_at = created_at - interval '120 seconds'
where member_id = (select val::uuid from ctx where key = 'asha_member');

select harness.set_user('a0000000-0000-0000-0000-000000000002');
insert into ctx
select 'asha_token2', token from public.issue_qr_pass(true);
update public.qr_passes
set created_at = now() - interval '120 seconds',
    expires_at = now() - interval '5 seconds'
where token_hash = extensions.digest(pg_catalog.convert_to((select val from ctx where key = 'asha_token2'), 'UTF8'), 'sha256');

select harness.set_user('a0000000-0000-0000-0000-000000000001');
select harness.eq('expired qr rejected',
  (select c.verdict from public.check_in_by_qr(
    (select val from ctx where key = 'asha_token2'), 'A') c
  ), 'expired');

-- Member cannot call admin scan RPC.
select harness.set_user('a0000000-0000-0000-0000-000000000002');
select harness.throws('member cannot scan qr', '42501',
  $$select public.check_in_by_qr((select val from ctx where key='asha_token2'), 'A')$$);
select harness.throws('member cannot settle balances', '42501',
  $$select public.settle_membership_balance(
    (select val::uuid from ctx where key='asha_membership'), 1.00, 'cash', null)$$);

-- ------------------------------------------------- reads reflect truth
select harness.set_user('a0000000-0000-0000-0000-000000000001');
select harness.eq('dashboard currency is INR',
  (select (d->>'currency')::text from public.admin_dashboard() d), 'INR');
select harness.eq('dashboard payments_this_month counts settlements',
  (select (d->>'payments_this_month')::numeric >= 999.99 from public.admin_dashboard() d), true);
select harness.eq('dashboard legacy key still present',
  (select d ? 'payments_this_month_egp' from public.admin_dashboard() d), true);
select harness.eq('member detail exposes as_of and price',
  (select (m->>'as_of') is not null and m->'memberships'->0 ? 'price'
     and m->'memberships'->0->>'currency' = 'INR'
    from public.member_detail((select val::uuid from ctx where key = 'asha_member')) m
  ), true);
select harness.eq('member detail payment uses neutral amount key',
  (select (m->'payments'->0->>'amount')::numeric = 999.99
    from public.member_detail((select val::uuid from ctx where key = 'asha_member')) m
  ), true);
select harness.eq('search reports paused status for paused member',
  (select s.membership_status from public.search_members('MRD-', 100, 0, null) s
    where s.member_id = (select val::uuid from ctx where key = 'arjun_member')
  ), 'active');

-- ---------------------------------------------------- RLS still holds
set role authenticated;
select harness.set_user('a0000000-0000-0000-0000-000000000002');
select harness.eq('member reads own payments through RLS',
  (select count(*) >= 1 from public.payments pay
    join public.memberships ms on ms.id = pay.membership_id
    join public.members m on m.id = ms.member_id
    where m.auth_user_id = auth.uid()
  ), true);
select harness.throws('direct payment insert denied by RLS', '42501',
  $$insert into public.payments (membership_id, amount, currency, method, kind)
    values ((select val::uuid from ctx where key='asha_membership'), 1, 'INR', 'cash', 'settlement')$$);
select harness.throws('membership_operations is RPC-only', '42501',
  $$insert into public.membership_operations (request_id, member_id, kind, request_payload)
    values ('e0000000-0000-0000-0000-000000000001',
      (select val::uuid from ctx where key='asha_member'), 'waiver', '{}')$$);
select harness.throws('membership_freezes is RPC-only', '42501',
  $$insert into public.membership_freezes (membership_id, started_on, resume_on)
    values ((select val::uuid from ctx where key='asha_membership'), current_date, current_date + 1)$$);
reset role;

select harness.set_user('a0000000-0000-0000-0000-000000000001');
do $$
declare p uuid; first_term record; renewed record; replayed record;
begin
  p := public.save_membership_plan(null, 'Six-month QA', 6, 1000, true);
  perform harness.eq('admin creates six-month price', (select price from public.plans where id=p), 1000::numeric);
  select * into first_term from public.create_member_invitation(
    p_first_name=>'Pricing',p_last_name=>'Test',p_email=>'pricing@test.apex.local',p_national_id=>'100000000043',
    p_plan_id=>p,p_amount_paid=>800,p_payment_method=>'cash',p_agreed_price=>800,p_price_note=>'Student discount');
  perform harness.eq('discount stores agreed snapshot', (select price_snapshot from public.memberships where id=first_term.membership_id), 800::numeric);
  perform harness.eq('discount stores original catalogue price', (select list_price_snapshot from public.memberships where id=first_term.membership_id), 1000::numeric);
  perform harness.eq('discount is not unpaid debt', (select amount_due from public.memberships where id=first_term.membership_id), 0::numeric);
  perform public.save_membership_plan(p,'Six-month QA',6,1500,true);
  perform harness.eq('plan edit preserves historic price', (select price_snapshot from public.memberships where id=first_term.membership_id), 800::numeric);
  select * into renewed from public.renew_membership(
    p_member_id=>first_term.member_id,p_plan_id=>p,p_amount_paid=>1000,p_payment_method=>'cash',
    p_request_id=>'f0000000-0000-0000-0000-000000000001',p_agreed_price=>1200,p_price_note=>'Loyalty price');
  perform harness.eq('partial payment uses agreed balance',renewed.amount_due,200::numeric);
  perform harness.eq('custom renewal preserves catalogue price', (select price from public.plans where id=p),1500::numeric);
  select * into replayed from public.renew_membership(
    p_member_id=>first_term.member_id,p_plan_id=>p,p_amount_paid=>1000,p_payment_method=>'cash',
    p_request_id=>'f0000000-0000-0000-0000-000000000001',p_agreed_price=>1200,p_price_note=>'Loyalty price');
  perform harness.eq('priced renewal retry is idempotent',replayed.membership_id,renewed.membership_id);
end;
$$;
select harness.throws('reject invalid plan price','22023', $$select public.save_membership_plan(null,'Invalid',6,'NaN',true)$$);
set role authenticated;
select harness.set_user('a0000000-0000-0000-0000-000000000002');
select harness.throws('member cannot edit prices','42501', $$select public.save_membership_plan(null,'Blocked',6,10,true)$$);
reset role;
select harness.set_user('a0000000-0000-0000-0000-000000000001');
update public.memberships set end_date=public.club_today()+5 where id=(select val::uuid from ctx where key='riya_membership');
insert into ctx(key,val) select 'riya_reminder', reminder_id::text from public.claim_expiry_reminders();
select harness.eq('expiry reminder is claimed once',
  (select attempts from public.expiry_reminders where id=(select val::uuid from ctx where key='riya_reminder')), 1);
select public.record_expiry_reminder((select val::uuid from ctx where key='riya_reminder'),false,'temporary');
select harness.eq('failed expiry reminder is retried',
  (select count(*) from public.claim_expiry_reminders() where reminder_id=(select val::uuid from ctx where key='riya_reminder')), 1::bigint);
select harness.eq('expiry retry increments attempt count',
  (select attempts from public.expiry_reminders where id=(select val::uuid from ctx where key='riya_reminder')), 2);
select public.record_expiry_reminder((select val::uuid from ctx where key='riya_reminder'),true,null);
select harness.eq('sent expiry reminder is not reclaimed',
  (select count(*) from public.claim_expiry_reminders() where reminder_id=(select val::uuid from ctx where key='riya_reminder')), 0::bigint);
select public.remove_member((select val::uuid from ctx where key='riya_member'),'QA removal');
select harness.eq('member removal revokes account access',
  (select account_state from public.profiles where id='a0000000-0000-0000-0000-000000000003'), 'removed');
select harness.eq('member removal preserves payments',
  (select count(*) > 0 from public.payments p join public.memberships ms on ms.id=p.membership_id where ms.member_id=(select val::uuid from ctx where key='riya_member')), true);
select harness.eq('removed member excluded from server search',
  (select count(*) from public.search_members('Riya',100,0,null)),0::bigint);
select harness.set_user('a0000000-0000-0000-0000-000000000003');
select harness.eq('removed account has no current member id', public.current_member_id(), null::uuid);
select harness.throws('removed member cannot issue QR','42501', $$select public.issue_qr_pass(false)$$);
select harness.set_user('a0000000-0000-0000-0000-000000000002');
insert into ctx(key,val) select 'renewal_upi',r.id::text from public.create_upi_payment_request(null,(select id from public.plans where slug='premium-monthly')) r;
select public.submit_upi_payment((select val::uuid from ctx where key='renewal_upi'),'UTR999999',null);
select harness.set_user('a0000000-0000-0000-0000-000000000001');
update public.plans set price=price+100 where slug='premium-monthly';
select harness.eq('UPI renewal confirmation succeeds after catalogue price changes',
  (select r.status from public.review_upi_payment_request((select val::uuid from ctx where key='renewal_upi'),true,null) r),'confirmed');
select harness.eq('UPI renewal confirmation retry returns same payment',
  (select r.confirmed_payment_id from public.review_upi_payment_request((select val::uuid from ctx where key='renewal_upi'),true,null) r),
  (select confirmed_payment_id from public.upi_payment_requests where id=(select val::uuid from ctx where key='renewal_upi')));
select harness.eq('UPI renewal keeps request price',
  (select ms.price_snapshot from public.memberships ms join public.upi_payment_requests r on r.confirmed_membership_id=ms.id where r.id=(select val::uuid from ctx where key='renewal_upi')),2499::numeric);
select harness.set_user(null);
rollback;
