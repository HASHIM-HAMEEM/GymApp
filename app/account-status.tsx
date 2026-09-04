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
  const { profile, authError, signOut, darkMode } = useApp();
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
        <Text style={[styles.title, { color: c.ink }]}>
          {suspended ? 'Account access paused' : 'Account setup incomplete'}
        </Text>
        <Text style={[styles.body, { color: c.ink2 }]}>
          {suspended
            ? 'Reception has paused this account. Your membership history is safe, but the app stays locked until an administrator restores access.'
            : 'This sign-in is valid, but it is not linked to a Meridian profile. Ask reception to check the account invitation.'}
        </Text>
        {authError ? <Banner variant="error">{authError}</Banner> : null}
      </View>
      <Button block loading={signingOut} onPress={leave}>
        Sign out
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
