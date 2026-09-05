import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import type { Member, MembershipStatus, Notice, QrPass } from '@/data/types';
import type {
  ApiPlanRow,
  ApiCheckInByQrRow,
  ApiCheckInManualRow,
  ApiCreateInvitationResult,
  ApiDashboard,
  ApiMemberDetail,
  ApiNoticeTableRow,
  ApiPublishNoticeRow,
  ApiQrPassRow,
  ApiRenewRow,
  ApiRenewalQuoteRow,
  ApiResendInvitationResult,
  ApiSearchRow,
  ApiMembershipStateRow,
  ApiSettleRow,
  ApiWaiveRow,
} from './api';
import { fetchClub, fetchPlans, todayIso } from './api';
import { mapMemberDetail, mapNoticeRow, mapPlan, mapSearchRow } from './mapper';
import { CLUB } from '@/data/plans';
import type { Club } from '@/data/types';

type ClubSettings = Club & { timezone?: string; currency?: string };

export class ApiCallError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiCallError';
  }
}

function rpcError(code: string | undefined, message: string | undefined, fallback: string): ApiCallError {
  switch (code) {
    case '42501':
      return new ApiCallError('ADMIN_REQUIRED', 'An active administrator account is required for this action.');
    case '23505':
      return new ApiCallError('DUPLICATE', 'This record already exists or conflicts with an existing one.');
    case '22023':
      return new ApiCallError('VALIDATION_ERROR', message || 'The submitted details are invalid.');
    case 'P0002':
      return new ApiCallError('NOT_FOUND', 'The requested record was not found.');
    default:
      return new ApiCallError('REQUEST_FAILED', fallback);
  }
}

async function callRpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await requireSupabase().rpc(name, args);
  if (error) throw rpcError(error.code, error.message, fallback);
  return (Array.isArray(data) && data.length === 1 ? data[0] : data) as T;
}

async function invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke(name, { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const parsed = (await context.json()) as { error?: { code?: string; message?: string } };
        if (parsed?.error) {
          throw new ApiCallError(
            parsed.error.code ?? 'FUNCTION_ERROR',
            parsed.error.message ?? 'The request could not be completed.',
          );
        }
      } catch (parseError) {
        if (parseError instanceof ApiCallError) throw parseError;
      }
    }
    throw new ApiCallError('FUNCTION_ERROR', 'The request could not be completed. Try again.');
  }
  const payload = (data as { data?: unknown } | null)?.data ?? data;
  return payload as T;
}

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: fetchPlans, select: (rows) => rows.map(mapPlan) });
}

export function useAdminPlans() {
  const { role } = useApp();
  return useQuery({
    queryKey: ['admin-plans'], enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('plans').select('id,slug,name,duration_months,price,currency,blurb,is_active').order('duration_months');
      if (error) throw error;
      return (data ?? []) as ApiPlanRow[];
    },
  });
}

export function useSavePlan() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; name: string; months: number; price: number; active: boolean }) => callRpc<string>('save_membership_plan', {
      p_plan_id: input.id ?? null, p_name: input.name, p_months: input.months, p_price: input.price, p_active: input.active,
    }, 'Plan could not be saved. Check your connection and ensure the pricing database update is installed.'),
    onSuccess: async () => { await Promise.all([cache.invalidateQueries({queryKey:['plans']}),cache.invalidateQueries({queryKey:['admin-plans']})]); },
  });
}

export function useClub() {
  return useQuery({
    queryKey: ['club'],
    queryFn: fetchClub,
    staleTime: 60_000,
    select: (row): ClubSettings => ({
      ...CLUB,
      ...(row ?? {}),
      hours: row?.hours ?? CLUB.hours,
    }),
  });
}

export function useCurrentMember() {
  const { session } = useApp();
  return useQuery({
    queryKey: ['current-member', session?.user.id],
    queryFn: () => callRpc<ApiMemberDetail>('my_member_detail', {}, 'Your membership details could not be loaded.'),
    enabled: Boolean(session?.user.id),
    select: mapMemberDetail,
  });
}

export function useMemberDetail(memberNumber?: string) {
  return useQuery({
    queryKey: ['member', memberNumber],
    queryFn: async (): Promise<Member | null> => {
      const client = requireSupabase();
      const { data: searchRows, error: searchError } = await client.rpc('search_members', {
        p_query: memberNumber!.trim(),
        p_limit: 1,
        p_offset: 0,
        p_status: null,
      });
      if (searchError) throw rpcError(searchError.code, searchError.message, 'The member could not be loaded.');
      const row = (searchRows as ApiSearchRow[] | null)?.find(
        (candidate) => candidate.member_number === memberNumber!.trim(),
      );
      if (!row) return null;
      const detail = await callRpc<ApiMemberDetail>(
        'member_detail',
        { p_member_id: row.member_id },
        'The member could not be loaded.',
      );
      return mapMemberDetail(detail);
    },
    enabled: Boolean(memberNumber),
  });
}

export function useMembers(
  query: string,
  status: 'all' | MembershipStatus,
  enabled = true,
) {
  return useQuery({
    queryKey: ['members', query, status],
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('search_members', {
        p_query: query.trim() || null,
        p_limit: 100,
        p_offset: 0,
        p_status: status === 'all' ? null : status,
      });
      if (error) throw rpcError(error.code, error.message, 'The member list could not be loaded.');
      return ((data as ApiSearchRow[] | null) ?? []).map(mapSearchRow);
    },
    enabled,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => callRpc<ApiDashboard>('admin_dashboard', {}, 'The dashboard could not be loaded.'),
    staleTime: 10_000,
  });
}

export function useNotices(asAdmin = false) {
  return useQuery({
    queryKey: ['notices', asAdmin],
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<Notice[]> => {
      const client = requireSupabase();
      const notices: Notice[] = [];
      for (let offset = 0; ; offset += 200) {
      if (asAdmin) {
        const { data, error } = await client
          .from('notices')
          .select(
            'id, category, title, body, audience, urgent, published_at, ' +
              'author:profiles!notices_author_id_fkey(display_name), notice_deliveries(count)',
          )
          .order('published_at', { ascending: false })
          .order('id', { ascending: false }).range(offset, offset + 199);
        if (error) throw error;
        notices.push(...(data as unknown as ApiNoticeTableRow[]).map((row) => {
          const raw = row as unknown as {
            author?: { display_name: string | null } | null;
            notice_deliveries?: { count: number | null }[] | null;
          };
          return mapNoticeRow({
            ...row,
            author_name: raw.author?.display_name ?? null,
            delivery_count: raw.notice_deliveries?.[0]?.count ?? 0,
          });
        }));
        if (data.length < 200) return notices;
        continue;
      }
      const { data, error } = await client
        .from('notice_deliveries')
        .select('read_at, notices!inner(id, category, title, body, audience, urgent, published_at)')
        .order('delivered_at', { ascending: false })
        .order('id', { ascending: false }).range(offset, offset + 199);
      if (error) throw error;
      notices.push(...(data as unknown as { read_at: string | null; notices: ApiNoticeTableRow }[]).map((row) =>
        mapNoticeRow({ ...row.notices, read_at: row.read_at }),
      ));
      if (data.length < 200) return notices;
      }
    },
  });
}

export function useQrPass(enabled: boolean) {
  return useQuery({
    queryKey: ['qr-pass'],
    queryFn: async (): Promise<QrPass | null> => {
      const row = await callRpc<ApiQrPassRow | null>(
        'issue_qr_pass',
        { p_revoke_existing: false },
        'A QR pass could not be issued.',
      );
      return row ? { value: row.token, expiresAt: row.expires_at } : null;
    },
    enabled,
    refetchInterval: enabled ? 45_000 : false,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useRegenerateQrPass() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<QrPass> => {
      const row = await callRpc<ApiQrPassRow>(
        'issue_qr_pass',
        { p_revoke_existing: true },
        'The QR pass could not be regenerated.',
      );
      return { value: row.token, expiresAt: row.expires_at };
    },
    onSuccess: (pass) => {
      cache.setQueryData(['qr-pass'], pass);
    },
  });
}

export function useUpdateAdminProfile() {
  const cache = useQueryClient();
  const { session } = useApp();
  return useMutation({
    mutationFn: (input: { displayName: string; reception: 'A' | 'B' }) =>
      callRpc<string>(
        'update_admin_profile',
        { p_display_name: input.displayName, p_reception: input.reception },
        'Your administrator profile could not be saved.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['profile', session?.user.id] });
    },
  });
}

export function useUpdateClub() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      address: string;
      city: string;
      phone: string;
      monThuHours: string;
      friHours: string;
      satHours: string;
    }) =>
      callRpc<string>(
        'update_club_config',
        {
          p_name: input.name,
          p_address: input.address,
          p_city: input.city,
          p_phone: input.phone,
          p_mon_thu_hours: input.monThuHours,
          p_fri_hours: input.friHours,
          p_sat_hours: input.satHours,
        },
        'Club details could not be saved.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['club'] });
    },
  });
}

export type DeskPaymentMethod = 'upi' | 'cash' | 'card' | 'wallet';

function newRequestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useRenewMembership() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      memberId: string;
      planId: string;
      amountPaid: number;
      paymentMethod: DeskPaymentMethod | 'complimentary';
      agreedPrice?: number;
      priceNote?: string;
    }) =>
      callRpc<ApiRenewRow>(
        'renew_membership',
        {
          p_member_id: input.memberId,
          p_plan_id: input.planId,
          p_start_date: null,
          p_amount_paid: input.amountPaid,
          p_payment_method: input.paymentMethod,
          p_request_id: newRequestId(),
          ...(input.agreedPrice === undefined ? {} : { p_agreed_price: input.agreedPrice, p_price_note: input.priceNote }),
        },
        'The renewal could not be recorded.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['members'] });
      void cache.invalidateQueries({ queryKey: ['member'] });
      void cache.invalidateQueries({ queryKey: ['current-member'] });
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRenewalQuote(memberId: string | undefined, planId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['renewal-quote', memberId, planId],
    queryFn: () =>
      callRpc<ApiRenewalQuoteRow>(
        'renewal_quote',
        { p_member_id: memberId!, p_plan_id: planId! },
        'The renewal details could not be loaded.',
      ),
    enabled: Boolean(memberId && planId) && enabled,
    staleTime: 30_000,
  });
}

export function useSettleBalance() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      membershipId: string;
      amount: number;
      method: DeskPaymentMethod;
    }) =>
      callRpc<ApiSettleRow>(
        'settle_membership_balance',
        {
          p_membership_id: input.membershipId,
          p_amount: input.amount,
          p_method: input.method,
          p_request_id: newRequestId(),
        },
        'The payment could not be recorded.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['members'] });
      void cache.invalidateQueries({ queryKey: ['member'] });
      void cache.invalidateQueries({ queryKey: ['current-member'] });
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useWaiveBalance() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: { membershipId: string; reason: string }) =>
      callRpc<ApiWaiveRow>(
        'waive_membership_balance',
        {
          p_membership_id: input.membershipId,
          p_reason: input.reason,
          p_request_id: newRequestId(),
        },
        'The waiver could not be recorded.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['members'] });
      void cache.invalidateQueries({ queryKey: ['member'] });
      void cache.invalidateQueries({ queryKey: ['current-member'] });
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSetMembershipState() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: { membershipId: string; action: 'pause' | 'resume'; pauseUntil?: string }) =>
      callRpc<ApiMembershipStateRow>(
        'set_membership_state',
        {
          p_membership_id: input.membershipId,
          p_state: input.action === 'pause' ? 'paused' : 'active',
          p_pause_until: input.action === 'pause' ? (input.pauseUntil ?? null) : null,
          p_reason: null,
        },
        'The membership state could not be changed.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['members'] });
      void cache.invalidateQueries({ queryKey: ['member'] });
      void cache.invalidateQueries({ queryKey: ['current-member'] });
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCheckInManual() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; reception: 'A' | 'B' }) =>
      callRpc<ApiCheckInManualRow>(
        'check_in_member',
        { p_member_id: input.memberId, p_reception: input.reception },
        'The check-in could not be recorded.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
      void cache.invalidateQueries({ queryKey: ['member'] });
    },
  });
}

export function useCheckInByQr() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; reception: 'A' | 'B' }) =>
      callRpc<ApiCheckInByQrRow>(
        'check_in_by_qr',
        { p_token: input.token, p_reception: input.reception },
        'The QR code could not be verified.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
      void cache.invalidateQueries({ queryKey: ['member'] });
    },
  });
}

export function usePublishNotice() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      category: 'urgent' | 'schedule' | 'hours' | 'facilities' | 'renewal';
      title: string;
      body: string;
      audience: 'all_members' | 'active_only' | 'expiring_soon';
      urgent: boolean;
    }) => {
      const notice = await callRpc<ApiPublishNoticeRow>(
        'publish_notice',
        {
          p_category: input.category,
          p_title: input.title,
          p_body: input.body,
          p_audience: input.audience,
          p_urgent: input.urgent,
        },
        'The notice could not be published.',
      );
      try {
        const push = await invokeEdge<{ attempted: number; failed: number; sent: number }>(
          'send-notice-push',
          { noticeId: notice.notice_id },
        );
        return { ...notice, push };
      } catch {
        return { ...notice, push: null };
      }
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['notices'] });
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkNoticeRead() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (noticeId: string) =>
      callRpc<string>('mark_notice_read', { p_notice_id: noticeId }, 'The notice could not be marked as read.'),
    onSuccess: (_result, noticeId) => {
      cache.setQueryData<Notice[]>(['notices', false], (notices) =>
        notices?.map((notice) => notice.id === noticeId ? { ...notice, read: true } : notice),
      );
      void cache.invalidateQueries({ queryKey: ['notices'] });
    },
  });
}

export function useMarkAllNoticesRead() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: () =>
      callRpc<number>('mark_all_notices_read', {}, 'Notices could not be cleared.'),
    onSuccess: () => {
      cache.setQueryData<Notice[]>(['notices', false], (notices) =>
        notices?.map((notice) => ({ ...notice, read: true })),
      );
      void cache.invalidateQueries({ queryKey: ['notices'] });
    },
  });
}

export function useDeleteNotice() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (noticeId: string) =>
      callRpc<string>('delete_notice', { p_notice_id: noticeId }, 'The notice could not be removed.'),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['notices'] });
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateMemberProfile() {
  const cache = useQueryClient();
  const { session } = useApp();
  return useMutation({
    mutationFn: (input: {
      firstName: string;
      phone: string;
      emergencyName: string;
      emergencyPhone: string;
      nationalId: string;
      address: string;
    }) =>
      callRpc<string>(
        'update_member_profile',
        {
          p_first_name: input.firstName,
          p_phone: input.phone || null,
          p_emergency_contact_name: input.emergencyName || null,
          p_emergency_contact_phone: input.emergencyPhone || null,
          p_national_id: input.nationalId || null,
          p_address: input.address || null,
        },
        'Your profile could not be saved.',
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['current-member', session?.user.id] });
      void cache.invalidateQueries({ queryKey: ['member'] });
    },
  });
}

export function useCreateMemberInvitation() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      dateOfBirth?: string;
      emergencyName?: string;
      emergencyPhone?: string;
      nationalId?: string;
      address?: string;
      planId?: string;
      amountPaid?: number;
      paymentMethod?: DeskPaymentMethod | 'complimentary';
      agreedPrice?: number;
      priceNote?: string;
    }) =>
      invokeEdge<ApiCreateInvitationResult>('create-member-invitation', {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        emergencyName: input.emergencyName ?? null,
        emergencyPhone: input.emergencyPhone ?? null,
        nationalId: input.nationalId ?? null,
        address: input.address ?? null,
        planId: input.planId ?? null,
        amountPaid: input.amountPaid ?? null,
        paymentMethod: input.paymentMethod ?? null,
        ...(input.agreedPrice === undefined ? {} : { agreedPrice: input.agreedPrice, priceNote: input.priceNote }),
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['members'] });
      void cache.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useResendMemberInvitation() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      invokeEdge<ApiResendInvitationResult>('resend-member-invitation', { invitationId }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['members'] });
      void cache.invalidateQueries({ queryKey: ['member'] });
    },
  });
}
