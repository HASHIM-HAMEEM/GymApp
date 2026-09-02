import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors, spacing, typography, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, Tag, SectionLabel, StatusDot } from '@/components/Tag';
import { KVList, KVRow } from '@/components/Surfaces';
import { Icon } from '@/components/Icon';
import { useApp } from '@/data/store';
import { statusVisual, fmtLong, fmtShort, fmtDateTime } from '@/data/format';

export default function MemberDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMember, darkMode } = useApp();
  const c = useColors(darkMode);
  const m = id ? getMember(id) : undefined;

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Member" onBack={() => router.back()} />
        <Text style={{ color: c.ink2, padding: spacing.screen }}>Member not found.</Text>
      </View>
    );
  }

  const ms = m.membership;
  const vis = ms ? statusVisual(ms.status, ms, c) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Member" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 18 }}>

      <View style={styles.head}>
        <Monogram text={`${m.firstName[0]}${m.lastName[0]}`.toUpperCase()} size={52} fontSize={17} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={[styles.name, { color: c.ink }]}>{m.firstName} {m.lastName}</Text>
            {vis ? <Tag variant={vis.tagVariant}>{vis.tagLabel}</Tag> : null}
          </View>
          <Text style={[styles.sub, { color: c.ink3 }]}>{m.id} · {m.phone} · member since {m.memberSince}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button variant="secondary" icon="phone" style={{ flex: 1 }} onPress={() => {}}>Call</Button>
        <Button icon="refresh" style={{ flex: 1.3 }} onPress={() => router.push({ pathname: '/renew', params: { id: m.id } })}>
          Renew membership
        </Button>
      </View>

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
              <StatusDot variant="ok" size={7} /> {ms.payment.state} · {ms.payment.method}, {fmtShort(ms.payment.date)}
            </KVRow>
          </KVList>
        ) : (
          <Text style={[styles.none, { color: c.ink3 }]}>No membership assigned.</Text>
        )}
      </View>

      <View>
        <SectionLabel>Profile & emergency contact</SectionLabel>
        <KVList>
          <KVRow icon="phone" label="Phone">{m.phone}</KVRow>
          {m.email ? <KVRow icon="mail" label="Email">{m.email}</KVRow> : null}
          {m.emergencyName ? (
            <KVRow icon="user" label="Emergency">{m.emergencyName} · {m.emergencyPhone}</KVRow>
          ) : null}
          <KVRow icon="card" label="Aadhar">{m.aadharNumber}</KVRow>
          <KVRow icon="pin" label="Address">{m.address}</KVRow>
        </KVList>
      </View>

      <View>
        <SectionLabel>Activity log</SectionLabel>
        <View style={[styles.logList, { backgroundColor: c.bg1, borderColor: c.line }]}>
          {m.activity.map((a) => (
            <View key={a.id} style={[styles.logRow, { borderColor: c.line }]}>
              <View style={styles.dotCol}>
                <View style={[styles.logDot, { backgroundColor: c.line2 }, a.kind === 'checkin' && { backgroundColor: c.ok }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logText, { color: c.ink }]}>{a.text}</Text>
                <Text style={[styles.logTime, { color: c.ink3 }]}>{fmtDateTime(a.at)}{a.author ? ` · by ${a.author}` : ''}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View>
        <SectionLabel>Visit history</SectionLabel>
        <View style={[styles.tbl, { backgroundColor: c.bg1, borderColor: c.line }]}>
          {m.visits.slice(0, 7).map((v) => (
            <View key={v.id} style={[styles.vrow, { borderColor: c.line }]}>
              <Text style={[styles.vdate, { color: c.ink }]}>{fmtShort(v.date)}</Text>
              <Text style={[styles.vtime, { color: c.ink }]}>{v.time}</Text>
              <Text style={[styles.vrec, { color: c.ink2 }]}>Reception {v.reception}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.visitFoot, { color: c.ink2 }]}>{m.visits.length} visits this membership · first on {m.visits.length > 0 ? fmtShort(m.visits[m.visits.length - 1].date) : '-'}</Text>
      </View>
        </Body>
      </ScrollView>
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
