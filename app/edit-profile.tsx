import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';
import { useCurrentMember, useUpdateMemberProfile } from '@/data/api/queries';

function egyptPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20')) return `+${digits}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  return `+20${digits}`;
}

export default function EditProfile() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const updateProfile = useUpdateMemberProfile();
  const { updateEmail, darkMode } = useApp();
  const c = useColors(darkMode);
  const m = memberQuery.data ?? null;

  const [first, setFirst] = React.useState(m?.firstName ?? '');
  const [email, setEmail] = React.useState(m?.email ?? '');
  const [phone, setPhone] = React.useState(m ? m.phone.replace(/^\+20\s?/, '') : '');
  const [emName, setEmName] = React.useState(m?.emergencyName ?? '');
  const [emPhone, setEmPhone] = React.useState(m?.emergencyPhone ?? '');
  const [nationalId, setNationalId] = React.useState(m?.nationalId ?? '');
  const [address, setAddress] = React.useState(m?.address ?? '');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [emailNotice, setEmailNotice] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (m && !first && !email) {
      setFirst(m.firstName);
      setEmail(m.email);
      setPhone(m.phone.replace(/^\+20\s?/, ''));
      setEmName(m.emergencyName ?? '');
      setEmPhone(m.emergencyPhone ?? '');
      setNationalId(m.nationalId ?? '');
      setAddress(m.address ?? '');
    }
  }, [m, first, email]);

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title="Edit profile" onBack={() => router.back()} />
        <Text style={{ color: c.ink3, padding: 20 }}>Loading your profile…</Text>
      </View>
    );
  }

  const save = async () => {
    let bad: string | null = null;
    if (!first.trim()) bad = 'First name is required — as it appears on your membership card.';
    else if (phone.trim() && phone.replace(/\D/g, '').length < 10) bad = 'Enter a valid phone number, at least 10 digits.';
    else if (Boolean(emName.trim()) !== Boolean(emPhone.trim())) bad = 'Add both the emergency contact name and phone, or leave both blank.';
    else if (emPhone.trim() && emPhone.replace(/\D/g, '').length < 10) bad = 'Enter a valid emergency contact phone, at least 10 digits.';
    else if (nationalId.trim() && nationalId.replace(/\D/g, '').length !== 14) bad = 'Enter a valid Egyptian national ID — exactly 14 digits.';
    else if (!address.trim()) bad = 'Address is required — reception uses it for your file.';
    if (bad) {
      setFormError(bad);
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        firstName: first.trim(),
        phone: egyptPhone(phone),
        emergencyName: emName.trim(),
        emergencyPhone: egyptPhone(emPhone),
        nationalId: nationalId.trim(),
        address: address.trim(),
      });

      const nextEmail = email.trim().toLowerCase();
      if (nextEmail && nextEmail !== m.email) {
        await updateEmail(nextEmail);
        setEmail(m.email);
        setEmailNotice(
          'Profile saved. A confirmation email is on its way to your new address — it takes over once you confirm it.',
        );
        return;
      }
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Your profile could not be saved.';
      setFormError(`${message} Check the fields and try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Edit profile" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>

          {formError ? <Banner variant="error">{formError}</Banner> : null}
          {emailNotice ? <Banner variant="info">{emailNotice}</Banner> : null}

          <Field label="First name" hint="As it should appear on your membership card.">
            <Control value={first} onChangeText={setFirst} />
          </Field>

          <Field
            label="Email"
            hint="Changing it sends a confirmation email to the new address; the old one stays active until then."
          >
            <Control
              value={email}
              onChangeText={setEmail}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
          </Field>

          <Field label="Phone number" hint="The number reception keeps on file.">
            <Control
              value={phone}
              onChangeText={setPhone}
              inputMode="tel"
              leading={
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 11, borderRightWidth: 1, borderRightColor: c.line }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: c.ink2 }}>+20</Text>
                </View>
              }
            />
          </Field>

          <Field label="Emergency contact name">
            <Control value={emName} onChangeText={setEmName} />
          </Field>

          <Field label="Emergency contact phone">
            <Control
              value={emPhone}
              onChangeText={setEmPhone}
              inputMode="tel"
            />
          </Field>

          <Field label="National ID" hint="14 digits for Egyptian IDs. Kept private — only reception sees it.">
            <Control
              value={nationalId}
              onChangeText={setNationalId}
              inputMode="numeric"
              placeholder="00000000000000"
            />
          </Field>

          <Field label="Address">
            <Control value={address} onChangeText={setAddress} placeholder="Street, city" multiline />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10, paddingTop: 4 }}>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={() => router.back()}>Cancel</Button>
            <Button block style={{ flex: 1 }} loading={saving} onPress={save}>Save changes</Button>
          </View>
        </Body>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
