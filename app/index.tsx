import * as React from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { LaunchBrand } from '@/components/LaunchBrand';
import { useReducedMotion } from '@/lib/useReducedMotion';

/**
 * Session router. It remains the root anchor so protected-route fallbacks
 * always resolve deterministically instead of landing on an auth callback.
 */
export default function Index() {
  const router = useRouter();
  const { session, profile, role, authLoading, t, isRtl } = useApp();
  const reducedMotion = useReducedMotion();
  const exit = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (authLoading) return;
    if (!session) {
      if (reducedMotion) {
        router.replace('/welcome');
        return;
      }
      const animation = Animated.sequence([
        Animated.delay(260),
        Animated.timing(exit, {
          toValue: 1,
          duration: 220,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]);
      animation.start(({ finished }) => {
        if (finished) router.replace('/welcome');
      });
      return () => animation.stop();
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
  }, [authLoading, exit, profile, reducedMotion, role, router, session]);

  const opacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const scale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <LaunchBrand subtitle={t('welcome.athleticClub')} isRtl={isRtl} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#050708',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
