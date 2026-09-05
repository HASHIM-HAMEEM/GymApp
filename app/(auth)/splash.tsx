import * as React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { LaunchBrand } from '@/components/LaunchBrand';
import { typography } from '@/theme/tokens';
import { useReducedMotion } from '@/lib/useReducedMotion';

export default function Splash() {
  const router = useRouter();
  const { t, isRtl } = useApp();
  const reducedMotion = useReducedMotion();
  const exit = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
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
  }, [exit, reducedMotion, router]);

  const opacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const scale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <LaunchBrand subtitle={t('welcome.athleticClub')} isRtl={isRtl} />
      </Animated.View>
      <Text style={[styles.foot, { writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.version')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#050708',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  foot: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.18,
    color: '#52616B',
    textTransform: 'uppercase',
    position: 'absolute',
    bottom: 60,
  },
});
