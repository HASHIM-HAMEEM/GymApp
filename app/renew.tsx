import { PaymentMethods } from '@/components/PaymentMethods';
import { AgreedPrice, pricingError } from '@/components/AgreedPrice';
import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useColors, radius, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Tag';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';
import { useMemberDetail, usePlans, useRenewMembership, useRenewalQuote, type DeskPaymentMethod } from '@/data/api/queries';
import { ApiCallError } from '@/data/api/queries';
import { fmtLong, fmtShort, todayIso, formatMoney } from '@/data/format';
import { Language, type TranslationKey } from '@/lib/i18n';

type PayMethod = DeskPaymentMethod;

export default function RenewFlow() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <RenewFlowInner />
    </>
  );
}

function RenewFlowInner() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberQuery = useMemberDetail(id);
  const plansQuery = usePlans();
  const renewMembership = useRenewMembership();
  const { adminName, darkMode, t, isRtl, language } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const m = memberQuery.data ?? null;
  const plans = plansQuery.data ?? [];

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [payMethod, setPayMethod] = React.useState<PayMethod>('cash');
  const [customPrice, setCustomPrice] = React.useState('');
  const [priceNote, setPriceNote] = React.useState('');
  React.useEffect(() => { setCustomPrice(''); setPriceNote(''); }, [selectedPlanId]);
  const [result, setResult] = React.useState<{
    receiptNumber: string | null;
    startDate: string;
    endDate: string;
    amountPaid: number;
    amountDue: number;
    currency: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedPlanId && plans.length > 0) setSelectedPlanId(plans[0].id);
  }, [plans, selectedPlanId]);

  const paymentMethodLabels: Record<PayMethod, string> = {
    cash: t('payment.cash'),
    card: t('payment.card'),
    wallet: t('payment.wallet'),
    upi: t('payment.upi'),
  };
  const plan = plans.find((p) => p.id === selectedPlanId) ?? plans[0];
  const agreedPrice = customPrice.trim() ? Number(customPrice) : plan?.price ?? 0;
  const quoteQuery = useRenewalQuote(m?.databaseId, plan?.id, Boolean(m && plan));

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title={t('renew.title')} onBack={() => router.back()} />
        <Text style={{ color: c.ink2, padding: 20, writingDirection: textDir }}>
          {memberQuery.isLoading ? t('renew.loading') : t('renew.notFound')}
        </Text>
      </View>
    );
  }

  const today = m.asOf ?? todayIso();
  const currentExpiry = m.membership?.expiryDate ?? today;
  const hasActiveTerm = Boolean(m.membership && m.membership.expiryDate >= today);
  // Server quote: the exact term the server will sell for this member.
  const quote = quoteQuery.data ?? null;

  const confirmRenewal = async () => {
    if (!plan || !m.databaseId || renewMembership.isPending) return;
    setError(null);
    const invalid = pricingError(customPrice, priceNote);
    if (invalid) { setError(invalid); return; }
    try {
      const renewal = await renewMembership.mutateAsync({
        memberId: m.databaseId,
        planId: plan.id,
        amountPaid: agreedPrice,
        paymentMethod: agreedPrice === 0 ? 'complimentary' : payMethod,
        agreedPrice: customPrice.trim() ? agreedPrice : undefined,
        priceNote: customPrice.trim() ? priceNote.trim() : undefined,
      });
      setResult({
        receiptNumber: renewal.receipt_number,
        startDate: renewal.start_date,
        endDate: renewal.end_date,
        amountPaid: agreedPrice,
        amountDue: Number(renewal.amount_due ?? 0),
        currency: plan.currency,
      });
      setStep(3);
    } catch (err) {
      if (err instanceof ApiCallError && err.code === 'VALIDATION_ERROR') {
        setError(t('renew.validationFailed'));
      } else {
        setError(t('renew.failed'));
      }
    }
  };

  const renderStepPills = (current: 1 | 2 | 3) => (
    <View style={styles.stepPillRow}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[styles.stepPill, { backgroundColor: current === n ? c.accent : c.line }]} />
      ))}
    </View>
  );

  if (step === 3 && result) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <AppBar title={t('renew.renewal')} onClose={() => router.replace({ pathname: '/member-detail', params: { id: m.id } })} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 20 }}>
            {renderStepPills(3)}

            <View style={{ alignItems: 'flex-start', gap: 10 }}>
              <Tag variant="ok">{t('renew.renewed')}</Tag>
              <Text style={[styles.h1, { color: c.ink, writingDirection: textDir }]}>{t('renew.recorded')}</Text>
              <Text style={[styles.desc, { color: c.ink2, writingDirection: textDir }]}>
                {t('renew.successBody', { name: m.firstName, plan: plan?.name ?? '', date: fmtLong(result.endDate, language) })}
              </Text>
            </View>

            <View style={[styles.receiptCard, { backgroundColor: c.bg1, borderColor: c.line }]}>
              <ReceiptRow label={t('renew.receiptReference')} value={result.receiptNumber ?? t('common.notAvailable')} isMono />
              <ReceiptRow label={t('renew.paymentRecorded', { method: paymentMethodLabels[payMethod] })} value={formatMoney(result.amountPaid, result.currency, language)} />
              <ReceiptRow label={t('renew.starts')} value={fmtLong(result.startDate, language)} />
              <ReceiptRow label={t('renew.staff')} value={adminName || t('common.frontDesk')} />
              <ReceiptRow label={t('renew.status')} value={result.amountDue > 0 ? t('payment.due') : t('renew.paidInFull')} last />
            </View>

            <View style={{ gap: 12, marginTop: 12 }}>
              <Button
                block
                onPress={() => router.replace({ pathname: '/member-detail', params: { id: m.id } })}
              >
                {t('renew.backToProfile')}
              </Button>
              <Button
                variant="quiet"
                block
                onPress={() => router.replace('/(admin)/scanner')}
              >
                {t('renew.scanNext')}
              </Button>
            </View>
          </Body>
        </ScrollView>
      </View>
    );
  }

  if (step === 2) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <AppBar title={t('renew.title')} onBack={() => setStep(1)} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 20 }}>
            {renderStepPills(2)}

            <View>
              <Text style={[styles.stepSub, { color: c.ink3, writingDirection: textDir }]}>{t('renew.stepReview')}</Text>
              <Text style={[styles.h1, { color: c.ink, writingDirection: textDir }]}>{t('renew.confirmRenewal')}</Text>
              <Text style={[styles.desc, { color: c.ink2, writingDirection: textDir }]}>
                {t('renew.reviewBody')}
              </Text>
            </View>

            {error ? <Banner variant="error"><Text style={{ writingDirection: textDir }}>{error}</Text></Banner> : null}

            <View style={[styles.receiptCard, { backgroundColor: c.bg1, borderColor: c.line }]}>
              <ReceiptRow label={t('renew.member')} value={`${m.firstName} ${m.lastName}`} />
              <ReceiptRow label={t('renew.plan')} value={plan?.name ?? t('common.notAvailable')} />
              <ReceiptRow
                label={t('renew.period')}
                value={quote
                  ? `${fmtShort(quote.start_date, language)} — ${fmtLong(quote.end_date, language)}`
                  : hasActiveTerm
                    ? t('renew.startsAfter', { date: fmtShort(currentExpiry, language) })
                    : t('renew.startsToday', { date: fmtShort(today, language) })}
              />
              <ReceiptRow
                label={t('renew.payment')}
                value={t('renew.paymentSummary', { method: paymentMethodLabels[payMethod], amount: formatMoney(agreedPrice, plan?.currency, language) })}
              />
              <View style={[styles.totalRow, { backgroundColor: c.accentSoft, borderColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.totalLabel, { color: c.ink, writingDirection: textDir }]}>{t('renew.totalDue')}</Text>
                <Text style={[styles.totalVal, { color: c.accentHi, writingDirection: textDir }]}>
                  {formatMoney(agreedPrice, plan?.currency, language)}
                </Text>
              </View>
            </View>

            <Banner variant="info"><Text style={{ writingDirection: textDir }}>{t('renew.readAloud')}</Text></Banner>

            <View style={{ gap: 12, marginTop: 8 }}>
              <Button block loading={renewMembership.isPending} onPress={confirmRenewal}>
                {t('renew.confirmPayment')}
              </Button>
              <Button variant="quiet" block onPress={() => setStep(1)}>
                {t('common.back')}
              </Button>
            </View>
          </Body>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar title={t('renew.title')} onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 22 }}>
          {renderStepPills(1)}

          <View>
            <Text style={[styles.stepSub, { color: c.ink3, writingDirection: textDir }]}>{t('renew.stepChoose')}</Text>
            <Text style={[styles.h1, { color: c.ink, writingDirection: textDir }]}>{t('renew.planHeading')}</Text>
            <Text style={[styles.desc, { color: c.ink2, writingDirection: textDir }]}>
              {t('renew.selectFor', { name: `${m.firstName} ${m.lastName}` })}
            </Text>
          </View>

          {error ? <Banner variant="error"><Text style={{ writingDirection: textDir }}>{error}</Text></Banner> : null}

          <View style={{ gap: 10 }}>
            {plans.map((p) => {
              const on = p.id === selectedPlanId;
              const periodLabel = p.duration === 12 ? t('memberNew.perYear') : p.duration === 3 ? t('memberNew.perThreeMonths') : t('memberNew.perMonth');
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedPlanId(p.id)}
                  style={[styles.planRadioCard, { backgroundColor: c.bg1, borderColor: on ? c.accent : c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }]}
                >
                  <View style={[styles.radioCircle, { borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accent : 'transparent' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planTitle, { color: c.ink, writingDirection: textDir }]}>{p.name}</Text>
                    <Text style={[styles.planPeriod, { color: c.ink3, writingDirection: textDir }]}>{p.blurb}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.planPrice, { color: c.ink, writingDirection: textDir }]}>{formatMoney(p.price, p.currency, language)}</Text>
                    <Text style={[styles.planPricePeriod, { color: c.ink3, writingDirection: textDir }]}>{periodLabel}</Text>
                  </View>
                </Pressable>
              );
            })}
            {plansQuery.isLoading ? (
              <Text style={{ color: c.ink3, fontSize: 13, letterSpacing: tracking.small, writingDirection: textDir }}>{t('memberNew.loadingPlans')}</Text>
            ) : null}
          </View>

          <Banner variant="info">
            <Text style={{ writingDirection: textDir }}>
              {quote
                ? t('renew.startsQuote', { date: fmtLong(quote.start_date, language), end: fmtLong(quote.end_date, language) })
                : hasActiveTerm
                  ? t('renew.startsAfterTerm', { date: fmtLong(currentExpiry, language) })
                  : t('renew.startsNow')}
            </Text>
          </Banner>

          <View style={{ gap: 8 }}>
            <Text style={[styles.fieldLabel, { color: c.ink3, writingDirection: textDir }]}>{t('renew.paymentMethod')}</Text>
            <PaymentMethods value={payMethod} onChange={setPayMethod} methods={["cash", "card", "upi", "wallet"] as const} />
          </View>

          <AgreedPrice value={customPrice} reason={priceNote} onValue={setCustomPrice} onReason={setPriceNote} />
          {pricingError(customPrice, priceNote) ? <Text style={{color:c.bad,fontSize:13,lineHeight:19}}>{pricingError(customPrice, priceNote)}</Text> : null}
          <Button block disabled={!plan || quoteQuery.isPending || quoteQuery.isError || Boolean(pricingError(customPrice,priceNote))} style={{ marginTop: 8 }} onPress={() => setStep(2)}>
            {t('renew.continue')}
          </Button>
        </Body>
      </ScrollView>
    </View>
  );
}

function ReceiptRow({
  label,
  value,
  isMono,
  last,
}: {
  label: string;
  value: string;
  isMono?: boolean;
  last?: boolean;
}) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  return (
    <View style={[styles.rrow, { borderBottomColor: c.line, flexDirection: isRtl ? 'row-reverse' : 'row' }, last && { borderBottomWidth: 0 }]}>
      <Text style={[styles.rk, { color: c.ink3, writingDirection: textDir }]}>{label}</Text>
      <Text style={[styles.rv, { color: c.ink, writingDirection: textDir }, isMono && { fontFamily: typography.mono, fontSize: 13, letterSpacing: tracking.small, }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  stepPillRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  stepPill: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  stepSub: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  h1: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  desc: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    marginTop: 6,
    lineHeight: 22,
  },
  planRadioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 14,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  planTitle: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
  },
  planPeriod: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    marginTop: 2,
  },
  planPrice: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
  },
  planPricePeriod: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    letterSpacing: tracking.small,
    marginTop: 1,
  },
  fieldLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  segWrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
    fontWeight: '600',
  },
  receiptCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rrow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rk: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    letterSpacing: tracking.small,
  },
  rv: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: '600',
  },
  totalVal: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '700',
  },
});
