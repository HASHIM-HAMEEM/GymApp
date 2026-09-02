import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors, spacing, typography } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { OtpBoxes } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/data/store';
import { CURRENT_MEMBER_ID } from '@/data/plans';

export default function Otp() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string }>();
  const phone = params.phone ?? '+20 10 2748 8531';
  const { signIn, darkMode } = useApp();
  const c = useColors(darkMode);

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [resendT, setResendT] = React.useState(24);

  React.useEffect(() => {
    const t = setInterval(() => setResendT((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const verify = () => {
    setLoading(true);
    setError(false);
    setTimeout(() => {
      setLoading(false);
      // Accept any 6-digit code in demo, plus the design-system codes
      if (code.length === 6) {
        signIn(CURRENT_MEMBER_ID);
        router.replace('/(member)/home');
      } else {
        setError(true);
      }
    }, 900);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar title="Verification" onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={{ gap: 8 }}>
          <Text style={[styles.slabel, { color: c.ink3 }]}>Verification</Text>
          <Text style={[styles.h1, { color: c.ink }]}>Enter the code</Text>
          <Text style={[styles.sub, { color: c.ink2 }]}>
            Sent to <Text style={{ color: c.ink, fontWeight: '600', fontFamily: typography.mono }}>{phone}</Text>. It expires in 10 minutes.
          </Text>
        </View>

        <OtpBoxes value={code} onChange={(v) => { setCode(v); setError(false); }} error={error} />

        {error ? (
          <Banner variant="error">
            That code doesn't match. Check the latest message.
          </Banner>
        ) : null}

        <View style={styles.row}>
          <Text style={[styles.meta, { color: c.ink3 }]}>Didn't get it?</Text>
          <Text style={[styles.meta, { color: c.ink2, fontFamily: typography.mono }]}>
            Resend in {String(Math.floor(resendT / 60)).padStart(2, '0')}:
            {String(resendT % 60).padStart(2, '0')}
          </Text>
        </View>

        <Button block loading={loading} disabled={code.length !== 6} onPress={verify}>
          Verify
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 26,
  },
  slabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  h1: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.015,
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 23,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  meta: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
  },
});
