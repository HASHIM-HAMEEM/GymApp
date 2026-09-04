import * as React from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, useColors, radius, spacing, typography, tracking } from '@/theme/tokens';
import { useApp } from '@/data/store';
import { Icon, IconName } from './Icon';

/* ------------------------------------------------------------------ */
/* Field + Input control                                               */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  label?: React.ReactNode;
  hint?: string;
  error?: string;
  okMsg?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Field({ label, hint, error, okMsg, children, style }: FieldProps) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const hasError = !!error;
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? (
        <Text
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.04,
            color: c.ink3,
            paddingLeft: 3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      ) : null}
      {children}
      {hasError ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 3 }}>
          <Icon name="alertc" size={13} color={c.bad} />
          <Text style={{ fontFamily: typography.fontFamily, fontSize: 12.5, fontWeight: '500', color: c.bad }}>
            {error}
          </Text>
        </View>
      ) : okMsg ? (
        <Text style={{ fontFamily: typography.fontFamily, fontSize: 12.5, fontWeight: '500', color: c.ok, paddingLeft: 3 }}>
          {okMsg}
        </Text>
      ) : hint ? (
        <Text style={{ fontFamily: typography.fontFamily, fontSize: 12.5, letterSpacing: tracking.small, color: c.ink3, paddingLeft: 3 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface ControlProps {
  accessibilityLabel?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChangeText?: (t: string) => void;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal';
  secure?: boolean;
  leading?: React.ReactNode; // e.g. country code prefix
  trailing?: React.ReactNode; // e.g. ✓ found
  error?: boolean;
  multiline?: boolean;
  style?: ViewStyle;
  autoFocus?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: React.ComponentProps<typeof TextInput>['onSubmitEditing'];
}

export function Control({
  accessibilityLabel,
  value,
  defaultValue,
  placeholder,
  onChangeText,
  inputMode = 'text',
  secure = false,
  leading,
  trailing,
  error = false,
  multiline = false,
  style,
  autoFocus = false,
  maxLength,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
}: ControlProps) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  return (
    <View
      style={[
        ctrlStyles.base,
        { borderColor: error ? c.bad : c.line2, backgroundColor: c.bg1 },
        multiline && { minHeight: 120, alignItems: 'flex-start', paddingVertical: 14 },
        style,
      ]}
    >
      {leading}
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        onChangeText={onChangeText}
        inputMode={inputMode as any}
        secureTextEntry={secure}
        maxLength={maxLength}
        multiline={multiline}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={{
          flex: 1,
          fontFamily: typography.fontFamily,
          fontSize: 16,
          color: c.ink,
          paddingLeft: leading ? 11 : 0,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : 'auto',
        }}
      />
      {trailing}
    </View>
  );
}

const ctrlStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
});

/* ------------------------------------------------------------------ */
/* OTP boxes                                                           */
/* ------------------------------------------------------------------ */

export function OtpBoxes({
  value,
  onChange,
  error = false,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  length?: number;
}) {
  const { darkMode } = useApp();
  const c = useColors(darkMode);
  const refs = React.useRef<(TextInput | null)[]>([]);
  const digits = value.split('');

  const setAt = (i: number, d: string) => {
    const arr = value.split('');
    arr[i] = d;
    const next = arr.join('').slice(0, length);
    onChange(next);
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          value={digits[i] ?? ''}
          inputMode="numeric"
          maxLength={1}
          autoFocus={i === 0}
          onChangeText={(t) => setAt(i, t.replace(/\D/g, '').slice(0, 1))}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
          style={{
            width: 48,
            height: 56,
            borderWidth: 1,
            borderRadius: 14,
            borderColor: error ? c.bad : c.line2,
            backgroundColor: c.bg1,
            textAlign: 'center',
            fontFamily: typography.fontFamily,
            fontSize: 22,
            fontWeight: '600',
            color: c.ink,
          }}
        />
      ))}
    </View>
  );
}
