import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, StatusDot, SectionLabel, Tag } from '@/components/Tag';
import { Icon } from '@/components/Icon';
import { useApp } from '@/data/store';
import { expiringSoon, expiredMembers, activeMembers, recentCheckIns } from '@/data/members';
import { fmtShort, daysBetween, TODAY } from '@/data/format';
import type { ColorSet } from '@/theme/tokens';

export default function AdminToday() {
  const router = useRouter();
  const { adminName, darkMode } = useApp();
  const c = useColors(darkMode);
  const expiring = expiringSoon();
  const expired = expiredMembers();
  const active = activeMembers();
  const recent = recentCheckIns(5);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Today" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body>

      <View style={styles.actions}>
        <Button variant="secondary" icon="userplus" onPress={() => router.push('/member-new')}>New member</Button>
        <Button icon="scan" onPress={() => router.push('/(admin)/scanner')}>Scan code</Button>
      </View>

      <View style={[styles.statGrid, { backgroundColor: c.surface, borderColor: c.line }]}>
        <StatCell
          label="Active"
          dot="ok"
          value={active.length}
          sub="in good standing"
          c={c}
          borderRight
          borderBottom
        />
        <StatCell
          label="Expiring"
          dot="warn"
          value={expiring.length}
          sub="within 7 days"
          valueColor={c.warn}
          c={c}
          borderBottom
        />
        <StatCell
          label="Expired"
          dot="bad"
          value={expired.length}
          sub="access paused"
          valueColor={c.bad}
          c={c}
          borderRight
        />
        <StatCell
          label="Check-ins"
          icon="checkc"
          value={recent.length}
          sub={recent[0] ? `last ${recent[0].visit.time}` : 'none today'}
          c={c}
        />
      </View>

      <View>
        <View style={styles.sectionHead}>
          <SectionLabel>Attention · next 7 days</SectionLabel>
          {expiring.length > 0 ? (
            <Button size="sm" variant="quiet" onPress={() => router.push('/(admin)/members')}>View all</Button>
          ) : null}
        </View>
        {expiring.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.bg1, borderColor: c.line }]}>
            <Text style={[styles.emptyText, { color: c.ink3 }]}>No members expiring this week.</Text>
          </View>
        ) : (
          <View style={[styles.tbl, { backgroundColor: c.bg1, borderColor: c.line }]}>
            {expiring.slice(0, 4).map((m) => {
              const days = m.membership ? daysBetween(m.membership.expiryDate, TODAY) : 0;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => router.push({ pathname: '/member-detail', params: { id: m.id } })}
                  style={({ pressed }) => [styles.expRow, { borderColor: c.line }, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.expTop}>
                    <View style={styles.expLeft}>
                      <Monogram text={`${m.firstName[0]}${m.lastName[0]}`.toUpperCase()} size={36} fontSize={12} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.expName, { color: c.ink }]} numberOfLines={1}>{m.firstName} {m.lastName}</Text>
                        <Text style={[styles.expSub, { color: c.ink3 }]} numberOfLines={1}>{m.membership?.planName ?? '-'} · {m.id}</Text>
                      </View>
                    </View>
                    <Tag variant="warn">{Math.max(0, days)}d</Tag>
                  </View>
                  <View style={styles.expBottom}>
                    <Text style={[styles.expDate, { color: c.ink2 }]}>Ends {m.membership ? fmtShort(m.membership.expiryDate) : '-'}</Text>
                    <Button size="sm" onPress={() => router.push({ pathname: '/renew', params: { id: m.id } })}>Renew</Button>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View>
        <SectionLabel>Recent check-ins</SectionLabel>
        {recent.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.bg1, borderColor: c.line }]}>
            <Text style={[styles.emptyText, { color: c.ink3 }]}>No check-ins recorded today.</Text>
          </View>
        ) : (
          <View style={[styles.tbl, { backgroundColor: c.bg1, borderColor: c.line }]}>
            {recent.map(({ member, visit }) => (
              <View key={member.id + visit.id} style={[styles.ciRow, { borderColor: c.line }]}>
                <Monogram text={`${member.firstName[0]}${member.lastName[0]}`.toUpperCase()} size={32} fontSize={11} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.ciName, { color: c.ink }]} numberOfLines={1}>{member.firstName} {member.lastName}</Text>
                  <Text style={[styles.ciSub, { color: c.ink3 }]} numberOfLines={1}>Reception {visit.reception}</Text>
                </View>
                <Text style={[styles.ciTime, { color: c.ink }]}>{visit.time}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
        </Body>
      </ScrollView>
    </View>
  );
}

function StatCell({ label, dot, icon, value, sub, valueColor, c, borderRight, borderBottom }: {
  label: string;
  dot?: 'ok' | 'warn' | 'bad';
  icon?: 'checkc';
  value: number;
  sub: string;
  valueColor?: string;
  c: ColorSet;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  return (
    <View style={[
      styles.statCell,
      borderRight && { borderRightColor: c.line },
      borderBottom && { borderBottomColor: c.line },
    ]}>
      <View style={styles.statLabelRow}>
        {dot ? <StatusDot variant={dot} size={7} /> : null}
        {icon ? <Icon name={icon} size={13} color={c.ink3} /> : null}
        <Text style={[styles.statLabel, { color: c.ink3 }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: valueColor ?? c.ink }]}>{value}</Text>
      <Text style={[styles.statSub, { color: c.ink3 }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.screen },
  hi: {
    fontFamily: typography.fontFamily,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    marginTop: 4,
  },
  actions: { flexDirection: 'row', gap: 10 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statCell: {
    width: '50%',
    padding: 16,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    borderRightWidth: 1,
    borderRightColor: 'transparent',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: typography.display,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.02,
    marginTop: 4,
  },
  statSub: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tbl: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  empty: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
  },
  expRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  expTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  expLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
    minWidth: 0,
  },
  expName: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  expSub: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    marginTop: 2,
  },
  expBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 47,
  },
  expDate: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
  },
  ciRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  ciName: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  ciSub: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    marginTop: 2,
  },
  ciTime: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
});
