# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Apex — Boutique Gym Membership App

Expo Router + TypeScript on a Supabase backend (Postgres + Auth + Edge Functions). Two roles: member + admin. **No SMS anywhere** — email only, via Supabase Auth with Resend custom SMTP (configured in the dashboard, not in code).

## Accounts & auth model (do not regress)

- **No public signup.** `enable_signup` is off. Only admins create member accounts.
- Admin creates a member in the app → `create-member-invitation` Edge Function → `auth.admin.inviteUserByEmail` → member gets a one-time email link.
- The link opens `/confirm`, which exchanges `token_hash` via `verifyOtp` (type `invite` or `recovery`). Tokens never appear in storage or deep links as sessions.
- The member then sets a password at `/set-password`; `complete_member_onboarding()` activates the account and marks the invitation accepted.
- Day-to-day sign-in is **email + password** (`/signin`). Password reset uses `resetPasswordForEmail` → same `/confirm` → `/set-password` path.
- Roles live in `public.profiles` (`role`, `account_state`), never in `user_metadata`. Authorization is enforced server-side: RLS policies + `current_user_is_admin()` RPC checks. The service/secret key exists only in Edge Functions and `scripts/bootstrap-admin.mjs`.
- One admin is bootstrapped locally: `npm run bootstrap:admin` (refuses if a different active admin already exists).
- The "Aadhaar" field is the Indian national ID, stored as `members.national_id` and treated as private PII; validated with a Verhoeff checksum in SQL and the Edge Functions.

## Commands

- Dev (web): `npx expo start --web --port 8081 --clear`
- Dev (Expo Go): `npx expo start`
- Typecheck: `npm run typecheck` (typed routes regenerate when the dev server starts)
- Web production build: `npx expo export --platform web`
- Bootstrap the first admin: `npm run bootstrap:admin`
- Local database: `supabase start` (needs Docker), then `supabase db reset`, `supabase test db` (pgTAP), `supabase functions serve`
- Apply migrations to the linked project: `supabase db push`; deploy functions: `supabase functions deploy create-member-invitation resend-member-invitation`

## Backend layout (`supabase/`)

- `config.toml` — local auth settings: signup off, email confirmations on, 15-min OTP expiry, Mailpit at :54324, redirect allow-list (`apex://**`, `http://localhost:8081/**`, `exp://**`)
- `migrations/` — chronological SQL, all verified against a throwaway Postgres instance and applied to the hosted project: (1) schema + RLS + core RPCs; (2) invitation operations + member views; (3) profiles.reception; (4) permission/index hardening + consolidated RLS policies; (5) account lifecycle fixes (first-admin onboarding, single-attempt counting, active-only `current_member_id`); (6) fast rotating QR passes; (7) club settings + cancelled-last status ordering.
- `templates/` — invite + recovery emails using one-time `{{ .TokenHash }}` links to `{{ .RedirectTo }}` (hosted project: equivalents configured in Dashboard → Auth → Emails).
- `functions/` — Deno Edge Functions (`create-member-invitation`, `resend-member-invitation`) with `_shared/` helpers. Pinned `npm:@supabase/supabase-js@2.112.4`. Checked with the shim in `runtime.d.ts` (see Verification below).
- `tests/` — pgTAP RLS/behavior suite (53 assertions), run with `supabase test db`.

### Database contract essentials

- Derived membership status (`membership_status()`): stored `state` is only `active|paused|cancelled`; `active/expiring/expired/due/upcoming` are computed from dates + `amount_due`. Never persist a computed status. **Cancelled memberships always sort last** in `member_admission`, `admin_dashboard`, `search_members`, and `publish_notice` audience selection — a cancelled renewal must never shadow the member's real current/expired term.
- Append-only tables: `payments`, `check_ins`, `activity_log` (triggers reject UPDATE/DELETE).
- Every mutation is an RPC: `create_member_invitation`, `renew_membership` (**no manual start dates — always pass `p_start_date: null`; the server starts renewals after the current term or today**), `set_membership_state` (pause needs `p_pause_until` within the term), `check_in_member`, `check_in_by_qr`, `publish_notice` (snapshots recipients), `mark_notice_read`, `update_member_profile`, `update_admin_profile` (admin display name + reception desk), `update_club_config` (club name/address/city/phone/hours — what members see in-app), `issue_qr_pass(p_revoke_existing)` (rotating QR; see below).
- Service-role-only RPCs: `finalize_member_invitation`, `mark_member_invitation_failed`, `member_invitation_auth_user`, `active_admin_profiles`, `bootstrap_admin_profile`, `claim_member_invitation_resend` guards (60s cooldown, 10-attempt cap, 24h expiry renewal per resend).
- QR passes are opaque 64-hex/256-bit tokens; only their SHA-256 hash is stored; single-use; 60s TTL; auto-refresh every 45s keeping one predecessor valid (no scan races); manual regenerate passes `p_revoke_existing: true` and invalidates every prior pass immediately.

## App structure

- `app/` — Expo Router file-based routes
  - `(auth)/` — splash, welcome, signin, forgot-password
  - `(member)/` — member tabs: home, membership, visits, notices, profile
  - `(admin)/` — admin tabs: today, members, scanner, notices, profile
  - `confirm.tsx` (public email-link exchange), `set-password.tsx`, `qr.tsx`, `renew.tsx`, `notice.tsx`, `notice-compose.tsx`, `member-detail.tsx`, `edit-profile.tsx`, `member-new.tsx` — stack routes
  - Root `_layout.tsx` uses `Stack.Protected`: `(auth)` when signed out; role groups + shared routes when signed in; `set-password` while `must_set_password` is set.
- `src/lib/supabase.ts` — client init; chunked `expo-secure-store` session storage on native, localStorage on web; `AppState`-driven token refresh.
- `src/providers/AppProvider.tsx` — session/profile/role context + TanStack Query provider. `useApp()` exposes auth actions (`signIn`, `signOut`, `sendPasswordReset`, `setPassword`, `updateEmail`) and theme.
- `src/data/api/` — `api.ts` (raw RPC/table row types), `mapper.ts` (row → domain), `queries.ts` (hooks/mutations, `ApiCallError` with stable codes). Screens consume these hooks; **no screens query Supabase directly**.
- `src/data/store.tsx` — compatibility re-export of the provider (legacy import path).
- `src/data/plans.ts` — `PLANS`/`CLUB` are seed-matching fallbacks; live values come from `usePlans()`/`useClub()`.
- `src/data/format.ts` — `TODAY` is the real date in Africa/Cairo (was mocked to 2026-09-20).
- `src/components/`, `src/theme/tokens.ts` — unchanged UI layer.

## Environment

Copy `.env.example` → `.env.local`. App needs `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (optional `EXPO_PUBLIC_AUTH_REDIRECT_URL`, defaults to `Linking.createURL('confirm')`). Edge Functions and the bootstrap script need `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), `APP_AUTH_REDIRECT_URL`. Never commit `.env*`; the publishable key is safe client-side, the secret key never reaches the app. Quote multi-word values (e.g. `ADMIN_NAME="Club Administrator"`).

## Deployment

- Web production is hosted on Vercel (project `firdous-gym-app`, team `fins-projects-5c53b9dd`, URL https://firdous-gym-app.vercel.app). `vercel.json` builds with `npm run build:web`, outputs `dist/`, and rewrites all paths to `/index.html` (SPA fallback). Only the three `EXPO_PUBLIC_*` variables are set in Vercel — never put Supabase secret/service-role or Resend keys there.
- Supabase hosted project: `fpgkhhudgiaogxkpafsx` (org Firdous GYM APP). Auth configured in-dashboard (editable via Management API `PATCH /v1/projects/{ref}/config/auth`): signup off, email confirmation on, password policy 10+ with mixed case + digits, Resend SMTP (`auth@scnz.site`), Apex-branded invite/recovery subjects + templates with `{{ .RedirectTo }}?token_hash={{ .TokenHash }}` links, `site_url` https://apexgc.vercel.app, sender name "Apex", redirect allow-list includes `apex://**`.
- Android remote push is intentionally NOT configured (owner decision: no Firebase/FCM). Notices rely on in-app delivery with 30s auto-refresh; local (in-app) notifications work, including the "Send test notification" diagnostic in notification settings. The Expo project `@scnz/apex` (ID `6b5d5a06-d024-4e46-9aa7-c9371a8ff9ab`) is linked for future use. Do not add Firebase/google-services.json unless the owner asks.
- Push receipt reconciliation cron: `apex-push-receipts` every 5 min; expiry reminders cron: `apex-expiry-reminders` at 09:00/09:15 IST. Both call Edge Functions with `x-cron-secret` verified against the `apex_cron_secret` Vault secret via the service-role-only `verify_cron_secret()` RPC. Resend key for expiry reminders is stored in Vault (`apex_resend_api_key`, set via `set_expiry_resend_key()`), never in Edge Function env.

## Verification

- `npm run typecheck` — must pass (app; excludes `supabase/`).
- Edge Functions typecheck (Deno-style, from repo root):
  `cd supabase/functions && npx tsc --noEmit --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --strict --allowImportingTsExtensions --ignoreConfig runtime.d.ts create-member-invitation/index.ts resend-member-invitation/index.ts`
- `node --check scripts/bootstrap-admin.mjs`
- SQL smoke (no Docker): apply `supabase/migrations/*.sql` in order to a scratch Postgres with a stubbed `auth` schema (`auth.users` + `auth.uid()`/`auth.role()` reading `request.jwt.claims`/`request.jwt.claim.role`), then exercise the RPC lifecycle.
- `npx expo export --platform web` — full production bundle check.

## Conventions

- Status colors are reserved for status only (ok/warn/bad). One accent: muted forest green.
- Money and dates come from the server (receipt numbers, expiry dates, member numbers `MRD-0000`). Never generate IDs client-side.
- `search_members` supports `p_status` filter; membership lists/admin dashboard use RPCs, not client-side filters over full tables.

- Status colors are reserved for status only (ok/warn/bad). One accent: muted forest green.
- Money and dates come from the server (receipt numbers, expiry dates, member numbers `MRD-0000`). Never generate IDs client-side.
- `search_members` supports `p_status` filter; membership lists/admin dashboard use RPCs, not client-side filters over full tables.

## Git commits

- Commit as `trashbin2605@gmail.com` (set repo-locally) — the email of the Vercel account that owns the project. On the Hobby plan with a private repo, Vercel blocks any deployment whose commit author is not the account owner.

## Design Craft (Refero Skill)

Apex follows the `refero-design` skill recorded in `skills-lock.json`. Apply these conventions to UI work.

### Typography
- Type scale uses max 6–8 sizes. Preferred set: **11, 13, 15, 18, 26, 30 px** (Minor Third 1.200).
- Avoid fractional font sizes (e.g., 12.5, 14.5, 15.5 px).
- Small text (11–13 px) must include `letterSpacing` of at least **0.01em**.
- Font weights: 400 / 500 / 600 only. One font family across the app.

### Motion
- Add motion tokens to `src/theme/tokens.ts`: `duration.fast=120ms`, `duration.default=200ms`, `duration.slow=320ms`.
- Easing: `ease-out` for enter, `ease-in` for exit.
- Support `prefers-reduced-motion` (non-optional).
- Animate `Sheet`, `ConfirmModal`, and `Switch` appearances; Button already has a press scale animation.

### Touch & Accessibility
- Minimum touch target is **44×44 px** (`IconButton` is currently 40×40 px — migrate to 44).
- Icon-only buttons require an `aria-label`.
- Form inputs should use `autocomplete` attributes where applicable.
- Focus states use `:focus-visible`.

### Color
- Tokens are named by purpose: `bg`, `ink`, `line`, `accent`.
- Maintain separate dark and light themes (not an inverted palette).
- Semantic colors (`ok`, `warn`, `bad`) with `soft`, `bg`, `dot` variants.
- Accent remains pure white; status colors reserved for status only.

### Copywriting
- Button labels: action + object (e.g., "Save Changes", "Review & publish").
- Error messages: what + why + fix.
- Empty states should teach and guide.

### Anti-AI-Slop Watchlist
- Dark-by-default is intentional for Apex's monochrome brand — keep it.
- Avoid generic AI tells: indigo/violet defaults, cards everywhere, emoji icons, left accent stripes, fake graphics, token role drift.
- Prefer sections with dividers over card wrappers where appropriate.

### Known Issues to Fix
- Consolidate 15 font sizes down to the preferred 6-size scale.
- Add `letterSpacing` to all 11–13 px text.
- Add motion tokens and reduced-motion support.
- Animate `Sheet`, `ConfirmModal`, and `Switch`.
- Enlarge `IconButton` touch target from 40 px to 44 px and add `aria-label`s.
