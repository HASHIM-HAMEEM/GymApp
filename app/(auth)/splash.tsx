import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, tracking } from '@/theme/tokens';
import { Logo } from '@/components/Logo';
import { useApp } from '@/providers/AppProvider';

export default function Splash() {
  const router = useRouter();
  const { t, isRtl } = useApp();

  React.useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/welcome');
    }, 2200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.wrap}>
      <View style={{ alignItems: 'center', marginTop: -20 }}>
        <Logo size={64} strokeWidth={3} />
        <Text style={[styles.wm, { writingDirection: isRtl ? 'rtl' : 'ltr' }]}>Apex</Text>
        <Text style={[styles.cap, { writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.athleticClub')}</Text>
      </View>
      <Text style={[styles.foot, { writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t('welcome.version')}</Text>
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
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.14,
    color: colors.ink3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  foot: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.18,
    color: colors.ink4,
    textTransform: 'uppercase',
    position: 'absolute',
    bottom: 60,
  },
});
