import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { MembershipCard } from '@/components/MembershipCard';
import { RingCard } from '@/components/RingCard';
import { IconButton } from '@/components/Button';
import { useApp } from '@/providers/AppProvider';
import { useCurrentMember, useNotices, usePlans, useQrPass } from '@/data/api/queries';
import { statusVisual, fmtLong, daysBetween, TODAY } from '@/data/format';

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
  const { configurationError, darkMode } = useApp();
  const memberQuery = useCurrentMember();
  const noticesQuery = useNotices();
  const plansQuery = usePlans();
  const c = useColors(darkMode);

  const m = memberQuery.data ?? null;
  const ms = m?.membership ?? null;
  const canShowQr = ms?.status === 'active' || ms?.status === 'expiring' || ms?.status === 'due';
  const qrQuery = useQrPass(Boolean(canShowQr));

  const latestNotice = noticesQuery.data?.[0];
  const vis = ms ? statusVisual(ms.status, ms, c) : null;
  const week = weekAround(TODAY);

  const plan = ms && plansQuery.data ? plansQuery.data.find((p) => p.id === ms.planId) : undefined;
  const price = plan?.priceEGP ?? ms?.amountDue ?? 1500;
  const period = plan?.duration === 12 ? 'year' : plan?.duration === 3 ? '3 months' : 'month';

  const ringProgress = (() => {
    if (!ms || !ms.startDate) return 0;
    if (ms.status === 'expired') return 0;
    const total = daysBetween(ms.expiryDate, ms.startDate);
    const left = daysBetween(ms.expiryDate, TODAY);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, left / total));
  })();

  const daysLeft = ms ? Math.max(0, daysBetween(ms.expiryDate, TODAY)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        right={
          <IconButton name="bell" onPress={() => router.push('/(member)/notices')} />
        }
      >
        <View>
          <Text style={[styles.slabel, { color: c.ink3 }]}>{formatTodayLabel(TODAY)}</Text>
          <Text style={[styles.greeting, { color: c.ink }]}>
            {greeting()}{m ? `, ${m.firstName}` : ''}
          </Text>
        </View>
      </AppBar>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Body>
          {configurationError ? (
            <Text style={[styles.configError, { color: c.ink2 }]}>{configurationError}</Text>
          ) : null}

          {ms && vis ? (
            <RingCard
              value={String(daysLeft)}
              unit={ms.status === 'paused' ? 'Days frozen' : ms.status === 'upcoming' ? 'Days to go' : 'Days left'}
              variant={vis.dotVariant}
              tag={{ label: vis.tagLabel, variant: vis.tagVariant }}
              title={ms.planName}
              subtitle={
                ms.status === 'paused'
                  ? `Frozen until ${fmtLong(ms.pauseEnds ?? ms.expiryDate)}\nUnpause at reception.`
                  : ms.status === 'expired'
                  ? `Expired ${fmtLong(ms.expiryDate)}\nRenew to restore access.`
                  : ms.status === 'upcoming'
                  ? `Begins ${fmtLong(ms.startDate)}\nAccess opens on the start date.`
                  : ms.status === 'expiring'
                  ? `Expires in ${daysLeft} days\nRenew at reception.`
                  : `Renews ${fmtLong(ms.expiryDate)}\nat reception.`
              }
              progress={ringProgress}
            />
          ) : null}

          <MembershipCard
            name={m ? `${m.firstName} ${m.lastName}` : 'Meridian member'}
            plan={ms ? ms.planName.replace(/ Monthly| Annual/i, '') : 'No plan'}
            validUntil={ms ? fmtLong(ms.expiryDate) : m?.memberSince ?? '—'}
            memberId={m?.id ?? 'MRD-····'}
            variant={ms?.status === 'expiring' || ms?.status === 'due' ? 'warn' : ms?.status === 'expired' ? 'bad' : 'active'}
            href={canShowQr ? '/qr' : undefined}
            showQr={canShowQr && Boolean(qrQuery.data?.value)}
            qrValue={qrQuery.data?.value}
          />

          {m ? (
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
                          borderColor: isToday ? c.accentHi : on ? c.accent : 'rgba(233,238,248,0.22)',
                          backgroundColor: on ? c.accent : 'transparent',
                          shadowColor: on ? c.accentGlow : 'transparent',
                          shadowOpacity: on ? 0.8 : 0,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 0 },
                        },
                      ]}
                    />
                    <Text
                      style={[styles.wdLabel, { color: isToday ? c.accentHi : c.ink4 }]}
                    >
                      {wd.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {m && !ms ? (
            <Text style={[styles.noPlan, { color: c.ink3 }]}>
              No membership assigned yet. Reception can set one up in about two minutes — ask at the desk.
            </Text>
          ) : null}

          {latestNotice ? (
            <Pressable
              onPress={() => router.push(`/notice?id=${latestNotice.id}`)}
              style={[styles.noticeRow, { borderColor: c.line, backgroundColor: c.bg1 }]}
            >
              <Text
                style={[styles.cat, { color: latestNotice.urgent ? c.bad : c.accentHi }]}
              >
                {latestNotice.category}
              </Text>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={[styles.nt, { color: c.ink }]} numberOfLines={1}>
                  {latestNotice.title}
                </Text>
                <Text style={[styles.np, { color: c.ink3 }]} numberOfLines={1}>
                  {latestNotice.body}
                </Text>
              </View>
              <Text style={[styles.ndt, { color: c.ink4, fontFamily: typography.mono }]}>
                {MONTHS[parseInt(latestNotice.date.slice(5, 7), 10) - 1]} {parseInt(latestNotice.date.slice(8), 10)}
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
  configError: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
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
  noPlan: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
  },
  noticeRow: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  cat: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingTop: 3,
    width: 76,
    flexShrink: 0,
  },
  nt: {
    fontFamily: typography.display,
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  np: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  ndt: {
    fontFamily: typography.mono,
    fontSize: 11,
    paddingTop: 3,
    marginLeft: 6,
    flexShrink: 0,
  },
});
