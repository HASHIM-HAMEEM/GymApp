import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { AppBar, Body } from '@/components/Chrome';
import { Banner, SectionBlock } from '@/components/Surfaces';
import { Button } from '@/components/Button';
import { Control, Field } from '@/components/Field';
import { SectionLabel } from '@/components/Tag';
import { useApp } from '@/providers/AppProvider';
import { useReviewUpiPayment, useUpdateUpiConfig, useUpiConfig, useUpiPaymentRequests } from '@/data/api/queries';
import { formatMoney } from '@/data/format';
import { radius, typography, useColors } from '@/theme/tokens';
import { FormScroll } from '@/components/FormScroll';

function extractUpiId(value: string): string {
  const input = value.trim();
  if (!input.toLowerCase().startsWith('upi://')) return input.toLowerCase();
  try { return new URL(input).searchParams.get('pa')?.trim().toLowerCase() ?? ''; } catch { return ''; }
}

function upiUri(upiId: string, name: string): string {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&cu=INR`;
}

export default function PaymentSettings() {
  const router = useRouter();
  const { role, darkMode, language, isOnline } = useApp();
  const c = useColors(darkMode);
  const config = useUpiConfig();
  const requests = useUpiPaymentRequests(true);
  const update = useUpdateUpiConfig();
  const review = useReviewUpiPayment();
  const [upiId, setUpiId] = React.useState('');
  const [payee, setPayee] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!config.data) return;
    setUpiId(config.data.upi_id ?? '');
    setPayee(config.data.payee_name ?? '');
  }, [config.data]);

  if (role !== 'admin') return <Redirect href="/" />;
  const save = async () => {
    const id = extractUpiId(upiId);
    if (!/^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(id)) return setError('Enter a valid UPI ID or paste a valid UPI payment QR payload.');
    if (payee.trim().length < 2) return setError('Enter the account holder or club name.');
    setError(null);
    try { await update.mutateAsync({ upiId: id, payeeName: payee.trim() }); setUpiId(id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'UPI details could not be saved.'); }
  };
  const reviewPayment = async (requestId: string, approve: boolean) => {
    setError(null);
    try {
      await review.mutateAsync({
        requestId,
        approve,
        note: approve ? undefined : 'Payment could not be verified',
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The payment review could not be saved. Try again.');
    }
  };
  const pending = (requests.data ?? []).filter((request) => request.status === 'submitted');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="UPI payments" onBack={() => router.back()} />
      <FormScroll contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 24 }}>
          {!isOnline ? <Banner variant="offline">No internet connection. Payment settings cannot be changed.</Banner> : null}
          {error ? <Banner variant="error">{error}</Banner> : null}
          <SectionBlock title={<SectionLabel>Payment destination</SectionLabel>}>
            <View style={[styles.card, { backgroundColor: c.bg1, borderColor: c.line }]}> 
              <Field label="Recipient name"><Control value={payee} onChangeText={setPayee} placeholder="Apex Fitness Club" /></Field>
              <Field label="UPI ID or QR payload" hint="Paste a UPI ID or the upi:// value decoded from a payment QR."><Control value={upiId} onChangeText={setUpiId} autoCapitalize="none" autoCorrect={false} placeholder="apex@bank" /></Field>
              {extractUpiId(upiId) && payee.trim() ? <View style={styles.qr}><QRCode value={upiUri(extractUpiId(upiId), payee.trim())} size={144} backgroundColor="#FFFFFF" color="#080A0C" /></View> : null}
              <Button block loading={update.isPending} disabled={!isOnline} onPress={() => void save()}>Save UPI details</Button>
            </View>
          </SectionBlock>

          <SectionBlock title={<SectionLabel>Awaiting verification · {pending.length}</SectionLabel>}>
            {pending.length === 0 ? <Text style={[styles.empty, { color: c.ink3 }]}>No submitted UPI payments.</Text> : pending.map((request) => (
              <View key={request.id} style={[styles.request, { backgroundColor: c.bg1, borderColor: c.line }]}> 
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={[styles.requestTitle, { color: c.ink }]}>{request.members?.first_name} {request.members?.last_name}</Text>
                  <Text selectable style={[styles.meta, { color: c.ink3 }]}>{request.members?.member_number} · {request.kind === 'renewal' ? request.plans?.name ?? 'Renewal' : 'Balance payment'}</Text>
                  <Text style={[styles.amount, { color: c.ink }]}>{formatMoney(Number(request.amount), request.currency, language)}</Text>
                  <Text selectable style={[styles.meta, { color: c.ink2 }]}>UTR {request.utr}</Text>
                  <Text selectable style={[styles.meta, { color: c.ink3 }]}>{request.reference}</Text>
                </View>
                <View style={styles.reviewActions}>
                  <Button size="sm" loading={review.isPending} disabled={!isOnline} onPress={() => void reviewPayment(request.id, true)}>Confirm</Button>
                  <Button size="sm" variant="danger" disabled={review.isPending || !isOnline} onPress={() => void reviewPayment(request.id, false)}>Reject</Button>
                </View>
              </View>
            ))}
          </SectionBlock>
        </Body>
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 16 },
  qr: { alignSelf: 'center', padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF' },
  empty: { paddingVertical: 22, fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 22 },
  request: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 14 },
  requestTitle: { fontFamily: typography.fontFamily, fontSize: 15, fontWeight: '600' },
  amount: { fontFamily: typography.display, fontSize: 18, fontWeight: '600', marginTop: 4 },
  meta: { fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 19 },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
