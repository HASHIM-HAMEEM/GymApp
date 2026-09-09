import * as React from 'react';
import { View, Text, StyleSheet, type TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking } from '@/theme/tokens';
import { AppBar } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Banner } from '@/components/Surfaces';
import { useApp } from '@/providers/AppProvider';
import { FormScroll } from '@/components/FormScroll';

/**
 * M-03 & M-04 Sign in — email & password with inline error state.
 * Accounts are created by reception; members only enter credentials here.
 */
export default function SignIn() {
  const router = useRouter();
  const { darkMode, signIn, authError, clearAuthError, configurationError, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const passwordRef = React.useRef<TextInput>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && password.length > 0;

  const submit = async () => {
    if (!emailValid) {
      setFormError(t('auth.emailDomainError'));
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
      <FormScroll contentContainerStyle={styles.body}>
        <View>
          <Text style={[styles.slabel, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('auth.signIn')}</Text>
          <Text style={[styles.h1, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('auth.yourAccount')}</Text>
          <Text style={[styles.lede, { color: c.ink3, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
            {t('auth.signInIntro')}
          </Text>
        </View>

        <Field
          label={t('auth.email')}
          error={formError && !emailValid ? formError : undefined}
          hint={t('auth.emailHint')}
        >
          <Control
            fieldKey="email"
            accessibilityLabel={t('auth.email')}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (formError) setFormError(null);
            }}
            placeholder={t('auth.emailPlaceholder')}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={Boolean(formError && !emailValid)}
          />
        </Field>

        <Field label={t('auth.password')}>
          <Control
            ref={passwordRef}
            fieldKey="password"
            accessibilityLabel={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.passwordPlaceholder')}
            secure
            webType="password"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={canSubmit ? submit : undefined}
          />
        </Field>

        {authError || configurationError ? (
          <Banner variant="error" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            <Text style={{ writingDirection: isRtl ? 'rtl' : 'ltr' }}>
              {authError ? t('auth.invalidCredentials') : t('common.configurationError')}
            </Text>
          </Banner>
        ) : null}

        <View style={styles.foot}>
          <Button block loading={loading} disabled={!canSubmit} onPress={submit}>
            {t('auth.signIn')}
          </Button>
          <Button
            variant="quiet"
            block
            textStyle={{ fontSize: 13, letterSpacing: tracking.small, }}
            href="/forgot-password"
          >
            {t('auth.forgotPassword')}
          </Button>
        </View>
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: 8,
    paddingBottom: 24,
    justifyContent: 'space-between',
    gap: 18,
  },
  slabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
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
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
  },
  foot: {
    marginTop: 'auto',
    gap: 12,
    paddingBottom: 12,
  },
});
