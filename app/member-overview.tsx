import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Tag, SectionLabel } from '@/components/Tag';
import { KVRow, KVList, Banner } from '@/components/Surfaces';
import { LtrText } from '@/components/LtrText';
import { useCurrentMember, usePlans } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { statusVisual, fmtLong, fmtShort, fmtDateTime, daysBetween, todayIso, formatMoney } from '@/data/format';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Member overview — dedicated page showing full member details that are
 * NOT already on the home screen. Opens when tapping home-screen widgets.
 * Home shows: greeting, RingCard, MembershipCard, week visits, latest notice.
 * This page shows: profile info, full membership details, payment, visit history.
 */
function paymentMethodKey(method?: string): TranslationKey {
  switch (method?.toLowerCase()) {
    case 'cash': return 'payment.cash';
    case 'card': return 'payment.card';
    case 'wallet': return 'payment.wallet';
    case 'upi': return 'payment.upi';
    case 'instapay': return 'payment.instapay';
    case 'complimentary': return 'payment.complimentary';
    default: return 'common.notAvailable';
  }
}

function paymentStateKey(state?: string): TranslationKey {
  switch (state) {
    case 'Paid': return 'payment.paid';
    case 'Payment due': return 'payment.due';
    case 'Complimentary': return 'payment.complimentary';
    default: return 'common.notAvailable';
  }
}

export default function MemberOverview() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const plansQuery = usePlans();
  const { t, isRtl, language, darkMode } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const m = memberQuery.data ?? null;
  const ms = m?.membership ?? null;

  if (memberQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: c.ink3, fontSize: 15, writingDirection: textDir }}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title={t('memberOverview.title')} onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <Text style={{ color: c.ink3, writingDirection: textDir }}>{t('memberOverview.notFound')}</Text>
          <Button onPress={() => router.back()}>{t('common.goBack')}</Button>
        </View>
      </View>
    );
  }

  const today = m.asOf ?? todayIso();
  const vis = ms ? statusVisual(ms.status, ms, c, language) : null;
  const daysLeft = ms ? Math.max(0, daysBetween(ms.expiryDate, today)) : 0;
  const plan = ms && plansQuery.data ? plansQuery.data.find((p) => p.id === ms.planId) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('memberOverview.title')} onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Body style={{ gap: spacing.md }}>

          {/* Status banner */}
          {vis?.bannerText ? (
            <Banner variant={vis.bannerVariant}>{vis.bannerText}</Banner>
          ) : null}

          {/* Profile details — not shown on home */}
          <View style={{ gap: 0 }}>
            <SectionLabel>{t('memberOverview.profileSection')}</SectionLabel>
            <KVList>
              <KVRow icon="user" label={t('memberDetail.email')}>
                <LtrText>{m.email}</LtrText>
              </KVRow>
              {m.phone ? (
                <KVRow icon="phone" label={t('memberDetail.phone')}>
                  <LtrText>{m.phone}</LtrText>
                </KVRow>
              ) : null}
              {m.dateOfBirth ? (
                <KVRow icon="cal" label={t('memberDetail.born')}>
                  <LtrText>{fmtLong(m.dateOfBirth, language)}</LtrText>
                </KVRow>
              ) : null}
              {m.nationalId ? (
                <KVRow icon="card" label={t('memberDetail.nationalId')}>
                  <LtrText>{m.nationalId}</LtrText>
                </KVRow>
              ) : null}
              {m.address ? (
                <KVRow icon="pin" label={t('memberDetail.address')}>
                  <Text style={{ writingDirection: textDir, flexShrink: 1 }}>{m.address}</Text>
                </KVRow>
              ) : null}
              {m.emergencyName && m.emergencyPhone ? (
                <KVRow icon="shield" label={t('memberDetail.emergency')}>
                  <Text style={{ writingDirection: textDir }}>
                    {t('memberDetail.emergencyContact', { name: m.emergencyName, phone: `\u200E${m.emergencyPhone}\u200E` })}
                  </Text>
                </KVRow>
              ) : null}
            </KVList>
          </View>

          {/* Full membership details — home only shows plan name + days left */}
          {ms ? (
            <View style={{ gap: 0 }}>
              <SectionLabel>{t('memberOverview.membershipSection')}</SectionLabel>
              <KVList>
                <KVRow icon="card" label={t('memberDetail.plan')}>
                  <Text style={{ writingDirection: textDir }}>{ms.planName}</Text>
                </KVRow>
                <KVRow icon="cal" label={t('memberDetail.start')}>
                  <LtrText>{fmtLong(ms.startDate, language)}</LtrText>
                </KVRow>
                <KVRow icon="cal" label={t('memberDetail.expiry')}>
                  <LtrText>{fmtLong(ms.expiryDate, language)}</LtrText>
                </KVRow>
                <KVRow icon="clock" label={t('member.daysLeft')}>
                  <LtrText style={{ color: vis?.dotVariant === 'bad' ? c.bad : vis?.dotVariant === 'warn' ? c.warn : c.ink }}>
                    {daysLeft}
                  </LtrText>
                </KVRow>
                {ms.frozenDays ? (
                  <KVRow icon="pause" label={t('membership.daysPreserved')}>
                    <LtrText>{ms.frozenDays}</LtrText>
                  </KVRow>
                ) : null}
                {ms.amountDue ? (
                  <KVRow icon="receipt" label={t('membership.amountDue')}>
                    <LtrText style={{ color: c.warn }}>{formatMoney(ms.amountDue, ms.currency, language)}</LtrText>
                  </KVRow>
                ) : null}
                {ms.payment ? (
                  <KVRow icon="receipt" label={t('memberDetail.payment')}>
                    <Text style={{ writingDirection: textDir }}>
                      {t('memberDetail.paymentSummary', {
                        state: t(paymentStateKey(ms.payment.state)),
                        method: t(paymentMethodKey(ms.payment.method)),
                        date: `\u200E${fmtShort(ms.payment.date, language)}\u200E`,
                      })}
                    </Text>
                  </KVRow>
                ) : null}
                {plan ? (
                  <KVRow icon="receipt" label={t('membership.restartFrom')}>
                    <LtrText>{formatMoney(plan.price, plan.currency, language)}</LtrText>
                  </KVRow>
                ) : null}
              </KVList>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <SectionLabel>{t('memberOverview.membershipSection')}</SectionLabel>
              <View style={[styles.noPlanBox, { backgroundColor: c.bg1, borderColor: c.line }]}>
                <Text style={[styles.noPlanText, { color: c.ink3, writingDirection: textDir }]}>
                  {t('member.noPlanAssigned')}
                </Text>
              </View>
            </View>
          )}

          {/* Full visit history — home only shows the week strip */}
          <View style={{ gap: 0 }}>
            <SectionLabel>{t('memberOverview.visitsSection')}</SectionLabel>
            {m.visits.length === 0 ? (
              <View style={[styles.noPlanBox, { backgroundColor: c.bg1, borderColor: c.line }]}>
                <Text style={[styles.noPlanText, { color: c.ink3, writingDirection: textDir }]}>
                  {t('member.noVisitsBody')}
                </Text>
              </View>
            ) : (
              <View style={[styles.visitList, { backgroundColor: c.bg1, borderColor: c.line }]}>
                {m.visits.slice(0, 20).map((v, i) => (
                  <View
                    key={v.id}
                    style={[
                      styles.visitRow,
                      { borderBottomWidth: i < Math.min(m.visits.length, 20) - 1 ? 1 : 0, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
                    ]}
                  >
                    <LtrText style={[styles.visitDate, { color: c.ink, textAlign: isRtl ? 'right' : 'left' }]}>
                      {fmtShort(v.date, language)}
                    </LtrText>
                    <LtrText style={[styles.visitTime, { color: c.ink3 }]}>
                      {v.time}
                    </LtrText>
                    <Text style={[styles.visitMeta, { color: c.ink4, writingDirection: textDir }]}>
                      {v.method === 'qr' ? t('memberDetail.qr') : t('memberDetail.desk')} · {v.reception}
                    </Text>
                  </View>
                ))}
                {m.visits.length > 20 ? (
                  <Button variant="quiet" block href="/(member)/visits" style={{ marginTop: 8 }}>
                    {t('common.countOfTotal', { count: 20, total: m.visits.length })}
                  </Button>
                ) : null}
              </View>
            )}
          </View>

          {/* Activity log — not on home at all */}
          {m.activity.length > 0 ? (
            <View style={{ gap: 0 }}>
              <SectionLabel>{t('memberOverview.activitySection')}</SectionLabel>
              <View style={[styles.activityList, { backgroundColor: c.bg1, borderColor: c.line }]}>
                {m.activity.slice(0, 15).map((a, i) => (
                  <View
                    key={a.id ?? i}
                    style={[
                      styles.activityRow,
                      { borderBottomWidth: i < Math.min(m.activity.length, 15) - 1 ? 1 : 0, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
                    ]}
                  >
                    <View style={styles.activityDotCol}>
                      <View style={[styles.activityDot, { backgroundColor: c.line2 }]} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.activityText, { color: c.ink, writingDirection: textDir }]} numberOfLines={2}>
                        {a.text}
                      </Text>
                      <Text style={[styles.activityTime, { color: c.ink3, writingDirection: textDir }]}>
                        {a.author ? t('memberDetail.activityBy', { date: `\u200E${fmtDateTime(a.at, language)}\u200E`, author: a.author }) : fmtDateTime(a.at, language)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  noPlanBox: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
  },
  noPlanText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    lineHeight: 19,
  },
  visitList: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  visitRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 14,
  },
  visitDate: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    width: 80,
    flexShrink: 0,
  },
  visitTime: {
    fontFamily: typography.mono,
    fontSize: 13,
    letterSpacing: 0.4,
    flex: 1,
  },
  visitMeta: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    letterSpacing: tracking.small,
    flexShrink: 1,
  },
  activityList: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  activityRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  activityDotCol: {
    paddingTop: 5,
  },
  activityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  activityText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    letterSpacing: tracking.small,
    lineHeight: 20,
  },
  activityTime: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    letterSpacing: tracking.small,
    lineHeight: 17,
    marginTop: 4,
  },
});
