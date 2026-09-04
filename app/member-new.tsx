import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, radius, spacing, typography } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { Icon } from '@/components/Icon';
import { useCreateMemberInvitation, usePlans } from '@/data/api/queries';
import { ApiCallError } from '@/data/api/queries';
import { CLUB } from '@/data/plans';
import { useApp } from '@/providers/AppProvider';

type PaymentMethod = 'instapay' | 'cash' | 'card' | 'wallet' | 'complimentary';

function egyptPhone(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('20')) return `+${digits}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  return `+20${digits}`;
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
  const { darkMode, t, isRtl } = useApp();
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
    instapay: t('payment.instapay'),
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
    else if (nationalId.trim() && nationalId.replace(/\D/g, '').length !== 14) bad = t('memberNew.nationalIdInvalid');
    else if (!address.trim()) bad = t('memberNew.addressRequired');
    else if (planId && payMethod !== 'complimentary') {
      const amount = Number(amountPaid);
      if (!amountPaid.trim() || !Number.isFinite(amount) || amount <= 0) bad = t('memberNew.amountRequired');
      else if (amount > (selectedPlan?.priceEGP ?? 0)) bad = t('memberNew.amountTooHigh');
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
        phone: egyptPhone(phone),
        dateOfBirth: dateOfBirth.trim() || undefined,
        emergencyName: emName.trim() || undefined,
        emergencyPhone: egyptPhone(emPhone),
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
              placeholder="10 1234 5678"
              inputMode="tel"
              leading={
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', paddingRight: 11, borderRightWidth: 1, borderRightColor: c.line }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: c.ink2, writingDirection: textDir }}>+20</Text>
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
              placeholder="00000000000000"
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
                    <Text style={[styles.planPrice, { color: c.ink, writingDirection: textDir }]}>{t('common.egpAmount', { amount: p.priceEGP.toLocaleString() })}</Text>
                    <Text style={[styles.planPricePeriod, { color: c.ink3, writingDirection: textDir }]}>
                      {periodLabel}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {plansQuery.isLoading ? (
              <Text style={{ color: c.ink3, fontSize: 12.5, writingDirection: textDir }}>{t('memberNew.loadingPlans')}</Text>
            ) : null}
          </View>

          {planId ? (
            <View style={{ gap: 10 }}>
              <Text style={[styles.fieldLabel, { color: c.ink3, writingDirection: textDir }]}>{t('memberNew.paymentAtDesk')}</Text>
              <View style={[styles.segWrap, { backgroundColor: c.bg1, borderColor: c.line }]}>
                {(['cash', 'card', 'wallet', 'instapay', 'complimentary'] as PaymentMethod[]).map((method) => {
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
                  hint={selectedPlan ? t('memberNew.planPriceHint', { amount: t('common.egpAmount', { amount: selectedPlan.priceEGP.toLocaleString() }) }) : undefined}
                >
                  <Control
                    value={amountPaid}
                    onChangeText={setAmountPaid}
                    placeholder={String(selectedPlan?.priceEGP ?? '')}
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
            {t('memberNew.footer', { club: CLUB.name })}
          </Text>
        </Body>
      </ScrollView>
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
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  desc: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
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
    fontSize: 15.5,
    fontWeight: '600',
  },
  planPeriod: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
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
    fontSize: 12.5,
    fontWeight: '600',
  },
  foot: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.18,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
