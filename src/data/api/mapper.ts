import type {
  ActivityEntry,
  Member,
  Membership,
  MembershipStatus,
  Notice,
  Payment,
  PaymentMethod,
  PaymentState,
  Plan,
  Visit,
} from '@/data/types';
import type {
  ApiActivityDetail,
  ApiCheckInDetail,
  ApiMemberDetail,
  ApiMembershipDetail,
  ApiNoticeTableRow,
  ApiPaymentDetail,
  ApiPlanRow,
  ApiSearchRow,
} from './api';
import { normalizeStatus, todayIso } from './api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function paymentMethodLabel(method: string): PaymentMethod {
  switch (method) {
    case 'upi': return 'UPI';
    case 'cash': return 'Cash';
    case 'card': return 'Card';
    case 'wallet': return 'Wallet';
    case 'complimentary': return 'Complimentary';
    // Historical fixture rows recorded before the India switch.
    case 'instapay': return 'InstaPay';
    default: return 'Cash';
  }
}

function memberSinceLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

export function mapPlan(row: ApiPlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    duration: row.duration_months,
    price: Number(row.price),
    currency: row.currency,
    blurb: row.blurb ?? '',
  };
}

/**
 * Pick the term the server considers current, using the server-provided
 * as-of date: the term covering that date, else the nearest upcoming,
 * else the latest purchased term. Server `end_date` values are already
 * effective (freeze credit included).
 */
export function pickCurrentMembership(rows: ApiMembershipDetail[], asOf?: string): ApiMembershipDetail | null {
  const live = rows.filter((row) => row.state !== 'cancelled');
  if (live.length === 0) return null;
  const today = asOf ?? todayIso();
  const covering = live.find(
    (row) => row.start_date <= today && today <= row.end_date,
  );
  if (covering) return covering;
  const upcoming = live
    .filter((row) => row.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (upcoming.length > 0) return upcoming[0];
  return live.reduce((latest, row) => (row.end_date > latest.end_date ? row : latest), live[0]);
}

export function mapMembership(
  row: ApiMembershipDetail,
  payments: ApiPaymentDetail[],
): Membership {
  const status = normalizeStatus(row.status);
  const payment = payments.find((candidate) => candidate.membership_id === row.id) ?? null;
  const amountDue = Number(row.amount_due ?? 0);
  // Real payment data only — nothing is fabricated. A due membership that
  // was never paid shows "No payment recorded", not an invented Cash row.
  const paymentState: PaymentState = row.state === 'cancelled'
    ? 'Complimentary'
    : amountDue > 0
      ? 'Payment due'
      : payment
        ? 'Paid'
        : 'No payment recorded';
  return {
    id: row.id,
    planId: row.plan_id,
    planName: row.plan_name,
    startDate: row.start_date,
    expiryDate: row.end_date,
    status,
    payment: payment
      ? {
          id: payment.id,
          method: paymentMethodLabel(payment.method),
          state: paymentState,
          date: payment.paid_at.slice(0, 10),
          amount: payment.amount !== null ? Number(payment.amount) : undefined,
          currency: payment.currency ?? undefined,
          receiptNumber: payment.receipt_number,
        }
      : null,
    pauseEnds: row.pause_until ?? undefined,
    amountDue: amountDue > 0 ? amountDue : undefined,
    graceUntil: row.grace_until ?? undefined,
    currency: row.currency ?? undefined,
    frozenDays: row.frozen_days ?? undefined,
  };
}

export function mapVisits(rows: ApiCheckInDetail[]): Visit[] {
  return rows
    .filter((row) => row.admitted)
    .map((row) => ({
      id: row.id,
      date: row.checked_in_at.slice(0, 10),
      time: formatClock(row.checked_in_at),
      reception: (row.reception === 'B' ? 'B' : 'A') as 'A' | 'B',
      method: row.source === 'qr' ? 'qr' : 'manual',
    }));
}

export function mapActivity(rows: ApiActivityDetail[]): ActivityEntry[] {
  const kindMap: Record<string, ActivityEntry['kind']> = {
    member_created: 'create',
    invitation_sent: 'create',
    invitation_failed: 'create',
    onboarding_completed: 'create',
    membership_started: 'membership',
    membership_renewed: 'renew',
    membership_state_changed: 'membership',
    check_in: 'checkin',
    notice_published: 'notice',
    profile_updated: 'membership',
  };
  return rows.map((row) => ({
    id: row.id,
    kind: kindMap[row.kind] ?? 'membership',
    text: row.description,
    at: row.occurred_at,
    author: row.author ?? undefined,
  }));
}

export function mapMemberDetail(detail: ApiMemberDetail): Member {
  const current = pickCurrentMembership(detail.memberships, detail.as_of);
  const membership = current ? mapMembership(current, detail.payments) : null;
  return {
    id: detail.member_number,
    databaseId: detail.id,
    authUserId: undefined,
    asOf: detail.as_of,
    accountStatus: detail.account_state === 'active'
      ? 'active'
      : detail.account_state === 'suspended' || detail.account_state === 'removed'
        ? 'suspended'
        : 'invited',
    invitationStatus: detail.invitation
      ? (detail.invitation.status === 'cancelled' ? 'revoked' : detail.invitation.status) as Member['invitationStatus']
      : undefined,
    invitationId: detail.invitation?.id,
    firstName: detail.first_name,
    lastName: detail.last_name,
    phone: detail.phone ?? '',
    email: detail.email,
    dateOfBirth: detail.date_of_birth ?? undefined,
    emergencyName: detail.emergency_contact_name ?? undefined,
    emergencyPhone: detail.emergency_contact_phone ?? undefined,
    nationalId: detail.national_id ?? '',
    address: detail.address ?? '',
    memberSince: memberSinceLabel(detail.created_at),
    removed: Boolean(detail.removed_at),
    removedAt: detail.removed_at ?? undefined,
    removalReason: detail.removal_reason ?? undefined,
    membership,
    visits: mapVisits(detail.check_ins),
    activity: mapActivity(detail.activity),
  };
}

export function mapSearchRow(row: ApiSearchRow): Member {
  const status = normalizeStatus(row.membership_status);
  const membership: Membership | null = row.membership_status === 'none' || !row.membership_end_date
    ? null
    : {
        planId: '',
        planName: row.membership_plan_name ?? '',
        startDate: '',
        expiryDate: row.membership_end_date,
        status,
        payment: null,
      };
  return {
    id: row.member_number,
    databaseId: row.member_id,
    removed: row.membership_status === 'removed' || row.account_state === 'removed',
    accountStatus: row.account_state === 'active'
      ? 'active'
      : row.account_state === 'suspended' || row.account_state === 'removed'
        ? 'suspended'
        : 'invited',
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone ?? '',
    email: row.email,
    nationalId: '',
    address: '',
    memberSince: '',
    membership,
    lastVisitAt: row.last_check_in ?? undefined,
    visits: [],
    activity: [],
  };
}

export function mapNoticeRow(row: ApiNoticeTableRow): Notice {
  const categoryMap: Record<string, Notice['category']> = {
    urgent: 'Urgent',
    schedule: 'Schedule',
    hours: 'Hours',
    facilities: 'Facilities',
    renewal: 'Renewal',
  };
  const audienceMap: Record<string, Notice['audience']> = {
    all_members: 'All members',
    active_only: 'Active only',
    expiring_soon: 'Expiring soon',
  };
  return {
    id: row.id,
    category: categoryMap[row.category] ?? 'Schedule',
    title: row.title,
    body: row.body,
    date: row.published_at.slice(0, 10),
    author: row.author_name ?? 'Apex front desk',
    audience: audienceMap[row.audience] ?? 'All members',
    delivered: row.delivery_count ?? 0,
    urgent: row.urgent,
    read: Boolean(row.read_at),
    readAt: row.read_at ?? undefined,
  };
}

export type { MembershipStatus };
