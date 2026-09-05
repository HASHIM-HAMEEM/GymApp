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
import { statusVisual, fmtLong, fmtTodayLabel, fmtDayName, fmtMonthDay, daysBetween, todayIso, formatMoney } from '@/data/format';
import type { Language, TranslationKey } from '@/lib/i18n';
import type { Notice } from '@/data/types';

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
  const c = useColors(darkMode);

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
          <View>
            <IconButton name="bell" onPress={() => router.push('/(member)/notices')} accessibilityLabel={t('common.notifications')} />
            {(noticesQuery.data ?? []).some((notice) => !notice.read) ? <View style={{ pointerEvents: 'none', position: 'absolute', right: 7, top: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} /> : null}
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
          ) : null}

          <MembershipCard
            name={m ? `${m.firstName} ${m.lastName}` : t('member.apexMember')}
            plan={ms ? ms.planName.replace(/ Monthly| Annual/i, '') : t('common.noPlan')}
            validUntil={ms ? fmtLong(ms.expiryDate, language) : m?.memberSince ?? t('common.notAvailable')}
            memberId={m?.id ?? 'MRD-····'}
            variant={ms?.status === 'expiring' || ms?.status === 'due' ? 'warn' : ms?.status === 'expired' ? 'bad' : 'active'}
            href={canShowQr ? '/qr' : undefined}
            showQr={canShowQr && Boolean(qrQuery.data?.value)}
            qrValue={qrQuery.data?.value}
          />

          {m ? (
            <View style={[styles.week, { backgroundColor: c.bg1, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
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
                      style={[styles.wdLabel, { color: isToday ? c.accentHi : c.ink4, writingDirection: isRtl ? 'rtl' : 'ltr' }]}
                    >
                      {wd.label}
                    </Text>
                  </View>
                );
              })}
            </View>
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
              <Text
                style={[styles.cat, { color: latestNotice.urgent ? c.bad : c.accentHi, writingDirection: isRtl ? 'rtl' : 'ltr' }]}
              >
                {t(noticeCategoryKey(latestNotice.category))}
              </Text>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
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
    alignItems: 'flex-start',
  },
  cat: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingTop: 3,
    width: 76,
    flexShrink: 0,
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
