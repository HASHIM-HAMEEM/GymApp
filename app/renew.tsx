import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useColors, spacing, typography, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Segmented } from '@/components/Overlays';
import { Monogram, Tag, StatusDot } from '@/components/Tag';
import { KVList, KVRow, Banner } from '@/components/Surfaces';
import { Icon } from '@/components/Icon';
import { useApp } from '@/data/store';
import { PLANS } from '@/data/plans';
import { fmtLong, fmtShort, daysBetween, TODAY } from '@/data/format';

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
  const { getMember, renewMembership, adminName, darkMode } = useApp();
  const c = useColors(darkMode);
  const m = id ? getMember(id) : undefined;

  const [step, setStep] = React.useState<'form' | 'review' | 'success'>('form');
  const [planId, setPlanId] = React.useState(PLANS[0].id);
  const [duration, setDuration] = React.useState<'1 month' | '3 months' | '12 months'>('1 month');
  const [payment, setPayment] = React.useState<'Paid' | 'Payment due' | 'Complimentary'>('Paid');
  const [startDate, setStartDate] = React.useState(m?.membership?.expiryDate ?? '2026-09-24');

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Renew" onBack={() => router.back()} />
        <Text style={{ color: c.ink2, padding: spacing.screen }}>Member not found.</Text>
      </View>
    );
  }

  const plan = PLANS.find((p) => p.id === planId)!;
  const endDate = computeEndDate(startDate, duration);

  const confirm = () => {
    renewMembership(
      m.id,
      plan.name,
      startDate,
      endDate,
      payment,
      plan.priceEGP,
      payment === 'Paid' ? 'Cash' : payment === 'Complimentary' ? 'Complimentary' : 'InstaPay',
    );
    setStep('success');
  };

  if (step === 'success') {
    return (
      <View style={[styles.successWrap, { backgroundColor: c.bg }]}>
        <View style={[styles.successBadge, { backgroundColor: c.okSoft }]}>
          <Icon name="check" size={42} color={c.ok} />
        </View>
        <Text style={[styles.successTitle, { color: c.ink }]}>Membership renewed</Text>
        <Text style={[styles.successBody, { color: c.ink2 }]}>
          {m.firstName} {m.lastName} is active through{' '}
          <Text style={{ color: c.ink, fontWeight: '600' }}>{fmtLong(endDate)}</Text>.{'\n'}
          They'll see the update the next time they open the app.
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <KVList>
            <KVRow label="Plan">{plan.name}</KVRow>
            <KVRow label="Payment">
              <StatusDot variant={payment === 'Paid' ? 'ok' : 'warn'} size={7} /> {payment} · EGP {plan.priceEGP.toLocaleString()}
            </KVRow>
            <KVRow label="Logged by">{adminName} · now</KVRow>
          </KVList>
        </View>
        <Button block style={{ marginTop: 6 }} onPress={() => router.replace({ pathname: '/member-detail', params: { id: m.id } })}>
          Back to member
        </Button>
        <Button variant="quiet" block onPress={() => router.replace('/(admin)/scanner')}>Scan next member</Button>
      </View>
    );
  }

  if (step === 'review') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Review renewal" sub="2 of 2" onBack={() => setStep('form')} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 18 }}>
        <KVList>
          <KVRow label="Member">{m.firstName} {m.lastName}</KVRow>
          <KVRow label="Member ID">{m.id}</KVRow>
          <KVRow label="Plan">{plan.name}</KVRow>
          <KVRow label="Starts">{fmtLong(startDate)}</KVRow>
          <KVRow label="Ends">{fmtLong(endDate)}</KVRow>
          <KVRow label="Duration">{duration}</KVRow>
          <KVRow label="Payment">
            <StatusDot variant={payment === 'Paid' ? 'ok' : 'warn'} size={7} /> {payment} · EGP {plan.priceEGP.toLocaleString()}
          </KVRow>
          <KVRow label="Status after saving"><Tag variant="ok">Active</Tag></KVRow>
        </KVList>
        <Banner variant="info">
          Renewing now keeps <Text style={{ fontWeight: '700' }}>uninterrupted access</Text>. The new period begins the day the current one ends.
        </Banner>
          <View style={styles.ctas}>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={() => setStep('form')}>Edit</Button>
            <Button block style={{ flex: 1.4 }} onPress={confirm}>Confirm & save</Button>
          </View>
        </Body>
      </ScrollView>
    </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Renew membership" sub="1 of 2" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 18 }}>

      <View style={styles.memberHead}>
        <Monogram text={`${m.firstName[0]}${m.lastName[0]}`.toUpperCase()} size={40} fontSize={13} />
        <View>
          <Text style={[styles.memberName, { color: c.ink }]}>{m.firstName} {m.lastName}</Text>
          <Text style={[styles.memberSub, { color: c.ink2 }]}>Current: {m.membership?.planName ?? '-'} · ends {m.membership ? fmtShort(m.membership.expiryDate) : '-'}</Text>
        </View>
      </View>

      <Field label="Plan">
        <View style={styles.plans}>
          {PLANS.filter((p) => p.id !== 'premium-quarterly').map((p) => {
            const on = p.id === planId;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlanId(p.id)}
              >
                <View style={[styles.plan, { backgroundColor: c.bg2, borderColor: c.line }, on && { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
                  <View style={[styles.radio, { borderColor: c.line2 }, on && { borderColor: c.accent, backgroundColor: c.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: c.ink }]}>{p.name}</Text>
                    <Text style={[styles.planSub, { color: c.ink2 }]}>{p.blurb}</Text>
                  </View>
                  <Text style={[styles.planPrice, { color: c.ink }]}>EGP {p.priceEGP.toLocaleString()}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Start date" hint="Starts the day after the current plan ends. No gap in access.">
        <Control value={fmtLong(startDate)} onChangeText={(t) => setStartDate(t)} />
      </Field>

      <Field label="Duration">
        <Segmented
          options={['1 month', '3 months', '12 months']}
          value={duration}
          onChange={(v) => setDuration(v as any)}
        />
        <Text style={[styles.hint, { color: c.ink3 }]}>New expiry: {fmtLong(endDate)}</Text>
      </Field>

      <Field label="Payment state">
        <Segmented
          options={['Paid', 'Payment due', 'Complimentary']}
          value={payment}
          onChange={(v) => setPayment(v as any)}
        />
        <Text style={[styles.hint, { color: c.ink3 }]}>Recorded in the activity log with your name.</Text>
      </Field>

        <View style={styles.ctas}>
          <Button variant="secondary" block style={{ flex: 1 }} onPress={() => router.back()}>Cancel</Button>
          <Button block style={{ flex: 1 }} onPress={() => setStep('review')}>Review renewal</Button>
        </View>
      </Body>
    </ScrollView>
    </View>
  );
}

function computeEndDate(start: string, duration: string): string {
  const m = start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return start;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  const months = duration === '12 months' ? 12 : duration === '3 months' ? 3 : 1;
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberName: {
    fontFamily: typography.fontFamily,
    fontSize: 15.5,
    fontWeight: '600',
  },
  memberSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    marginTop: 1,
  },
  plans: { gap: 8 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  planName: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  planSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    marginTop: 2,
  },
  planPrice: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    marginTop: 7,
  },
  ctas: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: spacing.screen,
    paddingBottom: 40,
  },
  successBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
