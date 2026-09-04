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
import type { Language, TranslationKey } from '@/lib/i18n';

function paymentKey(method?: string): TranslationKey {
  switch (method?.toLowerCase()) {
    case 'cash': return 'payment.cash';
    case 'card': return 'payment.card';
    case 'wallet': return 'payment.wallet';
    case 'instapay': return 'payment.instapay';
    case 'complimentary': return 'payment.complimentary';
    default: return 'common.notAvailable';
  }
}

function subtitleFor(
  status: string,
  planPrice: number | undefined,
  amountDue: number | undefined,
  expiryDate: string,
  language: Language,
  t: (key: TranslationKey, options?: Record<string, unknown>) => string,
): string {
  if (status === 'expired') return t('membership.ended', { date: fmtLong(expiryDate, language) });
  if (status === 'upcoming') return t('membership.beginsSoon', { date: fmtLong(expiryDate, language) });
  if (status === 'paused') return t('membership.frozen');
  if (status === 'due') return t('membership.paymentDue', { amount: t('common.egpAmount', { amount: (amountDue ?? 0).toLocaleString() }) });
  if (planPrice) return t('common.egpAmount', { amount: planPrice.toLocaleString() });
  return t('membership.validUntil', { date: fmtLong(expiryDate, language) });
}

export default function MembershipScreen() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const plansQuery = usePlans();
  const clubQuery = useClub();
  const { t, isRtl, language, darkMode } = useApp();
  const c = useColors(darkMode);
  const m = memberQuery.data ?? null;
  const ms = m?.membership ?? null;

  if (!ms) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar onBack={() => router.back()}>
          <Text style={[styles.appBarTitle, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('membership.title')}</Text>
        </AppBar>
        <EmptyState
          icon="card"
          title={t('membership.noPlanTitle')}
          body={t('membership.noPlanBody')}
          action={
            <View style={{ alignItems: 'center', gap: 12, marginTop: 22 }}>
              <Button
                onPress={() => {
                  if (clubQuery.data?.phone) void Linking.openURL(`tel:${clubQuery.data.phone}`);
                }}
              >
                {t('membership.contactReception')}
              </Button>
              {clubQuery.data ? (
                <Text style={{ fontSize: 12.5, color: c.ink3, textAlign: 'center', writingDirection: isRtl ? 'rtl' : 'ltr' }}>
                  {t('membership.clubContact', { name: clubQuery.data.name, phone: clubQuery.data.phone })}
                </Text>
              ) : null}
            </View>
          }
        />
      </View>
    );
  }

  const vis = statusVisual(ms.status, ms, c, language);
  const tl = timelineFill(ms.startDate, ms.expiryDate);
  const total = daysBetween(ms.expiryDate, ms.startDate);
  const left = Math.max(0, daysBetween(ms.expiryDate, TODAY));
  const progress = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const ringValue = String(left);
  const showTimeline = ms.status === 'active' || ms.status === 'expiring' || ms.status === 'upcoming';
  const plan = plansQuery.data?.find((p) => p.id === ms.planId);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar onBack={() => router.back()}>
        <Text style={[styles.appBarTitle, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('membership.title')}</Text>
      </AppBar>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body>
          {vis.bannerText ? (
            <Banner variant={vis.bannerVariant}>{vis.bannerText}</Banner>
          ) : null}

          <RingCard
            value={ringValue}
            unit={ms.status === 'paused' ? t('member.daysFrozen') : ms.status === 'expired' ? t('member.daysPast') : t('member.daysLeft')}
            variant={vis.dotVariant}
            tag={{ label: vis.tagLabel, variant: vis.tagVariant }}
            title={ms.planName}
            subtitle={subtitleFor(ms.status, plan?.priceEGP, ms.amountDue, ms.expiryDate, language, t)}
            progress={progress}
          >
            {showTimeline ? (
              <Timeline
                fill={tl.fill}
                fillColor={vis.fillColor}
                l1={[t('membership.timelineStart'), fmtShort(ms.startDate, language)]}
                l2={[t('membership.timelineToday'), fmtShort(TODAY, language)]}
                l3={[t('membership.timelineEnds'), fmtShort(ms.expiryDate, language)]}
              />
            ) : null}
          </RingCard>

          <KVList>
            {ms.status === 'paused' && ms.pauseEnds ? (
              <>
                <KVRow icon="pause" label={t('membership.resumes')}>{fmtLong(ms.pauseEnds, language)}</KVRow>
                <KVRow icon="clock" label={t('membership.daysPreserved')}>{t('common.countOfTotal', { count: ringValue, total })}</KVRow>
              </>
            ) : ms.status === 'expired' ? (
              <>
                <KVRow icon="cal" label={t('membership.expiredOn')}>
                  <Text style={{ color: c.bad, writingDirection: isRtl ? 'rtl' : 'ltr' }}>{fmtLong(ms.expiryDate, language)}</Text>
                </KVRow>
                <KVRow icon="clock" label={t('membership.visitsKept')}>{t('membership.visitsHistory', { count: m ? m.visits.length : 0 })}</KVRow>
                <KVRow icon="receipt" label={t('membership.restartFrom')}>
                  {plan?.priceEGP ? t('common.egpAmount', { amount: plan.priceEGP.toLocaleString() }) : t('common.notAvailable')}
                </KVRow>
              </>
            ) : ms.status === 'due' ? (
              <>
                <KVRow icon="receipt" label={t('membership.amountDue')}>
                  <Text style={{ color: c.warn, writingDirection: isRtl ? 'rtl' : 'ltr' }}>
                    {ms.amountDue ? t('common.egpAmount', { amount: ms.amountDue.toLocaleString() }) : t('common.notAvailable')}
                  </Text>
                </KVRow>
                <KVRow icon="cal" label={t('membership.accessUntil')}>{fmtLong(ms.expiryDate, language)}</KVRow>
              </>
            ) : (
              <>
                <KVRow icon="cal" label={t('membership.started')}>{fmtLong(ms.startDate, language)}</KVRow>
                <KVRow icon="cal" label={t('membership.validUntilLabel')}>{fmtLong(ms.expiryDate, language)}</KVRow>
                <KVRow icon="receipt" label={t('membership.lastPayment')}>
                  {t('membership.paymentDetails', {
                    amount: ms.payment.amountEGP ? t('common.egpAmount', { amount: ms.payment.amountEGP.toLocaleString() }) : t('common.notAvailable'),
                    method: t(paymentKey(ms.payment.method)),
                    date: fmtShort(ms.payment.date, language),
                  })}
                </KVRow>
                <KVRow icon="refresh" label={t('membership.renewal')}>
                  <Text style={{ color: c.ink3, fontWeight: '500', writingDirection: isRtl ? 'rtl' : 'ltr' }}>
                    {t('membership.renewalAtReception', { date: fmtShort(ms.expiryDate, language) })}
                  </Text>
                </KVRow>
              </>
            )}
          </KVList>

          <View style={styles.ctas}>
            {ms.status === 'active' || ms.status === 'expiring' || ms.status === 'due' ? (
              <>
                <Button block href="/qr">{t('membership.showQr')}</Button>
                <Button variant="quiet" block href="/(member)/profile">
                  {t('membership.askRenew')}
                </Button>
              </>
            ) : ms.status === 'upcoming' ? (
              <Button variant="secondary" block href="/qr">
                {t('membership.previewCard')}
              </Button>
            ) : ms.status === 'paused' ? (
              <Button variant="secondary" block href="/(member)/profile">
                {t('membership.resumeEarly')}
              </Button>
            ) : (
              <Button variant="secondary" block href="/(member)/profile">
                {t('membership.renewRestore')}
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
  appBarTitle: {
    fontFamily: typography.display,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.01,
  },
});
