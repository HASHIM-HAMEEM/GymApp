import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors, radius, spacing, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Tag, SectionLabel } from '@/components/Tag';
import { Sheet } from '@/components/Overlays';
import { KVRow } from '@/components/Surfaces';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { useMemberDetail, useResendMemberInvitation, useSetMembershipState } from '@/data/api/queries';
import { fmtLong, fmtShort, fmtDateTime, statusVisual } from '@/data/format';
import { useApp } from '@/providers/AppProvider';
import { Language, type TranslationKey } from '@/lib/i18n';

export default function MemberDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const member = useMemberDetail(id);
  const resend = useResendMemberInvitation();
  const setState = useSetMembershipState();
  const { darkMode, t, isRtl, language } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const [showingFreeze, setShowingFreeze] = React.useState(false);
  const [freezeUntil, setFreezeUntil] = React.useState('');
  const [actionError, setActionError] = React.useState<string | null>(null);

  const m = member.data;

  function membershipTag(ms: NonNullable<typeof m>['membership']) {
    if (!ms) return { label: t('memberDetail.noMembership'), variant: 'muted' as const, dot: 'muted' as const };
    const vis = statusVisual(ms.status, { expiryDate: ms.expiryDate, amountDue: ms.amountDue, pauseEnds: ms.pauseEnds, graceUntil: ms.graceUntil }, c, language);
    return { label: vis.tagLabel, variant: vis.tagVariant, dot: vis.dotVariant };
  }

  function paymentStateLabel(state: string) {
    const map: Record<string, TranslationKey> = {
      'Paid': 'payment.paid',
      'Payment due': 'payment.due',
      'Complimentary': 'payment.complimentary',
    };
    return map[state] ? t(map[state] as TranslationKey) : state;
  }

  function paymentMethodLabel(method: string) {
    const map: Record<string, TranslationKey> = {
      'InstaPay': 'payment.instapay',
      'Cash': 'payment.cash',
      'Card': 'payment.card',
      'Wallet': 'payment.wallet',
      'Complimentary': 'payment.complimentary',
    };
    return map[method] ? t(map[method] as TranslationKey) : method;
  }

  function inviteStatusLabel(s: string) {
    const map: Record<string, TranslationKey> = {
      pending: 'common.pending',
      sent: 'common.invited',
      accepted: 'member.active',
    };
    return map[s] ? t(map[s] as TranslationKey) : s;
  }

  if (member.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: c.ink3, fontSize: 14, writingDirection: textDir }}>{t('memberDetail.loading')}</Text>
      </View>
    );
  }

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title={t('memberDetail.title')} onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <Text style={{ color: c.ink3, writingDirection: textDir }}>{t('memberDetail.notFound')}</Text>
          <Button onPress={() => router.back()}>{t('common.goBack')}</Button>
        </View>
      </View>
    );
  }

  const ms = m.membership;
  const isPaused = ms?.status === 'paused';
  const canResend = m.invitationId && m.invitationStatus !== 'accepted' && m.invitationStatus !== 'revoked';

  async function handleResend() {
    if (!m.invitationId) return;
    try {
      await resend.mutateAsync(m.invitationId);
    } catch (err) {
      setActionError(t('memberDetail.resendFailed'));
    }
  }

  async function handleFreeze() {
    if (!ms?.id) {
      setActionError(t('memberDetail.changeFailed'));
      return;
    }
    if (isPaused) {
      try {
        await setState.mutateAsync({ membershipId: ms.id, action: 'resume' });
        setShowingFreeze(false);
      } catch (err) {
        setActionError(t('memberDetail.changeFailed'));
      }
      return;
    }
    if (!freezeUntil.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(freezeUntil.trim())) {
      setActionError(t('memberDetail.resumeDateInvalid'));
      return;
    }
    if (freezeUntil <= ms.startDate || freezeUntil > ms.expiryDate) {
      setActionError(t('memberDetail.resumeDateRange'));
      return;
    }
    try {
      await setState.mutateAsync({ membershipId: ms.id, action: 'pause', pauseUntil: freezeUntil });
      setShowingFreeze(false);
      setFreezeUntil('');
    } catch (err) {
      setActionError(t('memberDetail.changeFailed'));
    }
  }

  const tag = ms ? membershipTag(ms) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('memberDetail.title')} onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: spacing.md }}>

          {actionError ? (
            <Banner variant="error">
              <Text style={{ writingDirection: textDir }}>{actionError}</Text>
            </Banner>
          ) : null}

          <View style={[styles.head, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
              <Text style={{ fontFamily: typography.display, fontSize: 28, fontWeight: '700', color: c.accent }}>
                {m.firstName.slice(0, 1)}{m.lastName.slice(0, 1)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.ink, writingDirection: textDir }]}>{m.firstName} {m.lastName}</Text>
              <Text style={[styles.sub, { color: c.ink3, writingDirection: textDir }]}>
                {t('memberDetail.memberSince', { id: m.id, email: m.email, date: m.memberSince })}
              </Text>
            </View>
            <Tag variant="accent" style={{ alignSelf: 'center' }}>{t('common.member')}</Tag>
          </View>

          {m.invitationStatus && m.invitationStatus !== 'accepted' ? (
            <View style={[styles.inviteBox, { backgroundColor: c.bg1, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.inviteTitle, { color: c.ink, writingDirection: textDir }]}>
                  {t('memberDetail.invitationStatus', { status: inviteStatusLabel(m.invitationStatus) })}
                </Text>
                <Text style={[styles.inviteSub, { color: c.ink3, writingDirection: textDir }]}>
                  {t('memberDetail.invitationWaiting')}
                </Text>
              </View>
              {canResend ? (
                <Button size="sm" loading={resend.isPending} onPress={handleResend}>{t('memberDetail.resend')}</Button>
              ) : null}
            </View>
          ) : null}

          {ms ? (
            <View style={{ gap: 8 }}>
              <SectionLabel>{t('memberDetail.currentMembership')}</SectionLabel>
              <View style={[styles.membershipCard, { backgroundColor: c.bg1, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.planName, { color: c.ink, writingDirection: textDir }]}>{ms.planName}</Text>
                  <Text style={[styles.dateLine, { color: c.ink3, writingDirection: textDir }]}>
                    {fmtLong(ms.startDate, language)} — {fmtLong(ms.expiryDate, language)}
                  </Text>
                  {ms.pauseEnds ? (
                    <Text style={[styles.pauseNote, { color: c.ink4, writingDirection: textDir }]}>
                      {t('status.pausedUntilBanner', { date: fmtShort(ms.pauseEnds, language) })}
                    </Text>
                  ) : null}
                </View>
                {tag ? (
                  <Tag variant={tag.variant} style={{ alignSelf: 'center' }}>
                    {tag.label}
                  </Tag>
                ) : null}
              </View>

              <KVRow label={t('memberDetail.plan')}>
                <Text style={{ writingDirection: textDir }}>{ms.planName}</Text>
              </KVRow>
              <KVRow label={t('memberDetail.start')}>
                <Text style={{ writingDirection: textDir }}>{fmtLong(ms.startDate, language)}</Text>
              </KVRow>
              <KVRow label={t('memberDetail.expiry')}>
                <Text style={{ writingDirection: textDir }}>{fmtLong(ms.expiryDate, language)}</Text>
              </KVRow>
              {ms.payment ? (
                <KVRow label={t('memberDetail.payment')}>
                  <Text style={{ writingDirection: textDir }}>
                    {t('memberDetail.paymentSummary', { state: paymentStateLabel(ms.payment.state), method: paymentMethodLabel(ms.payment.method) })}
                    {ms.payment.date ? ` · ${fmtShort(ms.payment.date, language)}` : ''}
                    {ms.payment.receiptNumber ? ` · ${ms.payment.receiptNumber}` : ''}
                  </Text>
                </KVRow>
              ) : null}
            </View>
          ) : null}

          <View style={{ gap: 0 }}>
            <SectionLabel>{t('memberDetail.profileEmergency')}</SectionLabel>
            <KVRow label={t('common.member')}>
              <Text style={{ writingDirection: textDir }}>{m.firstName} {m.lastName}</Text>
            </KVRow>
            <KVRow label={t('memberDetail.email')}>
              <Text style={{ writingDirection: textDir }}>{m.email}</Text>
            </KVRow>
            {m.phone ? (
              <KVRow label={t('memberDetail.phone')}>
                <Text style={{ writingDirection: textDir }}>{m.phone}</Text>
              </KVRow>
            ) : null}
            {m.dateOfBirth ? (
              <KVRow label={t('memberDetail.born')}>
                <Text style={{ writingDirection: textDir }}>{fmtLong(m.dateOfBirth, language)}</Text>
              </KVRow>
            ) : null}
            {m.nationalId ? (
              <KVRow label={t('memberDetail.nationalId')}>
                <Text style={{ writingDirection: textDir }}>{m.nationalId}</Text>
              </KVRow>
            ) : null}
            <KVRow label={t('memberDetail.address')}>
              <Text style={{ writingDirection: textDir }}>{m.address}</Text>
            </KVRow>
            {m.emergencyName && m.emergencyPhone ? (
              <KVRow label={t('memberDetail.emergency')}>
                <Text style={{ writingDirection: textDir }}>
                  {t('memberDetail.emergencyContact', { name: m.emergencyName, phone: m.emergencyPhone })}
                </Text>
              </KVRow>
            ) : null}
          </View>

          <View style={{ gap: 0 }}>
            <SectionLabel>{t('memberDetail.visitHistory')}</SectionLabel>
            {m.visits.length === 0 ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ color: c.ink4, writingDirection: textDir }}>{t('memberDetail.noVisits')}</Text>
              </View>
            ) : (
              <>
                {m.visits.slice(0, 8).map((v) => (
                  <View key={v.id} style={[styles.vrow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                    <Text style={[styles.vdate, { color: c.ink, textAlign: isRtl ? 'right' : 'left', writingDirection: textDir }]}>
                      {fmtShort(v.date, language)}
                    </Text>
                    <Text style={[styles.vtime, { color: c.ink3, writingDirection: textDir }]}>
                      {v.time}
                    </Text>
                    <Text style={[styles.vrec, { color: c.ink4, writingDirection: textDir }]}>
                      {t('memberDetail.visitSource', { source: v.method === 'qr' ? t('memberDetail.qr') : t('memberDetail.desk'), reception: v.reception })}
                    </Text>
                  </View>
                ))}
                {m.visits.length > 8 ? (
                  <Text style={[styles.visitFoot, { color: c.ink4, writingDirection: textDir }]}>
                    {t('common.countOfTotal', { count: Math.min(m.visits.length, 8), total: m.visits.length })}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <View style={{ gap: 0 }}>
            <SectionLabel>{t('memberDetail.activityLog')}</SectionLabel>
            {m.activity.length === 0 ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ color: c.ink4, writingDirection: textDir }}>{t('memberDetail.noActivity')}</Text>
              </View>
            ) : (
              m.activity.slice(0, 20).map((a, idx) => (
                <View key={idx} style={[styles.logRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <View style={styles.dotCol}>
                    <View style={[styles.logDot, { backgroundColor: c.line2 }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.logText, { color: c.ink, writingDirection: textDir }]}>{a.text}</Text>
                    <Text style={[styles.logTime, { color: c.ink4, writingDirection: textDir }]}>
                      {a.author ? t('memberDetail.activityBy', { date: fmtDateTime(a.at, language), author: a.author }) : fmtDateTime(a.at, language)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ gap: 10 }}>
            <SectionLabel>{t('common.member')}</SectionLabel>
            <View style={[styles.actions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => router.push({ pathname: '/renew', params: { id: m.id } })}
              >
                {t('memberDetail.renew')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setShowingFreeze(true)}
              >
                {isPaused ? t('memberDetail.unpause') : t('memberDetail.freeze')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => router.push({ pathname: '/notice-compose', params: { memberId: m.id } })}
              >
                {t('notice.title')}
              </Button>
            </View>
          </View>

        </Body>
      </ScrollView>

      <Sheet visible={showingFreeze} onClose={() => setShowingFreeze(false)}>
        <Text style={[styles.sheetTitle, { color: c.ink, writingDirection: textDir }]}>
          {isPaused ? t('memberDetail.unpause') : t('memberDetail.freezeTitle')}
        </Text>
        {!isPaused ? (
          <>
            <Text style={[styles.sheetBody, { color: c.ink3, writingDirection: textDir }]}>
              {t('memberDetail.freezeBody', { name: m.firstName })}
            </Text>
            <Field label={t('memberDetail.resumeOn')} hint={t('memberDetail.resumeHint')}>
              <Control
                value={freezeUntil}
                onChangeText={setFreezeUntil}
                placeholder={t('common.dateFormatHint')}
                autoComplete="off"
              />
            </Field>
          </>
        ) : null}
        <View style={[styles.sheetActions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <Button variant="secondary" onPress={() => setShowingFreeze(false)}>{t('common.cancel')}</Button>
          <Button loading={setState.isPending} onPress={handleFreeze}>
            {isPaused ? t('memberDetail.unpause') : t('memberDetail.confirmFreeze')}
          </Button>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
  inviteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  inviteTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  inviteSub: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 20,
  },
  membershipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  planName: {
    fontFamily: typography.display,
    fontSize: 16,
    fontWeight: '600',
  },
  dateLine: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 20,
  },
  pauseNote: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    lineHeight: 18,
  },
  vrow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  vdate: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '500',
  },
  vtime: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    flex: 1,
  },
  vrec: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
  },
  visitFoot: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    color: 'gray',
    marginTop: 4,
  },
  logRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dotCol: {
    width: 12,
    alignItems: 'center',
    paddingTop: 5,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logText: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    lineHeight: 22,
  },
  logTime: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetTitle: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sheetBody: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
});
