import type { MembershipStatus } from './types';
import { colors, type ColorSet } from '@/theme/tokens';
import type { Language } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const UR_MONTHS_SHORT = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
const UR_DAYS_SHORT = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];

function monthShort(m: number, language?: Language): string {
  return (language === 'ur' ? UR_MONTHS_SHORT : EN_MONTHS_SHORT)[m - 1] ?? '';
}

function dayShort(d: number, language?: Language): string {
  return (language === 'ur' ? UR_DAYS_SHORT : EN_DAYS_SHORT)[d] ?? '';
}

/** Format an ISO date (YYYY-MM-DD) as "24 Sep 2026". */
export function fmtLong(iso: string, language?: Language): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${parseInt(d, 10)} ${monthShort(parseInt(mo, 10), language)} ${y}`;
}

/** Format an ISO date as "24 Sep". */
export function fmtShort(iso: string, language?: Language): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, , mo, d] = m;
  return `${parseInt(d, 10)} ${monthShort(parseInt(mo, 10), language)}`;
}

export function fmtMonthDay(iso: string, language?: Language): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, , mo, d] = m;
  return language === 'ur' ? `${parseInt(d, 10)} ${monthShort(parseInt(mo, 10), language)}` : `${monthShort(parseInt(mo, 10), language)} ${parseInt(d, 10)}`;
}

/** Format an ISO datetime (YYYY-MM-DDTHH:mm) as "18 Sep 2026 · 6:41 PM". */
export function fmtDateTime(iso: string, language?: Language): string {
  const [date, time] = iso.split('T');
  const t = time ? formatTime(time.slice(0, 5), language) : '';
  return `${fmtLong(date, language)}${t ? ' · ' + t : ''}`;
}

export function fmtTime(iso: string, language?: Language): string {
  const time = iso.split('T')[1]?.slice(0, 5);
  if (!time) return '';
  return formatTime(time, language);
}

/** "19:32" → "7:32 PM" */
export function formatTime(t: string, language?: Language): string {
  if (language === 'ur') {
    const formatted = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (formatted) {
      const marker = formatted[3].toUpperCase() === 'PM' ? 'شام' : 'صبح';
      return `${formatted[1]}:${formatted[2]} ${marker}`;
    }
  }
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? (language === 'ur' ? 'شام' : 'PM') : language === 'ur' ? 'صبح' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

export function fmtDayName(dayIndex: number, language?: Language): string {
  return dayShort(dayIndex, language);
}

export function fmtTodayLabel(iso: string, language?: Language): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, , mo, d] = m;
  const day = dayShort(new Date(iso + 'T00:00:00').getDay(), language);
  const date = `${parseInt(d, 10)} ${monthShort(parseInt(mo, 10), language)}`;
  return language === 'ur' ? `${date} · ${day}` : `${day} · ${date}`;
}

/** Days between two ISO dates (positive if a after b). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((da - db) / 86400000);
}

/** Today's ISO date in a timezone (club default: Asia/Kolkata). */
export function todayIso(timeZone: string = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  EGP: 'E£',
  USD: '$',
  AED: 'AED ',
};

/** Currency-aware money label, e.g. "₹2,499" for INR. */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | undefined,
  language?: Language,
): string {
  const symbol = CURRENCY_SYMBOLS[currency ?? 'INR'] ?? `${currency ?? ''} `;
  return translate(language ?? 'en', 'common.money', {
    symbol,
    amount: (amount ?? 0).toLocaleString('en-IN'),
  });
}

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
  currency?: string;
}, cs?: ColorSet, language: Language = 'en'): StatusVisual {
  const c = cs ?? colors as ColorSet;
  const days = daysBetween(membership.expiryDate, todayIso());
  const dueAmount = formatMoney(membership.amountDue, membership.currency, language);

  switch (status) {
    case 'active':
      return {
        tagLabel: translate(language, 'status.active'),
        tagVariant: 'ok',
        dotVariant: 'ok',
        fillColor: c.accent,
        nowColor: c.accent,
        endColor: c.accent,
      };
    case 'expiring':
      return {
        tagLabel: translate(language, 'status.expiring'),
        tagVariant: 'warn',
        dotVariant: 'warn',
        fillColor: c.warnDot,
        nowColor: c.warnDot,
        endColor: c.accent,
        bannerVariant: 'warn',
        bannerText: translate(language, 'status.expiringBanner', { days: Math.max(0, days), date: fmtLong(membership.expiryDate, language) }),
      };
    case 'expired':
      return {
        tagLabel: translate(language, 'status.expired'),
        tagVariant: 'bad',
        dotVariant: 'bad',
        fillColor: c.lineStrong,
        nowColor: c.ink3,
        endColor: c.badDot,
        bannerVariant: 'error',
        bannerText: translate(language, 'status.expiredBanner', { days: Math.abs(days), date: fmtLong(membership.expiryDate, language) }),
      };
    case 'paused':
      return {
        tagLabel: translate(language, 'status.paused'),
        tagVariant: 'muted',
        dotVariant: 'muted',
        fillColor: c.ink3,
        nowColor: c.ink3,
        endColor: c.ink3,
        bannerVariant: 'info',
        bannerText: membership.pauseEnds
          ? translate(language, 'status.pausedUntilBanner', { date: fmtShort(membership.pauseEnds, language) })
          : translate(language, 'status.pausedBanner'),
      };
    case 'due':
      return {
        tagLabel: translate(language, 'status.due'),
        tagVariant: 'warn',
        dotVariant: 'warn',
        fillColor: c.accent,
        nowColor: c.accent,
        endColor: c.accent,
        bannerVariant: 'warn',
        bannerText: translate(language, 'status.dueBanner', { amount: dueAmount }),
      };
    case 'upcoming':
      return {
        tagLabel: translate(language, 'status.upcoming'),
        tagVariant: 'muted',
        dotVariant: 'muted',
        fillColor: c.line,
        nowColor: c.ink3,
        endColor: c.ink3,
        bannerVariant: 'info',
        bannerText: translate(language, 'status.upcomingBanner', { date: fmtLong(membership.expiryDate, language) }),
      };
    case 'none':
    default:
      return {
        tagLabel: translate(language, 'status.none'),
        tagVariant: 'muted',
        dotVariant: 'muted',
        fillColor: c.line,
        nowColor: c.ink3,
        endColor: c.ink3,
      };
  }
}

/** Compute timeline fill % from start → as-of → end. */
export function timelineFill(startDate: string, endDate: string, asOf?: string): { fill: number; now: number } {
  const total = daysBetween(endDate, startDate);
  const done = daysBetween(asOf ?? todayIso(), startDate);
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
