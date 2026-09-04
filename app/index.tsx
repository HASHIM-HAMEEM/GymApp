import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { colors } from '@/theme/tokens';
import { Logo } from '@/components/Logo';

/**
 * Session router. It remains the root anchor so protected-route fallbacks
 * always resolve deterministically instead of landing on an auth callback.
 */
export default function Index() {
  const router = useRouter();
  const { session, profile, role, authLoading } = useApp();

  React.useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace('/welcome');
      return;
    }
    if (!profile || profile.status === 'suspended') {
      router.replace('/account-status');
      return;
    }
    if (profile.mustSetPassword || profile.status === 'invited') {
      router.replace('/set-password');
      return;
    }
    router.replace(role === 'admin' ? '/(admin)/today' : '/(member)/home');
  }, [authLoading, profile, role, router, session]);

  return (
    <View style={styles.wrap}>
      <Logo size={44} strokeWidth={2.6} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
