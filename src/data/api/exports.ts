import { requireSupabase } from '@/lib/supabase';
import { toCsv } from '@/lib/csv';

type Row = Record<string, unknown>;
export async function buildAdminExport() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to export records.');
  const { data: profile, error } = await client.from('profiles').select('role,account_state').eq('id', auth.user.id).single();
  if (error || profile?.role !== 'admin' || profile.account_state !== 'active') throw new Error('Only active administrators can export records.');
  const cutoff = new Date().toISOString();
  async function all(table: string, columns: string) {
    const rows: Row[] = [];
    let cursor: string | undefined;
    for (;;) {
      let query = client.from(table).select(columns).order('id').lte('created_at', cutoff).limit(500);
      if (cursor) query = query.gt('id', cursor);
      const { data, error } = await query;
      if (error) throw new Error('Export failed. Check your connection and retry.');
      const page = (data ?? []) as unknown as Row[];
      rows.push(...page);
      if (rows.length > 50_000) throw new Error('This report is too large for a phone export. Contact your administrator; no partial file was saved.');
      if (page.length < 500) return rows;
      cursor = String(page[page.length - 1].id);
    }
  }
  const [members, memberships, payments] = await Promise.all([
    all('members', 'id,member_number,first_name,last_name,email,phone,created_at'),
    all('memberships', 'id,member_id,plan_name_snapshot,state,start_date,end_date,price_snapshot,currency_snapshot,amount_due,frozen_days'),
    all('payments', 'id,membership_id,receipt_number,amount,currency,method,kind,paid_at'),
  ]);
  const termsByMember = new Map<string, Row[]>();
  const paymentsByTerm = new Map<string, Row[]>();
  for (const row of memberships) {
    const key = String(row.member_id);
    termsByMember.set(key, [...(termsByMember.get(key) ?? []), row]);
  }
  for (const row of payments) {
    const key = String(row.membership_id);
    paymentsByTerm.set(key, [...(paymentsByTerm.get(key) ?? []), row]);
  }
  const rows: unknown[][] = [];
  for (const member of members) {
    const terms = termsByMember.get(String(member.id)) ?? [null];
    for (const term of terms) {
      const paid = term ? paymentsByTerm.get(String(term.id)) ?? [] : [];
      const currency = term?.currency_snapshot;
      // Sum minor units and never combine different currencies or waivers.
      const total = paid.reduce((sum, p) => {
        if (p.currency !== currency || p.kind === 'waiver' || p.method === 'complimentary') return sum;
        const amount = Number(p.amount);
        if (!Number.isFinite(amount)) throw new Error('A payment contains an invalid amount. Export stopped.');
        return sum + Math.round(amount * 100);
      }, 0) / 100;
      rows.push([member.member_number, member.first_name, member.last_name, member.email, member.phone,
        term?.id, term?.plan_name_snapshot, term?.state, term?.start_date, term?.end_date, term?.frozen_days,
        term?.price_snapshot, currency, total, term?.amount_due,
        paid.map(p => p.receipt_number).join('; '), [...new Set(paid.map(p => p.method))].join('; '),
        paid.map(p => p.paid_at).sort().at(-1), member.created_at]);
    }
  }
  return {
    count: rows.length,
    filename: `member-report-${cutoff.replace(/[:.]/g, '-')}.csv`,
    csv: toCsv(['Member number','First name','Last name','Email','Phone','Membership ID','Plan','Stored state',
      'Start date','Original end date','Freeze credit days','Agreed price','Currency','Payments received','Balance due',
      'Receipts','Payment methods','Last payment at (UTC)','Joined at (UTC)'], rows),
  };
}
