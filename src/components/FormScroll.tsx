import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps, type TextInput } from 'react-native';

export type FormScrollRef = {
  registerField: (name: string, ref: React.RefObject<TextInput | null>) => void;
  focusField: (name: string) => void;
};

/**
 * Keeps the focused field visible when its container (e.g. a bottom Sheet)
 * shares the screen with the mobile keyboard. Skipped on iOS — Safari
 * scrolls focused inputs natively and extra scrolling fights the
 * keyboard — and only reacts when the field is genuinely clipped.
 * Safe on web forms: FormScroll sets keyboardDismissMode='none' there,
 * so programmatic scrolling can no longer blur the focused input.
 */
export function useKeepFocusedFieldVisible(enabled = true) {
  React.useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) return;
    const viewport = window.visualViewport;
    const keepFocusVisible = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !['INPUT', 'TEXTAREA'].includes(active.tagName)) return;
      const rect = active.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > viewport.height - 8) {
        requestAnimationFrame(() => active.scrollIntoView({ block: 'center', behavior: 'auto' }));
      }
    };
    viewport.addEventListener('resize', keepFocusVisible);
    viewport.addEventListener('scroll', keepFocusVisible);
    return () => { viewport.removeEventListener('resize', keepFocusVisible); viewport.removeEventListener('scroll', keepFocusVisible); };
  }, [enabled]);
}

/** A form viewport that follows the native keyboard and keeps focused fields reachable. */
export const FormScroll = React.forwardRef<FormScrollRef, ScrollViewProps>(function FormScroll({ children, contentContainerStyle, style, ...props }, ref) {
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollOffset = React.useRef(0);
  const fields = React.useRef(new Map<string, React.RefObject<TextInput | null>>());
  React.useImperativeHandle(ref, () => ({
    registerField: (name, inputRef) => fields.current.set(name, inputRef),
    focusField: (name) => {
      let input = fields.current.get(name)?.current;
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        input = Array.from(document.querySelectorAll<HTMLElement>('[data-form-field]'))
          .find((element) => element.dataset.formField === name) as unknown as TextInput | undefined ?? input;
      }
      if (!input) return;
      input.focus();
      if (Platform.OS === 'web') {
        (input as unknown as HTMLElement).scrollIntoView?.({ block: 'center', behavior: 'auto' });
        return;
      }
      input.measureInWindow((_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffset.current + y - 150), animated: true });
      });
    },
  }), []);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        {...props}
        style={[{ flex: 1 }, style]}
        contentContainerStyle={contentContainerStyle}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; props.onScroll?.(event); }}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
});
