/**
 * Apex — domain types.
 * These mirror the entities implied by the design system screens.
 * All data is mock/in-memory until the database is added later.
 */

export type Role = 'member' | 'admin' | 'unauth';
export type Language = 'en' | 'ur';
export type AccountStatus = 'invited' | 'active' | 'suspended';
export type InvitationStatus = 'pending' | 'sent' | 'accepted' | 'failed' | 'revoked';

export type MembershipStatus =
  | 'active'
  | 'expiring'
  | 'expired'
  | 'paused'
  | 'due'
  | 'upcoming'
  | 'none';

export type PaymentMethod = 'UPI' | 'Cash' | 'Card' | 'Wallet' | 'Complimentary' | 'InstaPay';
export type PaymentState = 'Paid' | 'Payment due' | 'Complimentary' | 'No payment recorded';

export interface Plan {
  id: string;
  name: string;
  /** months */
  duration: number;
  price: number;
  /** ISO 4217 code, e.g. INR */
  currency: string;
  blurb: string;
}

export interface Payment {
  id?: string;
  method: PaymentMethod;
  state: PaymentState;
  /** ISO date the payment was recorded */
  date: string;
  amount?: number;
  currency?: string;
  receiptNumber?: string;
}

export interface Membership {
  id?: string;
  planId: string;
  planName: string;
  startDate: string; // ISO
  /** Effective expiry (physical end plus credited freeze days) */
  expiryDate: string; // ISO
  status: MembershipStatus;
  /** Real payment record; null when nothing was ever recorded */
  payment: Payment | null;
  /** for paused memberships: first accessible day */
  pauseEnds?: string;
  /** for due memberships */
  amountDue?: number;
  graceUntil?: string;
  /** ISO 4217 snapshot of the purchased term */
  currency?: string;
  /** paid days credited back from freezes (audit counter) */
  frozenDays?: number;
  /** consecutive years */
  consecutiveYears?: number;
}

export interface Visit {
  id: string;
  /** ISO date */
  date: string;
  /** "7:32 PM" */
  time: string;
  reception: 'A' | 'B';
  method?: 'qr' | 'manual';
}

export interface Notice {
  id: string;
  category: 'Urgent' | 'Schedule' | 'Hours' | 'Facilities' | 'Renewal';
  title: string;
  body: string;
  /** ISO date */
  date: string;
  author: string;
  audience: 'All members' | 'Active only' | 'Expiring soon';
  delivered: number;
  urgent: boolean;
  read?: boolean;
  readAt?: string;
}

export interface ActivityEntry {
  id: string;
  text: React.ReactNode | string;
  /** ISO datetime */
  at: string;
  author?: string;
  kind: 'checkin' | 'membership' | 'create' | 'renew' | 'notice';
}

export type MemberPayment = {
  id: string;
  receiptNumber: string;
  amount: number;
  currency?: string;
  method: string;
  kind: string;
  /** ISO date the payment was recorded */
  date: string;
  planName: string;
  termStart: string;
  termEnd: string;
  membershipCancelled: boolean;
};

export interface Member {
  id: string; // APX-XXXXXX (legacy records may be MRD-XXXX)
  databaseId?: string;
  authUserId?: string;
  accountStatus?: AccountStatus;
  invitationStatus?: InvitationStatus;
  /** Provider/server reason for the last failed send, shown to admins. */
  invitationError?: string;
  firstName: string;
  lastName: string;
  phone: string; // +91 98765 43210
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | 'unspecified';
  email: string;
  dateOfBirth?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  nationalId: string;
  address: string;
  memberSince: string; // year or ISO
  lastVisitAt?: string;
  invitationId?: string;
  /** Set when the admin removed the member (soft delete; records stay for audit) */
  removed?: boolean;
  removedAt?: string;
  removalReason?: string;
  /** New member number created when this removed record was re-enrolled. */
  reenrolledAs?: string;
  /** Server as-of date (club-local) used for current-term selection */
  asOf?: string;
  /** Last day of uninterrupted access already booked across current and queued terms. */
  accessThrough?: string;
  membership: Membership | null;
  /** Earliest non-cancelled term starting after the as-of date (a paid renewal queued behind the current term) */
  upcomingMembership: Membership | null;
  /** Full payment ledger, newest first */
  payments: MemberPayment[];
  visits: Visit[];
  activity: ActivityEntry[];
}

export interface AppProfile {
  id: string;
  role: Exclude<Role, 'unauth'>;
  displayName: string;
  initials: string;
  reception?: 'A' | 'B';
  status: AccountStatus;
  mustSetPassword: boolean;
  preferredLanguage: Language;
}

export interface AdminUser {
  id?: string;
  name: string;
  initials: string;
  reception: 'A' | 'B';
}

export interface QrPass {
  value: string;
  expiresAt: string;
}

export type ClubDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface ClubHour {
  day: ClubDay;
  label: string;
  value: string;
  open: string | null;
  close: string | null;
  closed: boolean;
}

export interface Club {
  name: string;
  address: string;
  city: string;
  phone: string;
  hours: ClubHour[];
}
