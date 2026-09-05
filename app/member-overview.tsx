import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Tag, SectionLabel } from '@/components/Tag';
import { KVRow, KVList, Banner } from '@/components/Surfaces';
import { LtrText } from '@/components/LtrText';
import { MembershipCard } from '@/components/MembershipCard';
import { useClub, useCurrentMember, usePlans, useQrPass } from '@/data/api/queries';
import { useApp } from '@/providers/AppProvider';
import { statusVisual, fmtLong, fmtShort, fmtTodayLabel, daysBetween, todayIso, formatMoney } from '@/data/format';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Member overview — dedicated page showing the member's full details.
 * Opens when tapping home-screen widgets (RingCard, MembershipCard, etc.).
 * UI matches the Apex dark-first monochrome theme.
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
  const clubQuery = useClub();
  const { t, isRtl, language, darkMode } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const m = memberQuery.data ?? null;
  const ms = m?.membership ?? null;
  const canShowQr = ms?.status === 'active' || ms?.status === 'expiring' || ms?.status === 'due';

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
  const clubName = clubQuery.data?.name ?? 'Apex';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('memberOverview.title')} onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Body style={{ gap: spacing.md }}>

          {/* Member header card */}
          <View style={[styles.head, { backgroundColor: c.bg1, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
              <Text style={{ fontFamily: typography.display, fontSize: 28, fontWeight: '700', color: c.accent }}>
                {m.firstName.slice(0, 1)}{m.lastName.slice(0, 1)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: c.ink, writingDirection: textDir }]} numberOfLines={1}>
                {m.firstName} {m.lastName}
              </Text>
              <Text style={[styles.sub, { color: c.ink3, writingDirection: 'ltr' }]} numberOfLines={1}>
                {m.id}
              </Text>
              {vis ? (
                <View style={{ marginTop: 8, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
                  <Tag variant={vis.tagVariant}>{vis.tagLabel}</Tag>
                  {ms?.planName ? (
                    <Text style={[styles.planChip, { color: c.ink3, writingDirection: textDir }]} numberOfLines={1}>
                      {ms.planName}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          {/* Membership card (visual) */}
          {ms ? (
            <MembershipCard
              name={`${m.firstName} ${m.lastName}`}
              plan={ms.planName.replace(/ Monthly| Annual/i, '')}
              validUntil={fmtLong(ms.expiryDate, language)}
              memberId={m.id}
              variant={ms.status === 'expiring' || ms.status === 'due' ? 'warn' : ms.status === 'expired' ? 'bad' : 'active'}
              href={canShowQr ? '/qr' : undefined}
              showQr={canShowQr}
            />
          ) : null}

          {/* Status banner */}
          {vis?.bannerText ? (
            <Banner variant={vis.bannerVariant}>{vis.bannerText}</Banner>
          ) : null}

          {/* Membership details */}
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
                    {daysLeft} {t('member.daysLeft').toLowerCase()}
                  </LtrText>
                </KVRow>
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

          {/* Personal details */}
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

          {/* Visit summary */}
          <View style={{ gap: 0 }}>
            <SectionLabel>{t('memberOverview.visitsSection')}</SectionLabel>
            <View style={[styles.visitSummary, { backgroundColor: c.bg1, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <View style={styles.visitStat}>
                <Text style={[styles.visitNum, { color: c.ink }]}>{m.visits.length}</Text>
                <Text style={[styles.visitLabel, { color: c.ink3, writingDirection: textDir }]}>{t('memberOverview.totalVisits')}</Text>
              </View>
              <View style={[styles.visitDivider, { backgroundColor: c.line }]} />
              <View style={styles.visitStat}>
                <Text style={[styles.visitNum, { color: c.ink }]}>{fmtTodayLabel(today, language)}</Text>
                <Text style={[styles.visitLabel, { color: c.ink3, writingDirection: textDir }]}>{t('memberOverview.today')}</Text>
              </View>
            </View>
            {m.visits.length > 0 ? (
              <Button variant="secondary" block href="/(member)/visits" style={{ marginTop: 10 }}>
                {t('memberOverview.viewVisits')}
              </Button>
            ) : null}
          </View>

          {/* Quick actions */}
          <View style={{ gap: 10 }}>
            <SectionLabel>{t('memberOverview.actions')}</SectionLabel>
            <View style={[styles.actions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              {canShowQr ? (
                <Button variant="secondary" size="sm" href="/qr">
                  {t('membership.showQr')}
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" href="/(member)/membership">
                {t('membership.title')}
              </Button>
              <Button variant="quiet" size="sm" href="/edit-profile">
                {t('memberOverview.editProfile')}
              </Button>
            </View>
          </View>

        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
    gap: 14,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: typography.mono,
    fontSize: 13,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  planChip: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    flexShrink: 1,
  },
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
  visitSummary: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visitStat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  visitNum: {
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  visitLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  visitDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
