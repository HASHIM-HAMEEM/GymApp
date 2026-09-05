import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking, radius } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { MembershipCard } from '@/components/MembershipCard';
import { RingCard } from '@/components/RingCard';
import { IconButton, Button } from '@/components/Button';
import { Sheet } from '@/components/Overlays';
import { useApp } from '@/providers/AppProvider';
import { useCurrentMember, useNotices, usePlans, useQrPass, useMarkAllNoticesRead } from '@/data/api/queries';
import { statusVisual, fmtLong, fmtTodayLabel, fmtDayName, fmtMonthDay, daysBetween, todayIso, formatMoney } from '@/data/format';
import type { Language, TranslationKey } from '@/lib/i18n';
import type { Notice } from '@/data/types';

/** Wrap a card in a pressable that navigates to member overview. */
function TapCard({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      {children}
    </Pressable>
  );
}

function weekAround(iso: string, language: Language) {
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
      label: fmtDayName((i + 1) % 7, language),
      iso: `${y}-${m}-${dd}`,
    });
  }
  return out;
}

function noticeCategoryKey(category: Notice['category']): TranslationKey {
  switch (category) {
    case 'Urgent': return 'noticeCategory.urgent';
    case 'Schedule': return 'noticeCategory.schedule';
    case 'Hours': return 'noticeCategory.hours';
    case 'Facilities': return 'noticeCategory.facilities';
    case 'Renewal': return 'noticeCategory.renewal';
    default: return 'noticeCategory.renewal';
  }
}

export default function MemberHome() {
  const router = useRouter();
  const { t, isRtl, language, configurationError, darkMode } = useApp();
  const memberQuery = useCurrentMember();
  const noticesQuery = useNotices();
  const plansQuery = usePlans();
  const markAllRead = useMarkAllNoticesRead();
  const c = useColors(darkMode);
  const [clearOpen, setClearOpen] = React.useState(false);

  const hasUnread = (noticesQuery.data ?? []).some((n) => !n.read);

  const handleClearAll = async () => {
    try {
      await markAllRead.mutateAsync();
      setClearOpen(false);
    } catch {
      setClearOpen(false);
    }
  };

  const m = memberQuery.data ?? null;
  const ms = m?.membership ?? null;
  const canShowQr = ms?.status === 'active' || ms?.status === 'expiring' || ms?.status === 'due';
  const qrQuery = useQrPass(Boolean(canShowQr));

  const today = m?.asOf ?? todayIso();
  const latestNotice = noticesQuery.data?.[0];
  const vis = ms ? statusVisual(ms.status, ms, c, language) : null;
  const week = weekAround(today, language);

  const plan = ms && plansQuery.data ? plansQuery.data.find((p) => p.id === ms.planId) : undefined;
  const price = plan?.price ?? ms?.amountDue ?? 0;

  const ringProgress = (() => {
    if (!ms || !ms.startDate) return 0;
    if (ms.status === 'expired') return 0;
    const total = daysBetween(ms.expiryDate, ms.startDate);
    const left = daysBetween(ms.expiryDate, today);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, left / total));
  })();

  const daysLeft = ms ? Math.max(0, daysBetween(ms.expiryDate, today)) : 0;

  const h = new Date().getHours();
  const greetingWord =
    h < 12 ? t('member.greetingMorning') : h < 18 ? t('member.greetingAfternoon') : t('member.greetingEvening');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        right={
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 2 }}>
            {hasUnread ? (
              <IconButton
                name="close"
                onPress={() => setClearOpen(true)}
                accessibilityLabel={t('notices.clearAll')}
              />
            ) : null}
            <View>
              <IconButton name="bell" onPress={() => router.push('/(member)/notices')} accessibilityLabel={t('common.notifications')} />
              {hasUnread ? <View style={{ pointerEvents: 'none', position: 'absolute', right: 7, top: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} /> : null}
            </View>
          </View>
        }
      >
        <View>
          <Text style={[styles.slabel, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {fmtTodayLabel(today, language)}
          </Text>
          <Text style={[styles.greeting, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {m ? t('member.greetingWithName', { greeting: greetingWord, name: m.firstName }) : greetingWord}
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
            <Text style={[styles.configError, { color: c.ink2, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
              {configurationError}
            </Text>
          ) : null}

          {ms && vis ? (
            <TapCard onPress={() => router.push('/member-overview')}>
              <RingCard
                value={String(daysLeft)}
                unit={ms.status === 'paused' ? t('member.daysFrozen') : ms.status === 'upcoming' ? t('member.daysToGo') : t('member.daysLeft')}
                variant={vis.dotVariant}
                tag={{ label: vis.tagLabel, variant: vis.tagVariant }}
                title={ms.planName}
                subtitle={
                  ms.status === 'paused'
                    ? t('member.frozenUntil', { date: `\u200E${fmtLong(ms.pauseEnds ?? ms.expiryDate, language)}\u200E` })
                    : ms.status === 'expired'
                    ? t('member.expiredOn', { date: `\u200E${fmtLong(ms.expiryDate, language)}\u200E` })
                    : ms.status === 'upcoming'
                    ? t('member.beginsOn', { date: `\u200E${fmtLong(ms.startDate, language)}\u200E` })
                    : ms.status === 'expiring'
                    ? t('member.expiresIn', { days: `\u200E${daysLeft}\u200E` })
                    : t('member.renewsOn', { date: `\u200E${fmtLong(ms.expiryDate, language)}\u200E` })
                }
                progress={ringProgress}
              />
            </TapCard>
          ) : null}

          <MembershipCard
            name={m ? `${m.firstName} ${m.lastName}` : t('member.apexMember')}
            plan={ms ? ms.planName.replace(/ Monthly| Annual/i, '') : t('common.noPlan')}
            validUntil={ms ? fmtLong(ms.expiryDate, language) : m?.memberSince ?? t('common.notAvailable')}
            memberId={m?.id ?? 'MRD-····'}
            variant={ms?.status === 'expiring' || ms?.status === 'due' ? 'warn' : ms?.status === 'expired' ? 'bad' : 'active'}
            href={canShowQr ? '/qr' : '/member-overview'}
            showQr={canShowQr && Boolean(qrQuery.data?.value)}
            qrValue={qrQuery.data?.value}
          />

          {m ? (
            <TapCard onPress={() => router.push('/(member)/visits')}>
              <View style={[styles.week, { backgroundColor: c.bg1, borderColor: c.line }]}>
                <View style={[styles.weekHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.weekTitle, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
                    {t('member.thisWeek')}
                  </Text>
                  <Text style={[styles.weekCount, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
                    {m.visits.filter((v) => week.some((wd) => wd.iso === v.date)).length} {t('member.visitsThisWeek')}
                  </Text>
                </View>
                <View style={[styles.weekRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  {week.map((wd) => {
                    const visited = m.visits.some((v) => v.date === wd.iso);
                    const isToday = wd.iso === today;
                    const on = visited && !isToday;
                    return (
                      <View key={wd.iso} style={styles.wd}>
                        <View
                          style={[
                            styles.dot,
                            {
                              borderColor: isToday ? c.accentHi : on ? c.accent : c.line2,
                              backgroundColor: on ? c.accent : 'transparent',
                              shadowColor: on ? c.accentGlow : 'transparent',
                              shadowOpacity: on ? 0.6 : 0,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 0 },
                            },
                          ]}
                        />
                        <Text
                          style={[styles.wdLabel, { color: isToday ? c.accentHi : on ? c.ink2 : c.ink4, writingDirection: isRtl ? 'rtl' : 'ltr' }]}
                        >
                          {wd.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </TapCard>
          ) : null}

          {m && !ms ? (
            <Text style={[styles.noPlan, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
              {t('member.noPlanAssigned')}
            </Text>
          ) : null}

          {latestNotice ? (
            <Pressable
              onPress={() => router.push(`/notice?id=${latestNotice.id}`)}
              style={[styles.noticeRow, { borderColor: c.line, backgroundColor: c.bg1, flexDirection: isRtl ? 'row-reverse' : 'row' }]}
            >
              <View style={[styles.noticeIcon, { backgroundColor: latestNotice.urgent ? c.badSoft : c.accentSoft }]}>
                <View style={[styles.noticeDot, { backgroundColor: latestNotice.urgent ? c.bad : c.accent }]} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    style={[styles.cat, { color: latestNotice.urgent ? c.bad : c.ink2, writingDirection: isRtl ? 'rtl' : 'ltr' }]}
                  >
                    {t(noticeCategoryKey(latestNotice.category))}
                  </Text>
                  {!latestNotice.read ? (
                    <View style={[styles.unreadDot, { backgroundColor: c.accent }]} />
                  ) : null}
                </View>
                <Text style={[styles.nt, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]} numberOfLines={1}>
                  {latestNotice.title}
                </Text>
                <Text style={[styles.np, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]} numberOfLines={1}>
                  {latestNotice.body}
                </Text>
              </View>
              <Text style={[styles.ndt, { color: c.ink4, fontFamily: typography.mono, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
                {fmtMonthDay(latestNotice.date, language)}
              </Text>
            </Pressable>
          ) : null}
        </Body>
      </ScrollView>

      <Sheet
        visible={clearOpen}
        onClose={() => setClearOpen(false)}
        title={t('notices.clearAll')}
        desc={t('notices.clearAllBody')}
      >
        <View style={{ gap: 10, marginTop: 12 }}>
          <Button block loading={markAllRead.isPending} onPress={handleClearAll}>
            {t('notices.clearAllConfirm')}
          </Button>
          <Button variant="quiet" block disabled={markAllRead.isPending} onPress={() => setClearOpen(false)}>
            {t('common.cancel')}
          </Button>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  slabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: tracking.caps,
    textTransform: 'uppercase',
  },
  greeting: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.015,
    marginTop: 4,
  },
  configError: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 19,
  },
  week: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekTitle: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  weekCount: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: tracking.small,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wd: { flex: 1, alignItems: 'center', gap: 10 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  wdLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.06,
    textTransform: 'uppercase',
  },
  noPlan: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 19,
  },
  noticeRow: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  noticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noticeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cat: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  nt: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  np: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 18,
    marginTop: 3,
  },
  ndt: {
    fontFamily: typography.mono,
    fontSize: 11,
    letterSpacing: tracking.small,
    paddingTop: 3,
    marginLeft: 6,
    flexShrink: 0,
  },
});
