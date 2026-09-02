/**
 * Meridian — domain types.
 * These mirror the entities implied by the design system screens.
 * All data is mock/in-memory until the database is added later.
 */

export type MembershipStatus =
  | 'active'
  | 'expiring'
  | 'expired'
  | 'paused'
  | 'due'
  | 'none';

export type PaymentMethod = 'InstaPay' | 'Cash' | 'Card' | 'Complimentary';
export type PaymentState = 'Paid' | 'Payment due' | 'Complimentary';

export interface Plan {
  id: string;
  name: string;
  /** months */
  duration: number;
  priceEGP: number;
  blurb: string;
}

export interface Payment {
  method: PaymentMethod;
  state: PaymentState;
  /** ISO date the payment was recorded */
  date: string;
  amountEGP?: number;
}

export interface Membership {
  planId: string;
  planName: string;
  startDate: string; // ISO
  expiryDate: string; // ISO
  status: MembershipStatus;
  payment: Payment;
  /** for paused memberships */
  pauseEnds?: string;
  /** for due memberships */
  amountDue?: number;
  graceUntil?: string;
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
}

export interface ActivityEntry {
  id: string;
  text: React.ReactNode | string;
  /** ISO datetime */
  at: string;
  author?: string;
  kind: 'checkin' | 'membership' | 'create' | 'renew' | 'notice';
}

export interface Member {
  id: string; // MRD-XXXX
  firstName: string;
  lastName: string;
  phone: string; // +20 10 2748 8531
  email?: string;
  dateOfBirth?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  aadharNumber: string;
  address: string;
  memberSince: string; // year or ISO
  membership: Membership | null;
  visits: Visit[];
  activity: ActivityEntry[];
}

export interface AdminUser {
  name: string;
  initials: string;
  reception: 'A' | 'B';
}

export interface Club {
  name: string;
  address: string;
  city: string;
  phone: string;
  hours: { label: string; value: string }[];
}
