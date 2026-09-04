import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useColors, radius, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Tag';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';
import { useMemberDetail, usePlans, useRenewMembership } from '@/data/api/queries';
import { ApiCallError } from '@/data/api/queries';
import { fmtLong, fmtShort, TODAY } from '@/data/format';
import type { Plan } from '@/data/types';

/**
 * A-04, A-05, A-06:
 * 1. Choose Plan (radios + start option + payment method)
 * 2. Review (receipt rows, total due highlight, staff read-aloud script)
 * 3. Success (renewed badge, real receipt reference, new validity)
 */
export default function RenewFlow() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <RenewFlowInner />
    </>
  );
}

function RenewFlowInner() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberQuery = useMemberDetail(id);
  const plansQuery = usePlans();
  const renewMembership = useRenewMembership();
  const { adminName, darkMode } = useApp();
  const c = useColors(darkMode);

  const m = memberQuery.data ?? null;
  const plans = (plansQuery.data ?? []).filter((p) => p.name !== 'Premium Quarterly');

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [payMethod, setPayMethod] = React.useState<'cash' | 'card' | 'wallet' | 'instapay'>('cash');
  const [result, setResult] = React.useState<{ receiptNumber: string | null; startDate: string; endDate: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedPlanId && plans.length > 0) setSelectedPlanId(plans[0].id);
  }, [plans, selectedPlanId]);

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Renew" onBack={() => router.back()} />
        <Text style={{ color: c.ink2, padding: 20 }}>
          {memberQuery.isLoading ? 'Loading member…' : 'Member not found.'}
        </Text>
      </View>
    );
  }

  const plan: Plan | undefined = plans.find((p) => p.id === selectedPlanId) ?? plans[0];
  const currentExpiry = m.membership?.expiryDate ?? TODAY;
  const hasActiveTerm = Boolean(m.membership && m.membership.expiryDate >= TODAY);

  const confirmRenewal = async () => {
    if (!plan || !m.databaseId) return;
    setError(null);
    try {
      const renewal = await renewMembership.mutateAsync({
        memberId: m.databaseId,
        planId: plan.id,
        amountPaid: plan.priceEGP,
        paymentMethod: payMethod,
      });
      setResult({
        receiptNumber: renewal.receipt_number,
        startDate: renewal.start_date,
        endDate: renewal.end_date,
      });
      setStep(3);
    } catch (err) {
      if (err instanceof ApiCallError && err.code === 'VALIDATION_ERROR') {
        setError(`${err.message} If the member is still active, start the renewal after expiry instead.`);
      } else {
        setError('The renewal could not be recorded. Check your connection and try again — no payment was saved.');
      }
    }
  };

  const renderStepPills = (current: 1 | 2 | 3) => (
    <View style={styles.stepPillRow}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[styles.stepPill, { backgroundColor: current === n ? c.accent : c.line }]} />
      ))}
    </View>
  );

  if (step === 3 && result) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <AppBar title="Renewal" onClose={() => router.replace({ pathname: '/member-detail', params: { id: m.id } })} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 20 }}>
            {renderStepPills(3)}

            <View style={{ alignItems: 'flex-start', gap: 10 }}>
              <Tag variant="ok">Renewed</Tag>
              <Text style={[styles.h1, { color: c.ink }]}>Membership recorded</Text>
              <Text style={[styles.desc, { color: c.ink2 }]}>
                {m.firstName} {m.lastName}'s {plan?.name} membership is valid until{' '}
                <Text style={{ color: c.ink, fontWeight: '600' }}>{fmtLong(result.endDate)}</Text>.
              </Text>
            </View>

            <View style={[styles.receiptCard, { backgroundColor: c.bg1, borderColor: c.line }]}>
              <ReceiptRow label="Receipt reference" value={result.receiptNumber ?? '—'} isMono />
              <ReceiptRow label={`${payMethod === 'instapay' ? 'InstaPay' : payMethod[0].toUpperCase() + payMethod.slice(1)} recorded`} value={`EGP ${plan?.priceEGP.toLocaleString()}`} />
              <ReceiptRow label="Starts" value={fmtLong(result.startDate)} />
              <ReceiptRow label="Staff" value={adminName || 'Front desk'} />
              <ReceiptRow label="Status" value="Paid in full" last />
            </View>

            <View style={{ gap: 12, marginTop: 12 }}>
              <Button
                block
                onPress={() => router.replace({ pathname: '/member-detail', params: { id: m.id } })}
              >
                Back to member profile
              </Button>
              <Button
                variant="quiet"
                block
                onPress={() => router.replace('/(admin)/scanner')}
              >
                Scan next member
              </Button>
            </View>
          </Body>
        </ScrollView>
      </View>
    );
  }

  if (step === 2) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <AppBar title="Renew membership" onBack={() => setStep(1)} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 20 }}>
            {renderStepPills(2)}

            <View>
              <Text style={[styles.stepSub, { color: c.ink3 }]}>Step 2 of 3 · Review</Text>
              <Text style={[styles.h1, { color: c.ink }]}>Confirm renewal</Text>
              <Text style={[styles.desc, { color: c.ink2 }]}>
                Review the transaction details before committing.
              </Text>
            </View>

            {error ? <Banner variant="error">{error}</Banner> : null}

            <View style={[styles.receiptCard, { backgroundColor: c.bg1, borderColor: c.line }]}>
              <ReceiptRow label="Member" value={`${m.firstName} ${m.lastName}`} />
              <ReceiptRow label="Plan" value={plan?.name ?? '—'} />
              <ReceiptRow
                label="Period"
                value={hasActiveTerm ? `Starts after ${fmtShort(currentExpiry)}` : `Starts ${fmtShort(TODAY)}`}
              />
              <ReceiptRow label="Payment" value={`${payMethod === 'instapay' ? 'InstaPay' : payMethod[0].toUpperCase() + payMethod.slice(1)} · EGP ${plan?.priceEGP.toLocaleString()}`} />
              <View style={[styles.totalRow, { backgroundColor: c.accentSoft, borderColor: c.line }]}>
                <Text style={[styles.totalLabel, { color: c.ink }]}>Total due</Text>
                <Text style={[styles.totalVal, { color: c.accentHi }]}>
                  EGP {plan?.priceEGP.toLocaleString()}
                </Text>
              </View>
            </View>

            <Banner variant="info">
              Staff: read this summary aloud to the member before completing payment.
            </Banner>

            <View style={{ gap: 12, marginTop: 8 }}>
              <Button block loading={renewMembership.isPending} onPress={confirmRenewal}>
                Confirm payment & renew
              </Button>
              <Button variant="quiet" block onPress={() => setStep(1)}>
                Back
              </Button>
            </View>
          </Body>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar title="Renew membership" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 22 }}>
          {renderStepPills(1)}

          <View>
            <Text style={[styles.stepSub, { color: c.ink3 }]}>Step 1 of 3 · Choose plan</Text>
            <Text style={[styles.h1, { color: c.ink }]}>Renewal plan</Text>
            <Text style={[styles.desc, { color: c.ink2 }]}>
              Select a membership tier for {m.firstName} {m.lastName}.
            </Text>
          </View>

          {error ? <Banner variant="error">{error}</Banner> : null}

          <View style={{ gap: 10 }}>
            {plans.map((p) => {
              const on = p.id === selectedPlanId;
              const periodLabel = p.duration === 12 ? '/ year' : p.duration === 3 ? '/ 3 mo' : '/ month';
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedPlanId(p.id)}
                  style={[styles.planRadioCard, { backgroundColor: c.bg1, borderColor: on ? c.accent : c.line }]}
                >
                  <View style={[styles.radioCircle, { borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accent : 'transparent' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planTitle, { color: c.ink }]}>{p.name}</Text>
                    <Text style={[styles.planPeriod, { color: c.ink3 }]}>{p.blurb}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.planPrice, { color: c.ink }]}>EGP {p.priceEGP.toLocaleString()}</Text>
                    <Text style={[styles.planPricePeriod, { color: c.ink3 }]}>{periodLabel}</Text>
                  </View>
                </Pressable>
              );
            })}
            {plansQuery.isLoading ? (
              <Text style={{ color: c.ink3, fontSize: 12.5 }}>Loading plans…</Text>
            ) : null}
          </View>

          <Banner variant="info">
            {hasActiveTerm
              ? `The new plan starts automatically after the current term ends on ${fmtLong(currentExpiry)}.`
              : 'The new plan starts today — this member has no active term.'}
          </Banner>

          <View style={{ gap: 8 }}>
            <Text style={[styles.fieldLabel, { color: c.ink3 }]}>Payment method</Text>
            <View style={[styles.segWrap, { backgroundColor: c.bg1, borderColor: c.line }]}>
              {(['cash', 'card', 'wallet', 'instapay'] as const).map((method) => {
                const on = payMethod === method;
                return (
                  <Pressable
                    key={method}
                    onPress={() => setPayMethod(method)}
                    style={[styles.segBtn, on && { backgroundColor: c.accent }]}
                  >
                    <Text style={[styles.segText, { color: on ? c.accentInk : c.ink3 }]}>
                      {method === 'instapay' ? 'InstaPay' : method[0].toUpperCase() + method.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Button block style={{ marginTop: 8 }} onPress={() => setStep(2)}>
            Continue to review
          </Button>
        </Body>
      </ScrollView>
    </View>
  );
}

function ReceiptRow({
  label,
  value,
  isMono,
  last,
}: {
  label: string;
  value: string;
  isMono?: boolean;
  last?: boolean;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View style={[styles.rrow, { borderBottomColor: c.line }, last && { borderBottomWidth: 0 }]}>
      <Text style={[styles.rk, { color: c.ink3 }]}>{label}</Text>
      <Text style={[styles.rv, { color: c.ink }, isMono && { fontFamily: typography.mono, fontSize: 13 }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  stepPillRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  stepPill: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  stepSub: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  h1: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  desc: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 22,
  },
  planRadioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 14,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  planTitle: {
    fontFamily: typography.display,
    fontSize: 15.5,
    fontWeight: '600',
  },
  planPeriod: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    marginTop: 2,
  },
  planPrice: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
  },
  planPricePeriod: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    marginTop: 1,
  },
  fieldLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  segWrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  receiptCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rrow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rk: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
  },
  rv: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
  },
  totalVal: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '700',
  },
});
