import * as React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { colors, useColors, radius, spacing, typography } from '@/theme/tokens';
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
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.scrim} onPress={onClose}>
        <Pressable style={[sheetStyles.sheet, { backgroundColor: c.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[sheetStyles.grip, { backgroundColor: c.lineStrong }]} />
          {title ? (
            <Text style={[sheetStyles.title, { color: c.ink }]}>{title}</Text>
          ) : null}
          {desc ? (
            <Text style={[sheetStyles.desc, { color: c.ink2 }]}>{desc}</Text>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,29,40,0.4)',
  },
  sheet: {
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
    fontSize: 14,
    color: colors.ink2,
    marginTop: 6,
    lineHeight: 20,
  },
});

/* ------------------------------------------------------------------ */
/* Confirmation modal — before consequential change                    */
/* ------------------------------------------------------------------ */

export interface ConfirmModalProps {
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
  visible,
  title,
  children,
  cancelLabel = 'Back',
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
  confirmVariant = 'primary',
}: ConfirmModalProps) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={modalStyles.scrim}>
        <View style={[modalStyles.modal, { backgroundColor: c.surface }]}>
          <Text style={[modalStyles.title, { color: c.ink }]}>{title}</Text>
          <Text style={[modalStyles.body, { color: c.ink2 }]}>{children}</Text>
          <View style={modalStyles.acts}>
            <Button variant="secondary" block onPress={onCancel} style={{ flex: 1 }}>
              {cancelLabel}
            </Button>
            <Button variant={confirmVariant} block onPress={onConfirm} style={{ flex: 1.3 }}>
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
    backgroundColor: 'rgba(16,29,40,0.4)',
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
    fontSize: 14.5,
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
                fontSize: 14,
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
  on,
  onPress,
  count,
}: {
  children: React.ReactNode;
  on?: boolean;
  onPress?: () => void;
  count?: React.ReactNode;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 99,
        backgroundColor: on ? c.ink : c.surface,
        borderWidth: 1,
        borderColor: on ? c.ink : c.lineStrong,
      }}
    >
      <Text
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 13,
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
            fontSize: 12,
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
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: c.surface,
          transform: [{ translateX: on ? 18 : 0 }],
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
          fontSize: 12,
          color: c.ink2,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
