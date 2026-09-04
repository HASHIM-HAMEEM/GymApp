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
  const { darkMode } = useApp();
  const c = useColors(darkMode);

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

  if (created) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="New member" onClose={() => router.back()} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <Body style={{ gap: 18 }}>
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 20 }}>
              <View style={[styles.badge, { backgroundColor: c.okSoft }]}>
                <Icon name="mail" size={38} color={c.ok} />
              </View>
              <Text style={[styles.h1, { color: c.ink }]}>Invitation sent</Text>
              <Text style={[styles.desc, { color: c.ink2 }]}>
                {created.memberNumber} is registered. An activation email is on its way to {created.email} — the member sets their own password from that link.
              </Text>
            </View>
            <Button block onPress={() => router.replace({ pathname: '/member-detail', params: { id: created.memberNumber } })}>
              View member profile
            </Button>
            <Button variant="secondary" block onPress={() => router.push('/member-new')}>
              Add another member
            </Button>
          </Body>
        </ScrollView>
      </View>
    );
  }

  const submit = async () => {
    let bad: string | null = null;
    if (!firstName.trim() || !lastName.trim()) bad = 'First and last name are required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) bad = 'Enter a complete email address — the invitation is sent there.';
    else if (phone.trim() && phone.replace(/\D/g, '').length < 10) bad = 'Enter a valid member phone number, or leave it blank.';
    else if (dateOfBirth.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) bad = 'Date of birth must be YYYY-MM-DD.';
    else if (Boolean(emName.trim()) !== Boolean(emPhone.trim())) bad = 'Add both the emergency contact name and phone, or leave both blank.';
    else if (emPhone.trim() && emPhone.replace(/\D/g, '').length < 10) bad = 'Enter a valid emergency contact phone number.';
    else if (nationalId.trim() && nationalId.replace(/\D/g, '').length !== 14) bad = 'Enter a valid Egyptian national ID — exactly 14 digits.';
    else if (!address.trim()) bad = 'Address is required for the member file.';
    else if (planId && payMethod !== 'complimentary') {
      const amount = Number(amountPaid);
      if (!amountPaid.trim() || !Number.isFinite(amount) || amount <= 0) bad = 'Enter the amount paid at the desk.';
      else if (amount > (selectedPlan?.priceEGP ?? 0)) bad = 'The amount paid cannot exceed the plan price.';
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
        setFormError('An account or invitation already exists for this email. Open the member list to resend it.');
      } else if (error instanceof ApiCallError && error.code === 'VALIDATION_ERROR') {
        setFormError(`${error.message} Adjust the form and try again.`);
      } else if (
        error instanceof ApiCallError
        && ['INVITATION_SEND_FAILED', 'INVITATION_LINK_FAILED'].includes(error.code)
      ) {
        setFormError(
          'The member record was saved, but the email was not delivered. Open the member list and resend the invitation after email service is available.',
        );
      } else {
        setFormError('The invitation could not be completed. Check your connection and try again.');
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="New member" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>

          {formError ? <Banner variant="error">{formError}</Banner> : null}

          <Field label="First name"><Control value={firstName} onChangeText={setFirstName} placeholder="Member's first name" autoComplete="off" /></Field>
          <Field label="Last name"><Control value={lastName} onChangeText={setLastName} placeholder="Member's last name" autoComplete="off" /></Field>

          <Field label="Email" hint="The activation invitation is sent here. It becomes the member's sign-in address.">
            <Control
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
            />
          </Field>

          <Field label="Phone number · optional" hint="Kept on file; not used for sign-in.">
            <Control
              value={phone}
              onChangeText={setPhone}
              placeholder="10 1234 5678"
              inputMode="tel"
              leading={
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 11, borderRightWidth: 1, borderRightColor: c.line }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: c.ink2 }}>+20</Text>
                </View>
              }
            />
          </Field>

          <Field label="Date of birth · optional" hint="YYYY-MM-DD">
            <Control
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="1998-03-15"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
          </Field>

          <Field label="Emergency contact · optional">
            <Control value={emName} onChangeText={setEmName} placeholder="Contact name" autoComplete="off" />
            <View style={{ height: 10 }} />
            <Control value={emPhone} onChangeText={setEmPhone} placeholder="Contact phone" inputMode="tel" />
          </Field>

          <Field label="National ID" hint="Kept private — visible to reception only.">
            <Control
              value={nationalId}
              onChangeText={setNationalId}
              placeholder="00000000000000"
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>

          <Field label="Address">
            <Control value={address} onChangeText={setAddress} placeholder="Street, city" multiline />
          </Field>

          <View style={{ gap: 10 }}>
            <Text style={[styles.fieldLabel, { color: c.ink3 }]}>First plan · optional</Text>
            {plans.map((p) => {
              const on = p.id === planId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPlanId(on ? '' : p.id)}
                  style={[
                    styles.planCard,
                    { backgroundColor: c.bg1, borderColor: on ? c.accent : c.line },
                  ]}
                >
                  <View style={[styles.radioCircle, { borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accent : 'transparent' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planTitle, { color: c.ink }]}>{p.name}</Text>
                    <Text style={[styles.planPeriod, { color: c.ink3 }]}>{p.blurb}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.planPrice, { color: c.ink }]}>EGP {p.priceEGP.toLocaleString()}</Text>
                    <Text style={[styles.planPricePeriod, { color: c.ink3 }]}>
                      {p.duration === 12 ? '/ year' : p.duration === 3 ? '/ 3 mo' : '/ month'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {plansQuery.isLoading ? (
              <Text style={{ color: c.ink3, fontSize: 12.5 }}>Loading plans…</Text>
            ) : null}
          </View>

          {planId ? (
            <View style={{ gap: 10 }}>
              <Text style={[styles.fieldLabel, { color: c.ink3 }]}>Payment at the desk</Text>
              <View style={[styles.segWrap, { backgroundColor: c.bg1, borderColor: c.line }]}>
                {(['cash', 'card', 'wallet', 'instapay', 'complimentary'] as PaymentMethod[]).map((method) => {
                  const on = payMethod === method;
                  return (
                    <Pressable
                      key={method}
                      onPress={() => setPayMethod(method)}
                      style={[styles.segBtn, on && { backgroundColor: c.accent }]}
                    >
                      <Text style={[styles.segText, { color: on ? c.accentInk : c.ink3 }]}>
                        {method === 'instapay' ? 'InstaPay' : method === 'complimentary' ? 'Comp.' : method[0].toUpperCase() + method.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {payMethod !== 'complimentary' ? (
                <Field
                  label="Amount paid (EGP)"
                  hint={selectedPlan ? `Plan price EGP ${selectedPlan.priceEGP.toLocaleString()}; unpaid balance becomes due.` : undefined}
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
                <Banner variant="info">Complimentary access records a zero-value payment — nothing becomes due.</Banner>
              )}
            </View>
          ) : (
            <Banner variant="info">
              Skip the plan for now — the member receives the invitation immediately, and you can assign a plan from their profile later.
            </Banner>
          )}

          <Button
            block
            loading={createInvitation.isPending}
            onPress={submit}
          >
            Create member & send invitation
          </Button>

          <Text style={[styles.foot, { color: c.ink4 }]}>
            {CLUB.name} · Members set their own password from the email link
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
