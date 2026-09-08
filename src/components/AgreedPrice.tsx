import * as React from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from './Button';
import { Control, Field } from './Field';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/theme/tokens';

export function pricingError(value: string, reason: string) {
  if (!value.trim()) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 9999999999.99) return 'Enter a positive agreed price with at most two decimals.';
  if (!reason.trim()) return 'Add a short reason for this member’s price.';
  return null;
}

export function AgreedPrice({
  value,
  reason,
  onValue,
  onReason,
  valueRef,
  reasonRef,
  error,
  valueFieldKey,
  reasonFieldKey,
}: {
  value: string;
  reason: string;
  onValue: (s: string) => void;
  onReason: (s: string) => void;
  valueRef?: React.Ref<TextInput>;
  reasonRef?: React.Ref<TextInput>;
  error?: string;
  valueFieldKey?: string;
  reasonFieldKey?: string;
}) {
  const {darkMode}=useApp(); const c=useColors(darkMode);
  const [open,setOpen]=React.useState(false);
  const valueHasError = Boolean(error) && (!value.trim() || !/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 9999999999.99);
  if(!open) return <Button variant="quiet" onPress={()=>setOpen(true)}>Custom price or discount</Button>;
  return <View style={{gap:12,padding:16,borderWidth:1,borderColor:c.line,borderRadius:16,backgroundColor:c.bg1}}>
    <Text style={{color:c.ink2,fontSize:13,lineHeight:19}}>For this membership only. The club’s plan price stays unchanged.</Text>
    <Field label="Agreed price" error={valueHasError ? error : undefined}><Control ref={valueRef} fieldKey={valueFieldKey} accessibilityLabel="Agreed price" value={value} onChangeText={onValue} inputMode="decimal" returnKeyType="next" onSubmitEditing={() => (reasonRef as React.RefObject<TextInput | null> | undefined)?.current?.focus()} /></Field>
    <Field label="Reason" error={error && !valueHasError ? error : undefined}><Control ref={reasonRef} fieldKey={reasonFieldKey} accessibilityLabel="Pricing reason" value={reason} onChangeText={onReason} placeholder="Student discount" maxLength={240} returnKeyType="done" /></Field>
    <Button variant="quiet" onPress={()=>{onValue('');onReason('');setOpen(false);}}>Use standard price</Button>
  </View>;
}
