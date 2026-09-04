import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';

/**
 * M-03 & M-04 Sign in — email & password with inline error state.
 * Accounts are created by reception; members only enter credentials here.
 */
export default function SignIn() {
  const router = useRouter();
  const { darkMode, signIn, authError, clearAuthError, configurationError } = useApp();
  const c = useColors(darkMode);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && password.length > 0;

  const submit = async () => {
    if (!emailValid) {
      setFormError('Enter the email address reception has on file — the address is missing its domain.');
      return;
    }
    setFormError(null);
    clearAuthError();
    setLoading(true);
    try {
      await signIn(email, password);
      // The root stack redirects once the session and profile load.
    } catch {
      // authError from the provider surfaces the banner below.
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar onBack={() => router.back()} />
      <View style={styles.body}>
        <View>
          <Text style={[styles.slabel, { color: c.ink3 }]}>Sign in</Text>
          <Text style={[styles.h1, { color: c.ink }]}>Your account</Text>
          <Text style={[styles.lede, { color: c.ink3 }]}>
            Sign in with the email and password you set when you accepted your membership invitation.
          </Text>
        </View>

        <Field
          label="Email"
          error={formError && !emailValid ? formError : undefined}
          hint="The address where you received your Meridian invitation."
        >
          <Control
            accessibilityLabel="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (formError) setFormError(null);
            }}
            placeholder="name@example.com"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            error={Boolean(formError && !emailValid)}
          />
        </Field>

        <Field label="Password">
          <Control
            accessibilityLabel="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secure
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={canSubmit ? submit : undefined}
          />
        </Field>

        {authError || configurationError ? (
          <Banner variant="error">{authError ?? configurationError}</Banner>
        ) : null}

        <View style={styles.foot}>
          <Button block loading={loading} disabled={!canSubmit} onPress={submit}>
            Sign in
          </Button>
          <Button
            variant="quiet"
            block
            textStyle={{ fontSize: 13.5 }}
            href="/forgot-password"
          >
            Forgot your password?
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: 8,
    paddingBottom: 24,
    justifyContent: 'space-between',
    gap: 18,
  },
  slabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
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
  foot: {
    marginTop: 'auto',
    gap: 12,
    paddingBottom: 12,
  },
});
