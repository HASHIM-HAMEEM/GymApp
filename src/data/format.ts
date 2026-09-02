import type { MembershipStatus } from './types';
import { colors, type ColorSet } from '@/theme/tokens';

/** Format an ISO date (YYYY-MM-DD) as "24 Sep 2026". */
export function fmtLong(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(mo, 10) - 1]} ${y}`;
}

/** Format an ISO date as "24 Sep". */
export function fmtShort(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, , mo, d] = m;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(mo, 10) - 1]}`;
}

/** Format an ISO datetime (YYYY-MM-DDTHH:mm) as "18 Sep 2026 · 6:41 PM". */
export function fmtDateTime(iso: string): string {
  const [date, time] = iso.split('T');
  const t = time ? formatTime(time) : '';
  return `${fmtLong(date)}${t ? ' · ' + t : ''}`;
}

/** "19:32" → "7:32 PM" */
export function formatTime(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

/** Days between two ISO dates (positive if a after b). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((da - db) / 86400000);
}

/** Today's ISO date (mocked to 2026-09-20 to match the design system). */
export const TODAY = '2026-09-20';

export interface StatusVisual {
  tagLabel: string;
  tagVariant: 'ok' | 'warn' | 'bad' | 'muted' | 'accent';
  dotVariant: 'ok' | 'warn' | 'bad' | 'muted';
  fillColor: string;
  nowColor: string;
  endColor: string;
  bannerVariant?: 'info' | 'warn' | 'error' | 'offline';
  bannerText?: string;
}

export function statusVisual(status: MembershipStatus, membership: {
  expiryDate: string;
  amountDue?: number;
  pauseEnds?: string;
  graceUntil?: string;
}, cs?: ColorSet): StatusVisual {
  const c = cs ?? colors as ColorSet;
  const days = daysBetween(membership.expiryDate, TODAY);
  switch (status) {
    case 'active':
      return {
        tagLabel: 'Active',
        tagVariant: 'ok',
        dotVariant: 'ok',
        fillColor: c.accent,
        nowColor: c.accent,
        endColor: c.accent,
      };
    case 'expiring':
      return {
        tagLabel: `Expiring soon`,
        tagVariant: 'warn',
        dotVariant: 'warn',
        fillColor: c.warnDot,
        nowColor: c.warnDot,
        endColor: c.accent,
        bannerVariant: 'warn',
        bannerText: `Your plan ends in ${Math.max(0, days)} days, on ${fmtLong(membership.expiryDate)}. Renew at reception to keep your access.`,
      };
    case 'expired':
      return {
        tagLabel: 'Expired',
        tagVariant: 'bad',
        dotVariant: 'bad',
        fillColor: c.lineStrong,
        nowColor: c.ink3,
        endColor: c.badDot,
        bannerVariant: 'error',
        bannerText: `This membership expired on ${fmtLong(membership.expiryDate)}, ${Math.abs(days)} days ago. Access is paused until renewal.`,
      };
    case 'paused':
      return {
        tagLabel: 'Paused',
        tagVariant: 'muted',
        dotVariant: 'muted',
        fillColor: c.ink3,
        nowColor: c.ink3,
        endColor: c.ink3,
        bannerVariant: 'info',
        bannerText: membership.pauseEnds
          ? `Your membership is paused until ${fmtShort(membership.pauseEnds)} at your request. Access resumes automatically.`
          : 'Your membership is paused at your request.',
      };
    case 'due':
      return {
        tagLabel: 'Payment due',
        tagVariant: 'warn',
        dotVariant: 'warn',
        fillColor: c.accent,
        nowColor: c.accent,
        endColor: c.accent,
        bannerVariant: 'warn',
        bannerText: `Payment due: EGP ${membership.amountDue?.toLocaleString() ?? '1,500'}. Your plan is active, but this month's payment hasn't been recorded.`,
      };
    case 'none':
    default:
      return {
        tagLabel: 'No plan',
        tagVariant: 'muted',
        dotVariant: 'muted',
        fillColor: c.line,
        nowColor: c.ink3,
        endColor: c.ink3,
      };
  }
}

/** Compute timeline fill % from start → today → end. */
export function timelineFill(startDate: string, endDate: string): { fill: number; now: number } {
  const total = daysBetween(endDate, startDate);
  const done = daysBetween(TODAY, startDate);
  if (total <= 0) return { fill: 100, now: -1 };
  const fill = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  return { fill, now: fill };
}

/** Initials from a name. */
export function initials(first: string, last: string): string {
  const f = (first || '').trim();
  const l = (last || '').trim();
  // Handle multi-word first names like "Omar Farouk"
  const fInitial = f[0] ?? '';
  const lInitial = l[0] ?? '';
  return (fInitial + lInitial).toUpperCase();
}
