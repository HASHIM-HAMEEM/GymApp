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
  check('secureStorage chunk keys recorded', recordedKeys.some((k) => k.includes('.0')) && recordedKeys.some((k) => k.includes('.chunks')));
  check('secureStorage key charset valid', recordedKeys.every((k) => /^[a-zA-Z0-9._-]+$/.test(k)), recordedKeys.join(','));

  await storage.setItem('sb-project-auth-token', 'short');
  eq('secureStorage overwrite long->short', await storage.getItem('sb-project-auth-token'), 'short');
  check('secureStorage stale chunks removed', !secureStore._store.has('sb-project-auth-token.1') && secureStore._store.get('sb-project-auth-token.0') === 'short');

  secureStore._store.delete('sb-project-auth-token.chunks');
  secureStore._store.set('sb-project-auth-token', 'legacy-value');
  eq('secureStorage legacy direct key', await storage.getItem('sb-project-auth-token'), 'legacy-value');

  await storage.setItem('sb-project-auth-token', longSession);
  secureStore._store.delete('sb-project-auth-token.1');
  eq('secureStorage missing chunk returns null', await storage.getItem('sb-project-auth-token'), null);

  await storage.removeItem('sb-project-auth-token');
  eq('secureStorage removeItem', await storage.getItem('sb-project-auth-token'), null);
  check('secureStorage remove cleans chunks marker', !secureStore._store.has('sb-project-auth-token.chunks'));
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall client verification checks passed');
