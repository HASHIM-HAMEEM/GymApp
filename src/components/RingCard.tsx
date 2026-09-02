import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Svg, G, Circle } from 'react-native-svg';
import { useColors, spacing, typography, radius } from '@/theme/tokens';
import { Tag, TagVariant } from './Tag';

export type RingVariant = 'ok' | 'warn' | 'bad' | 'muted';

export interface RingCardProps {
  value: string;
  unit: string;
  variant: RingVariant;
  tag: { label: string; variant?: TagVariant };
  title: string;
  subtitle?: string;
  progress: number; // 0..1
  children?: React.ReactNode;
}

const CIRCUMFERENCE = 2 * Math.PI * 46; // r=46

export function RingCard({ value, unit, variant, tag, title, subtitle, progress, children }: RingCardProps) {
  const c = useColors(true); // ring cards always sit on bg-1 in dark / light
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));

  const stroke =
    variant === 'ok' ? c.ok : variant === 'warn' ? c.warn : variant === 'bad' ? c.bad : c.ink4;
  const valueColor =
    variant === 'ok' ? c.ink : variant === 'warn' ? c.warn : variant === 'bad' ? c.bad : c.ink3;

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg1, borderColor: c.line }]}>
      <View style={styles.row}>
        <View style={styles.ring}>
          <Svg width={108} height={108} viewBox="0 0 108 108">
            <G rotation={-90} originX={54} originY={54}>
              <Circle
                cx={54}
                cy={54}
                r={46}
                stroke={c.ink}
                strokeOpacity={0.08}
                strokeWidth={7}
                fill="none"
              />
              <Circle
                cx={54}
                cy={54}
                r={46}
                stroke={stroke}
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
              />
            </G>
          </Svg>
          <View style={styles.center}>
            <Text style={[styles.n, { color: valueColor }]}>{value}</Text>
            <Text style={[styles.u, { color: c.ink3 }]}>{unit}</Text>
          </View>
        </View>

        <View style={styles.info}>
          <Tag variant={tag.variant ?? 'ok'}>{tag.label}</Tag>
          <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: c.ink3 }]}>{subtitle}</Text> : null}
        </View>
      </View>

      {children ? <View style={styles.tail}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 20,
    gap: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ring: { width: 108, height: 108, position: 'relative' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  n: {
    fontFamily: typography.display,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.02,
    lineHeight: 30,
  },
  u: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  info: { flex: 1, minWidth: 0, gap: 6 },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 20,
  },
  tail: { marginTop: 2 },
});
