import * as React from 'react';
import { View, Text, StyleSheet, ViewStyle, Platform, Animated, Easing } from 'react-native';
import { colors, useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { useApp } from '@/data/store';
import { Icon, IconName } from './Icon';

/* ------------------------------------------------------------------ */
/* Banner — info / warn / error / offline                              */
/* ------------------------------------------------------------------ */

export type BannerVariant = 'info' | 'warn' | 'error' | 'offline';

export function Banner({
  variant = 'info',
  icon: iconProp,
  children,
  style,
}: {
  variant?: BannerVariant;
  icon?: IconName;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const { bg, fg, icon } = bannerVisuals(variant, c);
  return (
    <View
      style={[
        bannerStyles.base,
        { backgroundColor: bg, borderColor: fg + '33', flexDirection: isRtl ? 'row-reverse' : 'row' },
        style,
      ]}
    >
      <Icon name={iconProp ?? icon} size={19} color={fg} />
      <Text
        style={{
          flex: 1,
          fontFamily: typography.fontFamily,
          fontSize: 13.5,
          color: fg,
          lineHeight: 19,
          writingDirection: isRtl ? 'rtl' : 'ltr',
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function bannerVisuals(v: BannerVariant, c: ReturnType<typeof useColors>): { bg: string; fg: string; icon: IconName } {
  switch (v) {
    case 'warn':
      return { bg: c.warnSoft, fg: c.warn, icon: 'alertc' };
    case 'error':
      return { bg: c.badSoft, fg: c.bad, icon: 'xc' };
    case 'offline':
      return { bg: c.bg2, fg: c.ink2, icon: 'wifioff' };
    case 'info':
    default:
      return { bg: c.accentSoft, fg: c.accentHi, icon: 'receipt' };
  }
}

const bannerStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});

/* ------------------------------------------------------------------ */
/* Skeleton — shimmer animation mirrors layout                         */
/* ------------------------------------------------------------------ */

export function Skeleton({ width, height, radius: r = 8, style }: { width?: import('react-native').DimensionValue; height?: import('react-native').DimensionValue; radius?: number; style?: ViewStyle }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const opacity = React.useRef(new Animated.Value(0.35)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius: r,
            backgroundImage: 'linear-gradient(100deg, ' + c.line + ' 40%, ' + c.bg2 + ' 50%, ' + c.line + ' 60%)',
            backgroundSize: '200% 100%',
            animation: 'sh 1.4s linear infinite',
          } as any,
          style,
        ]}
      />
    );
  }

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: r,
          backgroundColor: c.line2,
          opacity,
        },
        style,
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 30, paddingHorizontal: 18 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.bg2,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: c.line2,
        }}
      >
        <Icon name={icon} size={30} color={c.ink3} />
      </View>
      <Text
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 17,
          fontWeight: '600',
          color: c.ink,
          textAlign: 'center',
          writingDirection: textDir,
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 14,
            color: c.ink2,
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: 30 * 8,
            writingDirection: textDir,
          }}
        >
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Card surface                                                        */
/* ------------------------------------------------------------------ */

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View
      style={[
        {
          backgroundColor: c.bg1,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* KV row + list                                                       */
/* ------------------------------------------------------------------ */

export function KVRow({
  icon,
  label,
  children,
}: {
  icon?: IconName;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  return (
    <View
      style={{
        flexDirection: isRtl ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: c.bg1,
        borderBottomWidth: 1,
        borderColor: c.line,
      }}
    >
      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        {icon ? <Icon name={icon} size={18} color={c.ink3} /> : null}
        <Text
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 14,
            color: c.ink2,
            writingDirection: textDir,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Text
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 14,
            fontWeight: '500',
            letterSpacing: tracking.ui,
            color: c.ink,
            textAlign: isRtl ? 'left' : 'right',
            writingDirection: textDir,
          }}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

export function KVList({ children }: { children: React.ReactNode }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.line,
        overflow: 'hidden',
      }}
    >
      {React.Children.map(children, (c2, i) => (
        <View key={i}>{c2}</View>
      ))}
    </View>
  );
}
