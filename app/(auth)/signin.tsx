import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { useApp } from '@/data/store';

export default function SignIn() {
  const router = useRouter();
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const [phone, setPhone] = React.useState('');
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const submit = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setError(true);
      return;
    }
    setError(false);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: '/otp', params: { phone: `+20 ${phone.trim()}` } });
    }, 900);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
        <Text style={[styles.slabel, { color: c.ink3 }]}>Sign in</Text>
        <Text style={[styles.h1, { color: c.ink }]}>Your phone number</Text>
        <Text style={[styles.lede, { color: c.ink2 }]}>We'll text you a six-digit code.</Text>
      </View>

      <View style={{ gap: 14 }}>
        <Field
          label="Mobile number"
          error={error ? 'That number looks short — Egyptian mobiles have 10 digits after +20.' : undefined}
        >
          <Control
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setError(false);
            }}
            placeholder="10 2748 8531"
            inputMode="numeric"
            error={error}
            leading={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 12, borderRightWidth: 1, borderRightColor: c.line }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink2 }}>🇪🇬 +20</Text>
              </View>
            }
          />
        </Field>

        <View style={{ marginTop: 'auto', paddingBottom: 16 }}>
          <Button block loading={loading} onPress={submit}>
            Send code
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: 40,
    paddingBottom: 34,
    justifyContent: 'flex-end',
  },
  slabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: tracking.caps,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  h1: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.015,
    lineHeight: 32,
  },
  lede: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    marginTop: 10,
    lineHeight: 23,
    maxWidth: 30 * 8,
  },
});
