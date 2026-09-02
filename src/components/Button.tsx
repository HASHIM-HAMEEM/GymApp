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
import { colors, useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { useApp } from '@/data/store';
import { Icon, IconName } from './Icon';

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
  style?: ViewStyle;
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
  style,
}: ButtonProps) {
  const { darkMode } = useApp();
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
    Animated.timing(scale, { toValue: 0.985, duration: 100, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], ...(block ? { alignSelf: 'stretch', width: '100%' } as any : {}) }}>
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
          <View style={styles.btnInner}>
            {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} color={fg} />}
            <Text
              style={{
                fontFamily: typography.fontFamily,
                fontSize,
                fontWeight: '600',
                letterSpacing: -0.005,
                color: fg,
                marginLeft: icon ? 9 : 0,
              }}
            >
              {children}
            </Text>
          </View>
        )}
      </Pressable>
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
}: {
  name: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Icon name={name} size={size} color={color ?? c.ink} />
    </Pressable>
  );
}
