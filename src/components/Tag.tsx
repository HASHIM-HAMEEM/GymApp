import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { useApp } from '@/data/store';

/* ------------------------------------------------------------------ */
/* Status tag — the entire status vocabulary                           */
/* Dot prefix is part of the tag's meaning (status indicator).        */
/* ------------------------------------------------------------------ */

export type TagVariant = 'ok' | 'warn' | 'bad' | 'muted' | 'accent' | 'plain';

export function Tag({
  variant = 'plain',
  children,
  style,
  live,
}: {
  variant?: TagVariant;
  children: React.ReactNode;
  style?: any;
  live?: boolean;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const { bg, fg } = tagColors(variant, c);
  return (
    <View style={[tagStyles.base, { backgroundColor: bg }, style]}>
      <View style={[tagStyles.dot, { backgroundColor: fg, opacity: live ? 1 : 0.9 }]}>
        {live ? <View style={[tagStyles.pulse, { backgroundColor: fg }]} /> : null}
      </View>
      <Text
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 10.5,
          fontWeight: '600',
          letterSpacing: 0.08,
          color: fg,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function tagColors(variant: TagVariant, c: ReturnType<typeof useColors>): { bg: string; fg: string } {
  switch (variant) {
    case 'ok':
      return { bg: c.okSoft, fg: c.ok };
    case 'warn':
      return { bg: c.warnSoft, fg: c.warn };
    case 'bad':
      return { bg: c.badSoft, fg: c.bad };
    case 'muted':
      return { bg: c.mutedBg, fg: c.ink3 };
    case 'accent':
      return { bg: c.accentSoft, fg: c.accentHi };
    case 'plain':
    default:
      return { bg: c.bg2, fg: c.ink2 };
  }
}

const tagStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 999,
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.35,
  },
});

/* ------------------------------------------------------------------ */
/* Status dot                                                          */
/* ------------------------------------------------------------------ */

export type DotVariant = 'ok' | 'warn' | 'bad' | 'muted';

export function StatusDot({ variant = 'muted', size = 8 }: { variant?: DotVariant; size?: number }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const dotC =
    variant === 'ok'
      ? c.okDot
      : variant === 'warn'
        ? c.warnDot
        : variant === 'bad'
          ? c.badDot
          : c.ink3;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dotC }} />;
}

/* ------------------------------------------------------------------ */
/* Status line — "Membership active · Premium Monthly · Valid until…"  */
/* ------------------------------------------------------------------ */

export function StatusLine({
  variant = 'ok',
  children,
  plan,
}: {
  variant?: DotVariant;
  children: React.ReactNode;
  plan?: string;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <StatusDot variant={variant} />
      <Text
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 13.5,
          fontWeight: '500',
          color: c.ink,
        }}
      >
        {children}
        {plan ? <Text style={{ color: c.ink2, fontWeight: '400' }}>{plan}</Text> : null}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Overline / kicker / section label                                   */
/* ------------------------------------------------------------------ */

export function Overline({ children, color }: { children: React.ReactNode; color?: string }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <Text
      style={{
        fontFamily: typography.fontFamily,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: tracking.caps,
        color: color ?? c.ink3,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <Text
      style={{
        fontFamily: typography.fontFamily,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: tracking.caps,
        color: c.ink3,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Monogram avatar                                                     */
/* ------------------------------------------------------------------ */

export type MonogramVariant = 'ok' | 'warn' | 'bad' | 'muted' | 'accent';

export function Monogram({
  text,
  size = 40,
  fontSize = 13.5,
  bg,
  color,
  variant = 'accent',
}: {
  text: string;
  size?: number;
  fontSize?: number;
  bg?: string;
  color?: string;
  variant?: MonogramVariant;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const v = monogramColors(variant, c);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? v.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: typography.display,
          fontSize,
          fontWeight: '600',
          color: color ?? v.fg,
          letterSpacing: 0.02,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function monogramColors(variant: MonogramVariant, c: ReturnType<typeof useColors>): { bg: string; fg: string } {
  switch (variant) {
    case 'ok':
      return { bg: c.okSoft, fg: c.ok };
    case 'warn':
      return { bg: c.warnSoft, fg: c.warn };
    case 'bad':
      return { bg: c.badSoft, fg: c.bad };
    case 'muted':
      return { bg: c.mutedBg, fg: c.ink3 };
    case 'accent':
    default:
      return { bg: c.accentSoft, fg: c.accentHi };
  }
}
