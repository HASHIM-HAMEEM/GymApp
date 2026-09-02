import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { useApp } from '@/data/store';

export default function EditProfile() {
  const router = useRouter();
  const { currentMember, updateProfile, darkMode } = useApp();
  const c = useColors(darkMode);
  if (!currentMember) return null;
  const m = currentMember;

  const [first, setFirst] = React.useState(m.firstName);
  const [phone, setPhone] = React.useState(m.phone.replace('+20 ', ''));
  const [email, setEmail] = React.useState(m.email ?? '');
  const [emName, setEmName] = React.useState(m.emergencyName ?? '');
  const [emPhone, setEmPhone] = React.useState(m.emergencyPhone ?? '');
  const [aadhar, setAadhar] = React.useState(m.aadharNumber ?? '');
  const [address, setAddress] = React.useState(m.address ?? '');
  const [emNameErr, setEmNameErr] = React.useState(false);
  const [emPhoneErr, setEmPhoneErr] = React.useState(false);
  const [aadharErr, setAadharErr] = React.useState(false);
  const [addressErr, setAddressErr] = React.useState(false);

  const save = () => {
    let bad = false;
    if (!emName.trim()) { setEmNameErr(true); bad = true; }
    if (emPhone.replace(/\D/g, '').length < 10) { setEmPhoneErr(true); bad = true; }
    if (aadhar.replace(/\s/g, '').length < 12) { setAadharErr(true); bad = true; }
    if (!address.trim()) { setAddressErr(true); bad = true; }
    if (bad) return;
    updateProfile(m.id, {
      firstName: first,
      phone: `+20 ${phone}`,
      email,
      emergencyName: emName,
      emergencyPhone: emPhone,
      aadharNumber: aadhar,
      address,
    });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Edit profile" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>

      <Field label="First name" hint="As it should appear on your membership card.">
        <Control value={first} onChangeText={setFirst} />
      </Field>

      <Field label="Phone number" hint="Your sign-in number. Changing it requires re-verification.">
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

      <Field label="Email · optional">
        <Control value={email} onChangeText={setEmail} inputMode="email" />
      </Field>

      <Field
        label="Emergency contact name"
        error={emNameErr ? "Enter your contact's full name" : undefined}
      >
        <Control value={emName} onChangeText={(t) => { setEmName(t); setEmNameErr(false); }} error={emNameErr} />
      </Field>

      <Field
        label="Emergency contact phone"
        error={emPhoneErr ? 'Enter a valid phone number, at least 10 digits' : undefined}
      >
        <Control
          value={emPhone}
          onChangeText={(t) => { setEmPhone(t); setEmPhoneErr(false); }}
          inputMode="tel"
          error={emPhoneErr}
        />
      </Field>

      <Field
        label="Aadhar number"
        error={aadharErr ? 'Enter a valid 12-digit Aadhar number' : undefined}
      >
        <Control
          value={aadhar}
          onChangeText={(t) => { setAadhar(t); setAadharErr(false); }}
          inputMode="numeric"
          placeholder="0000 0000 0000"
          error={aadharErr}
        />
      </Field>

      <Field
        label="Address"
        error={addressErr ? 'Address is required' : undefined}
      >
        <Control
          value={address}
          onChangeText={(t) => { setAddress(t); setAddressErr(false); }}
          placeholder="Street, city"
          multiline
          error={addressErr}
        />
      </Field>

      <View style={{ flexDirection: 'row', gap: 10, paddingTop: 4 }}>
        <Button variant="secondary" block style={{ flex: 1 }} onPress={() => router.back()}>Cancel</Button>
        <Button block style={{ flex: 1 }} onPress={save}>Save changes</Button>
      </View>
        </Body>
      </ScrollView>
    </View>
  );
}

