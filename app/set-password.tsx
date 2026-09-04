import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';

const MIN_LENGTH = 10;

function passwordProblem(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Use at least ${MIN_LENGTH} characters — longer passwords are stronger.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Mix upper case, lower case, and at least one digit.';
  }
  return null;
}

/**
 * Invite acceptance and password recovery both land here with a fresh
 * session. Completing the password also finishes member onboarding, which
 * activates the account and marks the invitation as accepted.
 */
export default function SetPassword() {
  const router = useRouter();
  const { session, profile, setPassword, darkMode } = useApp();
  const c = useColors(darkMode);
  const [password, setPasswordValue] = React.useState('');
  const [confirm, setConfirmValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const isInviteFlow = Boolean(profile?.mustSetPassword);
  const problem = password ? passwordProblem(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= MIN_LENGTH && !problem && !mismatch && !loading && !done;

  React.useEffect(() => {
    if (!session) router.replace('/');
  }, [session, router]);

  React.useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.replace('/'), 1100);
    return () => clearTimeout(timer);
  }, [done, router]);

  const submit = async () => {
    const found = passwordProblem(password);
    if (found) {
      setError(found);
      return;
    }
    if (confirm !== password) {
      setError('The two passwords do not match. Retype the confirmation field.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await setPassword(password, isInviteFlow);
      setDone(true);
    } catch {
      setError('The password could not be saved. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <AppBar title="Password set" />
        <View style={styles.doneBody}>
          <Text style={[styles.doneTitle, { color: c.ink }]}>
            {isInviteFlow ? 'Welcome to Meridian' : 'Password updated'}
          </Text>
          <Text style={[styles.doneBodyText, { color: c.ink2 }]}>
            {isInviteFlow
              ? 'Your membership account is active. Taking you to your membership…'
              : 'Your new password is ready. Taking you to sign in…'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar title="Set password" />
      <View style={styles.body}>
        <View>
          <Text style={[styles.h1, { color: c.ink }]}>
            {isInviteFlow ? 'Choose a password' : 'Choose a new password'}
          </Text>
          <Text style={[styles.lede, { color: c.ink3 }]}>
            {isInviteFlow
              ? 'This password unlocks your member app together with your verified email.'
              : 'Pick something you have not used before. You will use it with your account email.'}
          </Text>
        </View>

        <Field label="Password" error={error ?? undefined} hint={`At least ${MIN_LENGTH} characters with upper case, lower case, and a digit.`}>
          <Control
            value={password}
            onChangeText={(t) => {
              setPasswordValue(t);
              if (error) setError(null);
            }}
            placeholder="New password"
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            error={Boolean(error)}
          />
        </Field>

        <Field
          label="Confirm password"
          error={mismatch ? 'The two passwords do not match. Retype the confirmation field.' : undefined}
        >
          <Control
            value={confirm}
            onChangeText={(t) => {
              setConfirmValue(t);
              if (error) setError(null);
            }}
            placeholder="Repeat the password"
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={canSubmit ? submit : undefined}
            error={mismatch}
          />
        </Field>

        {error ? <Banner variant="error">{error}</Banner> : null}

        <View style={styles.foot}>
          <Button block loading={loading} disabled={!canSubmit} onPress={submit}>
            {isInviteFlow ? 'Activate membership' : 'Save password'}
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
  doneBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    gap: 14,
  },
  doneTitle: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  doneBodyText: {
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
