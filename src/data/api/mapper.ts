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
    case 'instapay': return 'InstaPay';
    case 'cash': return 'Cash';
    case 'card': return 'Card';
    case 'wallet': return 'Wallet';
    case 'complimentary': return 'Complimentary';
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
    priceEGP: Number(row.price_egp),
    blurb: row.blurb ?? '',
  };
}

export function pickCurrentMembership(rows: ApiMembershipDetail[]): ApiMembershipDetail | null {
  const today = todayIso();
  const covering = rows.find(
    (row) => row.state !== 'cancelled' && row.start_date <= today && today <= row.end_date,
  );
  if (covering) return covering;
  const upcoming = rows.find((row) => row.state !== 'cancelled' && row.start_date > today);
  if (upcoming) return upcoming;
  return rows.find((row) => row.state !== 'cancelled') ?? null;
}

export function mapMembership(
  row: ApiMembershipDetail,
  payments: ApiPaymentDetail[],
): Membership {
  const status = normalizeStatus(row.status);
  const payment = payments.find((candidate) => candidate.membership_id === row.id) ?? null;
  const amountDue = Number(row.amount_due ?? 0);
  const paymentState: PaymentState = row.state === 'cancelled'
    ? 'Complimentary'
    : amountDue > 0
      ? 'Payment due'
      : 'Paid';
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
          amountEGP: payment.amount_egp !== null ? Number(payment.amount_egp) : undefined,
          receiptNumber: payment.receipt_number,
        }
      : { method: 'Cash', state: paymentState, date: row.start_date },
    pauseEnds: row.pause_until ?? undefined,
    amountDue: amountDue > 0 ? amountDue : undefined,
    graceUntil: row.grace_until ?? undefined,
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
  const current = pickCurrentMembership(detail.memberships);
  const membership = current ? mapMembership(current, detail.payments) : null;
  return {
    id: detail.member_number,
    databaseId: detail.id,
    authUserId: undefined,
    accountStatus: detail.account_state === 'active'
      ? 'active'
      : detail.account_state === 'suspended'
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
        payment: { method: 'Cash', state: 'Paid', date: '' },
      };
  return {
    id: row.member_number,
    databaseId: row.member_id,
    accountStatus: row.account_state === 'active'
      ? 'active'
      : row.account_state === 'suspended'
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
    author: row.author_name ?? 'Meridian front desk',
    audience: audienceMap[row.audience] ?? 'All members',
    delivered: row.delivery_count ?? 0,
    urgent: row.urgent,
    read: Boolean(row.read_at),
    readAt: row.read_at ?? undefined,
  };
}

export type { MembershipStatus };
