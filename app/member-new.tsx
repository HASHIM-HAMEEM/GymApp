import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { Icon } from '@/components/Icon';
import { useCreateMemberInvitation, usePlans, useClub, type DeskPaymentMethod } from '@/data/api/queries';
import { ApiCallError } from '@/data/api/queries';
import { formatMoney } from '@/data/format';
import { useApp } from '@/providers/AppProvider';

type PaymentMethod = DeskPaymentMethod | 'complimentary';

/** Normalize a phone entry to international format with the club's +91 default. */
function indiaPhone(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('91')) return `+${digits}`;
  if (digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return `+91${digits}`;
}

/**
 * A-12 New member — reception creates the member and sends the email
 * invitation in one action. The member sets their own password from the
 * emailed link; no passwords are handled at the desk.
 */
export default function MemberNew() {
  const router = useRouter();
  const plansQuery = usePlans();
  const createInvitation = useCreateMemberInvitation();
  const clubQuery = useClub();
  const { darkMode, t, isRtl, language } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [dateOfBirth, setDateOfBirth] = React.useState('');
  const [emName, setEmName] = React.useState('');
  const [emPhone, setEmPhone] = React.useState('');
  const [nationalId, setNationalId] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [planId, setPlanId] = React.useState<string>('');
  const [payMethod, setPayMethod] = React.useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ memberNumber: string; email: string } | null>(null);

  const plans = plansQuery.data ?? [];
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;

  const paymentLabels: Record<PaymentMethod, string> = {
    cash: t('payment.cash'),
    card: t('payment.card'),
    wallet: t('payment.wallet'),
    upi: t('payment.upi'),
    complimentary: t('payment.complimentaryShort'),
  };

  if (created) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title={t('memberNew.title')} onClose={() => router.back()} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 18 }}>
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 20 }}>
              <View style={[styles.badge, { backgroundColor: c.okSoft }]}>
                <Icon name="mail" size={38} color={c.ok} />
              </View>
              <Text style={[styles.h1, { color: c.ink, writingDirection: textDir }]}>{t('memberNew.invitationSent')}</Text>
              <Text style={[styles.desc, { color: c.ink2, writingDirection: textDir }]}>
                {t('memberNew.invitationSentBody', { memberId: created.memberNumber, email: created.email })}
              </Text>
            </View>
            <Button block onPress={() => router.replace({ pathname: '/member-detail', params: { id: created.memberNumber } })}>
              {t('memberNew.viewProfile')}
            </Button>
            <Button variant="secondary" block onPress={() => router.push('/member-new')}>
              {t('memberNew.addAnother')}
            </Button>
          </Body>
        </ScrollView>
      </View>
    );
  }

  const submit = async () => {
    let bad: string | null = null;
    if (!firstName.trim() || !lastName.trim()) bad = t('memberNew.nameRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) bad = t('memberNew.emailInvalid');
    else if (phone.trim() && phone.replace(/\D/g, '').length < 10) bad = t('memberNew.phoneInvalid');
    else if (dateOfBirth.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) bad = t('memberNew.birthDateInvalid');
    else if (Boolean(emName.trim()) !== Boolean(emPhone.trim())) bad = t('memberNew.emergencyBoth');
    else if (emPhone.trim() && emPhone.replace(/\D/g, '').length < 10) bad = t('memberNew.emergencyPhoneInvalid');
    else if (nationalId.trim() && nationalId.replace(/\D/g, '').length < 4) bad = t('memberNew.nationalIdInvalid');
    else if (!address.trim()) bad = t('memberNew.addressRequired');
    else if (planId && payMethod !== 'complimentary') {
      const amount = Number(amountPaid);
      // Floating-point-safe two-decimal check (19.99 * 100 is inexact).
      const centsOk = Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-6;
      if (!amountPaid.trim() || !Number.isFinite(amount) || amount <= 0) bad = t('memberNew.amountRequired');
      else if (!centsOk) bad = t('memberNew.amountDecimals');
      else if (amount > (selectedPlan?.price ?? 0)) bad = t('memberNew.amountTooHigh');
    }
    if (bad) {
      setFormError(bad);
      return;
    }

    setFormError(null);
    try {
      const result = await createInvitation.mutateAsync({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: indiaPhone(phone),
        dateOfBirth: dateOfBirth.trim() || undefined,
        emergencyName: emName.trim() || undefined,
        emergencyPhone: indiaPhone(emPhone),
        nationalId: nationalId.trim() || undefined,
        address: address.trim(),
        planId: planId || undefined,
        amountPaid: planId && payMethod !== 'complimentary' ? Number(amountPaid) : undefined,
        paymentMethod: planId ? payMethod : undefined,
      });
      setCreated({ memberNumber: result.memberNumber, email: email.trim() });
    } catch (error) {
      if (error instanceof ApiCallError && error.code === 'INVITATION_EXISTS') {
        setFormError(t('memberNew.invitationExists'));
      } else if (error instanceof ApiCallError && error.code === 'VALIDATION_ERROR') {
        setFormError(t('memberNew.validationFailed'));
      } else if (
        error instanceof ApiCallError
        && ['INVITATION_SEND_FAILED', 'INVITATION_LINK_FAILED'].includes(error.code)
      ) {
        setFormError(t('memberNew.emailDeliveryFailed'));
      } else {
        setFormError(t('memberNew.invitationFailed'));
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('memberNew.title')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>

          {formError ? <Banner variant="error"><Text style={{ writingDirection: textDir }}>{formError}</Text></Banner> : null}

          <Field label={t('memberNew.firstName')}><Control value={firstName} onChangeText={setFirstName} placeholder={t('memberNew.firstNamePlaceholder')} autoComplete="off" /></Field>
          <Field label={t('memberNew.lastName')}><Control value={lastName} onChangeText={setLastName} placeholder={t('memberNew.lastNamePlaceholder')} autoComplete="off" /></Field>

          <Field label={t('auth.email')} hint={t('memberNew.emailHint')}>
            <Control
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
            />
          </Field>

          <Field label={t('memberNew.phoneOptional')} hint={t('memberNew.phoneHint')}>
            <Control
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              inputMode="tel"
              leading={
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', paddingRight: 11, borderRightWidth: 1, borderRightColor: c.line }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: c.ink2, writingDirection: 'ltr' }}>+91</Text>
                </View>
              }
            />
          </Field>

          <Field label={t('memberNew.birthDateOptional')} hint={t('common.dateFormatHint')}>
            <Control
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="1998-03-15"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
          </Field>

          <Field label={t('memberNew.emergencyOptional')}>
            <Control value={emName} onChangeText={setEmName} placeholder={t('memberNew.contactName')} autoComplete="off" />
            <View style={{ height: 10 }} />
            <Control value={emPhone} onChangeText={setEmPhone} placeholder={t('memberNew.contactPhone')} inputMode="tel" />
          </Field>

          <Field label={t('memberDetail.nationalId')} hint={t('memberNew.nationalIdHint')}>
            <Control
              value={nationalId}
              onChangeText={setNationalId}
              placeholder="1234 5678 9012"
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>

          <Field label={t('profile.address')}>
            <Control value={address} onChangeText={setAddress} placeholder={t('memberNew.addressPlaceholder')} multiline />
          </Field>

          <View style={{ gap: 10 }}>
            <Text style={[styles.fieldLabel, { color: c.ink3, writingDirection: textDir }]}>{t('memberNew.firstPlan')}</Text>
            {plans.map((p) => {
              const on = p.id === planId;
              const periodLabel = p.duration === 12 ? t('memberNew.perYear') : p.duration === 3 ? t('memberNew.perThreeMonths') : t('memberNew.perMonth');
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPlanId(on ? '' : p.id)}
                  style={[
                    styles.planCard,
                    { backgroundColor: c.bg1, borderColor: on ? c.accent : c.line, flexDirection: isRtl ? 'row-reverse' : 'row' },
                  ]}
                >
                  <View style={[styles.radioCircle, { borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accent : 'transparent' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planTitle, { color: c.ink, writingDirection: textDir }]}>{p.name}</Text>
                    <Text style={[styles.planPeriod, { color: c.ink3, writingDirection: textDir }]}>{p.blurb}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.planPrice, { color: c.ink, writingDirection: textDir }]}>{formatMoney(p.price, p.currency, language)}</Text>
                    <Text style={[styles.planPricePeriod, { color: c.ink3, writingDirection: textDir }]}>
                      {periodLabel}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {plansQuery.isLoading ? (
              <Text style={{ color: c.ink3, fontSize: 13, letterSpacing: tracking.small, writingDirection: textDir }}>{t('memberNew.loadingPlans')}</Text>
            ) : null}
          </View>

          {planId ? (
            <View style={{ gap: 10 }}>
              <Text style={[styles.fieldLabel, { color: c.ink3, writingDirection: textDir }]}>{t('memberNew.paymentAtDesk')}</Text>
              <View style={[styles.segWrap, { backgroundColor: c.bg1, borderColor: c.line }]}>
                {(['cash', 'card', 'upi', 'wallet', 'complimentary'] as PaymentMethod[]).map((method) => {
                  const on = payMethod === method;
                  return (
                    <Pressable
                      key={method}
                      onPress={() => setPayMethod(method)}
                      style={[styles.segBtn, on && { backgroundColor: c.accent }]}
                    >
                      <Text style={[styles.segText, { color: on ? c.accentInk : c.ink3, writingDirection: textDir }]}>
                        {paymentLabels[method]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {payMethod !== 'complimentary' ? (
                <Field
                  label={t('memberNew.amountPaid')}
                  hint={selectedPlan ? t('memberNew.planPriceHint', { amount: formatMoney(selectedPlan.price, selectedPlan.currency, language) }) : undefined}
                >
                  <Control
                    value={amountPaid}
                    onChangeText={setAmountPaid}
                    placeholder={String(selectedPlan?.price ?? '')}
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </Field>
              ) : (
                <Banner variant="info"><Text style={{ writingDirection: textDir }}>{t('memberNew.complimentaryHint')}</Text></Banner>
              )}
            </View>
          ) : (
            <Banner variant="info">
              <Text style={{ writingDirection: textDir }}>{t('memberNew.skipPlanHint')}</Text>
            </Banner>
          )}

          <Button
            block
            loading={createInvitation.isPending}
            onPress={submit}
          >
            {t('memberNew.createAndInvite')}
          </Button>

          <Text style={[styles.foot, { color: c.ink4, writingDirection: textDir }]}>
            {t('memberNew.footer', { club: clubQuery.data?.name ?? '' })}
          </Text>
        </Body>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  desc: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  planCard: {
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
  foot: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.18,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
