import { requireSupabase } from '@/lib/supabase';
import type { MembershipStatus } from '@/data/types';

/* Raw database/RPC row shapes, verified against the local Postgres harness. */

export type ApiPlanRow = {
  id: string;
  slug: string;
  name: string;
  duration_months: number;
  price: number | string;
  currency: string;
  blurb: string | null;
  is_active: boolean;
};

export type ApiClubRow = {
  name: string;
  address: string;
  city: string;
  phone: string;
  timezone: string;
  currency: string;
  hours: { label: string; value: string }[] | null;
};

export type ApiMembershipDetail = {
  id: string;
  plan_id: string;
  plan_name: string;
  state: string;
  status: string;
  start_date: string;
  /** Effective end (physical end plus credited freeze days) */
  end_date: string;
  physical_end_date?: string;
  frozen_days?: number;
  amount_due: number | string | null;
  grace_until: string | null;
  pause_until: string | null;
  price: number | string | null;
  currency: string | null;
};

export type ApiPaymentDetail = {
  id: string;
  receipt_number: string;
  membership_id: string;
  amount: number | string | null;
  currency: string | null;
  method: string;
  kind: string;
  paid_at: string;
};

export type ApiCheckInDetail = {
  id: string;
  source: string;
  reception: string;
  admitted: boolean;
  verdict: string;
  checked_in_at: string;
};

export type ApiActivityDetail = {
  id: string;
  kind: string;
  description: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  author: string | null;
};

export type ApiInvitationDetail = {
  id: string;
  status: string;
  attempts: number;
  email: string;
  last_attempt_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string;
} | null;

export type ApiMemberDetail = {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  national_id: string | null;
  address: string | null;
  account_state: string;
  created_at: string;
  /** Server as-of date in the club's timezone */
  as_of: string;
  invitation: ApiInvitationDetail;
  memberships: ApiMembershipDetail[];
  payments: ApiPaymentDetail[];
  check_ins: ApiCheckInDetail[];
  activity: ApiActivityDetail[];
};

export type ApiSearchRow = {
  member_id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  account_state: string;
  membership_status: string;
  membership_plan_name: string | null;
  membership_end_date: string | null;
  last_check_in: string | null;
};

export type ApiDashboard = {
  as_of: string;
  total_members: number;
  active_members: number;
  expiring_soon: number;
  amount_due_members: number;
  expired_members: number;
  check_ins_today: number;
  pending_invitations: number;
  payments_this_month: number | string;
  payments_this_month_egp?: number | string;
  currency?: string;
  expiring_list: {
    member_id: string;
    member_number: string;
    first_name: string;
    last_name: string;
    plan_name: string | null;
    end_date: string | null;
  }[];
  recent_check_ins: {
    member_number: string;
    first_name: string;
    last_name: string;
    checked_in_at: string;
    reception: string | null;
    source: string | null;
  }[];
};

export type ApiQrPassRow = {
  qr_pass_id: string;
  token: string;
  expires_at: string;
};

export type ApiCheckInByQrRow = {
  check_in_id: string | null;
  admitted: boolean;
  verdict: string;
  membership_id: string | null;
  qr_pass_id: string | null;
  member_id: string | null;
  member_number: string | null;
  first_name: string | null;
  last_name: string | null;
  plan_name: string | null;
  end_date: string | null;
  days_left: number | null;
  checked_in_at: string;
};

export type ApiCheckInManualRow = {
  check_in_id: string;
  admitted: boolean;
  verdict: string;
  membership_id: string | null;
  checked_in_at: string;
};

export type ApiRenewRow = {
  membership_id: string;
  payment_id: string | null;
  receipt_number: string | null;
  start_date: string;
  end_date: string;
  amount_due: number | string | null;
  status: string;
  as_of: string;
};

export type ApiRenewalQuoteRow = {
  start_date: string;
  end_date: string;
  price: number | string;
  currency: string;
  as_of: string;
};

export type ApiSettleRow = {
  payment_id: string;
  receipt_number: string | null;
  amount_paid: number | string;
  amount_due: number | string;
  currency: string;
  as_of: string;
};

export type ApiWaiveRow = {
  payment_id: string;
  receipt_number: string | null;
  amount_due: number | string;
  currency: string;
  as_of: string;
};

export type ApiMembershipStateRow = {
  membership_id: string;
  state: string;
  status: string;
  pause_until: string | null;
};

export type ApiPublishNoticeRow = {
  notice_id: string;
  recipient_count: number;
};

export type ApiNoticeTableRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  audience: string;
  urgent: boolean;
  published_at: string;
  author_name?: string | null;
  read_at?: string | null;
  delivery_count?: number | null;
};

export type ApiCreateInvitationResult = {
  invitationId: string;
  memberId: string;
  memberNumber: string;
  status: string;
};

export type ApiResendInvitationResult = {
  invitationId: string;
  sendAttempts: number;
  status: string;
};

export function normalizeStatus(status: string | null | undefined): MembershipStatus {
  switch (status) {
    case 'active':
    case 'expiring':
    case 'expired':
    case 'paused':
    case 'due':
    case 'upcoming':
      return status;
    default:
      return 'none';
  }
}

/** Today's ISO date in a timezone (club default: Asia/Kolkata). */
export function todayIso(timeZone: string = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

export async function fetchPlans(): Promise<ApiPlanRow[]> {
  const { data, error } = await requireSupabase()
    .from('plans')
    .select('id, slug, name, duration_months, price, currency, blurb, is_active')
    .eq('is_active', true)
    .order('price');
  if (error) throw error;
  return (data ?? []) as ApiPlanRow[];
}

export async function fetchClub(): Promise<ApiClubRow | null> {
  const { data, error } = await requireSupabase()
    .from('club_config')
    .select('name, address, city, phone, timezone, currency, hours')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ApiClubRow | null;
}
