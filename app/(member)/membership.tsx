import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useColors, spacing, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { RingCard } from '@/components/RingCard';
import { Banner, EmptyState, KVList, KVRow } from '@/components/Surfaces';
import { Timeline } from '@/components/Timeline';
import { useClub, useCurrentMember, usePlans } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { statusVisual, fmtLong, fmtShort, timelineFill, TODAY, daysBetween } from '@/data/format';

function subtitleFor(status: string, planPrice: number | undefined, amountDue: number | undefined, expiryDate: string): string {
  if (status === 'expired') return `Ended ${fmtLong(expiryDate)}`;
  if (status === 'upcoming') return `Begins soon · valid until ${fmtLong(expiryDate)}`;
  if (status === 'paused') return 'Frozen at your request';
  if (status === 'due') return `Payment due · EGP ${(amountDue ?? 0).toLocaleString()}`;
  if (planPrice) return `EGP ${planPrice.toLocaleString()}`;
  return `Valid until ${fmtLong(expiryDate)}`;
}

export default function MembershipScreen() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const plansQuery = usePlans();
  const clubQuery = useClub();
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const m = memberQuery.data ?? null;
  const ms = m?.membership ?? null;

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
              <Button
                onPress={() => {
                  if (clubQuery.data?.phone) void Linking.openURL(`tel:${clubQuery.data.phone}`);
                }}
              >
                Contact reception
              </Button>
              {clubQuery.data ? (
                <Text style={{ fontSize: 12.5, color: c.ink3, textAlign: 'center' }}>
                  {clubQuery.data.name} · {clubQuery.data.phone}
                </Text>
              ) : null}
            </View>
          }
        />
      </View>
    );
  }

  const vis = statusVisual(ms.status, ms, c);
  const tl = timelineFill(ms.startDate, ms.expiryDate);
  const total = daysBetween(ms.expiryDate, ms.startDate);
  const left = Math.max(0, daysBetween(ms.expiryDate, TODAY));
  const progress = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const ringValue = String(left);
  const showTimeline = ms.status === 'active' || ms.status === 'expiring' || ms.status === 'upcoming';
  const plan = plansQuery.data?.find((p) => p.id === ms.planId);

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
            subtitle={subtitleFor(ms.status, plan?.priceEGP, ms.amountDue, ms.expiryDate)}
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
                <KVRow icon="pause" label="Resumes">{fmtLong(ms.pauseEnds)}</KVRow>
                <KVRow icon="clock" label="Days preserved">{ringValue} of {total}</KVRow>
              </>
            ) : ms.status === 'expired' ? (
              <>
                <KVRow icon="cal" label="Expired on">
                  <Text style={{ color: c.bad }}>{fmtLong(ms.expiryDate)}</Text>
                </KVRow>
                <KVRow icon="clock" label="Visits kept">{m ? m.visits.length : 0} visits · history intact</KVRow>
                <KVRow icon="receipt" label="Restart from">EGP {plan?.priceEGP?.toLocaleString() ?? '—'}</KVRow>
              </>
            ) : ms.status === 'due' ? (
              <>
                <KVRow icon="receipt" label="Amount due">
                  <Text style={{ color: c.warn }}>EGP {ms.amountDue?.toLocaleString() ?? '—'}</Text>
                </KVRow>
                <KVRow icon="cal" label="Access until">{fmtLong(ms.expiryDate)}</KVRow>
              </>
            ) : (
              <>
                <KVRow icon="cal" label="Started">{fmtLong(ms.startDate)}</KVRow>
                <KVRow icon="cal" label="Valid until">{fmtLong(ms.expiryDate)}</KVRow>
                <KVRow icon="receipt" label="Last payment">
                  EGP {ms.payment.amountEGP?.toLocaleString() ?? '—'} · {ms.payment.method}, {fmtShort(ms.payment.date)}
                </KVRow>
                <KVRow icon="refresh" label="Renewal">
                  <Text style={{ color: c.ink3, fontWeight: '500' }}>At reception — before {fmtShort(ms.expiryDate)}</Text>
                </KVRow>
              </>
            )}
          </KVList>

          <View style={styles.ctas}>
            {ms.status === 'active' || ms.status === 'expiring' || ms.status === 'due' ? (
              <>
                <Button block href="/qr">Show QR code</Button>
                <Button variant="quiet" block href="/(member)/profile">
                  Ask reception to renew
                </Button>
              </>
            ) : ms.status === 'upcoming' ? (
              <Button variant="secondary" block href="/qr">
                Preview my card
              </Button>
            ) : ms.status === 'paused' ? (
              <Button variant="secondary" block href="/(member)/profile">
                Resume early — ask at reception
              </Button>
            ) : (
              <Button variant="secondary" block href="/(member)/profile">
                Renew at reception to restore access
              </Button>
            )}
          </View>
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ctas: { gap: 11, marginTop: 2 },
});
