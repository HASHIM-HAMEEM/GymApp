import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { useColors, spacing, typography } from '@/theme/tokens';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Banner } from '@/components/Surfaces';

export default function AccountStatus() {
  const router = useRouter();
  const { profile, authError, signOut, darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const suspended = profile?.status === 'suspended';
  const [signingOut, setSigningOut] = React.useState(false);

  const leave = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/welcome');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={styles.center}>
        <Logo size={48} strokeWidth={2.8} />
        <Text style={[styles.title, { color: c.ink, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
          {suspended ? t('accountStatus.suspendedTitle') : t('accountStatus.incompleteTitle')}
        </Text>
        <Text style={[styles.body, { color: c.ink2, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>
          {suspended ? t('accountStatus.suspendedBody') : t('accountStatus.incompleteBody')}
        </Text>
        {authError ? (
          <Banner variant="error" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            <Text style={{ writingDirection: isRtl ? 'rtl' : 'ltr' }}>{authError}</Text>
          </Banner>
        ) : null}
      </View>
      <Button block loading={signingOut} onPress={leave}>
        {t('settings.signOut')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
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
  title: {
    fontFamily: typography.display,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 310,
  },
});
