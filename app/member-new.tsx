import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { EmptyState } from '@/components/Surfaces';
import { useApp } from '@/data/store';

export default function MemberNew() {
  const router = useRouter();
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const [aadhar, setAadhar] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [aadharErr, setAadharErr] = React.useState(false);
  const [addressErr, setAddressErr] = React.useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="New member" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Body style={{ gap: 16 }}>
      <EmptyState
        icon="userplus"
        title="New member setup"
        body="In the full product, reception creates the member here: name, phone, emergency contact, then assigns the first plan. The database step comes next."
      />
      <Field label="First name"><Control placeholder="Member's first name" /></Field>
      <Field label="Last name"><Control placeholder="Member's last name" /></Field>
      <Field label="Phone number" hint="Used for sign-in and SMS.">
        <Control
          placeholder="10 1234 5678"
          inputMode="tel"
          leading={
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 11, borderRightWidth: 1, borderRightColor: c.line }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: c.ink2 }}>+20</Text>
            </View>
          }
        />
      </Field>
      <Field label="Email · optional"><Control placeholder="email@example.com" inputMode="email" /></Field>
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
        <Button
          block
          onPress={() => {
            const validAadhar = aadhar.replace(/\s/g, '').length >= 12;
            const validAddress = address.trim().length > 0;
            if (!validAadhar) setAadharErr(true);
            if (!validAddress) setAddressErr(true);
            if (validAadhar && validAddress) router.back();
          }}
        >
          Create member (demo)
        </Button>
      </Body>
    </ScrollView>
  </View>
);
}
