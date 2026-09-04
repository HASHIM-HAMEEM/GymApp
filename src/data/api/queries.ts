import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import type { Member, MembershipStatus, Notice, QrPass } from '@/data/types';
import type {
  ApiCheckInByQrRow,
  ApiCheckInManualRow,
  ApiCreateInvitationResult,
  ApiDashboard,
  ApiMemberDetail,
  ApiNoticeTableRow,
  ApiPublishNoticeRow,
  ApiQrPassRow,
  ApiRenewRow,
  ApiResendInvitationResult,
  ApiSearchRow,
  ApiMembershipStateRow,
} from './api';
import { fetchClub, fetchPlans, todayIso } from './api';
import { mapMemberDetail, mapNoticeRow, mapPlan, mapSearchRow } from './mapper';

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

export function useClub() {
  return useQuery({ queryKey: ['club'], queryFn: fetchClub, staleTime: 300_000 });
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
    queryFn: async (): Promise<Notice[]> => {
      const client = requireSupabase();
      if (asAdmin) {
        const { data, error } = await client
          .from('notices')
          .select('id, category, title, body, audience, urgent, published_at, profiles(display_name), notice_deliveries(count)')
          .order('published_at', { ascending: false })
          .limit(60);
        if (error) throw error;
        return (data as unknown as ApiNoticeTableRow[]).map((row) => {
          const raw = row as unknown as {
            profiles?: { display_name: string | null } | null;
            notice_deliveries?: { count: number | null }[] | null;
          };
          return mapNoticeRow({
            ...row,
            author_name: raw.profiles?.display_name ?? null,
            delivery_count: raw.notice_deliveries?.[0]?.count ?? 0,
          });
        });
      }
      const { data, error } = await client
        .from('notice_deliveries')
        .select('read_at, notices!inner(id, category, title, body, audience, urgent, published_at)')
        .order('delivered_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data as unknown as { read_at: string | null; notices: ApiNoticeTableRow }[]).map((row) =>
        mapNoticeRow({ ...row.notices, read_at: row.read_at }),
      );
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

export function useRenewMembership() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      memberId: string;
      planId: string;
      amountPaid: number;
      paymentMethod: 'instapay' | 'cash' | 'card' | 'wallet';
    }) =>
      callRpc<ApiRenewRow>(
        'renew_membership',
        {
          p_member_id: input.memberId,
          p_plan_id: input.planId,
          p_start_date: null,
          p_amount_paid: input.amountPaid,
          p_payment_method: input.paymentMethod,
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
    onSuccess: () => {
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
      membershipStartDate?: string;
      amountPaid?: number;
      paymentMethod?: 'instapay' | 'cash' | 'card' | 'wallet' | 'complimentary';
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
        membershipStartDate: input.membershipStartDate ?? null,
        amountPaid: input.amountPaid ?? null,
        paymentMethod: input.paymentMethod ?? null,
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
