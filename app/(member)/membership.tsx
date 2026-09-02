import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { RingCard } from '@/components/RingCard';
import { StatusDot } from '@/components/Tag';
import { Banner, EmptyState, KVList, KVRow } from '@/components/Surfaces';
import { Timeline } from '@/components/Timeline';
import { useApp } from '@/data/store';
import { statusVisual, fmtLong, fmtShort, timelineFill, TODAY, daysBetween } from '@/data/format';
import { planByName, CLUB } from '@/data/plans';

function subtitleFor(ms: NonNullable<ReturnType<typeof useApp>['currentMember']>['membership'], c: any): string {
  if (!ms) return '';
  if (ms.status === 'expired') return `Ended ${fmtLong(ms.expiryDate)}`;
  if (ms.status === 'paused' && ms.pauseEnds) return `Resumes ${fmtLong(ms.pauseEnds)}`;
  if (ms.status === 'due') return `Renewal attempted ${fmtShort(ms.payment.date)} — declined`;
  const plan = planByName(ms.planName);
  return `EGP ${plan?.priceEGP ?? ms.amountDue ?? 1500} / ${plan?.duration === 12 ? 'year' : plan?.duration === 3 ? '3 months' : 'month'}`;
}

export default function MembershipScreen() {
  const router = useRouter();
  const { currentMember, darkMode } = useApp();
  const c = useColors(darkMode);
  if (!currentMember) return null;
  const m = currentMember;
  const ms = m.membership;

  if (!ms) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Membership" onBack={() => router.back()} />
        <EmptyState
          icon="card"
          title="No plan yet"
          body="You haven't been assigned a membership. Reception can set one up in about two minutes."
          action={
            <View style={{ alignItems: 'center', gap: 12, marginTop: 22 }}>
              <Button onPress={() => {}}>Contact reception</Button>
            </View>
          }
        />
      </View>
    );
  }

  const vis = statusVisual(ms.status, ms, c);
  const tl = timelineFill(ms.startDate, ms.expiryDate);
  const total = daysBetween(ms.expiryDate, ms.startDate);
  const left = daysBetween(ms.expiryDate, TODAY);
  const progress = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const ringValue = ms.status === 'paused' ? String(Math.max(0, left)) : String(Math.max(0, left));
  const showTimeline = ms.status === 'active' || ms.status === 'expiring';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Membership" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body>
          {vis.bannerText ? (
            <Banner variant={vis.bannerVariant}>{vis.bannerText}</Banner>
          ) : null}

          <RingCard
            value={ringValue}
            unit={ms.status === 'paused' ? 'Days frozen' : ms.status === 'expired' ? 'Days past' : 'Days left'}
            variant={vis.dotVariant}
            tag={{ label: vis.tagLabel, variant: vis.tagVariant }}
            title={ms.planName}
            subtitle={subtitleFor(ms, c)}
            progress={progress}
          >
            {showTimeline ? (
              <Timeline
                fill={tl.fill}
                fillColor={vis.fillColor}
                l1={['Start', fmtShort(ms.startDate)]}
                l2={['Today', fmtShort(TODAY)]}
                l3={['Ends', fmtShort(ms.expiryDate)]}
              />
            ) : null}
          </RingCard>

          <KVList>
            {ms.status === 'paused' && ms.pauseEnds ? (
              <>
                <KVRow icon="pause" label="Paused on">{fmtLong(ms.payment.date)}</KVRow>
                <KVRow icon="cal" label="Resumes">{fmtLong(ms.pauseEnds)}</KVRow>
                <KVRow icon="clock" label="Days preserved">{ringValue} of {total}</KVRow>
              </>
            ) : ms.status === 'expired' ? (
              <>
                <KVRow icon="cal" label="Expired on">
                  <Text style={{ color: c.bad }}>{fmtLong(ms.expiryDate)}</Text>
                </KVRow>
                <KVRow icon="clock" label="Visits kept">{m.visits.length} visits · history intact</KVRow>
                <KVRow icon="receipt" label="Restart from">EGP {planByName(ms.planName)?.priceEGP ?? 1500}</KVRow>
              </>
            ) : ms.status === 'due' ? (
              <>
                <KVRow icon="receipt" label="Amount due">
                  <Text style={{ color: c.warn }}>EGP {ms.amountDue?.toLocaleString() ?? '1,500'}</Text>
                </KVRow>
                <KVRow icon="cal" label="Access until">{fmtLong(ms.expiryDate)}</KVRow>
                <KVRow icon="refresh" label="Last attempt">
                  <Text style={{ color: c.ink3, fontWeight: '500' }}>{fmtShort(ms.payment.date)} · card declined</Text>
                </KVRow>
              </>
            ) : (
              <>
                <KVRow icon="cal" label="Started">{fmtLong(ms.startDate)}</KVRow>
                <KVRow icon="cal" label="Valid until">{fmtLong(ms.expiryDate)}</KVRow>
                <KVRow icon="receipt" label="Last payment">EGP {ms.payment.amountEGP?.toLocaleString() ?? '1,500'} · {ms.payment.method}, {fmtShort(ms.payment.date)}</KVRow>
                <KVRow icon="refresh" label="Auto-renew">
                  <Text style={{ color: c.ink3, fontWeight: '500' }}>Off — renew at reception</Text>
                </KVRow>
              </>
            )}
          </KVList>

          <View style={styles.ctas}>
            {ms.status === 'active' ? (
              <>
                <Button block onPress={() => router.push('/renew')}>Renew membership</Button>
                <Button variant="quiet" block onPress={() => router.push('/qr')}>Show QR code</Button>
              </>
            ) : ms.status === 'expiring' || ms.status === 'expired' ? (
              <>
                <Button block onPress={() => router.push('/renew')}>Renew membership</Button>
                {ms.status === 'expiring' ? <Button variant="quiet" block onPress={() => router.push('/qr')}>Show QR code</Button> : null}
              </>
            ) : ms.status === 'paused' ? (
              <Button variant="secondary" block onPress={() => {}}>Resume early</Button>
            ) : ms.status === 'due' ? (
              <>
                <Button block onPress={() => {}}>Pay now — EGP {ms.amountDue?.toLocaleString() ?? '1,500'}</Button>
                <Button variant="quiet" block onPress={() => {}}>Pay at reception instead</Button>
              </>
            ) : null}
          </View>
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ctas: { gap: 11, marginTop: 2 },
});
