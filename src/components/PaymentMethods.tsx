import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/theme/tokens';

type Method = 'cash' | 'card' | 'upi' | 'wallet' | 'complimentary';
export function PaymentMethods<T extends Method>({ value, onChange, methods, disabled = false }: { value: T; onChange: (method: T) => void; methods: readonly T[]; disabled?: boolean }) {
  const { darkMode, t, isRtl } = useApp();
  const c = useColors(darkMode);
  return <View accessibilityRole="radiogroup" accessibilityLabel={t('renew.paymentMethod')} style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
    {methods.map((method) => <Pressable key={method} accessibilityRole="radio" accessibilityState={{ checked: value === method, disabled }} disabled={disabled} onPress={() => onChange(method)} style={{ width: '48%', flexGrow: 1, minWidth: 120, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: value === method ? c.accent : c.line2, backgroundColor: value === method ? c.accentSoft : c.bg1, padding: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: value === method ? c.accent : c.ink3, alignItems: 'center', justifyContent: 'center' }}>{value === method ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}</View>
      <Text style={{ flex: 1, color: c.ink, fontSize: 13, lineHeight: 19, fontWeight: '500', writingDirection: isRtl ? 'rtl' : 'ltr' }}>{t(`payment.${method}`)}</Text>
    </Pressable>)}
  </View>;
}
