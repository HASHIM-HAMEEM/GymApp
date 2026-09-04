import * as React from 'react';
import { View, Text } from 'react-native';
import { useColors, typography } from '@/theme/tokens';
import { useApp } from '@/data/store';

/* ------------------------------------------------------------------ */
/* Date timeline — start → today → end                                 */
/* ------------------------------------------------------------------ */

export interface TimelineProps {
  /** 0..100 fill width */
  fill: number;
  /** color of the fill and active point */
  fillColor?: string;
  l1: [string, string];
  l2: [string, string];
  l3?: [string, string];
}

export function Timeline({ fill, fillColor, l1, l2, l3 }: TimelineProps) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const fc = fillColor ?? c.accent;
  const clamped = Math.max(0, Math.min(100, fill));
  return (
    <View style={{ height: 64, marginTop: 4 }}>
      {/* track */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 22,
          height: 3,
          borderRadius: 99,
          backgroundColor: c.bg3,
        }}
      />
      {/* fill */}
      <View
        style={{
          position: 'absolute',
          left: isRtl ? `${100 - clamped}%` : 0,
          top: 22,
          height: 3,
          width: `${clamped}%`,
          borderRadius: 99,
          backgroundColor: fc,
        }}
      />

      {/* start point */}
      <Dot left={isRtl ? 100 : 0} color={fc} />
      {/* today point */}
      <Dot left={isRtl ? 100 - clamped : clamped} color={fc} big />
      {/* end point */}
      <Dot left={isRtl ? 0 : 100} color={c.ink4} />

      {/* labels */}
      <View style={{ position: 'absolute', top: 38, left: 0, right: 0, flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
        <Label a={l1[0]} b={l1[1]} ink3={c.ink4} ink={c.ink} align={isRtl ? 'right' : 'left'} isRtl={isRtl} />
        <Label a={l2[0]} b={l2[1]} ink3={c.ink4} ink={fc} align="center" left={`${isRtl ? 100 - clamped : clamped}%`} isRtl={isRtl} />
        {l3 ? <Label a={l3[0]} b={l3[1]} ink3={c.ink4} ink={c.ink} align={isRtl ? 'left' : 'right'} isRtl={isRtl} /> : <View style={{ width: 60 }} />}
      </View>
    </View>
  );
}

function Dot({ left, color, big = false }: { left: number; color: string; big?: boolean }) {
  const size = 11;
  const off = size / 2;
  return (
    <View
      style={{
        position: 'absolute',
        left: `${Math.max(0, Math.min(100, left))}%`,
        top: 22,
        marginTop: -off,
        marginLeft: -off,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'transparent',
        borderWidth: big ? 2.5 : 2.5,
        borderColor: color,
      }}
    />
  );
}

function Label({
  a,
  b,
  ink3,
  ink,
  align,
  left,
  isRtl,
}: {
  a: string;
  b: string;
  ink3: string;
  ink: string;
  align: 'left' | 'center' | 'right';
  left?: string;
  isRtl: boolean;
}) {
  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  const pos = left ? { position: 'absolute', left } as any : undefined;
  const textDir = isRtl ? 'rtl' : 'ltr';
  return (
    <View style={[{ alignItems }, pos]}>
      <Text
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 9.5,
          color: ink3,
          fontWeight: '600',
          letterSpacing: 0.1,
          textTransform: 'uppercase',
          writingDirection: textDir,
        }}
      >
        {a}
      </Text>
      <Text
        style={{
          fontFamily: typography.display,
          fontSize: 12,
          color: ink,
          fontWeight: '600',
          marginTop: 2,
          writingDirection: textDir,
        }}
      >
        {b}
      </Text>
    </View>
  );
}
