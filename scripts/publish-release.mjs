#!/usr/bin/env node
// Publish an in-house Android release row so installed apps offer the update.
//
//   npm run publish:release                  # optional update, notes from git
//   npm run publish:release -- --force       # min supported = this build (forces everyone)
//   npm run publish:release -- --dry-run     # print what would be published
//   npm run publish:release -- --notes "..." # override the git-derived notes
//
// Version comes from app.json, the checksum from public/apex.apk, and the
// "what's new" text from the commit subjects since the previous release was
// published. The live APK is downloaded and hashed first so a stale Vercel
// deploy can never be announced. Requires SUPABASE_URL + SUPABASE_SECRET_KEY
// (service role) in .env.local — the admin app has no publish screen.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

function env(names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(' or ')} in .env.local`);
}

const supabaseUrl = env(['SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']).replace(/\/$/, '');
const secretKey = env(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
// latest_app_release is anon-readable (the app calls it before sign-in) and
// deliberately not granted to the service role; read it the way the app does.
const publicKey = env(['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY']);
const apkUrl = option('--apk-url') ?? 'https://apexgc.vercel.app/apex.apk';

const appConfig = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8'));
const versionName = String(appConfig.expo?.version ?? '').trim();
const versionCode = Number(appConfig.expo?.android?.versionCode);
if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error('app.json must define expo.version and expo.android.versionCode');
}

const localSha = createHash('sha256').update(readFileSync(path.join(root, 'public/apex.apk'))).digest('hex');

async function rpc(name, body, key = secretKey) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

const latest = await rpc('latest_app_release', {}, publicKey);
if (latest?.version_code && latest.version_code >= versionCode) {
  throw new Error(
    `app.json is at versionCode ${versionCode} but v${latest.version_name} (build ${latest.version_code}) is already published. Bump app.json and android/app/build.gradle first.`,
  );
}

console.log(`Checking live APK at ${apkUrl} …`);
const live = await fetch(apkUrl, { cache: 'no-store' });
if (!live.ok) throw new Error(`Live APK request failed: HTTP ${live.status}`);
const liveSha = createHash('sha256').update(Buffer.from(await live.arrayBuffer())).digest('hex');
if (liveSha !== localSha) {
  throw new Error(
    `Live APK (${liveSha.slice(0, 12)}…) differs from public/apex.apk (${localSha.slice(0, 12)}…). Deploy first: vercel --prod`,
  );
}

function gitNotes() {
  const since = latest?.published_at ? ['--since', latest.published_at] : ['-n', '15'];
  const subjects = execFileSync('git', ['log', ...since, '--no-merges', '--format=%s'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(chore|ci|test|docs)(\(|:)/i.test(line))
    .map((line) => line.replace(/^(feat|fix|perf|refactor)(\([^)]*\))?:\s*/i, ''))
    .map((line) => line.replace(/\s*\(v?\d+\.\d+\.\d+.*\)\s*$/, ''));
  const unique = [...new Set(subjects)].slice(0, 8);
  return unique.length ? unique.map((line) => `• ${line}`).join('\n') : `Version ${versionName}`;
}

const notes = (option('--notes') ?? gitNotes()).slice(0, 2000);
const minSupported = flag('--force') ? versionCode : Number(option('--min-supported') ?? latest?.min_supported_version_code ?? 1);

console.log(`\nRelease v${versionName} (build ${versionCode})`);
console.log(`  APK      ${apkUrl}`);
console.log(`  sha256   ${localSha}`);
console.log(`  minimum  build ${minSupported}${minSupported === versionCode ? ' (forced update)' : ' (optional update)'}`);
console.log(`  notes\n${notes.split('\n').map((line) => `    ${line}`).join('\n')}\n`);

if (flag('--dry-run')) {
  console.log('Dry run — nothing published.');
  process.exit(0);
}

const id = await rpc('publish_app_release', {
  p_version_code: versionCode,
  p_version_name: versionName,
  p_apk_url: apkUrl,
  p_min_supported_version_code: minSupported,
  p_notes: notes,
  p_sha256: localSha,
});
console.log(`Published release row ${id}. Installed apps will offer the update on next launch.`);
