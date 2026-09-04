import * as React from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
  Animated,
} from 'react-native';
import { Link, type Href } from 'expo-router';
import { colors, useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { useApp } from '@/data/store';
import { Icon, IconName } from './Icon';
import type { TranslationKey } from '@/lib/i18n';

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  icon?: IconName;
  children: React.ReactNode;
  onPress?: () => void;
  href?: Href;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  block = false,
  icon,
  children,
  onPress,
  href,
  style,
  textStyle,
}: ButtonProps) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const scale = React.useRef(new Animated.Value(1)).current;

  const height = size === 'sm' ? 40 : 52;
  const padH = size === 'sm' ? 16 : 22;
  const fontSize = size === 'sm' ? 14 : 15.5;
  const r = size === 'sm' ? 10 : 16;

  const bg =
    variant === 'primary'
      ? c.accent
      : variant === 'secondary'
        ? c.bg2
        : variant === 'danger'
          ? c.badSoft
          : 'transparent';
  const fg =
    variant === 'primary'
      ? c.accentInk
      : variant === 'secondary'
        ? c.ink
        : variant === 'danger'
          ? c.bad
          : c.ink2;
  const border =
    variant === 'secondary'
      ? c.line2
      : 'transparent';

  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.985, duration: 100, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const control = (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btnBase,
        {
          height,
          paddingHorizontal: padH,
          backgroundColor: bg,
          borderColor: border,
          borderRadius: r,
          opacity: isDisabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={[styles.btnInner, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} color={fg} />}
          <Text
            style={[
              {
                fontFamily: typography.fontFamily,
                fontSize,
                fontWeight: '600',
                letterSpacing: -0.005,
                color: fg,
                marginLeft: icon && !isRtl ? 9 : 0,
                marginRight: icon && isRtl ? 9 : 0,
                writingDirection: isRtl ? 'rtl' : 'ltr',
              },
              textStyle,
            ]}
          >
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <Animated.View style={{ transform: [{ scale }], ...(block ? { alignSelf: 'stretch', width: '100%' } as any : {}) }}>
      {href ? <Link href={href} asChild>{control}</Link> : control}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btnBase: {
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  btnBlock: { alignSelf: 'stretch', width: '100%' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

/* ------------------------------------------------------------------ */
/* Text button (inline, quiet)                                         */
/* ------------------------------------------------------------------ */

export function TextButton({
  children,
  onPress,
  color,
  quiet = false,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  color?: string;
  quiet?: boolean;
  style?: TextStyle;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {({ pressed }) => (
        <Text
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 14,
            fontWeight: '600',
            letterSpacing: tracking.ui,
            color: quiet ? c.ink2 : (color ?? c.accent),
            opacity: pressed ? 0.6 : 1,
            ...style,
          }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Icon button (app bar back / close)                                  */
/* ------------------------------------------------------------------ */

export function IconButton({
  name,
  onPress,
  color,
  size = 24,
  accessibilityLabel,
}: {
  name: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  accessibilityLabel?: string;
}) {
  const { darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const fallbackKey: TranslationKey =
    name === 'back'
      ? 'common.back'
      : name === 'close'
        ? 'common.close'
        : name === 'search'
          ? 'common.search'
          : name === 'refresh'
            ? 'common.refresh'
            : name === 'plus' || name === 'add'
              ? 'common.add'
              : 'common.iconButton';
  const fallbackLabel = t(fallbackKey);
  const mirrorIcon = isRtl && (name === 'back' || name === 'chev' || name === 'next' || name === 'prev');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? fallbackLabel}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <View style={mirrorIcon ? { transform: [{ scaleX: -1 }] } : undefined}>
        <Icon name={name} size={size} color={color ?? c.ink} />
      </View>
    </Pressable>
  );
}
