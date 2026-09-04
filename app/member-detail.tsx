import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors, radius, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, Tag, SectionLabel, StatusDot } from '@/components/Tag';
import { KVList, KVRow, Banner } from '@/components/Surfaces';
import { Sheet } from '@/components/Overlays';
import { Field, Control } from '@/components/Field';
import { useMemberDetail, useResendMemberInvitation, useSetMembershipState } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { statusVisual, fmtLong, fmtShort, fmtDateTime, TODAY } from '@/data/format';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function MemberDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberQuery = useMemberDetail(id);
  const setMembershipState = useSetMembershipState();
  const resendInvitation = useResendMemberInvitation();
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const [freezeOpen, setFreezeOpen] = React.useState(false);
  const [pauseUntil, setPauseUntil] = React.useState('');
  const [actionError, setActionError] = React.useState<string | null>(null);

  const m = memberQuery.data ?? null;
  const ms = m?.membership ?? null;
  const invited = m?.accountStatus === 'invited';
  const invitationPending = m?.invitationStatus === 'pending' || m?.invitationStatus === 'failed';

  React.useEffect(() => {
    if (ms && !pauseUntil) {
      setPauseUntil(addDays(TODAY, 30) <= ms.expiryDate ? addDays(TODAY, 30) : ms.expiryDate);
    }
  }, [ms, pauseUntil]);

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Member" onBack={() => router.back()} />
        <Text style={{ color: c.ink2, padding: 20 }}>
          {memberQuery.isLoading ? 'Loading member…' : 'Member not found.'}
        </Text>
      </View>
    );
  }

  const vis = ms ? statusVisual(ms.status, ms, c) : null;

  const togglePause = async () => {
    if (!ms) return;
    setActionError(null);
    try {
      if (ms.status === 'paused') {
        await setMembershipState.mutateAsync({ membershipId: ms.id!, action: 'resume' });
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(pauseUntil)) {
          setActionError('Enter the resume date as YYYY-MM-DD.');
          return;
        }
        if (pauseUntil > ms.expiryDate || pauseUntil <= TODAY) {
          setActionError('The resume date must be after today and within the membership term.');
          return;
        }
        await setMembershipState.mutateAsync({ membershipId: ms.id!, action: 'pause', pauseUntil });
        setFreezeOpen(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The change could not be saved.';
      setActionError(`${message} Try again, or note it for the manager.`);
    }
  };

  const resend = async () => {
    if (!m?.invitationId) return;
    setActionError(null);
    try {
      await resendInvitation.mutateAsync(m.invitationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The invitation could not be resent.';
      setActionError(message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Member" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 18 }}>

          {actionError ? <Banner variant="error">{actionError}</Banner> : null}

          <View style={styles.head}>
            <Monogram text={`${m.firstName[0]}${m.lastName[0]}`.toUpperCase()} size={52} fontSize={17} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Text style={[styles.name, { color: c.ink }]}>{m.firstName} {m.lastName}</Text>
                {invited ? (
                  <Tag variant="muted">Invited</Tag>
                ) : vis ? (
                  <Tag variant={vis.tagVariant}>{vis.tagLabel}</Tag>
                ) : (
                  <Tag variant="muted">No plan</Tag>
                )}
              </View>
              <Text style={[styles.sub, { color: c.ink3 }]}>{m.id} · {m.email} · member since {m.memberSince}</Text>
            </View>
          </View>

          {invitationPending || invited ? (
            <View style={[styles.inviteBox, { borderColor: c.line, backgroundColor: c.bg1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inviteTitle, { color: c.ink }]}>Invitation {m.invitationStatus ?? 'pending'}</Text>
                <Text style={[styles.inviteSub, { color: c.ink3 }]}>
                  {m.invitationStatus === 'failed'
                    ? 'The last send attempt failed. Resend the activation email.'
                    : 'The activation email is waiting to be accepted.'}
                </Text>
              </View>
              <Button
                size="sm"
                variant="secondary"
                icon="refresh"
                loading={resendInvitation.isPending}
                onPress={resend}
              >
                Resend
              </Button>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/renew', params: { id: m.id } })}
            >
              Renew
            </Button>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              loading={setMembershipState.isPending}
              onPress={() => {
                if (ms?.status === 'paused') void togglePause();
                else setFreezeOpen(true);
              }}
            >
              {ms?.status === 'paused' ? 'Unpause' : 'Pause'}
            </Button>
          </View>
          {ms && ms.status !== 'paused' ? (
            <Button
              variant="quiet"
              block
              textStyle={{ fontSize: 13 }}
              style={{ marginTop: -4 }}
              onPress={() => setFreezeOpen(true)}
            >
              Freeze access…
            </Button>
          ) : null}

          <View>
            <SectionLabel>Current membership</SectionLabel>
            {ms ? (
              <KVList>
                <KVRow icon="card" label="Plan">{ms.planName}</KVRow>
                <KVRow icon="cal" label="Start">{fmtLong(ms.startDate)}</KVRow>
                <KVRow icon="cal" label="Expiry">
                  <Text style={{ color: ms.status === 'expired' ? c.bad : ms.status === 'expiring' ? c.warn : c.ink }}>
                    {fmtLong(ms.expiryDate)}
                  </Text>
                </KVRow>
                <KVRow icon="receipt" label="Payment">
                  <StatusDot variant="ok" size={7} /> {ms.payment.state} · {ms.payment.method}
                  {ms.payment.date ? `, ${fmtShort(ms.payment.date)}` : ''}
                  {ms.payment.receiptNumber ? ` · ${ms.payment.receiptNumber}` : ''}
                </KVRow>
              </KVList>
            ) : (
              <Text style={[styles.none, { color: c.ink3 }]}>No membership assigned — assign one from Renew.</Text>
            )}
          </View>

          <View>
            <SectionLabel>Profile & emergency contact</SectionLabel>
            <KVList>
              <KVRow icon="mail" label="Email">{m.email}</KVRow>
              {m.phone ? <KVRow icon="phone" label="Phone">{m.phone}</KVRow> : null}
              {m.dateOfBirth ? <KVRow icon="cal" label="Born">{m.dateOfBirth}</KVRow> : null}
              {m.emergencyName ? (
                <KVRow icon="user" label="Emergency">{m.emergencyName} · {m.emergencyPhone ?? ''}</KVRow>
              ) : null}
              {m.nationalId ? <KVRow icon="card" label="National ID">{m.nationalId}</KVRow> : null}
              {m.address ? <KVRow icon="pin" label="Address">{m.address}</KVRow> : null}
            </KVList>
          </View>

          <View>
            <SectionLabel>Activity log</SectionLabel>
            <View style={[styles.logList, { backgroundColor: c.bg1, borderColor: c.line }]}>
              {m.activity.length === 0 ? (
                <Text style={[styles.none, { color: c.ink3, padding: 16 }]}>No activity recorded yet.</Text>
              ) : (
                m.activity.map((a) => (
                  <View key={a.id} style={[styles.logRow, { borderColor: c.line }]}>
                    <View style={styles.dotCol}>
                      <View style={[styles.logDot, { backgroundColor: c.line2 }, a.kind === 'checkin' && { backgroundColor: c.ok }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.logText, { color: c.ink }]}>{a.text}</Text>
                      <Text style={[styles.logTime, { color: c.ink3 }]}>{fmtDateTime(a.at.slice(0, 16))}{a.author ? ` · by ${a.author}` : ''}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          <View>
            <SectionLabel>Visit history</SectionLabel>
            <View style={[styles.tbl, { backgroundColor: c.bg1, borderColor: c.line }]}>
              {m.visits.length === 0 ? (
                <Text style={[styles.none, { color: c.ink3, padding: 16 }]}>No visits recorded yet.</Text>
              ) : (
                m.visits.slice(0, 7).map((v) => (
                  <View key={v.id} style={[styles.vrow, { borderColor: c.line }]}>
                    <Text style={[styles.vdate, { color: c.ink }]}>{fmtShort(v.date)}</Text>
                    <Text style={[styles.vtime, { color: c.ink }]}>{v.time}</Text>
                    <Text style={[styles.vrec, { color: c.ink2 }]}>
                      {v.method === 'qr' ? 'QR' : 'Desk'} · Rec {v.reception}
                    </Text>
                  </View>
                ))
              )}
            </View>
            <Text style={[styles.visitFoot, { color: c.ink2 }]}>
              {m.visits.length} visits recorded · first on {m.visits.length > 0 ? fmtShort(m.visits[m.visits.length - 1].date) : '—'}
            </Text>
          </View>
        </Body>
      </ScrollView>

      <Sheet
        visible={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        title="Freeze access"
        desc={`Temporarily halt ${m.firstName}'s club access. Remaining days resume when the membership unfreezes.`}
      >
        <View style={{ gap: 12, marginTop: 12 }}>
          <Field label="Resume on" hint="Must be after today and within the membership term.">
            <Control
              value={pauseUntil}
              onChangeText={setPauseUntil}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
          </Field>
          <Button block loading={setMembershipState.isPending} onPress={togglePause}>
            Confirm freeze
          </Button>
          <Button variant="quiet" block onPress={() => setFreezeOpen(false)}>
            Keep active
          </Button>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: {
    fontFamily: typography.fontFamily,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    marginTop: 4,
    lineHeight: 18,
  },
  inviteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
  },
  inviteTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  inviteSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  actions: { flexDirection: 'row', gap: 10 },
  none: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    marginTop: 8,
  },
  logList: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dotCol: { width: 12, paddingTop: 5 },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logText: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    lineHeight: 19,
  },
  logTime: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    marginTop: 3,
  },
  tbl: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
  },
  vrow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  vdate: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    width: 80,
  },
  vtime: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    flex: 1,
  },
  vrec: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
  },
  visitFoot: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    marginTop: 8,
  },
});
