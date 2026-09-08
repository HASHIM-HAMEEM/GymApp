import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { Icon } from '@/components/Icon';
import { useApp } from '@/providers/AppProvider';
import { useCurrentMember, useUpdateMemberProfile } from '@/data/api/queries';
import { formatAadhaar, isValidAadhaar, normalizeAadhaar } from '@/lib/aadhaar';
import { FormScroll } from '@/components/FormScroll';

function indiaPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('91')) return `+${digits}`;
  if (digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return `+91${digits}`;
}

export default function EditProfile() {
  const router = useRouter();
  const memberQuery = useCurrentMember();
  const updateProfile = useUpdateMemberProfile();
  const { darkMode, isRtl, t } = useApp();
  const c = useColors(darkMode);
  const m = memberQuery.data ?? null;

  const [first, setFirst] = React.useState(m?.firstName ?? '');
  const [phone, setPhone] = React.useState(m ? m.phone.replace(/^\+91\s?/, '') : '');
  const [emName, setEmName] = React.useState(m?.emergencyName ?? '');
  const [emPhone, setEmPhone] = React.useState(m?.emergencyPhone ?? '');
  const [nationalId, setNationalId] = React.useState(m?.nationalId ?? '');
  const [address, setAddress] = React.useState(m?.address ?? '');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (m && !first) {
      setFirst(m.firstName);
      setPhone(m.phone.replace(/^\+91\s?/, ''));
      setEmName(m.emergencyName ?? '');
      setEmPhone(m.emergencyPhone ?? '');
      setNationalId(m.nationalId ?? '');
      setAddress(m.address ?? '');
    }
  }, [m, first]);

  if (!m) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <AppBar title={t('profile.editTitle')} onBack={() => router.back()} />
        <Text style={{ color: c.ink3, padding: 20, writingDirection: isRtl ? 'rtl' : 'ltr' }}>{t('profile.loadingProfile')}</Text>
      </View>
    );
  }

  const save = async () => {
    let bad: string | null = null;
    if (!first.trim()) bad = t('profile.firstNameRequired');
    else if (phone.trim() && phone.replace(/\D/g, '').length < 10) bad = t('profile.phoneInvalid');
    else if (Boolean(emName.trim()) !== Boolean(emPhone.trim())) bad = t('profile.emergencyBoth');
    else if (emPhone.trim() && emPhone.replace(/\D/g, '').length < 10) bad = t('profile.emergencyPhoneInvalid');
    else if (!isValidAadhaar(nationalId)) bad = t('profile.nationalIdInvalid');
    else if (!address.trim()) bad = t('profile.addressRequired');
    if (bad) {
      setFormError(bad);
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        firstName: first.trim(),
        phone: indiaPhone(phone),
        emergencyName: emName.trim(),
        emergencyPhone: indiaPhone(emPhone),
        nationalId: normalizeAadhaar(nationalId),
        address: address.trim(),
      });

      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('memberNew.invitationFailed');
      setFormError(`${message} ${t('profile.saveFailedTail')}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={t('profile.editTitle')} onBack={() => router.back()} />
      <FormScroll contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>

          {formError ? <Banner variant="error">{formError}</Banner> : null}

          <Field label={t('profile.firstName')} hint={t('profile.firstNameHint')}>
            <Control value={first} onChangeText={setFirst} />
          </Field>

          <Field label={t('profile.authEmail')} hint={t('profile.authEmailHint')}>
            <View style={[styles.lockedEmail, { backgroundColor: c.bg2, borderColor: c.line }]}> 
              <Icon name="shield" size={18} color={c.ink3} />
              <Text
                style={[styles.lockedEmailText, { color: c.ink2, textAlign: isRtl ? 'right' : 'left' }]}
                numberOfLines={1}
              >
                {m.email}
              </Text>
            </View>
          </Field>

          <Field label={t('profile.phone')} hint={t('profile.phoneHint')}>
            <Control
              value={phone}
              onChangeText={setPhone}
              inputMode="tel"
              leading={
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 11, borderRightWidth: 1, borderRightColor: c.line }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: c.ink2, writingDirection: 'ltr' }}>+91</Text>
                </View>
              }
            />
          </Field>

          <Field label={t('profile.emergencyName')}>
            <Control value={emName} onChangeText={setEmName} />
          </Field>

          <Field label={t('profile.emergencyPhone')}>
            <Control
              value={emPhone}
              onChangeText={setEmPhone}
              inputMode="tel"
            />
          </Field>

          <Field label={t('profile.nationalId')} hint={t('profile.nationalIdHint')}>
            <Control
              value={nationalId}
              onChangeText={(value) => setNationalId(formatAadhaar(value))}
              inputMode="numeric"
              maxLength={14}
              placeholder={t('profile.nationalIdPlaceholder')}
            />
          </Field>

          <Field label={t('profile.address')}>
            <Control value={address} onChangeText={setAddress} placeholder={t('profile.addressPlaceholder')} multiline />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10, paddingTop: 4 }}>
            <Button variant="secondary" block style={{ flex: 1 }} onPress={() => router.back()}>{t('common.cancel')}</Button>
            <Button block style={{ flex: 1 }} loading={saving} onPress={save}>{t('profile.save')}</Button>
          </View>
        </Body>
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  lockedEmail: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
  },
  lockedEmailText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});
