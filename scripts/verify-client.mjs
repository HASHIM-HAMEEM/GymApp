#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
let failures = 0;
const check = (name, cond, extra) => {
  if (cond) console.log(`ok - ${name}`);
  else { failures++; console.error(`FAIL - ${name}${extra ? ' :: ' + extra : ''}`); }
};
const eq = (name, actual, expected) =>
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const compile = (p) => ts.transpileModule(fs.readFileSync(path.join(root, p), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function runModule(file, resolve, env = {}) {
  const module = { exports: {} };
  const req = (id) => {
    if (id in resolve) return resolve[id];
    throw new Error(`unexpected require: ${id}`);
  };
  const proc = { env };
  new Function('require', 'module', 'exports', 'process', compile(file))(req, module, module.exports, proc);
  return module.exports;
}

const i18n = runModule('src/lib/i18n.ts', {});
const translate = i18n.translate;
const aadhaar = runModule('src/lib/aadhaar.ts', {});
const noticeNotifications = runModule('src/lib/notifications.ts', {
  'react-native': { Platform: { OS: 'web' }, Linking: { openSettings: async () => {} } },
  'expo-constants': { __esModule: true, default: { appOwnership: null } },
  '@react-native-async-storage/async-storage': {
    __esModule: true,
    default: { getItem: async () => null, setItem: async () => undefined },
  },
  './supabase': { requireSupabase: () => ({}) },
});

const tokens = { colors: { accent: '#F5F5F5', ink3: '#7E7E7E', lineStrong: 'x', line: 'y', warnDot: 'w', badDot: 'b' } };
const format = runModule('src/data/format.ts', {
  '@/theme/tokens': tokens,
  '@/lib/i18n': i18n,
});

const source = fs.readFileSync(path.join(root, 'src/lib/i18n.ts'), 'utf8');
const enSection = source.slice(source.indexOf('const en'), source.indexOf('const ur'));
const urSection = source.slice(source.indexOf('const ur'));
const enKeys = [...enSection.matchAll(/^  '([a-zA-Z0-9.]+)':/gm)].map((m) => m[1]);
const urKeys = [...urSection.matchAll(/^  '([a-zA-Z0-9.]+)':/gm)].map((m) => m[1]);
const placeholders = (s) => new Set([...String(s).matchAll(/%\{(\w+)\}/g)].map((m) => m[1]));

{
  const missingInUr = enKeys.filter((k) => !urKeys.includes(k));
  const extraInUr = urKeys.filter((k) => !enKeys.includes(k));
  check('dictionary en/ur key parity', missingInUr.length === 0 && extraInUr.length === 0,
    `missing in ur: ${missingInUr.join(', ')} | extra in ur: ${extraInUr.join(', ')}`);
  let mismatches = [];
  for (const key of enKeys) {
    const enV = translate('en', key);
    const urV = translate('ur', key);
    const a = [...placeholders(enV)].sort().join(',');
    const b = [...placeholders(urV)].sort().join(',');
    if (a !== b) mismatches.push(`${key} [${a}] vs [${b}]`);
  }
  check('dictionary interpolation parity', mismatches.length === 0, mismatches.join(' | '));
}

{
  eq('interpolation preserves literal $&',
    translate('en', 'member.greetingWithName', { greeting: 'a$&b', name: 'x' }), 'a$&b, x');
  eq('interpolation preserves literal backtick-dollar',
    translate('en', 'member.greetingWithName', { greeting: "a$`b", name: 'x' }), 'a$`b, x');
  eq('interpolation preserves literal dollar-quote',
    translate('en', 'member.greetingWithName', { greeting: "a$'b", name: 'x' }), "a$'b, x");
  eq('interpolation is single-pass (no placeholder reprocessing)',
    translate('en', 'member.greetingWithName', { greeting: '%{name}', name: 'x' }), '%{name}, x');
  eq('interpolation preserves unknown placeholders',
    translate('en', 'member.greetingWithName', { name: 'x' }), '%{greeting}, x');
  eq('interpolation replaces repeated placeholders',
    translate('en', 'member.greetingWithName', { greeting: 'Hi', name: 'Hi' }), 'Hi, Hi');
  eq('interpolation handles urdu and punctuation',
    translate('ur', 'member.greetingWithName', { greeting: 'شام', name: 'Ahmad$&' }), 'Ahmad$&، شام');
}

eq('fmtLong en', format.fmtLong('2026-09-24'), '24 Sep 2026');
eq('fmtLong ur', format.fmtLong('2026-09-24', 'ur'), '24 ستمبر 2026');
eq('fmtShort en', format.fmtShort('2026-09-24'), '24 Sep');
eq('fmtShort ur', format.fmtShort('2026-09-24', 'ur'), '24 ستمبر');
eq('fmtMonthDay en', format.fmtMonthDay('2026-09-24'), 'Sep 24');
eq('fmtMonthDay ur', format.fmtMonthDay('2026-09-24', 'ur'), '24 ستمبر');
eq('fmtDayName en', format.fmtDayName(0), 'Sun');
eq('fmtDayName ur', format.fmtDayName(0, 'ur'), 'اتوار');
eq('fmtTodayLabel en (Sunday)', format.fmtTodayLabel('2026-09-06'), 'Sun · 6 Sep');
eq('fmtTodayLabel ur (Sunday)', format.fmtTodayLabel('2026-09-06', 'ur'), '6 ستمبر · اتوار');

eq('formatTime en evening', format.formatTime('19:32'), '7:32 PM');
eq('formatTime ur evening', format.formatTime('19:32', 'ur'), '7:32 شام');
eq('formatTime en noon', format.formatTime('12:00'), '12:00 PM');
eq('formatTime en midnight', format.formatTime('00:15'), '12:15 AM');
eq('formatTime ur midnight', format.formatTime('00:15', 'ur'), '12:15 صبح');
eq('formatTime ur passthrough AM/PM', format.formatTime('7:32 PM', 'ur'), '7:32 شام');
eq('formatTime en passthrough AM/PM', format.formatTime('7:32 PM'), '7:32 PM');
eq('fmtDateTime with seconds', format.fmtDateTime('2026-09-18T18:41:30'), '18 Sep 2026 · 6:41 PM');
eq('fmtTime from datetime', format.fmtTime('2026-09-18T18:41:30'), '6:41 PM');

eq('Aadhaar normalizes spaces', aadhaar.normalizeAadhaar('1000 0000 0004'), '100000000004');
eq('Aadhaar accepts a valid Verhoeff checksum', aadhaar.isValidAadhaar('1000 0000 0004'), true);
eq('Aadhaar rejects an invalid checksum', aadhaar.isValidAadhaar('1000 0000 0005'), false);
eq('Aadhaar rejects all zeroes', aadhaar.isValidAadhaar('0000 0000 0000'), false);
eq('Aadhaar masks routine display', aadhaar.maskAadhaar('100000000004'), '•••• •••• 0004');

{
  const notices = [
    { id: 'n1', title: 'One', body: 'One', read: false },
    { id: 'n2', title: 'Two', body: 'Two', read: true },
    { id: 'n3', title: 'Three', body: 'Three', read: false },
    { id: 'n4', title: 'Four', body: 'Four', read: false },
    { id: 'n5', title: 'Five', body: 'Five', read: false },
  ];
  eq('notice alerts suppress existing notices on first run', noticeNotifications.selectFreshNotices(notices, null).length, 0);
  eq('notice alerts exclude read and previously notified notices', noticeNotifications.selectFreshNotices(notices, new Set(['n1'])).map((n) => n.id).join(','), 'n3,n4,n5');
  eq('notice alerts cap each check at three', noticeNotifications.selectFreshNotices(notices, new Set()).length, 3);
}

{
  const today = new Date(format.todayIso() + 'T00:00:00Z');
  const later = new Date(today.getTime() + 5 * 86400000).toISOString().slice(0, 10);
  const visEn = format.statusVisual('expiring', { expiryDate: later });
  const visUr = format.statusVisual('expiring', { expiryDate: later }, undefined, 'ur');
  eq('statusVisual en tag', visEn.tagLabel, 'Expiring soon');
  eq('statusVisual ur tag', visUr.tagLabel, 'جلد ختم ہونے والی');
  check('statusVisual ur banner localized', visUr.bannerText.includes('تجدید'), visUr.bannerText);
  check('statusVisual en banner localized', visEn.bannerText.includes('Renew'), visEn.bannerText);
  eq('todayIso defaults to the club timezone date', format.todayIso().length, 10);
  eq('todayIso accepts an explicit timezone', format.todayIso('UTC').length, 10);
  eq('formatMoney renders INR with the rupee symbol', format.formatMoney(2499, 'INR'), '₹2,499');
  eq('formatMoney renders EGP for historical rows', format.formatMoney(1500, 'EGP'), 'E£1,500');
  eq('formatMoney renders urdu interpolation safely', format.formatMoney(19.99, 'INR', 'ur'), '₹19.99');
}

const recordedKeys = [];
const secureStore = (() => {
  const store = new Map();
  const assertKey = (k) => {
    if (typeof k !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(k)) throw new Error(`Invalid SecureStore key: ${JSON.stringify(k)}`);
    recordedKeys.push(k);
  };
  return {
    getItemAsync: async (k) => { assertKey(k); return store.has(k) ? store.get(k) : null; },
    setItemAsync: async (k, v) => { assertKey(k); store.set(k, String(v)); },
    deleteItemAsync: async (k) => { assertKey(k); store.delete(k); },
    _store: store,
  };
})();

let captured = null;
const env = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'pk_test',
};
const supabaseMod = runModule('src/lib/supabase.ts', {
  'react-native-url-polyfill/auto': {},
  'expo-linking': { createURL: () => 'apex://confirm' },
  'expo-secure-store': secureStore,
  'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove: () => {} }) } },
  '@supabase/supabase-js': { createClient: (url, key, opts) => { captured = opts; return { auth: {} }; } },
}, env);

{
  const storage = captured.auth.storage;
  const longSession = JSON.stringify({ access_token: 'a'.repeat(2600), refresh_token: 'r'.repeat(500), user: { id: 'u1' } });
  await storage.setItem('sb-project-auth-token', longSession);
  eq('secureStorage roundtrip (chunked)', await storage.getItem('sb-project-auth-token'), longSession);
  check('secureStorage chunk keys recorded', recordedKeys.some((k) => /\.[ab]\.0$/.test(k)) && recordedKeys.some((k) => k.includes('.chunks')));
  check('secureStorage key charset valid', recordedKeys.every((k) => /^[a-zA-Z0-9._-]+$/.test(k)), recordedKeys.join(','));

  await storage.setItem('sb-project-auth-token', 'short');
  eq('secureStorage overwrite long->short', await storage.getItem('sb-project-auth-token'), 'short');
  check('secureStorage switches banks atomically', secureStore._store.get('sb-project-auth-token.chunks') === 'v2:b:1' && secureStore._store.get('sb-project-auth-token.b.0') === 'short');
  check('secureStorage stale bank removed', !secureStore._store.has('sb-project-auth-token.a.0'));

  secureStore._store.delete('sb-project-auth-token.chunks');
  secureStore._store.set('sb-project-auth-token', 'legacy-value');
  eq('secureStorage legacy direct key', await storage.getItem('sb-project-auth-token'), 'legacy-value');

  await storage.setItem('sb-project-auth-token', longSession);
  secureStore._store.delete('sb-project-auth-token.a.1');
  eq('secureStorage missing chunk returns null', await storage.getItem('sb-project-auth-token'), null);

  await storage.removeItem('sb-project-auth-token');
  eq('secureStorage removeItem', await storage.getItem('sb-project-auth-token'), null);
  check('secureStorage remove cleans chunks marker', !secureStore._store.has('sb-project-auth-token.chunks'));
}

{
  const fieldSource = fs.readFileSync(path.join(root, 'src/components/Field.tsx'), 'utf8');
  const passwordSource = fs.readFileSync(path.join(root, 'app/set-password.tsx'), 'utf8');
  const invitationsSource = fs.readFileSync(path.join(root, 'supabase/functions/_shared/invitations.ts'), 'utf8');
  const formScrollSource = fs.readFileSync(path.join(root, 'src/components/FormScroll.tsx'), 'utf8');
  check('web controls use native HTML inputs', fieldSource.includes("Platform.OS === 'web' && !multiline ?") && fieldSource.includes("type={htmlType}"));
  check('form scroll never blurs inputs on web drags', formScrollSource.includes("keyboardDismissMode={Platform.OS === 'web' ? 'none'"));
  eq('both password fields opt into native web password input', [...passwordSource.matchAll(/webType="password"/g)].length, 2);
  check('invitation resend supports confirmed unfinished onboarding', invitationsSource.includes('verificationType: "invite" | "recovery"') && invitationsSource.includes('type: verificationType'));
  check('invitation emails use attempt-specific idempotency', invitationsSource.includes('request.sendAttempt ?? 1'));
}

{
  // membership_operations.request_id rejects anything that is not a
  // lowercase UUID; Hermes has no crypto.randomUUID, so the fallback must
  // still emit a valid v4 UUID or every renewal/settle/waive fails on-device.
  const requestId = runModule('src/lib/request-id.ts', {});
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  check('request id is a lowercase v4 UUID', uuidRe.test(requestId.newRequestId()));
  const realCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    const hermesId = requestId.newRequestId();
    check('request id stays a valid UUID without crypto (Hermes)', uuidRe.test(hermesId), hermesId);
    check('request ids are unique', requestId.newRequestId() !== requestId.newRequestId());
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });
  }
}

{
  // Removed members keep their records but lose every live capability;
  // the admin UI must surface them under the Removed filter, not silently
  // drop them from search results.
  const queriesSource = fs.readFileSync(path.join(root, 'src/data/api/queries.ts'), 'utf8');
  const mapperSource = fs.readFileSync(path.join(root, 'src/data/api/mapper.ts'), 'utf8');
  const membersSource = fs.readFileSync(path.join(root, 'app/(admin)/members.tsx'), 'utf8');
  const detailSource = fs.readFileSync(path.join(root, 'app/member-detail.tsx'), 'utf8');
  check('member search supports the removed filter', queriesSource.includes("p_status: status === 'all' ? null : status") && queriesSource.includes("| 'removed'"));
  check('removed members hidden from normal search results', queriesSource.includes("row.membership_status !== 'removed'"));
  check('member detail search falls back to the removed filter', queriesSource.includes("'removed' as const") || queriesSource.includes("[null, 'removed']"));
  check('restore member mutation exists', queriesSource.includes("callRpc<void>('restore_member'"));
  check('mapper preserves removed flag on detail and search rows', mapperSource.includes('removed: Boolean(detail.removed_at)') && mapperSource.includes("row.membership_status === 'removed'"));
  check('member detail renders the removed state and restore action', detailSource.includes('memberDetail.removedTitle') && detailSource.includes('handleRestore'));
  check('members list offers the removed filter', membersSource.includes("adminMembers.filterRemoved"));
}

{
  // Correcting a mistyped sign-in email is only safe while the invitation
  // is pending — after activation the edge function refuses, so the client
  // must offer the action solely in the not-yet-accepted branch.
  const queriesSource = fs.readFileSync(path.join(root, 'src/data/api/queries.ts'), 'utf8');
  const detailSource = fs.readFileSync(path.join(root, 'app/member-detail.tsx'), 'utf8');
  const newSource = fs.readFileSync(path.join(root, 'app/member-new.tsx'), 'utf8');
  check('update member email goes through the edge function', queriesSource.includes("invokeEdge<") && queriesSource.includes("'update-member-email'"));
  check('member detail offers email correction before acceptance', detailSource.includes('memberDetail.changeEmail') && detailSource.includes("invitationStatus !== 'accepted'"));
  check('member creation maps duplicate aadhaar and rejected email errors', newSource.includes("'AADHAAR_EXISTS'") && newSource.includes("'INVITATION_EMAIL_REJECTED'"));
}

{
  const queriesSource = fs.readFileSync(path.join(root, 'src/data/api/queries.ts'), 'utf8');
  const plansSource = fs.readFileSync(path.join(root, 'app/plans.tsx'), 'utf8');
  check('plan descriptions are saved through the rpc', queriesSource.includes('p_blurb: input.blurb'));
  check('plans screen uses localized copy', plansSource.includes("t('plans.") && !plansSource.includes("'Membership plans'") && !plansSource.includes("'Create plan'"));
}

{
  // A renewal paid before the current term ends must surface the queued
  // term and every receipt — the ledger is the only audit trail admins see.
  const mapper = runModule('src/data/api/mapper.ts', {
    './api': {
      normalizeStatus: (s) => ['active', 'expiring', 'expired', 'paused', 'due', 'upcoming'].includes(s) ? s : 'none',
      todayIso: () => '2026-09-12',
    },
  });
  const term = (id, start, end, status) => ({
    id, plan_id: 'plan-1', plan_name: 'Monthly', state: 'active', status,
    start_date: start, end_date: end, amount_due: 0, grace_until: null,
    pause_until: null, price: 1500, currency: 'INR',
  });
  const detail = {
    id: 'db-1', member_number: 'MRD-0001', first_name: 'Test', last_name: 'Member',
    email: 'm@example.com', phone: null, date_of_birth: null,
    emergency_contact_name: null, emergency_contact_phone: null, national_id: null,
    address: null, account_state: 'active', removed_at: null, removal_reason: null,
    created_at: '2026-09-01T00:00:00Z', as_of: '2026-09-12', invitation: null,
    memberships: [term('ms-1', '2026-09-12', '2026-10-11', 'active'), term('ms-2', '2026-10-12', '2026-11-11', 'upcoming')],
    payments: [
      { id: 'pay-1', receipt_number: 'MRD-R-2026-000032', membership_id: 'ms-1', amount: 1500, currency: 'INR', method: 'cash', kind: 'membership', paid_at: '2026-09-12T10:00:00Z' },
      { id: 'pay-2', receipt_number: 'MRD-R-2026-000033', membership_id: 'ms-2', amount: 1500, currency: 'INR', method: 'upi', kind: 'membership', paid_at: '2026-09-15T10:00:00Z' },
    ],
    check_ins: [], activity: [],
  };
  const mapped = mapper.mapMemberDetail(detail);
  check('mapper picks the covering term as current', mapped.membership?.startDate === '2026-09-12');
  check('mapper surfaces the queued renewal as upcoming', mapped.upcomingMembership?.startDate === '2026-10-12');
  check('mapper keeps the full payment ledger newest-first', mapped.payments.length === 2 && mapped.payments[0].receiptNumber === 'MRD-R-2026-000033');

  const queriesSource = fs.readFileSync(path.join(root, 'src/data/api/queries.ts'), 'utf8');
  const editProfileSource = fs.readFileSync(path.join(root, 'app/edit-profile.tsx'), 'utf8');
  const updatesRowSource = fs.readFileSync(path.join(root, 'src/components/CheckForUpdatesRow.tsx'), 'utf8');
  check('member edit masks a locked aadhaar', editProfileSource.includes('maskAadhaar('));
  check('update check row is android-only', updatesRowSource.includes("Platform.OS !== 'android'"));
  check('admin dashboard refetches in the background', queriesSource.includes('refetchInterval'));
}

{
  // In-house update mechanism: version comparison must classify forced vs
  // optional vs up-to-date exactly — a wrong branch either traps members on
  // a build that still works, or lets a mandatory security update be skipped.
  const asyncStorageState = new Map();
  const appUpdate = runModule('src/lib/app-update.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1.0.3', android: { versionCode: 4 } } } },
    'expo-application': { nativeBuildVersion: '4', nativeApplicationVersion: '1.0.3' },
    '@react-native-async-storage/async-storage': {
      __esModule: true,
      default: {
        getItem: async (k) => asyncStorageState.get(k) ?? null,
        setItem: async (k, v) => { asyncStorageState.set(k, v); },
      },
    },
  });
  const release = { versionCode: 5, minSupportedVersionCode: 4 };
  check('update status: no release published', appUpdate.updateStatus(3, null) === 'up_to_date');
  check('update status: current equals latest', appUpdate.updateStatus(5, release) === 'up_to_date');
  check('update status: newer than latest', appUpdate.updateStatus(6, release) === 'up_to_date');
  check('update status: supported but behind', appUpdate.updateStatus(4, release) === 'optional');
  check('update status: below minimum is forced', appUpdate.updateStatus(3, release) === 'forced');
  check('update status: zero build treated safely', appUpdate.updateStatus(0, release) === 'forced');
  check('update status: malformed release ignored', appUpdate.updateStatus(3, { versionCode: 0, minSupportedVersionCode: 0 }) === 'up_to_date');
  check('installed version code read from native package info', appUpdate.currentVersionCode() === 4);
  const appUpdateDrift = runModule('src/lib/app-update.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1.0.3', android: { versionCode: 9 } } } },
    'expo-application': { nativeBuildVersion: '4', nativeApplicationVersion: '1.0.3' },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null, setItem: async () => undefined } },
  });
  check('native package info wins over stale app.json version code', appUpdateDrift.currentVersionCode() === 4);
  const appUpdateNoNative = runModule('src/lib/app-update.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1.0.3', android: { versionCode: 4 } } } },
    'expo-application': { nativeBuildVersion: null, nativeApplicationVersion: null },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null, setItem: async () => undefined } },
  });
  check('falls back to app.json version code without native info', appUpdateNoNative.currentVersionCode() === 4);
  const gateSource = fs.readFileSync(path.join(root, 'src/components/AppUpdateGate.tsx'), 'utf8');
  check('installer reuses the downloaded apk instead of spinning forever', gateSource.includes("'ready'") && gateSource.includes('update.install') && !gateSource.includes("'installing'"));
  check('install intent grants uri read permission', gateSource.includes('flags: 1 | 268435456'));
  const snoozed = await appUpdate.isUpdateSnoozed(5);
  check('update prompt not snoozed initially', snoozed === false);
  await appUpdate.snoozeUpdate(5);
  check('update prompt snoozed per version', (await appUpdate.isUpdateSnoozed(5)) === true);
  check('snooze is scoped to one version', (await appUpdate.isUpdateSnoozed(6)) === false);
}

{
  // Invite acceptance must not be misclassified as a password recovery once
  // complete_member_onboarding clears profile.mustSetPassword (that used to
  // sign the brand-new member straight back out to the welcome screen).
  const setPasswordSource = fs.readFileSync(path.join(root, 'app/set-password.tsx'), 'utf8');
  check('set-password captures the flow at submit time', setPasswordSource.includes("const flow = isInviteFlow ? 'invite' : 'recovery'") && setPasswordSource.includes('setDone(flow)'));
  check('set-password routes invite completion home, not to sign-in', setPasswordSource.includes("if (done === 'invite')") && !setPasswordSource.includes('[done, isInviteFlow, router, signOut]'));
}

{
  // Aadhaar write-once: the edit screen must render the locked field when a
  // value exists and keep the input only for members still missing one.
  const editProfileSource = fs.readFileSync(path.join(root, 'app/edit-profile.tsx'), 'utf8');
  check('aadhaar locks once set', editProfileSource.includes('m.nationalId ?') && editProfileSource.includes('profile.nationalIdLockedHint'));
  const migrationSource = fs.readFileSync(path.join(root, 'supabase/migrations/20260913000000_aadhaar_lock_and_app_releases.sql'), 'utf8');
  check('aadhaar write-once trigger exists', migrationSource.includes('members_national_id_write_once') && migrationSource.includes('is distinct from old.national_id'));
  check('app release rpcs exist', migrationSource.includes('latest_app_release') && migrationSource.includes('publish_app_release'));
  check('release reads work before sign-in', migrationSource.includes('grant execute on function public.latest_app_release() to anon'));
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall client verification checks passed');
