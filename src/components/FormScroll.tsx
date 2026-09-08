import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps } from 'react-native';

/** A form viewport that follows the native keyboard and keeps focused fields reachable. */
export function FormScroll({ children, contentContainerStyle, style, ...props }: ScrollViewProps) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        {...props}
        style={[{ flex: 1 }, style]}
        contentContainerStyle={contentContainerStyle}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
