import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, tracking } from '@/theme/tokens';
import { Logo } from '@/components/Logo';

export default function Splash() {
  const router = useRouter();

  React.useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/signin');
    }, 2200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.wrap}>
      <View style={{ alignItems: 'center', marginTop: -20 }}>
        <Logo size={64} strokeWidth={3} />
        <Text style={styles.wm}>Meridian</Text>
        <Text style={styles.cap}>Athletic Club</Text>
      </View>
      <Text style={styles.foot}>Membership · V2.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  wm: {
    fontFamily: typography.display,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 0.18,
    color: colors.ink,
    textTransform: 'uppercase',
    marginTop: 18,
  },
  cap: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.14,
    color: colors.ink3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  foot: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.18,
    color: colors.ink4,
    textTransform: 'uppercase',
    position: 'absolute',
    bottom: 60,
  },
});
