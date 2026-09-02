import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, tracking } from '@/theme/tokens';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { useApp } from '@/data/store';
import { CURRENT_MEMBER_ID } from '@/data/plans';

export default function Index() {
  const router = useRouter();
  const { signIn, signInAsAdmin, darkMode } = useApp();
  const c = useColors(darkMode);

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={styles.brand}>
        <Logo size={48} strokeWidth={3} />
        <Text style={[styles.wm, { color: c.ink }]}>Meridian</Text>
        <Text style={[styles.sub, { color: c.ink3 }]}>Athletic Club</Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.h1, { color: c.ink }]}>Your membership,{'\n'}always with you.</Text>
        <Text style={[styles.lede, { color: c.ink2 }]}>
          A boutique gym membership product for members and reception staff.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          block
          onPress={() => {
            signIn(CURRENT_MEMBER_ID);
            router.replace('/(member)/home');
          }}
        >
          Open member app
        </Button>
        <Button
          variant="secondary"
          block
          onPress={() => {
            signInAsAdmin();
            router.replace('/(admin)/today');
          }}
        >
          Open admin workspace
        </Button>
      </View>

      <Text style={[styles.foot, { color: c.ink4 }]}>EST. 2019 · CAIRO · DEMO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: 40,
    paddingBottom: 50,
  },
  brand: {
    alignItems: 'center',
    gap: 8,
  },
  wm: {
    fontFamily: typography.display,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0.18,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  sub: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.14,
    textTransform: 'uppercase',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
  },
  h1: {
    fontFamily: typography.display,
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: tracking.tight,
    lineHeight: 34,
  },
  lede: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 23,
  },
  actions: {
    gap: 12,
  },
  foot: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: tracking.caps,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
