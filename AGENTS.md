# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Meridian — Boutique Gym Membership App

Expo Router + TypeScript. Mock data layer (no database yet). Two roles: member + admin.

## Commands

- Dev (web): `npx expo start --web --port 8081 --clear`
- Typecheck: `npx tsc --noEmit`
- Dev (Expo Go): `npx expo start`

## Structure

- `app/` — Expo Router file-based routes
  - `(auth)/` — splash, signin, otp
  - `(member)/` — member tabs: home, membership, visits, notices, profile
  - `(admin)/` — admin tabs: today, members, scanner, notices
  - `qr.tsx`, `renew.tsx`, `notice.tsx`, `notice-compose.tsx`, `member-detail.tsx`, `edit-profile.tsx`, `member-new.tsx` — stack routes
- `src/theme/tokens.ts` — design tokens (colors, type, spacing, radius, shadows)
- `src/components/` — UI primitives (Icon, Logo, Button, Tag, Field, Surfaces, Chrome, MembershipCard, Timeline, QrCode, Overlays)
- `src/data/` — types, plans, members, format helpers, in-memory store (React context)

## Conventions

- Status colors are reserved for status only (ok/warn/bad). One accent: muted forest green.
- `TODAY` is mocked to `2026-09-20` in `src/data/format.ts` to match the design system.
- The store (`src/data/store.tsx`) holds all mock state + mutations (signIn, renew, checkIn, publishNotice, updateProfile). Swap for a real backend later.
