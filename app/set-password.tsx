import * as React from 'react';
import { View, Text, StyleSheet, type TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';
import { FormScroll } from '@/components/FormScroll';

const MIN_LENGTH = 10;

/**
 * Invite acceptance and password recovery both land here with a fresh
 * session. Completing the password also finishes member onboarding, which
 * activates the account and marks the invitation as accepted.
 */
export default function SetPassword() {
  const router = useRouter();
  const { session, profile, setPassword, signOut, darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const [password, setPasswordValue] = React.useState('');
  const [confirm, setConfirmValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  // `done` carries the flow that was completed. It must be captured at submit
  // time: completing onboarding clears profile.mustSetPassword, so reading
  // the live profile afterwards would misclassify an invite as a recovery
  // and sign the brand-new member straight back out.
  const [done, setDone] = React.useState<'invite' | 'recovery' | null>(null);
  const passwordRef = React.useRef<TextInput>(null);
  const confirmRef = React.useRef<TextInput>(null);

  const isInviteFlow = done ? done === 'invite' : Boolean(profile?.mustSetPassword);

  function passwordProblem(password: string): string | null {
    if (password.length < MIN_LENGTH) {
      return t('setPassword.minLength', { count: MIN_LENGTH });
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return t('setPassword.mixCase');
    }
    return null;
  }

  const problem = password ? passwordProblem(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= MIN_LENGTH && !problem && !mismatch && !loading && !done;

  React.useEffect(() => {
    if (!session) router.replace('/');
  }, [session, router]);

  React.useEffect(() => {
    if (!done) return;
    if (done === 'invite') {
      const timer = setTimeout(() => router.replace('/'), 1100);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      void signOut()
        .catch(() => undefined)
        .finally(() => router.replace('/signin'));
    }, 1100);
    return () => clearTimeout(timer);
  }, [done, router, signOut]);

  const submit = async () => {
    const found = passwordProblem(password);
    if (found) {
      setError(found);
      return;
    }
    if (confirm !== password) {
      setError(t('setPassword.mismatch'));
      return;
    }
    setError(null);
    setLoading(true);
    const flow = isInviteFlow ? 'invite' : 'recovery';
    try {
      await setPassword(password, flow === 'invite');
      setDone(flow);
    } catch {
      setError(t('setPassword.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const titleStyle = {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.01,
    color: c.ink,
    writingDirection: isRtl ? 'rtl' : 'ltr',
  } as const;

  if (done) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <AppBar>
          <Text style={titleStyle}>{t('setPassword.passwordSet')}</Text>
        </AppBar>
        <View style={styles.doneBody}>
          <Text style={[styles.doneTitle, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {isInviteFlow ? t('setPassword.welcome') : t('setPassword.updated')}
          </Text>
          <Text style={[styles.doneBodyText, { color: c.ink2, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {isInviteFlow ? t('setPassword.inviteDone') : t('setPassword.recoveryDone')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <AppBar>
        <Text style={titleStyle}>{t('setPassword.title')}</Text>
      </AppBar>
      <FormScroll contentContainerStyle={styles.body}>
        <View>
          <Text style={[styles.h1, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {isInviteFlow ? t('setPassword.choose') : t('setPassword.chooseNew')}
          </Text>
          <Text style={[styles.lede, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {isInviteFlow ? t('setPassword.inviteIntro') : t('setPassword.recoveryIntro')}
          </Text>
        </View>

        <Field
          label={t('auth.password')}
          error={error ?? undefined}
          hint={t('setPassword.hint', { count: MIN_LENGTH })}
        >
          <Control
            ref={passwordRef}
            fieldKey="new-password"
            accessibilityLabel={t('auth.password')}
            value={password}
            onChangeText={(t) => {
              setPasswordValue(t);
              if (error) setError(null);
            }}
            placeholder={t('setPassword.newPlaceholder')}
            secure
            webType="password"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            error={Boolean(error)}
          />
        </Field>

        <Field
          label={t('setPassword.confirmLabel')}
          error={mismatch ? t('setPassword.mismatch') : undefined}
        >
          <Control
            ref={confirmRef}
            fieldKey="confirm-password"
            accessibilityLabel={t('setPassword.confirmLabel')}
            value={confirm}
            onChangeText={(t) => {
              setConfirmValue(t);
              if (error) setError(null);
            }}
            placeholder={t('setPassword.repeatPlaceholder')}
            secure
            webType="password"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={canSubmit ? submit : undefined}
            error={mismatch}
          />
        </Field>

        {error ? (
          <Banner variant="error" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            <Text style={{ writingDirection: isRtl ? 'rtl' : 'ltr' }}>{error}</Text>
          </Banner>
        ) : null}

        <View style={styles.foot}>
          <Button block loading={loading} disabled={!canSubmit} onPress={submit}>
            {isInviteFlow ? t('setPassword.activate') : t('setPassword.save')}
          </Button>
        </View>
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: {
    flexGrow: 1,
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
    fontSize: 15,
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
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
  },
  foot: { marginTop: 'auto', paddingBottom: 12 },
});
