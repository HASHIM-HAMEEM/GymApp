import * as React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, useColors, spacing, typography, radius } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, Tag } from '@/components/Tag';
import { Sheet } from '@/components/Overlays';
import { Icon } from '@/components/Icon';
import { useApp } from '@/data/store';
import { statusVisual, fmtLong, daysBetween, TODAY } from '@/data/format';
import type { Member } from '@/data/types';

type ScanState = 'ready' | 'success' | 'expiring' | 'inactive' | 'unknown';

export default function Scanner() {
  const router = useRouter();
  const { members, checkIn } = useApp();
  const c = useColors(true);
  const [state, setState] = React.useState<ScanState>('ready');
  const [scanned, setScanned] = React.useState<Member | null>(null);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manualQuery, setManualQuery] = React.useState('');
  const [manualResult, setManualResult] = React.useState<Member | null>(null);

  // Simulate scanning a random active/expiring member
  const simulateScan = () => {
    const pool = members.filter((m) => m.membership && (m.membership.status === 'active' || m.membership.status === 'expiring' || m.membership.status === 'expired'));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setScanned(pick);
    const status = pick.membership!.status;
    setState(status === 'active' ? 'success' : status === 'expiring' ? 'expiring' : 'inactive');
  };

  const admit = () => {
    if (scanned) checkIn(scanned.id, 'A');
    setState('ready');
    setScanned(null);
  };

  const doManualLookup = () => {
    const q = manualQuery.trim().toLowerCase();
    const found = members.find(
      (m) => m.id.toLowerCase() === q || m.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q),
    );
    setManualResult(found ?? null);
  };

  const admitManual = () => {
    if (manualResult) {
      checkIn(manualResult.id, 'A');
      setManualOpen(false);
      setScanned(manualResult);
      setState(manualResult.membership?.status === 'active' ? 'success' : manualResult.membership?.status === 'expiring' ? 'expiring' : 'inactive');
      setManualQuery('');
      setManualResult(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <AppBar title={state === 'ready' ? 'Scan member code' : 'Check-in'} onClose={() => router.back()} dark />

      {state === 'ready' ? (
        <View style={styles.readyBody}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.c1]} />
            <View style={[styles.corner, styles.c2]} />
            <View style={[styles.corner, styles.c3]} />
            <View style={[styles.corner, styles.c4]} />
            <View style={styles.scanLine} />
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={styles.readyTitle}>Hold the member's QR code in the frame</Text>
            <Text style={styles.readySub}>The camera runs continuously. No shutter button</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ok }} />
            <Text style={styles.live}>Scanner ready · Reception A</Text>
          </View>

          {/* Demo: tap to simulate a scan */}
          <Pressable onPress={simulateScan} style={styles.simulateBtn}>
            <Text style={styles.simulateText}>Simulate scan (demo)</Text>
          </Pressable>
        </View>
      ) : (
        <ScanResult state={state} member={scanned} onScanNext={() => { setState('ready'); setScanned(null); }} onAdmit={admit} onViewMember={() => scanned && router.push({ pathname: '/member-detail', params: { id: scanned.id } })} onRenew={() => scanned && router.push({ pathname: '/renew', params: { id: scanned.id } })} />
      )}

      <View style={styles.bottomBar}>
        <Button variant="secondary" block icon="search" onPress={() => setManualOpen(true)}>
          <Text style={{ color: colors.ink }}>Enter member ID manually</Text>
        </Button>
      </View>

      <Sheet visible={manualOpen} onClose={() => setManualOpen(false)} title="Find member manually" desc="Enter a member ID, phone number, or full name. Reception can also read the ID from the physical card.">
        <View style={{ gap: 12, marginTop: 8 }}>
          <View style={[styles.manualInput, { backgroundColor: c.surface, borderColor: c.lineStrong }]}>
            <TextInput
              value={manualQuery}
              onChangeText={setManualQuery}
              placeholder="MRD-2481, phone, or name"
              placeholderTextColor={c.ink3}
              style={[styles.manualTextInput, { color: c.ink }]}
              inputMode="text"
            />
            {manualResult ? (
              <Text style={{ color: c.ok, fontWeight: '600', fontSize: 13 }}>Found</Text>
            ) : null}
          </View>
          <Button variant="quiet" block onPress={doManualLookup}>Search</Button>

          {manualResult ? (
            <View style={[styles.manualResult, { backgroundColor: c.surface2, borderColor: c.line }]}>
              <Monogram text={`${manualResult.firstName[0]}${manualResult.lastName[0]}`.toUpperCase()} size={38} fontSize={12.5} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.manualName, { color: c.ink }]}>{manualResult.firstName} {manualResult.lastName}</Text>
                <Text style={[styles.manualSub, { color: c.ink3 }]}>{manualResult.id} · {manualResult.membership?.planName} · until {manualResult.membership ? fmtLong(manualResult.membership.expiryDate) : '-'}</Text>
              </View>
              <Tag variant={manualResult.membership?.status === 'active' ? 'ok' : manualResult.membership?.status === 'expiring' ? 'warn' : 'bad'}>
                {manualResult.membership?.status === 'active' ? 'Active' : manualResult.membership?.status === 'expiring' ? 'Expiring' : 'Expired'}
              </Tag>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={() => setManualOpen(false)}>Cancel</Button>
            <Button block style={{ flex: 1.3 }} disabled={!manualResult} onPress={admitManual}>Check in member</Button>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

function ScanResult({
  state,
  member,
  onScanNext,
  onAdmit,
  onViewMember,
  onRenew,
}: {
  state: ScanState;
  member: Member | null;
  onScanNext: () => void;
  onAdmit: () => void;
  onViewMember: () => void;
  onRenew: () => void;
}) {
  if (!member || !member.membership) return null;
  const ms = member.membership;
  const vis = statusVisual(ms.status, ms);
  const days = daysBetween(ms.expiryDate, TODAY);

  const badgeStyle =
    state === 'success' ? styles.badgeOk : state === 'expiring' ? styles.badgeWarn : styles.badgeBad;
  const badgeIcon = state === 'success' ? 'check' : state === 'expiring' ? 'warn' : 'xc';
  const badgeColor = state === 'success' ? colors.ok : state === 'expiring' ? colors.warn : colors.bad;
  const title =
    state === 'success' ? 'Check-in successful' : state === 'expiring' ? 'Membership expires soon' : 'Membership inactive';
  const sub =
    state === 'success'
      ? 'Welcome. Enjoy your session.'
      : state === 'expiring'
        ? `Checked in. Access valid through ${fmtLong(ms.expiryDate)} · ${Math.max(0, days)} days left`
        : `Expired ${fmtLong(ms.expiryDate)}, ${Math.abs(days)} days ago. Do not admit on this code.`;

  return (
    <View style={styles.resultWrap}>
      <View style={[styles.badge, badgeStyle]}>
        <Icon name={badgeIcon as any} size={42} color={badgeColor} />
      </View>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultSub}>{sub}</Text>

      <View style={styles.scanCard}>
        <Monogram text={`${member.firstName[0]}${member.lastName[0]}`.toUpperCase()} size={44} fontSize={14} bg={state === 'success' ? colors.okSoft : state === 'expiring' ? colors.warnSoft : colors.badSoft} color={state === 'success' ? colors.ok : state === 'expiring' ? colors.warn : colors.bad} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.scanCardName}>{member.firstName} {member.lastName}</Text>
          <Text style={styles.scanCardSub}>{member.id} · {ms.planName}</Text>
        </View>
        <Tag variant={vis.tagVariant}>{vis.tagLabel}</Tag>
      </View>

      <Text style={styles.scanTime}>
        {state === 'success' ? `Checked in at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} · Reception A` : state === 'expiring' ? 'Offer renewal at the desk before they leave' : `Last visit ${member.visits[0]?.date ?? '-'} · previously renewed twice`}
      </Text>

      <View style={styles.resultCtas}>
        {state === 'success' ? (
          <Button block style={{ flex: 1, backgroundColor: colors.ok }} onPress={onScanNext}>Scan next member</Button>
        ) : state === 'expiring' ? (
          <>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={onScanNext}><Text style={{ color: colors.ink }}>Scan next</Text></Button>
            <Button block style={{ flex: 1.3, backgroundColor: colors.warn }} onPress={onRenew}>Renew membership</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={onScanNext}><Text style={{ color: colors.ink }}>Scan next</Text></Button>
            <Button block style={{ flex: 1.3, backgroundColor: colors.bad }} onPress={onViewMember}>View member</Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dk },
  readyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 30, paddingBottom: 40 },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: 'rgba(236,233,224,0.15)',
    borderRadius: 16,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.ok,
  },
  c1: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
  c2: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
  c3: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
  c4: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    height: 2,
    backgroundColor: colors.ok,
    opacity: 0.7,
  },
  readyTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14.5,
    fontWeight: '500',
    color: colors.ink,
  },
  readySub: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    color: colors.ink2,
  },
  live: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '500',
    color: colors.ok,
  },
  simulateBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.okSoft,
    borderWidth: 1,
    borderColor: colors.ok,
  },
  simulateText: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.ok,
  },
  bottomBar: {
    padding: 22,
    paddingBottom: 34,
    backgroundColor: colors.dk2,
    borderTopWidth: 1,
    borderTopColor: colors.dkLine,
  },
  resultWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
    paddingBottom: 40,
  },
  badge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOk: { backgroundColor: colors.okSoft },
  badgeWarn: { backgroundColor: colors.warnSoft },
  badgeBad: { backgroundColor: colors.badSoft },
  resultTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 22,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  resultSub: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 19,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    padding: 16,
    backgroundColor: colors.dk2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.dkLine,
  },
  scanCardName: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  scanCardSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    color: colors.ink2,
    marginTop: 3,
  },
  scanTime: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    color: colors.ink2,
    textAlign: 'center',
  },
  resultCtas: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  manualInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  manualTextInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
  },
  manualResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  manualName: {
    fontFamily: typography.fontFamily,
    fontSize: 14.5,
    fontWeight: '600',
  },
  manualSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    marginTop: 2,
  },
});
