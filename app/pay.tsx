import * as React from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { AppBar, Body } from '@/components/Chrome';
import { Banner } from '@/components/Surfaces';
import { Button } from '@/components/Button';
import { Control, Field } from '@/components/Field';
import { useApp } from '@/providers/AppProvider';
import { useCreateUpiPaymentRequest, useCurrentMember, usePlans, useSubmitUpiPayment, useUpiConfig, useUpiPaymentRequests } from '@/data/api/queries';
import { formatMoney } from '@/data/format';
import { radius, typography, useColors } from '@/theme/tokens';
import { FormScroll } from '@/components/FormScroll';

function makeUpiUri(upiId: string, payee: string, amount: number, reference: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: payee, am: amount.toFixed(2), cu: 'INR', tr: reference, tn: `Apex ${reference}` });
  return `upi://pay?${params.toString()}`;
}

export default function Pay() {
  const router = useRouter();
  const { darkMode, language, isOnline } = useApp();
  const c = useColors(darkMode);
  const member = useCurrentMember();
  const plans = usePlans();
  const config = useUpiConfig();
  const history = useUpiPaymentRequests(false);
  const create = useCreateUpiPaymentRequest();
  const submit = useSubmitUpiPayment();
  const [selectedPlan, setSelectedPlan] = React.useState('');
  const [activeRequest, setActiveRequest] = React.useState<Awaited<ReturnType<typeof create.mutateAsync>> | null>(null);
  const [utr, setUtr] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const m = member.data;
  const dueMembership = m?.membership?.amountDue ? m.membership : null;
  const openRequest = activeRequest ?? (history.data ?? []).find((row) => row.status === 'created' || row.status === 'rejected') ?? null;

  const begin = async () => {
    if (!isOnline) return setError('Reconnect to create a payment request.');
    if (!dueMembership && !selectedPlan) return setError('Choose a membership plan.');
    try {
      const request = await create.mutateAsync(dueMembership ? { membershipId: dueMembership.id } : { planId: selectedPlan });
      setActiveRequest(request);
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Payment request could not be created.'); }
  };

  const destination = config.data?.upi_id && config.data.payee_name ? config.data : null;
  const uri = openRequest && destination ? makeUpiUri(destination.upi_id!, destination.payee_name!, Number(openRequest.amount), openRequest.reference) : '';
  const launchPayment = async () => {
    if (!uri) return;
    try { await Linking.openURL(uri); }
    catch { setError('No UPI app could be opened. Scan the QR or share the UPI ID instead.'); }
  };

  const sendReference = async () => {
    if (!openRequest || !/^[A-Za-z0-9-]{6,64}$/.test(utr.trim())) return setError('Enter the transaction reference shown by your UPI app.');
    try { await submit.mutateAsync({ requestId: openRequest.id, utr: utr.trim(), note }); setError(null); await history.refetch(); setActiveRequest(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The transaction reference could not be submitted.'); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Pay with UPI" onBack={() => router.back()} />
      <FormScroll contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 18 }}>
          {!isOnline ? <Banner variant="offline">No internet connection. Payment actions are paused.</Banner> : null}
          {error ? <Banner variant="error">{error}</Banner> : null}
          {!destination ? <Banner variant="warn">The club has not configured its UPI destination yet. Contact reception.</Banner> : null}
          {(history.data ?? []).some((row) => row.status === 'submitted') ? <Banner variant="info">Your payment is waiting for reception to verify it. Access changes only after confirmation.</Banner> : null}

          {!openRequest ? (
            <>
              {dueMembership ? (
                <View style={[styles.card, { backgroundColor: c.bg1, borderColor: c.line }]}> 
                  <Text style={[styles.title, { color: c.ink }]}>Outstanding balance</Text>
                  <Text style={[styles.amount, { color: c.ink }]}>{formatMoney(dueMembership.amountDue ?? 0, dueMembership.currency, language)}</Text>
                  <Text style={[styles.meta, { color: c.ink3 }]}>{dueMembership.planName}</Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.title, { color: c.ink }]}>Choose a renewal plan</Text>
                  {(plans.data ?? []).map((plan) => (
                    <Button key={plan.id} variant={selectedPlan === plan.id ? 'primary' : 'secondary'} block onPress={() => setSelectedPlan(plan.id)}>{plan.name} · {formatMoney(plan.price, plan.currency, language)}</Button>
                  ))}
                </View>
              )}
              <Button block loading={create.isPending} disabled={!destination || !isOnline} onPress={() => void begin()}>Continue to payment</Button>
            </>
          ) : destination ? (
            <View style={[styles.card, { backgroundColor: c.bg1, borderColor: c.line }]}> 
              <Text style={[styles.title, { color: c.ink }]}>Pay {formatMoney(Number(openRequest.amount), openRequest.currency, language)}</Text>
              <Text selectable style={[styles.meta, { color: c.ink2 }]}>{destination.payee_name} · {destination.upi_id}</Text>
              <View style={styles.qr}><QRCode value={uri} size={190} backgroundColor="#FFFFFF" color="#080A0C" /></View>
              <Text selectable style={[styles.reference, { color: c.ink3 }]}>Reference {openRequest.reference}</Text>
              <Button block disabled={!isOnline} onPress={() => void launchPayment()}>Open UPI app</Button>
              <Button variant="secondary" block onPress={() => void Share.share({ message: `${destination.payee_name}\nUPI ID: ${destination.upi_id}\nAmount: ${formatMoney(Number(openRequest.amount), openRequest.currency, language)}\nReference: ${openRequest.reference}` })}>Share payment details</Button>
              <Field label="UPI transaction reference"><Control value={utr} onChangeText={setUtr} autoCapitalize="characters" placeholder="Enter UTR after payment" /></Field>
              <Field label="Note" hint="Optional"><Control value={note} onChangeText={setNote} placeholder="Payment note" /></Field>
              <Button block loading={submit.isPending} disabled={!isOnline} onPress={() => void sendReference()}>Submit for verification</Button>
            </View>
          ) : null}
        </Body>
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 18, gap: 14 },
  qr: { alignSelf: 'center', padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF' },
  title: { fontFamily: typography.display, fontSize: 18, fontWeight: '600' },
  amount: { fontFamily: typography.display, fontSize: 30, fontWeight: '600' },
  meta: { fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 19 },
  reference: { fontFamily: typography.mono, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
