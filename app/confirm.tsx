import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, useColors, spacing, typography } from '@/theme/tokens';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { requireSupabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';

type Phase = 'verifying' | 'done' | 'error';

const consumedTokens = new Set<string>();

/**
 * Email link landing route. Supabase auth emails send a one-time token hash
 * here (invite acceptance and password recovery). The hash is exchanged for
 * a session — tokens themselves never appear in app storage or deep links.
 */
export default function Confirm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token_hash?: string; type?: string; next?: string }>();
  const { darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const [phase, setPhase] = React.useState<Phase>('verifying');
  const [message, setMessage] = React.useState(t('confirm.verifying'));
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;
    let active = true;
    const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : '';
    const rawType = typeof params.type === 'string' ? params.type : '';
    const type = rawType === 'invite' || rawType === 'recovery' || rawType === 'email' ? rawType : null;

    if (!supabaseConfigured() || !tokenHash || !type) {
      setPhase('error');
      setMessage(
        !tokenHash || !type
          ? t('confirm.incompleteLink')
          : t('common.configurationError'),
      );
      return;
    }

    if (consumedTokens.has(tokenHash)) {
      setPhase('error');
      setMessage(t('confirm.alreadyVerified'));
      return;
    }

    startedRef.current = true;
    consumedTokens.add(tokenHash);
    setPhase('verifying');
    setMessage(t('confirm.verifying'));
    router.replace('/confirm');

    requireSupabase()
      .auth.verifyOtp({ token_hash: tokenHash, type })
      .then(({ error }) => {
        if (!active) return;
        if (error) {
          setPhase('error');
          setMessage(t('confirm.expiredLink'));
          return;
        }
        setPhase('done');
        setMessage(
          type === 'invite'
            ? t('confirm.inviteVerified')
            : t('confirm.recoveryVerified'),
        );
      })
      .catch(() => {
        if (!active) return;
        setPhase('error');
        setMessage(t('confirm.requestFailed'));
      });
    return () => { active = false; };
  }, [params.token_hash, params.type, t, router]);

  React.useEffect(() => {
    if (phase !== 'done') return;
    const timer = setTimeout(() => router.replace('/set-password'), 900);
    return () => clearTimeout(timer);
  }, [phase, router]);

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={styles.center}>
        {phase === 'verifying' ? (
          <Logo size={52} strokeWidth={2.8} />
        ) : (
          <View
            style={[
              styles.badge,
              { backgroundColor: phase === 'done' ? c.okSoft : c.badBg },
            ]}
          >
            <Icon name={phase === 'done' ? 'check' : 'alertc'} size={36} color={phase === 'done' ? c.ok : c.bad} />
          </View>
        )}
        <Text style={[styles.title, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
          {phase === 'verifying' ? t('confirm.oneMoment') : phase === 'done' ? t('confirm.emailVerified') : t('confirm.linkProblem')}
        </Text>
        <Text style={[styles.body, { color: c.ink2, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{message}</Text>
      </View>

      {phase === 'error' ? (
        <View style={styles.foot}>
          <Button block href="/signin">
            {t('confirm.goToSignIn')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function supabaseConfigured() {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: 80,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  foot: { paddingBottom: 8 },
});
