import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { Icon } from '@/components/Icon';
import { useApp } from '@/providers/AppProvider';

/**
 * Password recovery request. Sends a one-time reset link to the verified
 * account email; the link opens /confirm which exchanges the token hash.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const { darkMode, sendPasswordReset, configurationError } = useApp();
  const c = useColors(darkMode);
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && !loading;

  const submit = async () => {
    if (!emailValid) {
      setError('Enter a complete email address — including the domain, like name@example.com.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch {
      setError('The reset email could not be sent right now. Wait a moment and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <AppBar title="Reset password" onBack={() => router.back()} />
        <View style={styles.sentBody}>
          <View style={[styles.badge, { backgroundColor: c.okSoft }]}>
            <Icon name="mail" size={38} color={c.ok} />
          </View>
          <Text style={[styles.sentTitle, { color: c.ink }]}>Check your email</Text>
          <Text style={[styles.sentBody_, { color: c.ink2 }]}>
            If {email.trim()} belongs to a Meridian account, a reset link is on its way. The link works once and expires shortly.
          </Text>
          <Button block href="/signin">
            Back to sign in
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar title="Reset password" onBack={() => router.back()} />
      <View style={styles.body}>
        <View>
          <Text style={[styles.h1, { color: c.ink }]}>Forgot your password?</Text>
          <Text style={[styles.lede, { color: c.ink3 }]}>
            Enter your account email and we'll send a one-time link to choose a new password.
          </Text>
        </View>

        <Field label="Email" error={error ?? undefined} hint="The address where you received your Meridian invitation.">
          <Control
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (error) setError(null);
            }}
            placeholder="name@example.com"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="done"
            error={Boolean(error)}
          />
        </Field>

        {configurationError ? <Banner variant="error">{configurationError}</Banner> : null}

        <View style={styles.foot}>
          <Button block loading={loading} disabled={!canSubmit} onPress={submit}>
            Send reset link
          </Button>
        </View>
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
    paddingBottom: 24,
    gap: 18,
  },
  sentBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    gap: 18,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentTitle: {
    fontFamily: typography.display,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  sentBody_: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  h1: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  lede: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    marginTop: 10,
    lineHeight: 22,
  },
  foot: { marginTop: 'auto', paddingBottom: 12 },
});
