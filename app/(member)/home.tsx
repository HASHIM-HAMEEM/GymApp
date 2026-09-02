import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { MembershipCard } from '@/components/MembershipCard';
import { RingCard } from '@/components/RingCard';
import { Tag } from '@/components/Tag';
import { IconButton } from '@/components/Button';
import { useApp } from '@/data/store';
import { statusVisual, fmtLong, fmtShort, daysBetween, TODAY } from '@/data/format';
import { planByName } from '@/data/plans';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function weekAround(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  const monday = new Date(d.getTime() - diff * 86400000);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday.getTime() + i * 86400000);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    out.push({
      label: DAYS[(i + 1) % 7],
      iso: `${y}-${m}-${dd}`,
    });
  }
  return out;
}

function formatTodayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const day = DAYS[d.getDay()];
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${day} · ${date}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function MemberHome() {
  const router = useRouter();
  const { currentMember, notices, darkMode } = useApp();
  const c = useColors(darkMode);
  if (!currentMember) return null;

  const m = currentMember;
  const ms = m.membership;
  const latestNotice = notices[0];
  const vis = ms ? statusVisual(ms.status, ms, c) : null;
  const week = weekAround(TODAY);

  const ringProgress = (() => {
    if (!ms) return 0;
    if (ms.status === 'expired') return 0;
    const total = daysBetween(ms.expiryDate, ms.startDate);
    const left = daysBetween(ms.expiryDate, TODAY);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, left / total));
  })();

  const daysLeft = ms ? Math.max(0, daysBetween(ms.expiryDate, TODAY)) : 0;
  const plan = ms ? planByName(ms.planName) : undefined;
  const price = plan?.priceEGP ?? ms?.amountDue ?? 1500;
  const period = plan?.duration === 12 ? 'year' : plan?.duration === 3 ? '3 months' : 'month';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        right={
          <IconButton name="bell" onPress={() => router.push('/notices')} />
        }
      >
        <View>
          <Text style={[styles.slabel, { color: c.ink3 }]}>{formatTodayLabel(TODAY)}</Text>
          <Text style={[styles.greeting, { color: c.ink }]}>{greeting()}, {m.firstName}</Text>
        </View>
      </AppBar>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        <Body>
          {ms && vis ? (
            <RingCard
              value={String(daysLeft)}
              unit={ms.status === 'paused' ? 'Days frozen' : 'Days left'}
              variant={vis.dotVariant}
              tag={{ label: vis.tagLabel, variant: vis.tagVariant }}
              title={ms.planName}
              subtitle={`EGP ${price.toLocaleString()} / ${period}`}
              progress={ringProgress}
            />
          ) : null}

          <MembershipCard
            name={`${m.firstName} ${m.lastName}`}
            plan={ms ? ms.planName : 'No plan'}
            validUntil={ms ? fmtLong(ms.expiryDate) : m.memberSince}
            memberId={m.id}
            tag={{ label: vis ? vis.tagLabel : 'No plan', variant: vis ? vis.tagVariant : 'muted' }}
            onShowQr={() => router.push('/qr')}
            showQr={!!ms}
          />

          <View style={[styles.week, { backgroundColor: c.bg1, borderColor: c.line }]}>
            {week.map((wd) => {
              const visited = m.visits.some((v) => v.date === wd.iso);
              const isToday = wd.iso === TODAY;
              const on = visited && !isToday;
              return (
                <View key={wd.iso} style={styles.wd}>
                  <View
                    style={[
                      styles.dot,
                      {
                        borderColor: isToday ? c.accentHi : c.ink4,
                        backgroundColor: on ? c.accent : 'transparent',
                        shadowColor: on ? c.accentGlow : 'transparent',
                        shadowOpacity: on ? 1 : 0,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 },
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.wdLabel,
                      { color: isToday ? c.accentHi : c.ink4 },
                    ]}
                  >
                    {wd.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {latestNotice ? (
            <Pressable
              onPress={() => router.push(`/notice?id=${latestNotice.id}`)}
              style={[styles.noticeRow, { borderColor: c.line, backgroundColor: c.bg1 }]}
            >
              <Text style={[styles.cat, { color: c.accentHi }]}>{latestNotice.category}</Text>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={[styles.nt, { color: c.ink }]} numberOfLines={1}>
                  {latestNotice.title}
                </Text>
                <Text style={[styles.np, { color: c.ink3 }]} numberOfLines={1}>
                  {latestNotice.body}
                </Text>
              </View>
              <Text style={[styles.ndt, { color: c.ink4, fontFamily: typography.mono }]}>
                {fmtShort(latestNotice.date)}
              </Text>
            </Pressable>
          ) : null}
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  slabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: tracking.caps,
    textTransform: 'uppercase',
  },
  greeting: {
    fontFamily: typography.display,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.015,
    marginTop: 4,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  wd: { flex: 1, alignItems: 'center', gap: 9 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  wdLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.06,
    textTransform: 'uppercase',
  },
  noticeRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 15,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  cat: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.09,
    textTransform: 'uppercase',
    paddingTop: 4,
    width: 62,
    flexShrink: 0,
  },
  nt: { fontSize: 14.5, fontWeight: '600', lineHeight: 20 },
  np: { fontSize: 13, marginTop: 2 },
  ndt: { fontSize: 11, paddingTop: 3 },
});
