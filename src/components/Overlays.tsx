import * as React from 'react';
import {
  Animated,
  Platform,
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, useColors, radius, spacing, typography, duration, easing, tracking } from '@/theme/tokens';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useApp } from '@/data/store';
import { Icon } from './Icon';
import { Button } from './Button';

/* ------------------------------------------------------------------ */
/* Bottom sheet — short contextual actions                             */
/* ------------------------------------------------------------------ */

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  desc?: string;
  children?: React.ReactNode;
}

export function Sheet({ visible, onClose, title, desc, children }: SheetProps) {
  const { darkMode, isRtl } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  const reduceMotion = useReducedMotion();
  const transition = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = React.useState(visible);

  React.useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  React.useEffect(() => {
    if (!mounted) return;
    transition.stopAnimation();
    Animated.timing(transition, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? duration.fast : visible ? duration.slow : duration.default,
      easing: visible ? easing.enter : easing.exit,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => transition.stopAnimation();
  }, [mounted, reduceMotion, transition, visible]);

  const translateY = transition.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  const scale = transition.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[sheetStyles.scrimColor, { opacity: transition, pointerEvents: 'none' }]}
      />
      <Pressable style={sheetStyles.scrim} onPress={onClose}>
        <Animated.View
          style={[
            sheetStyles.sheetFrame,
            {
              opacity: transition,
              transform: reduceMotion ? [] : [{ translateY }, { scale }],
            },
          ]}
        >
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
          <Pressable style={[sheetStyles.sheet, { backgroundColor: c.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[sheetStyles.grip, { backgroundColor: c.lineStrong }]} />
            {title ? (
              <Text style={[sheetStyles.title, { color: c.ink, writingDirection: textDir }]}>{title}</Text>
            ) : null}
            {desc ? (
              <Text style={[sheetStyles.desc, { color: c.ink2, writingDirection: textDir }]}>{desc}</Text>
            ) : null}
            {children}
          </Pressable>
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrimColor: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(2,8,12,0.62)',
  },
  sheetFrame: {
    width: '100%',
    maxHeight: '92%',
    maxWidth: 390,
    alignSelf: 'center',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  grip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
  },
  desc: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.ink2,
    marginTop: 6,
    lineHeight: 20,
  },
});

/* ------------------------------------------------------------------ */
/* Confirmation modal — before consequential change                    */
/* ------------------------------------------------------------------ */

export interface ConfirmModalProps {
  pending?: boolean;
  visible: boolean;
  title: string;
  children: React.ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmVariant?: 'primary' | 'danger';
}

export function ConfirmModal({
  pending = false,
  visible,
  title,
  children,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmVariant = 'primary',
}: ConfirmModalProps) {
  const { darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  const textDir = isRtl ? 'rtl' : 'ltr';
  const reduceMotion = useReducedMotion();
  const transition = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = React.useState(visible);
  const resolvedCancel = cancelLabel ?? t('common.back');
  const resolvedConfirm = confirmLabel ?? t('common.confirm');

  React.useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  React.useEffect(() => {
    if (!mounted) return;
    transition.stopAnimation();
    Animated.timing(transition, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? duration.fast : duration.default,
      easing: visible ? easing.enter : easing.exit,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => transition.stopAnimation();
  }, [mounted, reduceMotion, transition, visible]);

  const scale = transition.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={pending ? undefined : onCancel}>
      <Animated.View style={[modalStyles.scrimColor, { opacity: transition, pointerEvents: 'none' }]} />
      <View style={modalStyles.center}>
        <Animated.View
          style={[
            modalStyles.modal,
            { backgroundColor: c.surface },
            {
              opacity: transition,
              transform: reduceMotion ? [] : [{ scale }],
            },
          ]}
        >
          <Text style={[modalStyles.title, { color: c.ink, writingDirection: textDir }]}>{title}</Text>
          <Text style={[modalStyles.body, { color: c.ink2, writingDirection: textDir }]}>{children}</Text>
          <View style={modalStyles.acts}>
            <Button variant="secondary" block disabled={pending} onPress={onCancel} containerStyle={{ flex: 1, width: 'auto' }}>
              {resolvedCancel}
            </Button>
            <Button variant={confirmVariant} block loading={pending} onPress={onConfirm} containerStyle={{ flex: 1, width: 'auto' }}>
              {resolvedConfirm}
            </Button>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  scrimColor: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(16,29,40,0.4)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
  },
  body: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.ink2,
    marginTop: 10,
    lineHeight: 21,
  },
  acts: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
});

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.surface2,
        borderRadius: radius.md,
        padding: 4,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: radius.sm,
              backgroundColor: on ? c.surface : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: on ? 1 : 0,
              borderColor: c.line,
            }}
          >
            <Text
              style={{
                fontFamily: typography.fontFamily,
                fontSize: 15,
                fontWeight: on ? '600' : '500',
                color: on ? c.ink : c.ink2,
              }}
            >
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Chip — filter pill                                                  */
/* ------------------------------------------------------------------ */

export function Chip({
  children,
  leading,
  on,
  onPress,
  count,
}: {
  children: React.ReactNode;
  leading?: React.ReactNode;
  on?: boolean;
  onPress?: () => void;
  count?: React.ReactNode;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(on) }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        paddingVertical: 10,
        flexShrink: 0,
        paddingHorizontal: 14,
        borderRadius: 99,
        backgroundColor: on ? c.ink : c.surface,
        borderWidth: 1,
        borderColor: on ? c.ink : c.lineStrong,
      }}
    >
      {leading ? <View style={{ flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>{leading}</View> : null}
      <Text
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 13,
          letterSpacing: tracking.small,
          fontWeight: on ? '600' : '500',
          color: on ? c.ivory : c.ink2,
        }}
      >
        {children}
      </Text>
      {count != null ? (
        <Text
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 13,
            letterSpacing: tracking.small,
            color: on ? 'rgba(245,243,236,.7)' : c.ink3,
          }}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */

export function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const reduceMotion = useReducedMotion();
  const thumb = React.useRef(new Animated.Value(on ? 18 : 0)).current;

  React.useEffect(() => {
    thumb.stopAnimation();
    if (reduceMotion) {
      thumb.setValue(on ? 18 : 0);
      return;
    }
    Animated.timing(thumb, {
      toValue: on ? 18 : 0,
      duration: duration.fast,
      easing: easing.enter,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [on, reduceMotion, thumb]);

  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: on ? c.accent : c.lineStrong,
        padding: 2,
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: c.surface,
          transform: [{ translateX: thumb }],
        }}
      />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Live indicator — pulse dot + label                                  */
/* ------------------------------------------------------------------ */

export function Live({ label, color }: { label: string; color?: string }) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color ?? c.okDot }} />
      <Text
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 13,
          letterSpacing: tracking.small,
          color: c.ink2,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
