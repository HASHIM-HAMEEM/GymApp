import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Monogram, SectionLabel, StatusDot, Tag } from '@/components/Tag';
import { Icon } from '@/components/Icon';
import { useApp } from '@/providers/AppProvider';
import { useDashboard } from '@/data/api/queries';
import { fmtShort, daysBetween, TODAY } from '@/data/format';
import { CLUB } from '@/data/plans';
import type { ColorSet } from '@/theme/tokens';

export default function AdminToday() {
  const router = useRouter();
  const { adminName, darkMode } = useApp();
  const dashboardQuery = useDashboard();
  const c = useColors(darkMode);
  const data = dashboardQuery.data;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const expiring = data?.expiring_list ?? [];
  const recent = data?.recent_check_ins ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Today" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body>

      <View style={{ gap: 4 }}>
        <Text style={[styles.hi, { color: c.ink }]}>
          {greeting}{adminName ? `, ${adminName.split(' ')[0]}` : ''}
        </Text>
        <Text style={[styles.sub, { color: c.ink3 }]}>{CLUB.name} · front desk</Text>
      </View>

      <View style={styles.actions}>
        <Button variant="secondary" icon="userplus" onPress={() => router.push('/member-new')}>New member</Button>
        <Button icon="scan" onPress={() => router.push('/(admin)/scanner')}>Scan code</Button>
      </View>

      <View style={[styles.statGrid, { backgroundColor: c.surface, borderColor: c.line }]}>
        <StatCell
          label="Active"
          dot="ok"
          value={data?.active_members ?? 0}
          sub="in good standing"
          c={c}
          borderRight
          borderBottom
        />
        <StatCell
          label="Expiring"
          dot="warn"
          value={data?.expiring_soon ?? 0}
          sub="within 7 days"
          valueColor={c.warn}
          c={c}
          borderBottom
        />
        <StatCell
          label="Expired"
          dot="bad"
          value={data?.expired_members ?? 0}
          sub="access paused"
          valueColor={c.bad}
          c={c}
          borderRight
        />
        <StatCell
          label="Check-ins"
          icon="checkc"
          value={data?.check_ins_today ?? 0}
          sub={recent[0] ? `last ${new Date(recent[0].checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : 'none today'}
          c={c}
        />
      </View>

      {(data?.pending_invitations ?? 0) > 0 ? (
        <Pressable
          onPress={() => router.push('/(admin)/members')}
          style={({ pressed }) => [
            styles.inviteRow,
            { borderColor: c.line, backgroundColor: c.bg1 },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Monogram text="IV" size={36} fontSize={12} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.inviteTitle, { color: c.ink }]}>Invitations waiting</Text>
            <Text style={[styles.inviteSub, { color: c.ink3 }]}>
              {data?.pending_invitations} member{data?.pending_invitations === 1 ? '' : 's'} {data?.pending_invitations === 1 ? "hasn't" : "haven't"} accepted their email invitation. Resend from their profile.
            </Text>
          </View>
          <Icon name="chev" size={16} color={c.ink4} />
        </Pressable>
      ) : null}

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
              const days = m.end_date ? daysBetween(m.end_date, TODAY) : 0;
              return (
                <Pressable
                  key={m.member_id}
                  onPress={() => router.push({ pathname: '/member-detail', params: { id: m.member_number } })}
                  style={({ pressed }) => [styles.expRow, { borderColor: c.line }, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.expTop}>
                    <View style={styles.expLeft}>
                      <Monogram text={`${m.first_name[0]}${m.last_name[0]}`.toUpperCase()} size={36} fontSize={12} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.expName, { color: c.ink }]} numberOfLines={1}>{m.first_name} {m.last_name}</Text>
                        <Text style={[styles.expSub, { color: c.ink3 }]} numberOfLines={1}>{m.plan_name ?? 'No plan'} · {m.member_number}</Text>
                      </View>
                    </View>
                    <Tag variant="warn">{Math.max(0, days)}d</Tag>
                  </View>
                  <View style={styles.expBottom}>
                    <Text style={[styles.expDate, { color: c.ink2 }]}>Ends {m.end_date ? fmtShort(m.end_date) : '-'}</Text>
                    <Button size="sm" onPress={() => router.push({ pathname: '/renew', params: { id: m.member_number } })}>Renew</Button>
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
            {recent.map((ci) => (
              <View key={ci.member_number + ci.checked_in_at} style={[styles.ciRow, { borderColor: c.line }]}>
                <Monogram text={`${ci.first_name[0]}${ci.last_name[0]}`.toUpperCase()} size={32} fontSize={11} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.ciName, { color: c.ink }]} numberOfLines={1}>{ci.first_name} {ci.last_name}</Text>
                  <Text style={[styles.ciSub, { color: c.ink3 }]} numberOfLines={1}>
                    {ci.source === 'qr' ? 'QR scan' : 'Front desk'} · Reception {ci.reception ?? 'A'}
                  </Text>
                </View>
                <Text style={[styles.ciTime, { color: c.ink }]}>
                  {new Date(ci.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
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
  hi: {
    fontFamily: typography.fontFamily,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
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
  inviteRow: {
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
