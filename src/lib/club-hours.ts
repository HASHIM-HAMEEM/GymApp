import type { ClubDay, ClubHour } from '@/data/types';
import type { Language, TranslationKey } from '@/lib/i18n';

export const CLUB_DAYS: ClubDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const defaults: ClubHour[] = [
  { day: 'monday', label: 'Monday', value: '6:00 AM–11:00 PM', open: '06:00', close: '23:00', closed: false },
  { day: 'tuesday', label: 'Tuesday', value: '6:00 AM–11:00 PM', open: '06:00', close: '23:00', closed: false },
  { day: 'wednesday', label: 'Wednesday', value: '6:00 AM–11:00 PM', open: '06:00', close: '23:00', closed: false },
  { day: 'thursday', label: 'Thursday', value: '6:00 AM–11:00 PM', open: '06:00', close: '23:00', closed: false },
  { day: 'friday', label: 'Friday', value: '7:00 AM–9:00 PM', open: '07:00', close: '21:00', closed: false },
  { day: 'saturday', label: 'Saturday', value: '6:00 AM–10:00 PM', open: '06:00', close: '22:00', closed: false },
  { day: 'sunday', label: 'Sunday', value: 'Closed', open: null, close: null, closed: true },
];

export function normalizeClubHours(raw: unknown): ClubHour[] {
  if (!Array.isArray(raw)) return defaults.map((row) => ({ ...row }));
  const byDay = new Map<string, Record<string, unknown>>();
  raw.forEach((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const value = row as Record<string, unknown>;
      if (typeof value.day === 'string') byDay.set(value.day, value);
    }
  });
  if (!CLUB_DAYS.every((day) => byDay.has(day))) return defaults.map((row) => ({ ...row }));
  return CLUB_DAYS.map((day) => {
    const row = byDay.get(day)!;
    const closed = row.closed === true;
    const open = !closed && typeof row.open === 'string' ? row.open : null;
    const close = !closed && typeof row.close === 'string' ? row.close : null;
    return {
      day,
      label: typeof row.label === 'string' ? row.label : day,
      value: typeof row.value === 'string' ? row.value : closed ? 'Closed' : `${open ?? ''}–${close ?? ''}`,
      open,
      close,
      closed,
    };
  });
}

export function clubDayKey(day: ClubDay): TranslationKey {
  return `day.${day}` as TranslationKey;
}

export function formatClubClock(value: string | null, language: Language): string {
  if (!value || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return '—';
  const [hours, minutes] = value.split(':').map(Number);
  return new Intl.DateTimeFormat(language === 'ur' ? 'ur-PK' : 'en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2020, 0, 1, hours, minutes)));
}

export function clubHoursValue(hour: ClubHour, language: Language, closedLabel: string): string {
  return hour.closed ? closedLabel : `${formatClubClock(hour.open, language)}–${formatClubClock(hour.close, language)}`;
}

export function todayClubHour(hours: ClubHour[], isoDate: string): ClubHour | undefined {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  const day = CLUB_DAYS[(date.getUTCDay() + 6) % 7];
  return hours.find((row) => row.day === day);
}
