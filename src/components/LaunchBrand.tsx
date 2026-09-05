import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApexMark } from '@/components/Logo';
import { typography } from '@/theme/tokens';

export function LaunchBrand({
  light = false,
  subtitle,
  isRtl = false,
}: {
  light?: boolean;
  subtitle: string;
  isRtl?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <ApexMark size={92} appearance="chrome" light={light} />
      <Text style={[styles.name, { color: light ? '#18242D' : '#EDF5FA' }]}>APEX</Text>
      <Text
        style={[
          styles.subtitle,
          {
            color: light ? '#63727D' : '#8294A0',
            writingDirection: isRtl ? 'rtl' : 'ltr',
          },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  name: {
    marginTop: 12,
    paddingLeft: 18 * 0.18,
    fontFamily: typography.display,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 18 * 0.18,
  },
  subtitle: {
    marginTop: 7,
    paddingLeft: 11 * 0.14,
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 11 * 0.14,
    textTransform: 'uppercase',
  },
});
